import path from 'path';
import fs from 'fs/promises';

import { EditFormat, FileEdit, McpServerConfig, Mode, OS, ProjectData, ProjectSettings, SettingsData, StartupMode, ThemeName, TodoItem } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron';

import { Agent, McpManager } from '@/agent';
import { getEffectiveEnvironmentVariable, getFilePathSuggestions, isProjectPath, isValidPath, scrapeWeb } from '@/utils';
import { ModelInfoManager } from '@/models';
import { ProjectManager } from '@/project';
import { getDefaultProjectSettings, Store } from '@/store';
import logger from '@/logger';
import { VersionsManager } from '@/versions';
import { TelemetryManager } from '@/telemetry';
import { DataManager } from '@/data-manager';
import { AIDER_DESK_TMP_DIR, LOGS_DIR } from '@/constants';
import { TerminalManager } from '@/terminal/terminal-manager';

export const setupIpcHandlers = (
  mainWindow: BrowserWindow,
  projectManager: ProjectManager,
  store: Store,
  mcpManager: McpManager,
  agent: Agent,
  versionsManager: VersionsManager,
  modelInfoManager: ModelInfoManager,
  telemetryManager: TelemetryManager,
  dataManager: DataManager,
  terminalManager: TerminalManager,
) => {
  ipcMain.handle('load-settings', () => {
    return store.getSettings();
  });

  ipcMain.handle('save-settings', (_, newSettings: SettingsData) => {
    const oldSettings = store.getSettings();
    store.saveSettings(newSettings);

    mcpManager.settingsChanged(oldSettings, newSettings);
    agent.settingsChanged(oldSettings, newSettings);
    projectManager.settingsChanged(oldSettings, newSettings);
    telemetryManager.settingsChanged(oldSettings, newSettings);

    return store.getSettings();
  });

  ipcMain.handle('save-theme', (_, theme: ThemeName) => {
    const oldSettings = store.getSettings();
    store.saveSettings({ ...oldSettings, theme });

    return store.getSettings().theme;
  });

  ipcMain.on('run-prompt', async (_, baseDir: string, prompt: string, mode?: Mode) => {
    void projectManager.getProject(baseDir).runPrompt(prompt, mode);
  });

  ipcMain.on('answer-question', (_, baseDir: string, answer: string) => {
    projectManager.getProject(baseDir).answerQuestion(answer);
  });

  ipcMain.on('drop-file', (_, baseDir: string, filePath: string) => {
    void projectManager.getProject(baseDir).dropFile(filePath);
  });

  ipcMain.on('add-file', (_, baseDir: string, filePath: string, readOnly = false) => {
    void projectManager.getProject(baseDir).addFile({ path: filePath, readOnly });
  });

  ipcMain.on('start-project', (_, baseDir: string) => {
    projectManager.startProject(baseDir);
  });

  ipcMain.on('stop-project', async (_, baseDir: string) => {
    await projectManager.closeProject(baseDir);
    terminalManager.closeTerminalForProject(baseDir);
    store.addRecentProject(baseDir);
  });

  ipcMain.on('restart-project', async (_, baseDir: string, startupMode?: StartupMode) => {
    await projectManager.restartProject(baseDir, startupMode);
  });

  ipcMain.handle('show-open-dialog', async (_, options: Electron.OpenDialogSyncOptions) => {
    return await dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('load-input-history', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).loadInputHistory();
  });

  ipcMain.handle('get-open-projects', async () => {
    return store.getOpenProjects();
  });

  ipcMain.handle('add-open-project', async (_, baseDir: string) => {
    const projects = store.getOpenProjects();
    const existingProject = projects.find((p) => normalizeBaseDir(p.baseDir) === normalizeBaseDir(baseDir));

    if (!existingProject) {
      const newProject: ProjectData = {
        baseDir: baseDir.endsWith('/') ? baseDir.slice(0, -1) : baseDir,
        settings: getDefaultProjectSettings(store, baseDir),
        active: true,
      };
      const updatedProjects = [...projects.map((p) => ({ ...p, active: false })), newProject];
      store.setOpenProjects(updatedProjects);

      telemetryManager.captureProjectOpened(store.getOpenProjects().length);
    }
    return store.getOpenProjects();
  });

  ipcMain.handle('remove-open-project', async (_, baseDir: string) => {
    const projects = store.getOpenProjects();
    const updatedProjects = projects.filter((project) => normalizeBaseDir(project.baseDir) !== normalizeBaseDir(baseDir));

    if (updatedProjects.length > 0) {
      // Set the last project as active if the current active project was removed
      if (!updatedProjects.some((p) => p.active)) {
        updatedProjects[updatedProjects.length - 1].active = true;
      }
    }

    store.setOpenProjects(updatedProjects);

    telemetryManager.captureProjectClosed(store.getOpenProjects().length);

    return updatedProjects;
  });

  ipcMain.handle('set-active-project', async (_, baseDir: string) => {
    const projects = store.getOpenProjects();
    const updatedProjects = projects.map((project) => ({
      ...project,
      active: normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir),
    }));

    store.setOpenProjects(updatedProjects);

    void mcpManager.initMcpConnectors(store.getSettings().mcpServers, baseDir);

    return updatedProjects;
  });

  ipcMain.handle('update-open-projects-order', async (_, baseDirs: string[]) => {
    logger.info('IPC Handler: update-open-projects-order', { baseDirs });
    return store.updateOpenProjectsOrder(baseDirs);
  });

  ipcMain.handle('get-recent-projects', async () => {
    return store.getRecentProjects();
  });

  ipcMain.handle('add-recent-project', async (_, baseDir: string) => {
    store.addRecentProject(baseDir);
  });

  ipcMain.handle('remove-recent-project', async (_, baseDir: string) => {
    store.removeRecentProject(baseDir);
  });

  ipcMain.handle('get-project-settings', (_, baseDir: string) => {
    return store.getProjectSettings(baseDir);
  });

  ipcMain.handle('patch-project-settings', async (_, baseDir: string, settings: Partial<ProjectSettings>) => {
    const projectSettings = store.getProjectSettings(baseDir);
    return store.saveProjectSettings(baseDir, {
      ...projectSettings,
      ...settings,
    });
  });

  ipcMain.handle('get-addable-files', async (_, baseDir: string) => {
    return projectManager.getProject(baseDir).getAddableFiles();
  });

  ipcMain.handle('is-project-path', async (_, path: string) => {
    return isProjectPath(path);
  });

  ipcMain.handle('is-valid-path', async (_, baseDir: string, path: string) => {
    return isValidPath(baseDir, path);
  });

  ipcMain.handle('get-file-path-suggestions', async (_, currentPath: string, directoriesOnly = true) => {
    return getFilePathSuggestions(currentPath, directoriesOnly);
  });

  ipcMain.on('update-main-model', (_, baseDir: string, mainModel: string) => {
    const projectSettings = store.getProjectSettings(baseDir);
    const clearWeakModel = projectSettings.weakModel === projectSettings.mainModel;

    projectSettings.mainModel = mainModel;
    if (clearWeakModel) {
      projectSettings.weakModel = null;
    }

    store.saveProjectSettings(baseDir, projectSettings);
    projectManager.getProject(baseDir).updateModels(mainModel, projectSettings?.weakModel || null, projectSettings.modelEditFormats[mainModel]);
  });

  ipcMain.on('update-weak-model', (_, baseDir: string, weakModel: string) => {
    const projectSettings = store.getProjectSettings(baseDir);
    projectSettings.weakModel = weakModel;
    store.saveProjectSettings(baseDir, projectSettings);

    const project = projectManager.getProject(baseDir);
    project.updateModels(projectSettings.mainModel, weakModel, projectSettings.modelEditFormats[projectSettings.mainModel]);
  });

  ipcMain.on('update-architect-model', (_, baseDir: string, architectModel: string) => {
    const projectSettings = store.getProjectSettings(baseDir);
    projectSettings.architectModel = architectModel;
    store.saveProjectSettings(baseDir, projectSettings);

    const project = projectManager.getProject(baseDir);
    project.setArchitectModel(architectModel);
  });

  ipcMain.on('update-edit-formats', (_, baseDir: string, updatedFormats: Record<string, EditFormat>) => {
    const projectSettings = store.getProjectSettings(baseDir);
    // Update just the current model's edit format while preserving others
    projectSettings.modelEditFormats = {
      ...projectSettings.modelEditFormats,
      ...updatedFormats,
    };
    store.saveProjectSettings(baseDir, projectSettings);
    projectManager
      .getProject(baseDir)
      .updateModels(projectSettings.mainModel, projectSettings?.weakModel || null, projectSettings.modelEditFormats[projectSettings.mainModel]);
  });

  ipcMain.on('run-command', (_, baseDir: string, command: string) => {
    const project = projectManager.getProject(baseDir);
    project.runCommand(command);
  });

  ipcMain.on('paste-image', async (_, baseDir: string) => {
    const project = projectManager.getProject(baseDir);
    try {
      const image = clipboard.readImage();
      if (image.isEmpty()) {
        project.addLogMessage('info', 'No image found in clipboard.');
        return;
      }

      const imagesDir = path.join(AIDER_DESK_TMP_DIR, 'images');
      const absoluteImagesDir = path.join(baseDir, imagesDir);
      await fs.mkdir(absoluteImagesDir, { recursive: true });

      const files = await fs.readdir(absoluteImagesDir);
      const imageFiles = files.filter((file) => file.startsWith('image-') && file.endsWith('.png'));
      let maxNumber = 0;
      for (const file of imageFiles) {
        const match = file.match(/^image-(\d+)\.png$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      }
      const nextImageNumber = maxNumber + 1;
      const imageName = `image-${nextImageNumber.toString().padStart(3, '0')}`;
      const imageBuffer = image.toPNG();
      const imagePath = path.join(imagesDir, `${imageName}.png`);
      const absoluteImagePath = path.join(baseDir, imagePath);

      await fs.writeFile(absoluteImagePath, imageBuffer);

      await project.addFile({ path: imagePath, readOnly: true });
    } catch (error) {
      logger.error('Error pasting image:', error);
      project.addLogMessage('error', `Failed to paste image: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ipcMain.on('interrupt-response', (_, baseDir: string) => {
    projectManager.getProject(baseDir).interruptResponse();
  });

  ipcMain.on('apply-edits', (_, baseDir: string, edits: FileEdit[]) => {
    projectManager.getProject(baseDir).applyEdits(edits);
  });

  ipcMain.on('clear-context', (_, baseDir: string) => {
    projectManager.getProject(baseDir).clearContext(true);
  });

  ipcMain.on('remove-last-message', (_, baseDir: string) => {
    void projectManager.getProject(baseDir).removeLastMessage();
  });

  ipcMain.on('redo-last-user-prompt', (_, baseDir: string, mode: Mode, updatedPrompt?: string) => {
    void projectManager.getProject(baseDir).redoLastUserPrompt(mode, updatedPrompt);
  });

  ipcMain.handle('compact-conversation', async (_event, baseDir, mode: Mode, customInstructions?: string) => {
    const project = projectManager.getProject(baseDir);
    if (project) {
      await project.compactConversation(mode, customInstructions);
    }
  });

  ipcMain.handle('scrape-web', async (_, baseDir: string, url: string, filePath?: string) => {
    const content = await scrapeWeb(url);
    const project = projectManager.getProject(baseDir);

    try {
      // Normalize URL for filename
      let normalizedUrl = url.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_.-]/g, '_');
      // Truncate if too long
      if (normalizedUrl.length > 100) {
        normalizedUrl = normalizedUrl.substring(0, 100);
      }

      let targetFilePath: string;
      if (!filePath) {
        targetFilePath = path.join(baseDir, AIDER_DESK_TMP_DIR, 'web-sites', `${normalizedUrl}.md`);
        await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
      } else {
        if (path.isAbsolute(filePath)) {
          targetFilePath = filePath;
        } else {
          targetFilePath = path.join(baseDir, filePath);
        }
        try {
          // Check if path looks like a directory (ends with separator)
          const isLikelyDirectory = !path.extname(targetFilePath);

          if (isLikelyDirectory) {
            await fs.mkdir(targetFilePath, { recursive: true });
            targetFilePath = path.join(targetFilePath, `${normalizedUrl}.md`);
          } else {
            await fs.mkdir(path.dirname(targetFilePath), { recursive: true });
          }
        } catch (error) {
          logger.error(`Error processing provided file path ${filePath}:`, error);
          project.addLogMessage('error', `Failed to process provided file path ${filePath}:\n${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      }

      await fs.writeFile(targetFilePath, `Scraped content of ${url}:\n\n${content}`);
      await project.addFile({ path: path.relative(baseDir, targetFilePath), readOnly: true });
      if (filePath) {
        await project.addToInputHistory(`/web ${url} ${filePath}`);
      } else {
        await project.addToInputHistory(`/web ${url}`);
      }
      project.addLogMessage('info', `Web content from ${url} saved to '${path.relative(baseDir, targetFilePath)}' and added to context.`);
    } catch (error) {
      logger.error(`Error processing scraped web content for ${url}:`, error);
      project.addLogMessage('error', `Failed to save scraped content from ${url}:\n${error instanceof Error ? error.message : String(error)}`);
    }
  });

  ipcMain.handle('save-session', async (_, baseDir: string, name: string) => {
    await projectManager.getProject(baseDir).saveSession(name);
    return true;
  });

  ipcMain.handle('load-session-messages', async (_, baseDir: string, name: string) => {
    return await projectManager.getProject(baseDir).loadSessionMessages(name);
  });

  ipcMain.handle('load-session-files', async (_, baseDir: string, name: string) => {
    return await projectManager.getProject(baseDir).loadSessionFiles(name);
  });

  ipcMain.handle('delete-session', async (_, baseDir: string, name: string) => {
    await projectManager.getProject(baseDir).deleteSession(name);
    return true;
  });

  ipcMain.handle('list-sessions', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).listSessions();
  });

  ipcMain.handle('load-mcp-server-tools', async (_, serverName: string, config?: McpServerConfig) => {
    return await mcpManager.getMcpServerTools(serverName, config);
  });

  ipcMain.handle('reload-mcp-servers', async (_, mcpServers: Record<string, McpServerConfig>, force = false) => {
    // Get the currently active project's base directory
    const activeProject = store.getOpenProjects().find((p) => p.active);
    const projectDir = activeProject ? activeProject.baseDir : null;
    await mcpManager.initMcpConnectors(mcpServers, projectDir, force);
  });

  ipcMain.handle('export-session-to-markdown', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).exportSessionToMarkdown();
  });

  ipcMain.handle('set-zoom-level', (_, zoomLevel: number) => {
    logger.info(`Setting zoom level to ${zoomLevel}`);
    mainWindow.webContents.setZoomFactor(zoomLevel);
    const currentSettings = store.getSettings();
    store.saveSettings({ ...currentSettings, zoomLevel });
  });

  ipcMain.handle('get-versions', async (_, forceRefresh = false) => {
    return await versionsManager.getVersions(forceRefresh);
  });

  ipcMain.handle('download-latest-aiderdesk', async () => {
    await versionsManager.downloadLatestAiderDesk();
  });

  ipcMain.handle('get-release-notes', () => {
    return store.getReleaseNotes();
  });

  ipcMain.handle('clear-release-notes', () => {
    store.clearReleaseNotes();
  });

  ipcMain.handle('get-os', () => {
    const platform = process.platform;
    if (platform === 'win32') {
      return OS.Windows;
    } else if (platform === 'darwin') {
      return OS.MacOS;
    } else {
      return OS.Linux;
    }
  });

  ipcMain.handle('load-models-info', async () => {
    try {
      return await modelInfoManager.getAllModelsInfo();
    } catch (error) {
      logger.error('Error loading models info:', error);
      return {}; // Return empty object or handle error as appropriate
    }
  });

  ipcMain.handle('init-project-rules-file', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).initProjectAgentsFile();
  });

  ipcMain.handle('get-todos', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).getTodos();
  });

  ipcMain.handle('add-todo', async (_, baseDir: string, name: string) => {
    return await projectManager.getProject(baseDir).addTodo(name);
  });

  ipcMain.handle('update-todo', async (_, baseDir: string, name: string, updates: Partial<TodoItem>) => {
    return await projectManager.getProject(baseDir).updateTodo(name, updates);
  });

  ipcMain.handle('delete-todo', async (_, baseDir: string, name: string) => {
    return await projectManager.getProject(baseDir).deleteTodo(name);
  });

  ipcMain.handle('clear-all-todos', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).clearAllTodos();
  });

  ipcMain.handle('query-usage-data', async (_, from: string, to: string) => {
    return dataManager.queryUsageData(new Date(from), new Date(to));
  });

  ipcMain.handle('get-effective-environment-variable', (_, key: string, baseDir?: string) => {
    return getEffectiveEnvironmentVariable(key, baseDir, store.getSettings());
  });

  ipcMain.handle('open-logs-directory', async () => {
    try {
      await shell.openPath(LOGS_DIR);
      return true;
    } catch (error) {
      logger.error('Failed to open logs directory:', error);
      return false;
    }
  });

  ipcMain.handle('get-custom-commands', async (_, baseDir: string) => {
    return projectManager.getCustomCommands(baseDir);
  });

  ipcMain.handle('run-custom-command', async (_, baseDir: string, commandName: string, args: string[], mode: Mode) => {
    await projectManager.getProject(baseDir).runCustomCommand(commandName, args, mode);
  });

  // Terminal handlers
  ipcMain.handle('terminal-create', async (_, baseDir: string, cols?: number, rows?: number) => {
    try {
      return terminalManager.createTerminal(baseDir, cols, rows);
    } catch (error) {
      logger.error('Failed to create terminal:', { baseDir, error });
      throw error;
    }
  });

  ipcMain.handle('terminal-write', async (_, terminalId: string, data: string) => {
    return terminalManager.writeToTerminal(terminalId, data);
  });

  ipcMain.handle('terminal-resize', async (_, terminalId: string, cols: number, rows: number) => {
    return terminalManager.resizeTerminal(terminalId, cols, rows);
  });

  ipcMain.handle('terminal-close', async (_, terminalId: string) => {
    return terminalManager.closeTerminal(terminalId);
  });

  ipcMain.handle('terminal-get-for-project', async (_, baseDir: string) => {
    const terminal = terminalManager.getTerminalForProject(baseDir);
    return terminal ? terminal.id : null;
  });

  ipcMain.handle('terminal-get-all-for-project', async (_, baseDir: string) => {
    const terminals = terminalManager.getTerminalsForProject(baseDir);
    return terminals.map((terminal) => ({
      id: terminal.id,
      baseDir: terminal.baseDir,
      cols: terminal.cols,
      rows: terminal.rows,
    }));
  });
};

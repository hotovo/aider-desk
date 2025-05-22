import { EditFormat, FileEdit, McpServerConfig, MessageRole, Mode, OS, ProjectData, ProjectSettings, SettingsData } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { McpManager } from 'src/main/agent/mcp-manager';
import axios from 'axios';

import { Agent } from './agent';
import { getFilePathSuggestions, isProjectPath, isValidPath } from './file-system';
import { ProjectManager } from './project-manager';
import { Store, getDefaultProjectSettings } from './store';
import { scrapeWeb } from './web-scrapper';
import logger from './logger';
import { VersionsManager } from './versions-manager';

export const setupIpcHandlers = (
  mainWindow: BrowserWindow,
  projectManager: ProjectManager,
  store: Store,
  mcpManager: McpManager,
  agent: Agent,
  versionsManager: VersionsManager,
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

    return store.getSettings();
  });

  ipcMain.on('run-prompt', (_, baseDir: string, prompt: string, mode?: Mode) => {
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
    store.addRecentProject(baseDir);
  });

  ipcMain.on('restart-project', async (_, baseDir: string) => {
    await projectManager.restartProject(baseDir);
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
        settings: getDefaultProjectSettings(store),
        active: true,
      };
      const updatedProjects = [...projects.map((p) => ({ ...p, active: false })), newProject];
      store.setOpenProjects(updatedProjects);
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
    return updatedProjects;
  });

  ipcMain.handle('set-active-project', async (_, baseDir: string) => {
    const projects = store.getOpenProjects();
    const updatedProjects = projects.map((project) => ({
      ...project,
      active: normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir),
    }));

    store.setOpenProjects(updatedProjects);

    void mcpManager.initMcpConnectors(store.getSettings().agentConfig.mcpServers, baseDir);

    return updatedProjects;
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
    projectSettings.editFormat = null;

    store.saveProjectSettings(baseDir, projectSettings);
    projectManager.getProject(baseDir).updateModels(mainModel, projectSettings?.weakModel || null);
  });

  ipcMain.on('update-weak-model', (_, baseDir: string, weakModel: string) => {
    const projectSettings = store.getProjectSettings(baseDir);
    projectSettings.weakModel = weakModel;
    store.saveProjectSettings(baseDir, projectSettings);

    const project = projectManager.getProject(baseDir);
    project.updateModels(projectSettings.mainModel, weakModel);
  });

  ipcMain.on('update-architect-model', (_, baseDir: string, architectModel: string) => {
    const projectSettings = store.getProjectSettings(baseDir);
    projectSettings.architectModel = architectModel;
    store.saveProjectSettings(baseDir, projectSettings);

    const project = projectManager.getProject(baseDir);
    project.setArchitectModel(architectModel);
  });

  ipcMain.on('update-edit-format', (_, baseDir: string, format: EditFormat) => {
    const projectSettings = store.getProjectSettings(baseDir);
    projectSettings.editFormat = format;
    store.saveProjectSettings(baseDir, projectSettings);
    projectManager.getProject(baseDir).updateModels(projectSettings.mainModel, projectSettings?.weakModel || null, format);
  });

  ipcMain.on('run-command', (_, baseDir: string, command: string) => {
    projectManager.getProject(baseDir).runCommand(command);
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

  ipcMain.handle('scrape-web', async (_, baseDir: string, url: string) => {
    const content = await scrapeWeb(url);
    projectManager.getProject(baseDir).addContextMessage(MessageRole.User, `I have scraped the following content from ${url}:\n\n${content}`, true);
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

  ipcMain.handle('get-ollama-models', async (_, baseUrl: string) => {
    try {
      let normalized = baseUrl.replace(/\/+$/, ''); // Remove all trailing slashes
      if (!normalized.endsWith('/api')) {
        normalized = `${normalized}/api`;
      }
      const response = await axios.get(`${normalized}/tags`);
      return response.data?.models?.map((m: { name: string }) => m.name) || [];
    } catch (error) {
      logger.error('Failed to fetch Ollama models', { error });
      return [];
    }
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
};

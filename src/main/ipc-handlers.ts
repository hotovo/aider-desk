import { Mode, FileEdit, McpServerConfig, MessageRole, ProjectData, ProjectSettings, SettingsData } from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { BrowserWindow, dialog, ipcMain } from 'electron';

import { Agent } from './agent';
import { getFilePathSuggestions, isProjectPath, isValidPath } from './file-system';
import { ProjectManager } from './project-manager';
import { DEFAULT_PROJECT_SETTINGS, Store } from './store';
import { scrapeWeb } from './web-scrapper';

export const setupIpcHandlers = (mainWindow: BrowserWindow, projectManager: ProjectManager, store: Store, agent: Agent) => {
  ipcMain.handle('load-settings', () => {
    return store.getSettings();
  });

  ipcMain.handle('save-settings', (_, settings: SettingsData) => {
    const currentSettings = store.getSettings();
    store.saveSettings(settings);

    const mcpServersChanged = JSON.stringify(currentSettings.agentConfig?.mcpServers) !== JSON.stringify(settings.agentConfig?.mcpServers);
    if (mcpServersChanged) {
      void agent.initMcpServers();
    }

    return store.getSettings();
  });

  ipcMain.on('run-prompt', (_, baseDir: string, prompt: string, mode?: Mode) => {
    void projectManager.getProject(baseDir).runPrompt(prompt, mode);
  });

  ipcMain.on('answer-question', (_, baseDir: string, answer: string) => {
    projectManager.getProject(baseDir).answerQuestion(answer);
  });

  ipcMain.on('drop-file', (_, baseDir: string, filePath: string) => {
    projectManager.getProject(baseDir).dropFile(filePath);
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
        settings: DEFAULT_PROJECT_SETTINGS,
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

    void agent.initMcpServers(projectManager.getProject(baseDir));

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

  ipcMain.handle('save-project-settings', async (_, baseDir: string, settings: ProjectSettings) => {
    store.saveProjectSettings(baseDir, settings);
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
    projectManager.getProject(baseDir).clearContext();
  });

  ipcMain.handle('scrape-web', async (_, baseDir: string, url: string) => {
    const content = await scrapeWeb(url);
    projectManager.getProject(baseDir).sendAddMessage(MessageRole.User, content);
  });

  ipcMain.handle('save-session', async (_, baseDir: string, name: string, loadMessages = true, loadFiles = true) => {
    await projectManager.getProject(baseDir).saveSession(name, loadMessages, loadFiles);
    return true;
  });

  ipcMain.handle('load-session', async (_, baseDir: string, name: string) => {
    await projectManager.getProject(baseDir).loadSession(name);
    return true;
  });

  ipcMain.handle('update-session', async (_, baseDir: string, name: string, loadMessages = true, loadFiles = true) => {
    // Just update the session settings without changing content
    const project = projectManager.getProject(baseDir);
    await project.saveSession(name, loadMessages, loadFiles);
    return true;
  });

  ipcMain.handle('delete-session', async (_, baseDir: string, name: string) => {
    await projectManager.getProject(baseDir).deleteSession(name);
    return true;
  });

  ipcMain.handle('list-sessions', async (_, baseDir: string) => {
    return await projectManager.getProject(baseDir).listSessions();
  });

  ipcMain.handle('load-mcp-server-tools', async (_, serverName: string, config?: McpServerConfig) => {
    if (config) {
      return await agent.reloadMcpServer(serverName, config);
    } else {
      return await agent.getMcpServerTools(serverName);
    }
  });
};

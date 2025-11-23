import path from 'path';
import fs from 'fs/promises';

import {
  CloudflareTunnelStatus,
  CustomCommand,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  McpServerConfig,
  McpTool,
  Mode,
  Model,
  OS,
  ProjectData,
  ProjectSettings,
  ProviderModelsData,
  ProviderProfile,
  ResponseCompletedData,
  SettingsData,
  TaskData,
  TaskStateData,
  TodoItem,
  UsageDataRow,
  VersionsInfo,
  VoiceSession,
} from '@common/types';
import { normalizeBaseDir } from '@common/utils';

import type { BrowserWindow } from 'electron';

import { McpManager } from '@/agent';
import { ModelManager } from '@/models';
import { ProjectManager } from '@/project';
import { CloudflareTunnelManager } from '@/server';
import { getDefaultProjectSettings, Store } from '@/store';
import { TelemetryManager } from '@/telemetry';
import { VersionsManager } from '@/versions';
import { DataManager } from '@/data-manager';
import { TerminalManager } from '@/terminal/terminal-manager';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable, getFilePathSuggestions, isProjectPath, isValidPath, scrapeWeb } from '@/utils';
import { AIDER_DESK_TMP_DIR, LOGS_DIR } from '@/constants';
import { EventManager } from '@/events';

export class EventsHandler {
  constructor(
    private mainWindow: BrowserWindow | null,
    private projectManager: ProjectManager,
    private store: Store,
    private mcpManager: McpManager,
    private versionsManager: VersionsManager,
    private modelManager: ModelManager,
    private telemetryManager: TelemetryManager,
    private dataManager: DataManager,
    private terminalManager: TerminalManager,
    private cloudflareTunnelManager: CloudflareTunnelManager,
    private eventManager: EventManager,
  ) {}

  loadSettings(): SettingsData {
    return this.store.getSettings();
  }

  async saveSettings(newSettings: SettingsData): Promise<SettingsData> {
    const oldSettings = this.store.getSettings();
    this.store.saveSettings(newSettings);

    this.mcpManager.settingsChanged(oldSettings, newSettings);
    this.projectManager.settingsChanged(oldSettings, newSettings);
    this.telemetryManager.settingsChanged(oldSettings, newSettings);

    return this.store.getSettings();
  }

  getProjectSettings(baseDir: string): ProjectSettings {
    return this.store.getProjectSettings(baseDir);
  }

  patchProjectSettings(baseDir: string, settings: Partial<ProjectSettings>): ProjectSettings {
    const projectSettings = this.store.getProjectSettings(baseDir);
    return this.store.saveProjectSettings(baseDir, {
      ...projectSettings,
      ...settings,
    });
  }

  async startProject(baseDir: string) {
    await this.projectManager.startProject(baseDir);
  }

  async stopProject(baseDir: string): Promise<void> {
    await this.projectManager.closeProject(baseDir);
    this.terminalManager.closeTerminalForProject(baseDir);
    this.store.addRecentProject(baseDir);
  }

  async restartProject(baseDir: string): Promise<void> {
    await this.projectManager.restartProject(baseDir);
  }

  async createVoiceSession(providerProfile: ProviderProfile): Promise<VoiceSession> {
    return await this.modelManager.createVoiceSession(providerProfile);
  }

  async restartTask(baseDir: string, taskId: string): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (task) {
      await task.restart();
    }
  }

  getOpenProjects(): ProjectData[] {
    return this.store.getOpenProjects();
  }

  async addOpenProject(baseDir: string): Promise<ProjectData[]> {
    const projects = this.store.getOpenProjects();
    const existingProject = projects.find((p) => normalizeBaseDir(p.baseDir) === normalizeBaseDir(baseDir));

    if (!existingProject) {
      logger.info('EventsHandler: addOpenProject', { baseDir });
      const providerModels = await this.modelManager.getProviderModels();
      const newProject: ProjectData = {
        baseDir: baseDir.endsWith('/') ? baseDir.slice(0, -1) : baseDir,
        settings: getDefaultProjectSettings(this.store, providerModels.models || [], baseDir),
        active: true,
      };
      const updatedProjects = [...projects.map((p) => ({ ...p, active: false })), newProject];
      this.store.setOpenProjects(updatedProjects);

      this.telemetryManager.captureProjectOpened(this.store.getOpenProjects().length);
    }
    return this.store.getOpenProjects();
  }

  removeOpenProject(baseDir: string): ProjectData[] {
    const projects = this.store.getOpenProjects();
    const updatedProjects = projects.filter((project) => normalizeBaseDir(project.baseDir) !== normalizeBaseDir(baseDir));

    if (updatedProjects.length > 0) {
      // Set the last project as active if the current active project was removed
      if (!updatedProjects.some((p) => p.active)) {
        updatedProjects[updatedProjects.length - 1].active = true;
      }
    }

    this.store.setOpenProjects(updatedProjects);

    this.telemetryManager.captureProjectClosed(this.store.getOpenProjects().length);

    return updatedProjects;
  }

  async setActiveProject(baseDir: string): Promise<ProjectData[]> {
    const projects = this.store.getOpenProjects();
    const updatedProjects = projects.map((project) => ({
      ...project,
      active: normalizeBaseDir(project.baseDir) === normalizeBaseDir(baseDir),
    }));

    this.store.setOpenProjects(updatedProjects);

    void this.mcpManager.initMcpConnectors(this.store.getSettings().mcpServers, baseDir);

    return updatedProjects;
  }

  updateOpenProjectsOrder(baseDirs: string[]): ProjectData[] {
    logger.info('EventsHandler: updateOpenProjectsOrder', { baseDirs });
    return this.store.updateOpenProjectsOrder(baseDirs);
  }

  getRecentProjects(): string[] {
    return this.store.getRecentProjects();
  }

  addRecentProject(baseDir: string): void {
    this.store.addRecentProject(baseDir);
  }

  removeRecentProject(baseDir: string): void {
    this.store.removeRecentProject(baseDir);
  }

  interruptResponse(baseDir: string, taskId: string): void {
    this.projectManager.getProject(baseDir).getTask(taskId)?.interruptResponse();
  }

  clearContext(baseDir: string, taskId: string, includeLastMessage = true): void {
    this.projectManager.getProject(baseDir).getTask(taskId)?.clearContext(includeLastMessage);
  }

  async removeLastMessage(baseDir: string, taskId: string): Promise<void> {
    void this.projectManager.getProject(baseDir).getTask(taskId)?.removeLastMessage();
  }

  async redoLastUserPrompt(baseDir: string, taskId: string, mode: Mode, updatedPrompt?: string): Promise<void> {
    void this.projectManager.getProject(baseDir).getTask(taskId)?.redoLastUserPrompt(mode, updatedPrompt);
  }

  async compactConversation(baseDir: string, taskId: string, mode: Mode, customInstructions?: string): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (task) {
      await task.compactConversation(mode, customInstructions);
    }
  }

  async loadInputHistory(baseDir: string): Promise<string[]> {
    return await this.projectManager.getProject(baseDir).loadInputHistory();
  }

  async getAddableFiles(baseDir: string, taskId: string, searchRegex?: string): Promise<string[]> {
    return this.projectManager.getProject(baseDir).getTask(taskId)?.getAddableFiles(searchRegex) || [];
  }

  async addFile(baseDir: string, taskId: string, filePath: string, readOnly = false): Promise<void> {
    void this.projectManager.getProject(baseDir).getTask(taskId)?.addFile({ path: filePath, readOnly });
  }

  dropFile(baseDir: string, taskId: string, filePath: string): void {
    void this.projectManager.getProject(baseDir).getTask(taskId)?.dropFile(filePath);
  }

  async pasteImage(baseDir: string, taskId: string): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (!task) {
      return;
    }

    try {
      const { clipboard } = await import('electron');
      const image = clipboard.readImage();
      if (image.isEmpty()) {
        task.addLogMessage('info', 'No image found in clipboard.');
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

      await task.addFile({ path: imagePath, readOnly: true });
    } catch (error) {
      logger.error('Error pasting image:', error);
      task.addLogMessage('error', `Failed to paste image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  applyEdits(baseDir: string, taskId: string, edits: FileEdit[]): void {
    this.projectManager.getProject(baseDir).getTask(taskId)?.applyEdits(edits);
  }

  async runPrompt(baseDir: string, taskId: string, prompt: string, mode?: Mode): Promise<ResponseCompletedData[]> {
    return this.projectManager.getProject(baseDir).getTask(taskId)?.runPrompt(prompt, mode) || [];
  }

  async savePrompt(baseDir: string, taskId: string, prompt: string): Promise<void> {
    return this.projectManager.getProject(baseDir).getTask(taskId)?.savePromptOnly(prompt);
  }

  answerQuestion(baseDir: string, taskId: string, answer: string): void {
    this.projectManager.getProject(baseDir).getTask(taskId)?.answerQuestion(answer);
  }

  runCommand(baseDir: string, taskId: string, command: string): void {
    void this.projectManager.getProject(baseDir).getTask(taskId)?.runCommand(command);
  }

  async getCustomCommands(baseDir: string): Promise<CustomCommand[]> {
    return this.projectManager.getCustomCommands(baseDir);
  }

  async runCustomCommand(baseDir: string, taskId: string, commandName: string, args: string[], mode: Mode): Promise<void> {
    const project = this.projectManager.getProject(baseDir);
    const task = project.getTask(taskId);
    await task?.runCustomCommand(commandName, args, mode);
  }

  updateMainModel(baseDir: string, mainModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);

    projectSettings.mainModel = mainModel;

    // Only clear weak model if not locked
    if (!projectSettings.weakModelLocked) {
      projectSettings.weakModel = null;
    }

    const updatedSettings = this.store.saveProjectSettings(baseDir, projectSettings);
    this.eventManager.sendProjectSettingsUpdated(baseDir, updatedSettings);
    this.projectManager
      .getProject(baseDir)
      .forEachTask((task) => task.updateModels(mainModel, projectSettings.weakModel || null, projectSettings.modelEditFormats[mainModel]));
  }

  updateWeakModel(baseDir: string, weakModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    projectSettings.weakModel = weakModel;
    const updatedSettings = this.store.saveProjectSettings(baseDir, projectSettings);
    this.eventManager.sendProjectSettingsUpdated(baseDir, updatedSettings);

    this.projectManager
      .getProject(baseDir)
      .forEachTask((task) => task.updateModels(projectSettings.mainModel, weakModel, projectSettings.modelEditFormats[projectSettings.mainModel]));
  }

  updateArchitectModel(baseDir: string, architectModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    projectSettings.architectModel = architectModel;
    const updatedSettings = this.store.saveProjectSettings(baseDir, projectSettings);
    this.eventManager.sendProjectSettingsUpdated(baseDir, updatedSettings);

    this.projectManager.getProject(baseDir).forEachTask((task) => task.setArchitectModel(architectModel));
  }

  updateEditFormats(baseDir: string, updatedFormats: Record<string, EditFormat>): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    // Update just the current model's edit format while preserving others
    projectSettings.modelEditFormats = {
      ...projectSettings.modelEditFormats,
      ...updatedFormats,
    };
    const updatedSettings = this.store.saveProjectSettings(baseDir, projectSettings);
    this.eventManager.sendProjectSettingsUpdated(baseDir, updatedSettings);
    this.projectManager
      .getProject(baseDir)
      .forEachTask((task) =>
        task.updateModels(projectSettings.mainModel, projectSettings?.weakModel || null, projectSettings.modelEditFormats[projectSettings.mainModel]),
      );
  }

  async loadMcpServerTools(serverName: string, config?: McpServerConfig): Promise<McpTool[] | null> {
    return await this.mcpManager.getMcpServerTools(serverName, config);
  }

  async reloadMcpServers(mcpServers: Record<string, McpServerConfig>, force = false): Promise<void> {
    // Get the currently active project's base directory
    const activeProject = this.store.getOpenProjects().find((p) => p.active);
    const projectDir = activeProject ? activeProject.baseDir : null;
    await this.mcpManager.initMcpConnectors(mcpServers, projectDir, force);
  }

  async createTerminal(baseDir: string, taskId: string, cols?: number, rows?: number): Promise<string> {
    try {
      return this.terminalManager.createTerminal(baseDir, taskId, cols, rows);
    } catch (error) {
      logger.error('Failed to create terminal:', { baseDir, error });
      throw error;
    }
  }

  writeToTerminal(terminalId: string, data: string): void {
    this.terminalManager.writeToTerminal(terminalId, data);
  }

  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    this.terminalManager.resizeTerminal(terminalId, cols, rows);
  }

  closeTerminal(terminalId: string): void {
    this.terminalManager.closeTerminal(terminalId);
  }

  getTerminalForTask(taskId: string): string | null {
    const terminal = this.terminalManager.getTerminalForTask(taskId);
    return terminal ? terminal.id : null;
  }

  getTerminalsForTask(baseDir: string): {
    id: string;
    taskId: string;
    baseDir: string;
    cols: number;
    rows: number;
  }[] {
    const terminals = this.terminalManager.getTerminalsForTask(baseDir);
    return terminals.map((terminal) => ({
      id: terminal.id,
      baseDir: terminal.baseDir,
      taskId: terminal.taskId,
      cols: terminal.cols,
      rows: terminal.rows,
    }));
  }

  async mergeWorktreeToMain(baseDir: string, taskId: string, squash: boolean): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await task.mergeWorktreeToMain(squash);
  }

  async applyUncommittedChanges(baseDir: string, taskId: string): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await task.applyUncommittedChanges();
  }

  async revertLastMerge(baseDir: string, taskId: string): Promise<void> {
    const task = this.projectManager.getProject(baseDir).getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    await task.revertLastMerge();
  }

  async scrapeWeb(baseDir: string, taskId: string, url: string, filePath?: string): Promise<void> {
    const content = await scrapeWeb(url);
    const project = this.projectManager.getProject(baseDir);
    const task = project.getTask(taskId);

    if (!task) {
      return;
    }

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
          task.addLogMessage('error', `Failed to process provided file path ${filePath}:\n${error instanceof Error ? error.message : String(error)}`);
          return;
        }
      }

      await fs.writeFile(targetFilePath, `Scraped content of ${url}:\n\n${content}`);
      await task.addFile({
        path: path.relative(baseDir, targetFilePath),
        readOnly: true,
      });
      if (filePath) {
        await project.addToInputHistory(`/web ${url} ${filePath}`);
      } else {
        await project.addToInputHistory(`/web ${url}`);
      }
      task.addLogMessage('info', `Web content from ${url} saved to '${path.relative(baseDir, targetFilePath)}' and added to context.`);
    } catch (error) {
      logger.error(`Error processing scraped web content for ${url}:`, error);
      task.addLogMessage('error', `Failed to save scraped content from ${url}:\n${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async createNewTask(baseDir: string): Promise<TaskData> {
    return await this.projectManager.getProject(baseDir).createNewTask();
  }

  async updateTask(baseDir: string, id: string, updates: Partial<TaskData>): Promise<TaskData | undefined> {
    const task = this.projectManager.getProject(baseDir).getTask(id);
    if (!task) {
      return undefined;
    }

    // Delegate to Task.updateTask method which handles worktree logic
    return task.updateTask(updates);
  }

  async deleteTask(baseDir: string, id: string): Promise<void> {
    await this.projectManager.getProject(baseDir).deleteTask(id);
  }

  async duplicateTask(baseDir: string, taskId: string): Promise<TaskData> {
    return await this.projectManager.getProject(baseDir).duplicateTask(taskId);
  }

  async getTasks(baseDir: string): Promise<TaskData[]> {
    return this.projectManager.getProject(baseDir).getTasks();
  }

  async loadTask(baseDir: string, taskId: string): Promise<TaskStateData> {
    return (
      this.projectManager.getProject(baseDir).getTask(taskId)?.load() || {
        messages: [],
        files: [],
        todoItems: [],
        question: null,
        workingMode: 'local',
      }
    );
  }

  async exportTaskToMarkdown(baseDir: string, taskId: string): Promise<void> {
    const markdownContent = await this.projectManager.getProject(baseDir).getTask(taskId)?.generateContextMarkdown();

    if (markdownContent) {
      try {
        const defaultPath = `${baseDir}/session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.md`;
        let filePath = defaultPath;

        if (this.mainWindow) {
          const { dialog } = await import('electron');
          const dialogResult = await dialog.showSaveDialog(this.mainWindow, {
            title: 'Export Session to Markdown',
            defaultPath: defaultPath,
            filters: [{ name: 'Markdown Files', extensions: ['md'] }],
          });
          if (dialogResult.canceled) {
            return;
          }

          filePath = dialogResult.filePath || defaultPath;
        }

        if (filePath) {
          try {
            await fs.writeFile(filePath, markdownContent, 'utf8');
            logger.info(`Session exported successfully to ${filePath}`);
          } catch (writeError) {
            logger.error('Failed to write session Markdown file:', {
              filePath,
              error: writeError,
            });
          }
        } else {
          logger.info('Markdown export cancelled by user.');
        }
      } catch (dialogError) {
        logger.error('Error exporting session to Markdown', { dialogError });
      }
    }
  }

  setZoomLevel(zoomLevel: number): void {
    logger.info(`Setting zoom level to ${zoomLevel}`);
    this.mainWindow?.webContents.setZoomFactor(zoomLevel);
    const currentSettings = this.store.getSettings();
    this.store.saveSettings({ ...currentSettings, zoomLevel });
  }

  async getVersions(forceRefresh = false): Promise<VersionsInfo> {
    return await this.versionsManager.getVersions(forceRefresh);
  }

  async downloadLatestAiderDesk(): Promise<void> {
    await this.versionsManager.downloadLatestAiderDesk();
  }

  getReleaseNotes(): string | null {
    return this.store.getReleaseNotes();
  }

  clearReleaseNotes(): void {
    this.store.clearReleaseNotes();
  }

  getOS(): OS {
    const platform = process.platform;
    if (platform === 'win32') {
      return OS.Windows;
    } else if (platform === 'darwin') {
      return OS.MacOS;
    } else {
      return OS.Linux;
    }
  }

  async queryUsageData(from: Date, to: Date): Promise<UsageDataRow[]> {
    return this.dataManager.queryUsageData(from, to);
  }

  getEffectiveEnvironmentVariable(key: string, baseDir?: string): EnvironmentVariable | undefined {
    return getEffectiveEnvironmentVariable(key, this.store.getSettings(), baseDir);
  }

  async getProviderModels(reload = false): Promise<ProviderModelsData> {
    const providerModels = await this.modelManager.getProviderModels(reload);
    if (reload) {
      this.projectManager.modelsUpdated();
    }
    return providerModels;
  }

  getProviders(): ProviderProfile[] {
    return this.store.getProviders();
  }

  async updateProviders(providers: ProviderProfile[]): Promise<void> {
    const oldProviders = this.store.getProviders();

    this.store.setProviders(providers);

    await this.modelManager.providersChanged(oldProviders, providers);

    this.projectManager.modelsUpdated();
    this.eventManager.sendProvidersUpdated(providers);
  }

  async upsertModel(providerId: string, modelId: string, model: Model): Promise<void> {
    await this.modelManager.upsertModel(providerId, modelId, model);
    this.projectManager.modelsUpdated();
  }

  async deleteModel(providerId: string, modelId: string): Promise<void> {
    await this.modelManager.deleteModel(providerId, modelId);
  }

  async showOpenDialog(options: Electron.OpenDialogSyncOptions): Promise<Electron.OpenDialogReturnValue> {
    if (!this.mainWindow) {
      return {
        canceled: true,
        filePaths: [],
      };
    }
    const { dialog } = await import('electron');
    return await dialog.showOpenDialog(this.mainWindow, options);
  }

  async openLogsDirectory(): Promise<boolean> {
    try {
      const { shell } = await import('electron');
      await shell.openPath(LOGS_DIR);
      return true;
    } catch (error) {
      logger.error('Failed to open logs directory:', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async isProjectPath(path: string): Promise<boolean> {
    return await isProjectPath(path);
  }

  async isValidPath(baseDir: string, path: string): Promise<boolean> {
    return await isValidPath(baseDir, path);
  }

  async getFilePathSuggestions(currentPath: string, directoriesOnly = true): Promise<string[]> {
    return getFilePathSuggestions(currentPath, directoriesOnly);
  }

  async getTodos(baseDir: string, taskId: string): Promise<TodoItem[]> {
    return (await this.projectManager.getProject(baseDir).getTask(taskId)?.getTodos()) || [];
  }

  async addTodo(baseDir: string, taskId: string, name: string): Promise<TodoItem[]> {
    return (await this.projectManager.getProject(baseDir).getTask(taskId)?.addTodo(name)) || [];
  }

  async updateTodo(baseDir: string, taskId: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return (await this.projectManager.getProject(baseDir).getTask(taskId)?.updateTodo(name, updates)) || [];
  }

  async deleteTodo(baseDir: string, taskId: string, name: string): Promise<TodoItem[]> {
    return (await this.projectManager.getProject(baseDir).getTask(taskId)?.deleteTodo(name)) || [];
  }

  async clearAllTodos(baseDir: string, taskId: string): Promise<TodoItem[]> {
    return (await this.projectManager.getProject(baseDir).getTask(taskId)?.clearAllTodos()) || [];
  }

  async initProjectRulesFile(baseDir: string, taskId: string): Promise<void> {
    return this.projectManager.getProject(baseDir).getTask(taskId)?.initProjectAgentsFile();
  }

  enableServer(username?: string, password?: string): SettingsData {
    const currentSettings = this.store.getSettings();
    const updatedSettings: SettingsData = {
      ...currentSettings,
      server: {
        ...currentSettings.server,
        enabled: true,
        basicAuth: {
          ...currentSettings.server.basicAuth,
          enabled: Boolean(username && password),
          username: username ?? currentSettings.server.basicAuth.username,
          password: password ?? currentSettings.server.basicAuth.password,
        },
      },
    };
    this.store.saveSettings(updatedSettings);
    return updatedSettings;
  }

  disableServer(): SettingsData {
    const currentSettings = this.store.getSettings();
    const updatedSettings: SettingsData = {
      ...currentSettings,
      server: {
        ...currentSettings.server,
        enabled: false,
      },
    };
    this.store.saveSettings(updatedSettings);
    return updatedSettings;
  }

  async startCloudflareTunnel(): Promise<CloudflareTunnelStatus | null> {
    try {
      await this.cloudflareTunnelManager.start();
      const status = this.cloudflareTunnelManager.getStatus();
      logger.info('Cloudflare tunnel started', {
        status,
      });
      return status;
    } catch (error) {
      logger.error('Failed to start tunnel:', error);
      return null;
    }
  }

  stopCloudflareTunnel(): void {
    this.cloudflareTunnelManager.stop();
    logger.info('Cloudflare tunnel stopped');
  }

  getCloudflareTunnelStatus(): CloudflareTunnelStatus {
    return this.cloudflareTunnelManager.getStatus();
  }
}

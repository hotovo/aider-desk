import path from 'path';
import fs from 'fs/promises';

import { BrowserWindow, clipboard, dialog, shell } from 'electron';
import {
  CustomCommand,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  Font,
  McpServerConfig,
  McpTool,
  Mode,
  ModelInfo,
  OS,
  ProjectData,
  ProjectSettings,
  ResponseCompletedData,
  SessionData,
  SettingsData,
  StartupMode,
  Theme,
  TodoItem,
  UsageDataRow,
  VersionsInfo,
  CloudflareTunnelStatus,
} from '@common/types';
import { normalizeBaseDir } from '@common/utils';

import { Agent, McpManager } from '@/agent';
import { ModelInfoManager } from '@/models';
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

export class EventsHandler {
  constructor(
    private mainWindow: BrowserWindow | null,
    private projectManager: ProjectManager,
    private store: Store,
    private mcpManager: McpManager,
    private agent: Agent,
    private versionsManager: VersionsManager,
    private modelInfoManager: ModelInfoManager,
    private telemetryManager: TelemetryManager,
    private dataManager: DataManager,
    private terminalManager: TerminalManager,
    private cloudflareTunnelManager: CloudflareTunnelManager,
  ) {}

  loadSettings(): SettingsData {
    return this.store.getSettings();
  }

  saveSettings(newSettings: SettingsData): SettingsData {
    const oldSettings = this.store.getSettings();
    this.store.saveSettings(newSettings);

    this.mcpManager.settingsChanged(oldSettings, newSettings);
    this.agent.settingsChanged(oldSettings, newSettings);
    this.projectManager.settingsChanged(oldSettings, newSettings);
    this.telemetryManager.settingsChanged(oldSettings, newSettings);

    return this.store.getSettings();
  }

  saveTheme(theme: Theme): Theme | undefined {
    const oldSettings = this.store.getSettings();
    this.store.saveSettings({ ...oldSettings, theme });
    return this.store.getSettings().theme;
  }

  saveFont(font: Font): Font | undefined {
    const oldSettings = this.store.getSettings();
    this.store.saveSettings({ ...oldSettings, font });
    return this.store.getSettings().font;
  }

  saveFontSize(fontSize: number): number | undefined {
    const oldSettings = this.store.getSettings();
    this.store.saveSettings({ ...oldSettings, fontSize });
    return this.store.getSettings().fontSize;
  }

  async loadModelsInfo(): Promise<Record<string, ModelInfo>> {
    try {
      return await this.modelInfoManager.getAllModelsInfo();
    } catch (error) {
      logger.error('Error loading models info:', error);
      return {}; // Return empty object or handle error as appropriate
    }
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

  startProject(baseDir: string): void {
    this.projectManager.startProject(baseDir);
  }

  async stopProject(baseDir: string): Promise<void> {
    await this.projectManager.closeProject(baseDir);
    this.terminalManager.closeTerminalForProject(baseDir);
    this.store.addRecentProject(baseDir);
  }

  async restartProject(baseDir: string, startupMode?: StartupMode): Promise<void> {
    await this.projectManager.restartProject(baseDir, startupMode);
  }

  getOpenProjects(): ProjectData[] {
    return this.store.getOpenProjects();
  }

  addOpenProject(baseDir: string): ProjectData[] {
    const projects = this.store.getOpenProjects();
    const existingProject = projects.find((p) => normalizeBaseDir(p.baseDir) === normalizeBaseDir(baseDir));

    if (!existingProject) {
      const newProject: ProjectData = {
        baseDir: baseDir.endsWith('/') ? baseDir.slice(0, -1) : baseDir,
        settings: getDefaultProjectSettings(this.store, baseDir),
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

  interruptResponse(baseDir: string): void {
    this.projectManager.getProject(baseDir).interruptResponse();
  }

  clearContext(baseDir: string, includeLastMessage = true): void {
    this.projectManager.getProject(baseDir).clearContext(includeLastMessage);
  }

  async removeLastMessage(baseDir: string): Promise<void> {
    void this.projectManager.getProject(baseDir).removeLastMessage();
  }

  async redoLastUserPrompt(baseDir: string, mode: Mode, updatedPrompt?: string): Promise<void> {
    void this.projectManager.getProject(baseDir).redoLastUserPrompt(mode, updatedPrompt);
  }

  async compactConversation(baseDir: string, mode: Mode, customInstructions?: string): Promise<void> {
    const project = this.projectManager.getProject(baseDir);
    if (project) {
      await project.compactConversation(mode, customInstructions);
    }
  }

  async loadInputHistory(baseDir: string): Promise<string[]> {
    return await this.projectManager.getProject(baseDir).loadInputHistory();
  }

  async getAddableFiles(baseDir: string, searchRegex?: string): Promise<string[]> {
    return this.projectManager.getProject(baseDir).getAddableFiles(searchRegex);
  }

  async addFile(baseDir: string, filePath: string, readOnly = false): Promise<void> {
    void this.projectManager.getProject(baseDir).addFile({ path: filePath, readOnly });
  }

  dropFile(baseDir: string, filePath: string): void {
    void this.projectManager.getProject(baseDir).dropFile(filePath);
  }

  async pasteImage(baseDir: string): Promise<void> {
    const project = this.projectManager.getProject(baseDir);
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
  }

  applyEdits(baseDir: string, edits: FileEdit[]): void {
    this.projectManager.getProject(baseDir).applyEdits(edits);
  }

  async runPrompt(baseDir: string, prompt: string, mode?: Mode): Promise<ResponseCompletedData[]> {
    return this.projectManager.getProject(baseDir).runPrompt(prompt, mode);
  }

  answerQuestion(baseDir: string, answer: string): void {
    this.projectManager.getProject(baseDir).answerQuestion(answer);
  }

  runCommand(baseDir: string, command: string): void {
    const project = this.projectManager.getProject(baseDir);
    project.runCommand(command);
  }

  async getCustomCommands(baseDir: string): Promise<CustomCommand[]> {
    return this.projectManager.getCustomCommands(baseDir);
  }

  async runCustomCommand(baseDir: string, commandName: string, args: string[], mode: Mode): Promise<void> {
    await this.projectManager.getProject(baseDir).runCustomCommand(commandName, args, mode);
  }

  updateMainModel(baseDir: string, mainModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    const clearWeakModel = projectSettings.weakModel === projectSettings.mainModel;

    projectSettings.mainModel = mainModel;
    if (clearWeakModel) {
      projectSettings.weakModel = null;
    }

    this.store.saveProjectSettings(baseDir, projectSettings);
    this.projectManager.getProject(baseDir).updateModels(mainModel, projectSettings?.weakModel || null, projectSettings.modelEditFormats[mainModel]);
  }

  updateWeakModel(baseDir: string, weakModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    projectSettings.weakModel = weakModel;
    this.store.saveProjectSettings(baseDir, projectSettings);

    const project = this.projectManager.getProject(baseDir);
    project.updateModels(projectSettings.mainModel, weakModel, projectSettings.modelEditFormats[projectSettings.mainModel]);
  }

  updateArchitectModel(baseDir: string, architectModel: string): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    projectSettings.architectModel = architectModel;
    this.store.saveProjectSettings(baseDir, projectSettings);

    const project = this.projectManager.getProject(baseDir);
    project.setArchitectModel(architectModel);
  }

  updateEditFormats(baseDir: string, updatedFormats: Record<string, EditFormat>): void {
    const projectSettings = this.store.getProjectSettings(baseDir);
    // Update just the current model's edit format while preserving others
    projectSettings.modelEditFormats = {
      ...projectSettings.modelEditFormats,
      ...updatedFormats,
    };
    this.store.saveProjectSettings(baseDir, projectSettings);
    this.projectManager
      .getProject(baseDir)
      .updateModels(projectSettings.mainModel, projectSettings?.weakModel || null, projectSettings.modelEditFormats[projectSettings.mainModel]);
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

  async createTerminal(baseDir: string, cols?: number, rows?: number): Promise<string> {
    try {
      return this.terminalManager.createTerminal(baseDir, cols, rows);
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

  getTerminalForProject(baseDir: string): string | null {
    const terminal = this.terminalManager.getTerminalForProject(baseDir);
    return terminal ? terminal.id : null;
  }

  getTerminalsForProject(baseDir: string): {
    id: string;
    baseDir: string;
    cols: number;
    rows: number;
  }[] {
    const terminals = this.terminalManager.getTerminalsForProject(baseDir);
    return terminals.map((terminal) => ({
      id: terminal.id,
      baseDir: terminal.baseDir,
      cols: terminal.cols,
      rows: terminal.rows,
    }));
  }

  async scrapeWeb(baseDir: string, url: string, filePath?: string): Promise<void> {
    const content = await scrapeWeb(url);
    const project = this.projectManager.getProject(baseDir);

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
  }

  async saveSession(baseDir: string, name: string): Promise<boolean> {
    await this.projectManager.getProject(baseDir).saveSession(name);
    return true;
  }

  async loadSessionMessages(baseDir: string, name: string): Promise<void> {
    await this.projectManager.getProject(baseDir).loadSessionMessages(name);
  }

  async loadSessionFiles(baseDir: string, name: string): Promise<void> {
    await this.projectManager.getProject(baseDir).loadSessionFiles(name);
  }

  async deleteSession(baseDir: string, name: string): Promise<boolean> {
    await this.projectManager.getProject(baseDir).deleteSession(name);
    return true;
  }

  async listSessions(baseDir: string): Promise<SessionData[]> {
    return await this.projectManager.getProject(baseDir).listSessions();
  }

  async exportSessionToMarkdown(baseDir: string): Promise<void> {
    const markdownContent = await this.projectManager.getProject(baseDir).generateSessionMarkdown();

    if (markdownContent) {
      try {
        const defaultPath = `${baseDir}/session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.md`;
        let filePath = defaultPath;

        if (this.mainWindow) {
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
    return getEffectiveEnvironmentVariable(key, baseDir, this.store.getSettings());
  }

  async showOpenDialog(options: Electron.OpenDialogSyncOptions): Promise<Electron.OpenDialogReturnValue> {
    if (!this.mainWindow) {
      return {
        canceled: true,
        filePaths: [],
      };
    }
    return await dialog.showOpenDialog(this.mainWindow, options);
  }

  async openLogsDirectory(): Promise<boolean> {
    try {
      await shell.openPath(LOGS_DIR);
      return true;
    } catch (error) {
      logger.error('Failed to open logs directory:', error);
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

  async getTodos(baseDir: string): Promise<TodoItem[]> {
    return await this.projectManager.getProject(baseDir).getTodos();
  }

  async addTodo(baseDir: string, name: string): Promise<TodoItem[]> {
    return await this.projectManager.getProject(baseDir).addTodo(name);
  }

  async updateTodo(baseDir: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return await this.projectManager.getProject(baseDir).updateTodo(name, updates);
  }

  async deleteTodo(baseDir: string, name: string): Promise<TodoItem[]> {
    return await this.projectManager.getProject(baseDir).deleteTodo(name);
  }

  async clearAllTodos(baseDir: string): Promise<TodoItem[]> {
    return await this.projectManager.getProject(baseDir).clearAllTodos();
  }

  async initProjectRulesFile(baseDir: string): Promise<void> {
    return await this.projectManager.getProject(baseDir).initProjectAgentsFile();
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

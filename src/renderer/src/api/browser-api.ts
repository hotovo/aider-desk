import {
  AutocompletionData,
  ClearProjectData,
  CommandOutputData,
  ContextFilesUpdatedData,
  CustomCommand,
  CustomCommandsUpdatedData,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  Font,
  InputHistoryData,
  LogData,
  McpServerConfig,
  McpTool,
  Mode,
  ModelInfo,
  ModelsData,
  OS,
  ProjectData,
  ProjectSettings,
  ProjectStartedData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SessionData,
  SettingsData,
  StartupMode,
  TerminalData,
  TerminalExitData,
  Theme,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageDataRow,
  UserMessageData,
  VersionsInfo,
  CloudflareTunnelStatus,
} from '@common/types';
import { ApplicationAPI } from '@common/api';
import axios, { type AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { compareBaseDirs } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

type EventDataMap = {
  'response-chunk': ResponseChunkData;
  'response-completed': ResponseCompletedData;
  log: LogData;
  'context-files-updated': ContextFilesUpdatedData;
  'custom-commands-updated': CustomCommandsUpdatedData;
  'update-autocompletion': AutocompletionData;
  'ask-question': QuestionData;
  'update-aider-models': ModelsData;
  'command-output': CommandOutputData;
  'update-tokens-info': TokensInfoData;
  tool: ToolData;
  'user-message': UserMessageData;
  'input-history-updated': InputHistoryData;
  'clear-project': ClearProjectData;
  'project-started': ProjectStartedData;
};

type EventCallback<T> = (data: T) => void;

interface ListenerEntry<T> {
  callback: EventCallback<T>;
  baseDir?: string;
}

class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}

export class BrowserApi implements ApplicationAPI {
  private readonly socket: Socket;
  private readonly listeners: { [K in keyof EventDataMap]: Map<string, ListenerEntry<EventDataMap[K]>> };
  private readonly apiClient: AxiosInstance;
  private appOS: OS | null = null;

  constructor() {
    const port = window.location.port === '5173' ? '24337' : window.location.port;
    const baseUrl = `${window.location.protocol}//${window.location.hostname}${port ? `:${port}` : ''}`;

    this.socket = io(baseUrl, {
      autoConnect: true,
      forceNew: true,
    });
    this.listeners = {
      'response-chunk': new Map(),
      'response-completed': new Map(),
      log: new Map(),
      'context-files-updated': new Map(),
      'custom-commands-updated': new Map(),
      'update-autocompletion': new Map(),
      'ask-question': new Map(),
      'update-aider-models': new Map(),
      'command-output': new Map(),
      'update-tokens-info': new Map(),
      tool: new Map(),
      'user-message': new Map(),
      'input-history-updated': new Map(),
      'clear-project': new Map(),
      'project-started': new Map(),
    };
    this.apiClient = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          throw new Error(`HTTP error! status: ${error.response.status}`);
        }
        throw error;
      },
    );
    this.socket.on('connect', () => {
      this.socket.emit('message', {
        action: 'subscribe-events',
        eventTypes: Object.keys(this.listeners),
      });
      this.getOS().then((os) => {
        this.appOS = os;
      });
    });
    this.socket.on('disconnect', () => {
      // eslint-disable-next-line no-console
      console.log('Disconnected from Socket.IO server');
    });
    this.socket.on('connect_error', (error) => {
      // eslint-disable-next-line no-console
      console.error('Socket.IO connection error:', error);
    });
    this.socket.on('event', (eventData: { type: string; data: unknown }) => {
      const { type, data } = eventData;
      const eventType = type as keyof EventDataMap;
      const eventListeners = this.listeners[eventType];
      if (eventListeners) {
        const typedData = data as EventDataMap[typeof eventType];
        eventListeners.forEach((entry) => {
          const baseDir = (typedData as { baseDir?: string })?.baseDir;
          if (entry.baseDir && baseDir && !compareBaseDirs(entry.baseDir, baseDir, this.appOS || undefined)) {
            return;
          }
          entry.callback(typedData);
        });
      }
    });
  }

  private ensureSocketConnected(): void {
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  private addListener<T extends keyof EventDataMap>(eventType: T, baseDir: string | undefined, callback: EventCallback<EventDataMap[T]>): () => void {
    this.ensureSocketConnected();
    const eventListeners = this.listeners[eventType];
    const id = uuidv4();
    eventListeners.set(id, { callback, baseDir });

    return () => {
      eventListeners.delete(id);
    };
  }

  private async post<B, R>(endpoint: string, body: B): Promise<R> {
    const response = await this.apiClient.post<R>(endpoint, body);
    return response.data;
  }

  private async get<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.apiClient.get<T>(endpoint, { params });
    return response.data;
  }

  private async patch<B, R>(endpoint: string, body: B): Promise<R> {
    const response = await this.apiClient.patch<R>(endpoint, body);
    return response.data;
  }

  isOpenLogsDirectorySupported(): boolean {
    return false;
  }
  openLogsDirectory(): Promise<boolean> {
    throw new UnsupportedError('openLogsDirectory not supported yet.');
  }
  loadSettings(): Promise<SettingsData> {
    return this.get('/settings');
  }
  saveSettings(settings: SettingsData): Promise<SettingsData> {
    return this.post('/settings', settings);
  }
  saveTheme(theme: Theme): Promise<Theme> {
    return this.post('/settings/theme', { theme });
  }
  saveFont(font: string): Promise<Font> {
    return this.post('/settings/font', { font });
  }
  startProject(baseDir: string): void {
    this.post('/project/start', { projectDir: baseDir });
  }
  stopProject(baseDir: string): void {
    this.post('/project/stop', { projectDir: baseDir });
  }
  restartProject(baseDir: string, startupMode?: StartupMode): void {
    this.post('/project/restart', { projectDir: baseDir, startupMode });
  }
  runPrompt(baseDir: string, prompt: string, mode?: Mode): void {
    this.post('/run-prompt', { projectDir: baseDir, prompt, mode });
  }
  redoLastUserPrompt(baseDir: string, mode: Mode, updatedPrompt?: string): void {
    this.post('/project/redo-prompt', { projectDir: baseDir, mode, updatedPrompt });
  }
  answerQuestion(baseDir: string, answer: string): void {
    this.post('/project/answer-question', { projectDir: baseDir, answer });
  }
  loadInputHistory(baseDir: string): Promise<string[]> {
    return this.get('/project/input-history', { projectDir: baseDir });
  }
  isOpenDialogSupported(): boolean {
    return false;
  }
  showOpenDialog(options: Electron.OpenDialogSyncOptions): Promise<Electron.OpenDialogReturnValue> {
    void options;
    throw new UnsupportedError('showOpenDialog not supported yet.');
  }
  getPathForFile(file: File): string {
    void file;
    throw new UnsupportedError('getPathForFile not supported yet.');
  }
  getOpenProjects(): Promise<ProjectData[]> {
    return this.get('/projects');
  }
  addOpenProject(baseDir: string): Promise<ProjectData[]> {
    return this.post('/project/add-open', { projectDir: baseDir });
  }
  setActiveProject(baseDir: string): Promise<ProjectData[]> {
    return this.post('/project/set-active', { projectDir: baseDir });
  }
  removeOpenProject(baseDir: string): Promise<ProjectData[]> {
    return this.post('/project/remove-open', { projectDir: baseDir });
  }
  updateOpenProjectsOrder(baseDirs: string[]): Promise<ProjectData[]> {
    return this.post('/project/update-order', { projectDirs: baseDirs });
  }
  updateMainModel(baseDir: string, model: string): void {
    this.post('/project/settings/main-model', { projectDir: baseDir, mainModel: model });
  }
  updateWeakModel(baseDir: string, model: string): void {
    this.post('/project/settings/weak-model', { projectDir: baseDir, weakModel: model });
  }
  updateArchitectModel(baseDir: string, model: string): void {
    this.post('/project/settings/architect-model', { projectDir: baseDir, architectModel: model });
  }
  updateEditFormats(baseDir: string, editFormats: Record<string, EditFormat>): void {
    this.post('/project/settings/edit-formats', { projectDir: baseDir, editFormats });
  }
  getProjectSettings(baseDir: string): Promise<ProjectSettings> {
    return this.get('/project/settings', { projectDir: baseDir });
  }
  patchProjectSettings(baseDir: string, settings: Partial<ProjectSettings>): Promise<ProjectSettings> {
    return this.patch('/project/settings', { projectDir: baseDir, ...settings });
  }
  getFilePathSuggestions(currentPath: string, directoriesOnly?: boolean): Promise<string[]> {
    return this.post('/project/file-suggestions', { currentPath, directoriesOnly });
  }
  getAddableFiles(baseDir: string): Promise<string[]> {
    return this.post('/get-addable-files', { projectDir: baseDir });
  }
  addFile(baseDir: string, filePath: string, readOnly?: boolean): void {
    this.post('/add-context-file', { projectDir: baseDir, path: filePath, readOnly });
  }
  async isValidPath(baseDir: string, path: string): Promise<boolean> {
    return this.post<{ projectDir: string; path: string }, { isValid: boolean }>('/project/validate-path', { projectDir: baseDir, path }).then(
      (res) => res.isValid,
    );
  }
  async isProjectPath(path: string): Promise<boolean> {
    return this.post<{ path: string }, { isProject: boolean }>('/project/is-project-path', { path }).then((res) => res.isProject);
  }
  dropFile(baseDir: string, path: string): void {
    this.post('/drop-context-file', { projectDir: baseDir, path });
  }
  runCommand(baseDir: string, command: string): void {
    this.post('/project/run-command', { projectDir: baseDir, command });
  }
  pasteImage(baseDir: string): void {
    this.post('/project/paste-image', { projectDir: baseDir });
  }
  scrapeWeb(baseDir: string, url: string, filePath?: string): Promise<string> {
    return this.post('/project/scrape-web', { projectDir: baseDir, url, filePath });
  }
  initProjectRulesFile(baseDir: string): Promise<void> {
    return this.post('/project/init-rules', { projectDir: baseDir });
  }
  getTodos(baseDir: string): Promise<TodoItem[]> {
    return this.get('/project/todos', { projectDir: baseDir });
  }
  addTodo(baseDir: string, name: string): Promise<TodoItem[]> {
    return this.post('/project/todo/add', { projectDir: baseDir, name });
  }
  updateTodo(baseDir: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return this.patch('/project/todo/update', { projectDir: baseDir, name, updates });
  }
  deleteTodo(baseDir: string, name: string): Promise<TodoItem[]> {
    return this.post('/project/todo/delete', { projectDir: baseDir, name });
  }
  clearAllTodos(baseDir: string): Promise<TodoItem[]> {
    return this.post('/project/todo/clear', { projectDir: baseDir });
  }
  loadMcpServerTools(serverName: string, config?: McpServerConfig): Promise<McpTool[] | null> {
    return this.post('/mcp/tools', { serverName, config });
  }
  reloadMcpServers(mcpServers: Record<string, McpServerConfig>, force = false): Promise<void> {
    return this.post('/mcp/reload', { mcpServers, force });
  }
  saveSession(baseDir: string, name: string): Promise<boolean> {
    return this.post('/project/session/save', { projectDir: baseDir, name });
  }
  deleteSession(baseDir: string, name: string): Promise<boolean> {
    return this.post('/project/session/delete', { projectDir: baseDir, name });
  }
  loadSessionMessages(baseDir: string, name: string): Promise<void> {
    return this.post('/project/session/load-messages', { projectDir: baseDir, name });
  }
  loadSessionFiles(baseDir: string, name: string): Promise<void> {
    return this.post('/project/session/load-files', { projectDir: baseDir, name });
  }
  listSessions(baseDir: string): Promise<SessionData[]> {
    return this.get('/project/sessions', { projectDir: baseDir });
  }
  exportSessionToMarkdown(baseDir: string): Promise<void> {
    return this.post('/project/session/export-markdown', { projectDir: baseDir });
  }
  getRecentProjects(): Promise<string[]> {
    return this.get('/settings/recent-projects');
  }
  addRecentProject(baseDir: string): Promise<void> {
    return this.post('/settings/add-recent-project', { baseDir });
  }
  removeRecentProject(baseDir: string): Promise<void> {
    return this.post('/settings/remove-recent-project', { baseDir });
  }
  interruptResponse(baseDir: string): void {
    this.post('/project/interrupt', { projectDir: baseDir });
  }
  applyEdits(baseDir: string, edits: FileEdit[]): void {
    this.post('/project/apply-edits', { projectDir: baseDir, edits });
  }
  clearContext(baseDir: string): void {
    this.post('/project/clear-context', { projectDir: baseDir });
  }
  removeLastMessage(baseDir: string): void {
    this.post('/project/remove-last-message', { projectDir: baseDir });
  }
  compactConversation(baseDir: string, mode: Mode, customInstructions?: string): void {
    this.post('/project/compact-conversation', { projectDir: baseDir, mode, customInstructions });
  }
  setZoomLevel(level: number): Promise<void> {
    void level;
    // eslint-disable-next-line no-console
    console.log('Zoom is not supported in browser, use browser zoom instead.');
    return Promise.resolve();
  }
  getVersions(forceRefresh = false): Promise<VersionsInfo | null> {
    return this.get('/settings/versions', { forceRefresh });
  }
  downloadLatestAiderDesk(): Promise<void> {
    return this.post('/download-latest', {});
  }
  async getReleaseNotes(): Promise<string | null> {
    return this.get<{ releaseNotes: string | null }>('/release-notes').then((res) => res.releaseNotes);
  }
  clearReleaseNotes(): Promise<void> {
    return this.post('/clear-release-notes', {});
  }
  async getOS(): Promise<OS> {
    return this.get<{ os: OS }>('/os').then((res) => res.os);
  }
  loadModelsInfo(): Promise<Record<string, ModelInfo>> {
    return this.get('/models');
  }
  queryUsageData(from: string, to: string): Promise<UsageDataRow[]> {
    return this.get('/usage', { from, to });
  }
  getEffectiveEnvironmentVariable(key: string, baseDir?: string): Promise<EnvironmentVariable | undefined> {
    return this.get('/system/env-var', { key, baseDir });
  }
  addResponseChunkListener(baseDir: string, callback: (data: ResponseChunkData) => void): () => void {
    return this.addListener('response-chunk', baseDir, callback);
  }
  addResponseCompletedListener(baseDir: string, callback: (data: ResponseCompletedData) => void): () => void {
    return this.addListener('response-completed', baseDir, callback);
  }
  addLogListener(baseDir: string, callback: (data: LogData) => void): () => void {
    return this.addListener('log', baseDir, callback);
  }
  addContextFilesUpdatedListener(baseDir: string, callback: (data: ContextFilesUpdatedData) => void): () => void {
    return this.addListener('context-files-updated', baseDir, callback);
  }
  addCustomCommandsUpdatedListener(baseDir: string, callback: (data: CustomCommandsUpdatedData) => void): () => void {
    return this.addListener('custom-commands-updated', baseDir, callback);
  }
  addUpdateAutocompletionListener(baseDir: string, callback: (data: AutocompletionData) => void): () => void {
    return this.addListener('update-autocompletion', baseDir, callback);
  }
  addAskQuestionListener(baseDir: string, callback: (data: QuestionData) => void): () => void {
    return this.addListener('ask-question', baseDir, callback);
  }
  addUpdateAiderModelsListener(baseDir: string, callback: (data: ModelsData) => void): () => void {
    return this.addListener('update-aider-models', baseDir, callback);
  }
  addCommandOutputListener(baseDir: string, callback: (data: CommandOutputData) => void): () => void {
    return this.addListener('command-output', baseDir, callback);
  }
  addTokensInfoListener(baseDir: string, callback: (data: TokensInfoData) => void): () => void {
    return this.addListener('update-tokens-info', baseDir, callback);
  }
  addToolListener(baseDir: string, callback: (data: ToolData) => void): () => void {
    return this.addListener('tool', baseDir, callback);
  }
  addUserMessageListener(baseDir: string, callback: (data: UserMessageData) => void): () => void {
    return this.addListener('user-message', baseDir, callback);
  }
  addInputHistoryUpdatedListener(baseDir: string, callback: (data: InputHistoryData) => void): () => void {
    return this.addListener('input-history-updated', baseDir, callback);
  }
  addClearProjectListener(baseDir: string, callback: (data: ClearProjectData) => void): () => void {
    return this.addListener('clear-project', baseDir, callback);
  }
  addProjectStartedListener(baseDir: string, callback: (data: ProjectStartedData) => void): () => void {
    return this.addListener('project-started', baseDir, callback);
  }
  addVersionsInfoUpdatedListener(callback: (data: VersionsInfo) => void): () => void {
    void callback;
    return () => {};
  }
  addTerminalDataListener(baseDir: string, callback: (data: TerminalData) => void): () => void {
    void baseDir;
    void callback;
    return () => {};
  }
  addTerminalExitListener(baseDir: string, callback: (data: TerminalExitData) => void): () => void {
    void baseDir;
    void callback;
    return () => {};
  }
  addContextMenuListener(callback: (params: Electron.ContextMenuParams) => void): () => void {
    void callback;
    return () => {};
  }
  addOpenSettingsListener(callback: (tabIndex: number) => void): () => void {
    void callback;
    return () => {};
  }
  getCustomCommands(baseDir: string): Promise<CustomCommand[]> {
    return this.get('/project/custom-commands', { projectDir: baseDir });
  }
  runCustomCommand(baseDir: string, commandName: string, args: string[], mode: Mode): Promise<void> {
    return this.post('/project/custom-commands', { projectDir: baseDir, commandName, args, mode });
  }
  isTerminalSupported(): boolean {
    return false;
  }
  createTerminal(baseDir: string, cols?: number, rows?: number): Promise<string> {
    void baseDir;
    void cols;
    void rows;
    throw new UnsupportedError('createTerminal not supported yet.');
  }
  writeToTerminal(terminalId: string, data: string): Promise<boolean> {
    void terminalId;
    void data;
    throw new UnsupportedError('writeToTerminal not supported yet.');
  }
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
    void terminalId;
    void cols;
    void rows;
    throw new UnsupportedError('resizeTerminal not supported yet.');
  }
  closeTerminal(terminalId: string): Promise<boolean> {
    void terminalId;
    throw new UnsupportedError('closeTerminal not supported yet.');
  }
  getTerminalForProject(baseDir: string): Promise<string | null> {
    void baseDir;
    throw new UnsupportedError('getTerminalForProject not supported yet.');
  }
  getAllTerminalsForProject(baseDir: string): Promise<Array<{ id: string; baseDir: string; cols: number; rows: number }>> {
    void baseDir;
    throw new UnsupportedError('getAllTerminalsForProject not supported yet.');
  }
  isManageServerSupported(): boolean {
    return false;
  }

  startServer(username?: string, password?: string): Promise<boolean> {
    void username;
    void password;
    // Server control not supported in browser mode
    return Promise.resolve(false);
  }

  stopServer(): Promise<boolean> {
    // Server control not supported in browser mode
    return Promise.resolve(false);
  }

  startCloudflareTunnel(): Promise<boolean> {
    throw new UnsupportedError('Cloudflare tunnel not supported in browser mode');
  }

  stopCloudflareTunnel(): Promise<void> {
    throw new UnsupportedError('Cloudflare tunnel not supported in browser mode');
  }

  getCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus> {
    throw new UnsupportedError('Cloudflare tunnel not supported in browser mode');
  }
}

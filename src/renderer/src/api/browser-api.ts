import {
  AutocompletionData,
  ClearTaskData,
  CloudflareTunnelStatus,
  CommandOutputData,
  ContextFilesUpdatedData,
  CustomCommand,
  CustomCommandsUpdatedData,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  McpTool,
  Mode,
  Model,
  ModelInfo,
  ModelsData,
  OS,
  ProjectData,
  ProjectSettings,
  ProjectStartedData,
  ProviderModelsData,
  ProviderProfile,
  ProvidersUpdatedData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskContextData,
  TaskData,
  TerminalData,
  TerminalExitData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageDataRow,
  UserMessageData,
  VersionsInfo,
} from '@common/types';
import { ApplicationAPI } from '@common/api';
import axios, { type AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { compareBaseDirs } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

type EventDataMap = {
  'settings-updated': SettingsData;
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
  'clear-task': ClearTaskData;
  'project-started': ProjectStartedData;
  'provider-models-updated': ProviderModelsData;
  'providers-updated': ProvidersUpdatedData;
  'project-settings-updated': { baseDir: string; settings: ProjectSettings };
  'task-created': TaskData;
  'task-initialized': TaskData;
  'task-updated': TaskData;
  'task-deleted': TaskData;
  'task-started': TaskData;
  'task-completed': TaskData;
  'task-cancelled': TaskData;
};

type EventCallback<T> = (data: T) => void;

interface ListenerEntry<T> {
  callback: EventCallback<T>;
  baseDir?: string;
  taskId?: string;
}

class UnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedError';
  }
}

export class BrowserApi implements ApplicationAPI {
  private readonly socket: Socket;
  private readonly listeners: {
    [K in keyof EventDataMap]: Map<string, ListenerEntry<EventDataMap[K]>>;
  };
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
      'settings-updated': new Map(),
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
      'clear-task': new Map(),
      'project-started': new Map(),
      'provider-models-updated': new Map(),
      'providers-updated': new Map(),
      'project-settings-updated': new Map(),
      'task-created': new Map(),
      'task-initialized': new Map(),
      'task-started': new Map(),
      'task-updated': new Map(),
      'task-deleted': new Map(),
      'task-completed': new Map(),
      'task-cancelled': new Map(),
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
          const taskId = (typedData as { taskId?: string })?.taskId;

          // Filter by baseDir
          if (entry.baseDir && baseDir && !compareBaseDirs(entry.baseDir, baseDir, this.appOS || undefined)) {
            return;
          }

          // Filter by taskId for task-level events
          if (entry.taskId && taskId && entry.taskId !== taskId) {
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

  private addListener<T extends keyof EventDataMap>(eventType: T, callback: EventCallback<EventDataMap[T]>, baseDir?: string, taskId?: string): () => void {
    this.ensureSocketConnected();
    const eventListeners = this.listeners[eventType];
    const id = uuidv4();
    eventListeners.set(id, { callback, baseDir, taskId });

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

  private async delete<T>(endpoint: string): Promise<T> {
    const response = await this.apiClient.delete<T>(endpoint);
    return response.data;
  }

  private async put<B, R>(endpoint: string, body: B): Promise<R> {
    const response = await this.apiClient.put<R>(endpoint, body);
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
  startProject(baseDir: string): Promise<void> {
    return this.post('/project/start', { projectDir: baseDir });
  }
  stopProject(baseDir: string): void {
    this.post('/project/stop', { projectDir: baseDir });
  }

  restartProject(baseDir: string): void {
    this.post('/project/restart', { projectDir: baseDir });
  }
  restartTask(baseDir: string, taskId: string): void {
    this.post('/project/tasks/restart', { projectDir: baseDir, taskId });
  }
  runPrompt(baseDir: string, taskId: string, prompt: string, mode?: Mode): void {
    this.post('/run-prompt', { projectDir: baseDir, taskId, prompt, mode });
  }
  redoLastUserPrompt(baseDir: string, taskId: string, mode: Mode, updatedPrompt?: string): void {
    this.post('/project/redo-prompt', {
      projectDir: baseDir,
      taskId,
      mode,
      updatedPrompt,
    });
  }
  answerQuestion(baseDir: string, taskId: string, answer: string): void {
    this.post('/project/answer-question', {
      projectDir: baseDir,
      taskId,
      answer,
    });
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
    this.post('/project/settings/main-model', {
      projectDir: baseDir,
      mainModel: model,
    });
  }
  updateWeakModel(baseDir: string, model: string): void {
    this.post('/project/settings/weak-model', {
      projectDir: baseDir,
      weakModel: model,
    });
  }
  updateArchitectModel(baseDir: string, model: string): void {
    this.post('/project/settings/architect-model', {
      projectDir: baseDir,
      architectModel: model,
    });
  }
  updateEditFormats(baseDir: string, editFormats: Record<string, EditFormat>): void {
    this.post('/project/settings/edit-formats', {
      projectDir: baseDir,
      editFormats,
    });
  }
  getProjectSettings(baseDir: string): Promise<ProjectSettings> {
    return this.get('/project/settings', { projectDir: baseDir });
  }
  patchProjectSettings(baseDir: string, settings: Partial<ProjectSettings>): Promise<ProjectSettings> {
    return this.patch('/project/settings', {
      projectDir: baseDir,
      ...settings,
    });
  }
  getFilePathSuggestions(currentPath: string, directoriesOnly?: boolean): Promise<string[]> {
    return this.post('/project/file-suggestions', {
      currentPath,
      directoriesOnly,
    });
  }
  getAddableFiles(baseDir: string, taskId: string): Promise<string[]> {
    return this.post('/get-addable-files', { projectDir: baseDir, taskId });
  }
  addFile(baseDir: string, taskId: string, filePath: string, readOnly?: boolean): void {
    this.post('/add-context-file', {
      projectDir: baseDir,
      taskId,
      path: filePath,
      readOnly,
    });
  }
  async isValidPath(baseDir: string, path: string): Promise<boolean> {
    return this.post<{ projectDir: string; path: string }, { isValid: boolean }>('/project/validate-path', { projectDir: baseDir, path }).then(
      (res) => res.isValid,
    );
  }
  async isProjectPath(path: string): Promise<boolean> {
    return this.post<{ path: string }, { isProject: boolean }>('/project/is-project-path', { path }).then((res) => res.isProject);
  }
  dropFile(baseDir: string, taskId: string, path: string): void {
    this.post('/drop-context-file', { projectDir: baseDir, taskId, path });
  }
  runCommand(baseDir: string, taskId: string, command: string): void {
    this.post('/project/run-command', { projectDir: baseDir, taskId, command });
  }
  pasteImage(baseDir: string, taskId: string): void {
    this.post('/project/paste-image', { projectDir: baseDir, taskId });
  }
  scrapeWeb(baseDir: string, taskId: string, url: string, filePath?: string): Promise<void> {
    return this.post('/project/scrape-web', {
      projectDir: baseDir,
      taskId,
      url,
      filePath,
    });
  }
  initProjectRulesFile(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/init-rules', { projectDir: baseDir, taskId });
  }
  getTodos(baseDir: string, taskId: string): Promise<TodoItem[]> {
    return this.get('/project/todos', { projectDir: baseDir, taskId });
  }
  addTodo(baseDir: string, taskId: string, name: string): Promise<TodoItem[]> {
    return this.post('/project/todo/add', {
      projectDir: baseDir,
      taskId,
      name,
    });
  }
  updateTodo(baseDir: string, taskId: string, name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return this.patch('/project/todo/update', {
      projectDir: baseDir,
      taskId,
      name,
      updates,
    });
  }
  deleteTodo(baseDir: string, taskId: string, name: string): Promise<TodoItem[]> {
    return this.post('/project/todo/delete', {
      projectDir: baseDir,
      taskId,
      name,
    });
  }
  clearAllTodos(baseDir: string, taskId: string): Promise<TodoItem[]> {
    return this.post('/project/todo/clear', { projectDir: baseDir, taskId });
  }
  loadMcpServerTools(serverName: string, config?: McpServerConfig): Promise<McpTool[] | null> {
    return this.post('/mcp/tools', { serverName, config });
  }
  reloadMcpServers(mcpServers: Record<string, McpServerConfig>, force = false): Promise<void> {
    return this.post('/mcp/reload', { mcpServers, force });
  }
  createNewTask(baseDir: string): Promise<TaskData> {
    return this.post('/project/tasks/new', { projectDir: baseDir });
  }
  updateTask(baseDir: string, id: string, updates: Partial<TaskData>): Promise<boolean> {
    return this.post('/project/tasks', { projectDir: baseDir, id, updates });
  }
  deleteTask(baseDir: string, id: string): Promise<boolean> {
    return this.post('/project/tasks/delete', { projectDir: baseDir, id });
  }
  getTasks(baseDir: string): Promise<TaskData[]> {
    return this.get('/project/tasks', { projectDir: baseDir });
  }
  loadTask(baseDir: string, id: string): Promise<TaskContextData> {
    return this.post('/project/tasks/load', { projectDir: baseDir, id });
  }
  exportTaskToMarkdown(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/tasks/export-markdown', {
      projectDir: baseDir,
      taskId,
    });
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
  interruptResponse(baseDir: string, taskId: string): void {
    this.post('/project/interrupt', { projectDir: baseDir, taskId });
  }
  applyEdits(baseDir: string, taskId: string, edits: FileEdit[]): void {
    this.post('/project/apply-edits', { projectDir: baseDir, taskId, edits });
  }

  clearContext(baseDir: string, taskId: string): void {
    this.post('/project/clear-context', { projectDir: baseDir, taskId });
  }
  removeLastMessage(baseDir: string, taskId: string): void {
    this.post('/project/remove-last-message', { projectDir: baseDir, taskId });
  }
  compactConversation(baseDir: string, taskId: string, mode: Mode, customInstructions?: string): void {
    this.post('/project/compact-conversation', {
      projectDir: baseDir,
      taskId,
      mode,
      customInstructions,
    });
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
    return this.get('/models-info');
  }
  getProviderModels(): Promise<ProviderModelsData> {
    return this.get('/models', {});
  }
  getProviders(): Promise<ProviderProfile[]> {
    return this.get('/providers');
  }
  updateProviders(providers: ProviderProfile[]): Promise<ProviderProfile[]> {
    return this.post('/providers', providers);
  }
  upsertModel(providerId: string, modelId: string, model: Model): Promise<ProviderModelsData> {
    return this.put(`/providers/${providerId}/models/${modelId}`, model);
  }
  deleteModel(providerId: string, modelId: string): Promise<ProviderModelsData> {
    return this.delete(`/providers/${providerId}/models/${modelId}`);
  }
  queryUsageData(from: string, to: string): Promise<UsageDataRow[]> {
    return this.get('/usage', { from, to });
  }
  getEffectiveEnvironmentVariable(key: string, baseDir?: string): Promise<EnvironmentVariable | undefined> {
    return this.get('/system/env-var', { key, baseDir });
  }
  addSettingsUpdatedListener(callback: (data: SettingsData) => void): () => void {
    return this.addListener('settings-updated', callback);
  }
  addResponseChunkListener(baseDir: string, taskId: string, callback: (data: ResponseChunkData) => void): () => void {
    return this.addListener('response-chunk', callback, baseDir, taskId);
  }
  addResponseCompletedListener(baseDir: string, taskId: string, callback: (data: ResponseCompletedData) => void): () => void {
    return this.addListener('response-completed', callback, baseDir, taskId);
  }
  addLogListener(baseDir: string, taskId: string, callback: (data: LogData) => void): () => void {
    return this.addListener('log', callback, baseDir, taskId);
  }
  addContextFilesUpdatedListener(baseDir: string, taskId: string, callback: (data: ContextFilesUpdatedData) => void): () => void {
    return this.addListener('context-files-updated', callback, baseDir, taskId);
  }
  addCustomCommandsUpdatedListener(baseDir: string, callback: (data: CustomCommandsUpdatedData) => void): () => void {
    return this.addListener('custom-commands-updated', callback, baseDir);
  }
  addUpdateAutocompletionListener(baseDir: string, taskId: string, callback: (data: AutocompletionData) => void): () => void {
    return this.addListener('update-autocompletion', callback, baseDir, taskId);
  }
  addAskQuestionListener(baseDir: string, taskId: string, callback: (data: QuestionData) => void): () => void {
    return this.addListener('ask-question', callback, baseDir, taskId);
  }
  addUpdateAiderModelsListener(baseDir: string, taskId: string, callback: (data: ModelsData) => void): () => void {
    return this.addListener('update-aider-models', callback, baseDir, taskId);
  }
  addCommandOutputListener(baseDir: string, taskId: string, callback: (data: CommandOutputData) => void): () => void {
    return this.addListener('command-output', callback, baseDir, taskId);
  }
  addTokensInfoListener(baseDir: string, taskId: string, callback: (data: TokensInfoData) => void): () => void {
    return this.addListener('update-tokens-info', callback, baseDir, taskId);
  }
  addToolListener(baseDir: string, taskId: string, callback: (data: ToolData) => void): () => void {
    return this.addListener('tool', callback, baseDir, taskId);
  }
  addUserMessageListener(baseDir: string, taskId: string, callback: (data: UserMessageData) => void): () => void {
    return this.addListener('user-message', callback, baseDir, taskId);
  }
  addInputHistoryUpdatedListener(baseDir: string, callback: (data: InputHistoryData) => void): () => void {
    return this.addListener('input-history-updated', callback, baseDir);
  }
  addClearTaskListener(baseDir: string, taskId: string, callback: (data: ClearTaskData) => void): () => void {
    return this.addListener('clear-task', callback, baseDir, taskId);
  }
  addProjectStartedListener(baseDir: string, callback: (data: ProjectStartedData) => void): () => void {
    return this.addListener('project-started', callback, baseDir);
  }
  addVersionsInfoUpdatedListener(callback: (data: VersionsInfo) => void): () => void {
    void callback;
    return () => {};
  }

  addProviderModelsUpdatedListener(callback: (data: ProviderModelsData) => void): () => void {
    return this.addListener('provider-models-updated', callback);
  }

  addProvidersUpdatedListener(callback: (data: ProvidersUpdatedData) => void): () => void {
    return this.addListener('providers-updated', callback);
  }

  addProjectSettingsUpdatedListener(baseDir: string, callback: (data: { baseDir: string; settings: ProjectSettings }) => void): () => void {
    return this.addListener('project-settings-updated', callback, baseDir);
  }

  // Task lifecycle event listeners
  addTaskCreatedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-created', callback, baseDir);
  }

  addTaskInitializedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-initialized', callback, baseDir);
  }

  addTaskUpdatedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-updated', callback, baseDir);
  }

  addTaskStartedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-started', callback, baseDir);
  }

  addTaskCompletedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-completed', callback, baseDir);
  }

  addTaskCancelledListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-cancelled', callback, baseDir);
  }

  addTaskDeletedListener(baseDir: string, callback: (data: TaskData) => void): () => void {
    return this.addListener('task-deleted', callback, baseDir);
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
  runCustomCommand(baseDir: string, taskId: string, commandName: string, args: string[], mode: Mode): Promise<void> {
    return this.post('/project/custom-commands', {
      projectDir: baseDir,
      taskId,
      commandName,
      args,
      mode,
    });
  }
  isTerminalSupported(): boolean {
    return false;
  }
  createTerminal(baseDir: string, taskId: string, cols?: number, rows?: number): Promise<string> {
    void baseDir;
    void taskId;
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
  getTerminalForTask(baseDir: string): Promise<string | null> {
    void baseDir;
    throw new UnsupportedError('getTerminalForTask not supported yet.');
  }
  getAllTerminalsForTask(taskId: string): Promise<Array<{ id: string; taskId: string; cols: number; rows: number }>> {
    void taskId;
    throw new UnsupportedError('getAllTerminalsForTask not supported yet.');
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

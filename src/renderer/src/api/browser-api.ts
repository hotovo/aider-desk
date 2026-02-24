import {
  AgentProfilesUpdatedData,
  AutocompletionData,
  ClearTaskData,
  CloudflareTunnelStatus,
  CommandOutputData,
  ContextFilesUpdatedData,
  CommandsData,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  McpTool,
  MessageRemovedData,
  Mode,
  Model,
  ModelsData,
  NotificationData,
  OS,
  ProjectData,
  ProjectSettings,
  ProjectStartedData,
  ProviderModelsData,
  ProviderProfile,
  ProvidersUpdatedData,
  QuestionAnsweredData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskData,
  CreateTaskParams,
  TaskStateData,
  TerminalData,
  TerminalExitData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageDataRow,
  UserMessageData,
  VersionsInfo,
  VoiceSession,
  AgentProfile,
  MemoryEntry,
  MemoryEmbeddingProgress,
  WorktreeIntegrationStatus,
  WorktreeIntegrationStatusUpdatedData,
  TaskCreatedData,
  UpdatedFilesUpdatedData,
  QueuedPromptsUpdatedData,
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
} from '@common/types';
import { ApplicationAPI } from '@common/api';
import axios, { type AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import { compareBaseDirs } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

import type { BmadStatus } from '@common/types';

type EventDataMap = {
  'settings-updated': SettingsData;
  'response-chunk': ResponseChunkData;
  'response-completed': ResponseCompletedData;
  log: LogData;
  'context-files-updated': ContextFilesUpdatedData;
  'commands-updated': CommandsData;
  'update-autocompletion': AutocompletionData;
  'ask-question': QuestionData;
  'question-answered': QuestionAnsweredData;
  'queued-prompts-updated': QueuedPromptsUpdatedData;
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
  'worktree-integration-status-updated': WorktreeIntegrationStatusUpdatedData;
  'agent-profiles-updated': AgentProfilesUpdatedData;
  'updated-files-updated': UpdatedFilesUpdatedData;
  notification: NotificationData;
  'task-created': TaskCreatedData;
  'task-initialized': TaskData;
  'task-updated': TaskData;
  'task-deleted': TaskData;
  'task-started': TaskData;
  'task-completed': TaskData;
  'task-cancelled': TaskData;
  'message-removed': MessageRemovedData;
  'terminal-data': TerminalData;
  'terminal-exit': TerminalExitData;
  'bmad-status-changed': BmadStatus;
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
      'commands-updated': new Map(),
      'update-autocompletion': new Map(),
      'ask-question': new Map(),
      'question-answered': new Map(),
      'update-aider-models': new Map(),
      'command-output': new Map(),
      'update-tokens-info': new Map(),
      tool: new Map(),
      'user-message': new Map(),
      'input-history-updated': new Map(),
      'clear-task': new Map(),
      'project-started': new Map(),
      'worktree-integration-status-updated': new Map(),
      'provider-models-updated': new Map(),
      'providers-updated': new Map(),
      'updated-files-updated': new Map(),
      'project-settings-updated': new Map(),
      'task-created': new Map(),
      'task-initialized': new Map(),
      'task-started': new Map(),
      'task-updated': new Map(),
      'task-deleted': new Map(),
      'task-completed': new Map(),
      'task-cancelled': new Map(),
      'agent-profiles-updated': new Map(),
      notification: new Map(),
      'message-removed': new Map(),
      'terminal-data': new Map(),
      'terminal-exit': new Map(),
      'bmad-status-changed': new Map(),
      'queued-prompts-updated': new Map(),
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

  private async delete<T>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.apiClient.delete<T>(endpoint, { params });
    return response.data;
  }

  private async deleteWithBody<B, T>(endpoint: string, body: B): Promise<T> {
    const response = await this.apiClient.delete<T>(endpoint, { data: body });
    return response.data;
  }

  private async put<B, R>(endpoint: string, body: B, params?: Record<string, unknown>): Promise<R> {
    const response = await this.apiClient.put<R>(endpoint, body, { params });
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
  resetTask(baseDir: string, taskId: string): void {
    this.post('/project/tasks/reset', { projectDir: baseDir, taskId });
  }
  runPrompt(baseDir: string, taskId: string, prompt: string, mode?: Mode): void {
    this.post('/run-prompt', { projectDir: baseDir, taskId, prompt, mode });
  }
  savePrompt(baseDir: string, taskId: string, prompt: string): Promise<void> {
    return this.post('/save-prompt', { projectDir: baseDir, taskId, prompt });
  }
  redoLastUserPrompt(baseDir: string, taskId: string, mode: Mode, updatedPrompt?: string): void {
    this.post('/project/redo-prompt', {
      projectDir: baseDir,
      taskId,
      mode,
      updatedPrompt,
    });
  }
  resumeTask(baseDir: string, taskId: string): void {
    this.post('/project/resume-task', {
      projectDir: baseDir,
      taskId,
    });
  }
  answerQuestion(baseDir: string, taskId: string, answer: string): void {
    this.post('/project/answer-question', {
      projectDir: baseDir,
      taskId,
      answer,
    });
  }
  removeQueuedPrompt(baseDir: string, taskId: string, promptId: string): void {
    this.post('/project/remove-queued-prompt', {
      projectDir: baseDir,
      taskId,
      promptId,
    });
  }
  sendQueuedPromptNow(baseDir: string, taskId: string, promptId: string): void {
    this.post('/project/send-queued-prompt-now', {
      projectDir: baseDir,
      taskId,
      promptId,
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
  updateMainModel(baseDir: string, taskId: string, model: string): void {
    this.post('/project/settings/main-model', {
      projectDir: baseDir,
      taskId: taskId,
      mainModel: model,
    });
  }
  updateWeakModel(baseDir: string, taskId: string, model: string): void {
    this.post('/project/settings/weak-model', {
      projectDir: baseDir,
      taskId: taskId,
      weakModel: model,
    });
  }
  updateArchitectModel(baseDir: string, taskId: string, model: string): void {
    this.post('/project/settings/architect-model', {
      projectDir: baseDir,
      taskId: taskId,
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
  getAllFiles(baseDir: string, taskId: string, useGit?: boolean): Promise<string[]> {
    return this.post('/get-all-files', { projectDir: baseDir, taskId, useGit });
  }
  getUpdatedFiles(baseDir: string, taskId: string): Promise<{ path: string; additions: number; deletions: number }[]> {
    return this.post('/get-updated-files', { projectDir: baseDir, taskId });
  }
  async generateCommitMessage(baseDir: string, taskId: string): Promise<string> {
    const res = await this.post<{ projectDir: string; taskId: string }, { message: string }>('/project/worktree/generate-commit-message', {
      projectDir: baseDir,
      taskId,
    });
    return res.message;
  }
  async commitChanges(baseDir: string, taskId: string, message: string, amend: boolean): Promise<void> {
    await this.post('/project/worktree/commit-changes', {
      projectDir: baseDir,
      taskId,
      message,
      amend,
    });
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
    const res = await this.post<{ projectDir: string; path: string }, { isValid: boolean }>('/project/validate-path', { projectDir: baseDir, path });
    return res.isValid;
  }
  async isProjectPath(path: string): Promise<boolean> {
    const res = await this.post<{ path: string }, { isProject: boolean }>('/project/is-project-path', { path });
    return res.isProject;
  }
  dropFile(baseDir: string, taskId: string, path: string): void {
    this.post('/drop-context-file', { projectDir: baseDir, taskId, path });
  }
  runCommand(baseDir: string, taskId: string, command: string): void {
    this.post('/project/run-command', { projectDir: baseDir, taskId, command });
  }
  async pasteImage(baseDir: string, taskId: string, imageBuffer?: ArrayBuffer): Promise<void> {
    if (imageBuffer) {
      const blob = new Blob([imageBuffer], { type: 'image/png' });
      const reader = new FileReader();
      const base64String = await new Promise<string>((resolve) => {
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(blob);
      });
      await this.post('/project/paste-image', { projectDir: baseDir, taskId, base64ImageData: base64String });
    } else {
      await this.post('/project/paste-image', { projectDir: baseDir, taskId });
    }
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
  reloadMcpServer(serverName: string, config: McpServerConfig): Promise<McpTool[]> {
    return this.post('/mcp/reload-single', { serverName, config });
  }
  createNewTask(baseDir: string, params?: CreateTaskParams): Promise<TaskData> {
    return this.post('/project/tasks/new', { projectDir: baseDir, ...params });
  }
  updateTask(baseDir: string, id: string, updates: Partial<TaskData>): Promise<boolean> {
    return this.post('/project/tasks', { projectDir: baseDir, id, updates });
  }
  deleteTask(baseDir: string, id: string): Promise<boolean> {
    return this.post('/project/tasks/delete', { projectDir: baseDir, id });
  }
  duplicateTask(baseDir: string, taskId: string): Promise<TaskData> {
    return this.post('/project/tasks/duplicate', {
      projectDir: baseDir,
      taskId,
    });
  }
  forkTask(baseDir: string, taskId: string, messageId: string): Promise<TaskData> {
    return this.post('/project/tasks/fork', {
      projectDir: baseDir,
      taskId,
      messageId,
    });
  }
  getTasks(baseDir: string): Promise<TaskData[]> {
    return this.get('/project/tasks', { projectDir: baseDir });
  }
  loadTask(baseDir: string, id: string): Promise<TaskStateData> {
    return this.post('/project/tasks/load', { projectDir: baseDir, id });
  }

  async exportTaskToMarkdown(baseDir: string, taskId: string): Promise<void> {
    const response = await this.apiClient.post('/project/tasks/export-markdown', {
      projectDir: baseDir,
      taskId,
    });

    const markdownContent = response.data;
    const filename = `session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.md`;

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
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
  interruptResponse(baseDir: string, taskId: string, interruptId?: string): void {
    this.post('/project/interrupt', { projectDir: baseDir, taskId, interruptId });
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

  async removeMessage(baseDir: string, taskId: string, messageId: string): Promise<void> {
    await this.deleteWithBody('/project/remove-message', { projectDir: baseDir, taskId, messageId });
  }

  async removeMessagesUpTo(baseDir: string, taskId: string, messageId: string): Promise<void> {
    await this.deleteWithBody('/project/remove-messages-up-to', { projectDir: baseDir, taskId, messageId });
  }
  compactConversation(baseDir: string, taskId: string, mode: Mode, customInstructions?: string): void {
    this.post('/project/compact-conversation', {
      projectDir: baseDir,
      taskId,
      mode,
      customInstructions,
    });
  }

  async handoffConversation(baseDir: string, taskId: string, focus?: string): Promise<void> {
    await this.post('/project/handoff-conversation', {
      projectDir: baseDir,
      taskId,
      focus,
    });
  }

  runCodeInlineRequest(baseDir: string, taskId: string, filename: string, lineNumber: number, userComment: string): void {
    this.post('/project/run-code-inline-request', {
      projectDir: baseDir,
      taskId,
      filename,
      lineNumber,
      userComment,
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
    const { releaseNotes } = await this.get<{ releaseNotes: string | null }>('/release-notes');
    return releaseNotes;
  }
  clearReleaseNotes(): Promise<void> {
    return this.post('/clear-release-notes', {});
  }
  async getOS(): Promise<OS> {
    const { os } = await this.get<{ os: OS }>('/os');
    return os;
  }
  getProviderModels(reload?: boolean): Promise<ProviderModelsData> {
    return this.get('/models', { reload });
  }
  getProviders(): Promise<ProviderProfile[]> {
    return this.get('/providers');
  }
  updateProviders(providers: ProviderProfile[]): Promise<ProviderProfile[]> {
    return this.post('/providers', providers);
  }
  upsertModel(providerId: string, modelId: string, model: Model): Promise<ProviderModelsData> {
    return this.put(`/providers/${providerId}/models`, model, { modelId });
  }
  deleteModel(providerId: string, modelId: string): Promise<ProviderModelsData> {
    return this.delete(`/providers/${providerId}/models`, { modelId });
  }
  updateModels(modelUpdates: Array<{ providerId: string; modelId: string; model: Model }>): Promise<ProviderModelsData> {
    return this.put('/models', modelUpdates);
  }
  queryUsageData(from: string, to: string): Promise<UsageDataRow[]> {
    return this.get('/usage', { from, to });
  }
  getEffectiveEnvironmentVariable(key: string, baseDir?: string): Promise<EnvironmentVariable | undefined> {
    return this.get('/system/env-var', { key, baseDir });
  }

  // Voice API
  createVoiceSession(provider: ProviderProfile): Promise<VoiceSession> {
    return this.post('/voice/session', { provider });
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
  addUpdatedFilesUpdatedListener(baseDir: string, taskId: string, callback: (data: UpdatedFilesUpdatedData) => void): () => void {
    return this.addListener('updated-files-updated', callback, baseDir, taskId);
  }
  addCommandsUpdatedListener(baseDir: string, callback: (data: CommandsData) => void): () => void {
    return this.addListener('commands-updated', callback, baseDir);
  }
  addUpdateAutocompletionListener(baseDir: string, taskId: string, callback: (data: AutocompletionData) => void): () => void {
    return this.addListener('update-autocompletion', callback, baseDir, taskId);
  }
  addAskQuestionListener(baseDir: string, taskId: string, callback: (data: QuestionData) => void): () => void {
    return this.addListener('ask-question', callback, baseDir, taskId);
  }

  addQuestionAnsweredListener(baseDir: string, taskId: string, callback: (data: QuestionAnsweredData) => void): () => void {
    return this.addListener('question-answered', callback, baseDir, taskId);
  }
  addQueuedPromptsUpdatedListener(baseDir: string, taskId: string, callback: (data: QueuedPromptsUpdatedData) => void): () => void {
    return this.addListener('queued-prompts-updated', callback, baseDir, taskId);
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

  addMessageRemovedListener(baseDir: string, taskId: string, callback: (data: MessageRemovedData) => void): () => void {
    return this.addListener('message-removed', callback, baseDir, taskId);
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

  addAgentProfilesUpdatedListener(callback: (data: AgentProfilesUpdatedData) => void): () => void {
    return this.addListener('agent-profiles-updated', callback);
  }

  addProjectSettingsUpdatedListener(baseDir: string, callback: (data: { baseDir: string; settings: ProjectSettings }) => void): () => void {
    return this.addListener('project-settings-updated', callback, baseDir);
  }

  addWorktreeIntegrationStatusUpdatedListener(baseDir: string, taskId: string, callback: (data: WorktreeIntegrationStatusUpdatedData) => void): () => void {
    return this.addListener('worktree-integration-status-updated', callback, baseDir, taskId);
  }

  // Task lifecycle event listeners
  addTaskCreatedListener(baseDir: string, callback: (data: TaskCreatedData) => void): () => void {
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
    return this.addListener('terminal-data', callback, baseDir);
  }
  addTerminalExitListener(baseDir: string, callback: (data: TerminalExitData) => void): () => void {
    return this.addListener('terminal-exit', callback, baseDir);
  }
  addContextMenuListener(callback: (params: Electron.ContextMenuParams) => void): () => void {
    void callback;
    return () => {};
  }
  addOpenSettingsListener(callback: (pageId: string) => void): () => void {
    void callback;
    return () => {};
  }
  async getCommands(baseDir: string): Promise<CommandsData> {
    const response = await this.get<CommandsData>('/project/commands', { projectDir: baseDir });
    return {
      baseDir,
      customCommands: response.customCommands,
      extensionCommands: response.extensionCommands,
    };
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
    return true;
  }
  async createTerminal(baseDir: string, taskId: string, cols?: number, rows?: number): Promise<string> {
    const response = await this.apiClient.post('/terminal/create', {
      baseDir,
      taskId,
      cols,
      rows,
    });
    return response.data.terminalId;
  }
  async writeToTerminal(terminalId: string, data: string): Promise<boolean> {
    await this.apiClient.post('/terminal/write', {
      terminalId,
      data,
    });
    return true;
  }
  async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<boolean> {
    await this.apiClient.post('/terminal/resize', {
      terminalId,
      cols,
      rows,
    });
    return true;
  }
  async closeTerminal(terminalId: string): Promise<boolean> {
    await this.apiClient.post('/terminal/close', {
      terminalId,
    });
    return true;
  }
  async getTerminalForTask(taskId: string): Promise<string | null> {
    const response = await this.apiClient.get(`/terminal/${taskId}`);
    return response.data.terminalId || null;
  }
  async getAllTerminalsForTask(taskId: string): Promise<Array<{ id: string; taskId: string; cols: number; rows: number; baseDir: string }>> {
    const response = await this.apiClient.get(`/terminal/${taskId}/all`);
    return response.data.terminals || [];
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

  // Worktree merge operations
  mergeWorktreeToMain(baseDir: string, taskId: string, squash: boolean, targetBranch?: string, commitMessage?: string): Promise<void> {
    return this.post('/project/worktree/merge-to-main', {
      projectDir: baseDir,
      taskId,
      squash,
      targetBranch,
      commitMessage,
    });
  }

  applyUncommittedChanges(baseDir: string, taskId: string, targetBranch?: string): Promise<void> {
    return this.post('/project/worktree/apply-uncommitted', {
      projectDir: baseDir,
      taskId,
      targetBranch,
    });
  }

  revertLastMerge(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/worktree/revert-last-merge', {
      projectDir: baseDir,
      taskId,
    });
  }

  restoreFile(baseDir: string, taskId: string, filePath: string): Promise<void> {
    return this.post('/project/worktree/restore-file', {
      projectDir: baseDir,
      taskId,
      filePath,
    });
  }

  listBranches(baseDir: string): Promise<Array<{ name: string; isCurrent: boolean; hasWorktree: boolean }>> {
    return this.get('/project/worktree/branches', {
      projectDir: baseDir,
    });
  }

  getWorktreeIntegrationStatus(baseDir: string, taskId: string, targetBranch?: string): Promise<WorktreeIntegrationStatus> {
    return this.get('/project/worktree/status', {
      projectDir: baseDir,
      taskId,
      targetBranch,
    });
  }

  rebaseWorktreeFromBranch(baseDir: string, taskId: string, fromBranch?: string): Promise<void> {
    return this.post('/project/worktree/rebase-from-branch', {
      projectDir: baseDir,
      taskId,
      fromBranch,
    });
  }

  abortWorktreeRebase(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/worktree/abort-rebase', {
      projectDir: baseDir,
      taskId,
    });
  }

  continueWorktreeRebase(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/worktree/continue-rebase', {
      projectDir: baseDir,
      taskId,
    });
  }

  resolveWorktreeConflictsWithAgent(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/worktree/resolve-conflicts-with-agent', {
      projectDir: baseDir,
      taskId,
    });
  }

  resolveConflictsWithAgent(baseDir: string, taskId: string): Promise<void> {
    return this.post('/project/resolve-conflicts-with-agent', {
      projectDir: baseDir,
      taskId,
    });
  }

  // Memory operations
  listAllMemories(): Promise<MemoryEntry[]> {
    return this.get('/memories');
  }

  async deleteMemory(id: string): Promise<boolean> {
    const { ok } = await this.delete<{ ok: boolean }>(`/memories/${id}`);
    return ok;
  }

  getMemoryEmbeddingProgress(): Promise<MemoryEmbeddingProgress> {
    return this.get('/memories/embedding-progress');
  }

  async deleteProjectMemories(projectId: string): Promise<number> {
    const { data } = await this.apiClient.delete<{ deletedCount: number }>('/memories', {
      data: {
        projectId,
      },
    });
    return data.deletedCount;
  }

  // BMAD operations
  async installBmad(projectDir: string): Promise<{ success: boolean; version?: string; message?: string }> {
    return this.post<{ projectDir: string }, { success: boolean; version?: string; message?: string }>('/bmad/install', {
      projectDir,
    });
  }

  getBmadStatus(projectDir: string): Promise<BmadStatus> {
    return this.get<BmadStatus>('/bmad/status', { projectDir });
  }

  async executeWorkflow(projectDir: string, taskId: string, workflowId: string, options?: WorkflowExecutionOptions): Promise<WorkflowExecutionResult> {
    return await this.post('/bmad/execute-workflow', {
      projectDir,
      taskId,
      workflowId,
      options,
    });
  }

  async resetBmadWorkflow(projectDir: string): Promise<{ success: boolean; message?: string }> {
    return await this.post<{ projectDir: string }, { success: boolean; message?: string }>('/bmad/reset-workflow', {
      projectDir,
    });
  }

  async writeToClipboard(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for mobile browsers and non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  }

  async openPath(): Promise<boolean> {
    // Not available in browser context
    return false;
  }

  // Agent profile operations
  getAllAgentProfiles(baseDir?: string): Promise<AgentProfile[]> {
    return this.get('/agent-profiles', { baseDir });
  }

  createAgentProfile(profile: AgentProfile, projectDir?: string): Promise<AgentProfile[]> {
    return this.post('/agent-profile/create', {
      profile,
      projectDir,
    });
  }

  updateAgentProfile(profile: AgentProfile, baseDir?: string): Promise<AgentProfile[]> {
    return this.post('/agent-profile/update', {
      profile,
      baseDir,
    });
  }

  deleteAgentProfile(profileId: string, baseDir?: string): Promise<AgentProfile[]> {
    return this.post('/agent-profile/delete', {
      profileId,
      baseDir,
    });
  }

  updateAgentProfilesOrder(agentProfiles: AgentProfile[]): Promise<void> {
    return this.post('/agent-profiles/order', {
      agentProfiles,
    });
  }

  addNotificationListener(baseDir: string, callback: (data: NotificationData) => void): () => void {
    return this.addListener('notification', (data: NotificationData) => {
      if (data.baseDir === baseDir) {
        callback(data);
      }
    });
  }

  addBmadStatusChangedListener(baseDir: string, callback: (status: BmadStatus) => void): () => void {
    return this.addListener('bmad-status-changed', callback, baseDir);
  }
}

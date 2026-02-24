import {
  AutocompletionData,
  ClearTaskData,
  CommandOutputData,
  CommandsData,
  ContextFilesUpdatedData,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  MessageRemovedData,
  ModelsData,
  OS,
  ProjectSettings,
  ProjectStartedData,
  ProviderModelsData,
  ProvidersUpdatedData,
  QueuedPromptsUpdatedData,
  QuestionAnsweredData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskData,
  CreateTaskParams,
  TerminalData,
  TerminalExitData,
  TokensInfoData,
  ToolData,
  UserMessageData,
  VersionsInfo,
  WorktreeIntegrationStatusUpdatedData,
  TaskCreatedData,
  UpdatedFilesUpdatedData,
} from '@common/types';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ApplicationAPI } from '@common/api';
import { compareBaseDirs } from '@common/utils';

import './index.d';

const api: ApplicationAPI = {
  isOpenLogsDirectorySupported: () => true,
  openLogsDirectory: () => ipcRenderer.invoke('open-logs-directory'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  isManageServerSupported: () => true,
  startServer: (username?: string, password?: string) => ipcRenderer.invoke('start-server', username, password),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  startCloudflareTunnel: () => ipcRenderer.invoke('start-cloudflare-tunnel'),
  stopCloudflareTunnel: () => ipcRenderer.invoke('stop-cloudflare-tunnel'),
  getCloudflareTunnelStatus: () => ipcRenderer.invoke('get-cloudflare-tunnel-status'),
  startProject: (baseDir) => ipcRenderer.invoke('start-project', baseDir),
  stopProject: (baseDir) => ipcRenderer.send('stop-project', baseDir),
  restartProject: (baseDir) => ipcRenderer.send('restart-project', baseDir),
  resetTask: (baseDir, taskId) => ipcRenderer.send('reset-task', baseDir, taskId),
  runPrompt: (baseDir, taskId, prompt, mode) => ipcRenderer.send('run-prompt', baseDir, taskId, prompt, mode),
  savePrompt: (baseDir, taskId, prompt) => ipcRenderer.invoke('save-prompt', baseDir, taskId, prompt),
  redoLastUserPrompt: (baseDir, taskId, mode, updatedPrompt?) => ipcRenderer.send('redo-last-user-prompt', baseDir, taskId, mode, updatedPrompt),
  resumeTask: (baseDir, taskId) => ipcRenderer.send('resume-task', baseDir, taskId),
  answerQuestion: (baseDir, taskId, answer) => ipcRenderer.send('answer-question', baseDir, taskId, answer),
  removeQueuedPrompt: (baseDir, taskId, promptId) => ipcRenderer.send('remove-queued-prompt', baseDir, taskId, promptId),
  sendQueuedPromptNow: (baseDir, taskId, promptId) => ipcRenderer.send('send-queued-prompt-now', baseDir, taskId, promptId),
  loadInputHistory: (baseDir) => ipcRenderer.invoke('load-input-history', baseDir),
  isOpenDialogSupported: () => true,
  showOpenDialog: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.invoke('show-open-dialog', options),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getOpenProjects: () => ipcRenderer.invoke('get-open-projects'),
  addOpenProject: (baseDir) => ipcRenderer.invoke('add-open-project', baseDir),
  setActiveProject: (baseDir) => ipcRenderer.invoke('set-active-project', baseDir),
  removeOpenProject: (baseDir) => ipcRenderer.invoke('remove-open-project', baseDir),
  updateOpenProjectsOrder: (baseDirs) => ipcRenderer.invoke('update-open-projects-order', baseDirs),
  updateMainModel: (baseDir, taskId, model) => ipcRenderer.send('update-main-model', baseDir, taskId, model),
  updateWeakModel: (baseDir, taskId, model) => ipcRenderer.send('update-weak-model', baseDir, taskId, model),
  updateArchitectModel: (baseDir, taskId, model) => ipcRenderer.send('update-architect-model', baseDir, taskId, model),
  updateEditFormats: (baseDir, editFormats) => ipcRenderer.send('update-edit-formats', baseDir, editFormats),
  getProjectSettings: (baseDir) => ipcRenderer.invoke('get-project-settings', baseDir),
  patchProjectSettings: (baseDir, settings) => ipcRenderer.invoke('patch-project-settings', baseDir, settings),
  getFilePathSuggestions: (currentPath, directoriesOnly = false) => ipcRenderer.invoke('get-file-path-suggestions', currentPath, directoriesOnly),
  getAddableFiles: (baseDir, taskId) => ipcRenderer.invoke('get-addable-files', baseDir, taskId),
  getAllFiles: (baseDir, taskId, useGit = true) => ipcRenderer.invoke('get-all-files', baseDir, taskId, useGit),
  getUpdatedFiles: (baseDir, taskId) => ipcRenderer.invoke('get-updated-files', baseDir, taskId),
  restoreFile: (baseDir, taskId, filePath) => ipcRenderer.invoke('restore-file', baseDir, taskId, filePath),
  generateCommitMessage: (baseDir, taskId) => ipcRenderer.invoke('generate-commit-message', baseDir, taskId),
  commitChanges: (baseDir, taskId, message, amend) => ipcRenderer.invoke('commit-changes', baseDir, taskId, message, amend),
  addFile: (baseDir, taskId, filePath, readOnly = false) => ipcRenderer.send('add-file', baseDir, taskId, filePath, readOnly),
  isValidPath: (baseDir, path) => ipcRenderer.invoke('is-valid-path', baseDir, path),
  isProjectPath: (path) => ipcRenderer.invoke('is-project-path', path),
  dropFile: (baseDir, taskId, path) => ipcRenderer.send('drop-file', baseDir, taskId, path),
  runCommand: (baseDir, taskId, command) => ipcRenderer.send('run-command', baseDir, taskId, command),
  pasteImage: (baseDir, taskId) => ipcRenderer.send('paste-image', baseDir, taskId),
  scrapeWeb: (baseDir, taskId, url, filePath) => ipcRenderer.invoke('scrape-web', baseDir, taskId, url, filePath),
  initProjectRulesFile: (baseDir, taskId) => ipcRenderer.invoke('init-project-rules-file', baseDir, taskId),

  getTodos: (baseDir, taskId) => ipcRenderer.invoke('get-todos', baseDir, taskId),
  addTodo: (baseDir, taskId, name) => ipcRenderer.invoke('add-todo', baseDir, taskId, name),
  updateTodo: (baseDir, taskId, name, updates) => ipcRenderer.invoke('update-todo', baseDir, taskId, name, updates),
  deleteTodo: (baseDir, taskId, name) => ipcRenderer.invoke('delete-todo', baseDir, taskId, name),
  clearAllTodos: (baseDir, taskId) => ipcRenderer.invoke('clear-all-todos', baseDir, taskId),

  loadMcpServerTools: (serverName, config?: McpServerConfig) => ipcRenderer.invoke('load-mcp-server-tools', serverName, config),
  reloadMcpServers: (mcpServers, force = false) => ipcRenderer.invoke('reload-mcp-servers', mcpServers, force),
  reloadMcpServer: (serverName: string, config: McpServerConfig) => ipcRenderer.invoke('reload-mcp-server', serverName, config),

  createNewTask: (baseDir, params?: CreateTaskParams) => ipcRenderer.invoke('create-new-task', baseDir, params),
  updateTask: (baseDir, id, updates) => ipcRenderer.invoke('update-task', baseDir, id, updates),
  deleteTask: (baseDir, id) => ipcRenderer.invoke('delete-task', baseDir, id),
  duplicateTask: (baseDir, taskId) => ipcRenderer.invoke('duplicate-task', baseDir, taskId),
  forkTask: (baseDir, taskId, messageId) => ipcRenderer.invoke('fork-task', baseDir, taskId, messageId),
  getTasks: (baseDir) => ipcRenderer.invoke('get-tasks', baseDir),
  loadTask: (baseDir, taskId) => ipcRenderer.invoke('load-task', baseDir, taskId),

  exportTaskToMarkdown: (baseDir, taskId) => ipcRenderer.invoke('export-task-to-markdown', baseDir, taskId),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (baseDir) => ipcRenderer.invoke('add-recent-project', baseDir),
  removeRecentProject: (baseDir) => ipcRenderer.invoke('remove-recent-project', baseDir),
  interruptResponse: (baseDir, taskId, interruptId) => ipcRenderer.send('interrupt-response', baseDir, taskId, interruptId),
  applyEdits: (baseDir, taskId, edits: FileEdit[]) => ipcRenderer.send('apply-edits', baseDir, taskId, edits),
  clearContext: (baseDir, taskId) => ipcRenderer.send('clear-context', baseDir, taskId),
  removeLastMessage: (baseDir, taskId) => ipcRenderer.send('remove-last-message', baseDir, taskId),
  removeMessage: (baseDir, taskId, messageId) => ipcRenderer.invoke('remove-message', baseDir, taskId, messageId),
  removeMessagesUpTo: (baseDir, taskId, messageId) => ipcRenderer.invoke('remove-messages-up-to', baseDir, taskId, messageId),
  compactConversation: (baseDir, taskId, mode, customInstructions) => ipcRenderer.invoke('compact-conversation', baseDir, taskId, mode, customInstructions),
  handoffConversation: (baseDir, taskId, focus) => ipcRenderer.invoke('handoff-conversation', baseDir, taskId, focus),
  runCodeInlineRequest: (baseDir, taskId, filename, lineNumber, userComment) =>
    ipcRenderer.send('run-code-inline-request', baseDir, taskId, filename, lineNumber, userComment),
  setZoomLevel: (level) => ipcRenderer.invoke('set-zoom-level', level),
  getVersions: (forceRefresh = false) => ipcRenderer.invoke('get-versions', forceRefresh),
  downloadLatestAiderDesk: () => ipcRenderer.invoke('download-latest-aiderdesk'),

  getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),
  clearReleaseNotes: () => ipcRenderer.invoke('clear-release-notes'),
  getOS: (): Promise<OS> => ipcRenderer.invoke('get-os'),
  getProviderModels: (reload?: boolean) => ipcRenderer.invoke('get-provider-models', reload),
  getProviders: () => ipcRenderer.invoke('get-providers'),
  updateProviders: async (providers) => await ipcRenderer.invoke('update-providers', providers),
  upsertModel: (providerId, modelId, model) => ipcRenderer.invoke('upsert-model', providerId, modelId, model),
  deleteModel: (providerId, modelId) => ipcRenderer.invoke('delete-model', providerId, modelId),
  updateModels: (modelUpdates) => ipcRenderer.invoke('update-models', modelUpdates),
  queryUsageData: (from, to) => ipcRenderer.invoke('query-usage-data', from, to),
  getEffectiveEnvironmentVariable: (key: string, baseDir?: string) => ipcRenderer.invoke('get-effective-environment-variable', key, baseDir),

  // Voice API
  createVoiceSession: (provider) => ipcRenderer.invoke('create-voice-session', provider),

  addSettingsUpdatedListener: (callback: (data: SettingsData) => void) => {
    const listener = (_: Electron.IpcRendererEvent, data: SettingsData) => {
      callback(data);
    };
    ipcRenderer.on('settings-updated', listener);
    return () => {
      ipcRenderer.removeListener('settings-updated', listener);
    };
  },

  addResponseChunkListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ResponseChunkData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('response-chunk', listener);
    return () => {
      ipcRenderer.removeListener('response-chunk', listener);
    };
  },

  addResponseCompletedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ResponseCompletedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('response-completed', listener);
    return () => {
      ipcRenderer.removeListener('response-completed', listener);
    };
  },

  addContextFilesUpdatedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ContextFilesUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('context-files-updated', listener);
    return () => {
      ipcRenderer.removeListener('context-files-updated', listener);
    };
  },

  addUpdatedFilesUpdatedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: UpdatedFilesUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('updated-files-updated', listener);
    return () => {
      ipcRenderer.removeListener('updated-files-updated', listener);
    };
  },

  addCommandsUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: CommandsData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('commands-updated', listener);
    return () => {
      ipcRenderer.removeListener('commands-updated', listener);
    };
  },

  addUpdateAutocompletionListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: AutocompletionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-autocompletion', listener);
    return () => {
      ipcRenderer.removeListener('update-autocompletion', listener);
    };
  },

  addAskQuestionListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: QuestionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('ask-question', listener);
    return () => {
      ipcRenderer.removeListener('ask-question', listener);
    };
  },
  addQuestionAnsweredListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: QuestionAnsweredData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('question-answered', listener);
    return () => {
      ipcRenderer.removeListener('question-answered', listener);
    };
  },

  addQueuedPromptsUpdatedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: QueuedPromptsUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('queued-prompts-updated', listener);
    return () => {
      ipcRenderer.removeListener('queued-prompts-updated', listener);
    };
  },

  addUpdateAiderModelsListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ModelsData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-aider-models', listener);
    return () => {
      ipcRenderer.removeListener('update-aider-models', listener);
    };
  },

  addCommandOutputListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: CommandOutputData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('command-output', listener);
    return () => {
      ipcRenderer.removeListener('command-output', listener);
    };
  },

  addLogListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: LogData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('log', listener);
    return () => {
      ipcRenderer.removeListener('log', listener);
    };
  },

  addTokensInfoListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TokensInfoData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-tokens-info', listener);
    return () => {
      ipcRenderer.removeListener('update-tokens-info', listener);
    };
  },

  addToolListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ToolData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('tool', listener);
    return () => {
      ipcRenderer.removeListener('tool', listener);
    };
  },

  addInputHistoryUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: InputHistoryData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('input-history-updated', listener);
    return () => {
      ipcRenderer.removeListener('input-history-updated', listener);
    };
  },

  addUserMessageListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: UserMessageData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('user-message', listener);
    return () => {
      ipcRenderer.removeListener('user-message', listener);
    };
  },

  addClearTaskListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ClearTaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('clear-task', listener);
    return () => {
      ipcRenderer.removeListener('clear-task', listener);
    };
  },

  addMessageRemovedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: MessageRemovedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('message-removed', listener);
    return () => {
      ipcRenderer.removeListener('message-removed', listener);
    };
  },

  addProjectStartedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ProjectStartedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('project-started', listener);
    return () => {
      ipcRenderer.removeListener('project-started', listener);
    };
  },

  addVersionsInfoUpdatedListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: VersionsInfo) => {
      callback(data);
    };
    ipcRenderer.on('versions-info-updated', listener);
    return () => {
      ipcRenderer.removeListener('versions-info-updated', listener);
    };
  },

  addProviderModelsUpdatedListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ProviderModelsData) => {
      callback(data);
    };
    ipcRenderer.on('provider-models-updated', listener);
    return () => {
      ipcRenderer.removeListener('provider-models-updated', listener);
    };
  },

  addProvidersUpdatedListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ProvidersUpdatedData) => {
      callback(data);
    };
    ipcRenderer.on('providers-updated', listener);
    return () => {
      ipcRenderer.removeListener('providers-updated', listener);
    };
  },

  addProjectSettingsUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: { baseDir: string; settings: ProjectSettings }) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('project-settings-updated', listener);
    return () => {
      ipcRenderer.removeListener('project-settings-updated', listener);
    };
  },

  // Task lifecycle event listeners
  addTaskCreatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskCreatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-created', listener);
    return () => {
      ipcRenderer.removeListener('task-created', listener);
    };
  },

  addTaskInitializedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-initialized', listener);
    return () => {
      ipcRenderer.removeListener('task-initialized', listener);
    };
  },

  addTaskUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-updated', listener);
    return () => {
      ipcRenderer.removeListener('task-updated', listener);
    };
  },

  addTaskStartedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-started', listener);
    return () => {
      ipcRenderer.removeListener('task-started', listener);
    };
  },

  addTaskCompletedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-completed', listener);
    return () => {
      ipcRenderer.removeListener('task-completed', listener);
    };
  },

  addTaskCancelledListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-cancelled', listener);
    return () => {
      ipcRenderer.removeListener('task-cancelled', listener);
    };
  },

  addTaskDeletedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TaskData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('task-deleted', listener);
    return () => {
      ipcRenderer.removeListener('task-deleted', listener);
    };
  },

  addTerminalDataListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TerminalData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('terminal-data', listener);
    return () => {
      ipcRenderer.removeListener('terminal-data', listener);
    };
  },

  addTerminalExitListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TerminalExitData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('terminal-exit', listener);
    return () => {
      ipcRenderer.removeListener('terminal-exit', listener);
    };
  },

  addWorktreeIntegrationStatusUpdatedListener: (baseDir, taskId, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: WorktreeIntegrationStatusUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir) || data.taskId !== taskId) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('worktree-integration-status-updated', listener);
    return () => {
      ipcRenderer.removeListener('worktree-integration-status-updated', listener);
    };
  },

  addContextMenuListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, params: Electron.ContextMenuParams) => callback(params);
    ipcRenderer.on('context-menu', listener);
    return () => {
      ipcRenderer.removeListener('context-menu', listener);
    };
  },

  addOpenSettingsListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, pageId: string) => callback(pageId);
    ipcRenderer.on('open-settings', listener);
    return () => {
      ipcRenderer.removeListener('open-settings', listener);
    };
  },

  getCommands: (baseDir) => ipcRenderer.invoke('get-commands', baseDir),
  runCustomCommand: (baseDir, taskId, commandName, args, mode) => ipcRenderer.invoke('run-custom-command', baseDir, taskId, commandName, args, mode),

  // Terminal operations
  isTerminalSupported: () => true,
  createTerminal: (baseDir, taskId, cols, rows) => ipcRenderer.invoke('terminal-create', baseDir, taskId, cols, rows),
  writeToTerminal: (terminalId, data) => ipcRenderer.invoke('terminal-write', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('terminal-resize', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('terminal-close', terminalId),
  getTerminalForTask: (taskId) => ipcRenderer.invoke('terminal-get-for-task', taskId),
  getAllTerminalsForTask: (taskId) => ipcRenderer.invoke('terminal-get-all-for-task', taskId),

  // Worktree merge operations
  mergeWorktreeToMain: (baseDir, taskId, squash, targetBranch, commitMessage) =>
    ipcRenderer.invoke('merge-worktree-to-main', baseDir, taskId, squash, targetBranch, commitMessage),
  applyUncommittedChanges: (baseDir, taskId, targetBranch) => ipcRenderer.invoke('apply-uncommitted-changes', baseDir, taskId, targetBranch),
  revertLastMerge: (baseDir, taskId) => ipcRenderer.invoke('revert-last-merge', baseDir, taskId),
  listBranches: (baseDir) => ipcRenderer.invoke('list-branches', baseDir),
  getWorktreeIntegrationStatus: (baseDir, taskId, targetBranch) => ipcRenderer.invoke('get-worktree-integration-status', baseDir, taskId, targetBranch),
  rebaseWorktreeFromBranch: (baseDir, taskId, fromBranch) => ipcRenderer.invoke('rebase-worktree-from-branch', baseDir, taskId, fromBranch),
  abortWorktreeRebase: (baseDir, taskId) => ipcRenderer.invoke('abort-worktree-rebase', baseDir, taskId),
  continueWorktreeRebase: (baseDir, taskId) => ipcRenderer.invoke('continue-worktree-rebase', baseDir, taskId),
  resolveWorktreeConflictsWithAgent: (baseDir, taskId) => ipcRenderer.invoke('resolve-worktree-conflicts-with-agent', baseDir, taskId),
  resolveConflictsWithAgent: (baseDir, taskId) => ipcRenderer.invoke('resolve-worktree-conflicts-with-agent', baseDir, taskId),

  // Agent profile operations
  getAllAgentProfiles: () => ipcRenderer.invoke('get-agent-profiles'),
  createAgentProfile: (profile, projectDir) => ipcRenderer.invoke('create-agent-profile', profile, projectDir),
  updateAgentProfile: (profile, baseDir) => ipcRenderer.invoke('update-agent-profile', profile, baseDir),
  deleteAgentProfile: (profileId, baseDir) => ipcRenderer.invoke('delete-agent-profile', profileId, baseDir),
  updateAgentProfilesOrder: (agentProfiles) => ipcRenderer.invoke('update-agent-profiles-order', agentProfiles),

  // Memory operations
  listAllMemories: () => ipcRenderer.invoke('list-all-memories'),
  deleteMemory: (id) => ipcRenderer.invoke('delete-memory', id),
  deleteProjectMemories: (projectId) => ipcRenderer.invoke('delete-project-memories', projectId),
  getMemoryEmbeddingProgress: () => ipcRenderer.invoke('get-memory-embedding-progress'),

  // BMAD operations
  installBmad: (projectDir: string) => ipcRenderer.invoke('bmad-install', projectDir),
  getBmadStatus: (projectDir: string) => ipcRenderer.invoke('bmad-get-status', projectDir),
  executeWorkflow: (projectDir: string, taskId: string, workflowId: string, options?: { asSubtask?: boolean; provider?: string; model?: string }) =>
    ipcRenderer.invoke('bmad-execute-workflow', projectDir, taskId, workflowId, options),
  resetBmadWorkflow: (projectDir: string) => ipcRenderer.invoke('bmad-reset-workflow', projectDir),

  writeToClipboard: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),

  addAgentProfilesUpdatedListener: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('agent-profiles-updated', listener);
    return () => ipcRenderer.off('agent-profiles-updated', listener);
  },

  addNotificationListener: () => {
    // notifications in Electron app are handled by the main process
    return () => {};
  },

  addBmadStatusChangedListener: (baseDir: string, callback) => {
    const listener = (_, data) => {
      if (data.projectDir === baseDir) {
        callback(data);
      }
    };
    ipcRenderer.on('bmad-status-changed', listener);
    return () => ipcRenderer.off('bmad-status-changed', listener);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}

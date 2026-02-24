import {
  AgentProfile,
  AgentProfilesUpdatedData,
  AutocompletionData,
  BmadStatus,
  BranchInfo,
  ClearTaskData,
  CloudflareTunnelStatus,
  CommandOutputData,
  ContextFilesUpdatedData,
  CreateTaskParams,
  CommandsData,
  EditFormat,
  EnvironmentVariable,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  McpTool,
  MemoryEmbeddingProgress,
  MemoryEntry,
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
  QueuedPromptsUpdatedData,
  QuestionAnsweredData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskCreatedData,
  TaskData,
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
  WorkflowExecutionOptions,
  WorkflowExecutionResult,
  WorktreeIntegrationStatus,
  WorktreeIntegrationStatusUpdatedData,
  UpdatedFile,
  UpdatedFilesUpdatedData,
} from '@common/types';

export interface ApplicationAPI {
  isOpenLogsDirectorySupported: () => boolean;
  openLogsDirectory: () => Promise<boolean>;
  loadSettings: () => Promise<SettingsData>;
  saveSettings: (settings: SettingsData) => Promise<SettingsData>;
  isManageServerSupported: () => boolean;
  startServer: (username?: string, password?: string) => Promise<boolean>;
  stopServer: () => Promise<boolean>;
  startCloudflareTunnel: () => Promise<boolean>;
  stopCloudflareTunnel: () => Promise<void>;
  getCloudflareTunnelStatus: () => Promise<CloudflareTunnelStatus>;
  startProject: (baseDir: string) => Promise<void>;
  stopProject: (baseDir: string) => void;
  restartProject: (baseDir: string) => void;
  resetTask: (baseDir: string, taskId: string) => void;
  runPrompt: (baseDir: string, taskId: string, prompt: string, mode?: Mode) => void;
  savePrompt: (baseDir: string, taskId: string, prompt: string) => Promise<void>;
  redoLastUserPrompt: (baseDir: string, taskId: string, mode: Mode, updatedPrompt?: string) => void;
  resumeTask: (baseDir: string, taskId: string) => void;
  answerQuestion: (baseDir: string, taskId: string, answer: string) => void;
  removeQueuedPrompt: (baseDir: string, taskId: string, promptId: string) => void;
  sendQueuedPromptNow: (baseDir: string, taskId: string, promptId: string) => void;
  loadInputHistory: (baseDir: string) => Promise<string[]>;
  isOpenDialogSupported: () => boolean;
  showOpenDialog: (options: Electron.OpenDialogSyncOptions) => Promise<Electron.OpenDialogReturnValue>;
  getPathForFile: (file: File) => string;
  getOpenProjects: () => Promise<ProjectData[]>;
  addOpenProject: (baseDir: string) => Promise<ProjectData[]>;
  setActiveProject: (baseDir: string) => Promise<ProjectData[]>;
  removeOpenProject: (baseDir: string) => Promise<ProjectData[]>;
  updateOpenProjectsOrder: (baseDirs: string[]) => Promise<ProjectData[]>;
  updateMainModel: (baseDir: string, taskId: string, model: string) => void;
  updateWeakModel: (baseDir: string, taskId: string, model: string) => void;
  updateArchitectModel: (baseDir: string, taskId: string, model: string) => void;
  updateEditFormats: (baseDir: string, editFormats: Record<string, EditFormat>) => void;
  getProjectSettings: (baseDir: string) => Promise<ProjectSettings>;
  patchProjectSettings: (baseDir: string, settings: Partial<ProjectSettings>) => Promise<ProjectSettings>;
  getFilePathSuggestions: (currentPath: string, directoriesOnly?: boolean) => Promise<string[]>;
  getAddableFiles: (baseDir: string, taskId: string) => Promise<string[]>;
  getAllFiles: (baseDir: string, taskId: string, useGit?: boolean) => Promise<string[]>;
  getUpdatedFiles: (baseDir: string, taskId: string) => Promise<UpdatedFile[]>;
  restoreFile: (baseDir: string, taskId: string, filePath: string) => Promise<void>;
  generateCommitMessage: (baseDir: string, taskId: string) => Promise<string>;
  commitChanges: (baseDir: string, taskId: string, message: string, amend: boolean) => Promise<void>;
  addFile: (baseDir: string, taskId: string, filePath: string, readOnly?: boolean) => void;
  isValidPath: (baseDir: string, path: string) => Promise<boolean>;
  isProjectPath: (path: string) => Promise<boolean>;
  dropFile: (baseDir: string, taskId: string, path: string) => void;
  runCommand: (baseDir: string, taskId: string, command: string) => void;
  pasteImage: (baseDir: string, taskId: string, imageBuffer?: ArrayBuffer) => void;
  scrapeWeb: (baseDir: string, taskId: string, url: string, filePath?: string) => Promise<void>;
  initProjectRulesFile: (baseDir: string, taskId: string) => Promise<void>;

  // Todo operations
  getTodos: (baseDir: string, taskId: string) => Promise<TodoItem[]>;
  addTodo: (baseDir: string, taskId: string, name: string) => Promise<TodoItem[]>;
  updateTodo: (baseDir: string, taskId: string, name: string, updates: Partial<TodoItem>) => Promise<TodoItem[]>;
  deleteTodo: (baseDir: string, taskId: string, name: string) => Promise<TodoItem[]>;
  clearAllTodos: (baseDir: string, taskId: string) => Promise<TodoItem[]>;

  loadMcpServerTools: (serverName: string, config?: McpServerConfig) => Promise<McpTool[] | null>;
  reloadMcpServers: (mcpServers: Record<string, McpServerConfig>, force?: boolean) => Promise<void>;
  reloadMcpServer: (serverName: string, config: McpServerConfig) => Promise<McpTool[]>;

  createNewTask: (baseDir: string, params?: CreateTaskParams) => Promise<TaskData>;
  updateTask: (baseDir: string, id: string, updates: Partial<TaskData>) => Promise<boolean>;
  deleteTask: (baseDir: string, id: string) => Promise<boolean>;
  duplicateTask: (baseDir: string, taskId: string) => Promise<TaskData>;
  forkTask: (baseDir: string, taskId: string, messageId: string) => Promise<TaskData>;
  getTasks: (baseDir: string) => Promise<TaskData[]>;
  loadTask: (baseDir: string, taskId: string) => Promise<TaskStateData>;
  exportTaskToMarkdown: (baseDir: string, taskId: string) => Promise<void>;
  getRecentProjects: () => Promise<string[]>;
  addRecentProject: (baseDir: string) => Promise<void>;
  removeRecentProject: (baseDir: string) => Promise<void>;
  interruptResponse: (baseDir: string, taskId: string, interruptId?: string) => void;
  applyEdits: (baseDir: string, taskId: string, edits: FileEdit[]) => void;
  clearContext: (baseDir: string, taskId: string) => void;
  removeLastMessage: (baseDir: string, taskId: string) => void;
  removeMessage: (baseDir: string, taskId: string, messageId: string) => Promise<void>;
  removeMessagesUpTo: (baseDir: string, taskId: string, messageId: string) => Promise<void>;
  compactConversation: (baseDir: string, taskId: string, mode: Mode, customInstructions?: string) => void;
  handoffConversation: (baseDir: string, taskId: string, focus?: string) => Promise<void>;
  runCodeInlineRequest: (baseDir: string, taskId: string, filename: string, lineNumber: number, userComment: string) => void;
  setZoomLevel: (level: number) => Promise<void>;

  getVersions: (forceRefresh?: boolean) => Promise<VersionsInfo | null>;
  downloadLatestAiderDesk: () => Promise<void>;

  getReleaseNotes: () => Promise<string | null>;
  clearReleaseNotes: () => Promise<void>;
  getOS: () => Promise<OS>;
  queryUsageData: (from: string, to: string) => Promise<UsageDataRow[]>;
  getEffectiveEnvironmentVariable: (key: string, baseDir?: string) => Promise<EnvironmentVariable | undefined>;

  // Voice API
  createVoiceSession: (provider: ProviderProfile) => Promise<VoiceSession>;

  getProviderModels: (reload?: boolean) => Promise<ProviderModelsData>;
  getProviders: () => Promise<ProviderProfile[]>;
  updateProviders: (providers: ProviderProfile[]) => Promise<ProviderProfile[]>;
  upsertModel: (providerId: string, modelId: string, model: Model) => Promise<ProviderModelsData>;
  deleteModel: (providerId: string, modelId: string) => Promise<ProviderModelsData>;
  updateModels: (modelUpdates: Array<{ providerId: string; modelId: string; model: Model }>) => Promise<ProviderModelsData>;

  addSettingsUpdatedListener: (callback: (data: SettingsData) => void) => () => void;
  addResponseChunkListener: (baseDir: string, taskId: string, callback: (data: ResponseChunkData) => void) => () => void;
  addResponseCompletedListener: (baseDir: string, taskId: string, callback: (data: ResponseCompletedData) => void) => () => void;
  addLogListener: (baseDir: string, taskId: string, callback: (data: LogData) => void) => () => void;
  addContextFilesUpdatedListener: (baseDir: string, taskId: string, callback: (data: ContextFilesUpdatedData) => void) => () => void;
  addUpdatedFilesUpdatedListener: (baseDir: string, taskId: string, callback: (data: UpdatedFilesUpdatedData) => void) => () => void;
  addCommandsUpdatedListener: (baseDir: string, callback: (data: CommandsData) => void) => () => void;
  addUpdateAutocompletionListener: (baseDir: string, taskId: string, callback: (data: AutocompletionData) => void) => () => void;
  addAskQuestionListener: (baseDir: string, taskId: string, callback: (data: QuestionData) => void) => () => void;
  addQuestionAnsweredListener: (baseDir: string, taskId: string, callback: (data: QuestionAnsweredData) => void) => () => void;
  addQueuedPromptsUpdatedListener: (baseDir: string, taskId: string, callback: (data: QueuedPromptsUpdatedData) => void) => () => void;
  addUpdateAiderModelsListener: (baseDir: string, taskId: string, callback: (data: ModelsData) => void) => () => void;
  addCommandOutputListener: (baseDir: string, taskId: string, callback: (data: CommandOutputData) => void) => () => void;
  addTokensInfoListener: (baseDir: string, taskId: string, callback: (data: TokensInfoData) => void) => () => void;
  addToolListener: (baseDir: string, taskId: string, callback: (data: ToolData) => void) => () => void;
  addUserMessageListener: (baseDir: string, taskId: string, callback: (data: UserMessageData) => void) => () => void;
  addInputHistoryUpdatedListener: (baseDir: string, callback: (data: InputHistoryData) => void) => () => void;
  addClearTaskListener: (baseDir: string, taskId: string, callback: (data: ClearTaskData) => void) => () => void;
  addMessageRemovedListener: (baseDir: string, taskId: string, callback: (data: MessageRemovedData) => void) => () => void;
  addProjectStartedListener: (baseDir: string, callback: (data: ProjectStartedData) => void) => () => void;
  addVersionsInfoUpdatedListener: (callback: (data: VersionsInfo) => void) => () => void;
  addProviderModelsUpdatedListener: (callback: (data: ProviderModelsData) => void) => () => void;
  addProvidersUpdatedListener: (callback: (data: ProvidersUpdatedData) => void) => () => void;
  addAgentProfilesUpdatedListener: (callback: (data: AgentProfilesUpdatedData) => void) => () => void;
  addProjectSettingsUpdatedListener: (baseDir: string, callback: (data: { baseDir: string; settings: ProjectSettings }) => void) => () => void;
  addWorktreeIntegrationStatusUpdatedListener: (baseDir: string, taskId: string, callback: (data: WorktreeIntegrationStatusUpdatedData) => void) => () => void;
  addTerminalDataListener: (baseDir: string, callback: (data: TerminalData) => void) => () => void;
  addTerminalExitListener: (baseDir: string, callback: (data: TerminalExitData) => void) => () => void;
  addContextMenuListener: (callback: (params: Electron.ContextMenuParams) => void) => () => void;
  addOpenSettingsListener: (callback: (pageId: string) => void) => () => void;

  // Task lifecycle event listeners
  addTaskCreatedListener: (baseDir: string, callback: (data: TaskCreatedData) => void) => () => void;
  addTaskInitializedListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;
  addTaskUpdatedListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;
  addTaskStartedListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;
  addTaskCompletedListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;
  addTaskCancelledListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;
  addTaskDeletedListener: (baseDir: string, callback: (data: TaskData) => void) => () => void;

  getCommands: (baseDir: string) => Promise<CommandsData>;
  runCustomCommand: (baseDir: string, taskId: string, commandName: string, args: string[], mode: Mode) => Promise<void>;

  // Terminal operations
  isTerminalSupported: () => boolean;
  createTerminal: (baseDir: string, taskId: string, cols?: number, rows?: number) => Promise<string>;
  writeToTerminal: (terminalId: string, data: string) => Promise<boolean>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
  closeTerminal: (terminalId: string) => Promise<boolean>;
  getTerminalForTask: (taskId: string) => Promise<string | null>;
  getAllTerminalsForTask: (taskId: string) => Promise<Array<{ id: string; taskId: string; cols: number; rows: number }>>;

  // Worktree merge operations
  mergeWorktreeToMain: (baseDir: string, taskId: string, squash: boolean, targetBranch?: string, commitMessage?: string) => Promise<void>;
  applyUncommittedChanges: (baseDir: string, taskId: string, targetBranch?: string) => Promise<void>;
  revertLastMerge: (baseDir: string, taskId: string) => Promise<void>;
  listBranches: (baseDir: string) => Promise<BranchInfo[]>;
  getWorktreeIntegrationStatus: (baseDir: string, taskId: string, targetBranch?: string) => Promise<WorktreeIntegrationStatus | null>;
  rebaseWorktreeFromBranch: (baseDir: string, taskId: string, fromBranch?: string) => Promise<void>;
  abortWorktreeRebase: (baseDir: string, taskId: string) => Promise<void>;
  continueWorktreeRebase: (baseDir: string, taskId: string) => Promise<void>;
  resolveWorktreeConflictsWithAgent: (baseDir: string, taskId: string) => Promise<void>;
  resolveConflictsWithAgent: (baseDir: string, taskId: string) => Promise<void>;

  // Agent profile operations
  getAllAgentProfiles: () => Promise<AgentProfile[]>;
  createAgentProfile: (profile: AgentProfile, projectDir?: string) => Promise<AgentProfile[]>;
  updateAgentProfile: (profile: AgentProfile, baseDir?: string) => Promise<AgentProfile[]>;
  deleteAgentProfile: (profileId: string, baseDir?: string) => Promise<AgentProfile[]>;
  updateAgentProfilesOrder: (agentProfiles: AgentProfile[]) => Promise<void>;

  // Memory operations
  listAllMemories: () => Promise<MemoryEntry[]>;
  deleteMemory: (id: string) => Promise<boolean>;
  deleteProjectMemories: (projectId: string) => Promise<number>;
  getMemoryEmbeddingProgress: () => Promise<MemoryEmbeddingProgress>;

  // Clipboard operations
  writeToClipboard: (text: string) => Promise<void>;
  openPath: (path: string) => Promise<boolean>;

  addNotificationListener: (baseDir: string, callback: (data: NotificationData) => void) => () => void;

  // BMAD operations
  installBmad: (projectDir: string) => Promise<{ success: boolean; message?: string }>;
  getBmadStatus: (projectDir: string) => Promise<BmadStatus>;
  executeWorkflow: (projectDir: string, taskId: string, workflowId: string, options?: WorkflowExecutionOptions) => Promise<WorkflowExecutionResult>;
  resetBmadWorkflow: (projectDir: string) => Promise<{ success: boolean; message?: string }>;
  addBmadStatusChangedListener: (baseDir: string, callback: (status: BmadStatus) => void) => () => void;
}

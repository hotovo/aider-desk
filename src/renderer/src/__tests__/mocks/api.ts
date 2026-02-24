import { type MockedObject, vi } from 'vitest';
import { ApplicationAPI } from '@common/api';
import {
  ProjectData,
  ProjectSettings,
  SettingsData,
  TaskData,
  TaskStateData,
  CommandsData,
  VersionsInfo,
  OS,
  UsageDataRow,
  EnvironmentVariable,
  VoiceSession,
  ProviderModelsData,
  ProviderProfile,
  TodoItem,
  McpTool,
  CloudflareTunnelStatus,
  BranchInfo,
  WorktreeIntegrationStatus,
  AgentProfile,
  MemoryEntry,
  MemoryEmbeddingProgress,
} from '@common/types';

import type { BmadStatus } from '@common/types';

/**
 * Creates a comprehensive mock for ApplicationAPI
 * Provides default implementations for all methods and allows overrides
 */
export const createMockApi = (overrides: Partial<ApplicationAPI> = {}): MockedObject<ApplicationAPI> => {
  const defaultMock: ApplicationAPI = {
    // Directory and logging operations
    isOpenLogsDirectorySupported: vi.fn((): boolean => true),
    openLogsDirectory: vi.fn((): Promise<boolean> => Promise.resolve(true)),

    // Settings operations
    loadSettings: vi.fn((): Promise<SettingsData> => Promise.resolve({} as SettingsData)),
    saveSettings: vi.fn((settings: SettingsData): Promise<SettingsData> => Promise.resolve(settings)),
    addSettingsUpdatedListener: vi.fn(() => vi.fn()),

    // Server operations
    isManageServerSupported: vi.fn((): boolean => true),
    startServer: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    stopServer: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    startCloudflareTunnel: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    stopCloudflareTunnel: vi.fn((): Promise<void> => Promise.resolve()),
    getCloudflareTunnelStatus: vi.fn((): Promise<CloudflareTunnelStatus> => Promise.resolve({ isRunning: false })),

    // Project operations
    startProject: vi.fn((): Promise<void> => Promise.resolve()),
    stopProject: vi.fn((): void => undefined),
    restartProject: vi.fn((): void => undefined),
    resetTask: vi.fn((): void => undefined),
    runPrompt: vi.fn((): void => undefined),
    savePrompt: vi.fn((): Promise<void> => Promise.resolve()),
    redoLastUserPrompt: vi.fn((): void => undefined),
    resumeTask: vi.fn((): void => undefined),
    answerQuestion: vi.fn((): void => undefined),
    loadInputHistory: vi.fn((): Promise<string[]> => Promise.resolve([])),

    // Dialog operations
    isOpenDialogSupported: vi.fn((): boolean => true),
    showOpenDialog: vi.fn((): Promise<Electron.OpenDialogReturnValue> => Promise.resolve({ canceled: false, filePaths: [] })),
    getPathForFile: vi.fn((): string => '/mock/path'),

    // Open projects operations
    getOpenProjects: vi.fn((): Promise<ProjectData[]> => Promise.resolve([])),
    addOpenProject: vi.fn((): Promise<ProjectData[]> => Promise.resolve([])),
    setActiveProject: vi.fn((): Promise<ProjectData[]> => Promise.resolve([])),
    removeOpenProject: vi.fn((): Promise<ProjectData[]> => Promise.resolve([])),
    updateOpenProjectsOrder: vi.fn((): Promise<ProjectData[]> => Promise.resolve([])),

    // Model operations
    updateMainModel: vi.fn((): void => undefined),
    updateWeakModel: vi.fn((): void => undefined),
    updateArchitectModel: vi.fn((): void => undefined),
    updateEditFormats: vi.fn((): void => undefined),

    // Project settings operations
    getProjectSettings: vi.fn((): Promise<ProjectSettings> => Promise.resolve({} as ProjectSettings)),
    patchProjectSettings: vi.fn((): Promise<ProjectSettings> => Promise.resolve({} as ProjectSettings)),

    // File operations
    getFilePathSuggestions: vi.fn((): Promise<string[]> => Promise.resolve([])),
    getAddableFiles: vi.fn((): Promise<string[]> => Promise.resolve([])),
    getAllFiles: vi.fn((): Promise<string[]> => Promise.resolve([])),
    getUpdatedFiles: vi.fn((): Promise<Array<{ path: string; additions: number; deletions: number }>> => Promise.resolve([])),
    restoreFile: vi.fn((): Promise<void> => Promise.resolve()),
    generateCommitMessage: vi.fn((): Promise<string> => Promise.resolve('')),
    commitChanges: vi.fn((): Promise<void> => Promise.resolve()),
    addFile: vi.fn((): void => undefined),
    isValidPath: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    isProjectPath: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    dropFile: vi.fn((): void => undefined),
    runCommand: vi.fn((): void => undefined),
    pasteImage: vi.fn((): void => undefined),
    scrapeWeb: vi.fn((): Promise<void> => Promise.resolve()),
    initProjectRulesFile: vi.fn((): Promise<void> => Promise.resolve()),

    // Todo operations
    getTodos: vi.fn((): Promise<TodoItem[]> => Promise.resolve([])),
    addTodo: vi.fn((): Promise<TodoItem[]> => Promise.resolve([])),
    updateTodo: vi.fn((): Promise<TodoItem[]> => Promise.resolve([])),
    deleteTodo: vi.fn((): Promise<TodoItem[]> => Promise.resolve([])),
    clearAllTodos: vi.fn((): Promise<TodoItem[]> => Promise.resolve([])),

    // MCP operations
    loadMcpServerTools: vi.fn((): Promise<McpTool[] | null> => Promise.resolve([])),
    reloadMcpServers: vi.fn((): Promise<void> => Promise.resolve()),
    reloadMcpServer: vi.fn((): Promise<McpTool[]> => Promise.resolve([])),

    // Task operations
    createNewTask: vi.fn((): Promise<TaskData> => Promise.resolve({ id: 'mock-task-id' } as TaskData)),
    updateTask: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    deleteTask: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    duplicateTask: vi.fn((): Promise<TaskData> => Promise.resolve({ id: 'mock-duplicate-task-id' } as TaskData)),
    forkTask: vi.fn((): Promise<TaskData> => Promise.resolve({ id: 'mock-fork-task-id' } as TaskData)),
    getTasks: vi.fn((): Promise<TaskData[]> => Promise.resolve([])),
    loadTask: vi.fn((): Promise<TaskStateData> => Promise.resolve({} as TaskStateData)),
    exportTaskToMarkdown: vi.fn((): Promise<void> => Promise.resolve()),

    // Recent projects operations
    getRecentProjects: vi.fn((): Promise<string[]> => Promise.resolve([])),
    addRecentProject: vi.fn((): Promise<void> => Promise.resolve()),
    removeRecentProject: vi.fn((): Promise<void> => Promise.resolve()),

    // Response operations
    interruptResponse: vi.fn((): void => undefined),
    applyEdits: vi.fn((): void => undefined),
    clearContext: vi.fn((): void => undefined),
    removeLastMessage: vi.fn((): void => undefined),
    removeMessage: vi.fn((): Promise<void> => Promise.resolve()),
    removeMessagesUpTo: vi.fn((): Promise<void> => Promise.resolve()),
    compactConversation: vi.fn((): void => undefined),
    handoffConversation: vi.fn((): Promise<void> => Promise.resolve()),
    runCodeInlineRequest: vi.fn((): void => undefined),

    // UI operations
    setZoomLevel: vi.fn((): Promise<void> => Promise.resolve()),

    // Version operations
    getVersions: vi.fn((): Promise<VersionsInfo | null> => Promise.resolve(null)),
    downloadLatestAiderDesk: vi.fn((): Promise<void> => Promise.resolve()),
    getReleaseNotes: vi.fn((): Promise<string | null> => Promise.resolve(null)),
    clearReleaseNotes: vi.fn((): Promise<void> => Promise.resolve()),

    // System operations
    getOS: vi.fn((): Promise<OS> => Promise.resolve(OS.Linux)),
    queryUsageData: vi.fn((): Promise<UsageDataRow[]> => Promise.resolve([])),
    getEffectiveEnvironmentVariable: vi.fn((): Promise<EnvironmentVariable | undefined> => Promise.resolve(undefined)),

    // Voice operations
    createVoiceSession: vi.fn((): Promise<VoiceSession> => Promise.resolve({} as VoiceSession)),

    // Provider and model operations
    getProviderModels: vi.fn((): Promise<ProviderModelsData> => Promise.resolve({})),
    getProviders: vi.fn((): Promise<ProviderProfile[]> => Promise.resolve([])),
    updateProviders: vi.fn((): Promise<ProviderProfile[]> => Promise.resolve([])),
    upsertModel: vi.fn((): Promise<ProviderModelsData> => Promise.resolve({})),
    deleteModel: vi.fn((): Promise<ProviderModelsData> => Promise.resolve({})),
    updateModels: vi.fn((): Promise<ProviderModelsData> => Promise.resolve({})),

    // Event listeners - settings
    addResponseChunkListener: vi.fn(() => vi.fn()),
    addResponseCompletedListener: vi.fn(() => vi.fn()),
    addLogListener: vi.fn(() => vi.fn()),
    addContextFilesUpdatedListener: vi.fn(() => vi.fn()),
    addUpdatedFilesUpdatedListener: vi.fn(() => vi.fn()),
    addCommandsUpdatedListener: vi.fn(() => vi.fn()),
    addUpdateAutocompletionListener: vi.fn(() => vi.fn()),
    addAskQuestionListener: vi.fn(() => vi.fn()),
    addQuestionAnsweredListener: vi.fn(() => vi.fn()),
    addUpdateAiderModelsListener: vi.fn(() => vi.fn()),
    addCommandOutputListener: vi.fn(() => vi.fn()),
    addTokensInfoListener: vi.fn(() => vi.fn()),
    addToolListener: vi.fn(() => vi.fn()),
    addUserMessageListener: vi.fn(() => vi.fn()),
    addInputHistoryUpdatedListener: vi.fn(() => vi.fn()),
    addClearTaskListener: vi.fn(() => vi.fn()),
    addProjectStartedListener: vi.fn(() => vi.fn()),
    addVersionsInfoUpdatedListener: vi.fn(() => vi.fn()),
    addProviderModelsUpdatedListener: vi.fn(() => vi.fn()),
    addProvidersUpdatedListener: vi.fn(() => vi.fn()),
    addAgentProfilesUpdatedListener: vi.fn(() => vi.fn()),
    addNotificationListener: vi.fn(() => vi.fn()),
    addProjectSettingsUpdatedListener: vi.fn(() => vi.fn()),
    addWorktreeIntegrationStatusUpdatedListener: vi.fn(() => vi.fn()),
    addTerminalDataListener: vi.fn(() => vi.fn()),
    addTerminalExitListener: vi.fn(() => vi.fn()),
    addContextMenuListener: vi.fn(() => vi.fn()),
    addOpenSettingsListener: vi.fn(() => vi.fn()),
    addMessageRemovedListener: vi.fn(() => vi.fn()),

    // Task lifecycle event listeners
    addTaskCreatedListener: vi.fn(() => vi.fn()),
    addTaskInitializedListener: vi.fn(() => vi.fn()),
    addTaskUpdatedListener: vi.fn(() => vi.fn()),
    addTaskStartedListener: vi.fn(() => vi.fn()),
    addTaskCompletedListener: vi.fn(() => vi.fn()),
    addTaskCancelledListener: vi.fn(() => vi.fn()),
    addTaskDeletedListener: vi.fn(() => vi.fn()),

    // Custom commands
    getCommands: vi.fn((): Promise<CommandsData> => Promise.resolve({ baseDir: '', customCommands: [], extensionCommands: [] })),
    runCustomCommand: vi.fn((): Promise<void> => Promise.resolve()),

    // Terminal operations
    isTerminalSupported: vi.fn((): boolean => true),
    createTerminal: vi.fn((): Promise<string> => Promise.resolve('mock-terminal-id')),
    writeToTerminal: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    resizeTerminal: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    closeTerminal: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    getTerminalForTask: vi.fn((): Promise<string | null> => Promise.resolve(null)),
    getAllTerminalsForTask: vi.fn((): Promise<Array<{ id: string; taskId: string; cols: number; rows: number }>> => Promise.resolve([])),

    // Worktree merge operations
    mergeWorktreeToMain: vi.fn((): Promise<void> => Promise.resolve()),
    applyUncommittedChanges: vi.fn((): Promise<void> => Promise.resolve()),
    revertLastMerge: vi.fn((): Promise<void> => Promise.resolve()),
    listBranches: vi.fn((): Promise<BranchInfo[]> => Promise.resolve([])),
    getWorktreeIntegrationStatus: vi.fn((): Promise<WorktreeIntegrationStatus | null> => Promise.resolve(null)),
    rebaseWorktreeFromBranch: vi.fn((): Promise<void> => Promise.resolve()),
    abortWorktreeRebase: vi.fn((): Promise<void> => Promise.resolve()),
    continueWorktreeRebase: vi.fn((): Promise<void> => Promise.resolve()),
    resolveWorktreeConflictsWithAgent: vi.fn((): Promise<void> => Promise.resolve()),
    resolveConflictsWithAgent: vi.fn((): Promise<void> => Promise.resolve()),

    // Agent profile operations
    getAllAgentProfiles: vi.fn((): Promise<AgentProfile[]> => Promise.resolve([])),
    createAgentProfile: vi.fn((): Promise<AgentProfile[]> => Promise.resolve([])),
    updateAgentProfile: vi.fn((): Promise<AgentProfile[]> => Promise.resolve([])),
    deleteAgentProfile: vi.fn((): Promise<AgentProfile[]> => Promise.resolve([])),
    updateAgentProfilesOrder: vi.fn((): Promise<void> => Promise.resolve()),

    // Memory operations
    getMemoryEmbeddingProgress: vi.fn((): Promise<MemoryEmbeddingProgress> => Promise.resolve({} as MemoryEmbeddingProgress)),
    listAllMemories: vi.fn((): Promise<MemoryEntry[]> => Promise.resolve([])),
    deleteMemory: vi.fn((): Promise<boolean> => Promise.resolve(true)),
    deleteProjectMemories: vi.fn((): Promise<number> => Promise.resolve(0)),
    writeToClipboard: vi.fn((): Promise<void> => Promise.resolve()),
    openPath: vi.fn((): Promise<boolean> => Promise.resolve(true)),

    // BMAD operations
    installBmad: vi.fn((): Promise<{ success: boolean; message?: string }> => Promise.resolve({ success: false })),
    getBmadStatus: vi.fn(
      (): Promise<BmadStatus> =>
        Promise.resolve({
          projectDir: '/path/to/project',
          installed: false,
          availableWorkflows: [],
          completedWorkflows: [],
          inProgressWorkflows: [],
          incompleteWorkflows: [],
          detectedArtifacts: {},
          sprintStatus: undefined,
        }),
    ),
    addBmadStatusChangedListener: vi.fn(() => vi.fn()),
    executeWorkflow: vi.fn(() => Promise.resolve({ success: true, artifactPath: '/path/to/artifact.md' })),
    resetBmadWorkflow: vi.fn((): Promise<{ success: boolean; message?: string }> => Promise.resolve({ success: true })),
    removeQueuedPrompt: vi.fn((): void => undefined),
    sendQueuedPromptNow: vi.fn((): Promise<void> => Promise.resolve()),
    addQueuedPromptsUpdatedListener: vi.fn(() => vi.fn()),
  };

  return vi.mocked<ApplicationAPI>({ ...defaultMock, ...overrides });
};

/**
 * Global mock API instance for use in setup.ts
 */
export const globalMockApi = createMockApi();

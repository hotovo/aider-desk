import type { ElectronAPI } from '@electron-toolkit/preload';
import type {
  AutocompletionData,
  ContextFilesUpdatedData,
  CustomCommandsUpdatedData,
  InputHistoryData,
  LogData,
  ModelsData,
  ProjectData,
  ProjectSettings,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SessionData,
  SettingsData,
  TerminalData,
  TerminalExitData,
  TokensInfoData,
  UserMessageData,
  McpServerConfig,
  McpTool,
  ToolData,
  CommandOutputData,
  Mode,
  VersionsInfo,
  EditFormat,
  OS,
  ModelInfo,
  TodoItem,
  UsageDataRow,
  EnvironmentVariable,
  CustomCommand,
  ThemeName,
  Font,
} from '@common/types';

export interface ApplicationAPI {
  openLogsDirectory: () => Promise<boolean>;
  loadSettings: () => Promise<SettingsData>;
  saveSettings: (settings: SettingsData) => Promise<SettingsData>;
  saveTheme: (theme: ThemeName) => Promise<ThemeName>;
  saveFont: (font: string) => Promise<Font>;
  startProject: (baseDir: string) => void;
  stopProject: (baseDir: string) => void;
  restartProject: (baseDir: string, startupMode?: StartupMode) => void;
  runPrompt: (baseDir: string, prompt: string, mode?: Mode) => void;
  redoLastUserPrompt: (baseDir: string, mode: Mode, updatedPrompt?: string) => void;
  answerQuestion: (baseDir: string, answer: string) => void;
  loadInputHistory: (baseDir: string) => Promise<string[]>;
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogSyncOptions) => Promise<Electron.OpenDialogReturnValue>;
  };
  getPathForFile: (file: File) => string;
  getOpenProjects: () => Promise<ProjectData[]>;
  addOpenProject: (baseDir: string) => Promise<ProjectData[]>;
  setActiveProject: (baseDir: string) => Promise<ProjectData[]>;
  removeOpenProject: (baseDir: string) => Promise<ProjectData[]>;
  updateOpenProjectsOrder: (baseDirs: string[]) => Promise<ProjectData[]>;
  updateMainModel: (baseDir: string, model: string) => void;
  updateWeakModel: (baseDir: string, model: string) => void;
  updateArchitectModel: (baseDir: string, model: string) => void;
  updateEditFormats: (baseDir: string, editFormats: Record<string, EditFormat>) => void;
  getProjectSettings: (baseDir: string) => Promise<ProjectSettings>;
  patchProjectSettings: (baseDir: string, settings: Partial<ProjectSettings>) => Promise<ProjectSettings>;
  getFilePathSuggestions: (currentPath: string, directoriesOnly?: boolean) => Promise<string[]>;
  getAddableFiles: (baseDir: string) => Promise<string[]>;
  addFile: (baseDir: string, filePath: string, readOnly?: boolean) => void;
  isValidPath: (baseDir: string, path: string) => Promise<boolean>;
  isProjectPath: (path: string) => Promise<boolean>;
  dropFile: (baseDir: string, path: string) => void;
  runCommand: (baseDir: string, command: string) => void;
  pasteImage: (baseDir: string) => void;
  scrapeWeb: (baseDir: string, url: string, filePath?: string) => Promise<string>;
  initProjectRulesFile: (baseDir: string) => Promise<void>;

  // Todo operations
  getTodos: (baseDir: string) => Promise<TodoItem[]>;
  addTodo: (baseDir: string, name: string) => Promise<TodoItem[]>;
  updateTodo: (baseDir: string, name: string, updates: Partial<TodoItem>) => Promise<TodoItem[]>;
  deleteTodo: (baseDir: string, name: string) => Promise<TodoItem[]>;
  clearAllTodos: (baseDir: string) => Promise<TodoItem[]>;

  loadMcpServerTools: (serverName: string, config?: McpServerConfig) => Promise<McpTool[] | null>;
  reloadMcpServers: (mcpServers: Record<string, McpServerConfig>, force = false) => Promise<void>;

  saveSession: (baseDir: string, name: string) => Promise<boolean>;
  deleteSession: (baseDir: string, name: string) => Promise<boolean>;
  loadSessionMessages: (baseDir: string, name: string) => Promise<void>;
  loadSessionFiles: (baseDir: string, name: string) => Promise<void>;
  listSessions: (baseDir: string) => Promise<SessionData[]>;
  exportSessionToMarkdown: (baseDir: string) => Promise<void>;
  getRecentProjects: () => Promise<string[]>;
  addRecentProject: (baseDir: string) => Promise<void>;
  removeRecentProject: (baseDir: string) => Promise<void>;
  interruptResponse: (baseDir: string) => void;
  applyEdits: (baseDir: string, edits: FileEdit[]) => void;
  clearContext: (baseDir: string) => void;
  removeLastMessage: (baseDir: string) => void;
  compactConversation: (baseDir: string, mode: Mode, customInstructions?: string) => void;
  setZoomLevel: (level: number) => Promise<void>;

  getVersions: (forceRefresh?: boolean) => Promise<VersionsInfo | null>;
  downloadLatestAiderDesk: () => Promise<void>;

  getReleaseNotes: () => Promise<string | null>;
  clearReleaseNotes: () => Promise<void>;
  getOS: () => Promise<OS>;
  loadModelsInfo: () => Promise<Record<string, ModelInfo>>;
  queryUsageData: (from: string, to: string) => Promise<UsageDataRow[]>;
  getEffectiveEnvironmentVariable: (key: string, baseDir?: string) => Promise<EnvironmentVariable | undefined>;

  addResponseChunkListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: ResponseChunkData) => void) => () => void;
  addResponseCompletedListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: ResponseCompletedData) => void) => () => void;
  addLogListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: LogData) => void) => () => void;
  addContextFilesUpdatedListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: ContextFilesUpdatedData) => void) => () => void;
  addCustomCommandsUpdatedListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: CustomCommandsUpdatedData) => void) => () => void;
  addUpdateAutocompletionListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: AutocompletionData) => void) => () => void;
  addAskQuestionListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: QuestionData) => void) => () => void;
  addUpdateAiderModelsListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: ModelsData) => void) => () => void;
  addCommandOutputListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: CommandOutputData) => void) => () => void;
  addTokensInfoListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: TokensInfoData) => void) => () => void;
  addToolListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: ToolData) => void) => () => void;
  addUserMessageListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: UserMessageData) => void) => () => void;
  addInputHistoryUpdatedListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: InputHistoryData) => void) => () => void;
  addClearProjectListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, clearMessages: boolean, clearSession: boolean) => void) => () => void;
  addProjectStartedListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, baseDir: string) => void) => () => void;
  addVersionsInfoUpdatedListener: (callback: (event: Electron.IpcRendererEvent, data: VersionsInfo) => void) => () => void;
  addTerminalDataListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: TerminalData) => void) => () => void;
  addTerminalExitListener: (baseDir: string, callback: (event: Electron.IpcRendererEvent, data: TerminalExitData) => void) => () => void;
  addContextMenuListener: (callback: (event: Electron.IpcRendererEvent, params: Electron.ContextMenuParams) => void) => () => void;
  addOpenSettingsListener: (callback: (event: Electron.IpcRendererEvent, tabIndex: number) => void) => () => void;

  getCustomCommands: (baseDir: string) => Promise<CustomCommand[]>;
  runCustomCommand: (baseDir: string, commandName: string, args: string[], mode: Mode) => Promise<void>;

  // Terminal operations
  createTerminal: (baseDir: string, cols?: number, rows?: number) => Promise<string>;
  writeToTerminal: (terminalId: string, data: string) => Promise<boolean>;
  resizeTerminal: (terminalId: string, cols: number, rows: number) => Promise<boolean>;
  closeTerminal: (terminalId: string) => Promise<boolean>;
  getTerminalForProject: (baseDir: string) => Promise<string | null>;
  getAllTerminalsForProject: (baseDir: string) => Promise<Array<{ id: string; baseDir: string; cols: number; rows: number }>>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    api: ApplicationAPI;
  }
}

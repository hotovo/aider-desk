import {
  AutocompletionData,
  ClearProjectData,
  CommandOutputData,
  ContextFilesUpdatedData,
  CustomCommandsUpdatedData,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  ModelsData,
  OS,
  ProjectStartedData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  TerminalData,
  TerminalExitData,
  TokensInfoData,
  ToolData,
  UserMessageData,
  VersionsInfo,
} from '@common/types';
import { electronAPI } from '@electron-toolkit/preload';
import * as Electron from 'electron';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { ApplicationAPI } from '@common/api';
import { compareBaseDirs } from '@common/utils';

import './index.d';

const api: ApplicationAPI = {
  isOpenLogsDirectorySupported: () => true,
  openLogsDirectory: () => ipcRenderer.invoke('open-logs-directory'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  saveFont: (font) => ipcRenderer.invoke('save-font', font),
  isManageServerSupported: () => true,
  startServer: (username?: string, password?: string) => ipcRenderer.invoke('start-server', username, password),
  stopServer: () => ipcRenderer.invoke('stop-server'),
  startCloudflareTunnel: () => ipcRenderer.invoke('start-cloudflare-tunnel'),
  stopCloudflareTunnel: () => ipcRenderer.invoke('stop-cloudflare-tunnel'),
  getCloudflareTunnelStatus: () => ipcRenderer.invoke('get-cloudflare-tunnel-status'),
  startProject: (baseDir) => ipcRenderer.send('start-project', baseDir),
  stopProject: (baseDir) => ipcRenderer.send('stop-project', baseDir),
  restartProject: (baseDir, startupMode) => ipcRenderer.send('restart-project', baseDir, startupMode),
  runPrompt: (baseDir, prompt, mode) => ipcRenderer.send('run-prompt', baseDir, prompt, mode),
  redoLastUserPrompt: (baseDir, mode, updatedPrompt?) => ipcRenderer.send('redo-last-user-prompt', baseDir, mode, updatedPrompt),
  answerQuestion: (baseDir, answer) => ipcRenderer.send('answer-question', baseDir, answer),
  loadInputHistory: (baseDir) => ipcRenderer.invoke('load-input-history', baseDir),
  isOpenDialogSupported: () => true,
  showOpenDialog: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.invoke('show-open-dialog', options),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getOpenProjects: () => ipcRenderer.invoke('get-open-projects'),
  addOpenProject: (baseDir) => ipcRenderer.invoke('add-open-project', baseDir),
  setActiveProject: (baseDir) => ipcRenderer.invoke('set-active-project', baseDir),
  removeOpenProject: (baseDir) => ipcRenderer.invoke('remove-open-project', baseDir),
  updateOpenProjectsOrder: (baseDirs) => ipcRenderer.invoke('update-open-projects-order', baseDirs),
  updateMainModel: (baseDir, model) => ipcRenderer.send('update-main-model', baseDir, model),
  updateWeakModel: (baseDir, model) => ipcRenderer.send('update-weak-model', baseDir, model),
  updateArchitectModel: (baseDir, model) => ipcRenderer.send('update-architect-model', baseDir, model),
  updateEditFormats: (baseDir, editFormats) => ipcRenderer.send('update-edit-formats', baseDir, editFormats),
  getProjectSettings: (baseDir) => ipcRenderer.invoke('get-project-settings', baseDir),
  patchProjectSettings: (baseDir, settings) => ipcRenderer.invoke('patch-project-settings', baseDir, settings),
  getFilePathSuggestions: (currentPath, directoriesOnly = false) => ipcRenderer.invoke('get-file-path-suggestions', currentPath, directoriesOnly),
  getAddableFiles: (baseDir) => ipcRenderer.invoke('get-addable-files', baseDir),
  addFile: (baseDir, filePath, readOnly = false) => ipcRenderer.send('add-file', baseDir, filePath, readOnly),
  isValidPath: (baseDir, path) => ipcRenderer.invoke('is-valid-path', baseDir, path),
  isProjectPath: (path) => ipcRenderer.invoke('is-project-path', path),
  dropFile: (baseDir, path) => ipcRenderer.send('drop-file', baseDir, path),
  runCommand: (baseDir, command) => ipcRenderer.send('run-command', baseDir, command),
  pasteImage: (baseDir) => ipcRenderer.send('paste-image', baseDir),
  scrapeWeb: (baseDir, url, filePath) => ipcRenderer.invoke('scrape-web', baseDir, url, filePath),
  initProjectRulesFile: (baseDir) => ipcRenderer.invoke('init-project-rules-file', baseDir),

  getTodos: (baseDir) => ipcRenderer.invoke('get-todos', baseDir),
  addTodo: (baseDir, name) => ipcRenderer.invoke('add-todo', baseDir, name),
  updateTodo: (baseDir, name, updates) => ipcRenderer.invoke('update-todo', baseDir, name, updates),
  deleteTodo: (baseDir, name) => ipcRenderer.invoke('delete-todo', baseDir, name),
  clearAllTodos: (baseDir) => ipcRenderer.invoke('clear-all-todos', baseDir),

  loadMcpServerTools: (serverName, config?: McpServerConfig) => ipcRenderer.invoke('load-mcp-server-tools', serverName, config),
  reloadMcpServers: (mcpServers, force = false) => ipcRenderer.invoke('reload-mcp-servers', mcpServers, force),

  saveSession: (baseDir, name) => ipcRenderer.invoke('save-session', baseDir, name),
  deleteSession: (baseDir, name) => ipcRenderer.invoke('delete-session', baseDir, name),
  loadSessionMessages: (baseDir, name) => ipcRenderer.invoke('load-session-messages', baseDir, name),
  loadSessionFiles: (baseDir, name) => ipcRenderer.invoke('load-session-files', baseDir, name),
  listSessions: (baseDir) => ipcRenderer.invoke('list-sessions', baseDir),
  exportSessionToMarkdown: (baseDir) => ipcRenderer.invoke('export-session-to-markdown', baseDir),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (baseDir) => ipcRenderer.invoke('add-recent-project', baseDir),
  removeRecentProject: (baseDir) => ipcRenderer.invoke('remove-recent-project', baseDir),
  interruptResponse: (baseDir) => ipcRenderer.send('interrupt-response', baseDir),
  applyEdits: (baseDir, edits: FileEdit[]) => ipcRenderer.send('apply-edits', baseDir, edits),
  clearContext: (baseDir) => ipcRenderer.send('clear-context', baseDir),
  removeLastMessage: (baseDir) => ipcRenderer.send('remove-last-message', baseDir),
  compactConversation: (baseDir, mode, customInstructions) => ipcRenderer.invoke('compact-conversation', baseDir, mode, customInstructions),
  setZoomLevel: (level) => ipcRenderer.invoke('set-zoom-level', level),
  getVersions: (forceRefresh = false) => ipcRenderer.invoke('get-versions', forceRefresh),
  downloadLatestAiderDesk: () => ipcRenderer.invoke('download-latest-aiderdesk'),

  getReleaseNotes: () => ipcRenderer.invoke('get-release-notes'),
  clearReleaseNotes: () => ipcRenderer.invoke('clear-release-notes'),
  getOS: (): Promise<OS> => ipcRenderer.invoke('get-os'),
  loadModelsInfo: () => ipcRenderer.invoke('load-models-info'),
  queryUsageData: (from, to) => ipcRenderer.invoke('query-usage-data', from, to),
  getEffectiveEnvironmentVariable: (key: string, baseDir?: string) => ipcRenderer.invoke('get-effective-environment-variable', key, baseDir),

  addResponseChunkListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ResponseChunkData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('response-chunk', listener);
    return () => {
      ipcRenderer.removeListener('response-chunk', listener);
    };
  },

  addResponseCompletedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ResponseCompletedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('response-completed', listener);
    return () => {
      ipcRenderer.removeListener('response-completed', listener);
    };
  },

  addContextFilesUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ContextFilesUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('context-files-updated', listener);
    return () => {
      ipcRenderer.removeListener('context-files-updated', listener);
    };
  },

  addCustomCommandsUpdatedListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: CustomCommandsUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('custom-commands-updated', listener);
    return () => {
      ipcRenderer.removeListener('custom-commands-updated', listener);
    };
  },

  addUpdateAutocompletionListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: AutocompletionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-autocompletion', listener);
    return () => {
      ipcRenderer.removeListener('update-autocompletion', listener);
    };
  },

  addAskQuestionListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: QuestionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('ask-question', listener);
    return () => {
      ipcRenderer.removeListener('ask-question', listener);
    };
  },

  addUpdateAiderModelsListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ModelsData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-aider-models', listener);
    return () => {
      ipcRenderer.removeListener('update-aider-models', listener);
    };
  },

  addCommandOutputListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: CommandOutputData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('command-output', listener);
    return () => {
      ipcRenderer.removeListener('command-output', listener);
    };
  },

  addLogListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: LogData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('log', listener);
    return () => {
      ipcRenderer.removeListener('log', listener);
    };
  },

  addTokensInfoListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: TokensInfoData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('update-tokens-info', listener);
    return () => {
      ipcRenderer.removeListener('update-tokens-info', listener);
    };
  },

  addToolListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ToolData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
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

  addUserMessageListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: UserMessageData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('user-message', listener);
    return () => {
      ipcRenderer.removeListener('user-message', listener);
    };
  },

  addClearProjectListener: (baseDir, callback) => {
    const listener = (_: Electron.IpcRendererEvent, data: ClearProjectData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(data);
    };
    ipcRenderer.on('clear-project', listener);
    return () => {
      ipcRenderer.removeListener('clear-project', listener);
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

  addContextMenuListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, params: Electron.ContextMenuParams) => callback(params);
    ipcRenderer.on('context-menu', listener);
    return () => {
      ipcRenderer.removeListener('context-menu', listener);
    };
  },

  addOpenSettingsListener: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, tabIndex: number) => callback(tabIndex);
    ipcRenderer.on('open-settings', listener);
    return () => {
      ipcRenderer.removeListener('open-settings', listener);
    };
  },

  getCustomCommands: (baseDir) => ipcRenderer.invoke('get-custom-commands', baseDir),
  runCustomCommand: (baseDir, commandName, args, mode) => ipcRenderer.invoke('run-custom-command', baseDir, commandName, args, mode),

  // Terminal operations
  isTerminalSupported: () => true,
  createTerminal: (baseDir, cols, rows) => ipcRenderer.invoke('terminal-create', baseDir, cols, rows),
  writeToTerminal: (terminalId, data) => ipcRenderer.invoke('terminal-write', terminalId, data),
  resizeTerminal: (terminalId, cols, rows) => ipcRenderer.invoke('terminal-resize', terminalId, cols, rows),
  closeTerminal: (terminalId) => ipcRenderer.invoke('terminal-close', terminalId),
  getTerminalForProject: (baseDir) => ipcRenderer.invoke('terminal-get-for-project', baseDir),
  getAllTerminalsForProject: (baseDir) => ipcRenderer.invoke('terminal-get-all-for-project', baseDir),
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

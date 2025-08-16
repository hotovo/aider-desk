import {
  AutocompletionData,
  CommandOutputData,
  ContextFile,
  ContextFilesUpdatedData,
  CustomCommandsUpdatedData,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  ModelsData,
  OS,
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
import { normalizeBaseDir } from '@common/utils';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { ApplicationAPI } from './index.d';

const compareBaseDirs = (baseDir1: string, baseDir2: string): boolean => {
  return normalizeBaseDir(baseDir1) === normalizeBaseDir(baseDir2);
};

const responseChunkListeners: Record<string, (event: Electron.IpcRendererEvent, data: ResponseChunkData) => void> = {};
const responseFinishedListeners: Record<string, (event: Electron.IpcRendererEvent, data: ResponseCompletedData) => void> = {};
const contextFilesUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: { baseDir: string; files: ContextFile[] }) => void> = {};
const customCommandsUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: CustomCommandsUpdatedData) => void> = {};
const updateAutocompletionListeners: Record<string, (event: Electron.IpcRendererEvent, data: AutocompletionData) => void> = {};
const askQuestionListeners: Record<string, (event: Electron.IpcRendererEvent, data: QuestionData) => void> = {};
const updateAiderModelsListeners: Record<string, (event: Electron.IpcRendererEvent, data: ModelsData & { baseDir: string }) => void> = {};
const commandOutputListeners: Record<string, (event: Electron.IpcRendererEvent, data: CommandOutputData) => void> = {};
const logListeners: Record<string, (event: Electron.IpcRendererEvent, data: LogData) => void> = {};
const tokensInfoListeners: Record<string, (event: Electron.IpcRendererEvent, data: TokensInfoData) => void> = {};
const toolListeners: Record<string, (event: Electron.IpcRendererEvent, data: ToolData) => void> = {};
const inputHistoryUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: InputHistoryData) => void> = {};
const userMessageListeners: Record<string, (event: Electron.IpcRendererEvent, data: UserMessageData) => void> = {};
const clearProjectListeners: Record<string, (event: Electron.IpcRendererEvent, baseDir: string, clearMessages: boolean, clearSession: boolean) => void> = {};
const projectStartedListeners: Record<string, (event: Electron.IpcRendererEvent, baseDir: string) => void> = {};
const versionsInfoUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: VersionsInfo) => void> = {};
const terminalDataListeners: Record<string, (event: Electron.IpcRendererEvent, data: TerminalData) => void> = {};
const terminalExitListeners: Record<string, (event: Electron.IpcRendererEvent, data: TerminalExitData) => void> = {};

const api: ApplicationAPI = {
  addContextMenuListener: (callback) => {
    const listener = (event: Electron.IpcRendererEvent, params: Electron.ContextMenuParams) => callback(event, params);
    ipcRenderer.on('context-menu', listener);
    return () => {
      ipcRenderer.removeListener('context-menu', listener);
    };
  },
  openLogsDirectory: () => ipcRenderer.invoke('open-logs-directory'),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  saveTheme: (theme) => ipcRenderer.invoke('save-theme', theme),
  saveFont: (font) => ipcRenderer.invoke('save-font', font),
  startProject: (baseDir) => ipcRenderer.send('start-project', baseDir),
  stopProject: (baseDir) => ipcRenderer.send('stop-project', baseDir),
  restartProject: (baseDir, startupMode) => ipcRenderer.send('restart-project', baseDir, startupMode),
  runPrompt: (baseDir, prompt, mode) => ipcRenderer.send('run-prompt', baseDir, prompt, mode),
  redoLastUserPrompt: (baseDir, mode, updatedPrompt?) => ipcRenderer.send('redo-last-user-prompt', baseDir, mode, updatedPrompt),
  answerQuestion: (baseDir, answer) => ipcRenderer.send('answer-question', baseDir, answer),
  loadInputHistory: (baseDir) => ipcRenderer.invoke('load-input-history', baseDir),
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.invoke('show-open-dialog', options),
  },
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
    const listenerId = uuidv4();
    responseChunkListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ResponseChunkData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('response-chunk', responseChunkListeners[listenerId]);
    return listenerId;
  },
  removeResponseChunkListener: (listenerId) => {
    const callback = responseChunkListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('response-chunk', callback);
      delete responseChunkListeners[listenerId];
    }
  },

  addResponseCompletedListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    responseFinishedListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ResponseCompletedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('response-completed', responseFinishedListeners[listenerId]);
    return listenerId;
  },
  removeResponseCompletedListener: (listenerId) => {
    const callback = responseFinishedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('response-completed', callback);
      delete responseFinishedListeners[listenerId];
    }
  },

  addContextFilesUpdatedListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    contextFilesUpdatedListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ContextFilesUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('context-files-updated', contextFilesUpdatedListeners[listenerId]);
    return listenerId;
  },
  removeContextFilesUpdatedListener: (listenerId) => {
    const callback = contextFilesUpdatedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('context-files-updated', callback);
      delete contextFilesUpdatedListeners[listenerId];
    }
  },

  addCustomCommandsUpdatedListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    customCommandsUpdatedListeners[listenerId] = (event: Electron.IpcRendererEvent, data: CustomCommandsUpdatedData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('custom-commands-updated', customCommandsUpdatedListeners[listenerId]);
    return listenerId;
  },
  removeCustomCommandsUpdatedListener: (listenerId) => {
    const callback = customCommandsUpdatedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('custom-commands-updated', callback);
      delete customCommandsUpdatedListeners[listenerId];
    }
  },

  addUpdateAutocompletionListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    updateAutocompletionListeners[listenerId] = (event: Electron.IpcRendererEvent, data: AutocompletionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('update-autocompletion', updateAutocompletionListeners[listenerId]);
    return listenerId;
  },
  removeUpdateAutocompletionListener: (listenerId) => {
    const callback = updateAutocompletionListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('update-autocompletion', callback);
      delete updateAutocompletionListeners[listenerId];
    }
  },

  addAskQuestionListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    askQuestionListeners[listenerId] = (event: Electron.IpcRendererEvent, data: QuestionData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('ask-question', askQuestionListeners[listenerId]);
    return listenerId;
  },
  removeAskQuestionListener: (listenerId) => {
    const callback = askQuestionListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('ask-question', callback);
      delete askQuestionListeners[listenerId];
    }
  },

  addUpdateAiderModelsListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    updateAiderModelsListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ModelsData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('update-aider-models', updateAiderModelsListeners[listenerId]);
    return listenerId;
  },
  removeAiderModelsListener: (listenerId) => {
    const callback = updateAiderModelsListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('update-aider-models', callback);
      delete updateAiderModelsListeners[listenerId];
    }
  },

  addCommandOutputListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    commandOutputListeners[listenerId] = (event: Electron.IpcRendererEvent, data: CommandOutputData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('command-output', commandOutputListeners[listenerId]);
    return listenerId;
  },
  removeCommandOutputListener: (listenerId) => {
    const callback = commandOutputListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('command-output', callback);
      delete commandOutputListeners[listenerId];
    }
  },

  addLogListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    logListeners[listenerId] = (event: Electron.IpcRendererEvent, data: LogData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('log', logListeners[listenerId]);
    return listenerId;
  },
  removeLogListener: (listenerId) => {
    const callback = logListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('log', callback);
      delete logListeners[listenerId];
    }
  },

  addTokensInfoListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    tokensInfoListeners[listenerId] = (event: Electron.IpcRendererEvent, data: TokensInfoData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('update-tokens-info', tokensInfoListeners[listenerId]);
    return listenerId;
  },

  removeTokensInfoListener: (listenerId) => {
    const callback = tokensInfoListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('update-tokens-info', callback);
      delete tokensInfoListeners[listenerId];
    }
  },

  addToolListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    toolListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ToolData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('tool', toolListeners[listenerId]);
    return listenerId;
  },
  removeToolListener: (listenerId) => {
    const callback = toolListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('tool', callback);
      delete toolListeners[listenerId];
    }
  },

  addInputHistoryUpdatedListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    inputHistoryUpdatedListeners[listenerId] = (event: Electron.IpcRendererEvent, data: InputHistoryData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('input-history-updated', inputHistoryUpdatedListeners[listenerId]);
    return listenerId;
  },
  removeInputHistoryUpdatedListener: (listenerId) => {
    const callback = inputHistoryUpdatedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('input-history-updated', callback);
      delete inputHistoryUpdatedListeners[listenerId];
    }
  },

  addUserMessageListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    userMessageListeners[listenerId] = (event: Electron.IpcRendererEvent, data: UserMessageData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('user-message', userMessageListeners[listenerId]);
    return listenerId;
  },
  removeUserMessageListener: (listenerId) => {
    const callback = userMessageListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('user-message', callback);
      delete userMessageListeners[listenerId];
    }
  },

  addClearProjectListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    clearProjectListeners[listenerId] = (event: Electron.IpcRendererEvent, receivedBaseDir: string, clearMessages: boolean, clearSession: boolean) => {
      if (!compareBaseDirs(receivedBaseDir, baseDir)) {
        return;
      }
      callback(event, clearMessages, clearSession);
    };
    ipcRenderer.on('clear-project', clearProjectListeners[listenerId]);
    return listenerId;
  },
  removeClearProjectListener: (listenerId) => {
    const callback = clearProjectListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('clear-project', callback);
      delete clearProjectListeners[listenerId];
    }
  },

  addProjectStartedListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    projectStartedListeners[listenerId] = (event: Electron.IpcRendererEvent, receivedBaseDir: string) => {
      if (!compareBaseDirs(receivedBaseDir, baseDir)) {
        return;
      }
      callback(event, receivedBaseDir);
    };
    ipcRenderer.on('project-started', projectStartedListeners[listenerId]);
    return listenerId;
  },
  removeProjectStartedListener: (listenerId) => {
    const callback = projectStartedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('project-started', callback);
      delete projectStartedListeners[listenerId];
    }
  },

  addVersionsInfoUpdatedListener: (callback) => {
    const listenerId = uuidv4();
    versionsInfoUpdatedListeners[listenerId] = (event: Electron.IpcRendererEvent, data: VersionsInfo) => {
      callback(event, data);
    };
    ipcRenderer.on('versions-info-updated', versionsInfoUpdatedListeners[listenerId]);
    return listenerId;
  },
  removeVersionsInfoUpdatedListener: (listenerId) => {
    const callback = versionsInfoUpdatedListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('versions-info-updated', callback);
      delete versionsInfoUpdatedListeners[listenerId];
    }
  },

  addTerminalDataListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    terminalDataListeners[listenerId] = (event: Electron.IpcRendererEvent, data: TerminalData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('terminal-data', terminalDataListeners[listenerId]);
    return listenerId;
  },
  removeTerminalDataListener: (listenerId) => {
    const callback = terminalDataListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('terminal-data', callback);
      delete terminalDataListeners[listenerId];
    }
  },

  addTerminalExitListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    terminalExitListeners[listenerId] = (event: Electron.IpcRendererEvent, data: TerminalExitData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('terminal-exit', terminalExitListeners[listenerId]);
    return listenerId;
  },
  removeTerminalExitListener: (listenerId) => {
    const callback = terminalExitListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('terminal-exit', callback);
      delete terminalExitListeners[listenerId];
    }
  },

  getCustomCommands: (baseDir) => ipcRenderer.invoke('get-custom-commands', baseDir),
  runCustomCommand: (baseDir, commandName, args, mode) => ipcRenderer.invoke('run-custom-command', baseDir, commandName, args, mode),

  // Terminal operations
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

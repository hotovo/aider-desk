import {
  AutocompletionData,
  CommandOutputData,
  ContextFile,
  ContextFilesUpdatedData,
  FileEdit,
  InputHistoryData,
  LogData,
  McpServerConfig,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TokensInfoData,
  ToolData,
  UserMessageData,
} from '@common/types';
import { normalizeBaseDir } from '@common/utils';
import { electronAPI } from '@electron-toolkit/preload';
import { contextBridge, ipcRenderer } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { ApplicationAPI } from './index.d';

const compareBaseDirs = (baseDir1: string, baseDir2: string): boolean => {
  return normalizeBaseDir(baseDir1) === normalizeBaseDir(baseDir2);
};

const responseChunkListeners: Record<string, (event: Electron.IpcRendererEvent, data: ResponseChunkData) => void> = {};
const responseFinishedListeners: Record<string, (event: Electron.IpcRendererEvent, data: ResponseCompletedData) => void> = {};
const contextFilesUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: { baseDir: string; files: ContextFile[] }) => void> = {};
const updateAutocompletionListeners: Record<string, (event: Electron.IpcRendererEvent, data: AutocompletionData) => void> = {};
const askQuestionListeners: Record<string, (event: Electron.IpcRendererEvent, data: QuestionData) => void> = {};
const setCurrentModelsListeners: Record<string, (event: Electron.IpcRendererEvent, data: ModelsData & { baseDir: string }) => void> = {};
const commandOutputListeners: Record<string, (event: Electron.IpcRendererEvent, data: CommandOutputData) => void> = {};
const logListeners: Record<string, (event: Electron.IpcRendererEvent, data: LogData) => void> = {};
const tokensInfoListeners: Record<string, (event: Electron.IpcRendererEvent, data: TokensInfoData) => void> = {};
const toolListeners: Record<string, (event: Electron.IpcRendererEvent, data: ToolData) => void> = {};
const inputHistoryUpdatedListeners: Record<string, (event: Electron.IpcRendererEvent, data: InputHistoryData) => void> = {};
const userMessageListeners: Record<string, (event: Electron.IpcRendererEvent, data: UserMessageData) => void> = {};

const api: ApplicationAPI = {
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings: SettingsData) => ipcRenderer.invoke('save-settings', settings),
  startProject: (baseDir: string) => ipcRenderer.send('start-project', baseDir),
  stopProject: (baseDir: string) => ipcRenderer.send('stop-project', baseDir),
  restartProject: (baseDir: string) => ipcRenderer.send('restart-project', baseDir),
  runPrompt: (baseDir: string, prompt: string, editFormat?: string) => ipcRenderer.send('run-prompt', baseDir, prompt, editFormat),
  answerQuestion: (baseDir: string, answer: string) => ipcRenderer.send('answer-question', baseDir, answer),
  loadInputHistory: (baseDir: string) => ipcRenderer.invoke('load-input-history', baseDir),
  dialog: {
    showOpenDialog: (options: Electron.OpenDialogSyncOptions) => ipcRenderer.invoke('show-open-dialog', options),
  },
  getOpenProjects: () => ipcRenderer.invoke('get-open-projects'),
  addOpenProject: (baseDir: string) => ipcRenderer.invoke('add-open-project', baseDir),
  setActiveProject: (baseDir) => ipcRenderer.invoke('set-active-project', baseDir),
  removeOpenProject: (baseDir: string) => ipcRenderer.invoke('remove-open-project', baseDir),
  updateMainModel: (baseDir, model) => ipcRenderer.send('update-main-model', baseDir, model),
  updateWeakModel: (baseDir, model) => ipcRenderer.send('update-weak-model', baseDir, model),
  updateArchitectModel: (baseDir, model) => ipcRenderer.send('update-architect-model', baseDir, model),
  getProjectSettings: (baseDir) => ipcRenderer.invoke('get-project-settings', baseDir),
  saveProjectSettings: (baseDir, settings) => ipcRenderer.invoke('save-project-settings', baseDir, settings),
  getFilePathSuggestions: (currentPath: string, directoriesOnly = false) => ipcRenderer.invoke('get-file-path-suggestions', currentPath, directoriesOnly),
  getAddableFiles: (baseDir: string) => ipcRenderer.invoke('get-addable-files', baseDir),
  addFile: (baseDir: string, filePath: string, readOnly = false) => ipcRenderer.send('add-file', baseDir, filePath, readOnly),
  isValidPath: (baseDir: string, path: string) => ipcRenderer.invoke('is-valid-path', baseDir, path),
  isProjectPath: (path: string) => ipcRenderer.invoke('is-project-path', path),
  dropFile: (baseDir: string, path: string) => ipcRenderer.send('drop-file', baseDir, path),
  runCommand: (baseDir: string, command: string) => ipcRenderer.send('run-command', baseDir, command),
  scrapeWeb: (baseDir: string, url: string) => ipcRenderer.invoke('scrape-web', baseDir, url),
  loadMcpServerTools: (serverName: string, config: McpServerConfig) => ipcRenderer.invoke('load-mcp-server-tools', serverName, config),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects'),
  addRecentProject: (baseDir: string) => ipcRenderer.invoke('add-recent-project', baseDir),
  removeRecentProject: (baseDir: string) => ipcRenderer.invoke('remove-recent-project', baseDir),
  interruptResponse: (baseDir: string) => ipcRenderer.send('interrupt-response', baseDir),
  applyEdits: (baseDir: string, edits: FileEdit[]) => ipcRenderer.send('apply-edits', baseDir, edits),
  clearContext: (baseDir: string) => ipcRenderer.send('clear-context', baseDir),

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

  addSetCurrentModelsListener: (baseDir, callback) => {
    const listenerId = uuidv4();
    setCurrentModelsListeners[listenerId] = (event: Electron.IpcRendererEvent, data: ModelsData) => {
      if (!compareBaseDirs(data.baseDir, baseDir)) {
        return;
      }
      callback(event, data);
    };
    ipcRenderer.on('set-current-models', setCurrentModelsListeners[listenerId]);
    return listenerId;
  },
  removeSetCurrentModelsListener: (listenerId) => {
    const callback = setCurrentModelsListeners[listenerId];
    if (callback) {
      ipcRenderer.removeListener('set-current-models', callback);
      delete setCurrentModelsListeners[listenerId];
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
      ipcRenderer.removeListener('tool', callback);
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
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('api', api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = electronAPI;
  window.api = api;
}

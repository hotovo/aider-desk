import { ContextFileSourceType, ContextFile, TokensCost, FileEdit, UsageReportData, LogLevel, Mode, MessageRole } from '@common/types';

export type MessageAction =
  | 'init'
  | 'prompt'
  | 'prompt-finished'
  | 'response'
  | 'add-file'
  | 'drop-file'
  | 'update-autocompletion'
  | 'ask-question'
  | 'answer-question'
  | 'set-models'
  | 'update-context-files'
  | 'use-command-output'
  | 'run-command'
  | 'tokens-info'
  | 'add-message'
  | 'interrupt-response'
  | 'apply-edits';

export interface Message {
  action: MessageAction;
}

export interface LogMessage {
  message: string;
  level: LogLevel;
}

export interface InitMessage {
  action: 'init';
  baseDir: string;
  contextFiles?: ContextFile[];
  listenTo?: MessageAction[];
  inputHistoryFile?: string;
}

export const isInitMessage = (message: Message): message is InitMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'init';
};

export interface PromptMessage extends Message {
  action: 'prompt';
  prompt: string;
  mode: Mode | null;
  architectModel: string | null;
  promptId?: string | null;
  clearContext?: boolean;
}

export interface ResponseMessage extends Message {
  id?: string | null;
  action: 'response';
  content: string;
  reflectedMessage?: string;
  finished: boolean;
  usageReport?: string | UsageReportData;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
}

export const isResponseMessage = (message: Message): message is ResponseMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'response';
};

export interface AddFileMessage extends Message {
  action: 'add-file';
  path: string;
  sourceType?: ContextFileSourceType;
  readOnly?: boolean;
}

export const isAddFileMessage = (message: Message): message is AddFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'add-file';
};

export interface DropFileMessage extends Message {
  action: 'drop-file';
  path: string;
  readOnly?: boolean;
}

export const isDropFileMessage = (message: Message): message is DropFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'drop-file';
};

export interface RunCommandMessage extends Message {
  action: 'run-command';
  command: string;
}

export interface UpdateAutocompletionMessage extends Message {
  action: 'update-autocompletion';
  words: string[];
  allFiles: string[];
  models: string[];
}

export const isUpdateAutocompletionMessage = (message: Message): message is UpdateAutocompletionMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'update-autocompletion';
};

export interface AskQuestionMessage extends Message {
  action: 'ask-question';
  question: string;
  subject?: string;
  defaultAnswer: string;
}

export const isAskQuestionMessage = (message: Message): message is AskQuestionMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'ask-question';
};

export interface AnswerQuestionMessage extends Message {
  action: 'answer-question';
  answer: string;
}

export interface SetModelsMessage extends Message {
  action: 'set-models';
  mainModel: string;
  weakModel?: string | null;
  maxChatHistoryTokens?: number;
  info?: Record<string, unknown>;
  hasError?: boolean;
}

export const isSetModelsMessage = (message: Message): message is SetModelsMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'set-models';
};

export interface UpdateContextFilesMessage extends Message {
  action: 'update-context-files';
  files: ContextFile[];
}

export const isUpdateContextFilesMessage = (message: Message): message is UpdateContextFilesMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'update-context-files';
};

export interface UseCommandOutputMessage extends Message {
  action: 'use-command-output';
  command: string;
  finished: boolean;
}

export const isUseCommandOutputMessage = (message: Message): message is UseCommandOutputMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'use-command-output';
};

export interface TokensInfoMessage extends Message {
  action: 'tokens-info';
  info: {
    files: Record<string, TokensCost>;
    systemMessages: TokensCost;
    chatHistory: TokensCost;
    repoMap: TokensCost;
  };
}

export const isTokensInfoMessage = (message: Message): message is TokensInfoMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'tokens-info';
};

export interface AddMessageMessage extends Message {
  action: 'add-message';
  content: string;
  role: MessageRole;
  acknowledge: boolean;
}

export interface InterruptResponseMessage extends Message {
  action: 'interrupt-response';
}

export interface PromptFinishedMessage extends Message {
  action: 'prompt-finished';
  promptId: string;
}

export const isPromptFinishedMessage = (message: Message): message is PromptFinishedMessage => {
  return message.action === 'prompt-finished';
};

export interface ApplyEditsMessage extends Message {
  action: 'apply-edits';
  edits: FileEdit[];
}

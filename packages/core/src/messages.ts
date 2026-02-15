import {
  AiderRunOptions,
  ContextFile,
  ContextFileSourceType,
  EditFormat,
  FileEdit,
  LogLevel,
  MessageRole,
  Mode,
  ModelInfo,
  PromptContext,
  RawModelInfo,
  TokensCost,
  UsageReportData,
} from '@aider-desk/common/types';

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
  | 'apply-edits'
  | 'compact-conversation'
  | 'update-repo-map'
  | 'update-env-vars'
  | 'request-context-info'
  | 'subscribe-events'
  | 'unsubscribe-events'
  | 'update-models-info';

export interface Message {
  action: MessageAction;
}

export interface LogMessage {
  message: string;
  level: LogLevel;
  finished?: boolean;
  promptContext?: PromptContext;
}

export interface InitMessage {
  action: 'init';
  baseDir: string;
  taskId?: string;
  source?: string;
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
  promptContext: PromptContext;
  messages?: { role: MessageRole; content: string }[];
  files?: ContextFile[];
  options?: AiderRunOptions;
}

export interface ResponseMessage extends Message {
  id: string;
  action: 'response';
  content: string;
  reflectedMessage?: string;
  finished: boolean;
  usageReport?: string | UsageReportData;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
  sequenceNumber?: number;
  promptContext?: PromptContext;
}

export const isResponseMessage = (message: Message): message is ResponseMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'response';
};

export interface AddFileMessage extends Message {
  action: 'add-file';
  path: string;
  sourceType?: ContextFileSourceType;
  readOnly?: boolean;
  noUpdate?: boolean;
}

export const isAddFileMessage = (message: Message): message is AddFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'add-file';
};

export interface DropFileMessage extends Message {
  action: 'drop-file';
  path: string;
  readOnly?: boolean;
  noUpdate?: boolean;
}

export const isDropFileMessage = (message: Message): message is DropFileMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'drop-file';
};

export interface RunCommandMessage extends Message {
  action: 'run-command';
  command: string;
  messages?: { role: MessageRole; content: string }[];
  files?: ContextFile[];
}

export interface UpdateAutocompletionMessage extends Message {
  action: 'update-autocompletion';
  words: string[];
}

export const isUpdateAutocompletionMessage = (message: Message): message is UpdateAutocompletionMessage => {
  return typeof message === 'object' && message !== null && 'action' in message && message.action === 'update-autocompletion';
};

export interface AskQuestionMessage extends Message {
  action: 'ask-question';
  question: string;
  subject?: string;
  defaultAnswer: string;
  isGroupQuestion?: boolean;
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
  editFormat?: EditFormat;
  environmentVariables?: Record<string, string>;
  info?: RawModelInfo;
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
  addToContext?: boolean;
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
  usageReport?: UsageReportData;
}

export const isAddMessageMessage = (message: Message): message is AddMessageMessage => {
  return message.action === 'add-message';
};

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

export interface CompactConversationMessage extends Message {
  action: 'compact-conversation';
  customInstructions?: string;
}

export interface UpdateRepoMapMessage extends Message {
  action: 'update-repo-map';
  repoMap: string;
}

export const isUpdateRepoMapMessage = (message: Message): message is UpdateRepoMapMessage => {
  return message.action === 'update-repo-map';
};

export interface UpdateEnvVarsMessage extends Message {
  action: 'update-env-vars';
  environmentVariables: Record<string, unknown>;
}

export const isUpdateEnvVarsMessage = (message: Message): message is UpdateEnvVarsMessage => {
  return message.action === 'update-env-vars';
};

export interface UpdateModelsInfoMessage extends Message {
  action: 'update-models-info';
  modelsInfo: Record<string, ModelInfo>;
}

export const isUpdateModelsInfoMessage = (message: Message): message is UpdateModelsInfoMessage => {
  return message.action === 'update-models-info';
};

export interface RequestContextInfoMessage extends Message {
  action: 'request-context-info';
  messages?: { role: MessageRole; content: string }[];
  files?: ContextFile[];
}

export const isRequestContextInfoMessage = (message: Message): message is RequestContextInfoMessage => {
  return message.action === 'request-context-info';
};

export interface SubscribeEventsMessage extends Message {
  action: 'subscribe-events';
  eventTypes?: string[];
  baseDirs?: string[];
}

export const isSubscribeEventsMessage = (message: Message): message is SubscribeEventsMessage => {
  return message.action === 'subscribe-events';
};

export interface UnsubscribeEventsMessage extends Message {
  action: 'unsubscribe-events';
}

export const isUnsubscribeEventsMessage = (message: Message): message is UnsubscribeEventsMessage => {
  return message.action === 'unsubscribe-events';
};

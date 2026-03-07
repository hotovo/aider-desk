import { Group, PromptContext, TaskData, TokensInfoData, UsageReportData } from '@common/types';

export interface Message {
  id: string;
  type: 'user' | 'response' | 'loading' | 'reflected-message' | 'command-output' | 'log' | 'tokens-info' | 'tool' | 'group' | 'task-info' | 'assistant-group';
  content: string;
  promptContext?: PromptContext;
  children?: Message[];
}

export interface UserMessage extends Message {
  type: 'user';
  isOptimistic?: boolean;
}

export interface ResponseMessage extends Message {
  type: 'response';
  usageReport?: UsageReportData;
}

export interface ReflectedMessage extends Message {
  type: 'reflected-message';
  responseMessageId: string;
}

export interface LogMessage extends Message {
  type: 'log';
  level: 'info' | 'warning' | 'error';
  actionIds?: string[];
}

export interface LoadingMessage extends Message {
  type: 'loading';
  actionIds?: string[];
}

export interface CommandOutputMessage extends Message {
  type: 'command-output';
  command: string;
}

export interface TokensInfoMessage extends Message {
  type: 'tokens-info';
  info: TokensInfoData;
}

export interface ToolMessage extends Message {
  type: 'tool';
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  content: string; // Empty while executing, contains result when complete
  usageReport?: UsageReportData;
  finished?: boolean;
}

export const isUserMessage = (message: Message): message is UserMessage => {
  return message.type === 'user';
};

export const isResponseMessage = (message: Message): message is ResponseMessage => {
  return message.type === 'response';
};

export const isLogMessage = (message: Message): message is LogMessage => {
  return message.type === 'log';
};

export const isLoadingMessage = (message: Message): message is LoadingMessage => {
  return message.type === 'loading';
};

export const isReflectedMessage = (message: Message): message is ReflectedMessage => {
  return message.type === 'reflected-message';
};

export const isCommandOutputMessage = (message: Message): message is CommandOutputMessage => {
  return message.type === 'command-output';
};

export const isTokensInfoMessage = (message: Message): message is TokensInfoMessage => {
  return message.type === 'tokens-info';
};

export const isToolMessage = (message: Message): message is ToolMessage => {
  return message.type === 'tool';
};

export interface GroupMessage extends Message {
  type: 'group';
  group: Group;
  children: Message[];
}

export const isGroupMessage = (message: Message): message is GroupMessage => {
  return message.type === 'group';
};

export interface TaskInfoMessage extends Message {
  type: 'task-info';
  task: TaskData;
  messageCount: number;
}

export const isTaskInfoMessage = (message: Message): message is TaskInfoMessage => {
  return message.type === 'task-info';
};

export interface AssistantGroupMessage extends Message {
  type: 'assistant-group';
  responseMessage: ResponseMessage;
  toolMessages: ToolMessage[];
}

export const isAssistantGroupMessage = (message: Message): message is AssistantGroupMessage => {
  return message.type === 'assistant-group';
};

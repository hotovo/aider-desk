import { v4 as uuidv4 } from 'uuid';
import { TODO_TOOL_GROUP_NAME } from '@common/tools';
import {
  LogData,
  LogMessage,
  Message,
  ReflectedMessage,
  ResponseCompletedData,
  ResponseMessage,
  TaskStateData,
  ToolData,
  ToolMessage,
  UserMessage,
  UserMessageData,
} from '@common/types';

const convertUserMessage = (data: UserMessageData): UserMessage => ({
  id: data.id,
  type: 'user',
  content: data.content,
  images: data.images,
  promptContext: data.promptContext,
  timestamp: data.timestamp,
});

const convertResponse = (data: ResponseCompletedData): Message[] => {
  const messages: Message[] = [];
  if (data.reflectedMessage) {
    const reflected: ReflectedMessage = {
      id: uuidv4(),
      type: 'reflected-message',
      content: data.reflectedMessage,
      responseMessageId: data.messageId,
      promptContext: data.promptContext,
      timestamp: data.timestamp,
    };
    messages.push(reflected);
  }

  const response: ResponseMessage = {
    id: data.messageId,
    type: 'response',
    content: data.content,
    reasoning: data.reasoning,
    usageReport: data.usageReport,
    promptContext: data.promptContext,
    finished: true,
    timestamp: data.timestamp,
  };
  messages.push(response);
  return messages;
};

const convertLog = (data: LogData): LogMessage => ({
  id: data.id ?? uuidv4(),
  type: 'log',
  level: data.level as 'info' | 'warning' | 'error',
  content: data.message ?? '',
  promptContext: data.promptContext,
  actions: data.actions,
  timestamp: data.timestamp,
});

const convertTool = (data: ToolData): ToolMessage => ({
  id: data.id,
  type: 'tool',
  serverName: data.serverName,
  toolName: data.toolName,
  args: (data.args as Record<string, unknown> | undefined) ?? {},
  content: data.response ?? '',
  usageReport: data.usageReport,
  promptContext: data.promptContext,
  finished: data.finished,
  timestamp: data.timestamp,
});

export const convertTaskStateMessages = (messages: TaskStateData['messages']): Message[] => {
  return messages.flatMap((message) => {
    if ('level' in message) {
      return [convertLog(message)];
    }
    if (message.type === 'user') {
      return [convertUserMessage(message)];
    }
    if (message.type === 'response-completed') {
      return convertResponse(message);
    }
    if (message.serverName === TODO_TOOL_GROUP_NAME) {
      return [];
    }
    return [convertTool(message)];
  });
};

export const mergeTaskMessages = (snapshot: Message[], live: Message[]): Message[] => {
  const snapshotIds = new Set(snapshot.map((message) => message.id));
  return [...snapshot, ...live.filter((message) => !snapshotIds.has(message.id))];
};

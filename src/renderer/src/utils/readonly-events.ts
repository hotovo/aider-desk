import { ResponseChunkData, ResponseCompletedData, TaskCreatedData, TaskData, TaskStateData, ToolData, UserMessageData } from '@common/types';

import type { ReadonlyEvent } from '@/api/readonly-browser-api';

const taskListEventTypes = new Set(['task-created', 'task-updated', 'task-started', 'task-completed', 'task-cancelled', 'task-deleted']);

const upsertMessage = (state: TaskStateData, id: string, message: TaskStateData['messages'][number]): TaskStateData => {
  const index = state.messages.findIndex((item) => ('id' in item ? item.id === id : item.messageId === id));
  if (index === -1) {
    return { ...state, messages: [...state.messages, message] };
  }
  const messages = [...state.messages];
  messages[index] = message;
  return { ...state, messages };
};

const upsertTask = (tasks: TaskData[], task: TaskData): TaskData[] => {
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) {
    return [task, ...tasks];
  }
  const updatedTasks = [...tasks];
  updatedTasks[index] = task;
  return updatedTasks;
};

export const isReadonlyTaskListEvent = (event: ReadonlyEvent): boolean => taskListEventTypes.has(event.type);

export const applyReadonlyTaskListEvent = (tasks: TaskData[], event: ReadonlyEvent): TaskData[] => {
  if (event.type === 'task-created') {
    const { task } = event.data as TaskCreatedData;
    return upsertTask(tasks, task);
  }
  if (event.type === 'task-updated' || event.type === 'task-started' || event.type === 'task-completed' || event.type === 'task-cancelled') {
    return upsertTask(tasks, event.data as TaskData);
  }
  if (event.type === 'task-deleted') {
    const task = event.data as TaskData;
    return tasks.filter((item) => item.id !== task.id);
  }
  return tasks;
};

export const applyReadonlyEvent = (state: TaskStateData, event: ReadonlyEvent, taskId: string): TaskStateData => {
  const eventData = event.data as { taskId?: string };
  if (eventData.taskId !== taskId) {
    return state;
  }

  if (event.type === 'user-message') {
    const message = event.data as UserMessageData;
    return upsertMessage(state, message.id, message);
  }
  if (event.type === 'tool') {
    const message = event.data as ToolData;
    return upsertMessage(state, message.id, message);
  }
  if (event.type === 'response-completed') {
    const message = event.data as ResponseCompletedData;
    return upsertMessage(state, message.messageId, message);
  }
  if (event.type === 'response-chunk') {
    const chunk = event.data as ResponseChunkData;
    const existing = state.messages.find(
      (message): message is ResponseCompletedData => message.type === 'response-completed' && message.messageId === chunk.messageId,
    );
    const message: ResponseCompletedData = {
      type: 'response-completed',
      messageId: chunk.messageId,
      baseDir: chunk.baseDir,
      taskId: chunk.taskId,
      content: `${existing?.content ?? ''}${chunk.chunk}`,
      reasoning: chunk.reasoning ? `${existing?.reasoning ?? ''}${chunk.reasoning}` : existing?.reasoning,
      reflectedMessage: chunk.reflectedMessage ?? existing?.reflectedMessage,
      promptContext: chunk.promptContext ?? existing?.promptContext,
    };
    return upsertMessage(state, chunk.messageId, message);
  }
  if (event.type === 'message-removed') {
    const data = event.data as { messageIds?: string[] };
    const ids = new Set(data.messageIds ?? []);
    return { ...state, messages: state.messages.filter((message) => !ids.has('id' in message ? message.id : message.messageId)) };
  }
  if (event.type === 'clear-task') {
    const data = event.data as { clearMessages?: boolean };
    return data.clearMessages ? { ...state, messages: [] } : state;
  }

  return state;
};

import { useShallow } from 'zustand/react/shallow';
import { ContextFile, ModelsData, QueuedPromptData, QuestionData, TodoItem, TokensInfoData } from '@common/types';
import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import { Message } from '@/types/message';

export interface TaskState {
  loading: boolean;
  loaded: boolean;
  tokensInfo: TokensInfoData | null;
  question: QuestionData | null;
  todoItems: TodoItem[];
  allFiles: string[];
  autocompletionWords: string[];
  contextFiles: ContextFile[];
  aiderModelsData: ModelsData | null;
  lastActiveAt: Date | null;
  queuedPrompts: QueuedPromptData[];
}

export const EMPTY_TASK_STATE: TaskState = {
  loading: false,
  loaded: false,
  tokensInfo: null,
  question: null,
  todoItems: [],
  allFiles: [],
  autocompletionWords: [],
  contextFiles: [],
  aiderModelsData: null,
  lastActiveAt: null,
  queuedPrompts: [],
};

export const EMPTY_MESSAGES: Message[] = [];

const taskPendingMessages = new Map<string, Message[]>();

interface TaskStore {
  taskStateMap: Map<string, TaskState>;
  taskMessagesMap: Map<string, Message[]>;

  updateTaskState: (taskId: string, updates: Partial<TaskState>) => void;
  setMessages: (taskId: string, updateMessages: (prev: Message[]) => Message[]) => void;
  setTodoItems: (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => void;
  setAllFiles: (taskId: string, allFiles: string[]) => void;
  setAutocompletionWords: (taskId: string, autocompletionWords: string[]) => void;
  setTokensInfo: (taskId: string, tokensInfo: TokensInfoData | null) => void;
  setQuestion: (taskId: string, question: QuestionData | null) => void;
  setAiderModelsData: (taskId: string, modelsData: ModelsData | null) => void;
  setQueuedPrompts: (taskId: string, queuedPrompts: QueuedPromptData[]) => void;
  clearSession: (taskId: string, messagesOnly: boolean) => void;
}

export const useTaskStore = createWithEqualityFn<TaskStore>(
  (set, get) => ({
    taskStateMap: new Map(),
    taskMessagesMap: new Map(),

    updateTaskState: (taskId, updates) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, ...updates });
        return { taskStateMap: newMap };
      }),

    setMessages: (taskId, updateMessages) => {
      const pendingMessages = taskPendingMessages.get(taskId);
      taskPendingMessages.set(taskId, updateMessages(pendingMessages || get().taskMessagesMap.get(taskId) || []));

      if (pendingMessages) {
        // we are already in a pending state, no need to update
        return;
      }
      requestAnimationFrame(() => {
        set((state) => {
          if (!taskPendingMessages.has(taskId)) {
            return state;
          }

          const newMessagesMap = new Map(state.taskMessagesMap);
          newMessagesMap.set(taskId, taskPendingMessages.get(taskId) || []);
          taskPendingMessages.delete(taskId);
          return { taskMessagesMap: newMessagesMap };
        });
      });
    },

    setTodoItems: (taskId, updateTodoItems) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, {
          ...current,
          todoItems: updateTodoItems(current.todoItems),
        });
        return { taskStateMap: newMap };
      }),

    setAllFiles: (taskId, allFiles) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, allFiles });
        return { taskStateMap: newMap };
      }),

    setAutocompletionWords: (taskId, autocompletionWords) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, autocompletionWords });
        return { taskStateMap: newMap };
      }),

    setTokensInfo: (taskId, tokensInfo) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, tokensInfo });
        return { taskStateMap: newMap };
      }),

    setQuestion: (taskId, question) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, question });
        return { taskStateMap: newMap };
      }),

    setAiderModelsData: (taskId, modelsData) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, aiderModelsData: modelsData });
        return { taskStateMap: newMap };
      }),

    setQueuedPrompts: (taskId, queuedPrompts) =>
      set((state) => {
        const newMap = new Map(state.taskStateMap);
        const current = newMap.get(taskId) || EMPTY_TASK_STATE;
        newMap.set(taskId, { ...current, queuedPrompts });
        return { taskStateMap: newMap };
      }),

    clearSession: (taskId, messagesOnly) =>
      set((state) => {
        const newStateMap = new Map(state.taskStateMap);
        const newMessagesMap = new Map(state.taskMessagesMap);
        const current = newStateMap.get(taskId) || EMPTY_TASK_STATE;
        const update: Partial<TaskState> = {};
        if (!messagesOnly) {
          update.tokensInfo = null;
          update.question = null;
        }
        newStateMap.set(taskId, { ...current, ...update });
        newMessagesMap.set(taskId, []);
        return { taskStateMap: newStateMap, taskMessagesMap: newMessagesMap };
      }),
  }),
  shallow,
);

export const useTaskState = (taskId: string) => useTaskStore(useShallow((state) => state.taskStateMap.get(taskId) || EMPTY_TASK_STATE));

export const useTaskMessages = (taskId: string) => useTaskStore(useShallow((state) => state.taskMessagesMap.get(taskId) || EMPTY_MESSAGES));

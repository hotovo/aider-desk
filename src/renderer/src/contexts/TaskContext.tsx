import React, { createContext, memo, ReactNode, useContext, useEffect, useMemo } from 'react';
import { usePrevious } from '@reactuses/core';
import { DefaultTaskState, TaskData, TodoItem, ModelsData } from '@common/types';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import { isLoadingMessage, Message } from '@/types/message';
import { useTaskStore } from '@/stores/taskStore';
import { useTaskResponseHandlers } from '@/hooks/useTaskResponseHandlers';
import { useTaskToolHandlers } from '@/hooks/useTaskToolHandlers';
import { useTaskLogHandlers } from '@/hooks/useTaskLogHandlers';
import { useTaskCommandHandlers } from '@/hooks/useTaskCommandHandlers';
import { useTaskDataHandlers } from '@/hooks/useTaskDataHandlers';
import { useTaskMessageHandlers } from '@/hooks/useTaskMessageHandlers';
import { useTaskLifecycleHandlers } from '@/hooks/useTaskLifecycleHandlers';
import { useTaskActions } from '@/hooks/useTaskActions';

interface TaskEventSubscriberProps {
  baseDir: string;
  taskId: string;
  state?: string;
}

const TaskEventSubscriber = memo(function TaskEventSubscriber({ baseDir, taskId, state }: TaskEventSubscriberProps) {
  const previousState = usePrevious(state);
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  useEffect(() => {
    if (previousState === DefaultTaskState.InProgress && state !== DefaultTaskState.InProgress) {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
    }
  }, [previousState, setMessages, state, taskId]);

  useTaskResponseHandlers(baseDir, taskId);
  useTaskToolHandlers(baseDir, taskId);
  useTaskLogHandlers(baseDir, taskId);
  useTaskCommandHandlers(baseDir, taskId);
  useTaskDataHandlers(baseDir, taskId);
  useTaskMessageHandlers(baseDir, taskId);
  useTaskLifecycleHandlers(baseDir, taskId);

  return null;
});

TaskEventSubscriber.displayName = 'TaskEventSubscriber';

export interface TaskContextType {
  loadTask: (taskId: string) => void;
  clearSession: (taskId: string, messagesOnly: boolean) => void;
  resetTask: (taskId: string) => void;
  setMessages: (taskId: string, updateMessages: (prevState: Message[]) => Message[]) => void;
  setTodoItems: (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => void;
  setAiderModelsData: (taskId: string, modelsData: ModelsData | null) => void;
  answerQuestion: (taskId: string, answer: string) => void;
  interruptResponse: (taskId: string) => void;
  updateTaskAgentProfile: (taskId: string, agentProfileId: string, provider: string, model: string) => void;
  refreshAllFiles: (taskId: string, useGit?: boolean) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export const TaskProvider: React.FC<{ baseDir: string; tasks: TaskData[]; children: ReactNode }> = ({ baseDir, tasks, children }) => {
  const setTodoItems = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setTodoItems, shallow);
  const setAiderModelsData = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setAiderModelsData, shallow);
  const setMessages = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.setMessages, shallow);

  const taskActions = useTaskActions({ baseDir });

  const contextValue = useMemo(
    () => ({
      ...taskActions,
      setTodoItems,
      setMessages,
      setAiderModelsData,
    }),
    [taskActions, setTodoItems, setMessages, setAiderModelsData],
  );

  return (
    <TaskContext.Provider value={contextValue}>
      {tasks.map((task) => (
        <TaskEventSubscriber key={task.id} baseDir={baseDir} taskId={task.id} state={task.state} />
      ))}
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (context === null) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

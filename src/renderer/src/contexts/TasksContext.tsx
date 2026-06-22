import { createContext, memo, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { usePrevious } from '@reactuses/core';
import { DefaultTaskState, TaskData, TodoItem, ModelsData, isLoadingMessage, Message } from '@common/types';

import { setMessages, setTodoItems, setAiderModelsData, updateTaskState, unloadTask, useTaskStore, useTaskLoaded } from '@/stores/taskStore';
import { useProjectStore } from '@/stores/projectStore';
import { cleanupTaskCache } from '@/stores/extensionUIStore';
import { cleanupProcessingResponseMessage, useTaskResponseHandlers } from '@/hooks/useTaskResponseHandlers';
import { useTaskToolHandlers } from '@/hooks/useTaskToolHandlers';
import { useTaskLogHandlers } from '@/hooks/useTaskLogHandlers';
import { useTaskCommandHandlers } from '@/hooks/useTaskCommandHandlers';
import { useTaskDataHandlers } from '@/hooks/useTaskDataHandlers';
import { useTaskMessageHandlers } from '@/hooks/useTaskMessageHandlers';
import { useTaskLifecycleHandlers } from '@/hooks/useTaskLifecycleHandlers';
import { useTaskActions } from '@/hooks/useTaskActions';

const TASK_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const INACTIVITY_CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

interface TaskEventSubscriberProps {
  baseDir: string;
  taskId: string;
  state?: string;
}

const TaskEventSubscriber = memo(function TaskEventSubscriber({ baseDir, taskId, state }: TaskEventSubscriberProps) {
  const previousState = usePrevious(state);

  useEffect(() => {
    if (previousState === DefaultTaskState.InProgress && state !== DefaultTaskState.InProgress) {
      setMessages(taskId, (prevMessages) => prevMessages.filter((message) => !isLoadingMessage(message)));
    }
  }, [previousState, state, taskId]);

  useTaskResponseHandlers(baseDir, taskId);
  useTaskToolHandlers(baseDir, taskId);
  useTaskLogHandlers(baseDir, taskId);
  useTaskCommandHandlers(baseDir, taskId);
  useTaskDataHandlers(baseDir, taskId);
  useTaskMessageHandlers(baseDir, taskId);
  useTaskLifecycleHandlers(baseDir, taskId);

  return null;
});

const TaskEventSubscriberWrapper = memo(function TaskEventSubscriberWrapper({
  baseDir,
  taskId,
  state,
  isActive,
}: {
  baseDir: string;
  taskId: string;
  state?: string;
  isActive: boolean;
}) {
  const loaded = useTaskLoaded(taskId);
  const inProgress = state === DefaultTaskState.InProgress;

  if (!isActive && !inProgress && !loaded) {
    return null;
  }

  return <TaskEventSubscriber baseDir={baseDir} taskId={taskId} state={state} />;
});

TaskEventSubscriberWrapper.displayName = 'TaskEventSubscriberWrapper';

export interface TaskContextType {
  loadTask: (taskId: string) => void;
  clearSession: (taskId: string, messagesOnly: boolean) => void;
  resetTask: (taskId: string) => void;
  restartAiderConnector: (taskId: string) => void;
  setMessages: (taskId: string, updateMessages: (prevState: Message[]) => Message[]) => void;
  setTodoItems: (taskId: string, updateTodoItems: (prev: TodoItem[]) => TodoItem[]) => void;
  setAiderModelsData: (taskId: string, modelsData: ModelsData | null) => void;
  answerQuestion: (taskId: string, answer: string) => void;
  interruptResponse: (taskId: string, interruptId?: string) => void;
  updateTaskAgentProfile: (taskId: string, agentProfileId: string, provider: string, model: string) => void;
  refreshAllFiles: (taskId: string, useGit?: boolean) => Promise<void>;
  markTaskActive: (taskId: string) => void;
}

const TasksContext = createContext<TaskContextType | null>(null);

export const TasksProvider = ({
  baseDir,
  tasks,
  activeTaskId,
  children,
}: {
  baseDir: string;
  tasks: TaskData[];
  activeTaskId?: string | null;
  children: ReactNode;
}) => {
  const taskActions = useTaskActions({ baseDir });
  const inactivityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const markTaskActive = useCallback((taskId: string) => {
    const state = useTaskStore.getState().taskStateMap.get(taskId);
    if (!state?.loaded) {
      return;
    }

    updateTaskState(taskId, { lastActiveAt: new Date() });
  }, []);

  const checkAndUnloadInactiveTasks = useCallback(() => {
    const now = Date.now();
    const taskStateMap = useTaskStore.getState().taskStateMap;

    for (const [taskId, state] of taskStateMap) {
      if (!state.loaded || !state.lastActiveAt) {
        continue;
      }

      if (taskId === activeTaskId) {
        continue;
      }

      const projectTasks = useProjectStore.getState().projectTasksMap.get(baseDir) || [];
      const task = projectTasks.find((t) => t.id === taskId);
      if (task?.state === DefaultTaskState.InProgress) {
        continue;
      }

      const inactiveTime = now - state.lastActiveAt.getTime();
      if (inactiveTime >= TASK_INACTIVITY_TIMEOUT_MS) {
        unloadTask(taskId);
        cleanupTaskCache(baseDir, taskId);
        cleanupProcessingResponseMessage(taskId);
      }
    }
  }, [baseDir, activeTaskId]);

  useEffect(() => {
    inactivityCheckIntervalRef.current = setInterval(checkAndUnloadInactiveTasks, INACTIVITY_CHECK_INTERVAL_MS);

    return () => {
      if (inactivityCheckIntervalRef.current) {
        clearInterval(inactivityCheckIntervalRef.current);
        inactivityCheckIntervalRef.current = null;
      }
    };
  }, [checkAndUnloadInactiveTasks]);

  const contextValue = useMemo(
    () => ({
      ...taskActions,
      setTodoItems,
      setMessages,
      setAiderModelsData,
      markTaskActive,
    }),
    [taskActions, markTaskActive],
  );

  return (
    <TasksContext.Provider value={contextValue}>
      {tasks.map((task) => (
        <TaskEventSubscriberWrapper key={task.id} baseDir={baseDir} taskId={task.id} state={task.state} isActive={task.id === activeTaskId} />
      ))}
      {children}
    </TasksContext.Provider>
  );
};

export const useTask = (): TaskContextType => {
  const context = useContext(TasksContext);
  if (context === null) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

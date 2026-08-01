import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message, TaskData, TaskStateData } from '@common/types';

import { ReadonlyTaskSidebar } from '@/components/readonly/ReadonlyTaskSidebar';
import { ReadonlyTaskView } from '@/components/readonly/ReadonlyTaskView';
import { LoadingOverlay } from '@/components/common/LoadingOverlay';
import { ExtensionsProvider } from '@/contexts/ExtensionsContext';
import { useReadonlyApi } from '@/contexts/ReadonlyApiContext';
import { convertTaskStateMessages } from '@/utils/task-messages';
import { useResponsive } from '@/hooks/useResponsive';
import { useBooleanState } from '@/hooks/useBooleanState';
import { applyReadonlyEvent, applyReadonlyLogEvent, applyReadonlyTaskListEvent, isReadonlyTaskListEvent } from '@/utils/readonly-events';

type Props = {
  projectDir: string;
  selectedTaskId?: string;
  onSelectTask: (taskId: string) => void;
};

export const ReadonlyProjectView = ({ projectDir, selectedTaskId, onSelectTask }: Props) => {
  const api = useReadonlyApi();
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const [isTaskSidebarOpen, showTaskSidebar, hideTaskSidebar] = useBooleanState();
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [taskState, setTaskState] = useState<TaskStateData | null>(null);
  const [logMessages, setLogMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskLoading, setTaskLoading] = useState(false);
  const [error, setError] = useState(false);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const loadTasks = useCallback(async () => {
    setTasks(await api.getTasks());
  }, [api]);

  const loadSelectedTask = useCallback(
    async (taskId: string) => {
      setTaskState(await api.loadTask(taskId));
    },
    [api],
  );

  useEffect(() => {
    const load = async () => {
      try {
        await loadTasks();
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadTasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      setTaskState(null);
      setLogMessages([]);
      return;
    }

    const load = async () => {
      try {
        setTaskLoading(true);
        setLogMessages([]);
        await loadSelectedTask(selectedTaskId);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setTaskLoading(false);
      }
    };
    void load();
  }, [loadSelectedTask, selectedTaskId]);

  useEffect(() => {
    if (!selectedTaskId && tasks[0]) {
      onSelectTask(tasks[0].id);
    }
  }, [onSelectTask, selectedTaskId, tasks]);

  useEffect(() => {
    return api.onEvent((event) => {
      if (isReadonlyTaskListEvent(event)) {
        setTasks((current) => applyReadonlyTaskListEvent(current, event));
      }
      if (selectedTaskId) {
        setTaskState((current) => (current ? applyReadonlyEvent(current, event, selectedTaskId) : current));
        setLogMessages((current) => applyReadonlyLogEvent(current, event, selectedTaskId, t('messages.thinking')));
      }
    });
  }, [api, selectedTaskId]);

  const handleSelectTask = (taskId: string) => {
    onSelectTask(taskId);
    if (isMobile) {
      hideTaskSidebar();
    }
  };

  return (
    <ExtensionsProvider
      projectDir={projectDir}
      task={selectedTask}
      messages={taskState ? convertTaskStateMessages(taskState.messages) : undefined}
      activateTask={onSelectTask}
    >
      <div className="absolute inset-0 flex overflow-hidden">
        {loading && <LoadingOverlay message={t('readonly.loading')} />}
        {error && <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg-primary text-text-muted">{t('readonly.projectError')}</div>}
        {(isTaskSidebarOpen || !isMobile) && (
          <ReadonlyTaskSidebar
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            projectDir={projectDir}
            onSelectTask={handleSelectTask}
            isMobile={isMobile}
            onClose={hideTaskSidebar}
          />
        )}
        <div className="flex-1 relative min-w-0 flex">
          {taskLoading && <LoadingOverlay message={t('common.loadingTask')} animateOpacity />}
          {selectedTask && taskState ? (
            <ReadonlyTaskView
              projectDir={projectDir}
              task={selectedTask}
              state={taskState}
              logMessages={logMessages}
              onToggleTaskSidebar={isMobile ? showTaskSidebar : undefined}
            />
          ) : (
            <main className="flex-1 flex items-center justify-center text-text-muted text-xs">{t('readonly.selectTask')}</main>
          )}
        </div>
      </div>
    </ExtensionsProvider>
  );
};

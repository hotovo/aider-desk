import { TaskData } from '@common/types';
import { forwardRef } from 'react';
import { clsx } from 'clsx';

import { TaskView, TaskViewRef } from '@/components/project/TaskView';
import { ExtensionsProvider } from '@/contexts/ExtensionsContext';
import { FloatingExtensionPanels } from '@/components/extensions/FloatingExtensionPanels';
import { useActiveAgentProfile } from '@/utils/agents';

type Props = {
  projectDir: string;
  task: TaskData;
  isActive: boolean;
  inputHistory: string[];
  shouldFocusPrompt: boolean;
  updateTask: (taskId: string, updates: Partial<TaskData>, useOptimistic?: boolean) => void;
  updateOptimisticTaskState: (taskId: string, taskState: string) => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
  onToggleTaskSidebar?: () => void;
};

export const MountedTaskView = forwardRef<TaskViewRef, Props>(
  (
    {
      projectDir,
      task,
      isActive,
      inputHistory,
      shouldFocusPrompt,
      updateTask,
      updateOptimisticTaskState,
      onArchiveTask,
      onUnarchiveTask,
      onDeleteTask,
      onToggleTaskSidebar,
    },
    ref,
  ) => {
    const agentProfile = useActiveAgentProfile(task, projectDir) || undefined;

    // Inactive pooled tasks are hidden with CSS (display:none) rather than unmounted or wrapped in a
    // hidden <Activity>. This keeps the TaskView fully mounted with its effects/subscriptions intact,
    // so switching back is instant with no message reload and no sidebar re-fetch.
    return (
      <div className={clsx('h-full', !isActive && 'hidden')}>
        <ExtensionsProvider projectDir={projectDir} task={task} agentProfile={agentProfile}>
          <TaskView
            ref={ref}
            projectDir={projectDir}
            task={task}
            updateTask={updateTask}
            updateOptimisticTaskState={updateOptimisticTaskState}
            inputHistory={inputHistory}
            isActive={isActive}
            shouldFocusPrompt={shouldFocusPrompt}
            onArchiveTask={onArchiveTask}
            onUnarchiveTask={onUnarchiveTask}
            onDeleteTask={onDeleteTask}
            onToggleTaskSidebar={onToggleTaskSidebar}
          />
          {isActive && <FloatingExtensionPanels placement="task-floating" />}
        </ExtensionsProvider>
      </div>
    );
  },
);

MountedTaskView.displayName = 'MountedTaskView';

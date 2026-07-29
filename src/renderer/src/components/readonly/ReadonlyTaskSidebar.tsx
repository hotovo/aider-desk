import { useState } from 'react';
import { TaskData } from '@common/types';

import { TaskSidebar } from '@/components/project/TaskSidebar/TaskSidebar';

type Props = {
  tasks: TaskData[];
  selectedTaskId?: string;
  projectDir: string;
  onSelectTask: (taskId: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
};

export const ReadonlyTaskSidebar = ({ tasks, selectedTaskId, onSelectTask, isMobile = false, onClose }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleToggleCollapse = () => setIsCollapsed((collapsed) => !collapsed);

  return (
    <TaskSidebar
      loading={false}
      tasks={tasks}
      readonly
      activeTaskId={selectedTaskId ?? null}
      onTaskSelect={onSelectTask}
      isCollapsed={isCollapsed}
      onToggleCollapse={handleToggleCollapse}
      isMobile={isMobile}
      onClose={onClose}
    />
  );
};

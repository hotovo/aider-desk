import { DefaultTaskState } from '@aider-desk/common/types';
import { CgSpinner } from 'react-icons/cg';
import { clsx } from 'clsx';

import { useTaskState } from '@/stores/taskStore';

type Props = {
  taskId: string;
  state?: string;
  isCollapsed?: boolean;
};

export const TaskStatusIcon = ({ taskId, state, isCollapsed }: Props) => {
  const taskState = useTaskState(taskId);
  const iconSize = isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (taskState?.question) {
    return <span className={clsx('text-text-primary', isCollapsed ? 'text-xs' : 'text-sm')}>?</span>;
  }
  return state === DefaultTaskState.InProgress ? <CgSpinner className={clsx('animate-spin', iconSize, 'text-text-primary')} /> : null;
};

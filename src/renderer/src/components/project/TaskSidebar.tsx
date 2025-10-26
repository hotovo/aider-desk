import { TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { KeyboardEvent, MouseEvent, useState } from 'react';
import { HiOutlinePencil, HiOutlineTrash, HiPlus } from 'react-icons/hi';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

import { useTask } from '@/contexts/TaskContext';
import { Input } from '@/components/common/Input';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { Button } from '@/components/common/Button';

export const COLLAPSED_WIDTH = 44;
export const EXPANDED_WIDTH = 256;

type Props = {
  baseDir: string;
  loading: boolean;
  tasks: TaskData[];
  activeTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  createNewTask?: () => void;
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateTask?: (baseDir: string, taskId: string, updates: Partial<TaskData>) => Promise<boolean>;
  deleteTask?: (baseDir: string, taskId: string) => Promise<boolean>;
};

export const TaskSidebar = ({
  baseDir,
  loading,
  tasks,
  activeTaskId,
  onTaskSelect,
  createNewTask,
  className,
  isCollapsed,
  onToggleCollapse,
  updateTask,
  deleteTask,
}: Props) => {
  const { t } = useTranslation();
  const { getTaskState } = useTask();
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState<string>('');

  const sortedTasks = tasks.filter((task) => task.createdAt && task.updatedAt).sort((a, b) => b.updatedAt!.localeCompare(a.updatedAt!));

  const handleTaskClick = (taskId: string) => {
    onTaskSelect(taskId);
  };

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>, taskId: string) => {
    e.stopPropagation();
    setDeleteConfirmTaskId(taskId);
    setEditingTaskId(null);
  };

  const handleConfirmDelete = async (taskId: string) => {
    try {
      if (deleteTask) {
        await deleteTask(baseDir, taskId);
      }
      setDeleteConfirmTaskId(null);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete task:', error);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmTaskId(null);
  };

  const handleEditClick = (e: MouseEvent<HTMLButtonElement>, taskId: string, taskName: string) => {
    e.stopPropagation();
    setEditingTaskId(taskId);
    setEditTaskName(taskName);
    setDeleteConfirmTaskId(null);
  };

  const handleConfirmEdit = async (taskId: string) => {
    try {
      if (updateTask && editTaskName.trim()) {
        await updateTask(baseDir, taskId, { name: editTaskName.trim() });
      }
      setEditingTaskId(null);
      setEditTaskName('');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update task:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTaskName('');
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleConfirmEdit(editingTaskId!);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleCreateTask = () => {
    if (createNewTask) {
      createNewTask();
    }
  };

  const renderTaskStateIcon = (taskId: string, isCollapsed: boolean = false) => {
    const taskState = getTaskState(taskId, false);
    const iconSize = isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4';

    if (taskState?.question) {
      return <span className={clsx('text-text-primary', isCollapsed ? 'text-xs' : 'text-sm')}>?</span>;
    }
    return taskState?.processing ? <CgSpinner className={clsx('animate-spin', iconSize, 'text-text-primary')} /> : null;
  };

  const renderExpandedTaskItem = (task: TaskData) => (
    <div>
      <div
        className={clsx(
          'group relative flex items-center justify-between py-1 pl-2.5 cursor-pointer transition-colors border',
          activeTaskId === task.id ? 'bg-bg-secondary border-border-dark-light' : 'hover:bg-bg-secondary border-transparent',
        )}
        onClick={() => handleTaskClick(task.id)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-text-primary truncate">{task.name}</div>
          <div className="text-2xs text-text-muted truncate">{formatDate(task.updatedAt!)}</div>
        </div>

        <div className="flex items-center pl-2">{renderTaskStateIcon(task.id, false)}</div>

        <div className="flex items-center display-none w-0 group-hover:w-auto group-hover:display-flex pl-2">
          <button
            data-tooltip-id="task-sidebar-tooltip"
            data-tooltip-content={t('taskSidebar.editTask')}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary"
            onClick={(e) => handleEditClick(e, task.id, task.name)}
          >
            <HiOutlinePencil className="w-4 h-4" />
          </button>

          <button
            data-tooltip-id="task-sidebar-tooltip"
            data-tooltip-content={t('taskSidebar.deleteTask')}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-error-dark"
            onClick={(e) => handleDeleteClick(e, task.id)}
          >
            <HiOutlineTrash className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editingTaskId === task.id && (
        <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
          <Input
            value={editTaskName}
            onChange={(e) => setEditTaskName(e.target.value)}
            onKeyDown={handleEditKeyDown}
            placeholder={t('taskSidebar.taskNamePlaceholder')}
            className="mb-2"
            size="sm"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="text" size="xs" color="tertiary" onClick={handleCancelEdit}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" color="primary" size="xs" onClick={() => handleConfirmEdit(task.id)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}

      {deleteConfirmTaskId === task.id && (
        <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
          <div className="text-2xs text-text-primary mb-2">{t('taskSidebar.deleteConfirm')}</div>
          <div className="flex gap-2 justify-end">
            <Button variant="text" size="xs" color="tertiary" onClick={handleCancelDelete}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" color="danger" size="xs" onClick={() => handleConfirmDelete(task.id)}>
              {t('common.confirm')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <motion.div
      className={clsx('flex flex-col h-full border-r border-border-dark-light bg-bg-primary-light-strong', className)}
      animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      <StyledTooltip id="task-sidebar-tooltip" />
      <div className="flex items-center justify-between bg-bg-primary-light p-2 border-b border-border-dark-light h-10">
        <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={onToggleCollapse}>
          <RiMenuUnfold4Line className={clsx('w-5 h-5 text-text-primary transition-transform duration-300', isCollapsed && 'rotate-180')} />
        </button>

        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center justify-between w-full ml-2"
            >
              <h3 className="text-sm font-semibold uppercase h-5">{t('taskSidebar.title')}</h3>
              {createNewTask && (
                <button
                  data-tooltip-id="task-sidebar-tooltip"
                  data-tooltip-content={t('taskSidebar.createTask')}
                  className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                  onClick={handleCreateTask}
                >
                  <HiPlus className="w-5 h-5 text-text-primary" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-bg-primary-light-strong scrollbar-thumb-border-default bg-bg-primary-light-strong py-0.5">
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <CgSpinner className="animate-spin w-6 h-6 text-text-primary" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center">
                    <div className="text-sm text-text-secondary">{t('taskSidebar.noTasks')}</div>
                  </div>
                </div>
              ) : (
                <div>
                  {sortedTasks.map((task) => (
                    <div key={task.id}>{renderExpandedTaskItem(task)}</div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

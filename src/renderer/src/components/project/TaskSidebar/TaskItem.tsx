import { TaskData, DefaultTaskState } from '@common/types';
import { useTranslation } from 'react-i18next';
import { KeyboardEvent, MouseEvent, useEffect, memo, useState } from 'react';
import { HiPlus, HiCheck, HiSparkles } from 'react-icons/hi';
import { IoGitBranch } from 'react-icons/io5';
import { MdPushPin, MdChevronRight } from 'react-icons/md';
import { clsx } from 'clsx';
import { useLocalStorage, useLongPress } from '@reactuses/core';
import { AnimatePresence, motion } from 'framer-motion';

import { TaskStatusIcon } from './TaskStatusIcon';
import { TaskMenuButton } from './TaskMenuButton';

import { getSortedVisibleTasks } from '@/utils/task-utils';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { LoadingText } from '@/components/common/LoadingText';
import { TaskStateChip } from '@/components/common/TaskStateChip';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  task: TaskData;
  tasks: TaskData[];
  level: number;
  selectedTasks: Set<string>;
  deleteConfirmTaskId: string | null;
  showArchived: boolean;
  searchQuery: string;
  isMultiselectMode: boolean;
  setIsMultiselectMode: (value: boolean) => void;
  activeTaskId: string | null;
  onTaskClick: (e: MouseEvent, taskId: string) => void;
  createNewTask?: (parentId?: string) => void;
  editingTaskId: string | null;
  onEditClick: (taskId: string) => void;
  onEditConfirm: (taskId: string, newName: string) => Promise<void>;
  onEditCancel: () => void;
  onDeleteClick: (taskId: string) => void;
  onArchiveTask: (taskId: string) => Promise<void>;
  onUnarchiveTask: (taskId: string) => Promise<void>;
  onTogglePin: (taskId: string) => Promise<void>;
  onChangeState: (taskId: string, newState: string) => Promise<void>;
  onCopyAsMarkdown?: (taskId: string) => void;
  onExportToMarkdown?: (taskId: string) => void;
  onExportToImage?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  updateTask?: (taskId: string, updates: Partial<TaskData>) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
  handleConfirmDelete: (taskId: string) => Promise<void>;
  handleCancelDelete: () => void;
};

export const TaskItem = memo(
  ({
    task,
    tasks,
    level,
    selectedTasks,
    deleteConfirmTaskId,
    showArchived,
    searchQuery,
    isMultiselectMode,
    setIsMultiselectMode,
    activeTaskId,
    onTaskClick,
    createNewTask,
    editingTaskId,
    onEditClick,
    onEditConfirm,
    onEditCancel,
    onDeleteClick,
    onArchiveTask,
    onUnarchiveTask,
    onTogglePin,
    onChangeState,
    onCopyAsMarkdown,
    onExportToMarkdown,
    onExportToImage,
    onDuplicateTask,
    updateTask,
    deleteTask,
    handleConfirmDelete,
    handleCancelDelete,
  }: Props) => {
    const { t } = useTranslation();
    const [isExpanded, setIsExpanded] = useLocalStorage(`aider-desk-expanded-task-${task.id}`, false);
    const [editTaskName, setEditTaskName] = useState(task.name);
    const isGeneratingName = task.name === '<<generating>>';
    const subtasks = tasks.filter((t) => t.parentId === task.id);
    const visibleSubtasks = getSortedVisibleTasks(subtasks, showArchived, searchQuery);
    const hasChildren = subtasks.length > 0;
    const isEditing = editingTaskId === task.id;
    const isSubtask = level > 0;

    const longPressProps = useLongPress(
      () => {
        setIsMultiselectMode(true);
      },
      {
        delay: 500,
        isPreventDefault: false,
      },
    );

    // Auto-expand if this task contains the active task as a subtask (recursively)
    useEffect(() => {
      if (activeTaskId && tasks.length > 0) {
        const hasActiveSubtask = (taskId: string): boolean => {
          const childTasks = tasks.filter((t) => t.parentId === taskId);
          if (childTasks.some((t) => t.id === activeTaskId)) {
            return true;
          }
          return childTasks.some((child) => hasActiveSubtask(child.id));
        };

        if (hasActiveSubtask(task.id)) {
          setIsExpanded(true);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTaskId, tasks]);

    const toggleExpand = (e: MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    };

    const handleCreateSubtask = (e: MouseEvent) => {
      e.stopPropagation();
      if (createNewTask) {
        createNewTask(task.id);
      }
    };

    const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void onEditConfirm(task.id, editTaskName);
      } else if (e.key === 'Escape') {
        onEditCancel();
      }
    };

    const handleOnEdit = () => {
      setEditTaskName(task.name);
      onEditClick(task.id);
    };

    return (
      <div className="relative">
        <div
          {...longPressProps}
          className={clsx(
            'group relative flex items-center justify-between py-1 pl-2 px-1 cursor-pointer transition-colors border select-none',
            isSubtask && 'ml-2',
            activeTaskId === task.id && !isMultiselectMode
              ? 'bg-bg-secondary border-border-dark-light'
              : selectedTasks.has(task.id) && isMultiselectMode
                ? 'bg-bg-secondary border-border-dark-light'
                : 'hover:bg-bg-secondary border-transparent',
          )}
          onClick={(e) => onTaskClick(e, task.id)}
          data-task-id={task.id}
        >
          {isSubtask && <div className="absolute left-[-1px] top-[-1px] bottom-[-1px] w-px bg-bg-secondary" />}

          <div className="flex items-center min-w-0 flex-1">
            {isMultiselectMode && (
              <div className="flex items-center mr-2">
                <div
                  className={clsx(
                    'w-4 h-4 border rounded flex items-center justify-center transition-colors',
                    selectedTasks.has(task.id)
                      ? 'bg-bg-primary-light-strong border-border-light text-text-primary'
                      : 'border-border-default bg-bg-primary-light',
                  )}
                >
                  {selectedTasks.has(task.id) && <HiCheck className="w-3 h-3" />}
                </div>
              </div>
            )}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              {isGeneratingName ? (
                <LoadingText
                  label={t('taskSidebar.generatingName')}
                  className="text-xs font-medium truncate"
                  icon={<HiSparkles className="w-3 h-3 text-accent-primary flex-shrink-0" />}
                />
              ) : (
                <div className="flex items-center justify-between">
                  <div
                    className={clsx(
                      'text-xs font-medium truncate transition-colors',
                      task.archived && activeTaskId !== task.id ? 'text-text-muted group-hover:text-text-primary' : 'text-text-primary',
                    )}
                  >
                    {task.name || t('taskSidebar.untitled')}
                  </div>
                  {task.pinned && <MdPushPin className="w-3 h-3 text-text-muted shrink-0 ml-1 rotate-45 group-hover:hidden" />}
                </div>
              )}
              <div className="flex items-center gap-0.5 text-3xs text-text-muted">
                {hasChildren && !isSubtask && (
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 -ml-0.5">
                    <button
                      onClick={toggleExpand}
                      className="p-0.5 hover:bg-bg-tertiary rounded transition-transform duration-200"
                      style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      data-testid={`chevron-${task.id}`}
                    >
                      <MdChevronRight className="w-4 h-4 text-text-muted" />
                    </button>
                  </div>
                )}
                <TaskStateChip state={task.state || DefaultTaskState.Todo} className={hasChildren && !isSubtask ? '' : '-ml-0.5'} />
                {task.workingMode === 'worktree' && (
                  <span className="px-1 py-0.5 rounded border border-border-dark-light bg-bg-tertiary-emphasis text-text-tertiary">
                    <IoGitBranch className="w-3 h-3" />
                  </span>
                )}
                {task.archived && <span>• {t('taskSidebar.archived')}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center pl-2">
            <TaskStatusIcon taskId={task.id} state={task.state} isCollapsed={false} />
          </div>

          {!isMultiselectMode && (
            <div className="flex items-center">
              {level === 0 && (
                <Tooltip content={t('taskSidebar.createSubtask')}>
                  <button
                    data-testid={`create-subtask-${task.id}`}
                    className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary hidden group-hover:flex"
                    onClick={handleCreateSubtask}
                  >
                    <HiPlus className="w-4 h-4" />
                  </button>
                </Tooltip>
              )}
              <TaskMenuButton
                task={task}
                onEdit={handleOnEdit}
                onDelete={task.createdAt ? () => onDeleteClick(task.id) : undefined}
                onCopyAsMarkdown={onCopyAsMarkdown && task.createdAt ? () => onCopyAsMarkdown(task.id) : undefined}
                onExportToMarkdown={onExportToMarkdown && task.createdAt ? () => onExportToMarkdown(task.id) : undefined}
                onExportToImage={onExportToImage && task.createdAt ? () => onExportToImage(task.id) : undefined}
                onDuplicateTask={onDuplicateTask && task.createdAt ? () => onDuplicateTask(task.id) : undefined}
                onArchiveTask={task.archived || !task.createdAt ? undefined : () => onArchiveTask(task.id)}
                onUnarchiveTask={task.archived ? () => onUnarchiveTask(task.id) : undefined}
                onTogglePin={() => onTogglePin(task.id)}
                onChangeState={(newState) => onChangeState(task.id, newState)}
                isPinned={task.pinned || false}
              />
            </div>
          )}
        </div>

        {isEditing && (
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
              <Button variant="text" size="xs" color="tertiary" onClick={onEditCancel}>
                {t('common.cancel')}
              </Button>
              <Button variant="contained" color="primary" size="xs" onClick={() => void onEditConfirm(task.id, editTaskName)}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        )}

        {deleteConfirmTaskId === task.id && (
          <div className="m-2 p-2 bg-bg-primary border border-border-default rounded-md">
            <div className="text-2xs text-text-primary mb-2">
              {subtasks.length > 0 ? t('taskSidebar.deleteConfirmWithSubtasks', { count: subtasks.length }) : t('taskSidebar.deleteConfirm')}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="text" size="xs" color="tertiary" onClick={handleCancelDelete}>
                {t('common.cancel')}
              </Button>
              <Button variant="contained" color="danger" size="xs" onClick={() => void handleConfirmDelete(task.id)}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        )}
        <AnimatePresence>
          {visibleSubtasks.length > 0 && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {visibleSubtasks.map((subtask) => (
                <TaskItem
                  key={subtask.id}
                  task={subtask}
                  tasks={tasks}
                  level={level + 1}
                  selectedTasks={selectedTasks}
                  deleteConfirmTaskId={deleteConfirmTaskId}
                  showArchived={showArchived}
                  searchQuery={searchQuery}
                  isMultiselectMode={isMultiselectMode}
                  setIsMultiselectMode={setIsMultiselectMode}
                  activeTaskId={activeTaskId}
                  onTaskClick={onTaskClick}
                  createNewTask={createNewTask}
                  editingTaskId={editingTaskId}
                  onEditClick={onEditClick}
                  onEditConfirm={onEditConfirm}
                  onEditCancel={onEditCancel}
                  onDeleteClick={onDeleteClick}
                  onArchiveTask={onArchiveTask}
                  onUnarchiveTask={onUnarchiveTask}
                  onTogglePin={onTogglePin}
                  onChangeState={onChangeState}
                  onCopyAsMarkdown={onCopyAsMarkdown}
                  onExportToMarkdown={onExportToMarkdown}
                  onExportToImage={onExportToImage}
                  onDuplicateTask={onDuplicateTask}
                  updateTask={updateTask}
                  deleteTask={deleteTask}
                  handleConfirmDelete={handleConfirmDelete}
                  handleCancelDelete={handleCancelDelete}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
);

TaskItem.displayName = 'TaskItem';

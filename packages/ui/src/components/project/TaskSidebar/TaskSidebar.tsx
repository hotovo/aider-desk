import { TaskData } from '@aider-desk/common/types';
import { useTranslation } from 'react-i18next';
import { MouseEvent, useState, useRef, useEffect, useOptimistic, startTransition, Activity, memo, useCallback, useDeferredValue } from 'react';
import { HiPlus } from 'react-icons/hi';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdOutlineSearch } from 'react-icons/md';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { BiArchive, BiArchiveIn } from 'react-icons/bi';
import { HiXMark } from 'react-icons/hi2';
import { useDebounce } from '@reactuses/core';

import { TaskSidebarMultiSelectMenu } from './TaskSidebarMultiSelectMenu';
import { TaskItem } from './TaskItem';

import { getSortedVisibleTasks } from '@/utils/task-utils';
import { Input } from '@/components/common/Input';
import { IconButton } from '@/components/common/IconButton';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Tooltip } from '@/components/ui/Tooltip';

export const COLLAPSED_WIDTH = 44;
export const EXPANDED_WIDTH = 256;

type Props = {
  loading: boolean;
  tasks: TaskData[];
  activeTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  createNewTask?: (parentId?: string) => void;
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  updateTask?: (taskId: string, updates: Partial<TaskData>) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
  onExportToMarkdown?: (taskId: string) => void;
  onExportToImage?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
};

const TaskSidebarComponent = ({
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
  onExportToMarkdown,
  onExportToImage,
  onDuplicateTask,
  isMobile = false,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [optimisticActiveTaskId, setOptimisticActiveTaskId] = useOptimistic(activeTaskId);

  // Multiselect state
  const [isMultiselectMode, setIsMultiselectMode] = useState<boolean>(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isMultiselectMenuOpen, setIsMultiselectMenuOpen] = useState<boolean>(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState<boolean>(false);
  const [bulkArchiveConfirm, setBulkArchiveConfirm] = useState<boolean>(false);
  const multiselectMenuRef = useRef<HTMLDivElement>(null);
  const multiselectButtonRef = useRef<HTMLDivElement>(null);
  const lastClickedTaskIdRef = useRef<string | null>(null);
  const selectedArchived = Array.from(selectedTasks).filter((taskId) => tasks.find((task) => task.id === taskId)?.archived);

  const handleMultiselectClose = () => {
    setIsMultiselectMode(false);
    setSelectedTasks(new Set());
    setIsMultiselectMenuOpen(false);
    setBulkDeleteConfirm(false);
    setBulkArchiveConfirm(false);
    lastClickedTaskIdRef.current = null;
  };

  // Handle ESC key to exit multiselect mode
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && isMultiselectMode) {
        handleMultiselectClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMultiselectMode]);

  // Handle click outside for multiselect menu
  useClickOutside([multiselectMenuRef, multiselectButtonRef], () => {
    setIsMultiselectMenuOpen(false);
  });

  const sortedTasks = getSortedVisibleTasks(tasks, showArchived, debouncedSearchQuery);
  const deferredTasks = useDeferredValue(sortedTasks);

  const handleDeleteClick = useCallback((taskId: string) => {
    setDeleteConfirmTaskId(taskId);
    setEditingTaskId(null);
  }, []);

  const handleConfirmDelete = useCallback(
    async (taskId: string) => {
      try {
        if (deleteTask) {
          await deleteTask(taskId);
        }
        setDeleteConfirmTaskId(null);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete task:', error);
      }
    },
    [deleteTask],
  );

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmTaskId(null);
  }, []);

  const handleEditClick = useCallback((taskId: string) => {
    setEditingTaskId(taskId);
    setDeleteConfirmTaskId(null);
  }, []);

  const handleEditConfirm = useCallback(
    async (taskId: string, newName: string) => {
      try {
        if (updateTask && newName.trim()) {
          await updateTask(taskId, {
            name: newName.trim(),
          });
        }
        setEditingTaskId(null);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to update task:', error);
      }
    },
    [updateTask],
  );

  const handleEditCancel = useCallback(() => {
    setEditingTaskId(null);
  }, []);

  const handleCreateTask = () => {
    if (createNewTask) {
      createNewTask();
      if (isMobile && onClose) {
        onClose();
      }
    }
  };

  const handleSearchToggle = () => {
    setIsSearchVisible(!isSearchVisible);
    if (isSearchVisible) {
      setSearchQuery('');
    }
  };

  const handleSearchClose = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
  };

  const handleArchiveTask = useCallback(
    async (taskId: string) => {
      try {
        if (updateTask) {
          await updateTask(taskId, { archived: true });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to archive task:', error);
      }
    },
    [updateTask],
  );

  const handleUnarchiveTask = useCallback(
    async (taskId: string) => {
      try {
        if (updateTask) {
          await updateTask(taskId, { archived: false });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to unarchive task:', error);
      }
    },
    [updateTask],
  );

  const handleTogglePin = useCallback(
    async (taskId: string) => {
      try {
        if (updateTask) {
          const task = tasks.find((t) => t.id === taskId);
          if (task) {
            await updateTask(taskId, { pinned: !task.pinned });
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to toggle pin:', error);
      }
    },
    [tasks, updateTask],
  );

  const handleChangeState = useCallback(
    async (taskId: string, newState: string) => {
      try {
        if (updateTask) {
          await updateTask(taskId, { state: newState });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to change state:', error);
      }
    },
    [updateTask],
  );

  // Multiselect handlers
  const handleTaskCtrlClick = useCallback(
    (e: MouseEvent, taskId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isMultiselectMode) {
        setIsMultiselectMode(true);
        setSelectedTasks(new Set([taskId]));
        lastClickedTaskIdRef.current = taskId;
      } else {
        setSelectedTasks((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(taskId)) {
            newSet.delete(taskId);
          } else {
            newSet.add(taskId);
          }
          return newSet;
        });
        lastClickedTaskIdRef.current = taskId;
      }
    },
    [isMultiselectMode],
  );

  const handleTaskClickInMultiselect = useCallback((e: MouseEvent, taskId: string) => {
    e.preventDefault();
    e.stopPropagation();

    setSelectedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
    lastClickedTaskIdRef.current = taskId;
  }, []);

  const handleTaskShiftClick = useCallback(
    (taskId: string) => {
      const lastClickedTaskId = lastClickedTaskIdRef.current;

      if (!lastClickedTaskId) {
        setSelectedTasks((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(taskId)) {
            newSet.delete(taskId);
          } else {
            newSet.add(taskId);
          }
          return newSet;
        });
        lastClickedTaskIdRef.current = taskId;
        return;
      }

      const taskIds = sortedTasks.map((task) => task.id);
      const lastIndex = taskIds.indexOf(lastClickedTaskId);
      const currentIndex = taskIds.indexOf(taskId);

      if (lastIndex === -1 || currentIndex === -1) {
        return;
      }

      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      const rangeIds = taskIds.slice(start, end + 1);

      setSelectedTasks((prev) => {
        const newSet = new Set(prev);
        rangeIds.forEach((id) => newSet.add(id));
        return newSet;
      });

      lastClickedTaskIdRef.current = taskId;
    },
    [sortedTasks],
  );

  const handleTaskClick = useCallback(
    (e: MouseEvent, taskId: string) => {
      if (e.ctrlKey || e.metaKey) {
        handleTaskCtrlClick(e, taskId);
      } else if (e.shiftKey && isMultiselectMode) {
        handleTaskShiftClick(taskId);
      } else if (isMultiselectMode) {
        handleTaskClickInMultiselect(e, taskId);
      } else {
        startTransition(() => {
          setOptimisticActiveTaskId(taskId);
          onTaskSelect(taskId);
        });
      }
    },
    [isMultiselectMode, handleTaskCtrlClick, handleTaskShiftClick, handleTaskClickInMultiselect, onTaskSelect, setOptimisticActiveTaskId],
  );

  const handleBulkDelete = async () => {
    try {
      if (deleteTask) {
        await Promise.all(Array.from(selectedTasks).map((taskId) => deleteTask(taskId)));
      }
      handleMultiselectClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete tasks:', error);
    }
  };

  const handleBulkArchive = async () => {
    try {
      if (updateTask) {
        if (selectedArchived.length) {
          await Promise.all(Array.from(selectedArchived).map((taskId) => updateTask(taskId, { archived: false })));
        } else {
          await Promise.all(Array.from(selectedTasks).map((taskId) => updateTask(taskId, { archived: true })));
        }
      }
      handleMultiselectClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to archive/unarchive tasks:', error);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={isMobile ? { x: '-100%', opacity: 0 } : undefined}
        animate={isMobile ? { x: 0, opacity: 1 } : { width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        exit={isMobile ? { x: '-100%', opacity: 0 } : undefined}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={
          isMobile
            ? 'fixed inset-y-0 left-0 w-full h-full bg-bg-primary z-[1000] shadow-xl flex flex-col'
            : clsx('flex flex-col h-full border-r border-border-dark-light bg-bg-primary-light-strong', className)
        }
      >
        <div className="bg-bg-primary-light border-b border-border-dark-light">
          <div className="flex items-center justify-between p-2 h-10">
            <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={isMobile && onClose ? onClose : onToggleCollapse}>
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
                  {isMultiselectMode ? (
                    <>
                      <h3 className="text-sm font-semibold uppercase h-5">{t('taskSidebar.title')}</h3>
                      <div className="flex items-center gap-1">
                        <span className="text-2xs text-text-muted mr-2">{t('taskSidebar.selectedCount', { count: selectedTasks.size })}</span>
                        <Tooltip content={t('taskSidebar.closeMultiselect')}>
                          <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleMultiselectClose}>
                            <HiXMark className="w-5 h-5 text-text-primary" />
                          </button>
                        </Tooltip>
                        <TaskSidebarMultiSelectMenu
                          hasArchived={Array.from(selectedTasks).some((taskId) => tasks.find((task) => task.id === taskId)?.archived)}
                          onDelete={() => setBulkDeleteConfirm(true)}
                          onArchive={() => setBulkArchiveConfirm(true)}
                          onUnarchive={() => setBulkArchiveConfirm(true)}
                          isOpen={isMultiselectMenuOpen}
                          onToggle={() => setIsMultiselectMenuOpen(!isMultiselectMenuOpen)}
                          menuRef={multiselectMenuRef}
                          buttonRef={multiselectButtonRef}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold uppercase h-5">{t('taskSidebar.title')}</h3>
                      <div className="flex items-center gap-1">
                        <IconButton
                          onClick={() => setShowArchived(!showArchived)}
                          tooltip={showArchived ? t('taskSidebar.hideArchived') : t('taskSidebar.showArchived')}
                          className="p-1.5 hover:bg-bg-tertiary rounded-md group"
                          icon={
                            showArchived ? (
                              <BiArchiveIn className="w-4 h-4 text-text-primary" />
                            ) : (
                              <BiArchive className="w-4 h-4 text-text-dark group-hover:text-text-muted" />
                            )
                          }
                        />
                        <Tooltip content={t('taskSidebar.search')}>
                          <button
                            className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                            onClick={handleSearchToggle}
                            data-testid="search-toggle-button"
                          >
                            <MdOutlineSearch className="w-5 h-5 text-text-primary" />
                          </button>
                        </Tooltip>
                        {createNewTask && (
                          <Tooltip content={t('taskSidebar.createTask')}>
                            <button
                              className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                              onClick={handleCreateTask}
                              data-testid="create-task-button"
                            >
                              <HiPlus className="w-5 h-5 text-text-primary" />
                            </button>
                          </Tooltip>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Activity mode={!isCollapsed && isSearchVisible ? 'visible' : 'hidden'}>
            <div className="px-2 pb-2">
              <div className="relative">
                <Input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('taskSidebar.searchPlaceholder')}
                  size="sm"
                  className="pr-8"
                  autoFocus={true}
                />
                <button
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                  onClick={handleSearchClose}
                >
                  <HiXMark className="w-4 h-4 text-text-muted hover:text-text-primary" />
                </button>
              </div>
            </div>
          </Activity>
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
                    {deferredTasks
                      .filter((task) => !task.parentId || !deferredTasks.some((t) => t.id === task.parentId))
                      .map((task) => (
                        <TaskItem
                          key={task.id}
                          task={task}
                          tasks={tasks}
                          level={0}
                          selectedTasks={selectedTasks}
                          deleteConfirmTaskId={deleteConfirmTaskId}
                          showArchived={showArchived}
                          searchQuery={debouncedSearchQuery}
                          isMultiselectMode={isMultiselectMode}
                          setIsMultiselectMode={setIsMultiselectMode}
                          activeTaskId={optimisticActiveTaskId}
                          onTaskClick={handleTaskClick}
                          createNewTask={createNewTask}
                          editingTaskId={editingTaskId}
                          onEditClick={handleEditClick}
                          onEditConfirm={handleEditConfirm}
                          onEditCancel={handleEditCancel}
                          onDeleteClick={handleDeleteClick}
                          onArchiveTask={handleArchiveTask}
                          onUnarchiveTask={handleUnarchiveTask}
                          onTogglePin={handleTogglePin}
                          onChangeState={handleChangeState}
                          onExportToMarkdown={onExportToMarkdown}
                          onExportToImage={onExportToImage}
                          onDuplicateTask={onDuplicateTask}
                          updateTask={updateTask}
                          deleteTask={deleteTask}
                          handleConfirmDelete={handleConfirmDelete}
                          handleCancelDelete={handleCancelDelete}
                        />
                      ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isCollapsed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="h-full flex items-start justify-center py-1"
              >
                {createNewTask && (
                  <Tooltip content={t('taskSidebar.createTask')}>
                    <button className="p-2 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleCreateTask}>
                      <HiPlus className="w-5 h-5 text-text-primary" />
                    </button>
                  </Tooltip>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bulk Delete Confirmation */}
        {bulkDeleteConfirm && (
          <ConfirmDialog
            title={t('taskSidebar.deleteSelected')}
            onConfirm={handleBulkDelete}
            onCancel={() => setBulkDeleteConfirm(false)}
            confirmButtonColor="danger"
          >
            <div className="text-sm text-text-primary">{t('taskSidebar.deleteSelectedConfirm', { count: selectedTasks.size })}</div>
          </ConfirmDialog>
        )}

        {/* Bulk Archive Confirmation */}
        {bulkArchiveConfirm && (
          <ConfirmDialog
            title={selectedArchived.length ? t('taskSidebar.unarchiveSelected') : t('taskSidebar.archiveSelected')}
            onConfirm={handleBulkArchive}
            onCancel={() => setBulkArchiveConfirm(false)}
          >
            <div className="text-sm text-text-primary">
              {selectedArchived.length
                ? t('taskSidebar.unarchiveSelectedConfirm', { count: selectedArchived.length })
                : t('taskSidebar.archiveSelectedConfirm', { count: selectedTasks.size })}
            </div>
          </ConfirmDialog>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// Custom comparison function for React.memo
const arePropsEqual = (prevProps: Props, nextProps: Props): boolean => {
  // Compare primitive props
  if (
    prevProps.loading !== nextProps.loading ||
    prevProps.activeTaskId !== nextProps.activeTaskId ||
    prevProps.isCollapsed !== nextProps.isCollapsed ||
    prevProps.className !== nextProps.className
  ) {
    return false;
  }

  // Compare function props
  if (
    prevProps.onTaskSelect !== nextProps.onTaskSelect ||
    prevProps.onToggleCollapse !== nextProps.onToggleCollapse ||
    prevProps.createNewTask !== nextProps.createNewTask ||
    prevProps.updateTask !== nextProps.updateTask ||
    prevProps.deleteTask !== nextProps.deleteTask
  ) {
    return false;
  }

  // Compare tasks array - shallow check first, then deep check for task properties
  if (prevProps.tasks.length !== nextProps.tasks.length) {
    return false;
  }

  // Check if tasks have changed in meaningful ways
  for (let i = 0; i < prevProps.tasks.length; i++) {
    const prevTask = prevProps.tasks[i];
    const nextTask = nextProps.tasks[i];

    if (prevTask.id !== nextTask.id) {
      return false;
    }

    // Only check properties that affect rendering
    if (
      prevTask.name !== nextTask.name ||
      prevTask.updatedAt !== nextTask.updatedAt ||
      prevTask.createdAt !== nextTask.createdAt ||
      prevTask.pinned !== nextTask.pinned ||
      prevTask.parentId !== nextTask.parentId
    ) {
      return false;
    }
  }

  return true;
};

export const TaskSidebar = memo(TaskSidebarComponent, arePropsEqual);

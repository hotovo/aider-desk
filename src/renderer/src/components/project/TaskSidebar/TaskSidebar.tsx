import { DefaultTaskState, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { MouseEvent, useState, useRef, useEffect, useOptimistic, startTransition, Activity, memo, useCallback, useMemo } from 'react';
import { HiPlus } from 'react-icons/hi';
import { RiMenuUnfold4Line } from 'react-icons/ri';
import { CgSpinner } from 'react-icons/cg';
import { MdOutlineSearch } from 'react-icons/md';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { FiFilter } from 'react-icons/fi';
import { HiXMark } from 'react-icons/hi2';
import { useDebounce, useLocalStorage } from '@reactuses/core';
import { useVirtualizer } from '@tanstack/react-virtual';

import { TaskSidebarMultiSelectMenu } from './TaskSidebarMultiSelectMenu';
import { TaskItem } from './TaskItem';
import { TaskSectionHeader } from './TaskSectionHeader';

import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { flattenTasksForVirtualization } from '@/utils/task-utils';
import { Input } from '@/components/common/Input';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { Checkbox } from '@/components/common/Checkbox';
import { Toggle } from '@/components/common/Toggle';
import { getTaskStateLabel, getStateTextClass } from '@/components/common/TaskStateChip';

export const COLLAPSED_WIDTH = 44;
export const EXPANDED_WIDTH = 256;
export const MIN_WIDTH = EXPANDED_WIDTH;
export const MAX_WIDTH = 600;

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
  onCopyAsMarkdown?: (taskId: string) => void;
  onExportToMarkdown?: (taskId: string) => void;
  onExportToImage?: (taskId: string) => void;
  onDuplicateTask?: (taskId: string) => void;
  isMobile?: boolean;
  onClose?: () => void;
  width?: number;
  onResize?: (width: number) => void;
  contentRef?: React.RefObject<HTMLDivElement | null>;
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
  onCopyAsMarkdown,
  onExportToMarkdown,
  onExportToImage,
  onDuplicateTask,
  isMobile = false,
  onClose,
  width,
  onResize,
  contentRef,
}: Props) => {
  const { t } = useTranslation();
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [selectedStates, setSelectedStates] = useState<Set<string>>(() => new Set([...Object.values(DefaultTaskState)]));
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIds, setExpandedIds] = useLocalStorage<string[]>('aider-desk-expanded-tasks', []);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 50);
  const [optimisticActiveTaskId, setOptimisticActiveTaskId] = useOptimistic(activeTaskId);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleResizeMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isCollapsed || isMobile || !onResize) {
        return;
      }
      e.preventDefault();
      const currentWidth = width ?? EXPANDED_WIDTH;
      resizeStartRef.current = { startX: e.clientX, startWidth: currentWidth };

      const sidebarEl = sidebarRef.current;
      if (sidebarEl) {
        sidebarEl.style.transition = 'none';
      }
      const contentEl = contentRef?.current;
      if (contentEl) {
        // eslint-disable-next-line react-compiler/react-compiler
        contentEl.style.transition = 'none';
      }

      let finalWidth = currentWidth;
      let hasMoved = false;

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        if (!resizeStartRef.current) {
          return;
        }
        const delta = moveEvent.clientX - resizeStartRef.current.startX;
        if (!hasMoved && Math.abs(delta) < 3) {
          return;
        }
        hasMoved = true;
        finalWidth = Math.min(Math.max(resizeStartRef.current.startWidth + delta, MIN_WIDTH), MAX_WIDTH);
        if (sidebarEl) {
          sidebarEl.style.width = `${finalWidth}px`;
        }
        if (contentEl) {
          contentEl.style.left = `${finalWidth}px`;
        }
      };

      const handleMouseUp = () => {
        resizeStartRef.current = null;
        if (hasMoved) {
          if (sidebarEl) {
            sidebarEl.style.transition = '';
            sidebarEl.style.width = '';
          }
          if (contentEl) {
            contentEl.style.transition = '';
            contentEl.style.left = '';
          }
          onResize(finalWidth);
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    },
    [isCollapsed, isMobile, onResize, width, contentRef],
  );

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
  useClickOutside(
    [multiselectMenuRef, multiselectButtonRef],
    () => {
      setIsMultiselectMenuOpen(false);
    },
    isMultiselectMenuOpen,
  );

  const expandedIdsSet = useMemo(() => new Set(expandedIds ?? []), [expandedIds]);

  const virtualItems = useMemo(
    () => flattenTasksForVirtualization(tasks, expandedIdsSet, selectedStates, showArchived, debouncedSearchQuery),
    [tasks, expandedIdsSet, selectedStates, showArchived, debouncedSearchQuery],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => listContainerRef.current,
    estimateSize: () => 28,
    overscan: 10,
  });

  const handleToggleExpand = useCallback(
    (taskId: string) => {
      setExpandedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) {
          newSet.delete(taskId);
        } else {
          newSet.add(taskId);
        }
        return Array.from(newSet);
      });
    },
    [setExpandedIds],
  );

  const prevActiveTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTaskId === prevActiveTaskIdRef.current) {
      return;
    }
    prevActiveTaskIdRef.current = activeTaskId;

    if (activeTaskId && tasks.length > 0) {
      const hasActiveSubtask = (taskId: string): boolean => {
        const childTasks = tasks.filter((t) => t.parentId === taskId);
        if (childTasks.some((t) => t.id === activeTaskId)) {
          return true;
        }
        return childTasks.some((child) => hasActiveSubtask(child.id));
      };

      const parentWithActiveSubtask = tasks.find((task) => hasActiveSubtask(task.id));
      const parentId = parentWithActiveSubtask?.id;
      if (parentId) {
        setExpandedIds((prev) => {
          const prevArr = prev ?? [];
          if (prevArr.includes(parentId)) {
            return prevArr;
          }
          return [...prevArr, parentId];
        });
      }
    }
  }, [activeTaskId, tasks, setExpandedIds]);

  useEffect(() => {
    if (!optimisticActiveTaskId || !listContainerRef.current) {
      return;
    }
    const activeElement = listContainerRef.current.querySelector(`[data-task-id="${optimisticActiveTaskId}"]`);
    if (activeElement) {
      activeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [optimisticActiveTaskId]);

  const sortedTasks = useMemo(() => {
    const taskItems = virtualItems.filter((item): item is { type: 'task'; id: string; task: TaskData; level: number } => item.type === 'task');
    return taskItems.map((item) => item.task);
  }, [virtualItems]);

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
    } else {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
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
          if (optimisticActiveTaskId === taskId && createNewTask) {
            createNewTask();
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to archive task:', error);
      }
    },
    [updateTask, optimisticActiveTaskId, createNewTask],
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

  const handleMoveToTop = useCallback(
    async (taskId: string) => {
      try {
        if (updateTask) {
          await updateTask(taskId, { updatedAt: new Date().toISOString() });
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to move task to top:', error);
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

  const sidebarContent = (
    <>
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
                      <ExtensionComponentWrapper placement="tasks-sidebar-actions-left" />
                      <Tooltip content={t('taskSidebar.filterStates')}>
                        <button
                          className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors"
                          onClick={() => {
                            setIsFilterVisible(!isFilterVisible);
                          }}
                        >
                          <FiFilter className="w-4 h-4 text-text-primary" />
                        </button>
                      </Tooltip>
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
                          <button className="p-1 rounded-md hover:bg-bg-tertiary transition-colors" onClick={handleCreateTask} data-testid="create-task-button">
                            <HiPlus className="w-5 h-5 text-text-primary" />
                          </button>
                        </Tooltip>
                      )}
                      <ExtensionComponentWrapper placement="tasks-sidebar-actions-right" />
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Activity mode={!isCollapsed && isFilterVisible ? 'visible' : 'hidden'}>
          <div className="px-2 pb-2 flex flex-col gap-y-1">
            {Object.values(DefaultTaskState).map((state) => (
              <Checkbox
                key={state}
                size="xs"
                checked={selectedStates.has(state)}
                onChange={(checked) => {
                  setSelectedStates((prev) => {
                    const newSet = new Set(prev);
                    if (checked) {
                      newSet.add(state);
                    } else {
                      newSet.delete(state);
                    }
                    return newSet;
                  });
                }}
                label={<span className={getStateTextClass(state)}>{getTaskStateLabel(t, state)}</span>}
              />
            ))}
            <div className="flex items-center gap-2 pt-1 border-t border-border-dark-light">
              <Toggle color="tertiary" size="sm" checked={showArchived} onChange={setShowArchived} />
              <span className="text-2xs">{t('taskSidebar.archived')}</span>
            </div>
          </div>
        </Activity>

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

        <ExtensionComponentWrapper placement="tasks-sidebar-header" />
      </div>

      <div
        ref={listContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-track-bg-primary-light-strong scrollbar-thumb-border-default bg-bg-primary-light-strong py-0.5"
      >
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
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = virtualItems[virtualRow.index];

                    if (item.type === 'header') {
                      return (
                        <div
                          key={`${virtualRow.index}-${item.id}`}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <TaskSectionHeader
                            title={
                              item.title === 'today'
                                ? t('taskSidebar.today')
                                : item.title === 'yesterday'
                                  ? t('taskSidebar.yesterday')
                                  : item.title === 'unknown'
                                    ? t('taskSidebar.noDate')
                                    : item.title
                            }
                          />
                        </div>
                      );
                    }

                    const task = item.task;
                    const subtasks = tasks.filter((t) => t.parentId === task.id);
                    const isExpanded = expandedIdsSet.has(task.id);

                    return (
                      <div
                        key={`${virtualRow.index}-${task.id}`}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TaskItem
                          task={task}
                          tasks={tasks}
                          level={item.level}
                          selectedTasks={selectedTasks}
                          deleteConfirmTaskId={deleteConfirmTaskId}
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
                          onMoveToTop={handleMoveToTop}
                          onCopyAsMarkdown={onCopyAsMarkdown}
                          onExportToMarkdown={onExportToMarkdown}
                          onExportToImage={onExportToImage}
                          onDuplicateTask={onDuplicateTask}
                          handleConfirmDelete={handleConfirmDelete}
                          handleCancelDelete={handleCancelDelete}
                          isExpanded={isExpanded}
                          onToggleExpand={handleToggleExpand}
                          hasChildren={subtasks.length > 0}
                        />
                      </div>
                    );
                  })}
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

      <ExtensionComponentWrapper placement="tasks-sidebar-bottom" />

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
      {!isMobile && !isCollapsed && onResize && (
        <div
          className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-accent-light/50 transition-colors z-10"
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={(e) => e.preventDefault()}
        />
      )}
    </>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-y-0 left-0 w-full h-full bg-bg-primary z-[1000] shadow-xl flex flex-col"
        >
          {sidebarContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : (width ?? EXPANDED_WIDTH);

  return (
    <div
      ref={sidebarRef}
      className={clsx('relative flex flex-col h-full border-r border-border-dark-light bg-bg-primary-light-strong overflow-hidden', className)}
      style={{
        width: currentWidth,
        transition: 'width 0.3s ease-in-out',
      }}
    >
      {sidebarContent}
    </div>
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
    prevProps.deleteTask !== nextProps.deleteTask ||
    prevProps.width !== nextProps.width ||
    prevProps.onResize !== nextProps.onResize
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

TaskSidebarComponent.displayName = 'TaskSidebar';

export const TaskSidebar = memo(TaskSidebarComponent, arePropsEqual);

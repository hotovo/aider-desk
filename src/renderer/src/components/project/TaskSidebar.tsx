import { DefaultTaskState, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { KeyboardEvent, MouseEvent, useState, memo, useRef, useEffect, useOptimistic, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { HiOutlinePencil, HiOutlineTrash, HiPlus, HiCheck, HiSparkles } from 'react-icons/hi';
import { RiMenuUnfold4Line, RiFlag2Line } from 'react-icons/ri';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { IoLogoMarkdown } from 'react-icons/io';
import { IoGitBranch } from 'react-icons/io5';
import { CgSpinner } from 'react-icons/cg';
import { MdImage, MdOutlineSearch, MdPushPin, MdChevronRight } from 'react-icons/md';
import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { BiDuplicate, BiArchive, BiArchiveIn } from 'react-icons/bi';
import { HiXMark } from 'react-icons/hi2';
import { useDebounce, useLocalStorage, useLongPress } from '@reactuses/core';

import { getSortedVisibleTasks } from '@/utils/task-utils';
import { Input } from '@/components/common/Input';
import { StyledTooltip } from '@/components/common/StyledTooltip';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingText } from '@/components/common/LoadingText';
import { getTaskStateLabel, TaskStateChip } from '@/components/common/TaskStateChip';
import { useTaskState } from '@/stores/taskStore';

export const COLLAPSED_WIDTH = 44;
export const EXPANDED_WIDTH = 256;

const TaskStatusIcon = ({ taskId, state, isCollapsed }: { taskId: string; state?: string; isCollapsed?: boolean }) => {
  const taskState = useTaskState(taskId);
  const iconSize = isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4';

  if (taskState?.question) {
    return <span className={clsx('text-text-primary', isCollapsed ? 'text-xs' : 'text-sm')}>?</span>;
  }
  return state === DefaultTaskState.InProgress ? <CgSpinner className={clsx('animate-spin', iconSize, 'text-text-primary')} /> : null;
};

type TaskMenuButtonProps = {
  task: TaskData;
  onEdit: () => void;
  onDelete?: () => void;
  onExportToMarkdown?: () => void;
  onExportToImage?: () => void;
  onDuplicateTask?: () => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onTogglePin?: () => void;
  onChangeState?: (newState: string) => void;
  isPinned?: boolean;
};

const TaskMenuButton = ({
  task,
  onEdit,
  onDelete,
  onExportToMarkdown,
  onExportToImage,
  onDuplicateTask,
  onArchiveTask,
  onUnarchiveTask,
  onTogglePin,
  onChangeState,
  isPinned,
}: TaskMenuButtonProps) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStateSubmenuOpen, setIsStateSubmenuOpen] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const stateSubmenuItemRef = useRef<HTMLLIElement>(null);
  const stateSubmenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStateSubmenuOpen && stateSubmenuItemRef.current) {
      const rect = stateSubmenuItemRef.current.getBoundingClientRect();
      setSubmenuPosition({
        top: rect.top,
        left: rect.right + 4,
      });
    } else {
      setSubmenuPosition(null);
    }
  }, [isStateSubmenuOpen]);

  useClickOutside([menuRef, buttonRef, stateSubmenuRef], () => {
    setIsMenuOpen(false);
    setIsStateSubmenuOpen(false);
  });

  const handleMenuClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleEditClick = (e: MouseEvent) => {
    e.stopPropagation();
    onEdit();
    setIsMenuOpen(false);
  };

  const handleDeleteClick = (e: MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
    setIsMenuOpen(false);
  };

  const handleExportToMarkdownClick = (e: MouseEvent) => {
    e.stopPropagation();
    onExportToMarkdown?.();
    setIsMenuOpen(false);
  };

  const handleExportToImageClick = (e: MouseEvent) => {
    e.stopPropagation();
    onExportToImage?.();
    setIsMenuOpen(false);
  };

  const handleDuplicateTaskClick = (e: MouseEvent) => {
    e.stopPropagation();
    onDuplicateTask?.();
    setIsMenuOpen(false);
  };

  const handleArchiveTaskClick = (e: MouseEvent) => {
    e.stopPropagation();
    onArchiveTask?.();
    setIsMenuOpen(false);
  };

  const handleUnarchiveTaskClick = (e: MouseEvent) => {
    e.stopPropagation();
    onUnarchiveTask?.();
    setIsMenuOpen(false);
  };

  const handlePinClick = (e: MouseEvent) => {
    e.stopPropagation();
    onTogglePin?.();
  };

  const handleStateSubmenuToggle = () => {
    setIsStateSubmenuOpen(!isStateSubmenuOpen);
  };

  const handleStateChange = (e: MouseEvent, state: string) => {
    e.stopPropagation();
    onChangeState?.(state);
    setIsStateSubmenuOpen(false);
    setIsMenuOpen(false);
  };

  return (
    <div className={clsx('relative flex items-center', isMenuOpen ? 'flex' : 'w-0 group-hover:w-auto')}>
      <div ref={buttonRef}>
        <button
          className={clsx(
            'transition-opacity p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary',
            !isMenuOpen && 'opacity-0 group-hover:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleMenuClick();
          }}
        >
          <FaEllipsisVertical className="w-4 h-4" />
        </button>
      </div>
      {isMenuOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-1 w-[170px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-10">
          <ul className="display-none group-hover:display-block">
            <li
              className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
              onClick={handleEditClick}
            >
              <HiOutlinePencil className="w-4 h-4" />
              <span className="whitespace-nowrap">{t('taskSidebar.rename')}</span>
            </li>
            {onTogglePin && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handlePinClick}
              >
                <MdPushPin className={clsx('w-4 h-4', isPinned && 'rotate-45')} />
                <span className="whitespace-nowrap">{isPinned ? t('taskSidebar.unpinTask') : t('taskSidebar.pinTask')}</span>
              </li>
            )}
            {onExportToMarkdown && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleExportToMarkdownClick}
              >
                <IoLogoMarkdown className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.exportAsMarkdown')}</span>
              </li>
            )}
            {onExportToImage && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleExportToImageClick}
              >
                <MdImage className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.exportAsImage')}</span>
              </li>
            )}
            {onDuplicateTask && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleDuplicateTaskClick}
              >
                <BiDuplicate className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.duplicateTask')}</span>
              </li>
            )}
            {task.state !== DefaultTaskState.InProgress && (
              <li
                ref={stateSubmenuItemRef}
                className="relative flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStateSubmenuToggle();
                }}
              >
                <RiFlag2Line className="w-4 h-4" />
                <span className="whitespace-nowrap flex-1">{t('taskSidebar.changeState')}</span>
                <MdChevronRight className="w-3.5 h-3.5 text-text-muted" />
              </li>
            )}
            {onArchiveTask && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleArchiveTaskClick}
              >
                <BiArchive className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.archiveTask')}</span>
              </li>
            )}
            {onUnarchiveTask && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleUnarchiveTaskClick}
              >
                <BiArchiveIn className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.unarchiveTask')}</span>
              </li>
            )}
            {onDelete && (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleDeleteClick}
              >
                <HiOutlineTrash className="w-4 h-4 text-error" />
                <span className="whitespace-nowrap">{t('taskSidebar.deleteTask')}</span>
              </li>
            )}
          </ul>
        </div>
      )}
      {isStateSubmenuOpen &&
        submenuPosition &&
        createPortal(
          <div
            ref={stateSubmenuRef}
            style={{
              position: 'fixed',
              top: `${submenuPosition.top}px`,
              left: `${submenuPosition.left}px`,
            }}
            className="w-[180px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-[9999]"
            onClick={(e) => e.stopPropagation()}
          >
            <ul className="py-1">
              {[
                DefaultTaskState.Todo,
                DefaultTaskState.ReadyForImplementation,
                DefaultTaskState.ReadyForReview,
                DefaultTaskState.MoreInfoNeeded,
                DefaultTaskState.Done,
              ].map((state) => (
                <li
                  key={state}
                  className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={(e) => handleStateChange(e, state)}
                >
                  {getTaskStateLabel(t, state)}
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
};

// Multiselect Menu Component
const MultiselectMenu = ({
  hasArchived,
  onDelete,
  onArchive,
  onUnarchive,
  isOpen,
  onToggle,
  menuRef,
  buttonRef,
}: {
  hasArchived: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  isOpen: boolean;
  onToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex items-center">
      <div ref={buttonRef}>
        <button
          className="p-1.5 rounded-md hover:bg-bg-tertiary transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <FaEllipsisVertical className="w-4 h-4 text-text-primary" />
        </button>
      </div>
      {isOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-1 w-[170px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-10">
          <ul>
            <li
              className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <HiOutlineTrash className="w-4 h-4 text-error" />
              <span className="whitespace-nowrap">{t('taskSidebar.deleteSelected')}</span>
            </li>
            {!hasArchived ? (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive();
                }}
              >
                <BiArchive className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.archiveSelected')}</span>
              </li>
            ) : (
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnarchive();
                }}
              >
                <BiArchiveIn className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.unarchiveSelected')}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

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
  const [editTaskName, setEditTaskName] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [isSearchVisible, setIsSearchVisible] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTaskIds, setExpandedTaskIds] = useLocalStorage<string[]>('aider-desk-expanded-tasks', []);

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

  // Automatically expand parent when activeTaskId is a subtask
  useEffect(() => {
    if (activeTaskId && tasks.length > 0) {
      const activeTask = tasks.find((t) => t.id === activeTaskId);
      if (activeTask?.parentId) {
        setExpandedTaskIds((prev) => {
          const currentIds = prev || [];
          const parentId = activeTask.parentId;
          if (parentId && currentIds.includes(parentId)) {
            return currentIds;
          }
          return parentId ? [...currentIds, parentId] : currentIds;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTaskId, tasks]);

  const sortedTasks = getSortedVisibleTasks(tasks, showArchived, debouncedSearchQuery);

  const handleTaskClick = (e: MouseEvent, taskId: string) => {
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
  };

  const longPressProps = useLongPress(
    () => {
      setIsMultiselectMode(true);
    },
    {
      delay: 500,
      isPreventDefault: false,
    },
  );

  const handleDeleteClick = (taskId: string) => {
    setDeleteConfirmTaskId(taskId);
    setEditingTaskId(null);
  };

  const handleConfirmDelete = async (taskId: string) => {
    try {
      if (deleteTask) {
        await deleteTask(taskId);
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

  const handleEditClick = (taskId: string, taskName: string) => {
    setEditingTaskId(taskId);
    setEditTaskName(taskName);
    setDeleteConfirmTaskId(null);
  };

  const handleConfirmEdit = async (taskId: string) => {
    try {
      if (updateTask && editTaskName.trim()) {
        await updateTask(taskId, {
          name: editTaskName.trim(),
        });
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

  const handleArchiveTask = async (taskId: string) => {
    try {
      if (updateTask) {
        await updateTask(taskId, { archived: true });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to archive task:', error);
    }
  };

  const handleUnarchiveTask = async (taskId: string) => {
    try {
      if (updateTask) {
        await updateTask(taskId, { archived: false });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to unarchive task:', error);
    }
  };

  const handleTogglePin = async (taskId: string) => {
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
  };

  const handleChangeState = async (taskId: string, newState: string) => {
    try {
      if (updateTask) {
        await updateTask(taskId, { state: newState });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to change state:', error);
    }
  };

  // Multiselect handlers
  const handleTaskCtrlClick = (e: MouseEvent, taskId: string) => {
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
  };

  const handleTaskClickInMultiselect = (e: MouseEvent, taskId: string) => {
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
  };

  const handleTaskShiftClick = (taskId: string) => {
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
  };

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

  const renderExpandedTaskItem = (task: TaskData, level: number = 0) => {
    const isGeneratingName = task.name === '<<generating>>';
    const subtasks = tasks.filter((t) => t.parentId === task.id);
    const visibleSubtasks = getSortedVisibleTasks(subtasks, showArchived, debouncedSearchQuery);
    const hasChildren = subtasks.length > 0;
    const isExpanded = expandedTaskIds?.includes(task.id);
    const isSubtask = level > 0;

    const toggleExpand = (e: MouseEvent) => {
      e.stopPropagation();
      setExpandedTaskIds((prev) => (prev?.includes(task.id) ? (prev || []).filter((id) => id !== task.id) : [...(prev || []), task.id]));
    };

    const handleCreateSubtask = (e: MouseEvent) => {
      e.stopPropagation();
      if (createNewTask) {
        createNewTask(task.id);
      }
    };

    return (
      <div className="relative">
        <div
          {...longPressProps}
          className={clsx(
            'group relative flex items-center justify-between py-1 pl-2 px-1 cursor-pointer transition-colors border select-none',
            isSubtask && 'ml-2',
            optimisticActiveTaskId === task.id && !isMultiselectMode
              ? 'bg-bg-secondary border-border-dark-light'
              : selectedTasks.has(task.id) && isMultiselectMode
                ? 'bg-bg-secondary border-border-dark-light'
                : 'hover:bg-bg-secondary border-transparent',
          )}
          onClick={(e) => handleTaskClick(e, task.id)}
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
                      task.archived && optimisticActiveTaskId !== task.id ? 'text-text-muted group-hover:text-text-primary' : 'text-text-primary',
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
                <button
                  data-tooltip-id="task-sidebar-tooltip"
                  data-tooltip-content={t('taskSidebar.createSubtask')}
                  data-testid={`create-subtask-${task.id}`}
                  className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary hidden group-hover:flex"
                  onClick={handleCreateSubtask}
                >
                  <HiPlus className="w-4 h-4" />
                </button>
              )}
              <TaskMenuButton
                task={task}
                onEdit={() => handleEditClick(task.id, task.name)}
                onDelete={task.createdAt ? () => handleDeleteClick(task.id) : undefined}
                onExportToMarkdown={onExportToMarkdown && task.createdAt ? () => onExportToMarkdown(task.id) : undefined}
                onExportToImage={onExportToImage && task.createdAt ? () => onExportToImage(task.id) : undefined}
                onDuplicateTask={onDuplicateTask && task.createdAt ? () => onDuplicateTask(task.id) : undefined}
                onArchiveTask={task.archived || !task.createdAt ? undefined : () => handleArchiveTask(task.id)}
                onUnarchiveTask={task.archived ? () => handleUnarchiveTask(task.id) : undefined}
                onTogglePin={() => handleTogglePin(task.id)}
                onChangeState={(newState) => handleChangeState(task.id, newState)}
                isPinned={task.pinned || false}
              />
            </div>
          )}
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
            <div className="text-2xs text-text-primary mb-2">
              {subtasks.length > 0 ? t('taskSidebar.deleteConfirmWithSubtasks', { count: subtasks.length }) : t('taskSidebar.deleteConfirm')}
            </div>
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

        {visibleSubtasks.length > 0 && isExpanded && (
          <AnimatePresence>
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {visibleSubtasks.map((subtask) => (
                <div key={subtask.id}>{renderExpandedTaskItem(subtask, level + 1)}</div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    );
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
            ? 'fixed inset-y-0 left-0 w-full h-full bg-bg-primary z-[1000] shadow-xl'
            : clsx('flex flex-col h-full border-r border-border-dark-light bg-bg-primary-light-strong', className)
        }
      >
        <StyledTooltip id="task-sidebar-tooltip" />
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
                        <button
                          data-tooltip-id="task-sidebar-tooltip"
                          data-tooltip-content={t('taskSidebar.closeMultiselect')}
                          className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                          onClick={handleMultiselectClose}
                        >
                          <HiXMark className="w-5 h-5 text-text-primary" />
                        </button>
                        <MultiselectMenu
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
                          tooltipId="task-sidebar-tooltip"
                          className="p-1.5 hover:bg-bg-tertiary rounded-md group"
                          icon={
                            showArchived ? (
                              <BiArchiveIn className="w-4 h-4 text-text-primary" />
                            ) : (
                              <BiArchive className="w-4 h-4 text-text-dark group-hover:text-text-muted" />
                            )
                          }
                        />
                        <button
                          data-tooltip-id="task-sidebar-tooltip"
                          data-tooltip-content={t('taskSidebar.search')}
                          className="p-1 rounded-md hover:bg-bg-tertiary transition-colors"
                          onClick={handleSearchToggle}
                        >
                          <MdOutlineSearch className="w-5 h-5 text-text-primary" />
                        </button>
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
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {!isCollapsed && isSearchVisible && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.05 }}
                className="px-2 pb-2"
              >
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
                    {sortedTasks
                      .filter((task) => !task.parentId || !sortedTasks.some((t) => t.id === task.parentId))
                      .map((task) => (
                        <div key={task.id}>{renderExpandedTaskItem(task)}</div>
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
                  <button
                    data-tooltip-id="task-sidebar-tooltip"
                    data-tooltip-content={t('taskSidebar.createTask')}
                    className="p-2 rounded-md hover:bg-bg-tertiary transition-colors"
                    onClick={handleCreateTask}
                  >
                    <HiPlus className="w-5 h-5 text-text-primary" />
                  </button>
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
            confirmButtonClass="bg-error hover:bg-error/90"
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

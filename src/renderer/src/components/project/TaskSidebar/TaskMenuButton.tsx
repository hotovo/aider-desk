import { DefaultTaskState, TaskData } from '@common/types';
import { useTranslation } from 'react-i18next';
import { MouseEvent, useRef, useState, useEffect, memo } from 'react';
import { HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { IoLogoMarkdown } from 'react-icons/io';
import { RiFlag2Line } from 'react-icons/ri';
import { MdImage, MdPushPin, MdChevronRight } from 'react-icons/md';
import { BiDuplicate, BiArchive, BiArchiveIn, BiCopy } from 'react-icons/bi';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

import { useClickOutside } from '@/hooks/useClickOutside';
import { getTaskStateLabel } from '@/components/common/TaskStateChip';

type Props = {
  task: TaskData;
  onEdit: () => void;
  onDelete?: () => void;
  onCopyAsMarkdown?: () => void;
  onExportToMarkdown?: () => void;
  onExportToImage?: () => void;
  onDuplicateTask?: () => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onTogglePin?: () => void;
  onChangeState?: (newState: string) => void;
  isPinned?: boolean;
};

export const TaskMenuButton = memo(
  ({
    task,
    onEdit,
    onDelete,
    onCopyAsMarkdown,
    onExportToMarkdown,
    onExportToImage,
    onDuplicateTask,
    onArchiveTask,
    onUnarchiveTask,
    onTogglePin,
    onChangeState,
    isPinned,
  }: Props) => {
    const { t } = useTranslation();
    const isNewTask = !task.createdAt;
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

    const handleCopyAsMarkdownClick = (e: MouseEvent) => {
      e.stopPropagation();
      onCopyAsMarkdown?.();
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
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-1 w-[170px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-10"
          >
            <ul className="display-none group-hover:display-block">
              <li
                className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleEditClick}
              >
                <HiOutlinePencil className="w-4 h-4" />
                <span className="whitespace-nowrap">{t('taskSidebar.rename')}</span>
              </li>
              {onTogglePin && !isNewTask && (
                <li
                  className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handlePinClick}
                >
                  <MdPushPin className={clsx('w-4 h-4', isPinned && 'rotate-45')} />
                  <span className="whitespace-nowrap">{isPinned ? t('taskSidebar.unpinTask') : t('taskSidebar.pinTask')}</span>
                </li>
              )}
              {onCopyAsMarkdown && (
                <li
                  className="flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handleCopyAsMarkdownClick}
                >
                  <BiCopy className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('taskSidebar.copyAsMarkdown')}</span>
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
              {task.state !== DefaultTaskState.InProgress && !isNewTask && (
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
  },
);

TaskMenuButton.displayName = 'TaskMenuButton';

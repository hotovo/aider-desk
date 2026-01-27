import { useTranslation } from 'react-i18next';
import { HiOutlineTrash } from 'react-icons/hi';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { BiArchive, BiArchiveIn } from 'react-icons/bi';

type Props = {
  hasArchived: boolean;
  onDelete: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  isOpen: boolean;
  onToggle: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLDivElement | null>;
};

export const TaskSidebarMultiSelectMenu = ({ hasArchived, onDelete, onArchive, onUnarchive, isOpen, onToggle, menuRef, buttonRef }: Props) => {
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

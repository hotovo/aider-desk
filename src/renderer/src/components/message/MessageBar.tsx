import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { UsageReportData } from '@common/types';
import { MdCallSplit, MdDeleteForever, MdDeleteSweep, MdEdit, MdRedo } from 'react-icons/md';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { twMerge } from 'tailwind-merge';

import { IconButton } from '../common/IconButton';

import { CopyMessageButton } from './CopyMessageButton';
import { UsageInfo } from './UsageInfo';

import { useClickOutside } from '@/hooks/useClickOutside';

type MenuPosition = {
  top?: number;
  bottom?: number;
  right?: number;
  left?: number;
};

type Props = {
  className?: string;
  content?: string;
  usageReport?: UsageReportData;
  remove?: () => void;
  redo?: () => void;
  edit?: () => void;
  onFork?: () => void;
  onRemoveUpTo?: () => void;
};

export const MessageBar = ({ className, content, usageReport, remove, redo, edit, onFork, onRemoveUpTo }: Props) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    setIsMenuOpen(false);
    setMenuPosition(null);
  });

  const handleToggleMenu = useCallback(() => {
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position menu above the button, aligned to the right edge
      setMenuPosition({
        bottom: window.innerHeight - rect.top + window.scrollY + 8,
        right: window.innerWidth - rect.right + window.scrollX,
      });
    } else {
      setMenuPosition(null);
    }
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen]);

  const handleRemoveClick = () => {
    remove?.();
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  const handleRedoClick = () => {
    redo?.();
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  const handleEditClick = () => {
    edit?.();
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  const handleForkClick = () => {
    onFork?.();
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  const handleRemoveUpToClick = () => {
    onRemoveUpTo?.();
    setIsMenuOpen(false);
    setMenuPosition(null);
  };

  return (
    <div className={twMerge('mt-3 pt-3 h-[30px] flex items-center justify-end gap-3 border-t border-border-dark-light px-1 relative', className)}>
      {usageReport && <UsageInfo usageReport={usageReport} className="mt-[4px]" />}
      {content && <CopyMessageButton content={content} className="transition-colors text-text-dark hover:text-text-primary" alwaysShow={true} />}
      {(remove || redo || edit || onFork || onRemoveUpTo) && (
        <div ref={buttonRef}>
          <IconButton
            icon={<FaEllipsisVertical className="w-4 h-4" />}
            onClick={handleToggleMenu}
            className="transition-colors text-text-dark hover:text-text-primary"
          />
        </div>
      )}
      {isMenuOpen &&
        menuPosition &&
        (remove || redo || edit || onFork || onRemoveUpTo) &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed min-w-[120px] bg-bg-secondary-light border border-border-default-dark rounded shadow-lg z-50"
            style={{
              top: menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
              bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
              right: menuPosition.right !== undefined ? `${menuPosition.right}px` : undefined,
              left: menuPosition.left !== undefined ? `${menuPosition.left}px` : undefined,
            }}
          >
            <ul>
              {edit && (
                <li
                  className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handleEditClick}
                >
                  <MdEdit className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('messages.edit')}</span>
                </li>
              )}
              {redo && (
                <li
                  className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handleRedoClick}
                >
                  <MdRedo className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('messages.redo')}</span>
                </li>
              )}
              {onFork && (
                <li
                  className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handleForkClick}
                >
                  <MdCallSplit className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{t('messages.forkFromHere')}</span>
                </li>
              )}
              {onRemoveUpTo && (
                <li
                  className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                  onClick={handleRemoveUpToClick}
                >
                  <MdDeleteSweep className="w-4 h-4 flex-shrink-0" />
                  <span className="whitespace-nowrap">{t('messages.deleteUpToHere')}</span>
                </li>
              )}
              {remove && (
                <li
                  className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary transition-colors hover:bg-bg-tertiary cursor-pointer"
                  onClick={handleRemoveClick}
                  title={t('messages.remove')}
                >
                  <MdDeleteForever className="w-4 h-4" />
                  <span className="whitespace-nowrap">{t('messages.delete')}</span>
                </li>
              )}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
};

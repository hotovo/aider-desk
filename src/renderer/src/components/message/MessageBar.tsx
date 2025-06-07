import { useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaDollarSign, FaEllipsisVertical } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import { UsageReportData } from '@common/types';
import { MdDeleteForever, MdRedo, MdEdit } from 'react-icons/md';

import { IconButton } from '../common/IconButton';

import { CopyMessageButton } from './CopyMessageButton';

import { useClickOutside } from '@/hooks/useClickOutside';

type Props = {
  content: string;
  usageReport?: UsageReportData;
  remove?: () => void;
  redo?: () => void;
  edit?: () => void;
};

export const MessageBar = ({ content, usageReport, remove, redo, edit }: Props) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    setIsMenuOpen(false);
  });

  const handleRemoveClick = () => {
    remove?.();
    setIsMenuOpen(false);
  };

  const handleRedoClick = () => {
    redo?.();
    setIsMenuOpen(false);
  };

  const handleEditClick = () => {
    edit?.();
    setIsMenuOpen(false);
  };

  return (
    <div className="mt-3 pt-3 h-[30px] flex items-center justify-end gap-2 border-t px-1 relative" style={{ borderColor: 'var(--theme-border-primary)' }}>
      {usageReport && (
        <div className="mt-[4px] flex items-center gap-3 px-2 text-2xs transition-colors" style={{ color: 'var(--theme-foreground-tertiary)' }}>
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.inputTokens')}>
            <FaArrowUp className="w-2.5 h-2.5 mb-[3px]" /> {usageReport.sentTokens}
          </span>
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.outputTokens')}>
            <FaArrowDown className="w-2.5 h-2.5 mb-[3px]" /> {usageReport.receivedTokens}
          </span>
          {usageReport.messageCost > 0 && (
            <span className="flex items-center gap-1">
              <FaDollarSign className="w-2.5 h-2.5 mb-[3px]" /> {usageReport.messageCost.toFixed(5)}
            </span>
          )}
        </div>
      )}
      <CopyMessageButton content={content} className="transition-colors text-[var(--theme-foreground-tertiary)] hover:text-[var(--theme-accent-primary)]" alwaysShow={true} />
      {(remove || redo || edit) && (
        <div ref={buttonRef}>
          <IconButton
            icon={<FaEllipsisVertical className="w-4 h-4" />}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="transition-colors text-[var(--theme-foreground-tertiary)] hover:text-[var(--theme-accent-primary)]"
          />
        </div>
      )}
      {isMenuOpen && (remove || redo || edit) && (
        <div ref={menuRef} className="absolute right-0 bottom-full mb-1 w-[120px] rounded shadow-lg z-10" style={{ backgroundColor: 'var(--theme-background-secondary)', borderColor: 'var(--theme-border-primary)', border: '1px solid' }}>
          <ul>
            {edit && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs cursor-pointer transition-colors"
                style={{ color: 'var(--theme-foreground-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--theme-accent-primary)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--theme-foreground-primary)';
                }}
                onClick={handleEditClick}
              >
                <MdEdit className="w-4 h-4" />
                <span className="whitespace-nowrap mb-[-4px]">{t('messages.edit')}</span>
              </li>
            )}
            {redo && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs cursor-pointer transition-colors"
                style={{ color: 'var(--theme-foreground-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--theme-accent-primary)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--theme-foreground-primary)';
                }}
                onClick={handleRedoClick}
              >
                <MdRedo className="w-4 h-4" />
                <span className="whitespace-nowrap mb-[-4px]">{t('messages.redo')}</span>
              </li>
            )}
            {remove && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs cursor-pointer transition-colors"
                style={{ color: 'var(--theme-foreground-primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--theme-button-danger)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--theme-foreground-primary)';
                }}
                onClick={handleRemoveClick}
              >
                <MdDeleteForever className="w-4 h-4" />
                <span className="whitespace-nowrap mb-[-4px]">{t('messages.delete')}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

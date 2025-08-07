import { useRef, useState } from 'react';
import { FaArrowRightFromBracket, FaArrowRightToBracket, FaDollarSign, FaEllipsisVertical, FaDownload, FaUpload } from 'react-icons/fa6';
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
    <div className="mt-3 pt-3 h-[30px] flex items-center justify-end gap-3 border-t border-border-darkLight px-1 relative">
      {usageReport && (
        <div className="mt-[4px] flex items-center gap-3 px-2 text-2xs text-text-muted group-hover:text-text-secondary transition-colors">
          {usageReport.cacheWriteTokens && usageReport.cacheWriteTokens > 0 ? (
            <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.cacheWriteTokens')}>
              <FaDownload className="w-2.5 h-2.5 mb-[3px] mr-0.5" /> {usageReport.cacheWriteTokens}
            </span>
          ) : null}
          {usageReport.cacheReadTokens && usageReport.cacheReadTokens > 0 ? (
            <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.cacheReadTokens')}>
              <FaUpload className="w-2.5 h-2.5 mb-[3px] mr-0.5" /> {usageReport.cacheReadTokens}
            </span>
          ) : null}
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.inputTokens')}>
            <FaArrowRightToBracket className="w-2.5 h-2.5 mb-[3px] mr-0.5 rotate-90" /> {usageReport.sentTokens}
          </span>
          <span className="flex items-center gap-1" data-tooltip-id="usage-info-tooltip" data-tooltip-content={t('responseMessage.outputTokens')}>
            <FaArrowRightFromBracket className="w-2.5 h-2.5 mb-[3px] mr-0.5 -rotate-90" /> {usageReport.receivedTokens}
          </span>
          {usageReport.messageCost > 0 && (
            <span className="flex items-center gap-1">
              <FaDollarSign className="w-2.5 h-2.5 mb-[3px]" /> {usageReport.messageCost.toFixed(5)}
            </span>
          )}
        </div>
      )}
      <CopyMessageButton content={content} className="transition-colors text-text-dark hover:text-text-primary" alwaysShow={true} />
      {(remove || redo || edit) && (
        <div ref={buttonRef}>
          <IconButton
            icon={<FaEllipsisVertical className="w-4 h-4" />}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="transition-colors text-text-dak hover:text-text-primary"
          />
        </div>
      )}
      {isMenuOpen && (remove || redo || edit) && (
        <div ref={menuRef} className="absolute right-0 bottom-full mb-1 w-[120px] bg-bg-secondaryLight border border-border-defaultDark rounded shadow-lg z-10">
          <ul>
            {edit && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleEditClick}
              >
                <MdEdit className="w-4 h-4" />
                <span className="whitespace-nowrap mb-[-4px]">{t('messages.edit')}</span>
              </li>
            )}
            {redo && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
                onClick={handleRedoClick}
              >
                <MdRedo className="w-4 h-4" />
                <span className="whitespace-nowrap mb-[-4px]">{t('messages.redo')}</span>
              </li>
            )}
            {remove && (
              <li
                className="flex items-center gap-1 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors"
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

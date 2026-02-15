import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MdDoneAll } from 'react-icons/md';
import { VscLock, VscUnlock } from 'react-icons/vsc';

import { IconButton } from '@/components/common/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  enabled: boolean;
  locked: boolean;
  onChange?: (enabled: boolean) => void;
  onLockChange?: (locked: boolean) => void;
  showLabel?: boolean;
};

export const AutoApprove = memo(({ enabled, locked, onChange, onLockChange, showLabel = true }: Props) => {
  const { t } = useTranslation();

  const handleClick = () => {
    onChange?.(!enabled);
    if (enabled) {
      onLockChange?.(false);
    }
  };

  const handleLockClick = () => {
    onLockChange?.(!locked);
  };

  const autoApproveContent = (
    <>
      <IconButton icon={<MdDoneAll className={`w-3.5 h-3.5 ${enabled ? 'text-agent-auto-approve' : 'text-text-muted group-hover:text-text-tertiary'}`} />} />
      {showLabel && (
        <div className={`cursor-pointer text-2xs focus:outline-none ${enabled ? 'text-text-primary' : 'text-text-muted group-hover:text-text-tertiary'}`}>
          {t('promptField.autoApprove')}
        </div>
      )}
    </>
  );

  return (
    <div className="flex items-center ml-1 group gap-2" onClick={handleClick}>
      <Tooltip content={t('promptField.autoApproveTooltip')}>
        <div className="flex items-center gap-1">{autoApproveContent}</div>
      </Tooltip>
      {enabled && (
        <IconButton
          icon={locked ? <VscLock className="w-3.5 h-3.5" /> : <VscUnlock className="w-3.5 h-3.5" />}
          onClick={handleLockClick}
          tooltip={t('promptField.autoApproveLockTooltip')}
        />
      )}
    </div>
  );
});

AutoApprove.displayName = 'AutoApprove';

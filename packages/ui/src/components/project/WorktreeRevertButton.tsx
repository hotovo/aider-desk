import { useState } from 'react';
import { MdUndo } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '@reactuses/core';

import { IconButton } from '@/components/common/IconButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  onRevert: () => void;
  disabled?: boolean;
};

export const WorktreeRevertButton = ({ onRevert, disabled }: Props) => {
  const { t } = useTranslation();
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);
  const [revertDisabled, setRevertDisabled] = useLocalStorage('worktree-revert-confirmation-disabled', false);

  const handleRevertClick = () => {
    if (revertDisabled) {
      onRevert();
    } else {
      setShowRevertConfirm(true);
    }
  };

  const handleRevertConfirm = () => {
    setShowRevertConfirm(false);
    onRevert();
  };

  return (
    <>
      <IconButton
        icon={<MdUndo className="w-4 h-4" />}
        onClick={handleRevertClick}
        disabled={disabled}
        tooltip={t('worktree.revertTooltip')}
        className="p-1 hover:bg-bg-tertiary rounded-md"
      />

      {showRevertConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmRevertTitle')}
          onConfirm={handleRevertConfirm}
          onCancel={() => setShowRevertConfirm(false)}
          confirmButtonText={t('worktree.revert')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmRevertMessage')}</p>
          <Checkbox label={t('worktree.dontAskAgain')} checked={revertDisabled || false} onChange={setRevertDisabled} />
        </ConfirmDialog>
      )}
    </>
  );
};

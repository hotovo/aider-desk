import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from './BaseDialog';
import { Button } from './Button';

type Props = {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
  children: ReactNode;
  disabled?: boolean;
  confirmButtonClass?: string;
  width?: number;
  closeOnEscape?: boolean;
};

export const ConfirmDialog = ({
  title,
  onConfirm,
  onCancel,
  confirmButtonText,
  cancelButtonText,
  children,
  disabled = false,
  confirmButtonClass,
  width,
  closeOnEscape = false,
}: Props) => {
  const { t } = useTranslation();
  const resolvedConfirmText = confirmButtonText ?? t('common.confirm');
  const resolvedCancelText = cancelButtonText ?? t('common.cancel');
  return (
    <BaseDialog
      title={title}
      onClose={onCancel}
      width={width}
      footer={
        <>
          <Button onClick={onCancel} variant="text">
            {resolvedCancelText}
          </Button>
          <Button onClick={onConfirm} autoFocus={true} disabled={disabled} variant="contained" className={confirmButtonClass}>
            {resolvedConfirmText}
          </Button>
        </>
      }
      closeOnEscape={closeOnEscape}
    >
      {children}
    </BaseDialog>
  );
};

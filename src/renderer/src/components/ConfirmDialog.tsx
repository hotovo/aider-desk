import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from './BaseDialog';
import { Button } from './common/Button';

type Props = {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
  disabled?: boolean;
  confirmButtonClass?: string;
  width?: number;
  closeOnEscape?: boolean;
  children: ReactNode;
};

export const ConfirmDialog = ({
  title,
  onConfirm,
  onCancel,
  confirmButtonText,
  cancelButtonText,
  disabled,
  confirmButtonClass,
  width,
  closeOnEscape,
  children
}: Props) => {
  const { t } = useTranslation();
  const finalConfirmText = confirmButtonText || t('common.confirm');
  const finalCancelText = cancelButtonText || t('common.cancel');
  return (
    <BaseDialog
      title={title}
      onClose={onCancel}
      width={width}
      footer={
        <>
          <Button onClick={onCancel} variant="text">
            {finalCancelText}
          </Button>
          <Button onClick={onConfirm} autoFocus={true} disabled={disabled} variant="contained" className={confirmButtonClass}>
            {finalConfirmText}
          </Button>
        </>
      }
      closeOnEscape={closeOnEscape}
    >
      {children}
    </BaseDialog>
  );
};

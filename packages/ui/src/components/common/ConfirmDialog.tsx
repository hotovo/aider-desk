import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { BaseDialog } from './BaseDialog';
import { Button, ButtonColor } from './Button';

type Props = {
  title: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmButtonText?: string;
  cancelButtonText?: string;
  contentClass?: string;
  children: ReactNode;
  disabled?: boolean;
  confirmButtonClass?: string;
  confirmButtonColor?: ButtonColor;
  width?: number;
  closeOnEscape?: boolean;
  footerAdditionalComponents?: ReactNode;
};

export const ConfirmDialog = ({
  title,
  onConfirm,
  onCancel,
  confirmButtonText,
  cancelButtonText,
  contentClass,
  children,
  disabled = false,
  confirmButtonClass,
  confirmButtonColor,
  width,
  closeOnEscape = false,
  footerAdditionalComponents,
}: Props) => {
  const { t } = useTranslation();
  const resolvedConfirmText = confirmButtonText ?? t('common.confirm');
  const resolvedCancelText = cancelButtonText ?? t('common.cancel');
  return (
    <BaseDialog
      title={title}
      onClose={onCancel}
      width={width}
      contentClass={contentClass}
      footer={
        <>
          {footerAdditionalComponents}
          <Button onClick={onCancel} variant="text">
            {resolvedCancelText}
          </Button>
          <Button onClick={onConfirm} autoFocus={true} disabled={disabled} variant="contained" className={confirmButtonClass} color={confirmButtonColor}>
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

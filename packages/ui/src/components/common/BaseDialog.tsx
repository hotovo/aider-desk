import { FocusTrap } from 'focus-trap-react';
import { ReactNode, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { twMerge } from 'tailwind-merge';
import { useHotkeys } from 'react-hotkeys-hook';

type Props = {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  contentClass?: string;
  footer?: ReactNode;
  width?: number;
  closeOnEscape?: boolean;
  closeButtonText?: string;
};

export const BaseDialog = ({ title, onClose, children, contentClass, footer, width = 500, closeOnEscape = true, closeButtonText }: Props) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useHotkeys(
    'escape',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    },
    { enabled: closeOnEscape, enableOnFormTags: true, enableOnContentEditable: true, scopes: 'dialog' },
  );

  return (
    <div
      className="fixed inset-0 top-0 bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
      data-dialog-open="true"
    >
      <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false }}>
        <div
          style={{ width: `${width}px` }}
          className="bg-bg-secondary-light-strongest shadow-2xl rounded-xl border border-bg-tertiary-strong max-h-[90vh] flex flex-col"
          ref={dialogRef}
        >
          <div className="px-6 py-4 border-b border-bg-tertiary-strong flex-shrink-0">
            <h2 className="text-lg font-medium text-text-primary uppercase">{title}</h2>
          </div>
          <div
            className={twMerge(
              'p-6 flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth scrollbar-thumb-rounded-full',
              contentClass,
            )}
          >
            {children}
          </div>
          <div className="px-6 py-4 border-t border-bg-tertiary-strong flex justify-end space-x-3 flex-shrink-0">
            {footer || (
              <button onClick={onClose} className="bg-bg-fourth text-text-primary px-4 py-2 rounded hover:bg-bg-fifth">
                {closeButtonText || t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

import { FocusTrap } from 'focus-trap-react';
import { ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  closeOnEscape?: boolean;
};

export const BaseDialog = ({ title, onClose, children, footer, width = 384, closeOnEscape = false }: Props) => {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!closeOnEscape) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, onClose]);

  return (
    <div className="fixed inset-0 top-0 bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <FocusTrap
        focusTrapOptions={{
          allowOutsideClick: true,
        }}
      >
        <div
          style={{ width: `${width}px` }}
          className="bg-bg-secondaryLight80 shadow-2xl rounded-xl border border-bg-tertiary50 max-h-[90vh] flex flex-col"
          ref={dialogRef}
        >
          <div className="px-6 py-4 border-b border-bg-tertiary50 flex-shrink-0">
            <h2 className="text-lg font-medium text-text-primary uppercase">{title}</h2>
          </div>
          <div className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondaryLight scrollbar-thumb-bg-fourth scrollbar-thumb-rounded-full">
            {children}
          </div>
          <div className="px-6 py-4 border-t border-bg-tertiary50 flex justify-end space-x-3 flex-shrink-0">
            {footer || (
              <button onClick={onClose} className="bg-bg-fourth text-text-primary px-4 py-2 rounded hover:bg-bg-fifth">
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

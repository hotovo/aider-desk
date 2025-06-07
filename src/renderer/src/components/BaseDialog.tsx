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
    <div className="fixed inset-0 top-0 bottom-0 left-0 right-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto" style={{ backgroundColor: 'var(--modal-backdrop)' }}>
      <FocusTrap
        focusTrapOptions={{
          allowOutsideClick: true,
        }}
      >
        <div
          style={{ 
            width: `${width}px`,
            backgroundColor: 'var(--theme-background-primary, #ffffff)',
            borderColor: 'var(--theme-border-primary, #cccccc)',
            color: 'var(--theme-foreground-primary, #000000)'
          }}
          className="shadow-2xl rounded-xl border max-h-[90vh] flex flex-col"
          ref={dialogRef}
        >
          <div 
            className="px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--theme-border-primary)' }}
          >
            <h2 
              className="text-lg font-medium uppercase"
              style={{ color: 'var(--theme-foreground-primary)' }}
            >
              {title}
            </h2>
          </div>
          <div 
            className="p-6 flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-[var(--theme-background-tertiary)] scrollbar-thumb-[var(--theme-border-secondary)] scrollbar-thumb-rounded-full"
            style={{ backgroundColor: 'var(--theme-background-primary)' }}
          >
            {children}
          </div>
          <div 
            className="px-6 py-4 border-t flex justify-end space-x-3 flex-shrink-0"
            style={{ borderColor: 'var(--theme-border-primary)' }}
          >
            {footer || (
              <button 
                onClick={onClose} 
                className="px-4 py-2 rounded transition-colors"
                style={{
                  backgroundColor: 'var(--theme-button-secondary)',
                  color: 'var(--theme-foreground-primary)'
                }}
              >
                {t('common.cancel')}
              </button>
            )}
          </div>
        </div>
      </FocusTrap>
    </div>
  );
};

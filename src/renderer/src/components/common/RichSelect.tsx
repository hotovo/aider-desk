import { KeyboardEvent, ReactNode, useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiCheck, HiChevronUpDown } from 'react-icons/hi2';
import { clsx } from 'clsx';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useDropdownState } from '@/hooks/useDropdownState';
import { KeyboardKeys } from '@/constants/keyboardKeys';

export type RichSelectOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
};

type Props = {
  options: RichSelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  renderTrigger?: (selected: RichSelectOption | undefined, isOpen: boolean) => ReactNode;
  triggerClassName?: string;
  menuWidth?: number;
  align?: 'left' | 'right';
  placement?: 'bottom' | 'top';
  disabled?: boolean;
  ariaLabel?: string;
};

export const RichSelect = ({
  options,
  value,
  onChange,
  renderTrigger,
  triggerClassName,
  menuWidth = 260,
  align = 'left',
  placement = 'bottom',
  disabled = false,
  ariaLabel,
}: Props) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  const { isOpen, state, open, close, toggle, updateState } = useDropdownState({
    initialState: { highlightedIndex: -1 },
    onCloseReset: { highlightedIndex: -1 },
  });

  useClickOutside([containerRef, menuRef], close, isOpen);

  const handleToggle = useCallback(() => {
    if (disabled) {
      return;
    }
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const left = align === 'right' ? rect.right + window.scrollX - menuWidth : rect.left + window.scrollX;
      setPosition({
        top: placement === 'top' ? rect.top + window.scrollY : rect.bottom + window.scrollY,
        left,
      });
      open({ highlightedIndex: options.findIndex((opt) => opt.value === value) });
    } else {
      toggle();
    }
  }, [disabled, isOpen, align, menuWidth, placement, open, options, value, toggle]);

  const handleSelect = (option: RichSelectOption) => {
    close();
    onChange?.(option.value);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === KeyboardKeys.Enter || e.key === KeyboardKeys.Space) {
        e.preventDefault();
        handleToggle();
      }
      return;
    }

    switch (e.key) {
      case KeyboardKeys.Escape:
        e.preventDefault();
        close();
        break;
      case KeyboardKeys.ArrowDown:
        e.preventDefault();
        updateState((prev) => ({ highlightedIndex: prev.highlightedIndex >= options.length - 1 ? 0 : prev.highlightedIndex + 1 }));
        break;
      case KeyboardKeys.ArrowUp:
        e.preventDefault();
        updateState((prev) => ({ highlightedIndex: prev.highlightedIndex <= 0 ? options.length - 1 : prev.highlightedIndex - 1 }));
        break;
      case KeyboardKeys.Enter:
        e.preventDefault();
        if (state.highlightedIndex >= 0 && state.highlightedIndex < options.length) {
          handleSelect(options[state.highlightedIndex]);
        }
        break;
      case KeyboardKeys.Tab:
        close();
        break;
    }
  };

  const defaultTrigger = (
    <div
      className={clsx(
        'flex items-center gap-2 bg-bg-secondary-light border-2 border-border-default rounded px-2 py-1 text-xs text-text-primary',
        isOpen && 'border-border-light',
        triggerClassName,
      )}
    >
      {selectedOption?.icon}
      <span className="flex-1 truncate">{selectedOption?.label}</span>
      <HiChevronUpDown className="size-4 text-text-muted flex-shrink-0" />
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={disabled}
        className="flex items-center focus:outline-none disabled:opacity-50"
      >
        {renderTrigger ? renderTrigger(selectedOption, isOpen) : defaultTrigger}
      </button>

      {isOpen &&
        position &&
        createPortal(
          <ul
            ref={menuRef}
            className="absolute z-50 mt-1 max-h-72 overflow-auto rounded-md bg-bg-secondary-light py-1 ring-1 shadow-lg ring-black/5 focus:outline-none scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth"
            style={{
              top: placement === 'top' ? undefined : `${position.top}px`,
              bottom: placement === 'top' ? `${window.innerHeight - position.top + 4}px` : undefined,
              left: `${position.left}px`,
              width: `${menuWidth}px`,
            }}
            role="listbox"
          >
            {options.map((opt, index) => (
              <li
                key={opt.value}
                onClick={() => handleSelect(opt)}
                className={clsx(
                  'relative flex cursor-pointer select-none items-start gap-2.5 px-3 py-2',
                  selectedOption?.value === opt.value || state.highlightedIndex === index ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary',
                )}
                role="option"
                aria-selected={selectedOption?.value === opt.value}
              >
                {opt.icon && <span className="mt-0.5 flex-shrink-0">{opt.icon}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs font-medium text-text-primary">{opt.label}</div>
                  {opt.description && <div className="mt-0.5 text-2xs leading-snug text-text-muted-light">{opt.description}</div>}
                </div>
                {selectedOption?.value === opt.value && <HiCheck className="mt-0.5 size-4 flex-shrink-0 text-text-tertiary" />}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};

export default RichSelect;

import { ReactNode, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown, HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useDropdownState } from '@/hooks/useDropdownState';
import { KeyboardKeys } from '@/constants/keyboardKeys';

export type Option = {
  label: ReactNode;
  value: string;
  style?: React.CSSProperties;
};

type Props = {
  label?: ReactNode;
  options?: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
};

export const Select = ({ label, className = '', options = [], value, onChange, size = 'md', disabled = false }: Props) => {
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);
  const { t } = useTranslation();

  const { isOpen, state, open, close, toggle, updateState } = useDropdownState({
    initialState: { highlightedIndex: -1 },
    onCloseReset: { highlightedIndex: -1 },
  });

  // Pass both refs to useClickOutside
  useClickOutside([containerRef, dropdownRef], close);

  const handleToggleDropdown = useCallback(() => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
      open({ highlightedIndex: options.findIndex((opt) => opt.value === value) });
    } else {
      toggle();
    }
  }, [isOpen, open, toggle, options, value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === KeyboardKeys.Enter || e.key === KeyboardKeys.Space) {
        e.preventDefault();
        handleToggleDropdown();
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
        updateState((prev) => ({
          highlightedIndex: prev.highlightedIndex >= options.length - 1 ? 0 : prev.highlightedIndex + 1,
        }));
        break;
      case KeyboardKeys.ArrowUp:
        e.preventDefault();
        updateState((prev) => ({
          highlightedIndex: prev.highlightedIndex <= 0 ? options.length - 1 : prev.highlightedIndex - 1,
        }));
        break;
      case KeyboardKeys.Enter:
        e.preventDefault();
        if (state.highlightedIndex >= 0 && state.highlightedIndex < options.length) {
          handleOptionSelect(options[state.highlightedIndex]);
        }
        break;
      case KeyboardKeys.Tab:
        close();
        break;
    }
  };

  const handleOptionSelect = (option: Option) => {
    close();
    onChange?.(option.value);
  };

  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      {/* Button container */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={handleToggleDropdown}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
          className={`flex w-full min-w-[8rem] bg-bg-secondary-light border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary placeholder-text-muted pl-2 pr-1 ${sizeClasses[size]} ${className}`}
        >
          <span className="col-start-1 row-start-1 flex items-center flex-1 min-w-0">
            <span className="block truncate">{selectedOption?.label || t('select.placeholder')}</span>
          </span>
          {!disabled && <HiChevronUpDown className="col-start-1 row-start-1 size-5 self-center justify-self-end text-text-muted" />}
        </button>
      </div>

      {/* Portal for Dropdown */}
      {isOpen &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={dropdownRef}
            className="select-dropdown absolute z-50 mt-1 max-h-56 overflow-auto rounded-md bg-bg-secondary-light py-1 ring-1 shadow-lg ring-black/5 focus:outline-none text-sm scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
            role="listbox"
          >
            {options.map((opt, index) => (
              <li
                key={opt.value}
                onClick={() => handleOptionSelect(opt)}
                className={`relative cursor-default py-2 pr-9 pl-3 text-text-primary select-none text-sm ${sizeClasses[size]}
                ${selectedOption?.value === opt.value ? 'bg-bg-tertiary' : ''}
                ${state.highlightedIndex === index ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary'}`}
                aria-selected={selectedOption?.value === opt.value}
                role="option"
              >
                <div className="flex items-center">
                  <span className="block truncate" style={opt.style}>
                    {opt.label}
                  </span>
                </div>
                {selectedOption?.value === opt.value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-text-tertiary">
                    <HiCheck className="size-4" />
                  </span>
                )}
              </li>
            ))}
          </ul>,
          document.body, // Render into the body
        )}
    </div>
  );
};

export default Select;

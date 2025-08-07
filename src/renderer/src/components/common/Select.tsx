import { ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown, HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';
import './Select.css';

export type Option = {
  label: ReactNode;
  value: string;
};

type Props = {
  label?: ReactNode;
  options?: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const Select = ({ label, className = '', options = [], value, onChange, size = 'md' }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null); // Ref for the dropdown itself
  const selectedOption = options.find((opt) => opt.value === value);
  const { t } = useTranslation();

  // Pass both refs to useClickOutside
  useClickOutside([containerRef, dropdownRef], () => setIsOpen(false));

  const handleToggleDropdown = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setIsOpen(!isOpen);
  };

  const handleOptionSelect = (option: Option) => {
    setIsOpen(false);
    onChange?.(option.value);
  };

  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{label}</label>}
      {/* Button container */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={handleToggleDropdown}
          className={`flex w-full min-w-[8rem] bg-[var(--color-bg-secondary-light)] border-2 border-[var(--color-border-default)] rounded focus:outline-none focus:border-[var(--color-border-light)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] pl-2 pr-1 ${sizeClasses[size]} ${className}`}
        >
          <span className="col-start-1 row-start-1 flex items-center flex-1 min-w-0">
            <span className="block truncate">{selectedOption?.label || t('select.placeholder')}</span>
          </span>
          <HiChevronUpDown className="col-start-1 row-start-1 size-5 self-center justify-self-end text-neutral-500" />
        </button>
      </div>

      {/* Portal for Dropdown */}
      {isOpen &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={dropdownRef}
            className="select-dropdown absolute z-50 mt-1 max-h-56 overflow-auto rounded-md bg-[var(--color-bg-secondary-light)] py-1 ring-1 shadow-lg ring-black/5 focus:outline-none text-sm scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-200"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
            role="listbox"
          >
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => handleOptionSelect(opt)}
                className={`relative cursor-default py-2 pr-9 pl-3 text-[var(--color-text-primary)] select-none text-sm ${sizeClasses[size]}
                ${selectedOption?.value === opt.value ? 'bg-[var(--color-bg-tertiary)]' : 'hover:bg-[var(--color-bg-tertiary)]'}`}
                role="option"
              >
                <div className="flex items-center">
                  <span className="block truncate">{opt.label}</span>
                </div>
                {selectedOption?.value === opt.value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-[var(--color-text-tertiary)]">
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

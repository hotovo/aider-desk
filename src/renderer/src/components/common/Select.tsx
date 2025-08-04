import { ReactNode, useRef, useState, useEffect } from 'react';
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
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
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
      setHighlightedIndex(options.findIndex((opt) => opt.value === value));
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggleDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev >= options.length - 1 ? 0 : prev + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev <= 0 ? options.length - 1 : prev - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          handleOptionSelect(options[highlightedIndex]);
        }
        break;
    }
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
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      {/* Button container */}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={handleToggleDropdown}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={`flex w-full min-w-[8rem] bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 placeholder-neutral-500 pl-2 pr-1 ${sizeClasses[size]} ${className}`}
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
            className="select-dropdown absolute z-50 mt-1 max-h-56 overflow-auto rounded-md bg-neutral-800 py-1 ring-1 shadow-lg ring-black/5 focus:outline-none text-sm scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-600 hover:scrollbar-thumb-neutral-200"
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
                className={`relative cursor-default py-2 pr-9 pl-3 text-neutral-100 select-none text-sm ${sizeClasses[size]}
                ${selectedOption?.value === opt.value ? 'bg-neutral-700' : ''}
                ${highlightedIndex === index ? 'bg-neutral-700' : 'hover:bg-neutral-700'}`}
                aria-selected={selectedOption?.value === opt.value}
                role="option"
              >
                <div className="flex items-center">
                  <span className="block truncate">{opt.label}</span>
                </div>
                {selectedOption?.value === opt.value && (
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-neutral-300">
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

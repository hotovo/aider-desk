import { useState, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { Checkbox } from './Checkbox';

import { useClickOutside } from '@/hooks/useClickOutside';

import './MultiSelect.css';

type Option = {
  value: string;
  label: string;
};

type Props = {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  noneSelectedLabel?: string;
};

export const MultiSelect = ({ options, selected, onChange, label, className, size = 'md', noneSelectedLabel }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  useClickOutside([containerRef, dropdownRef], () => setIsOpen(false));

  const handleToggle = () => {
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

  const handleCheckboxChange = (value: string) => {
    const newSelected = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((option) => option.value));
    }
  };

  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      <button
        type="button"
        className={`flex w-full min-w-[8rem] bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 placeholder-neutral-500 pl-2 pr-1 ${sizeClasses[size]} ${className}`}
        onClick={handleToggle}
      >
        <span className="col-start-1 row-start-1 flex items-center flex-1 min-w-0">
          <span className="block truncate">
            {selected.length === 0 && options.length > 0
              ? noneSelectedLabel || t('multiselect.noneSelected')
              : selected.length === options.length
                ? t('multiselect.allSelected')
                : t('multiselect.someSelected', { count: selected.length })}
          </span>
        </span>
        <HiChevronUpDown className="col-start-1 row-start-1 size-5 self-center justify-self-end text-neutral-500" />
      </button>

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
            <li
              className={`relative cursor-default py-2 pr-9 pl-3 text-neutral-100 select-none text-sm ${sizeClasses[size]} hover:bg-neutral-700`}
              onClick={handleSelectAll}
            >
              <Checkbox label={t('multiselect.selectAll')} checked={selected.length === options.length} onChange={() => {}} />
            </li>
            {options.map((option) => (
              <li
                key={option.value}
                className={`relative cursor-default py-2 pr-9 pl-3 text-neutral-100 select-none text-sm ${sizeClasses[size]} hover:bg-neutral-700`}
                onClick={() => handleCheckboxChange(option.value)}
              >
                <Checkbox label={option.label} checked={selected.includes(option.value)} onChange={() => {}} />
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
};

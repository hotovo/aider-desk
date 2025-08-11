import { useState, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { Checkbox } from './Checkbox';

import { useClickOutside } from '@/hooks/useClickOutside';

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
  filterInput?: boolean;
};

export const MultiSelect = ({ options, selected, onChange, label, className, size = 'md', noneSelectedLabel, filterInput = false }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [filterTerm, setFilterTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);

  useClickOutside([containerRef, dropdownRef], () => {
    setIsOpen(false);
    setFilterTerm('');
  });

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
    if (!isOpen) {
      setFilterTerm('');
    }
  };

  const filteredOptions = filterInput
    ? options.filter((option) => option.label.toLowerCase().includes(filterTerm.toLowerCase()) || option.value.toLowerCase().includes(filterTerm.toLowerCase()))
    : options;

  const handleCheckboxChange = (value: string) => {
    const newSelected = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
    onChange(newSelected);
  };

  const handleSelectAll = () => {
    const relevantOptions = filterInput ? filteredOptions : options;
    if (selected.length === relevantOptions.length) {
      onChange([]);
    } else {
      onChange(relevantOptions.map((option) => option.value));
    }
  };

  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      {filterInput ? (
        <input
          type="text"
          className={`flex w-full min-w-[8rem] bg-bg-secondaryLight border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary placeholder-text-muted pl-2 pr-8 ${sizeClasses[size]} ${className}`}
          placeholder={
            selected.length === 0 && options.length > 0
              ? noneSelectedLabel || t('multiselect.noneSelected')
              : selected.length === options.length
                ? t('multiselect.allSelected')
                : t('multiselect.someSelected', { count: selected.length })
          }
          value={filterTerm}
          onChange={(e) => setFilterTerm(e.target.value)}
          onFocus={handleToggle}
        />
      ) : (
        <button
          type="button"
          className={`flex w-full min-w-[8rem] bg-bg-secondaryLight border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary placeholder-text-muted pl-2 pr-1 ${sizeClasses[size]} ${className}`}
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
          <HiChevronUpDown className="col-start-1 row-start-1 size-5 self-center justify-self-end text-text-muted" />
        </button>
      )}
      {filterInput && (
        <HiChevronUpDown
          className="absolute right-2 top-1/2 transform -translate-y-1/2 size-5 text-text-muted pointer-events-none"
          style={{ top: label ? 'calc(50% + 0.625rem)' : '50%' }}
        />
      )}

      {isOpen &&
        dropdownPosition &&
        createPortal(
          <ul
            ref={dropdownRef}
            className="select-dropdown absolute z-50 mt-1 max-h-56 overflow-auto rounded-md bg-bg-secondaryLight py-1 ring-1 shadow-lg ring-black/5 focus:outline-none text-sm scrollbar-thin scrollbar-track-bg-secondaryLight scrollbar-thumb-bg-fourth"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
            role="listbox"
          >
            <li
              className={`relative cursor-default py-2 pr-9 pl-3 text-text-primary select-none text-sm ${sizeClasses[size]} hover:bg-bg-tertiary`}
              onClick={handleSelectAll}
            >
              <Checkbox label={t('multiselect.selectAll')} checked={selected.length === filteredOptions.length} onChange={() => {}} />
            </li>
            {filteredOptions.map((option) => (
              <li
                key={option.value}
                className={`relative cursor-default py-2 pr-9 pl-3 text-text-primary select-none text-sm ${sizeClasses[size]} hover:bg-bg-tertiary`}
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

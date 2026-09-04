import { KeyboardEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUpDown, HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useDropdownState } from '@/hooks/useDropdownState';
import { KeyboardKeys } from '@/constants/keyboardKeys';
import { Option } from '@/components/common/Select';

type Props = {
  label?: ReactNode;
  options?: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  placement?: 'bottom' | 'top';
  placeholder?: string;
};

const getOptionText = (opt: Option): string => (typeof opt.label === 'string' ? opt.label : opt.value);

export const SearchableSelect = ({
  label,
  className = '',
  options = [],
  value,
  onChange,
  size = 'md',
  disabled = false,
  placement = 'bottom',
  placeholder,
}: Props) => {
  const { t } = useTranslation();
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);
  const selectedText = selectedOption ? getOptionText(selectedOption) : '';

  const { isOpen, state, open, close, updateState } = useDropdownState({
    initialState: { highlightedIndex: -1, search: '' },
    onCloseReset: { highlightedIndex: -1, search: '' },
  });

  useClickOutside([containerRef, dropdownRef], close, isOpen);

  const filteredOptions = useMemo(() => {
    const search = state.search.trim().toLowerCase();
    if (!search) {
      return options;
    }

    return options.filter((opt) => getOptionText(opt).toLowerCase().includes(search));
  }, [options, state.search]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const highlighted = listRef.current?.children[state.highlightedIndex] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [state.highlightedIndex]);

  const handleOpen = () => {
    if (disabled || isOpen || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: placement === 'top' ? rect.top + window.scrollY : rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
    open({ highlightedIndex: -1, search: '' });
  };

  const handleSearchChange = (search: string) => {
    updateState({ search, highlightedIndex: -1 });
  };

  const handleOptionSelect = (option: Option) => {
    close();
    onChange?.(option.value);
  };

  const handleInputKeyDown = (e: KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === KeyboardKeys.ArrowDown || e.key === KeyboardKeys.ArrowUp || e.key === KeyboardKeys.Enter) {
        e.preventDefault();
        handleOpen();
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
          highlightedIndex: filteredOptions.length === 0 ? -1 : prev.highlightedIndex >= filteredOptions.length - 1 ? 0 : prev.highlightedIndex + 1,
          search: prev.search,
        }));
        break;
      case KeyboardKeys.ArrowUp:
        e.preventDefault();
        updateState((prev) => ({
          highlightedIndex: filteredOptions.length === 0 ? -1 : prev.highlightedIndex <= 0 ? filteredOptions.length - 1 : prev.highlightedIndex - 1,
          search: prev.search,
        }));
        break;
      case KeyboardKeys.Enter: {
        e.preventDefault();
        const selected = filteredOptions[state.highlightedIndex >= 0 ? state.highlightedIndex : 0];
        if (selected) {
          handleOptionSelect(selected);
        }
        break;
      }
    }
  };

  const handleBlur = () => {
    if (isOpen) {
      close();
    }
  };

  const handleChevronMouseDown = (e: MouseEvent<SVGSVGElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) {
      close();
    } else {
      handleOpen();
    }
  };

  const sizeClasses = {
    sm: 'py-1 text-xs',
    md: 'py-2 text-sm',
    lg: 'py-3 text-base',
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <div
        className={`flex w-full min-w-[8rem] items-center bg-bg-secondary-light border-2 border-border-default rounded focus-within:outline-none focus-within:border-border-light text-text-primary placeholder-text-muted pl-2 pr-1 ${sizeClasses[size]} ${className}`}
        onMouseDown={() => handleOpen()}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? state.search : selectedText}
          onChange={(e) => {
            handleOpen();
            handleSearchChange(e.target.value);
          }}
          onFocus={handleOpen}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
          placeholder={placeholder || t('select.placeholder')}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className="w-full min-w-0 bg-transparent outline-none placeholder-text-muted"
        />
        {!disabled && <HiChevronUpDown className="size-5 shrink-0 cursor-pointer text-text-muted" onMouseDown={handleChevronMouseDown} />}
      </div>

      {isOpen &&
        dropdownPosition &&
        createPortal(
          <div
            ref={dropdownRef}
            className="select-dropdown absolute z-50 mt-1 rounded-md bg-bg-secondary-light py-1 ring-1 shadow-lg ring-black/5 focus:outline-none text-sm scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth"
            style={{
              top: placement === 'top' ? undefined : `${dropdownPosition.top}px`,
              bottom: placement === 'top' ? `${window.innerHeight - dropdownPosition.top + 4}px` : undefined,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            <ul
              ref={listRef}
              className="max-h-56 overflow-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth"
              role="listbox"
              onMouseDown={(e) => e.preventDefault()}
            >
              {filteredOptions.map((opt, index) => (
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
              {filteredOptions.length === 0 && <li className="py-2 px-3 text-xs text-text-muted select-none">{t('select.noMatches')}</li>}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default SearchableSelect;

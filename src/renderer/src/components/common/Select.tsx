import { useRef, useState } from 'react';
import { HiChevronUpDown, HiCheck } from 'react-icons/hi2';
import { useTranslation } from 'react-i18next';

import { useClickOutside } from '@/hooks/useClickOutside';

export type Option = {
  label: string;
  value: string;
};

type Props = {
  label?: string;
  options?: Option[];
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
};

export const Select = ({ label, className = '', options = [], value, onChange }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useClickOutside(containerRef, () => setIsOpen(false));

  const handleOptionSelect = (option: Option) => {
    setIsOpen(false);
    onChange?.(option.value);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full min-w-[8rem] p-2 bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 text-sm placeholder-neutral-500 ${className}`}
      >
        <span className="col-start-1 row-start-1 flex items-center flex-1 min-w-0">
          <span className="block truncate">{selectedOption?.label || t('select.placeholder')}</span>
        </span>
        <HiChevronUpDown className="col-start-1 row-start-1 size-5 self-center justify-self-end text-neutral-500" />
      </button>

      {isOpen && (
        <ul
          className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md bg-neutral-800 py-1 text-base ring-1 shadow-lg ring-black/5 focus:outline-hidden text-sm"
          role="listbox"
        >
          {options.map((opt) => (
            <li
              key={opt.value}
              onClick={() => handleOptionSelect(opt)}
              className={`relative cursor-default py-2 pr-9 pl-3 text-neutral-100 select-none text-sm
                ${selectedOption?.value === opt.value ? 'bg-neutral-700' : 'hover:bg-neutral-700'}
              `}
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
        </ul>
      )}
    </div>
  );
};

export default Select;

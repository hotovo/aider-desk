import { ReactNode, useRef, useState } from 'react';

import { useClickOutside } from '@/hooks/useClickOutside';

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
};

export const Select = ({ label, className = '', options = [], value, onChange }: Props) => {
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
        className={`flex w-full p-2 bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 text-sm placeholder-neutral-500 ${className}`}
      >
        <span className="col-start-1 row-start-1 flex items-center flex-1">
          <span className="block truncate">{selectedOption?.label || 'Select an option'}</span>
        </span>
        <svg
          className="col-start-1 row-start-1 size-5 self-center justify-self-end text-neutral-500"
          viewBox="0 0 16 16"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.22 10.22a.75.75 0 0 1 1.06 0L8 11.94l1.72-1.72a.75.75 0 1 1 1.06 1.06l-2.25 2.25a.75.75 0 0 1-1.06 0l-2.25-2.25a.75.75 0 0 1 0-1.06ZM10.78 5.78a.75.75 0 0 1-1.06 0L8 4.06 6.28 5.78a.75.75 0 0 1-1.06-1.06l2.25-2.25a.75.75 0 0 1 1.06 0l2.25 2.25a.75.75 0 0 1 0 1.06Z"
            clipRule="evenodd"
          />
        </svg>
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
                  <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
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

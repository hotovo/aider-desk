import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react';
import { Fragment, ReactNode } from 'react';
import { HiCheck, HiChevronDown } from 'react-icons/hi2';
import { clsx } from 'clsx';

export type CompactOption = {
  label: ReactNode;
  value: string;
};

type Props = {
  options: CompactOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export const CompactSelect = ({ options, value, onChange, className }: Props) => {
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className={clsx('relative inline-block text-left', className)}>
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <ListboxButton className="flex rounded-md items-center gap-1 px-2 py-0.5 hover:bg-bg-primary transition-colors text-3xs text-text-muted hover:text-text-primary focus:outline-none">
            <span className="block truncate">{selectedOption?.label}</span>
            <HiChevronDown className="size-3" aria-hidden="true" />
          </ListboxButton>

          <Transition as={Fragment} leave="transition ease-in duration-100" leaveFrom="opacity-100" leaveTo="opacity-0">
            <ListboxOptions className="absolute right-0 z-50 mt-1 max-h-60 min-w-[120px] overflow-auto rounded-md bg-bg-primary py-1 shadow-lg focus:outline-none text-3xs scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth">
              {options.map((option) => (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={({ focus, selected }) =>
                    clsx(
                      'relative cursor-pointer select-none py-1 pl-7 pr-4 transition-colors',
                      focus ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted',
                      selected && 'text-text-primary font-medium',
                    )
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className="block truncate">{option.label}</span>
                      {selected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2 text-text-tertiary">
                          <HiCheck className="size-3" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
};

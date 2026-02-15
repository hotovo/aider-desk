import React, { useRef, useState } from 'react';
import { FaEllipsisVertical } from 'react-icons/fa6';
import { clsx } from 'clsx';

import { useClickOutside } from '@/hooks/useClickOutside';

export type MenuOption = {
  label: string;
  action: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
};

type Props = {
  options: MenuOption[];
  className?: string;
};

export const VerticalDotsMenu = ({ options, className }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  useClickOutside([menuRef, buttonRef], () => {
    setIsMenuOpen(false);
  });

  const handleMenuClick = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleOptionClick = (option: MenuOption) => {
    if (!option.disabled) {
      option.action();
      setIsMenuOpen(false);
    }
  };

  return (
    <div className={clsx('relative', className)}>
      <div ref={buttonRef}>
        <button
          className={clsx(
            'transition-opacity p-1.5 rounded-md hover:bg-bg-tertiary text-text-muted hover:text-text-primary',
            !isMenuOpen && 'opacity-0 group-hover:opacity-100',
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleMenuClick();
          }}
        >
          <FaEllipsisVertical className="w-4 h-4" />
        </button>
      </div>
      {isMenuOpen && (
        <div ref={menuRef} className="absolute right-0 top-full mt-1 w-[100px] bg-bg-secondary border border-border-default-dark rounded shadow-lg z-10">
          <ul>
            {options.map((option, index) => (
              <li
                key={index}
                className={clsx(
                  'flex items-center gap-2 px-2 py-1 text-2xs text-text-primary hover:bg-bg-tertiary cursor-pointer transition-colors',
                  option.disabled && 'opacity-50 cursor-not-allowed',
                )}
                onClick={() => handleOptionClick(option)}
              >
                {option.icon && <span className="w-4 h-4 flex items-center justify-center">{option.icon}</span>}
                <span className="whitespace-nowrap">{option.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

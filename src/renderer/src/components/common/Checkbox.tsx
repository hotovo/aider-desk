import { InputHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange'> & {
  label?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  size?: 'xs' | 'sm' | 'md';
  tooltip?: string;
};

export const Checkbox = ({ label, checked, onChange, className = '', size = 'sm', tooltip, ...props }: Props) => {
  const checkbox = (
    <div
      className={clsx(
        'flex items-center cursor-pointer',
        {
          'text-2xs': size === 'xs',
          'text-xs': size === 'sm',
          'text-sm': size === 'md',
        },
        className,
      )}
      onClick={() => onChange(!checked)}
    >
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          className="sr-only" // Hide the actual input but keep it accessible
          readOnly
          {...props}
        />
        <div
          className={clsx(
            'rounded border flex items-center justify-center transition-colors duration-200 w-4 h-4',
            checked ? 'bg-bg-fourth border-border-accent' : 'bg-bg-secondary-light border-border-default',
          )}
        >
          {checked && (
            <svg
              className={clsx('text-text-primary', {
                'w-2.5 h-2.5': size === 'xs',
                'w-3 h-3': size === 'sm',
                'w-4 h-4': size === 'md',
              })}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="ml-2">{label}</span>}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{checkbox}</Tooltip>;
  }

  return checkbox;
};

import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type InputSize = 'md' | 'sm';

const sizeClasses: Record<InputSize, string> = {
  md: 'p-2 text-sm',
  sm: 'p-1.5 text-xs',
};

export type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  wrapperClassName?: string;
  label?: ReactNode;
  size?: InputSize;
};

export const Input = forwardRef<HTMLInputElement, Props>(({ wrapperClassName, label, className = '', size = 'md', ...props }, ref) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <input
        ref={ref}
        spellCheck={false}
        {...props}
        className={twMerge(
          'w-full bg-bg-secondary-light border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary placeholder-text-muted',
          sizeClasses[size],
          className,
        )}
      />
    </div>
  );
});

Input.displayName = 'Input';

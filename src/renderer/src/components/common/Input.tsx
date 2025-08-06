import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export type Props = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
  label?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(({ wrapperClassName, label, className = '', ...props }, ref) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">{label}</label>}
      <input
        ref={ref}
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-neutral-800 border-2 border-[var(--color-border-default)] rounded focus:outline-none focus:border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] ${className}`}
      />
    </div>
  );
});

Input.displayName = 'Input';

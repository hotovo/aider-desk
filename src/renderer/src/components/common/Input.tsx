import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export type Props = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
  label?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(({ wrapperClassName, label, className = '', ...props }, ref) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-[var(--theme-foreground-primary)] mb-1">{label}</label>}
      <input
        ref={ref}
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-[var(--theme-background-input)] border-2 border-[var(--theme-border-primary)] rounded focus:outline-none focus:border-[var(--theme-accent-primary)] text-[var(--theme-foreground-primary)] text-sm placeholder-[var(--theme-foreground-tertiary)] ${className}`}
      />
    </div>
  );
});

Input.displayName = 'Input';

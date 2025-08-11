import { forwardRef, InputHTMLAttributes, ReactNode } from 'react';

export type Props = InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
  label?: ReactNode;
};

export const Input = forwardRef<HTMLInputElement, Props>(({ wrapperClassName, label, className = '', ...props }, ref) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <input
        ref={ref}
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-bg-secondaryLight border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary text-sm placeholder-text-muted ${className}`}
      />
    </div>
  );
});

Input.displayName = 'Input';

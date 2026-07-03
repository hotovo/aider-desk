import { ReactNode, TextareaHTMLAttributes } from 'react';

export type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  wrapperClassName?: string;
  error?: string | null;
};

export const TextArea = ({ label, wrapperClassName, className = '', error, ...props }: Props) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <textarea
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-bg-secondary-light border-2 ${error ? 'border-error-emphasis' : 'border-border-default'} rounded focus:outline-none ${error ? 'focus:border-error-emphasis' : 'focus:border-border-light'} text-text-primary text-sm placeholder-text-muted
        scrollbar-thin
        scrollbar-track-bg-secondary-light
        scrollbar-thumb-bg-fourth
        ${className}`}
      />
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  );
};

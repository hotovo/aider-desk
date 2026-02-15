import { ReactNode, TextareaHTMLAttributes } from 'react';

export type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  wrapperClassName?: string;
};

export const TextArea = ({ label, wrapperClassName, className = '', ...props }: Props) => {
  return (
    <div className={wrapperClassName}>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <textarea
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-bg-secondary-light border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary text-sm placeholder-text-muted
        scrollbar-thin
        scrollbar-track-bg-secondary-light
        scrollbar-thumb-bg-fourth
        ${className}`}
      />
    </div>
  );
};

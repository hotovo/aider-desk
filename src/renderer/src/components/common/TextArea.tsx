import { ReactNode, TextareaHTMLAttributes } from 'react';

export type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
};

export const TextArea = ({ label, className = '', ...props }: Props) => {
  return (
    <>
      {label && <label className="block text-sm font-medium text-text-primary mb-1">{label}</label>}
      <textarea
        spellCheck={false}
        {...props}
        className={`w-full p-2 bg-bg-secondaryLight border-2 border-border-default rounded focus:outline-none focus:border-border-light text-text-primary text-sm placeholder-text-muted
        scrollbar-thin
        scrollbar-track-bg-secondaryLight
        scrollbar-thumb-bg-fourth
        ${className}`}
      />
    </>
  );
};

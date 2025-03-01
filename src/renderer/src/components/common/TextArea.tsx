import { TextareaHTMLAttributes } from 'react';

export type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
};

export const TextArea = ({ label, className = '', ...props }: Props) => {
  return (
    <>
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      <textarea
        {...props}
        className={`w-full p-2 bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 text-sm placeholder-neutral-500 ${className}`}
      />
    </>
  );
};

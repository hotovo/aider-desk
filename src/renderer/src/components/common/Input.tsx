import { InputHTMLAttributes, ReactNode } from 'react';

export type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
};

export const Input = ({ label, className = '', ...props }: Props) => {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-neutral-100 mb-1">{label}</label>}
      <input
        {...props}
        className={`w-full p-2 bg-neutral-800 border-2 border-neutral-600 rounded focus:outline-none focus:border-neutral-200 text-neutral-100 text-sm placeholder-neutral-500 ${className}`}
      />
    </div>
  );
};

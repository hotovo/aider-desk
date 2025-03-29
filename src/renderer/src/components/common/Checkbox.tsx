import { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  checked: boolean;
  onChange: () => void;
  className?: string;
};

export const Checkbox = ({ label, checked, onChange, className = '', ...props }: Props) => {
  return (
    <div className={`flex items-center cursor-pointer ${className}`} onClick={onChange}>
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only" // Hide the actual input but keep it accessible
          {...props}
        />
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-neutral-600 border-neutral-500' : 'bg-neutral-800 border-neutral-600'} transition-colors duration-200`}
        >
          {checked && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </div>
      {label && <span className="ml-2">{label}</span>}
    </div>
  );
};

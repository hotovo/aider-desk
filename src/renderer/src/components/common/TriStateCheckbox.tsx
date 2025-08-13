import { InputHTMLAttributes } from 'react';

type TriState = 'checked' | 'unchecked' | 'indeterminate';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  state: TriState;
  onChange: () => void;
  className?: string;
};

export const TriStateCheckbox = ({ label, state, onChange, className = '', ...props }: Props) => {
  return (
    <div className={`flex items-center ${className}`}>
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          onChange();
        }}
      >
        <input
          type="checkbox"
          checked={state === 'checked'}
          ref={(el) => {
            if (el) {
              el.indeterminate = state === 'indeterminate';
            }
          }}
          onChange={onChange}
          className="sr-only"
          {...props}
        />
        <div
          className={`w-4 h-4 rounded border flex items-center justify-center ${
            state === 'checked'
              ? 'bg-bg-fourth border-border-accent'
              : state === 'indeterminate'
                ? 'bg-bg-tertiary border-border-accent'
                : 'bg-bg-secondary-light border-border-default'
          } transition-colors duration-200`}
        >
          {state === 'checked' && (
            <svg className="w-3 h-3 text-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {state === 'indeterminate' && <div className="w-2 h-0.5 bg-text-primary" />}
        </div>
      </div>
      {label && <span className="ml-2">{label}</span>}
    </div>
  );
};

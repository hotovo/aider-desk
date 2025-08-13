import { ReactNode } from 'react';

type Props = {
  id: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label?: ReactNode;
  className?: string;
};

export const RadioButton = ({ id, name, value, checked, onChange, label, className = '' }: Props) => {
  const handleChange = () => {
    onChange(value);
  };

  return (
    <div className={`flex items-center cursor-pointer text-xs ${className}`} onClick={handleChange}>
      <div
        className="relative flex items-center justify-center"
        onClick={(e) => {
          e.stopPropagation();
          handleChange();
        }}
      >
        <input
          type="radio"
          id={id}
          name={name}
          value={value}
          checked={checked}
          onChange={handleChange}
          className="sr-only" // Hide the actual input but keep it accessible
        />
        <div
          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
            checked ? 'bg-bg-fourth border-border-accent' : 'bg-bg-secondary-light border-border-default'
          } transition-colors duration-200`}
        >
          {checked && <div className="w-2 h-2 rounded-full bg-text-primary"></div>}
        </div>
      </div>
      {label && <span className="ml-2">{label}</span>}
    </div>
  );
};

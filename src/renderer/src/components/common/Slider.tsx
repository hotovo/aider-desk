import { ChangeEvent, CSSProperties, ReactNode } from 'react';

type Props = {
  label?: ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  showValue?: boolean;
};

export const Slider = ({ label, min, max, step = 1, value, onChange, className = '', showValue = true }: Props) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  return (
    <div className={`${className}`}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-neutral-100">{label}</label>
          {showValue && <span className="text-sm font-medium text-neutral-100">{value}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-200 transition-colors bg-slider-track mt-4 mb-[9px]"
        style={
          {
            '--slider-percentage': `${((value - min) / (max - min)) * 100}%`,
            '--slider-filled-color': 'var(--tw-color-neutral-500)',
            '--slider-empty-color': 'var(--tw-color-neutral-700)',
          } as CSSProperties
        }
      />
    </div>
  );
};

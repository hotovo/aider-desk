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
          <label className="block text-sm font-medium text-text-primary">{label}</label>
          {showValue && <span className="text-sm font-medium text-text-primary">{value}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-light transition-colors bg-slider-track mt-4 mb-[9px]"
        style={
          {
            '--slider-percentage': `${((value - min) / (max - min)) * 100}%`,
            '--slider-filled-color': 'var(--color-bg-fifth)',
            '--slider-empty-color': 'var(--color-bg-tertiary)',
          } as CSSProperties
        }
      />
    </div>
  );
};

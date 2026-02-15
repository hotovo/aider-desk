import { ChangeEvent, CSSProperties, ReactNode } from 'react';

type SliderSize = 'md' | 'sm';

type Props = {
  label?: ReactNode;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  showValue?: boolean;
  size?: SliderSize;
};

export const Slider = ({ label, min, max, step = 1, value, onChange, className = '', showValue = true, size = 'md' }: Props) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const sizeClasses = {
    md: 'h-2 mt-4 mb-[9px]',
    sm: 'h-1 mt-2 mb-[6px]',
  };

  const trackerSizeStyles: Record<SliderSize, CSSProperties> = {
    md: {
      ['--slider-track-height' as keyof CSSProperties]: '8px',
    },
    sm: {
      ['--slider-track-height' as keyof CSSProperties]: '4px',
    },
  };

  return (
    <div className={`${className}`}>
      {label && (
        <div className="flex justify-between items-center">
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
        className={`w-full bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-accent-light transition-colors bg-slider-track ${sizeClasses[size]}`}
        style={
          {
            '--slider-percentage': `${((value - min) / (max - min)) * 100}%`,
            '--slider-filled-color': 'var(--color-bg-fifth)',
            '--slider-empty-color': 'var(--color-bg-tertiary)',
            ...trackerSizeStyles[size],
          } as CSSProperties
        }
      />
    </div>
  );
};

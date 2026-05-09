import { clsx } from 'clsx';

export type ToggleColor = 'primary' | 'secondary' | 'tertiary' | 'danger';
export type ToggleSize = 'sm' | 'md';

const colorClasses: Record<ToggleColor, string> = {
  primary: 'bg-button-primary',
  secondary: 'bg-button-secondary',
  tertiary: 'bg-text-muted',
  danger: 'bg-button-danger',
};

const sizeClasses: Record<ToggleSize, { track: string; knob: string; translate: string }> = {
  md: {
    track: 'w-9 h-5',
    knob: 'after:h-4 after:w-4',
    translate: 'peer-checked:after:translate-x-4',
  },
  sm: {
    track: 'w-7 h-4',
    knob: 'after:h-3 after:w-3',
    translate: 'peer-checked:after:translate-x-3',
  },
};

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
  color?: ToggleColor;
  size?: ToggleSize;
};

export const Toggle = ({ checked, onChange, disabled = false, 'aria-label': ariaLabel, color = 'primary', size = 'md' }: Props) => {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const { track, knob, translate } = sizeClasses[size];

  return (
    <label className={clsx('relative inline-block', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={handleChange} disabled={disabled} aria-label={ariaLabel} />
      <div
        className={clsx(
          'rounded-full transition-colors duration-200',
          'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
          'after:bg-text-primary after:rounded-full',
          'after:transition-transform after:duration-200',
          track,
          knob,
          translate,
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          checked ? colorClasses[color] : 'bg-border-default',
        )}
      ></div>
    </label>
  );
};

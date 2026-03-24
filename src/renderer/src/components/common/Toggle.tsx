import { clsx } from 'clsx';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
};

export const Toggle = ({ checked, onChange, disabled = false, 'aria-label': ariaLabel }: Props) => {
  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <label className={clsx('relative inline-block', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={handleChange} disabled={disabled} aria-label={ariaLabel} />
      <div
        className={clsx(
          'w-9 h-5 rounded-full transition-colors duration-200',
          'after:content-[""] after:absolute after:top-[2px] after:left-[2px]',
          'after:bg-white after:rounded-full after:h-4 after:w-4',
          'after:transition-transform after:duration-200',
          'peer-checked:after:translate-x-4',
          disabled ? 'opacity-50 cursor-not-allowed' : '',
          checked ? 'bg-button-primary' : 'bg-border-default',
        )}
      ></div>
    </label>
  );
};

import { ReactNode } from 'react';

type ButtonVariant = 'contained' | 'text' | 'outline';
type ButtonColor = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'xs';

type Props = {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  color?: ButtonColor;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: ButtonSize;
};

const colorClasses: Record<ButtonColor, Record<ButtonVariant, string>> = {
  primary: {
    contained: 'bg-[var(--color-warning)] hover:bg-[var(--color-warning-light)] text-[var(--color-text-primary)]',
    text: 'text-[var(--color-warning)] hover:bg-[var(--color-warning-10)]',
    outline: 'border-[var(--color-warning)] text-[var(--color-warning)] hover:bg-[var(--color-warning-10)]',
  },
  secondary: {
    contained: 'bg-[var(--color-info)] hover:bg-[var(--color-info-light)] text-white',
    text: 'text-[var(--color-info)] hover:bg-[var(--color-info-10)]',
    outline: 'border-[var(--color-info)] text-[var(--color-info)] hover:bg-[var(--color-info-10)]',
  },
  danger: {
    contained: 'bg-[var(--color-error)] hover:bg-red-[var(--color-error)] text-white',
    text: 'text-[var(--color-error)] hover:bg-[var(--color-error-10)]',
    outline: 'border-[var(--color-error)] text-[var(--color-error)] hover:bg-[var(--color-error-10)]',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-base',
  sm: 'px-2.5 py-1.5 text-sm',
  xs: 'px-2 py-1 text-xs',
};

export const Button = ({
  children,
  onClick,
  variant = 'contained',
  color = 'primary',
  className = '',
  disabled = false,
  autoFocus = false,
  size = 'md',
}: Props) => {
  const baseColorClasses = disabled
    ? 'bg-[var(--color-bg-tertiary-50)] text-[var(--color-text-muted)] cursor-not-allowed hover:bg-[var(--color-bg-tertiary-50)]  hover:text-[var(--color-text-muted)]'
    : colorClasses[color][variant];

  const baseSizeClasses = sizeClasses[size];

  const borderClass = variant === 'outline' && !disabled ? 'border' : '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`flex items-center space-x-1 rounded-lg font-medium transition-colors ${borderClass} ${baseColorClasses} ${baseSizeClasses} ${className}`}
    >
      {children}
    </button>
  );
};

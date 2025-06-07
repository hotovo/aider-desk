import { ReactNode } from 'react';

type ButtonVariant = 'contained' | 'text' | 'outline';
type ButtonColor = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'sm' | 'md';

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
    contained: 'bg-[var(--theme-button-primary)] hover:bg-[var(--theme-accent-secondary)] text-[var(--theme-foreground-primary)]',
    text: 'text-[var(--theme-button-primary)] hover:bg-[var(--theme-button-primary)]/10',
    outline: 'border-[var(--theme-button-primary)] text-[var(--theme-button-primary)] hover:bg-[var(--theme-button-primary)]/10',
  },
  secondary: {
    contained: 'bg-[var(--theme-button-secondary)] hover:bg-[var(--theme-border-secondary)] text-[var(--theme-foreground-primary)]',
    text: 'text-[var(--theme-foreground-secondary)] hover:bg-[var(--theme-button-secondary)]/10',
    outline: 'border-[var(--theme-button-secondary)] text-[var(--theme-foreground-secondary)] hover:bg-[var(--theme-button-secondary)]/10',
  },
  danger: {
    contained: 'bg-[var(--theme-button-danger)] hover:bg-[var(--theme-foreground-error)] text-[var(--theme-foreground-primary)]',
    text: 'text-[var(--theme-button-danger)] hover:bg-[var(--theme-button-danger)]/10',
    outline: 'border-[var(--theme-button-danger)] text-[var(--theme-button-danger)] hover:bg-[var(--theme-button-danger)]/10',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-base',
  sm: 'px-2.5 py-1.5 text-sm',
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
    ? 'bg-[var(--theme-background-tertiary)]/50 text-[var(--theme-foreground-tertiary)] cursor-not-allowed hover:bg-[var(--theme-background-tertiary)]/50 hover:text-[var(--theme-foreground-tertiary)]'
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

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
    contained: 'bg-warning hover:bg-warningLight text-text-primary',
    text: 'text-warning hover:bg-warningSubtle',
    outline: 'border-warning text-warning hover:bg-warningSubtle',
  },
  secondary: {
    contained: 'bg-info hover:bg-infoLight text-text-primary',
    text: 'text-info hover:bg-infoSubtle',
    outline: 'border-info text-info hover:bg-infoSubtle',
  },
  danger: {
    contained: 'bg-error hover:bg-error text-text-primary',
    text: 'text-error hover:bg-errorSubtle',
    outline: 'border-error text-error hover:bg-errorSubtle',
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
    ? 'bg-bg-tertiaryStrong text-text-muted cursor-not-allowed hover:bg-bg-tertiaryStrong hover:text-text-muted'
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

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
    contained: 'bg-button-primary hover:bg-button-primary-light text-button-primary-text',
    text: 'text-button-primary hover:bg-button-primary-subtle',
    outline: 'border-button-primary text-button-primary hover:bg-button-primary-subtle',
  },
  secondary: {
    contained: 'bg-button-secondary hover:bg-button-secondary-light text-button-secondary-text',
    text: 'text-button-secondary hover:bg-button-secondary-subtle',
    outline: 'border-button-secondary text-button-secondary hover:bg-button-secondary-subtle',
  },
  danger: {
    contained: 'bg-button-danger hover:bg-button-danger-light text-button-danger-text',
    text: 'text-button-danger hover:bg-button-danger-subtle',
    outline: 'border-button-danger text-button-danger hover:bg-button-danger-subtle',
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
    ? 'bg-bg-tertiary-strong text-text-muted cursor-not-allowed hover:bg-bg-tertiary-strong hover:text-text-muted'
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

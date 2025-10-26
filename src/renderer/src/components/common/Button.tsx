import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'contained' | 'text' | 'outline';
type ButtonColor = 'primary' | 'secondary' | 'tertiary' | 'danger';
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
  type?: 'button' | 'submit' | 'reset';
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
  tertiary: {
    contained: 'bg-bg-primary hover:bg-bg-primary-light text-text-primary',
    text: 'text-text-primary hover:bg-bg-secondary',
    outline: 'border-text-primary text-text-primary hover:bg-bg-secondary',
  },
  danger: {
    contained: 'bg-button-danger hover:bg-button-danger-emphasis text-button-danger-text',
    text: 'text-button-danger hover:bg-button-danger-subtle',
    outline: 'border-button-danger text-button-danger hover:bg-button-danger-subtle',
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-4 py-2 text-base',
  sm: 'px-2.5 py-1.5 text-sm rounded-md',
  xs: 'px-2 py-1 text-xs rounded',
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
  type = 'button',
}: Props) => {
  const baseColorClasses = disabled
    ? 'bg-bg-tertiary-strong text-text-muted cursor-not-allowed hover:bg-bg-tertiary-strong hover:text-text-muted'
    : colorClasses[color][variant];

  const baseSizeClasses = sizeClasses[size];

  const borderClass = variant === 'outline' && !disabled ? 'border' : '';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={twMerge('flex items-center space-x-1 rounded-lg font-medium transition-colors', borderClass, baseColorClasses, baseSizeClasses, className)}
    >
      {children}
    </button>
  );
};

import { MouseEvent, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  icon: ReactNode;
  onClick?: () => void;
  tooltip?: ReactNode;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
};

export const IconButton = ({ icon, onClick, tooltip, className, disabled, 'data-testid': testId }: Props) => {
  const combinedClassName = twMerge(
    'text-text-muted',
    'transition-opacity',
    'focus:outline-none',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-text-tertiary',
    className,
  );

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick?.();
  };

  const content = (
    <div onClick={disabled || !onClick ? undefined : handleClick} className={combinedClassName} data-testid={testId}>
      {icon}
    </div>
  );

  if (tooltip) {
    return <Tooltip content={tooltip}>{content}</Tooltip>;
  }

  return content;
};

import { FaInfoCircle } from 'react-icons/fa';
import { ReactNode } from 'react';
import clsx from 'clsx';

import { IconButton } from './IconButton';

type Props = {
  tooltip: ReactNode;
  tooltipId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const InfoIcon = ({ tooltip, tooltipId, className, size = 'md' }: Props) => {
  return (
    <IconButton
      icon={
        <FaInfoCircle
          className={clsx({
            'w-3 h-3': size === 'sm',
            'w-4 h-4': size === 'md',
            'w-5 h-5': size === 'lg',
          })}
        />
      }
      tooltip={tooltip}
      tooltipId={tooltipId}
      className={`ml-2 text-[var(--color-text-muted)] ${className || ''}`}
      onClick={() => {}}
    />
  );
};

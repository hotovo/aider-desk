import { FaExclamationTriangle } from 'react-icons/fa';
import { ReactNode } from 'react';
import { clsx } from 'clsx';

import { IconButton } from './IconButton';

type Props = {
  tooltip: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const WarningIcon = ({ tooltip, className, size = 'md' }: Props) => {
  return (
    <IconButton
      icon={
        <FaExclamationTriangle
          className={clsx({
            'w-3 h-3': size === 'sm',
            'w-4 h-4': size === 'md',
            'w-5 h-5': size === 'lg',
          })}
        />
      }
      tooltip={tooltip}
      className={`ml-2 text-warning ${className || ''}`}
      onClick={() => {}}
    />
  );
};

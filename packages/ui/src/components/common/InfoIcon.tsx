import { FaInfoCircle } from 'react-icons/fa';
import { ReactNode } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { IconButton } from './IconButton';

type Props = {
  tooltip: ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export const InfoIcon = ({ tooltip, className = '', size = 'md' }: Props) => {
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
      className={twMerge('ml-2 text-text-muted', className)}
      onClick={() => {}}
    />
  );
};

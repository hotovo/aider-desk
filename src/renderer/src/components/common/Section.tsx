import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export const Section = ({ title, children, className }: Props) => {
  return (
    <div 
      className={clsx('relative border rounded-md', className)}
      style={{ borderColor: 'var(--theme-border-primary)' }}
    >
      <h2 
        className="absolute -top-3 left-4 px-2 text-sm font-medium"
        style={{ 
          backgroundColor: 'var(--theme-background-primary)',
          color: 'var(--theme-foreground-primary)'
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
};

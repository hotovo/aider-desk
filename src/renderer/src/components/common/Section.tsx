import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export const Section = ({ title, children, className }: Props) => {
  return (
    <div className={clsx('relative border border-border-default-dark rounded-md', className)}>
      <h2 className="absolute -top-3 left-4 px-2 bg-bg-secondary text-sm font-medium text-text-primary">{title}</h2>
      {children}
    </div>
  );
};

import { ReactNode } from 'react';
import clsx from 'clsx';

type Props = {
  title: string;
  children: ReactNode;
  className?: string;
};

export const Section = ({ title, children, className }: Props) => {
  return (
    <div className={clsx('relative border border-[var(--color-border-default-dark)] rounded-md', className)}>
      <h2 className="absolute -top-3 left-4 px-2 bg-[var(--color-bg-secondary)] text-sm font-medium text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </div>
  );
};

import { ReactNode } from 'react';
import { clsx } from 'clsx';

type Props = {
  id?: string;
  title?: string;
  children: ReactNode;
  className?: string;
};

export const Section = ({ id, title, children, className }: Props) => {
  return (
    <div id={id} className={clsx('relative border border-border-default-dark rounded-md', className)}>
      {title && <h2 className="absolute -top-3 left-4 px-2 bg-bg-primary-light text-sm font-medium text-text-primary">{title}</h2>}
      {children}
    </div>
  );
};

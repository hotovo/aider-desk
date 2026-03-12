import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

type Props = {
  className?: string;
  children?: ReactNode;
};

export const CodeInline = ({ className, children }: Props) => {
  return (
    <span
      className={twMerge(
        'bg-bg-primary-light border border-border-dark-light text-text-primary rounded-sm px-1 py-0.5 text-2xs font-semibold whitespace-pre-wrap',
        className,
      )}
    >
      {children}
    </span>
  );
};

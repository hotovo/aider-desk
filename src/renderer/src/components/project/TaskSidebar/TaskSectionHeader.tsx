import { clsx } from 'clsx';

type Props = {
  title: string;
  className?: string;
};

export const TaskSectionHeader = ({ title, className }: Props) => {
  return <div className={clsx('px-2 pt-1 pb-0.5 text-3xs uppercase font-semibold text-text-muted-dark border-t border-border-dark', className)}>{title}</div>;
};

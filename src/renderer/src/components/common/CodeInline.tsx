import clsx from 'clsx';

type Props = {
  className?: string;
  children?: string;
};

export const CodeInline = ({ className, children }: Props) => {
  return (
    <span className={clsx('bg-gray-950 border border-neutral-800 text-white rounded-sm px-1 py-0.5 text-2xs font-semibold whitespace-pre-wrap', className)}>
      {children}
    </span>
  );
};

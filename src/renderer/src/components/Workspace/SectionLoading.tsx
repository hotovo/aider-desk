import { CgSpinner } from 'react-icons/cg';

type Props = {
  label: string;
};

export const SectionLoading = ({ label }: Props) => (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="flex items-center gap-1.5 text-2xs text-text-secondary">
      <CgSpinner className="w-4 h-4 text-text-muted animate-spin" />
      {label}
    </div>
  </div>
);

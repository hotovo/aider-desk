import { IoClose } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import { IconButton } from '@/components/common/IconButton';
import { StyledTooltip } from '@/components/common/StyledTooltip';

type Props = {
  path: string;
  onRemove: (path: string) => void;
};

export const FileChip = ({ path, onRemove }: Props) => {
  const { t } = useTranslation();

  return (
    <div key={path} className="flex items-center bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded-full max-w-full">
      <span className="mr-1 truncate">{path}</span>
      <IconButton
        icon={<IoClose />}
        onClick={() => onRemove(path)}
        tooltipId="removeFileTooltipId"
        tooltip={t('fileChip.removeFileTooltip')}
        className="p-0.5 rounded-full text-[var(--color-text-muted-light)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-fourth)]"
      />
      <StyledTooltip id="removeFileTooltipId" />
    </div>
  );
};

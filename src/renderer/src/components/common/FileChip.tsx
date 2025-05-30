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
    <div key={path} className="flex items-center bg-neutral-700 text-neutral-100 text-xs px-2 py-1 rounded-full max-w-full">
      <span className="mr-1 truncate">{path}</span>
      <IconButton
        icon={<IoClose />}
        onClick={() => onRemove(path)}
        tooltipId="removeFileTooltipId"
        tooltip={t('fileChip.removeFileTooltip')}
        className="p-0.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-600"
      />
      <StyledTooltip id="removeFileTooltipId" />
    </div>
  );
};

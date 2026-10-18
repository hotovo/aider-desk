import { VscArrowSwap } from 'react-icons/vsc';
import { useTranslation } from 'react-i18next';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  previousPath?: string;
};

export const FileRenameBadge = ({ previousPath }: Props) => {
  const { t } = useTranslation();
  if (!previousPath) {
    return null;
  }

  const label = t('contextFiles.renamedFrom', { path: previousPath });
  return (
    <Tooltip content={label}>
      <VscArrowSwap aria-label={label} className="w-3.5 h-3.5 text-text-muted-light flex-shrink-0" />
    </Tooltip>
  );
};

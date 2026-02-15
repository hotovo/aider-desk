import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/common/Chip';

type Props = {
  path: string;
  onRemove: (path: string) => void;
};

export const FileChip = ({ path, onRemove }: Props) => {
  const { t } = useTranslation();

  return <Chip key={path} label={path} onRemove={() => onRemove(path)} removeTooltip={t('fileChip.removeFileTooltip')} />;
};

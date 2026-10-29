import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export const RequireStreaming = ({ checked, onChange }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center space-x-2">
      <Checkbox label={t('modelLibrary.requireStreaming')} checked={checked} onChange={onChange} size="md" />
      <InfoIcon tooltip={t('modelLibrary.requireStreamingInfo')} />
    </div>
  );
};

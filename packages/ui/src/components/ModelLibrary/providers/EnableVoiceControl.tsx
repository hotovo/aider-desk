import { useTranslation } from 'react-i18next';

import { Checkbox } from '@/components/common/Checkbox';

type Props = {
  voiceEnabled: boolean;
  onChange: (enabled: boolean) => void;
};

export const EnableVoiceControl = ({ voiceEnabled, onChange }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="border border-border-default-dark rounded-md py-3 px-4 mt-6">
      <h3 className="text-sm font-medium text-text-primary mb-2">{t('modelLibrary.voiceControl')}</h3>

      <p className="text-xs mb-4 text-text-muted">{t('modelLibrary.voiceControlDescription')}</p>

      <div className="space-y-3">
        <Checkbox label={<span className="text-sm">{t('common.enabled')}</span>} checked={voiceEnabled} onChange={onChange} />
        <p className="text-2xs text-text-muted">{t('modelLibrary.enableVoiceControlOnlyOneInfo')}</p>
      </div>
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { ZaiPlanProvider } from '@common/agent';

import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: ZaiPlanProvider;
  onChange: (updated: ZaiPlanProvider) => void;
};

export const ZaiPlanThinkingSetting = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();
  const { thinkingEnabled } = provider;

  const handleThinkingEnabledChange = (checked: boolean) => {
    onChange({ ...provider, thinkingEnabled: checked });
  };

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">{t('zaiPlan.thinkingEnabled')}</span>
      <Checkbox label="" checked={thinkingEnabled ?? true} size="md" onChange={handleThinkingEnabledChange} />
      <InfoIcon tooltip={t('zaiPlan.thinkingEnabledTooltip')} />
    </div>
  );
};

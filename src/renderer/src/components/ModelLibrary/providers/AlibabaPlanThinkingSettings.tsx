import { useTranslation } from 'react-i18next';
import { AlibabaPlanProvider } from '@common/agent';

import { Slider } from '@/components/common/Slider';
import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: AlibabaPlanProvider;
  onChange: (updated: AlibabaPlanProvider) => void;
};

export const AlibabaPlanThinkingSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();
  const { thinkingEnabled, thinkingBudget } = provider;

  const handleThinkingEnabledChange = (checked: boolean) => {
    onChange({ ...provider, thinkingEnabled: checked });
  };

  const handleThinkingBudgetChange = (value: number) => {
    onChange({ ...provider, thinkingBudget: value });
  };

  return (
    <div className="space-x-8 flex items-center">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">{t('alibabaPlan.thinkingEnabled')}</span>
        <Checkbox label="" checked={thinkingEnabled ?? true} size="md" onChange={handleThinkingEnabledChange} />
        <InfoIcon tooltip={t('alibabaPlan.thinkingEnabledTooltip')} />
      </div>
      {thinkingEnabled !== false && (
        <Slider
          label={t('alibabaPlan.thinkingBudget')}
          value={thinkingBudget ?? 8192}
          min={0}
          max={81920}
          onChange={handleThinkingBudgetChange}
          className="flex-1"
        />
      )}
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { ZaiPlanProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: ZaiPlanProvider;
  onChange: (updated: ZaiPlanProvider) => void;
};

export const ZaiPlanThinkingSetting = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();
  const { thinkingEnabled, reasoningEffort } = provider;

  const handleThinkingEnabledChange = (checked: boolean) => {
    onChange({ ...provider, thinkingEnabled: checked });
  };

  const reasoningEffortOptions: Option[] = [
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'max', label: t('reasoningEffort.max') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as ReasoningEffort });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">{t('zaiPlan.thinkingEnabled')}</span>
        <Checkbox label="" checked={thinkingEnabled ?? true} size="md" onChange={handleThinkingEnabledChange} />
        <InfoIcon tooltip={t('zaiPlan.thinkingEnabledTooltip')} />
      </div>
      {thinkingEnabled !== false && (
        <Select
          label={
            <div className="flex items-center font-medium">
              <span>{t('reasoningEffort.label')}</span>
              <InfoIcon className="ml-1" tooltip={t('zaiPlan.reasoningEffortTooltip')} />
            </div>
          }
          value={reasoningEffort ?? ReasoningEffort.Max}
          onChange={handleReasoningEffortChange}
          options={reasoningEffortOptions}
        />
      )}
    </div>
  );
};

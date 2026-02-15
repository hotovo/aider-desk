import { useTranslation } from 'react-i18next';
import { RequestyProvider } from '@aider-desk/common/agent';
import { ReasoningEffort } from '@aider-desk/common/types';

import { Checkbox } from '@/components/common/Checkbox';
import { InfoIcon } from '@/components/common/InfoIcon';
import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: RequestyProvider;
  onChange: (updated: RequestyProvider) => void;
};

export const RequestyAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { useAutoCache, reasoningEffort } = provider;

  const reasoningOptions: Option[] = [
    { value: 'none', label: t('reasoningEffort.none') },
    { value: 'low', label: t('reasoningEffort.low') },
    { value: 'medium', label: t('reasoningEffort.medium') },
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'max', label: t('reasoningEffort.max') },
  ];

  const handleUseAutoCacheChange = (checked: boolean) => {
    onChange({ ...provider, useAutoCache: checked });
  };

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as ReasoningEffort });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox label={t('requesty.autoCacheLabel')} checked={useAutoCache} onChange={handleUseAutoCacheChange} size="md" />
        <InfoIcon tooltip={t('requesty.autoCacheTooltip')} />
      </div>
      <Select
        label={
          <div className="flex items-center font-medium">
            <span>{t('reasoningEffort.label')}</span>
            <InfoIcon className="ml-1" tooltip={t('reasoningEffort.tooltip')} />
          </div>
        }
        value={reasoningEffort}
        onChange={handleReasoningEffortChange}
        options={reasoningOptions}
      />
    </div>
  );
};

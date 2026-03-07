import { useTranslation } from 'react-i18next';
import { OpenAiCompatibleProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Select, Option } from '@/components/common/Select';
import { InfoIcon } from '@/components/common/InfoIcon';

type Props = {
  provider: OpenAiCompatibleProvider;
  onChange: (updated: OpenAiCompatibleProvider) => void;
};

export const OpenAiCompatibleAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const reasoningEffort = provider.reasoningEffort || ReasoningEffort.None;

  const reasoningOptions: Option[] = [
    { value: ReasoningEffort.None, label: t('reasoningEffort.none') },
    { value: ReasoningEffort.Minimal, label: t('reasoningEffort.minimal') },
    { value: ReasoningEffort.Low, label: t('reasoningEffort.low') },
    { value: ReasoningEffort.Medium, label: t('reasoningEffort.medium') },
    { value: ReasoningEffort.High, label: t('reasoningEffort.high') },
    { value: ReasoningEffort.XHigh, label: t('reasoningEffort.xhigh') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({
      ...provider,
      reasoningEffort: value as ReasoningEffort,
    });
  };

  return (
    <div className="space-y-4">
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

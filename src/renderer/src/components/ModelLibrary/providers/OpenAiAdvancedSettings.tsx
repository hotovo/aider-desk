import { useTranslation } from 'react-i18next';
import { OpenAiProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: OpenAiProvider;
  onChange: (updated: OpenAiProvider) => void;
};

export const OpenAiAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const reasoningEffort = provider.reasoningEffort || ReasoningEffort.None;

  const reasoningOptions: Option[] = [
    { value: ReasoningEffort.None, label: t('openai.reasoningEffortNone') },
    { value: ReasoningEffort.Minimal, label: t('openai.reasoningEffortMinimal') },
    { value: ReasoningEffort.Low, label: t('openai.reasoningEffortLow') },
    { value: ReasoningEffort.Medium, label: t('openai.reasoningEffortMedium') },
    { value: ReasoningEffort.High, label: t('openai.reasoningEffortHigh') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({
      ...provider,
      reasoningEffort: value as ReasoningEffort,
    });
  };

  return (
    <div className="space-y-2">
      <Select label={t('openai.reasoningEffort')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningOptions} />
    </div>
  );
};

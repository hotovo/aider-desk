import { useTranslation } from 'react-i18next';
import { AzureProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: AzureProvider;
  onChange: (updated: AzureProvider) => void;
};

export const AzureAdvancedSettings = ({ provider, onChange }: Props) => {
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
      <Select label={t('reasoningEffort.label')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningOptions} />
    </div>
  );
};

import { useTranslation } from 'react-i18next';
import { NeuralwattProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { InfoIcon } from '@/components/common/InfoIcon';
import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: NeuralwattProvider;
  onChange: (updated: NeuralwattProvider) => void;
};

export const NeuralwattAdvancedSettings = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();
  const { reasoningEffort } = provider;

  const reasoningEffortOptions: Option[] = [
    { value: 'max', label: t('reasoningEffort.max') },
    { value: 'xhigh', label: t('reasoningEffort.xhigh') },
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'medium', label: t('reasoningEffort.medium') },
    { value: 'low', label: t('reasoningEffort.low') },
    { value: 'minimal', label: t('reasoningEffort.minimal') },
    { value: 'none', label: t('reasoningEffort.none') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as ReasoningEffort });
  };

  return (
    <Select
      label={
        <div className="flex items-center font-medium">
          <span>{t('reasoningEffort.label')}</span>
          <InfoIcon className="ml-1" tooltip={t('reasoningEffort.tooltip')} />
        </div>
      }
      value={reasoningEffort ?? ReasoningEffort.High}
      onChange={handleReasoningEffortChange}
      options={reasoningEffortOptions}
    />
  );
};

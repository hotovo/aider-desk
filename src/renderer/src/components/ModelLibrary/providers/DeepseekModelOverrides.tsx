import { getDefaultProviderParams, DeepseekProvider, DeepseekReasoningEffort, LlmProvider } from '@common/agent';
import { useTranslation } from 'react-i18next';

import { DisableStreaming } from '../DisableStreaming';

import { Checkbox } from '@/components/common/Checkbox';
import { Select, Option } from '@/components/common/Select';

type Props = {
  provider: LlmProvider;
  overrides: Partial<DeepseekProvider>;
  onChange: (overrides: Record<string, unknown>) => void;
};

export const DeepseekModelOverrides = ({ provider, overrides, onChange }: Props) => {
  const { t } = useTranslation();

  const fullProvider: DeepseekProvider = {
    ...getDefaultProviderParams('deepseek'),
    ...(provider as DeepseekProvider),
    ...overrides,
  };

  const thinkingEnabled = fullProvider.thinkingEnabled ?? true;
  const reasoningEffort = fullProvider.reasoningEffort || 'high';

  const handleThinkingEnabledChange = (checked: boolean) => {
    onChange({
      ...overrides,
      thinkingEnabled: checked,
    });
  };

  const reasoningEffortOptions: Option[] = [
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'max', label: t('reasoningEffort.max') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({
      ...overrides,
      reasoningEffort: value as DeepseekReasoningEffort,
    });
  };

  const handleDisableStreamingChange = (disableStreaming: boolean) => {
    onChange({
      ...overrides,
      disableStreaming,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">{t('deepseek.thinkingEnabled')}</span>
        <Checkbox label="" checked={thinkingEnabled} size="md" onChange={handleThinkingEnabledChange} />
      </div>
      {thinkingEnabled && (
        <Select label={t('deepseek.reasoningEffort')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningEffortOptions} />
      )}
      <DisableStreaming checked={fullProvider.disableStreaming ?? false} onChange={handleDisableStreamingChange} />
    </div>
  );
};

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DeepseekProvider, DeepseekReasoningEffort } from '@common/agent';

import { Input } from '@/components/common/Input';
import { Checkbox } from '@/components/common/Checkbox';
import { Select, Option } from '@/components/common/Select';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: DeepseekProvider;
  onChange: (updated: DeepseekProvider) => void;
};

export const DeepseekParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const thinkingEnabled = provider.thinkingEnabled ?? true;
  const reasoningEffort = provider.reasoningEffort || 'high';

  const { environmentVariable: deepseekApiKeyEnv } = useEffectiveEnvironmentVariable('DEEPSEEK_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleThinkingEnabledChange = (checked: boolean) => {
    onChange({ ...provider, thinkingEnabled: checked });
  };

  const reasoningEffortOptions: Option[] = [
    { value: 'high', label: t('reasoningEffort.high') },
    { value: 'max', label: t('reasoningEffort.max') },
  ];

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as DeepseekReasoningEffort });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('deepseek.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          deepseekApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: deepseekApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'DEEPSEEK_API_KEY' })
        }
      />
      <div className="space-y-4 pt-2">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">{t('deepseek.thinkingEnabled')}</span>
          <Checkbox label="" checked={thinkingEnabled} size="md" onChange={handleThinkingEnabledChange} />
        </div>
        {thinkingEnabled && (
          <Select label={t('deepseek.reasoningEffort')} value={reasoningEffort} onChange={handleReasoningEffortChange} options={reasoningEffortOptions} />
        )}
      </div>
    </div>
  );
};

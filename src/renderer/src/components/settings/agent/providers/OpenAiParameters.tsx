import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenAiProvider } from '@common/agent';
import { ReasoningEffort } from '@common/types';

import { Input } from '@/components/common/Input';
import { RadioButton } from '@/components/common/RadioButton';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenAiProvider;
  onChange: (updated: OpenAiProvider) => void;
};

export const OpenAiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const reasoningEffort = provider.reasoningEffort || 'medium';

  const { environmentVariable: openAiApiKeyEnv } = useEffectiveEnvironmentVariable('OPENAI_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleReasoningEffortChange = (value: string) => {
    onChange({ ...provider, reasoningEffort: value as typeof reasoningEffort });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openAiApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: openAiApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'OPENAI_API_KEY' })
        }
      />

      <div>
        <div className="mb-1 text-sm font-medium">{t('openai.reasoningEffort')}</div>
        <div className="flex items-center space-x-4">
          <RadioButton
            id="reasoning-effort-low"
            name="reasoning-effort"
            label={t('openai.reasoningEffortLow')}
            value={ReasoningEffort.Low}
            checked={reasoningEffort === ReasoningEffort.Low}
            onChange={handleReasoningEffortChange}
          />
          <RadioButton
            id="reasoning-effort-medium"
            name="reasoning-effort"
            label={t('openai.reasoningEffortMedium')}
            value={ReasoningEffort.Medium}
            checked={reasoningEffort === ReasoningEffort.Medium}
            onChange={handleReasoningEffortChange}
          />
          <RadioButton
            id="reasoning-effort-high"
            name="reasoning-effort"
            label={t('openai.reasoningEffortHigh')}
            value={ReasoningEffort.High}
            checked={reasoningEffort === ReasoningEffort.High}
            onChange={handleReasoningEffortChange}
          />
        </div>
      </div>
    </div>
  );
};

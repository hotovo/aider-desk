import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AnthropicProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AnthropicProvider;
  onChange: (updated: AnthropicProvider) => void;
};

export const AnthropicParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: anthropicApiKeyEnv } = useEffectiveEnvironmentVariable('ANTHROPIC_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('anthropic.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          anthropicApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: anthropicApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'ANTHROPIC_API_KEY' })
        }
      />
    </div>
  );
};

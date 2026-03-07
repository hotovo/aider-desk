import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AnthropicCompatibleProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: AnthropicCompatibleProvider;
  onChange: (updated: AnthropicCompatibleProvider) => void;
};

export const AnthropicCompatibleParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';

  const { environmentVariable: anthropicApiKeyEnv } = useEffectiveEnvironmentVariable('ANTHROPIC_API_KEY');
  const { environmentVariable: anthropicApiBaseEnv } = useEffectiveEnvironmentVariable('ANTHROPIC_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('anthropic.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={
          anthropicApiBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: anthropicApiBaseEnv.source }) : t('anthropic.baseUrlPlaceholder')
        }
      />
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

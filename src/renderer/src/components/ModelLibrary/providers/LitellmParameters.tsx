import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LitellmProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: LitellmProvider;
  onChange: (updated: LitellmProvider) => void;
};

export const LitellmParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const baseUrl = provider.baseUrl || '';
  const apiKey = provider.apiKey || '';

  const { environmentVariable: litellmApiKeyEnv } = useEffectiveEnvironmentVariable('LITELLM_API_KEY');
  const { environmentVariable: litellmApiBaseEnv } = useEffectiveEnvironmentVariable('LITELLM_API_BASE');

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, baseUrl: e.target.value });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <Input
        label={t('openai.baseUrl')}
        type="text"
        value={baseUrl}
        onChange={handleBaseUrlChange}
        placeholder={litellmApiBaseEnv ? t('settings.agent.envVarFoundPlaceholder', { source: litellmApiBaseEnv.source }) : 'http://localhost:4000'}
      />
      <Input
        label={t('openai.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          litellmApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: litellmApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'LITELLM_API_KEY' })
        }
      />
    </div>
  );
};

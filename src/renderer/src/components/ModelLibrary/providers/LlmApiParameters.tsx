import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LlmApiProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: LlmApiProvider;
  onChange: (updated: LlmApiProvider) => void;
};

export const LlmApiParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const { apiKey } = provider;

  const { environmentVariable: llmApiKeyEnv } = useEffectiveEnvironmentVariable('LLMAPI_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-4">
      <div className="!mt-0 !mb-5">
        <a href="https://app.llmapi.ai/login" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          {t('llmApi.getApiKeyLink')}
        </a>
      </div>
      <Input
        label={t('llmApi.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          llmApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', {
                source: llmApiKeyEnv.source,
              })
            : t('settings.agent.envVarPlaceholder', {
                envVar: 'LLMAPI_API_KEY',
              })
        }
      />
    </div>
  );
};

import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MistralProvider } from '@common/agent';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: MistralProvider;
  onChange: (updated: MistralProvider) => void;
};

export const MistralParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';

  const { environmentVariable: mistralApiKeyEnv } = useEffectiveEnvironmentVariable('MISTRAL_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://console.mistral.ai/api-keys" target="_blank" rel="noopener noreferrer" className="text-sm text-info-light hover:underline">
          Get Mistral API key
        </a>
      </div>
      <Input
        label={t('mistral.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          mistralApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: mistralApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'MISTRAL_API_KEY' })
        }
      />
    </div>
  );
};

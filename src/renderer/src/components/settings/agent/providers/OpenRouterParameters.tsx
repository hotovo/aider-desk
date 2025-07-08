import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenRouterProvider } from '@common/agent';

import { ProviderModels } from './ProviderModels';

import { Input } from '@/components/common/Input';
import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';

type Props = {
  provider: OpenRouterProvider;
  onChange: (updated: OpenRouterProvider) => void;
};

export const OpenRouterParameters = ({ provider, onChange }: Props) => {
  const { t } = useTranslation();

  const apiKey = provider.apiKey || '';
  const models = provider.models || [];

  const { environmentVariable: openRouterApiKeyEnv } = useEffectiveEnvironmentVariable('OPENROUTER_API_KEY');

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...provider, apiKey: e.target.value });
  };

  const handleModelsChange = (updatedModels: string[]) => {
    onChange({ ...provider, models: updatedModels });
  };

  return (
    <div className="space-y-2">
      <div className="!mt-0 !mb-5">
        <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">
          Get OpenRouter API key
        </a>
      </div>
      <Input
        label={t('openRouter.apiKey')}
        type="password"
        value={apiKey}
        onChange={handleApiKeyChange}
        placeholder={
          openRouterApiKeyEnv
            ? t('settings.agent.envVarFoundPlaceholder', { source: openRouterApiKeyEnv.source })
            : t('settings.agent.envVarPlaceholder', { envVar: 'OPENROUTER_API_KEY' })
        }
      />
      <ProviderModels models={models} onChange={handleModelsChange} />
    </div>
  );
};

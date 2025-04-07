import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';
import { isGeminiProvider } from '@common/llm-providers';

import { ModelSelect } from './ModelSelect';

import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const GeminiParameters = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();

  const activeProvider = settings.agentConfig.providers.find((provider) => provider.active && isGeminiProvider(provider));
  const apiKey = activeProvider && isGeminiProvider(activeProvider) ? activeProvider.apiKey : '';
  const model = activeProvider && isGeminiProvider(activeProvider) ? activeProvider.model : '';

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isGeminiProvider(provider) ? { ...provider, apiKey: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isGeminiProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <ModelSelect providerName="gemini" currentModel={model} onChange={handleModelChange} />
      <Input label={t('gemini.apiKey')} type="password" value={apiKey} onChange={handleApiKeyChange} />
    </div>
  );
};

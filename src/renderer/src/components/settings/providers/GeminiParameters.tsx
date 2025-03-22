import { ChangeEvent } from 'react';
import { SettingsData } from '@common/types';
import { isGeminiProvider } from '@common/llm-providers';

import { ModelSelect } from './ModelSelect';

import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const GeminiParameters = ({ settings, setSettings }: Props) => {
  const activeProvider = settings.mcpConfig.providers.find((provider) => provider.active && isGeminiProvider(provider));
  const apiKey = activeProvider && isGeminiProvider(activeProvider) ? activeProvider.apiKey : '';
  const model = activeProvider && isGeminiProvider(activeProvider) ? activeProvider.model : '';

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.mcpConfig.providers.map((provider) =>
      provider.active && isGeminiProvider(provider) ? { ...provider, apiKey: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpConfig: updatedMcpConfig });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.mcpConfig.providers.map((provider) =>
      provider.active && isGeminiProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpConfig: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <ModelSelect providerName="gemini" currentModel={model} onChange={handleModelChange} />
      <Input label="API Key" type="password" value={apiKey} onChange={handleApiKeyChange} />
    </div>
  );
};

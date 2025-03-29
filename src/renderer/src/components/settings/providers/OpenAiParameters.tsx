import { ChangeEvent } from 'react';
import { SettingsData } from '@common/types';
import { isOpenAiProvider } from '@common/llm-providers';

import { ModelSelect } from './ModelSelect';

import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const OpenAiParameters = ({ settings, setSettings }: Props) => {
  const activeProvider = settings.mcpAgent.providers.find((provider) => provider.active && isOpenAiProvider(provider));
  const apiKey = activeProvider && isOpenAiProvider(activeProvider) ? activeProvider.apiKey : '';
  const model = activeProvider && isOpenAiProvider(activeProvider) ? activeProvider.model : '';

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isOpenAiProvider(provider) ? { ...provider, apiKey: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isOpenAiProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <ModelSelect providerName="openai" currentModel={model} onChange={handleModelChange} />
      <Input label="API Key" type="password" value={apiKey} onChange={handleApiKeyChange} />
    </div>
  );
};

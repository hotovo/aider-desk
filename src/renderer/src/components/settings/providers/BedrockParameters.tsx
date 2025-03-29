import { ChangeEvent } from 'react';
import { SettingsData } from '@common/types';
import { isBedrockProvider } from '@common/llm-providers';

import { ModelSelect } from './ModelSelect';

import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const BedrockParameters = ({ settings, setSettings }: Props) => {
  const activeProvider = settings.mcpAgent.providers.find((provider) => provider.active && isBedrockProvider(provider));

  const region = activeProvider && isBedrockProvider(activeProvider) ? activeProvider.region : '';
  const accessKeyId = activeProvider && isBedrockProvider(activeProvider) ? activeProvider.accessKeyId : '';
  const secretAccessKey = activeProvider && isBedrockProvider(activeProvider) ? activeProvider.secretAccessKey : '';
  const model = activeProvider && isBedrockProvider(activeProvider) ? activeProvider.model : '';

  const handleRegionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isBedrockProvider(provider) ? { ...provider, region: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleAccessKeyIdChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isBedrockProvider(provider) ? { ...provider, accessKeyId: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleSecretAccessKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isBedrockProvider(provider) ? { ...provider, secretAccessKey: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.mcpAgent.providers.map((provider) =>
      provider.active && isBedrockProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.mcpAgent,
      providers: updatedProviders,
    };
    setSettings({ ...settings, mcpAgent: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <ModelSelect providerName="bedrock" currentModel={model} onChange={handleModelChange} />
      <Input label="Region" value={region} onChange={handleRegionChange} placeholder="e.g., us-east-1" />
      <Input label="Access Key ID" value={accessKeyId} onChange={handleAccessKeyIdChange} />
      <Input label="Secret Access Key" type="password" value={secretAccessKey} onChange={handleSecretAccessKeyChange} />
    </div>
  );
};

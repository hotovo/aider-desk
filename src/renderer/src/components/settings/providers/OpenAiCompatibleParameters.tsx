import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsData } from '@common/types';
import { OpenAiCompatibleProvider, isOpenAiCompatibleProvider } from '@common/llm-providers';

import { Input } from '@/components/common/Input';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const OpenAiCompatibleParameters = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const activeProvider = settings.agentConfig.providers.find((provider) => provider.active && isOpenAiCompatibleProvider(provider)) as
    | OpenAiCompatibleProvider
    | undefined;

  const baseUrl = activeProvider?.baseUrl || '';
  const apiKey = activeProvider?.apiKey || '';
  const model = activeProvider?.model || '';

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isOpenAiCompatibleProvider(provider) ? { ...provider, baseUrl: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isOpenAiCompatibleProvider(provider) ? { ...provider, apiKey: e.target.value } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isOpenAiCompatibleProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <Input label={t('openai.baseUrl')} type="text" value={baseUrl} onChange={handleBaseUrlChange} placeholder={t('openai.baseUrlPlaceholder')} />
      <Input
        label={t('openai.modelName')}
        type="text"
        value={model}
        onChange={(e) => handleModelChange(e.target.value)}
        placeholder={t('openai.modelNamePlaceholder')}
      />
      <Input label={t('openai.apiKey')} type="password" value={apiKey} onChange={handleApiKeyChange} />
    </div>
  );
};

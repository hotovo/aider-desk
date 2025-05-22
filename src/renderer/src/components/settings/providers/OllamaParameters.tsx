import { SettingsData } from '@common/types';
import { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isOllamaProvider } from '@common/llm-providers';

import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { useOllamaModels } from '@/hooks/useOllamaModels';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
};

export const OllamaParameters = ({ settings, setSettings }: Props) => {
  const { t } = useTranslation();
  const provider = settings.agentConfig.providers.find((provider) => isOllamaProvider(provider));
  const baseUrl = provider?.baseUrl || '';
  const model = provider?.model || '';

  const models = useOllamaModels(baseUrl);

  const handleBaseUrlChange = (e: ChangeEvent<HTMLInputElement>) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      isOllamaProvider(provider) ? { ...provider, baseUrl: e.target.value } : provider,
    );
    setSettings({
      ...settings,
      agentConfig: {
        ...settings.agentConfig,
        providers: updatedProviders,
      },
    });
  };

  const handleModelChange = (selectedModel: string) => {
    const updatedProviders = settings.agentConfig.providers.map((provider) =>
      provider.active && isOllamaProvider(provider) ? { ...provider, model: selectedModel } : provider,
    );

    const updatedMcpConfig = {
      ...settings.agentConfig,
      providers: updatedProviders,
    };
    setSettings({ ...settings, agentConfig: updatedMcpConfig });
  };

  return (
    <div className="mt-2 space-y-2">
      <Input label={t('ollama.baseUrl')} type="text" value={baseUrl} onChange={handleBaseUrlChange} placeholder={t('ollama.baseUrlPlaceholder')} />
      <Select label={t('model.label')} value={model} onChange={handleModelChange} options={models.map((m) => ({ value: m, label: m }))} />
    </div>
  );
};

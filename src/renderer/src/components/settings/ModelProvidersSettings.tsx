import {
  AVAILABLE_PROVIDERS,
  getLlmProviderConfig,
  isAnthropicProvider,
  isBedrockProvider,
  isDeepseekProvider,
  isGeminiProvider,
  isOllamaProvider,
  isOpenAiCompatibleProvider,
  isOpenAiProvider,
  isOpenRouterProvider,
  isRequestyProvider,
  LlmProvider,
  LlmProviderName,
} from '@common/agent';
import { SettingsData } from '@common/types';
import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';

import { ProviderCard } from './ProviderCard';

import { useEffectiveEnvironmentVariable } from '@/hooks/useEffectiveEnvironmentVariable';
import { Button } from '@/components/common/Button';

type Props = {
  settings: SettingsData;
  setSettings: (settings: SettingsData) => void;
  onSwitchToAiderTab?: () => void;
  showProminentModels?: boolean;
};

export const ModelProvidersSettings = ({ settings, setSettings, onSwitchToAiderTab, showProminentModels }: Props) => {
  const { t } = useTranslation();
  const [expandedProvider, setExpandedProvider] = useState<LlmProviderName | null>(null);
  const [showAll, setShowAll] = useState(!showProminentModels);

  // Define prominent providers
  const prominentProviders: LlmProviderName[] = ['anthropic', 'openai', 'gemini'];

  // Environment variable hooks for API keys
  const { environmentVariable: openaiApiKey } = useEffectiveEnvironmentVariable('OPENAI_API_KEY');
  const { environmentVariable: anthropicApiKey } = useEffectiveEnvironmentVariable('ANTHROPIC_API_KEY');
  const { environmentVariable: geminiApiKey } = useEffectiveEnvironmentVariable('GEMINI_API_KEY');
  const { environmentVariable: deepseekApiKey } = useEffectiveEnvironmentVariable('DEEPSEEK_API_KEY');
  const { environmentVariable: openrouterApiKey } = useEffectiveEnvironmentVariable('OPENROUTER_API_KEY');
  const { environmentVariable: requestyApiKey } = useEffectiveEnvironmentVariable('REQUESTY_API_KEY');
  const { environmentVariable: awsAccessKeyId } = useEffectiveEnvironmentVariable('AWS_ACCESS_KEY_ID');
  const { environmentVariable: awsSecretAccessKey } = useEffectiveEnvironmentVariable('AWS_SECRET_ACCESS_KEY');

  const handleProviderParamsChange = (updatedProviderConfig: LlmProvider) => {
    setSettings({
      ...settings,
      llmProviders: {
        ...settings.llmProviders,
        [updatedProviderConfig.name]: updatedProviderConfig,
      },
    });
  };

  const handleProviderExpand = (providerName: LlmProviderName) => {
    setExpandedProvider(expandedProvider === providerName ? null : providerName);
  };

  const isProviderConfigured = (providerName: LlmProviderName): boolean => {
    const provider = getLlmProviderConfig(providerName, settings);

    if (isOpenAiProvider(provider)) {
      return !!provider.apiKey || !!openaiApiKey?.value;
    } else if (isAnthropicProvider(provider)) {
      return !!provider.apiKey || !!anthropicApiKey?.value;
    } else if (isDeepseekProvider(provider)) {
      return !!provider.apiKey || !!deepseekApiKey?.value;
    } else if (isGeminiProvider(provider)) {
      return !!provider.apiKey || !!geminiApiKey?.value;
    } else if (isBedrockProvider(provider)) {
      return (!!provider.accessKeyId || !!awsAccessKeyId?.value) && (!!provider.secretAccessKey || !!awsSecretAccessKey?.value);
    } else if (isOpenAiCompatibleProvider(provider)) {
      return !!provider.apiKey && !!provider.baseUrl;
    } else if (isOllamaProvider(provider)) {
      return !!provider.baseUrl;
    } else if (isOpenRouterProvider(provider)) {
      return !!provider.apiKey || !!openrouterApiKey?.value;
    } else if (isRequestyProvider(provider)) {
      return !!provider.apiKey || !!requestyApiKey?.value;
    } else {
      return false;
    }
  };

  // Determine which providers to show
  const providersToShow = showAll ? AVAILABLE_PROVIDERS : prominentProviders;

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-100 mb-4">{t('settings.models.description')}</p>

      <div className="grid grid-cols-1 gap-2">
        {providersToShow.map((providerName) => {
          const provider = getLlmProviderConfig(providerName, settings);
          const isConfigured = isProviderConfigured(providerName);
          const isExpanded = expandedProvider === providerName;

          const getAgentOnly = () => {
            if (providerName === 'requesty') {
              return true;
            }
            if (providerName === 'openai-compatible') {
              return isProviderConfigured('openai');
            }
            return false;
          };

          return (
            <ProviderCard
              key={providerName}
              providerName={providerName}
              provider={provider}
              isConfigured={isConfigured}
              isExpanded={isExpanded}
              agentOnly={getAgentOnly()}
              onExpand={() => handleProviderExpand(providerName)}
              onProviderChange={handleProviderParamsChange}
            />
          );
        })}
      </div>

      {showProminentModels && !showAll && (
        <div className="flex justify-center mt-4">
          <Button variant="outline" size="sm" color="secondary" onClick={() => setShowAll(true)}>
            {t('settings.models.showAllProviders')}
          </Button>
        </div>
      )}

      <div className="mt-6 p-4 bg-neutral-800/50 rounded-lg border border-neutral-700">
        <p className="text-xs text-neutral-300">
          <Trans
            i18nKey="settings.models.additionalProvidersInfo"
            components={{
              aiderTab: <button onClick={onSwitchToAiderTab} className="text-blue-400 hover:text-blue-300 underline transition-colors duration-200" />,
            }}
          />
        </p>
      </div>
    </div>
  );
};

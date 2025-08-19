import { forwardRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AVAILABLE_PROVIDERS,
  isOllamaProvider,
  LlmProviderName,
  OpenAiCompatibleProvider,
  OpenRouterProvider,
  DEFAULT_AGENT_PROVIDER_MODELS,
  RequestyProvider,
} from '@common/agent';
import { AgentProfile, SettingsData } from '@common/types';
import { BiCog } from 'react-icons/bi';

import { ModelSelector, ModelSelectorRef } from './ModelSelector';

import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { IconButton } from '@/components/common/IconButton';
import { useBooleanState } from '@/hooks/useBooleanState';
import { useOllamaModels } from '@/hooks/useOllamaModels';
import { useLmStudioModels } from '@/hooks/useLmStudioModels';
import { showErrorNotification } from '@/utils/notifications';

type Props = {
  className?: string;
  settings: SettingsData | null;
  agentProfile: AgentProfile | undefined;
  saveSettings: (settings: SettingsData) => void;
  showSettingsButton?: boolean;
};

export const AgentModelSelector = forwardRef<ModelSelectorRef, Props>(({ className, settings, agentProfile, saveSettings, showSettingsButton = true }, ref) => {
  const { t } = useTranslation();
  const [settingsDialogVisible, showSettingsDialog, hideSettingsDialog] = useBooleanState(false);

  const ollamaBaseUrl = useMemo(() => {
    const ollamaProvider = settings?.llmProviders['ollama'];
    return ollamaProvider && isOllamaProvider(ollamaProvider) ? ollamaProvider.baseUrl : '';
  }, [settings?.llmProviders]);

  const lmStudioBaseUrl = useMemo(() => {
    const lmStudioProvider = settings?.llmProviders['lmstudio'];
    return lmStudioProvider?.baseUrl || '';
  }, [settings?.llmProviders]);

  const ollamaModels = useOllamaModels(ollamaBaseUrl);
  const lmStudioModels = useLmStudioModels(lmStudioBaseUrl);

  const agentModels = useMemo(() => {
    if (!settings) {
      return [];
    }

    const models: string[] = [];
    AVAILABLE_PROVIDERS.forEach((provider) => {
      switch (provider) {
        case 'ollama':
          if (ollamaModels.length > 0) {
            models.push(...ollamaModels.map((model) => `ollama/${model}`));
          }
          break;
        case 'groq':
        case 'openrouter':
        case 'requesty':
        case 'openai-compatible': {
          const llmProvider = settings.llmProviders[provider] as OpenRouterProvider | RequestyProvider | OpenAiCompatibleProvider;
          if (llmProvider) {
            models.push(...llmProvider.models.sort().map((model) => `${provider}/${model}`));
          }
          break;
        }
        case 'lmstudio':
          if (lmStudioModels.length > 0) {
            models.push(...lmStudioModels.map((model) => `lmstudio/${model}`));
          }
          break;
        default:
          models.push(...(DEFAULT_AGENT_PROVIDER_MODELS[provider] || []).map((model) => `${provider}/${model}`));
          break;
      }
    });
    // Add the currently selected model if it's not in the known list (custom model)
    if (agentProfile && !models.some((model) => model === `${agentProfile.provider}/${agentProfile.model}`)) {
      const currentSelection = `${agentProfile.provider}/${agentProfile.model}`;
      if (!models.includes(currentSelection)) {
        models.unshift(currentSelection); // Add to the beginning for visibility
      }
    }
    return models;
  }, [settings, agentProfile, ollamaModels, lmStudioModels]);

  const selectedModelDisplay = agentProfile ? `${agentProfile.provider}/${agentProfile.model}` : t('common.notSet');

  const onModelSelected = useCallback(
    (selectedModelString: string) => {
      if (!settings) {
        return;
      }

      const [providerName, ...modelNameParts] = selectedModelString.split('/');
      const modelName = modelNameParts.join('/');
      if (!providerName || !modelName) {
        showErrorNotification(
          t('modelSelector.invalidModelSelection', {
            model: selectedModelString,
          }),
        );
        return;
      }

      if (!AVAILABLE_PROVIDERS.includes(providerName as LlmProviderName)) {
        showErrorNotification(
          t('modelSelector.providerNotSupported', {
            provider: providerName,
            providers: AVAILABLE_PROVIDERS.join(', '),
          }),
        );
        return;
      }

      const updatedProfiles = settings.agentProfiles.map((profile) => {
        if (profile.id === agentProfile?.id) {
          return {
            ...profile,
            provider: providerName,
            model: modelName,
          } as AgentProfile;
        }
        return profile;
      });

      // Update llmProvider models if needed
      const updatedLlmProviders = { ...settings.llmProviders };
      if (['openrouter', 'requesty', 'openai-compatible'].includes(providerName)) {
        const provider = updatedLlmProviders[providerName];
        if (provider && Array.isArray(provider.models) && !provider.models.includes(modelName)) {
          updatedLlmProviders[providerName] = {
            ...provider,
            models: [...provider.models, modelName],
          };
        }
      }

      const updatedSettings: SettingsData = {
        ...settings,
        agentProfiles: updatedProfiles,
        models: {
          ...settings.models,
          agentPreferred: [...new Set([selectedModelString, ...settings.models.agentPreferred])],
        },
        llmProviders: updatedLlmProviders,
      };
      saveSettings(updatedSettings);
    },
    [settings, saveSettings, t, agentProfile?.id],
  );

  const removePreferredModel = useCallback(
    (model: string) => {
      if (!settings) {
        return;
      }

      const updatedSettings = {
        ...settings,
        models: {
          ...settings.models,
          agentPreferred: (settings.models.agentPreferred || []).filter((m: string) => m !== model),
        },
      };
      saveSettings(updatedSettings);
    },
    [settings, saveSettings],
  );

  if (!agentProfile) {
    return <div className="text-xs text-text-muted-light">{t('modelSelector.noActiveAgentProvider')}</div>;
  }

  return (
    <>
      <div className="relative flex items-center space-x-1">
        <ModelSelector
          ref={ref}
          className={className}
          models={agentModels}
          selectedModel={selectedModelDisplay}
          onChange={onModelSelected}
          preferredModels={settings?.models.agentPreferred || []}
          removePreferredModel={removePreferredModel}
        />
        {showSettingsButton && (
          <IconButton icon={<BiCog className="w-4 h-4" />} onClick={showSettingsDialog} className="p-0.5 hover:bg-bg-tertiary rounded-md" />
        )}
      </div>
      {settingsDialogVisible && <SettingsDialog onClose={hideSettingsDialog} initialTab={1} initialAgentProvider={agentProfile?.provider} />}
    </>
  );
});

AgentModelSelector.displayName = 'AgentModelSelector';

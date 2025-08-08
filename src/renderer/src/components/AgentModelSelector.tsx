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
import { useSettings } from '@/context/SettingsContext';
import { useProjectSettings } from '@/context/ProjectSettingsContext';
import { showErrorNotification } from '@/utils/notifications';

export const AgentModelSelector = forwardRef<ModelSelectorRef>((_, ref) => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const { projectSettings } = useProjectSettings();
  const [settingsDialogVisible, showSettingsDialog, hideSettingsDialog] = useBooleanState(false);

  const activeAgentProfile = useMemo(() => {
    return settings?.agentProfiles.find((profile) => profile.id === projectSettings?.agentProfileId);
  }, [projectSettings?.agentProfileId, settings?.agentProfiles]);

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
          const llmProvider = settings?.llmProviders[provider] as OpenRouterProvider | RequestyProvider | OpenAiCompatibleProvider;
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
    if (activeAgentProfile && !models.some((model) => model === `${activeAgentProfile.provider}/${activeAgentProfile.model}`)) {
      const currentSelection = `${activeAgentProfile.provider}/${activeAgentProfile.model}`;
      if (!models.includes(currentSelection)) {
        models.unshift(currentSelection); // Add to the beginning for visibility
      }
    }
    return models;
  }, [activeAgentProfile, ollamaModels, lmStudioModels, settings?.llmProviders]);

  const selectedModelDisplay = activeAgentProfile ? `${activeAgentProfile.provider}/${activeAgentProfile.model}` : t('common.notSet');

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

      const updatedProfiles = settings?.agentProfiles.map((profile) => {
        if (profile.id === activeAgentProfile?.id) {
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
        agentProfiles: updatedProfiles || [],
        models: {
          ...settings.models,
          agentPreferred: [...new Set([selectedModelString, ...settings.models.agentPreferred])],
        },
        llmProviders: updatedLlmProviders,
      };
      void saveSettings(updatedSettings);
    },
    [settings, saveSettings, t, activeAgentProfile?.id],
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
      void saveSettings(updatedSettings);
    },
    [settings, saveSettings],
  );

  if (!activeAgentProfile) {
    return <div className="text-xs text-text-mutedLight">{t('modelSelector.noActiveAgentProvider')}</div>;
  }

  return (
    <>
      <div className="relative flex items-center space-x-1">
        <ModelSelector
          ref={ref}
          models={agentModels}
          selectedModel={selectedModelDisplay}
          onChange={onModelSelected}
          preferredModels={settings?.models.agentPreferred || []}
          removePreferredModel={removePreferredModel}
        />
        <IconButton icon={<BiCog className="w-4 h-4" />} onClick={showSettingsDialog} className="p-0.5 hover:bg-bg-tertiary rounded-md" />
      </div>
      {settingsDialogVisible && <SettingsDialog onClose={hideSettingsDialog} initialTab={1} initialAgentProvider={activeAgentProfile?.provider} />}
    </>
  );
});

AgentModelSelector.displayName = 'AgentModelSelector';

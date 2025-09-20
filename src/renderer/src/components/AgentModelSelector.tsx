import { forwardRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_PROVIDERS, getProviderModelId } from '@common/agent';
import { AgentProfile, Model, SettingsData } from '@common/types';

import { ModelSelector, ModelSelectorRef } from './ModelSelector';

import { useModelProviders } from '@/contexts/ModelProviderContext';
import { showErrorNotification } from '@/utils/notifications';

type Props = {
  className?: string;
  settings: SettingsData | null;
  agentProfile: AgentProfile | undefined;
  saveSettings: (settings: SettingsData) => void;
};

export const AgentModelSelector = forwardRef<ModelSelectorRef, Props>(({ className, settings, agentProfile, saveSettings }, ref) => {
  const { t } = useTranslation();
  const { providers, models } = useModelProviders();

  const currentModel = agentProfile ? models.find((m) => m.id === agentProfile.model && m.providerId === agentProfile.provider) : undefined;
  const currentModelId = currentModel ? getProviderModelId(currentModel) : agentProfile ? `${agentProfile.provider}/${agentProfile.model}` : undefined;

  const agentModels = useMemo(() => {
    const agentModels: Model[] = [...models];

    // Add the currently selected model if it's not in the known list (custom model)
    if (currentModelId) {
      const existingModel = agentModels.find((model) => getProviderModelId(model) === currentModelId);
      if (!existingModel) {
        // Create a custom model object for the current model
        const [providerId, ...modelNameParts] = currentModelId.split('/');
        const modelId = modelNameParts.join('/');
        if (providerId && modelId) {
          const customModel: Model = {
            id: modelId,
            providerId: providerId,
          };
          agentModels.unshift(customModel); // Add to the beginning for visibility
        }
      }
    }
    return agentModels;
  }, [currentModelId, models]);

  const onModelSelected = useCallback(
    (selectedModel: Model) => {
      if (!settings) {
        return;
      }

      const selectedModelId = getProviderModelId(selectedModel);
      const [providerId, ...modelNameParts] = selectedModelId.split('/');
      const modelId = modelNameParts.join('/');
      if (!providerId || !modelId) {
        showErrorNotification(
          t('modelSelector.invalidModelSelection', {
            model: selectedModelId,
          }),
        );
        return;
      }

      const provider = providers.find((provider) => provider.id === providerId);
      if (!provider) {
        showErrorNotification(
          t('modelSelector.providerNotSupported', {
            provider: providerId,
            providers: AVAILABLE_PROVIDERS.join(', '),
          }),
        );
        return;
      }

      const updatedProfiles = settings.agentProfiles.map((profile) => {
        if (profile.id === agentProfile?.id) {
          return {
            ...profile,
            provider: provider.id,
            model: modelId,
          } as AgentProfile;
        }
        return profile;
      });

      const updatedSettings: SettingsData = {
        ...settings,
        agentProfiles: updatedProfiles,
        preferredModels: [...new Set([selectedModelId, ...settings.preferredModels])],
      };
      saveSettings(updatedSettings);
    },
    [settings, providers, saveSettings, t, agentProfile?.id],
  );

  const removePreferredModel = useCallback(
    (model: string) => {
      if (!settings) {
        return;
      }

      const updatedSettings = {
        ...settings,
        preferredModels: (settings.preferredModels || []).filter((m: string) => m !== model),
      } satisfies SettingsData;
      saveSettings(updatedSettings);
    },
    [settings, saveSettings],
  );

  if (!agentProfile) {
    return <div className="text-xs text-text-muted-light">{t('modelSelector.noActiveAgentProvider')}</div>;
  }

  return (
    <div className="relative flex items-center space-x-1">
      <ModelSelector
        ref={ref}
        className={className}
        models={agentModels}
        selectedModelId={currentModelId}
        onChange={onModelSelected}
        preferredModelIds={settings?.preferredModels || []}
        removePreferredModel={removePreferredModel}
        providers={providers}
      />
    </div>
  );
});

AgentModelSelector.displayName = 'AgentModelSelector';

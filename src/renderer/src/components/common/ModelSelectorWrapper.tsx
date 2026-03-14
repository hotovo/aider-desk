import { forwardRef, useCallback, useMemo } from 'react';
import { Model } from '@common/types';
import { getProviderModelId } from '@common/agent';

import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useSettings } from '@/contexts/SettingsContext';

type Props = {
  className?: string;
  selectedModelId?: string;
  onChange: (model: Model) => void;
  popupPlacement?: 'top' | 'bottom';
};

export const ModelSelectorWrapper = forwardRef<ModelSelectorRef, Props>(({ className, selectedModelId, onChange, popupPlacement }, ref) => {
  const { models, providers } = useModelProviders();
  const { settings, saveSettings } = useSettings();

  const preferredModelIds = useMemo(() => settings?.preferredModels ?? [], [settings?.preferredModels]);

  const updatePreferredModels = useCallback(
    (model: string) => {
      if (!settings) {
        return;
      }
      const updatedSettings = {
        ...settings,
        preferredModels: [...new Set([model, ...settings.preferredModels])],
      };
      void saveSettings(updatedSettings);
    },
    [saveSettings, settings],
  );

  const removePreferredModel = useCallback(
    (modelId: string) => {
      if (!settings) {
        return;
      }
      const updatedSettings = {
        ...settings,
        preferredModels: settings.preferredModels.filter((id) => id !== modelId),
      };
      void saveSettings(updatedSettings);
    },
    [saveSettings, settings],
  );

  const handleChange = useCallback(
    (model: Model) => {
      const modelId = getProviderModelId(model);
      updatePreferredModels(modelId);
      onChange(model);
    },
    [onChange, updatePreferredModels],
  );

  const sortedModels = useMemo(() => {
    const sortedModels: Model[] = [...models];
    sortedModels.sort((model, otherModel) => {
      const modelId = getProviderModelId(model);
      const otherModelId = getProviderModelId(otherModel);
      return modelId.localeCompare(otherModelId);
    });
    return sortedModels;
  }, [models]);

  return (
    <ModelSelector
      ref={ref}
      className={className}
      models={sortedModels}
      selectedModelId={selectedModelId}
      onChange={handleChange}
      preferredModelIds={preferredModelIds}
      removePreferredModel={removePreferredModel}
      providers={providers}
      popupPlacement={popupPlacement}
    />
  );
});

ModelSelectorWrapper.displayName = 'ModelSelectorWrapper';

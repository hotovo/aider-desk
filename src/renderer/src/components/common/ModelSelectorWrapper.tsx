import { forwardRef, useCallback, useMemo } from 'react';
import { Model } from '@common/types';
import { getProviderModelId } from '@common/agent';

import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useSaveSettings, useSettingsStore } from '@/stores/settingsStore';

type Props = {
  className?: string;
  selectedModelId?: string | null;
  onChange: (model: Model | null) => void;
  popupPlacement?: 'top' | 'bottom';
  labelOnNull?: string;
  skipPreferredModelsUpdate?: boolean;
  usePortal?: boolean;
};

export const ModelSelectorWrapper = forwardRef<ModelSelectorRef, Props>(
  ({ className, selectedModelId, onChange, popupPlacement, labelOnNull, skipPreferredModelsUpdate, usePortal }, ref) => {
    const { models, providers } = useModelProviders();
    const preferredModelIds = useSettingsStore((state) => state.settings?.preferredModels) ?? [];
    const saveSettings = useSaveSettings();

    const updatePreferredModels = useCallback(
      (model: string) => {
        const settings = useSettingsStore.getState().settings;
        if (!settings) {
          return;
        }
        const updatedSettings = {
          ...settings,
          preferredModels: [...new Set([model, ...settings.preferredModels])],
        };
        void saveSettings(updatedSettings);
      },
      [saveSettings],
    );

    const removePreferredModel = useCallback(
      (modelId: string) => {
        const settings = useSettingsStore.getState().settings;
        if (!settings) {
          return;
        }
        const updatedSettings = {
          ...settings,
          preferredModels: settings.preferredModels.filter((id) => id !== modelId),
        };
        void saveSettings(updatedSettings);
      },
      [saveSettings],
    );

    const handleChange = useCallback(
      (model: Model | null) => {
        if (model === null) {
          onChange(null);
        } else {
          const modelId = getProviderModelId(model);
          if (!skipPreferredModelsUpdate) {
            updatePreferredModels(modelId);
          }
          onChange(model);
        }
      },
      [onChange, updatePreferredModels, skipPreferredModelsUpdate],
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
        labelOnNull={labelOnNull}
        usePortal={usePortal}
      />
    );
  },
);

ModelSelectorWrapper.displayName = 'ModelSelectorWrapper';

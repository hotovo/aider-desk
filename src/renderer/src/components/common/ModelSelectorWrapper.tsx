import { forwardRef, useCallback, useMemo } from 'react';
import { Model } from '@common/types';
import { ModelSelectorProps } from '@common/extensions';
import { getProviderModelId } from '@common/agent';

import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useSaveSettings, useSettingsStore } from '@/stores/settingsStore';

type Props = ModelSelectorProps;

export const ModelSelectorWrapper = forwardRef<ModelSelectorRef, Props>(
  (
    {
      className,
      selectedModelId,
      onChange,
      popupPlacement,
      labelOnNull,
      skipPreferredModelsUpdate,
      usePortal,
      models: modelsOverride,
      providers: providersOverride,
      preferredModels,
      onPreferredModelsChange,
    },
    ref,
  ) => {
    const catalog = useModelProviders();
    const models = modelsOverride ?? catalog.models;
    const providers = providersOverride ?? catalog.providers;
    const globalPreferredModelIds = useSettingsStore((state) => state.settings?.preferredModels) ?? [];
    const saveSettings = useSaveSettings();
    const preferredModelIds = preferredModels ?? globalPreferredModelIds;
    const visiblePreferredModelIds = useMemo(() => {
      if (modelsOverride === undefined) {
        return preferredModelIds;
      }
      const modelIds = new Set(modelsOverride.map(getProviderModelId));
      return preferredModelIds.filter((id) => modelIds.has(id));
    }, [modelsOverride, preferredModelIds]);

    const updatePreferredModels = useCallback(
      (model: string) => {
        if (preferredModels !== undefined) {
          onPreferredModelsChange?.([...new Set([model, ...preferredModels])]);
          return;
        }
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
      [saveSettings, preferredModels, onPreferredModelsChange],
    );

    const removePreferredModel = useCallback(
      (modelId: string) => {
        if (preferredModels !== undefined) {
          onPreferredModelsChange?.(preferredModels.filter((id) => id !== modelId));
          return;
        }
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
      [saveSettings, preferredModels, onPreferredModelsChange],
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
        preferredModelIds={visiblePreferredModelIds}
        removePreferredModel={preferredModels === undefined || onPreferredModelsChange ? removePreferredModel : undefined}
        providers={providers}
        popupPlacement={popupPlacement}
        labelOnNull={labelOnNull}
        usePortal={usePortal}
      />
    );
  },
);

ModelSelectorWrapper.displayName = 'ModelSelectorWrapper';

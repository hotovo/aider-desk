import { ModelsData } from '@common/types';
import React, { useCallback, useImperativeHandle, useRef } from 'react';

import { ModelSelector, ModelSelectorRef } from '@/components/ModelSelector';
import { useSettings } from '@/context/SettingsContext';

type Props = {
  baseDir: string;
  allModels?: string[];
  modelsData: ModelsData | null;
  architectMode: boolean;
  onModelChange?: () => void;
};

export type ProjectTopBarRef = {
  openMainModelSelector: () => void;
};

export const ProjectBar = React.forwardRef<ProjectTopBarRef, Props>(({ baseDir, allModels = [], modelsData, architectMode, onModelChange }, ref) => {
  const mainModelSelectorRef = useRef<ModelSelectorRef>(null);
  const architectModelSelectorRef = useRef<ModelSelectorRef>(null);

  useImperativeHandle(ref, () => ({
    openMainModelSelector: () => {
      if (architectMode) {
        architectModelSelectorRef.current?.open();
      } else {
        mainModelSelectorRef.current?.open();
      }
    },
  }));

  const { settings, saveSettings } = useSettings();

  const updatePreferredModels = useCallback(
    (model: string) => {
      if (!settings) {
        return;
      }
      const updatedSettings = {
        ...settings,
        models: {
          ...settings.models,
          preferred: [model, ...settings.models.preferred.filter((m) => m !== model)],
        },
      };
      void saveSettings(updatedSettings);
    },
    [saveSettings, settings],
  );

  const updateMainModel = useCallback(
    (mainModel: string) => {
      window.api.updateMainModel(baseDir, mainModel);
      updatePreferredModels(mainModel);
      onModelChange?.();
    },
    [baseDir, onModelChange, updatePreferredModels],
  );

  const updateWeakModel = useCallback(
    (weakModel: string) => {
      window.api.updateWeakModel(baseDir, weakModel);
      updatePreferredModels(weakModel);
      onModelChange?.();
    },
    [baseDir, onModelChange, updatePreferredModels],
  );

  const updateArchitectModel = useCallback(
    (architectModel: string) => {
      window.api.updateArchitectModel(baseDir, architectModel);
      updatePreferredModels(architectModel);
      onModelChange?.();
    },
    [baseDir, onModelChange, updatePreferredModels],
  );

  return (
    <div className="relative group">
      {!modelsData ? (
        <div className="text-xs">Loading model...</div>
      ) : (
        <div className="flex items-center space-x-3">
          {architectMode && (
            <>
              <div className="flex items-center space-x-1">
                <span className="text-xs">Architect model:</span>
                <ModelSelector
                  ref={architectModelSelectorRef}
                  models={allModels}
                  selectedModel={modelsData.architectModel || modelsData.mainModel}
                  onChange={updateArchitectModel}
                />
              </div>
              <div className="h-3 w-px bg-neutral-600/50"></div>
            </>
          )}
          <div className="flex items-center space-x-1">
            <span className="text-xs">{architectMode ? 'Editor model:' : 'Main model:'}</span>
            <ModelSelector ref={mainModelSelectorRef} models={allModels} selectedModel={modelsData.mainModel} onChange={updateMainModel} />
          </div>
          <div className="h-3 w-px bg-neutral-600/50"></div>
          <div className="flex items-center space-x-1">
            <span className="text-xs">Weak model:</span>
            <ModelSelector models={allModels} selectedModel={modelsData.weakModel || modelsData.mainModel} onChange={updateWeakModel} />
          </div>
          {modelsData.maxChatHistoryTokens && (
            <>
              <div className="h-3 w-px bg-neutral-600/50"></div>
              <div className="flex items-center space-x-1">
                <span className="text-xs">Max tokens:</span>
                <span className="text-neutral-400 text-xs">{modelsData.maxChatHistoryTokens}</span>
              </div>
            </>
          )}
          {modelsData.reasoningEffort && (
            <>
              <div className="h-3 w-px bg-neutral-600/50"></div>
              <div className="flex items-center space-x-1">
                <span className="text-xs">Reasoning:</span>
                <span className="text-neutral-400 text-xs">{modelsData.reasoningEffort}</span>
              </div>
            </>
          )}
          {modelsData.thinkingTokens && (
            <>
              <div className="h-3 w-px bg-neutral-600/50"></div>
              <div className="flex items-center space-x-1">
                <span className="text-xs">Thinking tokens:</span>
                <span className="text-neutral-400 text-xs">{modelsData.thinkingTokens}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

ProjectBar.displayName = 'ProjectTopBar';

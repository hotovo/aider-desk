import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MdEdit, MdKeyboardArrowUp } from 'react-icons/md';
import { LlmProvider, PROVIDER_MODELS, getActiveProvider, isOllamaProvider } from '@common/llm-providers';

import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { IconButton } from '@/components/common/IconButton';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';
import { useOllamaModels } from '@/hooks/useOllamaModels';
import { useSettings } from '@/context/SettingsContext';

type Props = Record<string, never>;

export const AgentModelSelector = forwardRef<HTMLDivElement, Props>((_props, _ref) => {
  const { t } = useTranslation();
  const { settings, saveSettings } = useSettings();
  const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);
  const [visible, show, hide] = useBooleanState(false);
  const [settingsDialogVisible, showSettingsDialog, hideSettingsDialog] = useBooleanState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const highlightedModelRef = useRef<HTMLDivElement>(null);

  useClickOutside(modelSelectorRef, hide);

  useEffect(() => {
    if (!visible) {
      setHighlightedModelIndex(-1);
    }
  }, [visible]);

  const activeProvider = useMemo(() => (settings?.agentConfig ? getActiveProvider(settings.agentConfig.providers) : null), [settings?.agentConfig]);

  const ollamaBaseUrl = useMemo(() => {
    const provider = settings?.agentConfig?.providers.find((p) => isOllamaProvider(p));
    return provider && isOllamaProvider(provider) ? provider.baseUrl : '';
  }, [settings?.agentConfig?.providers]);

  const ollamaModels = useOllamaModels(ollamaBaseUrl);

  const agentModels = useMemo(() => {
    if (!settings?.agentConfig?.providers) {
      return [];
    }
    const models: string[] = [];
    settings.agentConfig.providers.forEach((provider) => {
      const providerModels = isOllamaProvider(provider) ? ollamaModels : Object.keys(PROVIDER_MODELS[provider.name]?.models || {});
      providerModels.forEach((modelName) => {
        models.push(`${provider.name}/${modelName}`);
      });
    });
    // Add the currently selected model if it's not in the known list (custom model)
    if (activeProvider && !models.some((m) => m === `${activeProvider.name}/${activeProvider.model}`)) {
      const currentSelection = `${activeProvider.name}/${activeProvider.model}`;
      if (!models.includes(currentSelection)) {
        models.unshift(currentSelection); // Add to the beginning for visibility
      }
    }
    return models.sort(); // Sort alphabetically for consistency
  }, [settings?.agentConfig?.providers, activeProvider, ollamaModels]);

  const selectedModelDisplay = activeProvider ? `${activeProvider.name}/${activeProvider.model}` : t('common.notSet');

  const toggleVisible = useCallback(() => {
    if (visible) {
      hide();
    } else {
      show();
    }
  }, [visible, hide, show]);

  const onModelSelected = useCallback(
    (selectedModelString: string) => {
      if (!settings?.agentConfig) {
        return;
      }

      const [providerName, modelName] = selectedModelString.split('/');
      if (!providerName || !modelName) {
        // eslint-disable-next-line no-console
        console.error('Invalid model string format:', selectedModelString);
        return; // Invalid format
      }

      let providerFound = false;
      const updatedProviders = settings.agentConfig.providers.map((provider) => {
        if (provider.name === providerName) {
          providerFound = true;
          return { ...provider, model: modelName, active: true };
        }
        return { ...provider, active: false };
      });

      // Handle case where the selected provider wasn't in the initial list (shouldn't happen with current logic, but good practice)
      if (!providerFound) {
        // eslint-disable-next-line no-console
        console.error(`Provider ${providerName} not found in configured providers.`);
        // Optionally, add the provider if desired, or just return
        return;
      }

      const updatedSettings = {
        ...settings,
        agentConfig: {
          ...settings.agentConfig,
          providers: updatedProviders as LlmProvider[], // Ensure correct type
        },
      };
      void saveSettings(updatedSettings);
      hide();
    },
    [settings, saveSettings, hide],
  );

  const onModelSelectorKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedModelIndex((prev) => {
          const newIndex = Math.min(prev + 1, agentModels.length - 1);
          setTimeout(() => highlightedModelRef.current?.scrollIntoView({ block: 'nearest' }), 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedModelIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          setTimeout(() => highlightedModelRef.current?.scrollIntoView({ block: 'nearest' }), 0);
          return newIndex;
        });
        break;
      case 'Enter':
        if (highlightedModelIndex !== -1) {
          e.preventDefault();
          const selected = agentModels[highlightedModelIndex];
          onModelSelected(selected);
        }
        break;
      case 'Escape':
        e.preventDefault();
        hide();
        break;
    }
  };

  const renderModelItem = (modelString: string, index: number) => {
    const isSelected = modelString === selectedModelDisplay;
    return (
      <div
        key={modelString}
        ref={index === highlightedModelIndex ? highlightedModelRef : undefined}
        className={`flex items-center w-full hover:bg-neutral-700 transition-colors duration-200 ${index === highlightedModelIndex ? 'bg-neutral-700' : 'text-neutral-300'}`}
      >
        <button
          onClick={() => onModelSelected(modelString)}
          className={`flex-grow px-3 py-1 text-left text-xs
                        ${isSelected ? 'text-white font-bold' : ''}`}
        >
          {modelString}
        </button>
      </div>
    );
  };

  if (!activeProvider) {
    return <div className="text-xs text-neutral-400">{t('modelSelector.noActiveAgentProvider')}</div>;
  }

  return (
    <>
      <div className="relative flex items-center space-x-1" ref={modelSelectorRef}>
        <button onClick={toggleVisible} className="flex items-center hover:text-neutral-300 focus:outline-none transition-colors duration-200 text-xs">
          <span>{selectedModelDisplay}</span>
          <MdKeyboardArrowUp className={`w-3 h-3 ml-1 transform transition-transform ${visible ? '' : 'rotate-180'}`} />
        </button>
        <IconButton icon={<MdEdit className="w-4 h-4" />} onClick={showSettingsDialog} className="p-0.5 hover:bg-neutral-700 rounded-md" />
        {visible && agentModels.length > 0 && (
          <div
            className="absolute top-full left-[-5px] mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 flex flex-col w-auto min-w-[500px]"
            onKeyDown={onModelSelectorKeyDown}
            tabIndex={-1} // Make the div focusable for keydown events
          >
            <div className="overflow-y-auto scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 max-h-48">
              {agentModels.map(renderModelItem)}
            </div>
          </div>
        )}
      </div>
      {settingsDialogVisible && <SettingsDialog onClose={hideSettingsDialog} initialTab={2} />}
    </>
  );
});

AgentModelSelector.displayName = 'AgentModelSelector';

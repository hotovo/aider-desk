import { forwardRef, useImperativeHandle, useRef, KeyboardEvent, MouseEvent, useOptimistic, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdKeyboardArrowUp, MdKeyboardReturn } from 'react-icons/md';
import { useDebounce } from '@reactuses/core';
import { twMerge } from 'tailwind-merge';
import { Model, ProviderProfile } from '@common/types';
import { getProviderModelId } from '@common/agent';
import { extractProviderModel } from '@common/utils';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useDropdownState } from '@/hooks/useDropdownState';
import { KeyboardKeys } from '@/constants/keyboardKeys';

export type ModelSelectorRef = {
  open: (model?: string) => void;
};

type Props = {
  className?: string;
  models: Model[];
  selectedModelId?: string;
  onChange: (model: Model) => void;
  preferredModelIds: string[];
  removePreferredModel?: (modelId: string) => void;
  providers: ProviderProfile[];
  popupPlacement?: 'top' | 'bottom';
};

export const ModelSelector = forwardRef<ModelSelectorRef, Props>(
  ({ className, models, selectedModelId, onChange, preferredModelIds, removePreferredModel, providers, popupPlacement = 'bottom' }, ref) => {
    const { t } = useTranslation();
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const highlightedModelRef = useRef<HTMLDivElement>(null);
    const [optimisticSelectedModelId, setOptimisticSelectedModel] = useOptimistic(selectedModelId);

    const getProviderName = (providerId: string) => {
      const provider = providers.find((p) => p.id === providerId);
      return provider?.name || t(`providers.${providerId}`);
    };
    const [selectedProviderId, selectedModel] = extractProviderModel(optimisticSelectedModelId || '');
    const selectedProviderName = selectedProviderId ? getProviderName(selectedProviderId) : '';

    const { isOpen, state, open, close, toggle, updateState } = useDropdownState({
      initialState: { modelSearchTerm: '', highlightedModelIndex: -1 },
      onCloseReset: { modelSearchTerm: '', highlightedModelIndex: -1 },
    });

    const debouncedSearchTerm = useDebounce(state.modelSearchTerm, 300);

    const preferredModels = !debouncedSearchTerm
      ? preferredModelIds.map((id) => {
          const existing = models.find((m) => getProviderModelId(m) === id);
          if (existing) {
            return existing;
          }
          const [providerId, ...modelParts] = id.split('/');
          return { id: modelParts.join('/'), providerId } as Model;
        })
      : [];

    const filteredModels = models.filter((model) => {
      const modelId = getProviderModelId(model);
      const provider = providers.find((p) => p.id === model.providerId);
      const isProviderDisabled = provider && provider.disabled;
      return modelId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) && !model.isHidden && !isProviderDisabled;
    });

    // Group filtered models by providerId
    const groupedFilteredModels = Object.entries(
      filteredModels.reduce(
        (acc, model) => {
          const providerId = model.providerId;
          if (!acc[providerId]) {
            acc[providerId] = [];
          }
          acc[providerId].push(model);
          return acc;
        },
        {} as Record<string, Model[]>,
      ),
    )
      .map(([providerId, models]) => ({ providerId, models }))
      .sort((a, b) => a.providerId.localeCompare(b.providerId));

    const showCustomModelHint = filteredModels.length === 0 && state.modelSearchTerm.trim() !== '';

    useClickOutside(modelSelectorRef, close);

    useImperativeHandle(ref, () => ({
      open: (model) => {
        open({ modelSearchTerm: model || '' });
      },
    }));

    const onModelSelected = (model: Model) => {
      close();
      startTransition(async () => {
        const modelId = getProviderModelId(model);
        setOptimisticSelectedModel(modelId);
        onChange(model);
      });
    };

    const onModelSelectorSearchInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      const allModels = [...preferredModels, ...groupedFilteredModels.flatMap((group) => group.models)];

      switch (e.key) {
        case KeyboardKeys.ArrowDown:
          e.preventDefault();
          updateState((prev) => {
            const newIndex = Math.min(prev.highlightedModelIndex + 1, allModels.length - 1);
            setTimeout(() => highlightedModelRef.current?.scrollIntoView({ block: 'nearest' }), 0);
            return { ...prev, highlightedModelIndex: newIndex };
          });
          break;
        case KeyboardKeys.ArrowUp:
          e.preventDefault();
          updateState((prev) => {
            const newIndex = Math.max(prev.highlightedModelIndex - 1, 0);
            setTimeout(() => highlightedModelRef.current?.scrollIntoView({ block: 'nearest' }), 0);
            return { ...prev, highlightedModelIndex: newIndex };
          });
          break;
        case KeyboardKeys.Enter:
          if (state.highlightedModelIndex !== -1) {
            e.preventDefault();
            const selected = allModels[state.highlightedModelIndex];
            onModelSelected(selected);
          }
          break;
        case KeyboardKeys.Escape:
          e.preventDefault();
          close();
          break;
      }
    };

    const renderModelItem = (model: Model, index: number, isPreferred: boolean) => {
      const fullModelId = getProviderModelId(model);
      index = index + (isPreferred ? 0 : preferredModels.length);

      const handleRemovePreferredModel = (e: MouseEvent) => {
        e.stopPropagation();
        removePreferredModel?.(fullModelId);
      };

      const providerId = isPreferred ? extractProviderModel(fullModelId)[0] : model.providerId;
      const modelIdPart = isPreferred ? extractProviderModel(fullModelId)[1] : model.id;
      const providerName = getProviderName(providerId);

      return (
        <div
          key={fullModelId}
          ref={index === state.highlightedModelIndex ? highlightedModelRef : undefined}
          className={`flex items-center w-full hover:bg-bg-tertiary transition-colors duration-200 ${index === state.highlightedModelIndex ? 'bg-bg-tertiary' : 'text-text-tertiary'}`}
        >
          <button
            onClick={() => onModelSelected(model)}
            className={`flex-grow px-3 py-1 text-left ${fullModelId === optimisticSelectedModelId ? 'text-text-primary' : ''}`}
          >
            {isPreferred ? (
              <div className="text-xs">
                {modelIdPart} <span className="text-text-muted text-2xs">({providerName})</span>
              </div>
            ) : (
              <>
                <div className="text-xs font-medium">{modelIdPart}</div>
              </>
            )}
          </button>
          {isPreferred && removePreferredModel && (
            <button
              onClick={handleRemovePreferredModel}
              className="px-2 py-1 text-text-muted hover:text-text-muted-light transition-colors duration-200"
              title={t('modelSelector.removePreferred')}
            >
              <MdClose className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    };

    return (
      <div className="relative w-full flex" ref={modelSelectorRef}>
        <button
          onClick={optimisticSelectedModelId ? toggle : undefined}
          disabled={!optimisticSelectedModelId}
          className={twMerge(
            'focus:outline-none transition-colors duration-200 text-xs',
            optimisticSelectedModelId ? 'hover:text-text-tertiary' : 'text-text-muted cursor-not-allowed',
            className,
          )}
        >
          {selectedProviderName && selectedModel ? (
            <div className="flex items-end">
              <div className="flex flex-col items-start flex-1 min-w-0 gap-0.5">
                <div className="text-2xs text-text-muted leading-none">{selectedProviderName}</div>
                <div className="flex items-center gap-1">
                  <div className="text-2xs font-medium truncate leading-tight">{selectedModel}</div>
                  <MdKeyboardArrowUp className="w-3 h-3 ml-1 flex-shrink-0 transform rotate-180" />
                </div>
              </div>
            </div>
          ) : (
            <span>{t('common.loading')}</span>
          )}
        </button>
        {isOpen && (
          <div
            className={twMerge(
              'absolute left-0 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-50 flex flex-col w-[500px] max-w-[calc(100vw-20px)]',
              popupPlacement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
            )}
          >
            <div className="sticky top-0 p-2 border-b border-border-default-dark bg-bg-primary-light rounded-md z-10 flex items-center space-x-2">
              <input
                type="text"
                autoFocus={true}
                placeholder={t('modelSelector.searchPlaceholder')}
                className="flex-grow px-2 py-1 text-xs bg-bg-secondary-light text-text-primary rounded border border-border-default focus:outline-none focus:border-border-accent"
                value={state.modelSearchTerm}
                onChange={(e) => updateState({ modelSearchTerm: e.target.value })}
                onKeyDown={onModelSelectorSearchInputKeyDown}
              />
              {showCustomModelHint && (
                <div className="flex items-center text-text-muted-light" title="Press Enter to use this custom model name">
                  <MdKeyboardReturn className="w-4 h-4" />
                </div>
              )}
            </div>
            <div className="overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth max-h-48">
              {preferredModels.length > 0 && (
                <>
                  {preferredModels.map((model, index) => renderModelItem(model, index, true))}
                  <div key="divider" className="border-t border-border-default-dark my-1" />
                </>
              )}
              {groupedFilteredModels.map((group) => (
                <div key={group.providerId}>
                  <div className="sticky top-0 bg-bg-secondary border-b border-border-default-dark px-3 py-1 text-xs font-semibold text-text-primary z-10">
                    {getProviderName(group.providerId)}
                  </div>
                  {group.models.map((model, index) => renderModelItem(model, index, false))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  },
);

ModelSelector.displayName = 'ModelSelector';

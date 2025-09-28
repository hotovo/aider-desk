import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, KeyboardEvent, MouseEvent, useOptimistic, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdKeyboardArrowUp, MdKeyboardReturn } from 'react-icons/md';
import { useDebounce } from '@reactuses/core';
import { twMerge } from 'tailwind-merge';
import { Model, ProviderProfile } from '@common/types';
import { getProviderModelId } from '@common/agent';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';

export type ModelSelectorRef = {
  open: (model?: string) => void;
};

type Props = {
  className?: string;
  models: Model[];
  selectedModelId?: string;
  onChange: (model: Model) => void;
  preferredModelIds: string[];
  removePreferredModel: (modelId: string) => void;
  providers: ProviderProfile[];
};

export const ModelSelector = forwardRef<ModelSelectorRef, Props>(
  ({ className, models, selectedModelId, onChange, preferredModelIds, removePreferredModel, providers }, ref) => {
    const { t } = useTranslation();
    const [modelSearchTerm, setModelSearchTerm] = useState('');
    const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);
    const [visible, show, hide] = useBooleanState(false);
    const modelSelectorRef = useRef<HTMLDivElement>(null);
    const highlightedModelRef = useRef<HTMLDivElement>(null);
    const debouncedSearchTerm = useDebounce(modelSearchTerm, 300);
    const [optimisticSelectedModelId, setOptimisticSelectedModel] = useOptimistic(selectedModelId);

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
      return modelId.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) && !model.isHidden;
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

    const showCustomModelHint = filteredModels.length === 0 && modelSearchTerm.trim() !== '';

    const getProviderName = (providerId: string) => {
      const provider = providers.find((p) => p.id === providerId);
      return provider?.name || t(`providers.${providerId}`);
    };

    useClickOutside(modelSelectorRef, hide);

    useEffect(() => {
      if (!visible) {
        setHighlightedModelIndex(-1);
        setModelSearchTerm('');
      }
    }, [visible]);

    useImperativeHandle(ref, () => ({
      open: (model) => {
        setModelSearchTerm(model || '');
        show();
      },
    }));

    const toggleVisible = useCallback(() => {
      if (visible) {
        hide();
      } else {
        show();
      }
    }, [visible, hide, show]);

    const onModelSelected = (model: Model) => {
      startTransition(async () => {
        const modelId = getProviderModelId(model);
        setOptimisticSelectedModel(modelId);
        hide();
        onChange(model);
      });
    };

    const onModelSelectorSearchInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      const allModels = [...preferredModels, ...groupedFilteredModels.flatMap((group) => group.models)];

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedModelIndex((prev) => {
            const newIndex = Math.min(prev + 1, allModels.length - 1);
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
            const selected = allModels[highlightedModelIndex];
            onModelSelected(selected);
          }
          break;
        case 'Escape':
          e.preventDefault();
          hide();
          break;
      }
    };

    const renderModelItem = (model: Model, index: number, isPreferred: boolean) => {
      const fullModelId = getProviderModelId(model);
      const displayModelId = isPreferred ? fullModelId : model.id;
      index = index + (isPreferred ? 0 : preferredModels.length);

      const handleRemovePreferredModel = (e: MouseEvent) => {
        e.stopPropagation();
        removePreferredModel(fullModelId);
      };

      return (
        <div
          key={fullModelId}
          ref={index === highlightedModelIndex ? highlightedModelRef : undefined}
          className={`flex items-center w-full hover:bg-bg-tertiary transition-colors duration-200 ${index === highlightedModelIndex ? 'bg-bg-tertiary' : 'text-text-tertiary'}`}
        >
          <button
            onClick={() => onModelSelected(model)}
            className={`flex-grow px-3 py-1 text-left text-xs
                        ${fullModelId === optimisticSelectedModelId ? 'text-text-primary font-bold' : ''}`}
          >
            {displayModelId}
          </button>
          {isPreferred && (
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
      <div className="relative w-full" ref={modelSelectorRef}>
        <button
          onClick={optimisticSelectedModelId ? toggleVisible : undefined}
          disabled={!optimisticSelectedModelId}
          className={twMerge(
            'flex items-center focus:outline-none transition-colors duration-200 text-xs',
            optimisticSelectedModelId ? 'hover:text-text-tertiary' : 'text-text-muted cursor-not-allowed',
            className,
          )}
        >
          <span>{optimisticSelectedModelId || t('common.loading')}</span>
          <MdKeyboardArrowUp className={`w-3 h-3 ml-1 transform rotate-180 ${!optimisticSelectedModelId ? 'text-text-muted' : ''}`} />
        </button>
        {visible && (
          <div className="absolute top-full left-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-10 flex flex-col w-[500px]">
            <div className="sticky top-0 p-2 border-b border-border-default-dark bg-bg-primary-light rounded-md z-10 flex items-center space-x-2">
              <input
                type="text"
                autoFocus={true}
                placeholder={t('modelSelector.searchPlaceholder')}
                className="flex-grow px-2 py-1 text-xs bg-bg-secondary-light text-text-primary rounded border border-border-default focus:outline-none focus:border-border-accent"
                value={modelSearchTerm}
                onChange={(e) => setModelSearchTerm(e.target.value)}
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

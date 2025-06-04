import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, KeyboardEvent, MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { MdClose, MdKeyboardArrowUp, MdKeyboardReturn } from 'react-icons/md';
import { useDebounce } from 'react-use';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useBooleanState } from '@/hooks/useBooleanState';

export type ModelSelectorRef = {
  open: (model?: string) => void;
};

type Props = {
  models: string[];
  selectedModel?: string;
  onChange: (model: string) => void;
  preferredModels: string[];
  removePreferredModel: (model: string) => void;
};

export const ModelSelector = forwardRef<ModelSelectorRef, Props>(({ models, selectedModel, onChange, preferredModels, removePreferredModel }, ref) => {
  const { t } = useTranslation();
  const [modelSearchTerm, setModelSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [highlightedModelIndex, setHighlightedModelIndex] = useState(-1);
  const [visible, show, hide] = useBooleanState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);
  const highlightedModelRef = useRef<HTMLDivElement>(null);

  useDebounce(
    () => {
      setDebouncedSearchTerm(modelSearchTerm);
    },
    300,
    [modelSearchTerm],
  );

  useClickOutside(modelSelectorRef, hide);

  useEffect(() => {
    if (!visible) {
      setHighlightedModelIndex(-1);
      setModelSearchTerm('');
    }
  }, [visible]);

  useImperativeHandle(ref, () => ({
    open: (model) => {
      console.log('Opening model selector with model:', model);
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

  const onModelSelected = (model: string) => {
    onChange(model);
    hide();
  };

  const onModelSelectorSearchInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const visiblePreferredModels = debouncedSearchTerm ? [] : preferredModels;
    const sortedModels = [...visiblePreferredModels, ...models.filter((model) => !visiblePreferredModels.includes(model))];
    const filteredModels = sortedModels.filter((model) => model.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedModelIndex((prev) => {
          const newIndex = Math.min(prev + 1, filteredModels.length - 1);
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
          const selected = filteredModels[highlightedModelIndex];
          onModelSelected(selected);
        } else if (highlightedModelIndex === -1 && modelSearchTerm.trim()) {
          // If no model is highlighted and there's a search term, select the custom term
          e.preventDefault();
          onModelSelected(modelSearchTerm.trim());
        }
        break;
      case 'Escape':
        e.preventDefault();
        hide();
        break;
    }
  };

  const filteredModels = models.filter((model) => model.toLowerCase().includes(debouncedSearchTerm.toLowerCase()));
  const showCustomModelHint = filteredModels.length === 0 && modelSearchTerm.trim() !== '';

  const renderModelItem = (model: string, index: number) => {
    const isPreferred = preferredModels.includes(model);
    index = index + (isPreferred || debouncedSearchTerm ? 0 : preferredModels.length);

    const handleRemovePreferredModel = (e: MouseEvent) => {
      e.stopPropagation();
      removePreferredModel(model);
    };

    return (
      <div
        key={model}
        ref={index === highlightedModelIndex ? highlightedModelRef : undefined}
        className={`flex items-center w-full hover:bg-neutral-700 transition-colors duration-200 ${index === highlightedModelIndex ? 'bg-neutral-700' : 'text-neutral-300'}`}
      >
        <button
          onClick={() => onModelSelected(model)}
          className={`flex-grow px-3 py-1 text-left text-xs
                        ${model === selectedModel ? 'text-white font-bold' : ''}`}
        >
          {model}
        </button>
        {isPreferred && (
          <button
            onClick={handleRemovePreferredModel}
            className="px-2 py-1 text-neutral-500 hover:text-neutral-400 transition-colors duration-200"
            title={t('modelSelector.removePreferred')}
          >
            <MdClose className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={modelSelectorRef}>
      <button onClick={toggleVisible} className="flex items-center hover:text-neutral-300 focus:outline-none transition-colors duration-200 text-xs">
        <span>{selectedModel || t('common.loading')}</span>
        <MdKeyboardArrowUp className="w-3 h-3 ml-1 transform rotate-180" />
      </button>
      {visible && (
        <div className="absolute top-full left-0 mt-1 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 flex flex-col w-[600px]">
          <div className="sticky top-0 p-2 border-b border-neutral-700 bg-neutral-900 rounded-md z-10 flex items-center space-x-2">
            <input
              type="text"
              autoFocus={true}
              placeholder={t('modelSelector.searchPlaceholder')}
              className="flex-grow px-2 py-1 text-xs bg-neutral-800 text-white rounded border border-neutral-600 focus:outline-none focus:border-neutral-500"
              value={modelSearchTerm}
              onChange={(e) => setModelSearchTerm(e.target.value)}
              onKeyDown={onModelSelectorSearchInputKeyDown}
            />
            {showCustomModelHint && (
              <div className="flex items-center text-neutral-400" title="Press Enter to use this custom model name">
                <MdKeyboardReturn className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="overflow-y-auto scrollbar-thin scrollbar-track-neutral-800 scrollbar-thumb-neutral-700 hover:scrollbar-thumb-neutral-600 max-h-48">
            {!debouncedSearchTerm && (
              <>
                {preferredModels.map(renderModelItem)}
                <div key="divider" className="border-t border-neutral-700 my-1" />
              </>
            )}
            {filteredModels.map(renderModelItem)}
          </div>
        </div>
      )}
    </div>
  );
});

ModelSelector.displayName = 'ModelSelector';

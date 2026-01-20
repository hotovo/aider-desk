import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MdKeyboardArrowUp } from 'react-icons/md';
import { EditFormat } from '@common/types';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useDropdownState } from '@/hooks/useDropdownState';

export type EditFormatSelectorRef = {
  open: () => void;
};

// Define available edit formats based on the EditFormat type
const editFormatOptions: EditFormat[] = ['diff', 'diff-fenced', 'whole', 'udiff', 'udiff-simple', 'patch'];

type Props = {
  currentFormat: EditFormat;
  onFormatChange: (format: EditFormat) => void;
};

export const EditFormatSelector = forwardRef<EditFormatSelectorRef, Props>(({ currentFormat, onFormatChange }, ref) => {
  const { t } = useTranslation();
  const selectorRef = useRef<HTMLDivElement>(null);
  const highlightedItemRef = useRef<HTMLDivElement>(null);

  const { isOpen, state, open, close, toggle } = useDropdownState({
    initialState: { highlightedIndex: -1 },
    onCloseReset: { highlightedIndex: -1 },
  });

  useClickOutside(selectorRef, close);

  useImperativeHandle(ref, () => ({
    open: () => open(),
  }));

  const handleFormatSelected = (format: EditFormat) => {
    onFormatChange(format);
    close();
  };

  const renderFormatItem = (format: EditFormat, index: number) => (
    <div
      key={format}
      ref={index === state.highlightedIndex ? highlightedItemRef : undefined}
      className={`flex items-center w-full hover:bg-bg-tertiary transition-colors duration-200 ${index === state.highlightedIndex ? 'bg-bg-tertiary' : 'text-text-tertiary'}`}
    >
      <button
        onClick={() => handleFormatSelected(format)}
        className={`flex-grow px-3 py-1 text-left text-xs ${format === currentFormat ? 'text-text-primary font-bold' : ''}`}
      >
        {format}
      </button>
    </div>
  );

  return (
    <div className="relative" ref={selectorRef}>
      <button onClick={toggle} className="flex items-center hover:text-text-tertiary focus:outline-none transition-colors duration-200 text-xs">
        <span>{currentFormat || t('common.loading')}</span>
        <MdKeyboardArrowUp className="w-3 h-3 ml-1 transform rotate-180" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded-md shadow-lg z-50 flex flex-col w-60 max-w-[calc(100vw-20px)]">
          <div className="overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-bg-tertiary hover:scrollbar-thumb-bg-fourth max-h-48">
            {editFormatOptions.map(renderFormatItem)}
          </div>
        </div>
      )}
    </div>
  );
});

EditFormatSelector.displayName = 'EditFormatSelector';

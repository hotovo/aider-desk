import { useState, useRef, useLayoutEffect, useEffect, ReactNode, ClipboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

import { KeyboardKeys } from '@/constants/keyboardKeys';

type Props = {
  value: string;
  suggestions: string[];
  onChange: (value: string, isFromSuggestion: boolean, isMultiSelect?: boolean) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  rightElement?: ReactNode;
  autoFocus?: boolean;
  onPaste?: (pastedText: string) => Promise<boolean>;
  onSubmit?: (isMultiSelect?: boolean) => void;
};

export const AutocompletionInput = ({
  value,
  suggestions,
  onChange,
  placeholder,
  className,
  inputClassName,
  rightElement,
  autoFocus,
  onPaste,
  onSubmit,
}: Props) => {
  const { t } = useTranslation();
  const [internalShowSuggestions, setInternalShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestionsPosition, setSuggestionsPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInternalShowSuggestions(suggestions.length > 0);
    setSelectedIndex(-1);
  }, [suggestions]);

  const showSuggestions = internalShowSuggestions && suggestions.length > 0;

  useLayoutEffect(() => {
    if (showSuggestions && inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      setSuggestionsPosition({
        top: inputRect.bottom + window.scrollY,
        left: inputRect.left + window.scrollX,
        width: inputRect.width,
      });
    } else {
      setSuggestionsPosition(null);
    }
  }, [showSuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === KeyboardKeys.Enter && onSubmit) {
        e.preventDefault();
        onSubmit();
      } else if (e.key === KeyboardKeys.Tab) {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case KeyboardKeys.ArrowDown:
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = Math.min(prev + 1, suggestions.length - 1);
          const suggestionElement = document.getElementById(`suggestion-${newIndex}`);
          suggestionElement?.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
        break;
      case KeyboardKeys.ArrowUp:
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = Math.max(prev - 1, 0);
          if (newIndex >= 0) {
            const suggestionElement = document.getElementById(`suggestion-${newIndex}`);
            suggestionElement?.scrollIntoView({ block: 'nearest' });
          }
          return newIndex;
        });
        break;
      case KeyboardKeys.Enter:
        if (selectedIndex >= 0) {
          e.preventDefault();
          const isMultiSelect = e.ctrlKey || e.metaKey;
          onChange(suggestions[selectedIndex], true, isMultiSelect);
          if (!isMultiSelect) {
            setInternalShowSuggestions(false);
          }
          if (onSubmit) {
            onSubmit(isMultiSelect);
          }
        } else if (onSubmit) {
          e.preventDefault();
          onSubmit(e.ctrlKey || e.metaKey);
        }
        break;
      case KeyboardKeys.Tab:
        if (suggestions.length > 0 || selectedIndex >= 0) {
          e.preventDefault();
          onChange(suggestions[selectedIndex >= 0 ? selectedIndex : 0], true);
          setInternalShowSuggestions(false);
        }
        break;
      case KeyboardKeys.Escape:
        e.preventDefault();
        e.stopPropagation();
        setInternalShowSuggestions(false);
        break;
    }
  };

  const handleOnPaste = async (e: ClipboardEvent<HTMLInputElement>) => {
    // Prevent default immediately to stop browser from processing the paste
    e.preventDefault();

    const pastedText = e.clipboardData.getData('text');
    const pasted = onPaste ? await onPaste(pastedText) : false;

    // If onPaste didn't handle the paste (returned false), manually insert the text
    if (!pasted && pastedText) {
      const input = e.target as HTMLInputElement;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newValue = value.substring(0, start) + pastedText + value.substring(end);
      onChange(newValue, false);
    }
  };

  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0 || !suggestionsPosition) {
      return null;
    }

    const style = {
      position: 'absolute' as const,
      top: `${suggestionsPosition.top}px`,
      left: `${suggestionsPosition.left}px`,
      width: `${suggestionsPosition.width}px`,
      zIndex: 1000,
    };

    return createPortal(
      <div
        className="w-full mt-1 p-0.5 bg-bg-secondary-light border border-border-default-dark rounded-lg shadow-lg max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth scrollbar-thumb-rounded-full"
        style={style}
      >
        {suggestions.map((suggestion, index) => (
          <div
            id={`suggestion-${index}`}
            key={suggestion}
            className={clsx('px-3 py-1 text-sm cursor-pointer hover:bg-bg-tertiary', index === selectedIndex && 'bg-bg-secondary hover:bg-bg-secondary')}
            onMouseDown={(e) => {
              const isMultiSelect = e.ctrlKey || e.metaKey;
              if (isMultiSelect) {
                e.preventDefault();
              }
              onChange(suggestion, true, isMultiSelect);
              if (!isMultiSelect) {
                setInternalShowSuggestions(false);
              }
              if (onSubmit) {
                onSubmit(isMultiSelect);
              }
            }}
          >
            {suggestion}
          </div>
        ))}
      </div>,
      document.body,
    );
  };

  return (
    <div className={clsx('relative flex items-center', className)}>
      <input
        ref={inputRef}
        className={clsx(
          'w-full p-3 rounded-lg bg-bg-primary-light-strong border border-bg-tertiary-strong text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-border-default focus:ring-1 focus:ring-border-default transition-colors',
          inputClassName,
        )}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value, false)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setInternalShowSuggestions(false), 200)}
        placeholder={placeholder ? t(placeholder) : undefined}
        autoFocus={autoFocus}
        onPaste={handleOnPaste}
      />
      {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      {renderSuggestions()}
    </div>
  );
};

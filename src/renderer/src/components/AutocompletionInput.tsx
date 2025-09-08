import { useState, useRef, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';

type Props = {
  value: string;
  suggestions: string[];
  onChange: (value: string, isFromSuggestion: boolean) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  rightElement?: ReactNode;
  autoFocus?: boolean;
  onPaste?: (pastedText: string) => void;
  onSubmit?: () => void;
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShowSuggestions(suggestions.length > 0);
    setSelectedIndex(-1);
  }, [suggestions]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit();
      } else if (e.key === 'Tab') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => {
          const newIndex = Math.min(prev + 1, suggestions.length - 1);
          const suggestionElement = document.getElementById(`suggestion-${newIndex}`);
          suggestionElement?.scrollIntoView({ block: 'nearest' });
          return newIndex;
        });
        break;
      case 'ArrowUp':
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
      case 'Enter':
        if (selectedIndex >= 0) {
          e.preventDefault();
          onChange(suggestions[selectedIndex], true);
          setShowSuggestions(false);
        } else if (onSubmit) {
          e.preventDefault();
          onSubmit();
        }
        break;
      case 'Tab':
        if (suggestions.length > 0 || selectedIndex >= 0) {
          e.preventDefault();
          onChange(suggestions[selectedIndex >= 0 ? selectedIndex : 0], true);
          setShowSuggestions(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setShowSuggestions(false);
        break;
    }
  };

  const renderSuggestions = () => {
    if (!showSuggestions || suggestions.length === 0) {
      return null;
    }

    const inputRect = inputRef.current?.getBoundingClientRect();
    if (!inputRect) {
      return null;
    }

    const style = {
      position: 'absolute' as const,
      top: `${inputRect.bottom + window.scrollY}px`,
      left: `${inputRect.left + window.scrollX}px`,
      width: `${inputRect.width}px`,
      zIndex: 1000, // Ensure it's above other elements
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
            onMouseDown={() => {
              onChange(suggestion, true);
              setShowSuggestions(false);
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
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder ? t(placeholder) : undefined}
        autoFocus={autoFocus}
        onPaste={(e) => {
          const pastedText = e.clipboardData.getData('text');
          if (onPaste) {
            e.preventDefault();
            onPaste(pastedText);
          }
        }}
      />
      {rightElement && <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</div>}
      {renderSuggestions()}
    </div>
  );
};

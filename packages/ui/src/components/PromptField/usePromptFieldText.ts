import { useEffect, useState } from 'react';
import { useDebounceFn } from '@reactuses/core';

import { useIndexedDB } from '@/hooks/useIndexedDB';

const DEFAULT_TEXT = '';
const TTL_DAYS = 30;
const DEBOUNCE_DELAY = 300;

export const usePromptFieldText = (baseDir: string, taskId: string, onLoad?: (value: string) => void) => {
  const key = `prompt-field-text-${baseDir}-${taskId}`;

  const [persistedText, setPersistedText, isLoading] = useIndexedDB<string>('prompt-field-texts', key, DEFAULT_TEXT, {
    ttlDays: TTL_DAYS,
    onLoad,
  });
  const { run } = useDebounceFn((text: string) => {
    void setPersistedText(text);
  }, DEBOUNCE_DELAY);

  const [immediateText, setImmediateText] = useState(persistedText);

  // Sync immediate text with persisted text when it loads
  useEffect(() => {
    setImmediateText(persistedText);
  }, [persistedText]);

  const setText = (newText: string) => {
    setImmediateText(newText);
    run(newText);
  };

  return {
    text: immediateText,
    setText,
    isLoading,
  };
};

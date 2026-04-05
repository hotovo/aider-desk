import { useCallback } from 'react';

import { useIndexedDB } from '@/hooks/useIndexedDB';

const DEFAULT_TEXT = '';
const TTL_DAYS = 30;

export const usePromptFieldText = (baseDir: string, taskId: string, onLoad?: (value: string) => void) => {
  const key = `prompt-field-text-${baseDir}-${taskId}`;

  const [, setPersistedText, isLoading] = useIndexedDB<string>('prompt-field-texts', key, DEFAULT_TEXT, {
    ttlDays: TTL_DAYS,
    onLoad,
  });

  const setText = useCallback(
    (newText: string) => {
      void setPersistedText(newText);
    },
    [setPersistedText],
  );

  return {
    setText,
    isLoading,
  };
};

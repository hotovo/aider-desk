import { useState, useEffect, useCallback, useRef } from 'react';

import { uiPreferencesDB } from '@/utils/indexedDB';

interface UseIndexedDBOptions<T> {
  ttlDays?: number;
  onLoad?: (value: T) => void;
  onExpired?: () => void;
  onError?: (error: Error) => void;
}

export const useIndexedDB = <T>(
  storeName: string,
  key: string,
  defaultValue: T,
  options: UseIndexedDBOptions<T> = {},
): [T, (value: T) => Promise<void>, boolean] => {
  const { ttlDays = 30, onLoad, onExpired, onError } = options;
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const isInitialized = useRef(false);

  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

  const loadValue = useCallback(async () => {
    try {
      setIsLoading(true);

      // Clear expired entries first
      await uiPreferencesDB.clearExpired(storeName, ttlMs);

      // Load the specific value
      const storedValue = await uiPreferencesDB.get<T>(storeName, key);

      if (storedValue !== null) {
        setValue(storedValue);
        if (onLoad) {
          onLoad(storedValue);
        }
      } else {
        setValue(defaultValue);
        if (onExpired) {
          onExpired();
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Failed to load value from IndexedDB for key ${key}:`, error);
      setValue(defaultValue);
      if (onError) {
        onError(error as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [storeName, ttlMs, key, onLoad, defaultValue, onExpired, onError]);

  const saveValue = useCallback(
    async (newValue: T) => {
      try {
        await uiPreferencesDB.set(storeName, key, newValue);
        setValue(newValue);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Failed to save value to IndexedDB for key ${key}:`, error);
        if (onError) {
          onError(error as Error);
        }
        throw error;
      }
    },
    [storeName, key, onError],
  );

  // Initialize on mount
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      void loadValue();
    }
  }, [loadValue]);

  return [value, saveValue, isLoading];
};

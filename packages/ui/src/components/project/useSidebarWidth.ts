import { useEffect, useState } from 'react';
import { useDebounceFn } from '@reactuses/core';

import { useIndexedDB } from '@/hooks/useIndexedDB';

const DEFAULT_SIDEBAR_WIDTH = 300;
const TTL_DAYS = 30;
const DEBOUNCE_DELAY = 300;

export const useSidebarWidth = (projectBaseDir: string, taskId: string) => {
  const key = `sidebar-width-${projectBaseDir}-${taskId}`;

  const [persistedWidth, setPersistedWidth, isLoading] = useIndexedDB('sidebar-widths', key, DEFAULT_SIDEBAR_WIDTH, {
    ttlDays: TTL_DAYS,
  });
  const { run } = useDebounceFn((width: number) => {
    void setPersistedWidth(width);
  }, DEBOUNCE_DELAY);

  const [immediateWidth, setImmediateWidth] = useState(persistedWidth);

  // Sync immediate width with persisted width when it loads
  useEffect(() => {
    setImmediateWidth(persistedWidth);
  }, [persistedWidth]);

  const setWidth = (newWidth: number) => {
    setImmediateWidth(newWidth);
    run(newWidth);
  };

  return {
    width: immediateWidth,
    setWidth,
    isLoading,
    defaultWidth: DEFAULT_SIDEBAR_WIDTH,
  };
};

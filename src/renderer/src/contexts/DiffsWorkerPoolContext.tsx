import { type ReactNode, useEffect, useMemo } from 'react';
import { WorkerPoolContextProvider, useWorkerPool } from '@pierre/diffs/react';
import { isCodeEditorDarkTheme } from '@common/types';
import Worker from '@pierre/diffs/worker/worker.js?worker';

import type { Theme } from '@common/types';

import { useSettingsStore } from '@/stores/settingsStore';

const workerFactory = () => new Worker();

const getDiffsTheme = (theme: Theme | null) => (!theme || isCodeEditorDarkTheme(theme) ? 'github-dark-default' : 'github-light-default');

const DiffsThemeSync = () => {
  const theme = useSettingsStore((state) => state.theme);
  const pool = useWorkerPool();

  useEffect(() => {
    if (pool) {
      pool.setRenderOptions({ theme: getDiffsTheme(theme) }).catch(() => {});
    }
  }, [theme, pool]);

  return null;
};

export const DiffsWorkerPoolProvider = ({ children }: { children: ReactNode }) => {
  const theme = useSettingsStore((state) => state.theme);

  const highlighterOptions = useMemo(
    () => ({
      theme: getDiffsTheme(theme),
      lineDiffType: 'word' as const,
    }),
    [theme],
  );

  return (
    <WorkerPoolContextProvider poolOptions={{ workerFactory }} highlighterOptions={highlighterOptions}>
      <DiffsThemeSync />
      {children}
    </WorkerPoolContextProvider>
  );
};

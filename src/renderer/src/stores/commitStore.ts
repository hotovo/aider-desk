import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';
import { devtools } from 'zustand/middleware';

const DEVTOOLS_OPTIONS = {
  name: 'CommitStore',
  enabled: import.meta.env.DEV,
  serialize: {
    options: {
      map: true,
      set: true,
    },
  },
};

interface CommitStore {
  committingMap: Map<string, boolean>;

  setCommitting: (baseDir: string, taskId: string, isCommitting: boolean) => void;
}

const getCommitKey = (baseDir: string, taskId: string) => `${baseDir}::${taskId}`;

export const useCommitStore = createWithEqualityFn<CommitStore>()(
  devtools(
    (set) => ({
      committingMap: new Map(),

      setCommitting: (baseDir, taskId, isCommitting) =>
        set((state) => {
          const newMap = new Map(state.committingMap);
          const key = getCommitKey(baseDir, taskId);
          if (isCommitting) {
            newMap.set(key, true);
          } else {
            newMap.delete(key);
          }
          return { committingMap: newMap };
        }),
    }),
    DEVTOOLS_OPTIONS,
  ),
  shallow,
);

export const useIsCommitting = (baseDir: string, taskId: string) => useCommitStore((state) => state.committingMap.get(getCommitKey(baseDir, taskId)) ?? false);

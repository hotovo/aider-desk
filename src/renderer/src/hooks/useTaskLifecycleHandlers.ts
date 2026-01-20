import { useCallback, useEffect } from 'react';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/vanilla/shallow';

import type { ClearTaskData } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

export const useTaskLifecycleHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();
  const clearSession = useStoreWithEqualityFn(useTaskStore, (storeState) => storeState.clearSession, shallow);

  const handleClearProject = useCallback(
    ({ clearMessages: messages, clearSession: session }: ClearTaskData) => {
      if (session) {
        clearSession(taskId, false);
      } else if (messages) {
        clearSession(taskId, true);
      }
    },
    [taskId, clearSession],
  );

  useEffect(() => {
    const removeClearProject = api.addClearTaskListener(baseDir, taskId, handleClearProject);

    return () => {
      removeClearProject();
    };
  }, [api, baseDir, taskId, handleClearProject]);
};

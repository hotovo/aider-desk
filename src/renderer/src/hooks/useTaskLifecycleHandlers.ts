import { useCallback, useEffect } from 'react';

import type { ClearTaskData } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { clearSession, setMessages } from '@/stores/taskStore';

export const useTaskLifecycleHandlers = (baseDir: string, taskId: string) => {
  const api = useApi();

  const handleClearProject = useCallback(
    ({ clearMessages: messages, clearSession: session }: ClearTaskData) => {
      if (messages) {
        setMessages(taskId, () => []);
      }
      if (session) {
        clearSession(taskId);
      }
    },
    [taskId],
  );

  useEffect(() => {
    const removeClearProject = api.addClearTaskListener(baseDir, taskId, handleClearProject);

    return () => {
      removeClearProject();
    };
  }, [api, baseDir, taskId, handleClearProject]);
};

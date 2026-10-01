import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskGitStatus } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

type UseTaskGitStatus = {
  taskGitStatus: TaskGitStatus | null;
  refreshStatus: () => void;
};

export const useTaskGitStatus = (projectDir: string, taskId: string): UseTaskGitStatus => {
  const api = useApi();
  const [taskGitStatus, setTaskGitStatus] = useState<TaskGitStatus | null>(null);
  const currentLoadId = useRef(0);

  const loadStatus = useCallback(
    async (loadId: number) => {
      try {
        const status = await api.getTaskGitStatus(projectDir, taskId);
        if (loadId === currentLoadId.current) {
          setTaskGitStatus(status);
        }
      } catch {
        if (loadId === currentLoadId.current) {
          setTaskGitStatus(null);
        }
      }
    },
    [api, projectDir, taskId],
  );

  const refreshStatus = useCallback(() => {
    currentLoadId.current += 1;
    void loadStatus(currentLoadId.current);
  }, [loadStatus]);

  useEffect(() => {
    currentLoadId.current += 1;
    void loadStatus(currentLoadId.current);

    const unsubscribe = api.addTaskGitStatusUpdatedListener(projectDir, taskId, ({ status }) => {
      setTaskGitStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, [api, loadStatus, projectDir, taskId]);

  return { taskGitStatus, refreshStatus };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { WorktreeIntegrationStatus } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

type UseWorktreeIntegrationStatus = {
  worktreeStatus: WorktreeIntegrationStatus | null;
  refreshStatus: () => void;
};

export const useWorktreeIntegrationStatus = (projectDir: string, taskId: string, isWorktree: boolean): UseWorktreeIntegrationStatus => {
  const api = useApi();
  const [worktreeStatus, setWorktreeStatus] = useState<WorktreeIntegrationStatus | null>(null);
  const currentLoadId = useRef(0);

  const loadStatus = useCallback(
    async (loadId: number) => {
      try {
        const status = await api.getWorktreeIntegrationStatus(projectDir, taskId);
        if (loadId === currentLoadId.current) {
          setWorktreeStatus(status);
        }
      } catch {
        if (loadId === currentLoadId.current) {
          setWorktreeStatus(null);
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
    if (!isWorktree) {
      return;
    }

    currentLoadId.current += 1;
    void loadStatus(currentLoadId.current);

    const unsubscribe = api.addWorktreeIntegrationStatusUpdatedListener(projectDir, taskId, ({ status }) => {
      setWorktreeStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, [api, isWorktree, loadStatus, projectDir, taskId]);

  return { worktreeStatus, refreshStatus };
};

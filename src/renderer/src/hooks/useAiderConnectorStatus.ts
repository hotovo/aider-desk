import { useEffect, useMemo, useState } from 'react';
import { AiderConnectorStatus } from '@common/types';

import { useApi } from '@/contexts/ApiContext';

/**
 * Hook to track Aider connector status.
 *
 * Covers both Python dependencies installation (global) and per-task connector
 * lifecycle (starting-connector → ready). Pass baseDir/taskId to receive
 * task-scoped connector events.
 *
 * Status merge strategy: Python installation progress always takes priority
 * over connector startup, so users never lose visibility into install progress.
 */
export const useAiderConnectorStatus = (baseDir?: string, taskId?: string) => {
  const api = useApi();
  const [pythonStatus, setPythonStatus] = useState<AiderConnectorStatus>({ state: 'idle' });
  const [connectorStatus, setConnectorStatus] = useState<AiderConnectorStatus>({ state: 'idle' });

  // Fetch initial Python status
  useEffect(() => {
    api
      .getAiderConnectorStatus()
      .then(setPythonStatus)
      .catch(() => {
        // If IPC not available yet, stay idle
      });
  }, [api]);

  // Listen for status changes — route to the correct state slot
  useEffect(() => {
    const unsubscribe = api.addAiderConnectorStatusListener(
      (data) => {
        if (data.baseDir && data.taskId) {
          setConnectorStatus(data.status);
        } else {
          setPythonStatus(data.status);
        }
      },
      baseDir,
      taskId,
    );

    return unsubscribe;
  }, [api, baseDir, taskId]);

  // Merge: Python install progress takes priority over connector startup
  const status = useMemo((): AiderConnectorStatus => {
    if (pythonStatus.state !== 'idle' && pythonStatus.state !== 'ready') {
      return pythonStatus;
    }
    return connectorStatus;
  }, [pythonStatus, connectorStatus]);

  return status;
};

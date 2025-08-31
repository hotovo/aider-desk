import { VersionsInfo } from '@common/types';
import { useCallback, useEffect, useState } from 'react';

import { useApi } from '@/context/ApiContext';

export const useVersions = () => {
  const [versions, setVersions] = useState<VersionsInfo | null>(null);
  const api = useApi();

  const loadVersions = useCallback(
    async (forceRefresh = false) => {
      setVersions(null);

      try {
        setVersions({
          ...(await api.getVersions(forceRefresh)),
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch versions:', error);
        // Optionally set versions to indicate an error or keep them null
        setVersions({ aiderDeskCurrentVersion: 'Error', aiderCurrentVersion: 'Error' });
      }
    },
    [api],
  );

  const checkForUpdates = useCallback(async () => loadVersions(true), [loadVersions]);

  useEffect(() => {
    void loadVersions();

    const removeListener = api.addVersionsInfoUpdatedListener((data) => {
      setVersions(data);
    });

    return () => {
      removeListener();
    };
  }, [loadVersions, api]);

  return { versions, checkForUpdates };
};

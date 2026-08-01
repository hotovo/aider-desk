import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsCommitting, useCommitStore } from '@/stores/commitStore';
import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification, showSuccessNotification } from '@/utils/notifications';

type UseCommitChanges = {
  isCommitting: boolean;
  commit: (message: string, amend: boolean) => Promise<void>;
  cancelCommit: () => void;
};

export const useCommitChanges = (baseDir: string, taskId: string): UseCommitChanges => {
  const { t } = useTranslation();
  const api = useApi();
  const setCommitting = useCommitStore((state) => state.setCommitting);
  const isCommitting = useIsCommitting(baseDir, taskId);

  const commit = useCallback(
    async (message: string, amend: boolean) => {
      setCommitting(baseDir, taskId, true);
      try {
        await api.commitChanges(baseDir, taskId, message, amend);
        showSuccessNotification(t('contextFiles.commitSuccess'));
      } catch (error) {
        showErrorNotification(`${t('contextFiles.commitError')}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      } finally {
        setCommitting(baseDir, taskId, false);
      }
    },
    [t, api, baseDir, taskId, setCommitting],
  );

  const cancelCommit = useCallback(() => {
    api.cancelCommitChanges(baseDir, taskId).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Failed to cancel commit:', error);
    });
  }, [api, baseDir, taskId]);

  return { isCommitting, commit, cancelCommit };
};

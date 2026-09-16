import { useState } from 'react';
import { IoGitBranch } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import { useApi } from '@/contexts/ApiContext';
import { Tooltip } from '@/components/ui/Tooltip';
import { showErrorNotification, showInfoNotification } from '@/utils/notifications';

type Props = {
  baseDir: string;
  taskId: string;
  disabled?: boolean;
  onInitialized: () => void;
};

export const GitInitButton = ({ baseDir, taskId, disabled, onInitialized }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [isInitializing, setIsInitializing] = useState(false);

  const handleInitialize = async () => {
    if (isInitializing) {
      return;
    }

    setIsInitializing(true);
    try {
      await api.initializeGitRepository(baseDir, taskId);
      showInfoNotification(t('git.gitInitialized'));
      onInitialized();
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : String(error));
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <Tooltip content={t('git.initializeGitTooltip')}>
      <button
        onClick={handleInitialize}
        disabled={disabled || isInitializing}
        className="flex items-center gap-1 px-2 py-1 text-text-primary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-2xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <IoGitBranch className="w-3.5 h-3.5 shrink-0" />
        {isInitializing ? t('git.initializingGit') : t('git.initializeGit')}
      </button>
    </Tooltip>
  );
};

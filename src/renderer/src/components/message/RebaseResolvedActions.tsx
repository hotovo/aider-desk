import { TiInfo } from 'react-icons/ti';
import { useTranslation } from 'react-i18next';
import { WorktreeIntegrationStatus } from '@common/types';

import { Button } from '@/components/common/Button';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  projectDir: string;
  taskId: string;
  worktreeStatus: WorktreeIntegrationStatus;
};

export const RebaseResolvedActions = ({ projectDir, taskId, worktreeStatus: _worktreeStatus }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const handleContinueRebase = () => {
    void api.continueWorktreeRebase(projectDir, taskId);
  };

  const handleAbortRebase = () => {
    void api.abortWorktreeRebase(projectDir, taskId);
  };

  return (
    <div className="px-4 py-2 border-t border-border-dark-light">
      <div className="p-3 max-w-full break-words text-xs rounded-md border-border-dark-light relative group bg-warning-subtle border-l-2 border-l-warning">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex items-start gap-2 flex-1">
            <TiInfo className="h-4 w-4 flex-shrink-0 text-warning" />
            <div className="flex-1 flex flex-col gap-1">
              <div className="text-text-primary">{t('worktree.rebaseConflictsResolvedDescription')}</div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 items-end">
            <Button variant="contained" color="primary" size="xs" onClick={handleContinueRebase}>
              {t('worktree.continueRebase')}
            </Button>
            <Button variant="outline" color="danger" size="xs" onClick={handleAbortRebase}>
              {t('worktree.abortRebase')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

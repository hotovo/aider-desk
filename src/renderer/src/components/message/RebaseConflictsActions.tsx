import { TiWarning } from 'react-icons/ti';
import { useTranslation } from 'react-i18next';
import { TaskGitStatus } from '@common/types';

import { Button } from '@/components/common/Button';
import { useApi } from '@/contexts/ApiContext';

type Props = {
  projectDir: string;
  taskId: string;
  status: TaskGitStatus;
};

export const RebaseConflictsActions = ({ projectDir, taskId, status }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const conflictFiles = status.rebaseState.unmergedFiles ?? [];

  const handleContinueRebase = () => {
    void api.continueRebase(projectDir, taskId);
  };

  const handleResolveConflictsWithAgent = () => {
    void api.resolveConflictsWithAgent(projectDir, taskId);
  };

  const handleAbortRebase = () => {
    void api.abortRebase(projectDir, taskId);
  };

  return (
    <div className="px-4 py-2 border-t border-border-dark-light">
      <div className="p-3 max-w-full break-words text-xs rounded-md border-border-dark-light relative group bg-warning-subtle border-l-2 border-l-warning">
        <div className="flex flex-wrap items-start gap-8">
          <div className="flex items-start gap-2 flex-1">
            <TiWarning className="h-4 w-4 flex-shrink-0 text-warning" />
            <div className="flex-1 flex flex-col gap-1">
              <div className="text-text-primary">{t('worktree.rebaseConflictsDescription')}</div>
              <div className="text-2xs text-text-primary p-0.5">
                {conflictFiles.map((file) => (
                  <div key={file}>- {file}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <Button variant="contained" color="primary" size="xs" onClick={handleContinueRebase}>
                {t('worktree.continueRebase')}
              </Button>
              <Button variant="contained" color="primary" size="xs" onClick={handleResolveConflictsWithAgent}>
                {t('worktree.resolveConflictsWithAgent')}
              </Button>
            </div>
            <Button variant="outline" color="danger" size="xs" onClick={handleAbortRebase}>
              {t('worktree.abortRebase')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

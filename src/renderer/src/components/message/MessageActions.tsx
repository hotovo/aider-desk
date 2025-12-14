import { useTranslation } from 'react-i18next';
import { useState } from 'react';

import { Button } from '../common/Button';

type Props = {
  actionIds: string[];
  baseDir: string;
  taskId: string;
};

export const MessageActions = ({ actionIds, baseDir, taskId }: Props) => {
  const { t } = useTranslation();
  const [isExecuted, setIsExecuted] = useState(false);

  if (!actionIds || actionIds.length === 0 || isExecuted) {
    return null;
  }

  const handleAbortRebase = () => {
    setIsExecuted(true);
    window.api.abortWorktreeRebase(baseDir, taskId);
  };

  const handleContinueRebase = () => {
    setIsExecuted(true);
    window.api.continueWorktreeRebase(baseDir, taskId);
  };

  const handleResolveConflictsWithAgent = () => {
    setIsExecuted(true);
    window.api.resolveWorktreeConflictsWithAgent(baseDir, taskId);
  };

  const handleRebaseWorktree = () => {
    setIsExecuted(true);
    window.api.rebaseWorktreeFromBranch(baseDir, taskId);
  };

  const renderAction = (id: string) => {
    switch (id) {
      case 'abort-rebase':
        return (
          <Button key={id} size="xs" variant="outline" color="danger" onClick={handleAbortRebase}>
            {t('worktree.abortRebase')}
          </Button>
        );
      case 'continue-rebase':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleContinueRebase}>
            {t('worktree.continueRebase')}
          </Button>
        );
      case 'resolve-conflicts-with-agent':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleResolveConflictsWithAgent}>
            {t('worktree.resolveConflictsWithAgent')}
          </Button>
        );
      case 'rebase-worktree':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleRebaseWorktree}>
            {t('worktree.rebaseFromBranch')}
          </Button>
        );
      default:
        return null;
    }
  };

  return <div className="flex flex-wrap gap-2 mt-4">{actionIds.map(renderAction)}</div>;
};

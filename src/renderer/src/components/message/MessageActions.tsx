import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { MdUndo } from 'react-icons/md';

import { Button } from '../common/Button';

import { useApi, useIsReadonlyView } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

type Props = {
  actionIds: string[];
  baseDir: string;
  taskId: string;
  onInterrupt?: () => void;
  removeActionId?: (actionId: string) => void;
};

export const MessageActions = ({ actionIds, baseDir, taskId, onInterrupt, removeActionId }: Props) => {
  const { t } = useTranslation();
  const [isExecuted, setIsExecuted] = useState(false);
  const api = useApi();
  const isReadonlyView = useIsReadonlyView();
  const canUndoContextChange = useTaskStore((state) => state.taskStateMap.get(taskId)?.canUndoContextChange ?? false);

  if (isReadonlyView || !actionIds || actionIds.length === 0 || isExecuted) {
    return null;
  }

  const handleAbortRebase = () => {
    setIsExecuted(true);
    removeActionId?.('abort-rebase');
    void api.abortRebase(baseDir, taskId);
  };

  const handleContinueRebase = () => {
    setIsExecuted(true);
    removeActionId?.('continue-rebase');
    void api.continueRebase(baseDir, taskId);
  };

  const handleResolveConflictsWithAgent = () => {
    setIsExecuted(true);
    removeActionId?.('resolve-conflicts-with-agent');
    void api.resolveConflictsWithAgent(baseDir, taskId);
  };

  const handleResolveGitErrorWithAgent = () => {
    setIsExecuted(true);
    removeActionId?.('resolve-git-error-with-agent');
    void api.resolveGitErrorWithAgent(baseDir, taskId);
  };

  const handleRebaseWorktree = () => {
    setIsExecuted(true);
    removeActionId?.('rebase-worktree');
    void api.rebaseWorktreeFromBranch(baseDir, taskId);
  };

  const handleUndoContextChange = () => {
    setIsExecuted(true);
    removeActionId?.('undoContextChange');
    void api.undoContextChange(baseDir, taskId);
  };

  const renderAction = (id: string) => {
    switch (id) {
      case 'interrupt':
        return (
          <Button key={id} size="xs" variant="outline" color="danger" onClick={() => onInterrupt?.()}>
            {t('common.cancel')}
          </Button>
        );
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
      case 'resolve-git-error-with-agent':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleResolveGitErrorWithAgent}>
            {t('git.resolveWithAI')}
          </Button>
        );
      case 'rebase-worktree':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleRebaseWorktree}>
            {t('worktree.rebaseFromBranch')}
          </Button>
        );
      case 'undoContextChange':
        return canUndoContextChange ? (
          <Button key={id} size="xs" variant="text" color="primary" onClick={handleUndoContextChange} tooltip={t('promptField.undoContextChange')}>
            <MdUndo className="w-4 h-4 mr-1" />
            {t('common.undo')}
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  return <div className="flex flex-wrap gap-2">{actionIds.map(renderAction)}</div>;
};

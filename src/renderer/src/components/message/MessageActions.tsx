import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { MdUndo } from 'react-icons/md';
import { LogAction } from '@common/types';

import { Button } from '../common/Button';

import { useApi, useIsReadonlyView } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

type Props = {
  actions: LogAction[];
  baseDir: string;
  taskId: string;
  onInterrupt?: () => void;
  removeActionId?: (actionId: string) => void;
};

export const MessageActions = ({ actions, baseDir, taskId, onInterrupt, removeActionId }: Props) => {
  const { t } = useTranslation();
  const [isExecuted, setIsExecuted] = useState(false);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const api = useApi();
  const isReadonlyView = useIsReadonlyView();
  const canUndoContextChange = useTaskStore((state) => state.taskStateMap.get(taskId)?.canUndoContextChange ?? false);
  const isLoading = useTaskStore((state) => state.taskStateMap.get(taskId)?.loading ?? false);

  if (isReadonlyView || !actions || actions.length === 0 || isExecuted) {
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

  const handleUndoContextChange = async ({ data }: LogAction) => {
    const checkpointId = data && typeof data === 'object' && !Array.isArray(data) && typeof data.checkpointId === 'string' ? data.checkpointId : undefined;
    setRestoreFailed(false);
    setIsExecuted(true);
    try {
      const restored = await api.undoContextChange(baseDir, taskId, checkpointId);
      if (restored) {
        removeActionId?.('undoContextChange');
      } else {
        setRestoreFailed(true);
        setIsExecuted(false);
      }
    } catch {
      setRestoreFailed(true);
      setIsExecuted(false);
    }
  };

  const handlers: Record<string, (action: LogAction) => void> = {
    interrupt: () => onInterrupt?.(),
    'abort-rebase': handleAbortRebase,
    'continue-rebase': handleContinueRebase,
    'resolve-conflicts-with-agent': handleResolveConflictsWithAgent,
    'resolve-git-error-with-agent': handleResolveGitErrorWithAgent,
    'rebase-worktree': handleRebaseWorktree,
    undoContextChange: handleUndoContextChange,
  };

  const renderAction = (action: LogAction) => {
    const { id } = action;
    const handleClick = () => handlers[id]?.(action);
    switch (id) {
      case 'interrupt':
        return (
          <Button key={id} size="xs" variant="outline" color="danger" onClick={handleClick}>
            {t('common.cancel')}
          </Button>
        );
      case 'abort-rebase':
        return (
          <Button key={id} size="xs" variant="outline" color="danger" onClick={handleClick}>
            {t('worktree.abortRebase')}
          </Button>
        );
      case 'continue-rebase':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleClick}>
            {t('worktree.continueRebase')}
          </Button>
        );
      case 'resolve-conflicts-with-agent':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleClick}>
            {t('worktree.resolveConflictsWithAgent')}
          </Button>
        );
      case 'resolve-git-error-with-agent':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleClick}>
            {t('git.resolveWithAI')}
          </Button>
        );
      case 'rebase-worktree':
        return (
          <Button key={id} size="xs" variant="contained" color="primary" onClick={handleClick}>
            {t('worktree.rebaseFromBranch')}
          </Button>
        );
      case 'undoContextChange':
        return canUndoContextChange ||
          (action.data && typeof action.data === 'object' && !Array.isArray(action.data) && typeof action.data.checkpointId === 'string') ? (
          <Button key={id} size="xs" variant="text" color="primary" disabled={isLoading} onClick={handleClick} tooltip={t('promptField.undoContextChange')}>
            <MdUndo className="w-4 h-4 mr-1" />
            {t('common.undo')}
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(renderAction)}
      {restoreFailed && (
        <span role="alert" className="text-text-muted">
          {t('common.restoreContextFailed')}
        </span>
      )}
    </div>
  );
};

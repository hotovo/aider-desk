import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { MdUndo } from 'react-icons/md';

import { Button } from '../common/Button';

import { useApi } from '@/contexts/ApiContext';
import { useTaskStore } from '@/stores/taskStore';

type Props = {
  actionIds: string[];
  baseDir: string;
  taskId: string;
  onInterrupt?: () => void;
};

export const MessageActions = ({ actionIds, baseDir, taskId, onInterrupt }: Props) => {
  const { t } = useTranslation();
  const [isExecuted, setIsExecuted] = useState(false);
  const api = useApi();
  const canUndoContextChange = useTaskStore((state) => state.taskStateMap.get(taskId)?.canUndoContextChange ?? false);

  if (!actionIds || actionIds.length === 0 || isExecuted) {
    return null;
  }

  const handleAbortRebase = () => {
    setIsExecuted(true);
    void api.abortWorktreeRebase(baseDir, taskId);
  };

  const handleContinueRebase = () => {
    setIsExecuted(true);
    void api.continueWorktreeRebase(baseDir, taskId);
  };

  const handleResolveConflictsWithAgent = () => {
    setIsExecuted(true);
    void api.resolveWorktreeConflictsWithAgent(baseDir, taskId);
  };

  const handleRebaseWorktree = () => {
    setIsExecuted(true);
    void api.rebaseWorktreeFromBranch(baseDir, taskId);
  };

  const handleUndoContextChange = () => {
    setIsExecuted(true);
    void api.undoContextChange(baseDir, taskId);
  };

  const renderAction = (id: string) => {
    switch (id) {
      case 'interrupt':
        return (
          <Button key={id} size="xs" variant="outline" color="danger" onClick={onInterrupt}>
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

import { useTranslation } from 'react-i18next';
import { FaFolderOpen } from 'react-icons/fa';
import { MdAssignment, MdClose } from 'react-icons/md';

import { TaskInfoMessage as TaskInfoMessageType } from '@/types/message';
import { CodeInline } from '@/components/common/CodeInline';
import { CopyMessageButton } from '@/components/message/CopyMessageButton';
import { IconButton } from '@/components/common/IconButton';
import { useApi } from '@/contexts/ApiContext';
import { getTaskStateLabel } from '@/components/common/TaskStateChip';

type Props = {
  message: TaskInfoMessageType;
  onRemove?: () => void;
};

export const TaskInfoMessage = ({ message, onRemove }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { task } = message;

  const handleOpenFolder = async (path: string) => {
    try {
      await api.openPath(path);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to open folder:', error);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return null;
    }
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="rounded-md p-2.5 max-w-full break-words text-xs border border-border-dark-light relative group bg-bg-primary-light-strong mb-2">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <MdAssignment className="w-4 h-4 flex-shrink-0 text-text-tertiary" />
          <span className="font-medium text-text-secondary">{task.name}</span>
        </div>
        {onRemove && <IconButton icon={<MdClose className="w-3 h-3" />} onClick={onRemove} className="p-1 flex-shrink-0" />}
      </div>

      <div className="space-y-1.5 text-text-secondary">
        <div className="flex items-center gap-2 text-2xs">
          <span className="text-2xs text-text-muted">{t('taskInfo.taskId')}:</span>
          <span className="text-text-secondary">{task.id}</span>
          <CopyMessageButton content={task.id} alwaysShow={true} />
        </div>

        {task.state && (
          <div className="text-2xs flex items-center gap-2">
            <span className="text-text-muted">{t('taskInfo.state')}:</span>
            <span className="text-text-secondary">{getTaskStateLabel(t, task.state)}</span>
          </div>
        )}

        {formatDate(task.createdAt) && (
          <div className="text-2xs flex items-center gap-2">
            <span className="text-text-muted">{t('taskInfo.createdAt')}:</span>
            <span className="text-text-secondary">{formatDate(task.createdAt)}</span>
          </div>
        )}
        {formatDate(task.updatedAt) && task.updatedAt !== task.createdAt && (
          <div className="text-2xs flex items-center gap-2">
            <span className="text-text-muted">{t('taskInfo.updatedAt')}:</span>
            <span className="text-text-secondary">{formatDate(task.updatedAt)}</span>
          </div>
        )}

        {message.messageCount !== undefined && (
          <div className="text-2xs text-text-muted flex items-center gap-2">
            <span className="text-text-muted">{t('taskInfo.messageCount')}:</span>
            <span className="text-text-secondary">{message.messageCount}</span>
          </div>
        )}

        {task.workingMode === 'worktree' && task.worktree?.path && (
          <div className="mt-2 pt-2 border-t border-border-dark-light">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap align-center gap-2">
                  <span className="text-2xs text-text-muted mb-1">{t('taskInfo.worktreeDirectory')}:</span>
                  <span className="text-2xs break-all">{task.worktree.path}</span>
                  <CopyMessageButton content={task.worktree.path} alwaysShow={true} />
                  <IconButton
                    icon={<FaFolderOpen className="w-3 h-3" />}
                    onClick={() => handleOpenFolder(task.worktree!.path!)}
                    tooltip={t('taskInfo.openFolder')}
                    className="p-1"
                  />
                </div>
                {task.worktree.baseBranch && (
                  <div className="text-2xs text-text-muted mt-1 flex items-center gap-2">
                    <span className="text-text-muted">{t('taskInfo.baseBranch')}:</span>
                    <span className="text-text-secondary text-2xs">{task.worktree.baseBranch}</span>
                    <CopyMessageButton content={task.worktree.baseBranch} alwaysShow={true} />
                  </div>
                )}
                {task.worktree.baseCommit && (
                  <div className="text-2xs text-text-muted mt-1 flex items-center gap-2">
                    <span className="text-text-muted">{t('taskInfo.baseCommit')}:</span>
                    <span className="text-text-secondary text-2xs">{task.worktree.baseCommit}</span>
                    <CopyMessageButton content={task.worktree.baseCommit} alwaysShow={true} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {task.lastMergeState && (
          <div className="mt-2 pt-2 border-t border-border-dark-light">
            <div className="text-2xs text-text-muted mb-1">{t('taskInfo.lastMergeState')}</div>
            <div className="text-2xs text-text-muted">
              <span className="text-text-muted">{t('taskInfo.beforeMergeCommit')}:</span>{' '}
              <CodeInline className="bg-bg-secondary text-text-secondary font-mono text-2xs">{task.lastMergeState.beforeMergeCommitHash}</CodeInline>
            </div>
            {task.lastMergeState.targetBranch && (
              <div className="text-2xs text-text-muted mt-1">
                <span className="text-text-muted">{t('taskInfo.targetBranch')}:</span> {task.lastMergeState.targetBranch}
              </div>
            )}
            {task.lastMergeState.timestamp && (
              <div className="text-2xs text-text-muted mt-1">
                <span className="text-text-muted">{t('taskInfo.mergeTimestamp')}:</span> {new Date(task.lastMergeState.timestamp * 1000).toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

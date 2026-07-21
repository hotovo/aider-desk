import { IoPlayOutline } from 'react-icons/io5';
import { RiAlertLine, RiCheckFill, RiCheckLine, RiPlayLine } from 'react-icons/ri';
import { BiArchive, BiArchiveIn } from 'react-icons/bi';
import { MdDeleteForever, MdOutlineDifference } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { DefaultTaskState, Mode, TaskData, UpdatedFile } from '@common/types';

import type { DiffModalGroup } from '@/components/Workspace/UpdatedFilesDiffModal';

import { UpdatedFilesDiffModal } from '@/components/Workspace/UpdatedFilesDiffModal';
import { Button } from '@/components/common/Button';
import { ExtensionComponentWrapper } from '@/components/extensions/ExtensionComponentWrapper';
import { useApi } from '@/contexts/ApiContext';
import { groupFilesByCommit } from '@/components/Workspace/group-files';
import { encodeBaseDir, ROUTES, URL_PARAMS } from '@/utils/routes';

type Props = {
  projectDir: string;
  taskId: string;
  state: string | undefined;
  mode?: Mode;
  isArchived: boolean | undefined;
  task?: TaskData | null;
  onResumeTask?: () => void;
  onMarkAsDone?: () => void;
  onRunPrompt?: (prompt: string) => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
};

export const DefaultTaskStateActions = ({
  projectDir,
  taskId,
  state,
  isArchived,
  task,
  onResumeTask,
  onMarkAsDone,
  onRunPrompt,
  onArchiveTask,
  onUnarchiveTask,
  onDeleteTask,
}: Props) => {
  const { t } = useTranslation();
  const [isDeleting, setIsDeleting] = useState(false);

  const api = useApi();
  const [updatedFiles, setUpdatedFiles] = useState<UpdatedFile[]>([]);
  const [showDiffModal, setShowDiffModal] = useState(false);

  useEffect(() => {
    if (state === DefaultTaskState.ReadyForReview) {
      const fetchUpdatedFiles = async () => {
        try {
          const files = await api.getUpdatedFiles(projectDir, taskId);
          setUpdatedFiles(files);
        } catch {
          // silently ignore fetch errors
        }
      };
      void fetchUpdatedFiles();
    }
  }, [state, api, projectDir, taskId]);

  const diffModalGroups = useMemo<DiffModalGroup[]>(() => groupFilesByCommit(updatedFiles), [updatedFiles]);

  const handleReviewChanges = useCallback(() => {
    setShowDiffModal(true);
  }, []);

  const handleDeleteClick = () => {
    setIsDeleting(true);
  };

  const handleCancelDelete = () => {
    setIsDeleting(false);
  };

  const handleConfirmDelete = () => {
    setIsDeleting(false);
    onDeleteTask?.();
  };

  const handleProceedClick = () => {
    onRunPrompt?.('Proceed.');
  };

  const handleArchiveClick = () => {
    onArchiveTask?.();
  };

  const handleUnarchiveClick = () => {
    onUnarchiveTask?.();
  };

  const renderSection = (icon: ReactNode, text: string, actions: ReactNode) => {
    return (
      <div className="px-4 p-2 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong">
        <div className="flex items-center gap-2">
          {icon}
          <div className="flex-1 text-text-secondary">{text}</div>
          <ExtensionComponentWrapper placement="task-state-actions" direction="horizontal" />
          {actions}
        </div>
      </div>
    );
  };

  if (state === DefaultTaskState.Todo && onResumeTask) {
    return renderSection(
      <RiPlayLine className="h-4 w-4 flex-shrink-0 text-text-tertiary" />,
      t('messages.taskTodoDescription'),
      <>
        <Button key="execute" variant="outline" color="primary" size="xs" onClick={onResumeTask}>
          <IoPlayOutline className="mr-1 w-3 h-3" />
          {t('messages.execute')}
        </Button>
      </>,
    );
  }

  if (state === DefaultTaskState.Interrupted && onResumeTask) {
    return renderSection(
      <RiAlertLine className="h-4 w-4 flex-shrink-0 text-warning" />,
      t('messages.taskInterrupted'),
      <>
        <Button key="resume" variant="outline" color="primary" size="xs" onClick={onResumeTask}>
          <IoPlayOutline className="mr-1 w-3 h-3" />
          {t('messages.resume')}
        </Button>
      </>,
    );
  }

  if (state === DefaultTaskState.Delegated && onResumeTask) {
    return renderSection(
      <RiAlertLine className="h-4 w-4 flex-shrink-0 text-warning" />,
      t('messages.taskDelegated'),
      <>
        <Button key="resume" variant="outline" color="primary" size="xs" onClick={onResumeTask}>
          <IoPlayOutline className="mr-1 w-3 h-3" />
          {t('messages.resume')}
        </Button>
      </>,
    );
  }

  if (state === DefaultTaskState.ReadyForImplementation) {
    return renderSection(
      <RiCheckLine className="h-4 w-4 flex-shrink-0 text-tertiary" />,
      t('messages.taskReadyForImplementation'),
      <>
        <Button key="proceed" variant="outline" color="primary" size="xs" onClick={handleProceedClick}>
          <IoPlayOutline className="mr-1 w-3 h-3" />
          {t('messages.proceed')}
        </Button>
      </>,
    );
  }

  if (state === DefaultTaskState.ReadyForReview && onMarkAsDone) {
    return (
      <>
        {renderSection(
          <RiCheckLine className="h-4 w-4 flex-shrink-0 text-tertiary" />,
          t('messages.taskReadyForReview'),
          <>
            {updatedFiles.length > 0 && (
              <Button key="reviewChanges" variant="contained" color="primary" size="xs" onClick={handleReviewChanges}>
                <MdOutlineDifference className="mr-1 w-3 h-3" />
                {t('messages.reviewChanges')}
              </Button>
            )}
            <Button key="markAsDone" variant="outline" color={updatedFiles.length > 0 ? 'tertiary' : 'primary'} size="xs" onClick={onMarkAsDone}>
              <RiCheckFill className="mr-1 w-3 h-3" />
              {t('messages.markAsDone')}
            </Button>
          </>,
        )}
        {showDiffModal && (
          <UpdatedFilesDiffModal
            groups={diffModalGroups}
            initialFile={diffModalGroups[0]?.files[0] || null}
            onClose={() => setShowDiffModal(false)}
            baseDir={projectDir}
            taskId={taskId}
            openInWindowUrl={`#${ROUTES.Diff}?${URL_PARAMS.PROJECT}=${encodeBaseDir(projectDir)}&${URL_PARAMS.TASK}=${taskId}`}
            openInWindowTitle={task?.name ? t('contextFiles.updatedFilesWindowTitle', { name: task.name }) : undefined}
          />
        )}
      </>
    );
  }

  if (state === DefaultTaskState.Done) {
    const actions = isDeleting ? (
      <>
        <Button key="cancel" variant="text" size="xs" onClick={handleCancelDelete}>
          {t('common.cancel')}
        </Button>
        <Button key="confirm" variant="contained" color="danger" size="xs" onClick={handleConfirmDelete}>
          {t('messages.confirmDelete')}
        </Button>
      </>
    ) : (
      <>
        <Button key="archive" variant="outline" color="primary" size="xs" onClick={isArchived ? handleUnarchiveClick : handleArchiveClick}>
          {isArchived ? <BiArchiveIn className="mr-1 w-3 h-3" /> : <BiArchive className="mr-1 w-3 h-3" />}
          {isArchived ? t('messages.unarchive') : t('messages.archive')}
        </Button>
        <Button key="delete" variant="outline" color="danger" size="xs" onClick={handleDeleteClick}>
          <MdDeleteForever className="mr-1 w-3 h-3" />
          {t('common.delete')}
        </Button>
      </>
    );

    return renderSection(
      <RiCheckLine className="h-4 w-4 flex-shrink-0 text-success" />,
      isArchived ? t('messages.taskDoneArchived') : t('messages.taskDone'),
      actions,
    );
  }

  if (state && !Object.values(DefaultTaskState).includes(state as DefaultTaskState)) {
    return renderSection(undefined, state.replace(/_/g, ' ').toLowerCase(), null);
  }

  return null;
};

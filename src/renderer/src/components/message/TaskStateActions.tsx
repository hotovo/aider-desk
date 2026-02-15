import { IoPlayOutline } from 'react-icons/io5';
import { RiAlertLine, RiCheckLine, RiPlayLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { ReactNode, useState } from 'react';
import { DefaultTaskState, Mode, TaskData } from '@common/types';

import { BmadTaskActions } from '@/components/bmad/BmadTaskActions';
import { Button } from '@/components/common/Button';

type Props = {
  projectDir: string;
  taskId: string;
  state: string | undefined;
  mode?: Mode;
  isArchived: boolean | undefined;
  task?: TaskData | null;
  onResumeTask: () => void;
  onMarkAsDone: () => void;
  onRunPrompt?: (prompt: string) => void;
  onArchiveTask?: () => void;
  onUnarchiveTask?: () => void;
  onDeleteTask?: () => void;
};

export const TaskStateActions = ({
  projectDir,
  taskId,
  state,
  mode,
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
      <div className="p-2.5 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong">
        <div className="flex items-center gap-3">
          {icon}
          <div className="flex-1 text-text-secondary">{text}</div>
          {actions}
        </div>
      </div>
    );
  };

  // BMAD mode rendering
  if (mode === 'bmad') {
    return <BmadTaskActions projectDir={projectDir} taskId={taskId} task={task} onRunPrompt={onRunPrompt} />;
  }

  if (state === DefaultTaskState.Todo) {
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

  if (state === DefaultTaskState.Interrupted) {
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

  if (state === DefaultTaskState.ReadyForReview) {
    return renderSection(
      <RiCheckLine className="h-4 w-4 flex-shrink-0 text-tertiary" />,
      t('messages.taskReadyForReview'),
      <>
        <Button key="markAsDone" variant="outline" color="primary" size="xs" onClick={onMarkAsDone}>
          {t('messages.markAsDone')}
        </Button>
      </>,
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
          {isArchived ? t('messages.unarchive') : t('messages.archive')}
        </Button>
        <Button key="delete" variant="outline" color="danger" size="xs" onClick={handleDeleteClick}>
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

  return null;
};

import { WorkflowMetadata } from '@common/types';
import { MouseEvent, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { HiCheck, HiClock } from 'react-icons/hi';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/common/Button';
import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification } from '@/utils/notifications';

type Props = {
  workflow: WorkflowMetadata;
  isCompleted: boolean;
  isInProgress: boolean;
  isSuggested: boolean;
  projectDir: string;
  taskId: string;
  onRefresh: () => Promise<void>;
};

export const WorkflowActionButton = ({ workflow, isCompleted, isInProgress, isSuggested, projectDir, taskId, onRefresh }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const [loading, setLoading] = useState(false);

  const handleExecuteWorkflow = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const result = await api.executeWorkflow(projectDir, taskId, workflow.id);

      if (result.success) {
        // Refresh BMAD state to update UI
        await onRefresh();
      } else {
        // Show error notification with recovery action
        const errorMessage = result.error?.message || t('bmad.workflows.workflowError');
        const fullMessage = result.error?.recoveryAction ? `${errorMessage}\n${result.error.recoveryAction}` : errorMessage;

        showErrorNotification(fullMessage);
      }
    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorNotification(`${t('bmad.workflows.workflowError')}: ${errorMessage}`);

      // eslint-disable-next-line no-console
      console.error('Workflow execution error:', error);
    } finally {
      setLoading(false);
    }
  };

  const buttonColor = isSuggested && !isCompleted ? 'primary' : 'tertiary';

  return (
    <Button onClick={handleExecuteWorkflow} color={buttonColor} size="sm" disabled={loading} className="gap-1">
      {loading && <CgSpinner className="animate-spin w-4 h-4" />}
      {isCompleted && !loading && <HiCheck className="w-4 h-4 text-success-default" />}
      {isInProgress && !loading && <HiClock className="w-4 h-4 text-warning-default" />}
      <span className={clsx({ 'line-through': isCompleted })}>{loading ? t('bmad.workflows.executing') : workflow.name}</span>
    </Button>
  );
};

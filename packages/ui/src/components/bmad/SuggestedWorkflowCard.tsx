import { WorkflowMetadata } from '@aider-desk/common/bmad-types';
import { MouseEvent, useState } from 'react';
import { CgSpinner } from 'react-icons/cg';
import { FiPlay } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification } from '@/utils/notifications';
import { Button } from '@/components/common/Button';

type Props = {
  workflow: WorkflowMetadata;
  projectDir: string;
  taskId: string;
  onRefresh: () => Promise<void>;
};

export const SuggestedWorkflowCard = ({ workflow, projectDir, taskId, onRefresh }: Props) => {
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
      const result = await api.executeWorkflow(projectDir, taskId, workflow.id, true);

      if (result.success) {
        await onRefresh();
      } else {
        const errorMessage = result.error?.message || t('bmad.workflows.workflowError');
        const fullMessage = result.error?.recoveryAction ? `${errorMessage}\n${result.error.recoveryAction}` : errorMessage;
        showErrorNotification(fullMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorNotification(`${t('bmad.workflows.workflowError')}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 border border-border-dark-light rounded-md bg-bg-secondary min-w-0">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary truncate">{workflow.name}</div>
      </div>
      <Button onClick={handleExecuteWorkflow} disabled={loading} size="xs" className="flex-shrink-0">
        {loading ? <CgSpinner className="animate-spin w-3 h-3" /> : <FiPlay className="w-3 h-3" />}
        <span>{loading ? t('bmad.workflows.executing') : t('bmad.taskActions.execute')}</span>
      </Button>
    </div>
  );
};

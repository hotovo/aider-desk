import { RiAlertLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { TaskData } from '@common/types';
import { clsx } from 'clsx';

import { useBmadState, type BmadAction } from './useBmadState';

import { Button } from '@/components/common/Button';
import { SuggestedWorkflowCard } from '@/components/bmad/SuggestedWorkflowCard';

type Props = {
  projectDir: string;
  taskId: string;
  task?: TaskData | null;
  onRunPrompt?: (prompt: string) => void;
};

export const BmadTaskActions = ({ projectDir, taskId, task, onRunPrompt }: Props) => {
  const { t } = useTranslation();
  const { status, suggestedWorkflows, bmadActions, error, refresh } = useBmadState({ projectDir, task });

  if (error) {
    return (
      <div className="p-2 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong">
        <div className="flex items-center gap-2">
          <RiAlertLine className="h-4 w-4 flex-shrink-0 text-error" />
          <div className="flex-1 text-text-secondary">
            {t('bmad.taskActions.error')}: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const hasCompletedWorkflows = status.completedWorkflows.length > 0;

  const suggestedWorkflowMetadata = hasCompletedWorkflows
    ? status.availableWorkflows.filter((workflow) => suggestedWorkflows.includes(workflow.id) && !status.inProgressWorkflows.includes(workflow.id))
    : [];

  const hasBmadActions = bmadActions && bmadActions.length > 0;
  const hasWorkflows = suggestedWorkflowMetadata.length > 0;

  if (!hasBmadActions && !hasWorkflows) {
    return null;
  }

  const handlePromptClick = (action: BmadAction) => {
    onRunPrompt?.(action.actionName);
  };

  return (
    <div className="py-2 px-4 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong">
      <div className={clsx('flex', hasBmadActions ? 'gap-2 items-center' : 'gap-1 flex-col')}>
        <div className="flex-1 text-text-secondary">{!hasBmadActions && t('bmad.taskActions.workflowsSection')}</div>
        <div className="flex flex-wrap gap-2">
          {hasBmadActions
            ? bmadActions.map((action, index) => (
                <Button key={`action-${index}`} variant="outline" color="primary" size="xs" onClick={() => handlePromptClick(action)}>
                  {action.actionName}
                </Button>
              ))
            : hasWorkflows
              ? suggestedWorkflowMetadata.map((workflow) => (
                  <SuggestedWorkflowCard key={workflow.id} workflow={workflow} projectDir={projectDir} taskId={taskId} onRefresh={refresh} />
                ))
              : null}
        </div>
      </div>
    </div>
  );
};

import { WorkflowPhase, BmadStatus } from '@common/types';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

import { WorkflowItem } from './WorkflowItem';
import { WorkflowPhaseSection } from './WorkflowPhaseSection';

const FULL_WORKFLOW_PHASES = [WorkflowPhase.Analysis, WorkflowPhase.Planning, WorkflowPhase.Solutioning, WorkflowPhase.Implementation];

type PathType = 'full' | 'quick';

type Props = {
  projectDir: string;
  taskId: string;
  activeTab: PathType;
  status: BmadStatus | null;
  suggestedWorkflows: string[];
  isLoading: boolean;
  error: string | null;
  onRefresh: () => Promise<void>;
};

export const WorkflowList = ({ projectDir, taskId, activeTab, status, suggestedWorkflows, isLoading, error, onRefresh }: Props) => {
  const { t } = useTranslation();
  const incompleteWorkflows = status?.incompleteWorkflows || [];

  const groupedWorkflows = useMemo(() => {
    if (!status?.availableWorkflows) {
      return {};
    }

    return status.availableWorkflows.reduce(
      (acc, workflow) => {
        const phase = workflow.phase;
        if (!acc[phase]) {
          acc[phase] = [];
        }
        acc[phase].push(workflow);
        return acc;
      },
      {} as Record<WorkflowPhase, typeof status.availableWorkflows>,
    );
  }, [status]);

  const getArtifactPath = (workflowId: string): string | undefined => {
    return status?.detectedArtifacts?.[workflowId]?.path;
  };

  const getIncompleteWorkflow = (workflowId: string) => {
    return incompleteWorkflows.find((w) => w.workflowId === workflowId);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center max-w-xl">
          <p className="text-sm text-text-secondary">{t('bmad.workflows.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center max-w-xl">
          <p className="text-sm text-error-default">{t('bmad.workflows.errorLoading', { error })}</p>
        </div>
      </div>
    );
  }

  if (!status?.availableWorkflows || status.availableWorkflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8">
        <div className="text-center max-w-xl">
          <p className="text-sm text-text-secondary">{t('bmad.workflows.noWorkflows')}</p>
        </div>
      </div>
    );
  }

  const renderFullWorkflow = () => {
    return (
      <div className="flex flex-col gap-4">
        {FULL_WORKFLOW_PHASES.map((phase) => {
          const workflows = groupedWorkflows[phase];
          if (!workflows || workflows.length === 0) {
            return null;
          }

          const completedCount = workflows.filter((w) => status.completedWorkflows.includes(w.id)).length;

          return (
            <WorkflowPhaseSection
              key={phase}
              phase={phase}
              workflows={workflows}
              completedCount={completedCount}
              defaultOpen={completedCount < workflows.length}
            >
              {workflows.map((workflow) => {
                const isCompleted = status.completedWorkflows.includes(workflow.id);
                const isInProgress = status.inProgressWorkflows.includes(workflow.id);
                const isSuggested = suggestedWorkflows.includes(workflow.id);
                const artifactPath = getArtifactPath(workflow.id);
                const incompleteWorkflow = getIncompleteWorkflow(workflow.id);

                return (
                  <WorkflowItem
                    key={workflow.id}
                    workflow={workflow}
                    isCompleted={isCompleted}
                    isInProgress={isInProgress}
                    isSuggested={isSuggested}
                    artifactPath={artifactPath}
                    projectDir={projectDir}
                    taskId={taskId}
                    incompleteWorkflow={incompleteWorkflow}
                    onRefresh={onRefresh}
                  />
                );
              })}
            </WorkflowPhaseSection>
          );
        })}
      </div>
    );
  };

  const renderQuickFlow = () => {
    const quickWorkflows = groupedWorkflows[WorkflowPhase.QuickFlow];
    if (!quickWorkflows || quickWorkflows.length === 0) {
      return (
        <div className="text-center p-4">
          <p className="text-sm text-text-secondary">{t('bmad.workflows.noWorkflows')}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {quickWorkflows.map((workflow) => {
          const isCompleted = status.completedWorkflows.includes(workflow.id);
          const isInProgress = status.inProgressWorkflows.includes(workflow.id);
          const isSuggested = suggestedWorkflows.includes(workflow.id);
          const artifactPath = getArtifactPath(workflow.id);
          const incompleteWorkflow = getIncompleteWorkflow(workflow.id);

          return (
            <WorkflowItem
              key={workflow.id}
              workflow={workflow}
              isCompleted={isCompleted}
              isInProgress={isInProgress}
              isSuggested={isSuggested}
              artifactPath={artifactPath}
              projectDir={projectDir}
              taskId={taskId}
              incompleteWorkflow={incompleteWorkflow}
              onRefresh={onRefresh}
            />
          );
        })}
      </div>
    );
  };

  return <div className="flex flex-col gap-4">{activeTab === 'full' ? renderFullWorkflow() : renderQuickFlow()}</div>;
};

import { IncompleteWorkflowMetadata, WorkflowMetadata } from '@common/types';
import { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FiFile, FiExternalLink } from 'react-icons/fi';
import { clsx } from 'clsx';

import { WorkflowActionButton } from './WorkflowActionButton';

import { useApi } from '@/contexts/ApiContext';

type Props = {
  workflow: WorkflowMetadata;
  isCompleted: boolean;
  isInProgress: boolean;
  isSuggested: boolean;
  artifactPath?: string;
  projectDir: string;
  taskId: string;
  incompleteWorkflow?: IncompleteWorkflowMetadata;
  onRefresh: () => Promise<void>;
};

export const WorkflowItem = ({ workflow, isCompleted, isInProgress, isSuggested, artifactPath, projectDir, taskId, incompleteWorkflow, onRefresh }: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const handleOpenArtifact = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (artifactPath) {
      await api.openPath(artifactPath);
    }
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getStepInfo = () => {
    if (!incompleteWorkflow) {
      return null;
    }

    const currentStep = incompleteWorkflow.nextStep;
    const totalSteps = workflow.totalSteps;

    if (totalSteps === 0) {
      return null;
    }

    return { currentStep, totalSteps };
  };

  const stepInfo = isInProgress || isCompleted ? getStepInfo() : null;

  return (
    <div
      className={clsx(
        'border rounded-md p-3 transition-colors',
        'bg-bg-secondary',
        isCompleted ? 'border-success-subtle' : isInProgress ? 'border-warning' : isSuggested ? 'border-button-primary' : 'border-border-dark-light',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <WorkflowActionButton
              workflow={workflow}
              isCompleted={isCompleted}
              isInProgress={isInProgress}
              isSuggested={isSuggested}
              projectDir={projectDir}
              taskId={taskId}
              onRefresh={onRefresh}
            />
            {stepInfo && (
              <span className="text-2xs bg-bg-primary-light px-2 py-0.5 rounded">
                {t('bmad.resume.stepIndicator', { current: stepInfo.currentStep, total: stepInfo.totalSteps })}
              </span>
            )}
          </div>
          <p className="text-2xs text-text-secondary ml-0.5 mt-1">{workflow.description}</p>

          <div className="flex items-center gap-2 ml-0.5">
            {artifactPath && (
              <button
                onClick={handleOpenArtifact}
                className="flex items-center gap-1.5 text-2xs text-accent-primary hover:text-accent-secondary transition-colors group"
              >
                <FiFile className="w-3 h-3" />
                <span className="underline decoration-dotted underline-offset-2">{getFileName(artifactPath)}</span>
                <FiExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { WorkflowMetadata, WorkflowPhase, IncompleteWorkflowMetadata } from '@common/bmad-types';
import { useTranslation } from 'react-i18next';
import { FiEdit2 } from 'react-icons/fi';
import { clsx } from 'clsx';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  workflow: WorkflowMetadata;
  incompleteWorkflow?: IncompleteWorkflowMetadata;
  onChangeWorkflow: () => void;
};

const PHASE_COLORS: Record<WorkflowPhase, string> = {
  [WorkflowPhase.Analysis]: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  [WorkflowPhase.Planning]: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  [WorkflowPhase.Solutioning]: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  [WorkflowPhase.Implementation]: 'bg-green-500/20 text-green-400 border-green-500/30',
  [WorkflowPhase.QuickFlow]: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export const CurrentWorkflowHeader = ({ workflow, incompleteWorkflow, onChangeWorkflow }: Props) => {
  const { t } = useTranslation();

  const phaseLabel = t(`bmad.phase.${workflow.phase}`);
  const phaseColor = PHASE_COLORS[workflow.phase] || 'bg-bg-tertiary text-text-secondary border-border-dark-light';

  const stepInfo = incompleteWorkflow
    ? {
        currentStep: incompleteWorkflow.nextStep,
        totalSteps: workflow.totalSteps,
      }
    : null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-xs font-medium text-text-primary truncate">{workflow.name}</span>
        <span className={clsx('text-2xs px-1.5 py-0.5 rounded border flex-shrink-0', phaseColor)}>{phaseLabel}</span>
        {stepInfo && stepInfo.totalSteps > 0 && (
          <span className="text-2xs text-text-tertiary flex-shrink-0">
            {t('bmad.resume.stepIndicator', { current: stepInfo.currentStep, total: stepInfo.totalSteps })}
          </span>
        )}
      </div>
      <Tooltip content={t('bmad.taskActions.changeWorkflow')}>
        <button onClick={onChangeWorkflow} className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors flex-shrink-0">
          <FiEdit2 className="w-3 h-3" />
        </button>
      </Tooltip>
    </div>
  );
};

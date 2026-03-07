import { WorkflowMetadata, WorkflowPhase } from '@common/types';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronDown } from 'react-icons/fa';
import { FiSearch, FiClipboard, FiCpu, FiCode } from 'react-icons/fi';
import { clsx } from 'clsx';

type Props = {
  phase: WorkflowPhase;
  workflows: WorkflowMetadata[];
  completedCount: number;
  children: ReactNode;
  defaultOpen?: boolean;
};

const PHASE_ICONS: Record<WorkflowPhase, typeof FiSearch> = {
  [WorkflowPhase.Analysis]: FiSearch,
  [WorkflowPhase.Planning]: FiClipboard,
  [WorkflowPhase.Solutioning]: FiCpu,
  [WorkflowPhase.Implementation]: FiCode,
  [WorkflowPhase.QuickFlow]: FiCode,
};

export const WorkflowPhaseSection = ({ phase, workflows, completedCount, children, defaultOpen = true }: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const Icon = PHASE_ICONS[phase];
  const totalCount = workflows.length;
  const isFullyCompleted = completedCount === totalCount && totalCount > 0;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="border border-border-default rounded-md overflow-hidden">
      <button
        onClick={handleToggle}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 transition-colors',
          'bg-bg-primary-light hover:bg-bg-tertiary',
          isOpen && 'border-b border-border-default',
        )}
      >
        <FaChevronDown className={clsx('w-3 h-3 text-text-secondary transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90')} />
        <Icon className="w-4 h-4 text-text-secondary" />
        <span className="text-sm font-medium text-text-primary capitalize flex-1 text-left">{t(`bmad.phase.${phase}`)}</span>
        <span className={clsx('text-2xs px-2 py-0.5 rounded-full', isFullyCompleted ? 'bg-success-subtle text-success' : 'bg-bg-tertiary text-text-secondary')}>
          {t('bmad.workflows.phaseProgress', { completed: completedCount, total: totalCount })}
        </span>
      </button>

      <div className={clsx('overflow-hidden transition-all duration-200', isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0')}>
        <div className="p-3 flex flex-col gap-2 bg-bg-primary">{children}</div>
      </div>
    </div>
  );
};

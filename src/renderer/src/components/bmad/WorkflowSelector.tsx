import { WorkflowMetadata, WorkflowPhase } from '@common/types';
import { useRef, useState, useEffect, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { CgSpinner } from 'react-icons/cg';
import { FiCheck } from 'react-icons/fi';

import { useClickOutside } from '@/hooks/useClickOutside';
import { useApi } from '@/contexts/ApiContext';
import { showErrorNotification } from '@/utils/notifications';

type Props = {
  workflows: WorkflowMetadata[];
  currentWorkflowId?: string;
  completedWorkflowIds: string[];
  inProgressWorkflowIds: string[];
  projectDir: string;
  taskId: string;
  taskMetadata?: Record<string, unknown>;
  triggerRef: RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  onClose: () => void;
};

const PHASE_ORDER: WorkflowPhase[] = [
  WorkflowPhase.Analysis,
  WorkflowPhase.Planning,
  WorkflowPhase.Solutioning,
  WorkflowPhase.Implementation,
  WorkflowPhase.QuickFlow,
];

export const WorkflowSelector = ({
  workflows,
  currentWorkflowId,
  completedWorkflowIds,
  inProgressWorkflowIds,
  projectDir,
  taskId,
  taskMetadata,
  triggerRef,
  isOpen,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [updatingWorkflowId, setUpdatingWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 320;
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceAbove > spaceBelow || (spaceAbove > menuHeight && spaceBelow < menuHeight);

      if (showAbove) {
        setMenuPosition({
          top: rect.top + window.scrollY - menuHeight - 12,
          left: Math.max(8, rect.left + window.scrollX),
        });
      } else {
        setMenuPosition({
          top: rect.bottom + window.scrollY + 12,
          left: Math.max(8, rect.left + window.scrollX),
        });
      }
    }
  }, [isOpen, triggerRef]);

  useClickOutside([triggerRef, menuRef], () => {
    if (isOpen) {
      onClose();
    }
  });

  const handleSelectWorkflow = async (workflow: WorkflowMetadata) => {
    if (updatingWorkflowId) {
      return;
    }

    setUpdatingWorkflowId(workflow.id);

    try {
      await api.updateTask(projectDir, taskId, {
        metadata: {
          ...taskMetadata,
          bmadWorkflowId: workflow.id,
        },
      });

      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      showErrorNotification(`${t('bmad.workflows.workflowError')}: ${errorMessage}`);
    } finally {
      setUpdatingWorkflowId(null);
    }
  };

  if (!isOpen) {
    return null;
  }

  const groupedWorkflows = PHASE_ORDER.map((phase) => ({
    phase,
    label: t(`bmad.phase.${phase}`),
    workflows: workflows.filter((w) => w.phase === phase),
  })).filter((group) => group.workflows.length > 0);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-64 max-h-80 overflow-y-auto bg-bg-secondary border border-border-dark-light rounded-md shadow-lg scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary"
      style={{
        top: menuPosition?.top ?? 0,
        left: menuPosition?.left ?? 0,
      }}
    >
      <div className="p-1.5">
        <div className="text-3xs text-text-tertiary uppercase tracking-wide mb-1.5 px-1">{t('bmad.taskActions.changeWorkflow')}</div>
        {groupedWorkflows.map((group) => (
          <div key={group.phase} className="mb-1.5 last:mb-0">
            <div className="text-3xs text-text-muted px-1 mb-1">{group.label}</div>
            {group.workflows.map((workflow) => {
              const isCompleted = completedWorkflowIds.includes(workflow.id);
              const isInProgress = inProgressWorkflowIds.includes(workflow.id);
              const isCurrent = workflow.id === currentWorkflowId;
              const isUpdating = updatingWorkflowId === workflow.id;

              return (
                <button
                  key={workflow.id}
                  onClick={() => handleSelectWorkflow(workflow)}
                  disabled={isUpdating}
                  className={clsx(
                    'w-full text-left px-2 py-1 rounded text-2xs transition-colors flex items-center gap-1.5',
                    isCurrent ? 'bg-button-primary/20 text-text-primary' : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary',
                    isUpdating && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <span className="flex-1 truncate">{workflow.name}</span>
                  {isUpdating ? (
                    <CgSpinner className="w-3 h-3 animate-spin flex-shrink-0" />
                  ) : isCompleted ? (
                    <FiCheck className="w-3 h-3 text-success flex-shrink-0" />
                  ) : isInProgress ? (
                    <span className="w-2 h-2 rounded-full bg-warning flex-shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
};

import { RiAlertLine } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { TaskData } from '@common/types';
import { clsx } from 'clsx';
import { MouseEvent, useMemo, useRef, useState } from 'react';
import { FiEdit2, FiExternalLink, FiFile } from 'react-icons/fi';

import { type BmadAction, useBmadState } from './useBmadState';
import { WorkflowSelector } from './WorkflowSelector';

import { Button } from '@/components/common/Button';
import { SuggestedWorkflowCard } from '@/components/bmad/SuggestedWorkflowCard';
import { Tooltip } from '@/components/ui/Tooltip';
import { useApi } from '@/contexts/ApiContext';
import { useModelProviders } from '@/contexts/ModelProviderContext';
import { useProjectSettings } from '@/contexts/ProjectSettingsContext';
import { useAgents } from '@/contexts/AgentsContext';
import { resolveAgentProfile } from '@/utils/agents';

type Props = {
  projectDir: string;
  taskId: string;
  task?: TaskData | null;
  onRunPrompt?: (prompt: string) => void;
};

export const BmadTaskActions = ({ projectDir, taskId, task, onRunPrompt }: Props) => {
  const { t } = useTranslation();
  const api = useApi();
  const { status, currentWorkflow, suggestedWorkflows, bmadActions, error, refresh } = useBmadState({ projectDir, task });
  const [isWorkflowSelectorOpen, setIsWorkflowSelectorOpen] = useState(false);
  const workflowButtonRef = useRef<HTMLDivElement>(null);

  const { models, providers } = useModelProviders();
  const { projectSettings } = useProjectSettings();
  const { getProfiles } = useAgents();

  const activeAgentProfile = useMemo(() => {
    return resolveAgentProfile(task || undefined, projectSettings?.agentProfileId, getProfiles(projectDir));
  }, [task, projectSettings?.agentProfileId, getProfiles, projectDir]);

  const defaultModelId = useMemo(() => {
    const effectiveProvider = task?.provider || activeAgentProfile?.provider;
    const effectiveModel = task?.model || activeAgentProfile?.model;
    return effectiveProvider && effectiveModel ? `${effectiveProvider}/${effectiveModel}` : undefined;
  }, [task, activeAgentProfile]);

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

  // Get artifact for current workflow if exists
  const currentArtifact = currentWorkflow ? status.detectedArtifacts[currentWorkflow.id] : null;

  const hasContent = currentWorkflow || hasBmadActions || hasWorkflows;

  if (!hasContent) {
    return null;
  }

  const handlePromptClick = (action: BmadAction) => {
    onRunPrompt?.(action.actionName);
  };

  const handleChangeWorkflow = () => {
    setIsWorkflowSelectorOpen(true);
  };

  const handleCloseWorkflowSelector = () => {
    setIsWorkflowSelectorOpen(false);
  };

  const handleOpenArtifact = async (e: MouseEvent<HTMLButtonElement>, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    await api.openPath(path);
  };

  const getFileName = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="py-3 px-4 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong gap-3 flex flex-col">
      {/* Info Row - Current Workflow with Edit and Artifact */}
      {currentWorkflow && (
        <div className="flex items-center gap-2 text-2xs">
          {/* Workflow Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-secondary border border-border-dark-light">
            <span className="text-text-primary font-medium">{currentWorkflow.name}</span>
            {/* Edit button inside badge */}
            <div ref={workflowButtonRef}>
              <Tooltip content={t('bmad.taskActions.changeWorkflow')}>
                <button
                  onClick={handleChangeWorkflow}
                  className="ml-1 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
                >
                  <FiEdit2 className="w-2.5 h-2.5" />
                </button>
              </Tooltip>
            </div>
            <WorkflowSelector
              workflows={status.availableWorkflows}
              currentWorkflowId={currentWorkflow.id}
              completedWorkflowIds={status.completedWorkflows}
              inProgressWorkflowIds={status.inProgressWorkflows}
              projectDir={projectDir}
              taskId={taskId}
              taskMetadata={task?.metadata}
              triggerRef={workflowButtonRef}
              isOpen={isWorkflowSelectorOpen}
              onClose={handleCloseWorkflowSelector}
            />
          </div>

          {/* Artifact link */}
          {currentArtifact?.path && (
            <>
              <span className="text-border-default">│</span>
              <button
                onClick={(e) => handleOpenArtifact(e, currentArtifact.path)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary-emphasis hover:bg-bg-tertiary-strong transition-colors"
              >
                <FiFile className="w-3 h-3 text-accent-primary" />
                <span className="text-text-secondary">{getFileName(currentArtifact.path)}</span>
                <FiExternalLink className="w-2.5 h-2.5 text-text-muted group-hover/artifact:text-text-secondary transition-colors" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Actions Row - BMAD Actions or Follow-up Workflows */}
      {(hasBmadActions || hasWorkflows) && (
        <div className={clsx('flex', hasBmadActions ? 'gap-2 items-center' : 'gap-1 flex-col')}>
          {!hasBmadActions && hasWorkflows && <div className="text-2xs text-text-tertiary">{t('bmad.taskActions.workflowsSection')}</div>}
          <div className="flex flex-wrap gap-2">
            {hasBmadActions
              ? bmadActions.map((action, index) => (
                  <Button key={`action-${index}`} variant="outline" color="primary" size="xs" onClick={() => handlePromptClick(action)}>
                    [{action.actionLetter}] {action.actionName}
                  </Button>
                ))
              : hasWorkflows
                ? suggestedWorkflowMetadata.map((workflow) => (
                    <SuggestedWorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      projectDir={projectDir}
                      taskId={taskId}
                      onRefresh={refresh}
                      defaultModelId={defaultModelId}
                      models={models}
                      providers={providers}
                    />
                  ))
                : null}
          </div>
        </div>
      )}
    </div>
  );
};

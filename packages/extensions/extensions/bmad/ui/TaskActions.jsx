(props) => {
  const { task, projectDir, api, mode, ui, icons, executeExtensionAction, data, agentProfile, models, providers } = props;
  const { useState, useMemo, useCallback, useRef, useEffect } = React;

  // Get icons from react-icons
  const RiAlertLine = icons.Ri.RiAlertLine;
  const FiFile = icons.Fi.FiFile;
  const FiExternalLink = icons.Fi.FiExternalLink;
  const FiEdit2 = icons.Fi.FiEdit2;
  const FiCheck = icons.Fi.FiCheck;
  const CgSpinner = icons.Cg.CgSpinner;
  const FiPlay = icons.Fi.FiPlay;
  const FiChevronLeft = icons.Fi.FiChevronLeft;
  const FiChevronRight = icons.Fi.FiChevronRight;

  const status = data?.status;
  const suggestedWorkflows = data?.suggestedWorkflows || [];
  const bmadActions = data?.bmadActions || [];
  const error = data?.error;

  const [isWorkflowSelectorOpen, setIsWorkflowSelectorOpen] = useState(false);
  const [changingWorkflow, setChangingWorkflow] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState({});
  const [selectedModels, setSelectedModels] = useState({});
  const workflowButtonRef = useRef(null);
  const menuRef = useRef(null);

  const handlePromptClick = useCallback(async (action) => {
    await executeExtensionAction('run-action', action.actionName);
  }, [executeExtensionAction]);

  // Helper to extract provider and model from modelId
  const extractProviderModel = (modelId) => {
    const [providerId, ...modelParts] = modelId.split('/');
    return [providerId, modelParts.join('/')];
  };

  // Get default model ID from task or agent profile
  const defaultModelId = useMemo(() => {
    const effectiveProvider = task?.provider || agentProfile?.provider;
    const effectiveModel = task?.model || agentProfile?.model;
    return effectiveProvider && effectiveModel ? `${effectiveProvider}/${effectiveModel}` : undefined;
  }, [task, agentProfile]);

  const handleExecuteWorkflow = useCallback((workflowId) => {
    // Use the selected model for this workflow, or fall back to the default
    const effectiveModelId = selectedModels[workflowId] || defaultModelId;
    let provider = undefined;
    let model = undefined;

    if (effectiveModelId) {
      const [providerId, modelId] = extractProviderModel(effectiveModelId);
      if (providerId && modelId) {
        provider = providerId;
        model = modelId;
      }
    }

    // Execute as subtask to create a new task for the workflow
    executeExtensionAction('execute-workflow', workflowId, task?.id, provider, model, true);
  }, [executeExtensionAction, task?.id, selectedModels, defaultModelId]);

  const handleOpenArtifact = useCallback(async (artifactPath) => {
    await executeExtensionAction('open-artifact', artifactPath);
  }, [executeExtensionAction]);

  const handleToggleWorkflowExpanded = useCallback((workflowId) => {
    setExpandedWorkflows(prev => ({
      ...prev,
      [workflowId]: !prev[workflowId]
    }));
  }, []);

  const handleModelChange = useCallback((workflowId, model) => {
    const modelId = `${model.providerId}/${model.id}`;
    setSelectedModels(prev => ({
      ...prev,
      [workflowId]: modelId
    }));
  }, []);

  const handleChangeWorkflow = useCallback(() => {
    setIsWorkflowSelectorOpen(true);
  }, []);

  const handleSelectWorkflow = useCallback(async (workflowId) => {
    if (changingWorkflow) {
      return;
    }

    setChangingWorkflow(true);
    try {
      await executeExtensionAction('change-workflow', workflowId);
      setIsWorkflowSelectorOpen(false);
    } finally {
      setChangingWorkflow(false);
    }
  }, [executeExtensionAction, changingWorkflow]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isWorkflowSelectorOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        workflowButtonRef.current &&
        !workflowButtonRef.current.contains(event.target)
      ) {
        setIsWorkflowSelectorOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isWorkflowSelectorOpen]);

  if (error) {
    return (
      <div className="p-2 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong">
        <div className="flex items-center gap-2">
          <RiAlertLine className="h-4 w-4 flex-shrink-0 text-error" />
          <div className="flex-1 text-text-secondary">
            BMAD Error: {error}
          </div>
        </div>
      </div>
    );
  }

  if (!status || !task.state || task.state === "TODO") {
    return null;
  }

  // Get current workflow from task metadata
  const currentWorkflowId = task?.metadata?.bmadWorkflowId;
  const currentWorkflow = currentWorkflowId
    ? status.availableWorkflows.find(w => w.id === currentWorkflowId)
    : null;

  // Get artifact for current workflow
  const currentArtifact = currentWorkflow ? status.detectedArtifacts[currentWorkflow.id] : null;

  // Filter suggested workflows
  const hasCompletedWorkflows = status.completedWorkflows.length > 0;
  const suggestedWorkflowMetadata = hasCompletedWorkflows
    ? status.availableWorkflows.filter(
        workflow => suggestedWorkflows.includes(workflow.id) && !status.inProgressWorkflows.includes(workflow.id)
      )
    : [];

  const hasBmadActions = bmadActions && bmadActions.length > 0;
  const hasWorkflows = suggestedWorkflowMetadata.length > 0;

  const hasContent = currentWorkflow || hasBmadActions || hasWorkflows;

  if (!hasContent) {
    return null;
  }

  const getFileName = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div className="py-3 px-4 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong gap-3 flex flex-col">
      {/* Info Row - Current Workflow with Artifact */}
      {currentWorkflow && (
        <div className="flex items-center gap-2 text-2xs">
          {/* Workflow Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-secondary border border-border-dark-light relative">
            <span className="text-text-primary font-medium">{currentWorkflow.name}</span>
            {/* Edit button inside badge */}
            <div ref={workflowButtonRef}>
              <ui.Tooltip content="Change Workflow">
                <button
                  onClick={handleChangeWorkflow}
                  className="ml-1 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
                >
                  <FiEdit2 className="w-2.5 h-2.5" />
                </button>
              </ui.Tooltip>
            </div>
            {/* Workflow Selector Dropdown */}
            {isWorkflowSelectorOpen && status && (
              <div
                ref={menuRef}
                className="absolute bottom-full left-0 mb-2 w-64 max-h-80 overflow-y-auto bg-bg-secondary border border-border-dark-light rounded-md shadow-lg z-50 scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary"
              >
                <div className="p-1.5">
                  <div className="text-3xs text-text-tertiary uppercase tracking-wide mb-1.5 px-1">Change Workflow</div>
                  {['analysis', 'planning', 'solutioning', 'implementation', 'quick-flow'].map(phase => {
                    const workflows = status.availableWorkflows.filter(w => w.phase === phase);
                    if (workflows.length === 0) return null;

                    const phaseLabels = {
                      'analysis': 'Analysis',
                      'planning': 'Planning',
                      'solutioning': 'Solutioning',
                      'implementation': 'Implementation',
                      'quick-flow': 'Quick Flow',
                    };

                    return (
                      <div key={phase} className="mb-1.5 last:mb-0">
                        <div className="text-3xs text-text-muted px-1 mb-1">{phaseLabels[phase]}</div>
                        {workflows.map(workflow => {
                          const isCompleted = status.completedWorkflows.includes(workflow.id);
                          const isInProgress = status.inProgressWorkflows.includes(workflow.id);
                          const isCurrent = workflow.id === currentWorkflow.id;

                          return (
                            <button
                              key={workflow.id}
                              onClick={() => handleSelectWorkflow(workflow.id)}
                              disabled={changingWorkflow}
                              className={`w-full text-left px-2 py-1 rounded text-2xs transition-colors flex items-center gap-1.5 ${
                                isCurrent
                                  ? 'bg-button-primary/20 text-text-primary'
                                  : 'hover:bg-bg-tertiary text-text-secondary hover:text-text-primary'
                              } ${changingWorkflow ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <span className="flex-1 truncate">{workflow.name}</span>
                              {changingWorkflow && isCurrent ? (
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
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Artifact link */}
          {currentArtifact?.path && (
            <>
              <span className="text-border-default">│</span>
              <button
                onClick={() => handleOpenArtifact(currentArtifact.path)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary-emphasis hover:bg-bg-tertiary-strong transition-colors"
              >
                <FiFile className="w-3 h-3 text-accent-primary" />
                <span className="text-text-secondary">{getFileName(currentArtifact.path)}</span>
                <FiExternalLink className="w-2.5 h-2.5 text-text-muted" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Actions Row - BMAD Actions or Follow-up Workflows */}
      {(hasBmadActions || hasWorkflows) && (
        <div className={`flex ${hasBmadActions ? 'gap-2 items-center' : 'gap-1 flex-col'}`}>
          {!hasBmadActions && hasWorkflows && (
            <div className="text-2xs text-text-tertiary">Follow-up workflows</div>
          )}
          <div className="flex flex-wrap gap-2">
            {hasBmadActions
              ? bmadActions.map((action, index) => (
                  <ui.Button
                    key={`action-${index}`}
                    variant="outline"
                    color="primary"
                    size="xs"
                    onClick={() => handlePromptClick(action)}
                  >
                    [{action.actionLetter}] {action.actionName}
                  </ui.Button>
                ))
              : hasWorkflows
                ? suggestedWorkflowMetadata.map(workflow => {
                    const isExpanded = expandedWorkflows[workflow.id];
                    const selectedModelId = selectedModels[workflow.id] || defaultModelId;

                    return (
                      <div key={workflow.id} className="border border-border-dark-light rounded-md bg-bg-secondary min-w-0">
                        <div className="flex items-center p-2 gap-1 pr-1">
                          <ui.Button
                            onClick={() => handleExecuteWorkflow(workflow.id)}
                            size="xs"
                            className="flex-shrink-0"
                          >
                            <span>{workflow.name}</span>
                            <FiPlay className="w-3 h-3" />
                          </ui.Button>
                          {isExpanded && (
                            <div className="px-2">
                              <ui.ModelSelector
                                selectedModelId={selectedModelId}
                                onChange={(model) => handleModelChange(workflow.id, model)}
                                className="text-text-primary"
                                popupPlacement="top"
                              />
                            </div>
                          )}
                          <ui.IconButton
                            icon={isExpanded ? <FiChevronLeft className="w-3 h-3" /> : <FiChevronRight className="w-3 h-3" />}
                            onClick={() => handleToggleWorkflowExpanded(workflow.id)}
                            className="flex-shrink-0 hover:bg-bg-tertiary p-1.5 rounded-md"
                            tooltip={isExpanded ? 'Hide Model Selector' : 'Show Model Selector'}
                          />
                        </div>
                      </div>
                    );
                  })
                : null}
          </div>
        </div>
      )}
    </div>
  );
}

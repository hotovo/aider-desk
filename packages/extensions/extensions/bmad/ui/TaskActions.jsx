(props) => {
  const { task, projectDir, api, mode, ui, icons, executeExtensionAction, data, agentProfile, models, providers } = props;
  const { useState, useMemo, useCallback, useRef, useEffect } = React;

  // Get icons from react-icons
  const RiAlertLine = icons.Ri.RiAlertLine;
  const FiAlertTriangle = icons.Fi.FiAlertTriangle;
  const FiFile = icons.Fi.FiFile;
  const FiExternalLink = icons.Fi.FiExternalLink;
  const FiEdit2 = icons.Fi.FiEdit2;
  const FiCheck = icons.Fi.FiCheck;
  const HiClock = icons.Hi.HiClock;
  const CgSpinner = icons.Cg.CgSpinner;
  const FiPlay = icons.Fi.FiPlay;
  const FiBarChart2 = icons.Fi.FiBarChart2;
  const FiChevronLeft = icons.Fi.FiChevronLeft;
  const FiChevronRight = icons.Fi.FiChevronRight;
  const FiChevronDown = icons.Fi.FiChevronDown;
  const FiChevronUp = icons.Fi.FiChevronUp;
  const FiLayers = icons.Fi.FiLayers;
  const FiHelpCircle = icons.Fi.FiHelpCircle;

  const status = data?.status;
  const suggestedWorkflows = data?.suggestedWorkflows || [];
  const bmadActions = data?.bmadActions || [];
  const error = data?.error;
  const progressSummary = data?.progressSummary;
  // v1.12: beginner guidance payload
  const phaseSteps = data?.phaseSteps || [];
  const overview = data?.overview || { nextSteps: [], optionalFollowUps: [], hasActiveWorkflow: false };
  // Ordered original phase labels from the installed method (backend payload)
  const phases = data?.phases || [];

  const [isWorkflowSelectorOpen, setIsWorkflowSelectorOpen] = useState(false);
  const [changingWorkflow, setChangingWorkflow] = useState(false);
  const [expandedWorkflows, setExpandedWorkflows] = useState({});
  const [selectedModels, setSelectedModels] = useState({});
  // v1.12: the whole bar can be collapsed so it never blocks the chat;
  // the choice is remembered across sessions (localStorage, guarded).
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('bmad.taskactions.collapsed') === '1';
    } catch {
      return false;
    }
  });
  // v1.12: follow-ups + overview are behind toggles (collapsed by default)
  const [showFollowUps, setShowFollowUps] = useState(false);
  const [showOverview, setShowOverview] = useState(false);
  const workflowButtonRef = useRef(null);
  const menuRef = useRef(null);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('bmad.taskactions.collapsed', next ? '1' : '0');
      } catch {
        // choice just does not persist — fine
      }
      return next;
    });
  };

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

  // v1.12: live project status — refresh every 15s whenever BMAD is
  // installed so the mini bar, follow-ups and overview reflect the current
  // project state even when workflows finish outside the UI.
  useEffect(() => {
    if (!status?.installed) {
      return undefined;
    }

    const liveInterval = setInterval(() => {
      executeExtensionAction('refresh-data');
    }, 15000);

    return () => clearInterval(liveInterval);
  }, [status?.installed, executeExtensionAction]);

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
    ? status.catalog.find(w => w.id === currentWorkflowId)
    : null;
  // The metadata can point at a workflow that is already finished (e.g. the
  // task that created the brief): show that state instead of implying work.
  const currentWorkflowCompleted = Boolean(currentWorkflowId && status.completedWorkflows.includes(currentWorkflowId));

  // Get artifact for current workflow
  const currentArtifact = currentWorkflow ? status.detectedArtifacts[currentWorkflow.id] : null;

  // Filter suggested workflows
  const hasCompletedWorkflows = status.completedWorkflows.length > 0;
  const suggestedWorkflowMetadata = hasCompletedWorkflows
    ? status.catalog.filter(
        workflow => suggestedWorkflows.includes(workflow.id) && !status.inProgressWorkflows.includes(workflow.id)
      )
    : [];

  const hasBmadActions = bmadActions && bmadActions.length > 0;
  const hasWorkflows = suggestedWorkflowMetadata.length > 0;

  // v1.12: the bar is shown in every active task of a BMAD project (slim by
  // default) — this guarantees one-click access to the BMAD overview from
  // any chat, while the collapsed state keeps the chat completely free.
  const hasContent = currentWorkflow || hasBmadActions || hasWorkflows || (progressSummary && progressSummary.overall.total > 0) || (status.catalog && status.catalog.length > 0);

  if (!hasContent) {
    return null;
  }

  const getFileName = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };


  // ---- v1.12: Follow-up chips (capped, behind toggle) ----
  const renderFollowUpChips = () => {
    const followUps = overview?.nextSteps || [];
    if (followUps.length === 0) {
      return null;
    }

    const visible = followUps.slice(0, 4);
    const overflow = followUps.length - visible.length;

    return (
      <div className="flex flex-col gap-1">
        <div className="text-2xs text-text-tertiary">Next steps</div>
        <div className="flex flex-wrap gap-2">
          {visible.map(step => (
            <ui.Button
              key={step.workflowId}
              variant="outline"
              color="primary"
              size="xs"
              onClick={() => handleExecuteWorkflow(step.workflowId)}
              title={!step.prereqMet ? 'Prerequisites missing — start anyway?' : step.description}
            >
              {step.reason === 'recommended' ? <FiPlay className="w-3 h-3" /> : null}
              {step.name}
            </ui.Button>
          ))}
          {overflow > 0 && (
            <ui.Button
              variant="outline"
              color="tertiary"
              size="xs"
              onClick={() => {
                setShowFollowUps(false);
                setShowOverview(true);
              }}
              title="Show all in the overview"
            >
              +{overflow} more
            </ui.Button>
          )}
        </div>
      </div>
    );
  };

  // ---- v1.12: Inline project overview (one click, never blocks) ----
  const renderOverviewPanel = () => {
    const ps = progressSummary;
    if (!ps) {
      return null;
    }

    const segments = [];
    if (ps.overall.completed > 0) {
      segments.push({ label: 'completed', count: ps.overall.completed, color: 'bg-success' });
    }
    if (ps.overall.inProgress > 0) {
      segments.push({ label: 'in progress', count: ps.overall.inProgress, color: 'bg-warning' });
    }
    const openCount = ps.overall.total - ps.overall.completed - ps.overall.inProgress;
    if (openCount > 0) {
      segments.push({ label: 'open', count: openCount, color: 'bg-bg-tertiary-strong' });
    }

    const phaseColors = {
      plan: 'bg-accent-primary',
      '2-planning': 'bg-button-primary',
      ship: 'bg-success',
      anytime: 'bg-accent-secondary',
    };

    const nextSteps = overview?.nextSteps || [];

    return (
      <div className="border border-border-dark-light rounded-md bg-bg-secondary p-3 flex flex-col gap-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary scrollbar-thumb-bg-tertiary">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xs font-medium text-text-primary uppercase tracking-wide flex items-center gap-1.5">
            <FiLayers className="w-3.5 h-3.5 text-accent-primary" />
            BMAD project overview
          </span>
          <span className="text-2xs text-text-tertiary whitespace-nowrap">
            {ps.overall.completed}/{ps.overall.total} done · {ps.overall.percentage}%
          </span>
        </div>

        {/* Overall bar */}
        <div className="w-full h-2 rounded-full bg-bg-tertiary overflow-hidden flex" title={`completed: ${ps.overall.completed}, in progress: ${ps.overall.inProgress}, open: ${openCount}`}>
          {segments.map((seg, i) => (
            <div
              key={seg.label}
              className={`${seg.color} h-full ${i > 0 ? 'border-l border-bg-primary' : ''}`}
              style={{ width: `${(seg.count / Math.max(1, ps.overall.total)) * 100}%` }}
            />
          ))}
        </div>

        {/* Phase bars */}
        {ps.phases.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {ps.phases.map(phase => (
              <div key={phase.phase} className="flex items-center gap-2">
                <span className="w-24 text-2xs text-text-secondary flex-shrink-0 capitalize">{phase.phaseName}</span>
                <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className={`${phaseColors[phase.phase] || 'bg-accent-primary'} h-full rounded-full`}
                    style={{ width: `${phase.percentage}%` }}
                    title={`${phase.completed}/${phase.total} done`}
                  />
                </div>
                <span className="w-10 text-2xs text-text-tertiary text-right flex-shrink-0">
                  {phase.completed}/{phase.total}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Epic */}
        {ps.epicProgress && (
          <div className="text-2xs text-text-secondary">
            Epic: <span className="text-text-primary font-medium">{ps.epicProgress.done}/{ps.epicProgress.total}</span> stories done ({ps.epicProgress.percentage}%)
          </div>
        )}

        {/* Next steps with model selector for the first one */}
        {nextSteps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-text-tertiary">Next steps</span>
            {nextSteps.map(step => {
              const isExpanded = expandedWorkflows[step.workflowId];
              const selectedModelId = selectedModels[step.workflowId] || defaultModelId;
              return (
                <div key={step.workflowId} className="flex items-center gap-1.5 border border-border-dark-light rounded-md bg-bg-primary p-1.5 min-w-0">
                  <ui.Button
                    onClick={() => handleExecuteWorkflow(step.workflowId)}
                    size="xs"
                    className="flex-shrink-0"
                    title={step.description}
                  >
                    <span>{step.name}</span>
                    {status.inProgressWorkflows?.includes(step.workflowId)
                      ? <HiClock className="w-3 h-3 text-warning-default" />
                      : <FiPlay className="w-3 h-3" />}
                  </ui.Button>
                  {!step.prereqMet && (
                    <ui.Tooltip content="Prerequisites missing — start anyway?" placement="top">
                      <FiAlertTriangle className="w-3 h-3 text-warning flex-shrink-0" />
                    </ui.Tooltip>
                  )}
                  {isExpanded && (
                    <div className="px-1">
                      <ui.ModelSelector
                        selectedModelId={selectedModelId}
                        onChange={(model) => handleModelChange(step.workflowId, model)}
                        className="text-text-primary"
                        popupPlacement="top"
                      />
                    </div>
                  )}
                  <ui.IconButton
                    icon={isExpanded ? <FiChevronLeft className="w-3 h-3" /> : <FiChevronRight className="w-3 h-3" />}
                    onClick={() => handleToggleWorkflowExpanded(step.workflowId)}
                    className="flex-shrink-0 hover:bg-bg-tertiary p-1 rounded-md"
                    tooltip={isExpanded ? 'Hide Model Selector' : 'Show Model Selector'}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ---- Collapsed: single slim line, chat stays free ----
  if (collapsed) {
    return (
      <div className="py-1.5 px-3 max-w-full break-words text-2xs border-t border-border-dark-light relative group bg-bg-primary-light-strong flex items-center gap-2">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors"
          title="Show BMAD bar"
        >
          <FiChevronRight className="w-3 h-3" />
          <FiLayers className="w-3 h-3 text-accent-primary" />
          <span className="text-text-secondary">BMAD</span>
        </button>
        {progressSummary && progressSummary.overall.total > 0 && (
          <span className="text-text-tertiary whitespace-nowrap">
            {progressSummary.overall.completed}/{progressSummary.overall.total} ({progressSummary.overall.percentage}%)
          </span>
        )}
      </div>
    );
  }

  // ---- Expanded: slim default bar + toggleable sections ----
  return (
    <div className="py-2 px-3 max-w-full break-words text-xs border-t border-border-dark-light relative group bg-bg-primary-light-strong gap-2 flex flex-col">
      {/* Row 1: workflow badge, progress, toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Workflow Badge */}
        {currentWorkflow && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-secondary border border-border-dark-light relative">
            {currentWorkflowCompleted && <FiCheck className="w-3 h-3 text-success flex-shrink-0" />}
            <span className={`text-text-primary font-medium ${currentWorkflowCompleted ? 'text-text-tertiary' : ''}`}>{currentWorkflow.name}</span>
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
                  {[
                    ...phases.map(p => p.phase),
                    ...status.catalog
                      .map(w => w.phase)
                      .filter((phase, i, arr) => arr.indexOf(phase) === i && !phases.some(p => p.phase === phase)),
                  ].map(phase => {
                    const workflows = status.catalog.filter(w => w.phase === phase);
                    if (workflows.length === 0) return null;

                    const phaseLabel = phases.find(p => p.phase === phase)?.phaseName
                      || phase.charAt(0).toUpperCase() + phase.slice(1);

                    return (
                      <div key={phase} className="mb-1.5 last:mb-0">
                        <div className="text-3xs text-text-muted px-1 mb-1">{phaseLabel}</div>
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
        )}

        {/* Artifact link */}
        {currentArtifact?.path && (
          <button
            onClick={() => handleOpenArtifact(currentArtifact.path)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-bg-tertiary-emphasis hover:bg-bg-tertiary-strong transition-colors"
            title={`Open ${getFileName(currentArtifact.path)}`}
          >
            <FiFile className="w-3 h-3 text-accent-primary" />
            <span className="text-text-secondary">{getFileName(currentArtifact.path)}</span>
            <FiExternalLink className="w-2.5 h-2.5 text-text-muted" />
          </button>
        )}

        {/* Mini progress */}
        {progressSummary && progressSummary.overall.total > 0 && (
          <div className="flex items-center gap-1.5 text-2xs" title={`Project progress: ${progressSummary.overall.completed}/${progressSummary.overall.total} done (${progressSummary.overall.percentage}%)`}>
            <div className="w-16 h-1.5 rounded-full bg-bg-tertiary overflow-hidden flex">
              {progressSummary.overall.completed > 0 && (
                <div
                  className="bg-success h-full"
                  style={{ width: `${(progressSummary.overall.completed / progressSummary.overall.total) * 100}%` }}
                />
              )}
              {progressSummary.overall.inProgress > 0 && (
                <div
                  className="bg-warning h-full"
                  style={{ width: `${(progressSummary.overall.inProgress / progressSummary.overall.total) * 100}%` }}
                />
              )}
            </div>
            <span className="text-text-tertiary whitespace-nowrap">
              {progressSummary.overall.completed}/{progressSummary.overall.total}
            </span>
            {progressSummary.epicProgress && (
              <span className="text-text-tertiary whitespace-nowrap">
                · Epic {progressSummary.epicProgress.done}/{progressSummary.epicProgress.total}
              </span>
            )}
          </div>
        )}

        {/* Right-side toggles */}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          {(overview?.nextSteps?.length || 0) > 0 && (
            <ui.Button
              variant="outline"
              color="tertiary"
              size="xs"
              onClick={() => setShowFollowUps(prev => !prev)}
              className="gap-1"
              title={showFollowUps ? 'Hide next steps' : 'Show next steps'}
            >
              <FiChevronDown className={`w-3 h-3 transition-transform ${showFollowUps ? 'rotate-180' : ''}`} />
              Next ({overview.nextSteps.length})
            </ui.Button>
          )}
          <ui.Button
            variant="outline"
            color="primary"
            size="xs"
            onClick={() => executeExtensionAction('execute-skill', 'bmad-help', task?.id, undefined, undefined, true)}
            className="gap-1"
            title="Ask BMAD Help: where you are and what to do next (new task)"
          >
            <FiHelpCircle className="w-3 h-3" />
            Help
          </ui.Button>
          <ui.Button
            variant="outline"
            color="primary"
            size="xs"
            onClick={() => setShowOverview(prev => !prev)}
            className="gap-1"
            title={showOverview ? 'Hide BMAD overview' : 'Show BMAD project overview (progress, phases, next steps)'}
          >
            <FiBarChart2 className={`w-3 h-3 ${showOverview ? 'text-accent-primary' : ''}`} />
            Overview
          </ui.Button>
          <ui.Button
            variant="outline"
            color="tertiary"
            size="xs"
            onClick={toggleCollapsed}
            className="gap-1"
            title="Collapse to one line (keeps the chat free)"
          >
            <FiChevronUp className="w-3 h-3" />
          </ui.Button>
        </div>
      </div>

      {/* BMAD action chips — direct chat input, capped at 4 */}
      {hasBmadActions && (
        <div className="flex flex-wrap gap-2">
          {bmadActions.slice(0, 4).map((action, index) => (
            <ui.Button
              key={`action-${index}`}
              variant="outline"
              color="primary"
              size="xs"
              onClick={() => handlePromptClick(action)}
            >
              [{action.actionLetter}] {action.actionName}
            </ui.Button>
          ))}
          {bmadActions.length > 4 && (
            <span className="text-2xs text-text-tertiary flex items-center">+{bmadActions.length - 4} more</span>
          )}
        </div>
      )}

      {/* Follow-up chips (toggle) */}
      {showFollowUps && renderFollowUpChips()}

      {/* Inline project overview (toggle) */}
      {showOverview && renderOverviewPanel()}
    </div>
  );
}

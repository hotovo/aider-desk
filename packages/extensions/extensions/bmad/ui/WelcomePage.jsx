(props) => {
  const { task, projectDir, api, mode, ui, icons, executeExtensionAction, data } = props;
  const { useState, useEffect, useRef, useMemo } = React;

  const [activeTab, setActiveTab] = useState('full');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [executingWorkflows, setExecutingWorkflows] = useState({});
  const intervalRef = useRef(null);

  const status = data?.status;
  const suggestedWorkflows = data?.suggestedWorkflows || [];
  const isLoading = data?.isLoading;
  const error = data?.error;

  // Get icons from react-icons
  const FiPackage = icons.Fi.FiPackage;
  const FiLayers = icons.Fi.FiLayers;
  const FiZap = icons.Fi.FiZap;
  const FiAlertTriangle = icons.Fi.FiAlertTriangle;
  const FiSearch = icons.Fi.FiSearch;
  const FiClipboard = icons.Fi.FiClipboard;
  const FiCpu = icons.Fi.FiCpu;
  const FiCode = icons.Fi.FiCode;
  const FiFile = icons.Fi.FiFile;
  const FiExternalLink = icons.Fi.FiExternalLink;
  const FiCheck = icons.Fi.FiCheck;
  const FiDownload = icons.Fi.FiDownload;
  const FiFileText = icons.Fi.FiFileText;
  const FiLayout = icons.Fi.FiLayout;
  const FiBox = icons.Fi.FiBox;
  const FiList = icons.Fi.FiList;
  const FiCalendar = icons.Fi.FiCalendar;
  const FiFilePlus = icons.Fi.FiFilePlus;
  const FiEye = icons.Fi.FiEye;
  const FiPlay = icons.Fi.FiPlay;
  const CgSpinner = icons.Cg.CgSpinner;
  const HiCheck = icons.Hi.HiCheck;
  const HiClock = icons.Hi.HiClock;
  const FaChevronDown = icons.Fa.FaChevronDown;
  const RiBrain2Line = icons.Ri.RiBrain2Line;
  const IoPlayCircleOutline = icons.Io5.IoPlayCircleOutline;

  const WORKFLOW_ICONS = {
    brainstorming: RiBrain2Line,
    research: FiSearch,
    'create-product-brief': FiFileText,
    'create-prd': FiClipboard,
    'create-ux-design': FiLayout,
    'create-architecture': FiBox,
    'create-epics-and-stories': FiList,
    'sprint-planning': FiCalendar,
    'create-story': FiFilePlus,
    'dev-story': FiCode,
    'code-review': FiEye,
    'quick-spec': FiZap,
    'quick-dev': FiPlay,
  };

  const PHASE_ICONS = {
    analysis: FiSearch,
    planning: FiClipboard,
    solutioning: FiCpu,
    implementation: FiCode,
    'quick-flow': FiCode,
  };

  const FULL_WORKFLOW_PHASES = ['analysis', 'planning', 'solutioning', 'implementation'];

  // Polling for installation status
  useEffect(() => {
    if (status && !status.installed) {
      intervalRef.current = setInterval(() => {
        executeExtensionAction('refresh-data');
      }, 3000);
    }

    if (status?.installed && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [status, executeExtensionAction]);



  // Group workflows by phase
  const groupedWorkflows = useMemo(() => {
    if (!status?.availableWorkflows) {
      return {};
    }
    return status.availableWorkflows.reduce((acc, workflow) => {
      const phase = workflow.phase;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(workflow);
      return acc;
    }, {});
  }, [status]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await executeExtensionAction('install');
    } finally {
      setInstalling(false);
    }
  };

  const handleResetConfirm = async () => {
    setResetting(true);
    try {
      await executeExtensionAction('reset-workflow');
    } finally {
      setResetting(false);
      setShowResetConfirm(false);
    }
  };

  const handleExecuteWorkflow = async (workflowId) => {
    setExecutingWorkflows(prev => ({ ...prev, [workflowId]: true }));
    try {
      await executeExtensionAction('execute-workflow', workflowId, task?.id);
    } finally {
      setExecutingWorkflows(prev => ({ ...prev, [workflowId]: false }));
    }
  };

  const handleOpenArtifact = async (artifactPath) => {
    if (artifactPath) {
      await executeExtensionAction('open-artifact', artifactPath);
    }
  };



  const getArtifactPath = (workflowId) => {
    return status?.detectedArtifacts?.[workflowId]?.path;
  };

  const getIncompleteWorkflow = (workflowId) => {
    return status?.incompleteWorkflows?.find(w => w.workflowId === workflowId);
  };

  const getFileName = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  const getWorkflowIcon = (workflowId) => {
    return WORKFLOW_ICONS[workflowId] || FiFileText;
  };

  // Render WorkflowActionButton
  const renderWorkflowActionButton = (workflow, isCompleted, isInProgress, isSuggested) => {
    const loading = executingWorkflows[workflow.id] || false;
    const buttonColor = isSuggested && !isCompleted ? 'primary' : 'tertiary';
    const WorkflowIcon = getWorkflowIcon(workflow.id);

    return (
      <ui.Button
        onClick={(e) => {
          e.preventDefault();
          if (!loading) {
            handleExecuteWorkflow(workflow.id);
          }
        }}
        color={buttonColor}
        size="sm"
        disabled={loading}
        className="gap-1"
      >
        {loading && <CgSpinner className="animate-spin w-4 h-4" />}
        {!loading && !isCompleted && !isInProgress && <WorkflowIcon className="w-4 h-4" />}
        {isCompleted && !loading && <HiCheck className="w-4 h-4 text-success-default" />}
        {isInProgress && !loading && <HiClock className="w-4 h-4 text-warning-default" />}
        <span className={isCompleted ? 'line-through' : ''}>
          {loading ? 'Executing...' : workflow.name}
        </span>
        {!loading && !isCompleted && !isInProgress && <IoPlayCircleOutline className="w-3.5 h-3.5 ml-2" />}
      </ui.Button>
    );
  };

  // Render WorkflowItem
  const renderWorkflowItem = (workflow) => {
    const isCompleted = status.completedWorkflows.includes(workflow.id);
    const isInProgress = status.inProgressWorkflows.includes(workflow.id);
    const isSuggested = suggestedWorkflows.includes(workflow.id);
    const artifactPath = getArtifactPath(workflow.id);
    const incompleteWorkflow = getIncompleteWorkflow(workflow.id);

    const getStepInfo = () => {
      if (!incompleteWorkflow) return null;
      const currentStep = incompleteWorkflow.nextStep;
      const totalSteps = workflow.totalSteps;
      if (totalSteps === 0) return null;
      return { currentStep, totalSteps };
    };

    const stepInfo = (isInProgress || isCompleted) ? getStepInfo() : null;

    let borderClass = 'border-border-dark-light';
    if (isCompleted) {
      borderClass = 'border-success-subtle';
    } else if (isInProgress) {
      borderClass = 'border-warning';
    } else if (isSuggested) {
      borderClass = 'border-button-primary';
    }

    return (
      <div key={workflow.id} className={`border rounded-md p-3 transition-colors bg-bg-secondary ${borderClass}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              {renderWorkflowActionButton(workflow, isCompleted, isInProgress, isSuggested)}
              {stepInfo && (
                <span className="text-2xs bg-bg-primary-light px-2 py-0.5 rounded">
                  Step {stepInfo.currentStep}/{stepInfo.totalSteps}
                </span>
              )}
            </div>
            <p className="text-2xs text-text-secondary ml-0.5 mt-1">{workflow.description}</p>

            <div className="flex items-center gap-2 ml-0.5">
              {artifactPath && (
                <button
                  onClick={() => handleOpenArtifact(artifactPath)}
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

  // WorkflowPhaseSection component
  const WorkflowPhaseSection = ({ phase, workflows }) => {
    const completedCount = workflows.filter(w => status.completedWorkflows.includes(w.id)).length;
    const totalCount = workflows.length;
    const defaultOpen = completedCount < totalCount; // Closed if all completed

    const [isOpen, setIsOpen] = useState(defaultOpen);
    const Icon = PHASE_ICONS[phase];
    const isFullyCompleted = completedCount === totalCount && totalCount > 0;

    const phaseNames = {
      analysis: 'Analysis',
      planning: 'Planning',
      solutioning: 'Solutioning',
      implementation: 'Implementation',
    };

    return (
      <div className="border border-border-default rounded-md overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors bg-bg-primary-light hover:bg-bg-tertiary ${
            isOpen ? 'border-b border-border-default' : ''
          }`}
        >
          <FaChevronDown className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
          <Icon className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary capitalize flex-1 text-left">
            {phaseNames[phase] || phase}
          </span>
          <span className={`text-2xs px-2 py-0.5 rounded-full ${
            isFullyCompleted ? 'bg-success-subtle text-success' : 'bg-bg-tertiary text-text-secondary'
          }`}>
            {completedCount}/{totalCount}
          </span>
        </button>

        <div className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="p-3 flex flex-col gap-2 bg-bg-primary">
            {workflows.map(workflow => renderWorkflowItem(workflow))}
          </div>
        </div>
      </div>
    );
  };

  // Render BmadWelcomeSection
  const renderBmadWelcomeSection = () => (
    <div className="flex flex-col items-center mb-6">
      <div className="w-12 h-12 rounded-xl bg-button-primary-subtle flex items-center justify-center mb-4">
        <FiPackage className="w-6 h-6 text-button-primary" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">Welcome to BMAD Mode</h2>
      <p className="text-sm text-text-secondary text-center">Guided workflows for planning, spec'ing, and implementing features</p>
    </div>
  );

  // Render BmadInstallPrompt
  const renderBmadInstallPrompt = () => {
    const installCommand = 'npx -y bmad-method@6.0.4 install';
    const benefits = [
      'Structured approach to software development',
      'Comprehensive documentation at every phase',
      'AI-guided workflows for better results',
      'Iterative refinement with clear milestones',
    ];

    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-lg">
          {renderBmadWelcomeSection()}

          <div className="bg-bg-secondary rounded-lg border border-border-dark-light p-4 mb-4">
            <p className="text-xs text-text-tertiary mb-3 font-medium">Why BMAD?</p>
            <ul className="space-y-2">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <div className="w-4 h-4 rounded-full bg-success-subtle flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="w-2.5 h-2.5 text-success" />
                  </div>
                  <span className="text-xs text-text-secondary">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-center">
              <ui.Button onClick={handleInstall} disabled={installing} size="sm">
                {installing ? (
                  <>
                    <CgSpinner className="w-4 h-4 mr-2 animate-spin" />
                    Installing BMAD Method...
                  </>
                ) : (
                  <>
                    <FiDownload className="w-4 h-4 mr-2" />
                    Install BMAD Method
                  </>
                )}
              </ui.Button>
            </div>

            <p className="text-xs text-text-secondary text-center">
              This will run the installation command in your project directory.
            </p>
          </div>

          <div className="border-t border-border-dark-light pt-4 mt-2">
            <p className="text-xs text-text-tertiary mb-3 font-medium">Manual Installation</p>
            <div className="bg-bg-tertiary rounded-lg border border-border-dark-light p-3">
              <p className="text-xs text-text-tertiary mb-2">Run this command in your terminal:</p>
              <div className="group flex items-center justify-between gap-2 bg-bg-primary rounded-md px-3 py-2">
                <code className="text-xs text-text-primary font-mono">{installCommand}</code>
              </div>
              <p className="text-xs text-text-tertiary mt-2">
                After installation, click refresh to continue.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render PathInfoCard
  const renderPathInfoCard = () => {
    if (activeTab === 'full') {
      return (
        <div className="border rounded-md p-4 bg-bg-primary-light-strong border-border-dark-light">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-bg-tertiary rounded-md">
              <FiLayers className="w-5 h-5 text-text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-text-primary mb-1">Full Workflow</h3>
              <p className="text-xs text-text-secondary leading-relaxed mb-3">
                A comprehensive approach guiding you through analysis, planning, solutioning, and implementation phases with detailed documentation.
              </p>
              <div>
                <p className="text-2xs font-medium text-text-tertiary uppercase mb-1.5">When to use</p>
                <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                    New projects or features
                  </li>
                  <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                    Complex feature development
                  </li>
                  <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                    Unclear requirements
                  </li>
                  <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                    Team collaboration needs
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="border rounded-md p-4 bg-bg-primary-light-strong border-border-dark-light">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-bg-tertiary rounded-md">
            <FiZap className="w-5 h-5 text-text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Quick Flow</h3>
            <p className="text-xs text-text-secondary leading-relaxed mb-3">
              A streamlined workflow for rapid iteration on smaller tasks that don't require full planning cycles.
            </p>
            <div>
              <p className="text-2xs font-medium text-text-tertiary uppercase mb-1.5">When to use</p>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
                <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                  Bug fixes
                </li>
                <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                  Small feature additions
                </li>
                <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                  Code refactoring
                </li>
                <li className="text-2xs text-text-secondary flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent-primary flex-shrink-0" />
                  Well-defined tasks
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Loading State
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <ui.LoadingOverlay message="Loading BMAD..." />
      </div>
    );
  }

  // Render Error State
  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-error text-center">
          {error}
          <button
            onClick={() => executeExtensionAction('refresh-data')}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No status available
  if (!status) {
    return null;
  }

  // Not installed - show install prompt
  if (!status.installed) {
    return renderBmadInstallPrompt();
  }

  // Installed - show workflows
  const hasWorkflowProgress = (status.completedWorkflows?.length > 0) || (status.inProgressWorkflows?.length > 0);

  const renderFullWorkflow = () => {
    return (
      <div className="flex flex-col gap-4">
        {FULL_WORKFLOW_PHASES.map(phase => {
          const workflows = groupedWorkflows[phase];
          if (!workflows || workflows.length === 0) {
            return null;
          }
          return <WorkflowPhaseSection key={phase} phase={phase} workflows={workflows} />;
        })}
      </div>
    );
  };

  const renderQuickFlow = () => {
    const quickWorkflows = groupedWorkflows['quick-flow'];
    if (!quickWorkflows || quickWorkflows.length === 0) {
      return (
        <div className="text-center p-4">
          <p className="text-sm text-text-secondary">No workflows available.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {quickWorkflows.map(workflow => renderWorkflowItem(workflow))}
      </div>
    );
  };

  const renderResetBanner = () => {
    if (!hasWorkflowProgress) {
      return null;
    }

    return (
      <div className="bg-warning-subtle border border-warning-emphasis rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <FiAlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-warning-light mb-1">Reset Workflow State</h3>
            <p className="text-xs text-text-secondary mb-3">
              This will delete all workflow artifacts in _bmad-output folder.
            </p>
            <ui.Button
              onClick={() => setShowResetConfirm(true)}
              disabled={resetting}
              size="sm"
              color="danger"
            >
              {resetting ? 'Resetting...' : 'Reset'}
            </ui.Button>
          </div>
        </div>
      </div>
    );
  };

  const renderTabs = () => (
    <div className="flex bg-bg-secondary-light rounded-md p-1 mb-4">
      <button
        onClick={() => setActiveTab('full')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200 ${
          activeTab === 'full'
            ? 'bg-bg-fourth text-text-primary font-medium'
            : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary'
        }`}
      >
        <FiLayers className="w-4 h-4" />
        Full Workflow
      </button>
      <button
        onClick={() => setActiveTab('quick')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200 ${
          activeTab === 'quick'
            ? 'bg-bg-fourth text-text-primary font-medium'
            : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary'
        }`}
      >
        <FiZap className="w-4 h-4" />
        Quick Flow
      </button>
    </div>
  );

  const renderConfirmDialog = () => {
    if (!showResetConfirm) {
      return null;
    }

    return (
      <ui.ConfirmDialog
        title="Reset Workflow State?"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetConfirm(false)}
        confirmButtonText="Reset"
        confirmButtonColor="danger"
        disabled={resetting}
      >
        <p className="text-sm text-text-secondary">
          This will permanently delete all files in the _bmad-output folder. This action cannot be undone.
        </p>
      </ui.ConfirmDialog>
    );
  };

  return (
    <div className="absolute inset-0 flex flex-col overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      <div className="w-full max-w-3xl mx-auto p-6">
        <div className="flex flex-col gap-4">
          {renderBmadWelcomeSection()}

          <div className="text-xs text-text-tertiary">
            BMAD Library installed (v{status.version || 'Unknown'})
          </div>

          {renderTabs()}

          {renderPathInfoCard()}

          {activeTab === 'full' ? renderFullWorkflow() : renderQuickFlow()}

          {renderResetBanner()}
        </div>
      </div>

      {renderConfirmDialog()}
    </div>
  );
}

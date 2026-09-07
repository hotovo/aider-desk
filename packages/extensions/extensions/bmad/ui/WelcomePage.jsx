(props) => {
  const { task, projectDir, api, mode, ui, icons, executeExtensionAction, data } = props;
  const { useState, useEffect, useRef, useMemo } = React;

  // ---- State ----
  const [activeTab, setActiveTab] = useState('workflows');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState(null);
  const [executingWorkflows, setExecutingWorkflows] = useState({});
  const [executingSkills, setExecutingSkills] = useState({});
  // Workflow that waits for the 1-click start confirmation (null = none).
  // Resumes start immediately without confirmation.
  const [confirmStartWorkflow, setConfirmStartWorkflow] = useState(null);
  const [openPhases, setOpenPhases] = useState({});
  const [workflowSearch, setWorkflowSearch] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  // v1.12: optional follow-ups section (collapsed by default so the page
  // stays focused on the recommended path)
  const [showOptionalFollowUps, setShowOptionalFollowUps] = useState(false);
  const intervalRef = useRef(null);

  // ---- Data ----
  const status = data?.status;
  const suggestedWorkflows = data?.suggestedWorkflows || [];
  const installedSkills = data?.installedSkills || [];
  const installPackage = data?.installPackage || 'bmad-method@6.10.0';
  const expectedVersion = data?.expectedVersion;
  const uvAvailable = data?.uvAvailable;
  const isLoading = data?.isLoading;
  const error = data?.error;
  const progressSummary = data?.progressSummary;
  // v1.12: beginner guidance payload (computed in index.ts getUIExtensionData)
  const phaseSteps = data?.phaseSteps || [];
  const overview = data?.overview || { nextSteps: [], optionalFollowUps: [], hasActiveWorkflow: false };

  // ---- Icons ----
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
  const FiPlay = icons.Fi.FiPlay;
  const FiBarChart2 = icons.Fi.FiBarChart2;
  const FiRefreshCw = icons.Fi.FiRefreshCw;
  const FiArrowRight = icons.Fi.FiArrowRight;
  const FiChevronRight = icons.Fi.FiChevronRight;
  const FiHelpCircle = icons.Fi.FiHelpCircle;
  const FiMessageCircle = icons.Fi.FiMessageCircle;
  const CgSpinner = icons.Cg.CgSpinner;
  const HiCheck = icons.Hi.HiCheck;
  const HiClock = icons.Hi.HiClock;
  const FaChevronDown = icons.Fa.FaChevronDown;
  const IoPlayCircleOutline = icons.Io5.IoPlayCircleOutline;
  const SparkleIcon = (icons.Ri && (icons.Ri.RiSparkling2Line || icons.Ri.RiLightbulbLine)) || FiZap;

  // Phase groups come from the installed method itself (module-help.csv):
  // ordered original phase labels provided by the backend (data.phases).
  // Unknown phases get a generic icon and their label capitalized.
  const phases = data?.phases || [];
  const PHASE_NAMES = Object.fromEntries(phases.map(p => [p.phase, p.phaseName]));
  const PHASE_ORDER = phases.map(p => p.phase);
  const PHASE_ICONS = {
    plan: FiSearch,
    '2-planning': FiClipboard,
    ship: FiCode,
    anytime: FiZap,
  };

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

  // v1.12: live project status — refresh every 15s whenever BMAD is
  // installed so the compass reflects the current project state even when
  // workflows finish outside the UI (direct agent prompting). Cheap for the
  // backend thanks to the status cache and single artifact scan.
  useEffect(() => {
    if (!status?.installed) {
      return undefined;
    }

    const liveInterval = setInterval(() => {
      executeExtensionAction('refresh-data');
    }, 15000);

    return () => clearInterval(liveInterval);
  }, [status?.installed, executeExtensionAction]);

  // Group workflows by phase
  const groupedWorkflows = useMemo(() => {
    if (!status?.catalog) {
      return {};
    }
    return status.catalog.reduce((acc, workflow) => {
      const phase = workflow.phase;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(workflow);
      return acc;
    }, {});
  }, [status]);

  // ---- Handlers ----
  const handleInstall = async () => {
    setInstalling(true);
    setInstallError(null);
    try {
      const result = await executeExtensionAction('install');
      if (result && !result.success) {
        setInstallError(result.error || 'Installation failed');
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : String(err));
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

  const handleExecuteSkill = async (skillId) => {
    setExecutingSkills(prev => ({ ...prev, [skillId]: true }));
    try {
      await executeExtensionAction('execute-skill', skillId, task?.id);
    } finally {
      setExecutingSkills(prev => ({ ...prev, [skillId]: false }));
    }
  };

  // bmad-help is the orchestrator: start it in a fresh subtask so its
  // state snapshot and guidance get a clean context window (the skill itself
  // recommends fresh contexts).
  const handleStartHelp = async () => {
    setExecutingSkills(prev => ({ ...prev, 'bmad-help': true }));
    try {
      await executeExtensionAction('execute-skill', 'bmad-help', task?.id, undefined, undefined, true);
    } finally {
      setExecutingSkills(prev => ({ ...prev, 'bmad-help': false }));
    }
  };

  const handleOpenArtifact = async (artifactPath) => {
    if (artifactPath) {
      await executeExtensionAction('open-artifact', artifactPath);
    }
  };

  const handleOpenSkillFile = async (skillId) => {
    await executeExtensionAction('open-skill-file', skillId);
  };

  // Start with confirmation for fresh runs; resumes start immediately.
  const confirmAndStart = (workflow) => {
    const isInProgress = status?.inProgressWorkflows?.includes(workflow.id);
    if (isInProgress) {
      handleExecuteWorkflow(workflow.id);
    } else {
      setConfirmStartWorkflow(workflow);
    }
  };

  // ---- Helpers ----
  const getWorkflowIcon = (workflow, phase) => {
    const Icon = PHASE_ICONS[phase || workflow?.phase];
    if (Icon) {
      return Icon;
    }
    return FiLayers;
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

  const togglePhase = (phase) => {
    setOpenPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  // ---- Shared inline helpers ----
  // AiderDesk evaluates extension JSX as a single self-contained expression
  // (no imports across files), so shared presentational patterns live as
  // local components here instead of a separate module.
  const SearchInput = ({ value, onChange, placeholder }) => (
    <div className="relative">
      <FiSearch className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-secondary border border-border-dark-light rounded-md pl-9 pr-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
      />
    </div>
  );

  const ArtifactLink = ({ target, label, onOpen }) => (
    <button
      onClick={() => onOpen(target)}
      className="flex items-center gap-1.5 text-2xs text-accent-primary hover:text-accent-secondary transition-colors group"
    >
      <FiFile className="w-3 h-3" />
      <span className="underline decoration-dotted underline-offset-2">{label || getFileName(target)}</span>
      <FiExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );

  const EmptyState = ({ text }) => (
    <div className="text-center p-4">
      <p className="text-sm text-text-secondary">{text}</p>
    </div>
  );

  // ---- Render: Welcome header ----
  const renderBmadWelcomeSection = () => (
    <div className="flex flex-col items-center mb-6">
      <div className="w-12 h-12 rounded-xl bg-button-primary-subtle flex items-center justify-center mb-4">
        <FiPackage className="w-6 h-6 text-button-primary" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">Welcome to BMAD Mode</h2>
      <p className="text-sm text-text-secondary text-center">Guided workflows for planning, spec'ing, and implementing features</p>
    </div>
  );

  // ---- Render: Pinned bmad-help orchestrator ----
  // bmad-help is the orchestrator and human helper, not project work: it is
  // pinned directly under the header (always visible, above tabs and lists)
  // instead of being buried in the collapsed Helpers accordion.
  const renderHelpOrchestrator = () => {
    if (!status?.installed) {
      return null;
    }
    const loading = executingSkills['bmad-help'] || false;

    return (
      <div className="border border-accent-primary/40 rounded-lg bg-bg-secondary overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-9 h-9 rounded-lg bg-accent-primary/15 flex items-center justify-center flex-shrink-0">
            <FiMessageCircle className="w-4 h-4 text-accent-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-text-primary">BMAD Help</span>
              <span className="text-2xs px-1.5 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary normal-case tracking-normal">
                orchestrator
              </span>
            </div>
            <p className="text-2xs text-text-secondary mt-0.5">
              Not sure what's next? Ask where you are, what's already done, and what to do next - the helper checks your project state automatically.
            </p>
          </div>
          <ui.Button
            onClick={handleStartHelp}
            color="primary"
            size="sm"
            disabled={loading}
            className="gap-1.5 flex-shrink-0"
            title="Start BMAD Help in a new task"
          >
            {loading ? <CgSpinner className="animate-spin w-4 h-4" /> : <FiMessageCircle className="w-4 h-4" />}
            {loading ? 'Starting...' : 'Ask BMAD Help'}
          </ui.Button>
        </div>
      </div>
    );
  };

  // ---- Render: Install prompt ----
  const renderBmadInstallPrompt = () => {
    const installCommand = `npx -y ${installPackage} install --modules bmm --tools amp`;
    const benefits = [
      'Structured approach to software development',
      'Comprehensive documentation at every phase',
      'AI-guided workflows for better results',
      'Iterative refinement with clear milestones',
    ];

    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-full max-w-3xl">
          {renderBmadWelcomeSection()}

          <div className="bg-bg-secondary rounded-lg border border-border-dark-light p-4 mb-4">
            <p className="text-xs text-text-tertiary mb-3 font-medium">Why BMAD?</p>
            <ul className="space-y-2">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-success-subtle flex items-center justify-center flex-shrink-0 mt-0.5">
                    <FiCheck className="w-2.5 h-2.5 text-success" />
                  </div>
                  <span className="text-xs text-text-secondary ml-0.5">{benefit}</span>
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

            <div className="flex items-center justify-center gap-1.5 text-xs text-text-tertiary">
              <FiAlertTriangle className="w-3.5 h-3.5" />
              <span>Prerequisites: <span className="font-medium text-text-secondary">Node.js v20.12+</span> (Python/uv recommended for some workflows)</span>
            </div>

            {uvAvailable === false && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-warning">
                <FiAlertTriangle className="w-3.5 h-3.5" />
                <span>uv not found — skill helper scripts will use documented fallbacks</span>
              </div>
            )}

            {installError && (
              <div className="flex items-start gap-2 bg-error-subtle border border-error-emphasis rounded-lg p-3">
                <FiAlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <p className="text-xs text-error">{installError}</p>
              </div>
            )}
          </div>

          <div className="border-t border-border-dark-light pt-4 mt-2">
            <p className="text-xs text-text-tertiary mb-3 font-medium">Manual Installation</p>
            <div className="bg-bg-tertiary rounded-lg border border-border-dark-light p-3">
              <p className="text-xs text-text-tertiary mb-2">Run this command in your terminal:</p>
              <div className="group flex items-center justify-between gap-2 bg-bg-primary rounded-md px-3 py-2">
                <code className="text-xs text-text-primary font-mono">{installCommand}</code>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-text-tertiary">
                  After installation, click refresh to continue.
                </p>
                <ui.Button
                  onClick={() => executeExtensionAction('refresh-data')}
                  size="sm"
                  color="tertiary"
                  className="gap-1.5"
                >
                  <FiRefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </ui.Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- Render: Project compass (v2) ----
  // One instrument panel: overall progress, per-phase bars, the "you are
  // here" phase stepper and epic status merged into a single card, so the
  // project's position on the method's route reads at a glance.
  const renderCompass = () => {
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

    // Active badge priority: 1) the workflow the user actually started for
    // this task (metadata), 2) the artifact-newest in-progress entry when the
    // scan sees running work without a task link (e.g. stale draft status).
    let activeWorkflow = null;
    if (overview?.activeWorkflowName) {
      activeWorkflow = { name: overview.activeWorkflowName };
    } else if ((status?.inProgressWorkflows || []).length > 0) {
      const modifiedAt = new Map(
        (status.incompleteWorkflows || []).map(w => [w.workflowId, new Date(w.lastModified ?? 0).getTime()]),
      );
      let best = null;
      for (const w of status.catalog || []) {
        if (!status.inProgressWorkflows.includes(w.id)) continue;
        const t = modifiedAt.get(w.id) || 0;
        if (!best || t > best.t) best = { name: w.name, t };
      }
      activeWorkflow = best;
    }

    const phaseColors = {
      plan: 'bg-accent-primary',
      '2-planning': 'bg-button-primary',
      ship: 'bg-success',
      anytime: 'bg-accent-secondary',
    };

    return (
      <div className="border border-border-default rounded-lg bg-bg-secondary overflow-hidden">
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 pt-3">
          <div className="flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4 text-accent-primary flex-shrink-0" />
            <span className="text-sm font-medium text-text-primary">Project compass</span>
            {activeWorkflow && (
              <span className="flex items-center gap-1 text-2xs text-warning whitespace-nowrap min-w-0">
                <HiClock className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">active: {activeWorkflow.name}</span>
              </span>
            )}
          </div>
          <span className="text-xs font-semibold text-text-primary whitespace-nowrap">
            {ps.overall.completed}/{ps.overall.total} done · {ps.overall.percentage}%
          </span>
        </div>

        {/* Overall bar — rendered even at 0% so the dashboard never disappears */}
        <div className="w-full h-2.5 rounded-full bg-bg-tertiary overflow-hidden flex" title={`completed: ${ps.overall.completed}, in progress: ${ps.overall.inProgress}, open: ${openCount}`}>
          {segments.map((seg, i) => (
            <div
              key={seg.label}
              className={`${seg.color} h-full ${i > 0 ? 'border-l border-bg-primary' : ''}`}
              style={{ width: `${(seg.count / Math.max(1, ps.overall.total)) * 100}%` }}
            />
          ))}
        </div>

        {/* Per-phase bars */}
        {ps.phases.length > 0 && (
          <div className="flex flex-col gap-2">
            {ps.phases.map(phase => (
              <div key={phase.phase} className="flex items-center gap-3">
                <span className="w-28 text-2xs text-text-secondary flex-shrink-0 capitalize">{phase.phaseName}</span>
                <div className="flex-1 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className={`${phaseColors[phase.phase] || 'bg-accent-primary'} h-full rounded-full transition-all duration-500`}
                    style={{ width: `${phase.percentage}%` }}
                    title={`${phase.completed}/${phase.total} done`}
                  />
                </div>
                <span className="w-12 text-2xs text-text-tertiary text-right flex-shrink-0">
                  {phase.completed}/{phase.total}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Epic / sprint progress */}
        {ps.epicProgress && (
          <div className="flex items-center gap-2 text-2xs text-text-secondary px-4 pb-3">
            <FiCheck className="w-3 h-3 text-success flex-shrink-0" />
            <span>
              Epic: <span className="text-text-primary font-medium">{ps.epicProgress.done}/{ps.epicProgress.total}</span> stories done
              ({ps.epicProgress.percentage}%)
            </span>
          </div>
        )}

        {/* Phase stepper: the method's route with "you are here" */}
        {phaseSteps.length > 0 && (
          <div className="border-t border-border-dark-light px-4 py-3 flex items-center gap-1 flex-wrap">
            {phaseSteps.map((step, index) => (
              <div key={step.phase} className="flex items-center gap-1 min-w-0">
                {index > 0 && <FiChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />}
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md min-w-0 ${
                    step.status === 'current' ? 'bg-button-primary/10' : ''
                  }`}
                  title={`${step.phaseName}: ${step.completed}/${step.total} done${step.inProgress > 0 ? `, ${step.inProgress} in progress` : ''}`}
                >
                  {step.status === 'done' ? (
                    <span className="w-5 h-5 rounded-full bg-success-subtle flex items-center justify-center flex-shrink-0">
                      <FiCheck className="w-3 h-3 text-success" />
                    </span>
                  ) : step.status === 'current' ? (
                    <span className="w-5 h-5 rounded-full bg-button-primary flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-bg-primary">
                      {step.completed + 1}
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-bg-tertiary flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-text-tertiary">
                      {step.completed + 1}
                    </span>
                  )}
                  <span className={`text-2xs whitespace-nowrap ${
                    step.status === 'current' ? 'text-text-primary font-medium' : step.status === 'done' ? 'text-text-secondary' : 'text-text-tertiary'
                  }`}>
                    {step.phaseName}
                    {step.status === 'current' && <span className="ml-1 text-accent-primary">· you are here</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---- Render: Next steps (v1.12) ----
  // Up to 3 recommended steps with a reason badge, prereq warning and a
  // one-click start — the beginner's call to action.
  const renderNextSteps = () => {
    const steps = overview?.nextSteps || [];
    if (steps.length === 0) {
      return null;
    }

    const reasonBadge = (reason) => {
      if (reason === 'recommended') {
        return (
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-button-primary/15 text-button-primary normal-case tracking-normal">
            recommended
          </span>
        );
      }
      if (reason === 'follow-up') {
        return (
          <span className="text-2xs px-1.5 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary normal-case tracking-normal">
            follow-up
          </span>
        );
      }
      return (
        <span className="text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary normal-case tracking-normal">
          optional
        </span>
      );
    };

    // The FIRST recommended step is the hero: the single next thing to do
    // gets the dominant card with phase context; the rest stay compact rows.
    const phaseChip = (step) => {
      const workflow = status?.catalog?.find(w => w.id === step.workflowId);
      if (!workflow?.phase) {
        return null;
      }
      return (
        <span className="text-2xs px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-tertiary normal-case tracking-normal">
          {PHASE_NAMES[workflow.phase] || workflow.phase}
        </span>
      );
    };

    const renderHeroStep = (step) => {
      const loading = executingWorkflows[step.workflowId] || false;
      const workflow = status?.catalog?.find(w => w.id === step.workflowId);
      const WorkflowIcon = getWorkflowIcon(workflow);
      const artifactPath = getArtifactPath(step.workflowId);

      return (
        <div key={step.workflowId} className="border border-accent-primary/40 rounded-lg bg-bg-secondary overflow-hidden">
          <div className="flex items-start gap-3 p-4 border-l-2 border-accent-primary">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <WorkflowIcon className="w-4 h-4 text-accent-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-text-primary">{step.name}</h3>
                {reasonBadge(step.reason)}
                {phaseChip(step)}
              </div>
              {step.description && (
                <p className="text-2xs text-text-secondary mt-1">{step.description}</p>
              )}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {!step.prereqMet && (
                  <span className="flex items-center gap-1 text-2xs text-warning" title="Required artifacts are missing - run the previous step first">
                    <FiAlertTriangle className="w-3 h-3 flex-shrink-0" />
                    prerequisites missing
                  </span>
                )}
                {artifactPath && (
                  <ArtifactLink target={artifactPath} onOpen={handleOpenArtifact} />
                )}
              </div>
            </div>
            <ui.Button
              onClick={(e) => {
                e.preventDefault();
                if (!loading && workflow) {
                  confirmAndStart(workflow);
                }
              }}
              color="primary"
              size="sm"
              disabled={loading || !workflow}
              className="gap-1.5 flex-shrink-0"
              title={!step.prereqMet ? 'Start anyway (recommended: finish prerequisites first)' : 'Start this workflow'}
            >
              {loading ? <CgSpinner className="animate-spin w-4 h-4" /> : <FiArrowRight className="w-4 h-4" />}
              {loading ? 'Starting...' : 'Start'}
            </ui.Button>
          </div>
        </div>
      );
    };

    const renderCompactStep = (step) => {
      const loading = executingWorkflows[step.workflowId] || false;
      const workflow = status?.catalog?.find(w => w.id === step.workflowId);
      const WorkflowIcon = getWorkflowIcon(workflow);
      const artifactPath = getArtifactPath(step.workflowId);

      return (
        <div key={step.workflowId} className="border rounded-md px-3 py-2 bg-bg-secondary border-border-dark-light flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <WorkflowIcon className="w-3.5 h-3.5 text-text-secondary flex-shrink-0" />
              <h4 className="text-xs font-medium text-text-primary">{step.name}</h4>
              {reasonBadge(step.reason)}
            </div>
            {!step.prereqMet && (
              <span className="flex items-center gap-1 text-2xs text-warning mt-0.5" title="Required artifacts are missing - run the previous step first">
                <FiAlertTriangle className="w-3 h-3 flex-shrink-0" />
                prerequisites missing
              </span>
            )}
          </div>
          <ui.Button
            onClick={(e) => {
              e.preventDefault();
              if (!loading && workflow) {
                confirmAndStart(workflow);
              }
            }}
            color="tertiary"
            size="xs"
            disabled={loading || !workflow}
            className="gap-1 flex-shrink-0"
            title={!step.prereqMet ? 'Start anyway (recommended: finish prerequisites first)' : 'Start this workflow'}
          >
            {loading ? <CgSpinner className="animate-spin w-3 h-3" /> : <FiArrowRight className="w-3 h-3" />}
            {loading ? 'Starting...' : 'Start'}
          </ui.Button>
        </div>
      );
    };

    const [hero, ...rest] = steps;

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-2xs font-medium text-accent-primary uppercase tracking-wide px-1">
          <SparkleIcon className="w-3.5 h-3.5" />
          <span>Next recommended steps</span>
        </div>
        {hero && renderHeroStep(hero)}
        {rest.map(step => renderCompactStep(step))}
      </div>
    );
  };

  // ---- Render: Optional follow-ups (v1.12) ----
  // Extra steps of completed workflows — clearly optional, collapsed by
  // default so they never dominate the recommended path.
  const renderOptionalFollowUps = () => {
    const steps = overview?.optionalFollowUps || [];
    if (steps.length === 0) {
      return null;
    }

    return (
      <div className="border border-border-dark-light rounded-md overflow-hidden">
        <button
          onClick={() => setShowOptionalFollowUps(prev => !prev)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors bg-bg-secondary hover:bg-bg-tertiary ${
            showOptionalFollowUps ? 'border-b border-border-dark-light' : ''
          }`}
        >
          <FiChevronRight className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${showOptionalFollowUps ? 'rotate-90' : ''}`} />
          <span className="text-2xs font-medium text-text-tertiary uppercase tracking-wide">Optional steps</span>
          <span className="text-2xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary">{steps.length}</span>
          <span className="text-2xs text-text-tertiary ml-auto">extra work, not required</span>
        </button>
        {showOptionalFollowUps && (
          <div className="flex flex-col gap-2 p-3 bg-bg-primary">
            {steps.map(step => {
              const loading = executingWorkflows[step.workflowId] || false;
              const workflow = status?.catalog?.find(w => w.id === step.workflowId);
              const WorkflowIcon = getWorkflowIcon(workflow);

              return (
                <div key={step.workflowId} className="border border-border-dark-light rounded-md p-3 bg-bg-secondary flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 flex items-start gap-2">
                    <WorkflowIcon className="w-4 h-4 text-text-secondary flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-medium text-text-primary">{step.name}</h4>
                      {step.description && (
                        <p className="text-2xs text-text-secondary mt-0.5">{step.description}</p>
                      )}
                    </div>
                  </div>
                  <ui.Button
                    onClick={(e) => {
                      e.preventDefault();
                      if (!loading && workflow) {
                        confirmAndStart(workflow);
                      }
                    }}
                    color="tertiary"
                    size="xs"
                    disabled={loading || !workflow}
                    className="gap-1 flex-shrink-0"
                  >
                    {loading ? <CgSpinner className="animate-spin w-3 h-3" /> : <FiPlay className="w-3 h-3" />}
                    {loading ? 'Starting...' : 'Start'}
                  </ui.Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };



  // ---- Render: Tabs ----
  const renderTabs = () => (
    <div className="flex bg-bg-secondary-light rounded-md p-1 mb-1">
      <button
        onClick={() => setActiveTab('workflows')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200 ${
          activeTab === 'workflows'
            ? 'bg-bg-fourth text-text-primary font-medium'
            : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary'
        }`}
      >
        <FiLayers className="w-4 h-4" />
        Workflows
      </button>
      <button
        onClick={() => setActiveTab('skills')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm rounded transition-colors duration-200 ${
          activeTab === 'skills'
            ? 'bg-bg-fourth text-text-primary font-medium'
            : 'text-text-muted-light hover:text-text-secondary hover:bg-bg-tertiary'
        }`}
      >
        <FiCpu className="w-4 h-4" />
        All Skills
      </button>
    </div>
  );

  // ---- Render: Workflow action button ----
  const renderWorkflowActionButton = (workflow, isCompleted, isInProgress, isSuggested, compact) => {
    const loading = executingWorkflows[workflow.id] || false;
    const WorkflowIcon = getWorkflowIcon(workflow);
    const incompleteWorkflow = getIncompleteWorkflow(workflow.id);
    const nextStep = incompleteWorkflow?.nextStep;

    return (
      <ui.Button
        onClick={(e) => {
          e.preventDefault();
          if (!loading) {
            confirmAndStart(workflow);
          }
        }}
        color={isSuggested && !isCompleted && !isInProgress ? 'primary' : 'tertiary'}
        size={compact ? 'xs' : 'sm'}
        disabled={loading}
        className="gap-1"
        title={isInProgress ? `Resume — step ${nextStep ?? '?'}` : isCompleted ? 'Restart workflow' : undefined}
      >
        {loading && <CgSpinner className="animate-spin w-4 h-4" />}
        {!loading && !isCompleted && !isInProgress && <WorkflowIcon className="w-4 h-4" />}
        {isCompleted && !loading && <HiCheck className="w-4 h-4 text-success-default" />}
        {isInProgress && !loading && <HiClock className="w-4 h-4 text-warning-default" />}
        <span className={isCompleted ? 'line-through' : ''}>
          {loading ? 'Executing...' : isInProgress ? 'Continue' : workflow.name}
        </span>
        {!loading && !isCompleted && !isInProgress && <IoPlayCircleOutline className="w-3.5 h-3.5 ml-2" />}
        {!loading && isInProgress && workflow.totalSteps > 0 && incompleteWorkflow && (
          <span className="text-2xs bg-bg-primary-light px-1.5 py-0.5 rounded">step {nextStep}</span>
        )}
      </ui.Button>
    );
  };

  // ---- Render: Workflow item ----
  const renderWorkflowItem = (workflow, compact) => {
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
      borderClass = 'border-button-primary/50';
    }

    return (
      <div key={workflow.id} className={`border rounded-md p-3 transition-colors bg-bg-secondary ${borderClass}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
              {renderWorkflowActionButton(workflow, isCompleted, isInProgress, isSuggested, compact)}
              {stepInfo && (
                <span className="text-2xs bg-bg-primary-light px-2 py-0.5 rounded">
                  Step {stepInfo.currentStep}/{stepInfo.totalSteps}
                </span>
              )}
            </div>
            <p className="text-2xs text-text-secondary ml-0.5 mt-1">{workflow.description}</p>

            <div className="flex items-center gap-2 ml-0.5 flex-wrap">
              {workflow.__modules && workflow.__modules.length > 1 && (
                <span
                  className="text-2xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-tertiary"
                  title={`Same skill listed by multiple modules: ${workflow.__modules.join(', ')}`}
                >
                  {workflow.__modules.join(' · ')}
                </span>
              )}
              {artifactPath && (
                <ArtifactLink target={artifactPath} onOpen={handleOpenArtifact} />
              )}
              {isCompleted && (
                <button
                  onClick={() => handleExecuteWorkflow(workflow.id)}
                  className="text-2xs text-text-tertiary underline decoration-dotted underline-offset-2 hover:text-text-secondary transition-colors"
                >
                  Restart workflow
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ---- Render: Phase section (controlled — isOpen/onToggle lifted up) ----
  const WorkflowPhaseSection = ({ phase, workflows, isOpen, onToggle, compact, isCurrent }) => {
    const completedCount = workflows.filter(w => status.completedWorkflows.includes(w.id)).length;
    const totalCount = workflows.length;
    const Icon = PHASE_ICONS[phase] || FiLayers;
    const isFullyCompleted = completedCount === totalCount && totalCount > 0;

    return (
      <div className={`border rounded-md overflow-hidden ${isCurrent ? 'border-accent-primary/40' : 'border-border-default'}`}>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg-tertiary ${
            isCurrent ? 'bg-accent-primary/5' : 'bg-bg-primary-light'
          } ${isOpen ? 'border-b border-border-default' : ''}`}
        >
          <FaChevronDown className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
          <Icon className={`w-4 h-4 flex-shrink-0 ${isCurrent ? 'text-accent-primary' : 'text-text-secondary'}`} />
          <span className="text-sm font-medium text-text-primary capitalize flex-1 text-left">
            {PHASE_NAMES[phase] || phase}
          </span>
          {isCurrent && (
            <span className="text-2xs px-1.5 py-0.5 rounded-full bg-button-primary/15 text-button-primary normal-case tracking-normal whitespace-nowrap">
              you are here
            </span>
          )}
          <span className={`text-2xs px-2 py-0.5 rounded-full ${
            isFullyCompleted ? 'bg-success-subtle text-success' : 'bg-bg-tertiary text-text-secondary'
          }`}>
            {completedCount}/{totalCount}
          </span>
        </button>

        <div className={`transition-all duration-200 overflow-hidden ${
          isOpen ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className={`flex flex-col gap-2 bg-bg-primary ${compact ? 'p-2' : 'p-3'}`}>
            {workflows.map(workflow => renderWorkflowItem(workflow, compact))}
          </div>
        </div>
      </div>
    );
  };

  // ---- Render: Workflow list (search + phase sections + quick flow) ----
  const renderWorkflowList = () => {
    const allWorkflows = status?.catalog || [];
    const query = workflowSearch.trim().toLowerCase();
    const visible = query
      ? allWorkflows.filter(w => `${w.name} ${w.description ?? ''} ${w.id} ${w.menuCode ?? ''}`.toLowerCase().includes(query))
      : allWorkflows;

    if (allWorkflows.length === 0) {
      return <EmptyState text="No workflows available." />;
    }

    if (visible.length === 0) {
      return <EmptyState text={`No workflows match "${workflowSearch}".`} />;
    }

    // Helpers (no artifact metadata) leave the workflow phases entirely;
    // duplicate menu rows of one skill across modules merge into one card.
    // bmad-help is excluded here: it is pinned at the top as the
    // orchestrator (renderHelpOrchestrator) and must not appear twice.
    const utilities = visible.filter(w => w.id !== 'bmad-help' && !w.outputLocation && !(w.outputs && w.outputs.length > 0));
    const workItems = visible.filter(w => !utilities.includes(w));
    const mergedById = new Map();
    for (const workflow of workItems) {
      const existing = mergedById.get(workflow.skillId);
      if (existing) {
        if (!existing.__modules.includes(workflow.module)) {
          existing.__modules.push(workflow.module);
        }
      } else {
        mergedById.set(workflow.skillId, { ...workflow, __modules: [workflow.module] });
      }
    }
    const mergedWorkflows = [...mergedById.values()];

    const grouped = mergedWorkflows.reduce((acc, workflow) => {
      const phase = workflow.phase;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(workflow);
      return acc;
    }, {});

    // Phases not known to the backend (future modules) append after the
    // ordered ones so they are never dropped.
    const phaseOrder = [
      ...PHASE_ORDER,
      ...Object.keys(grouped).filter(phase => !PHASE_ORDER.includes(phase)),
    ];

    // Keep focus on where the project actually is: only the current phase
    // (stepper's "you are here") and phases with running work start open —
    // everything else is one click away but does not flood the page.
    const currentPhase = phaseSteps.find(step => step.status === 'current')?.phase;
    const phaseHasActiveWork = (workflows) =>
      workflows.some(w => status.inProgressWorkflows.includes(w.id));
    const searching = workflowSearch.trim().length > 0;

    return (
      <div className="flex flex-col gap-4">
        <SearchInput
          value={workflowSearch}
          onChange={setWorkflowSearch}
          placeholder={`Search ${allWorkflows.length} workflows...`}
        />
        {renderUntrackedNote()}
        {phaseOrder
          .filter(phase => grouped[phase] && grouped[phase].length > 0)
          .map(phase => (
            <WorkflowPhaseSection
              key={phase}
              phase={phase}
              workflows={grouped[phase]}
              isOpen={
                searching
                  ? true
                  : openPhases[phase] !== undefined
                    ? openPhases[phase]
                    : phase === currentPhase || phaseHasActiveWork(grouped[phase])
              }
              onToggle={() => togglePhase(phase)}
              compact={false}
              isCurrent={phase === currentPhase}
            />
          ))}
        {renderUtilitySkills(utilities)}
      </div>
    );
  };

  // ---- Render: Untracked note ----
  // Entries whose artifacts cannot be located generically would silently
  // never count toward progress — say so instead of leaving the user guessing.
  const UNTRACK_REASONS = {
    'no-output-location': 'output location not defined by the method',
    'no-outputs': 'artifact type not defined by the method',
    'unresolvable-location': 'output location uses unknown placeholders',
  };
  const [showUntracked, setShowUntracked] = useState(false);
  const renderUntrackedNote = () => {
    const untracked = status.untrackedWorkflows || [];
    if (untracked.length === 0) {
      return null;
    }

    return (
      <div className="border border-border-dark-light rounded-md overflow-hidden">
        <button
          onClick={() => setShowUntracked(prev => !prev)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors bg-bg-secondary hover:bg-bg-tertiary ${showUntracked ? 'border-b border-border-dark-light' : ''}`}
        >
          <FiChevronRight className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${showUntracked ? 'rotate-90' : ''}`} />
          <FiHelpCircle className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
          <span className="text-2xs font-medium text-text-tertiary uppercase tracking-wide">Not counted in progress</span>
          <span className="text-2xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary">{untracked.length}</span>
        </button>
        {showUntracked && (
          <div className="flex flex-col gap-1 p-3 bg-bg-primary">
            {untracked.map(item => (
              <div key={item.id} className="text-2xs text-text-secondary flex items-start gap-2">
                <FiAlertTriangle className="w-3 h-3 text-text-tertiary flex-shrink-0 mt-0.5" />
                <span>
                  <span className="text-text-primary">{item.name}</span>
                  {' — '}{UNTRACK_REASONS[item.reason] || item.reason}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ---- Render: Utility skills ----
  // Menu entries without artifact metadata (help, party mode, elicitation)
  // are helpers, not project work — grouped separately so they stop diluting
  // the real workflow phases.
  const [showUtilities, setShowUtilities] = useState(false);
  const renderUtilitySkills = (utilities) => {
    if (!utilities || utilities.length === 0) {
      return null;
    }

    return (
      <div className="border border-border-dark-light rounded-md overflow-hidden">
        <button
          onClick={() => setShowUtilities(prev => !prev)}
          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors bg-bg-primary-light hover:bg-bg-tertiary ${showUtilities ? 'border-b border-border-dark-light' : ''}`}
        >
          <FaChevronDown className={`w-3 h-3 text-text-secondary transition-transform duration-200 ${showUtilities ? 'rotate-0' : '-rotate-90'}`} />
          <FiHelpCircle className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary capitalize flex-1 text-left">Helpers</span>
          <span className="text-2xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary">{utilities.length}</span>
        </button>
        {showUtilities && (
          <div className={`transition-all duration-200 overflow-hidden ${showUtilities ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="flex flex-col gap-2 p-3 bg-bg-primary">
              {utilities.map(workflow => renderWorkflowItem(workflow, false))}
            </div>
          </div>
        )}
      </div>
    );
  };


  // ---- Render: Skills ----
  const renderSkills = () => {
    if (!installedSkills || installedSkills.length === 0) {
      return <EmptyState text="No installed skills detected. Install or update BMAD first." />;
    }

    const query = skillSearch.trim().toLowerCase();
    const filteredSkills = query
      ? installedSkills.filter((s) =>
          `${s.name} ${s.description ?? ''} ${s.id}`.toLowerCase().includes(query),
        )
      : installedSkills;

    if (filteredSkills.length === 0) {
      return <EmptyState text={`No skills match "${skillSearch}".`} />;
    }

    const skillsByModule = filteredSkills.reduce((acc, skill) => {
      const module = skill.module || 'other';
      if (!acc[module]) {
        acc[module] = [];
      }
      acc[module].push(skill);
      return acc;
    }, {});

    return (
      <div className="flex flex-col gap-4">
        <SearchInput
          value={skillSearch}
          onChange={setSkillSearch}
          placeholder={`Search ${installedSkills.length} installed skills...`}
        />
        {Object.entries(skillsByModule).map(([module, skills]) => (
          <div key={module} className="border border-border-default rounded-md overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 bg-bg-primary-light border-b border-border-default">
              <FiPackage className="w-4 h-4 text-text-secondary" />
              <span className="text-sm font-medium text-text-primary uppercase">{module}</span>
              <span className="text-2xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary">{skills.length}</span>
            </div>
            <div className="p-3 flex flex-col gap-2 bg-bg-primary">
              {skills.map(skill => {
                const loading = executingSkills[skill.id] || false;
                return (
                  <div key={skill.id} className="border rounded-md p-3 transition-colors bg-bg-secondary border-border-dark-light">
                    <div className="flex items-start justify-between gap-2">
                      <ui.Button
                        onClick={(e) => {
                          e.preventDefault();
                          if (!loading) {
                            handleExecuteSkill(skill.id);
                          }
                        }}
                        color="tertiary"
                        size="sm"
                        disabled={loading}
                        className="gap-1"
                      >
                        {loading ? <CgSpinner className="animate-spin w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                        <span>{loading ? 'Executing...' : skill.name}</span>
                        {!loading && <IoPlayCircleOutline className="w-3.5 h-3.5 ml-2" />}
                      </ui.Button>
                    </div>
                    <p className="text-2xs text-text-secondary ml-0.5 mt-1">{skill.description}</p>
                    <div className="flex items-center gap-2 ml-0.5 mt-1">
                      <ArtifactLink target={skill.id} label="Open SKILL.md" onOpen={handleOpenSkillFile} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---- Render: Reset banner ----
  const renderResetBanner = () => {
    const hasWorkflowProgress = (status.completedWorkflows?.length > 0) || (status.inProgressWorkflows?.length > 0);
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
              This will move all workflow artifacts in _bmad-output to a timestamped trash folder (_bmad-output-trash-...). Nothing is deleted — clean up the trash folder manually later.
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

  // ---- Render: Confirm dialogs ----
  const renderConfirmDialogs = () => (
    <>
      {confirmStartWorkflow && (
        <ui.ConfirmDialog
          title={`Start ${confirmStartWorkflow.name}?`}
          onConfirm={() => {
            const id = confirmStartWorkflow.id;
            setConfirmStartWorkflow(null);
            handleExecuteWorkflow(id);
          }}
          onCancel={() => setConfirmStartWorkflow(null)}
          confirmButtonText="Start"
        >
          <p className="text-sm text-text-secondary">
            The workflow runs in a new task and guides you through its steps. You can continue here while it works.
          </p>
        </ui.ConfirmDialog>
      )}

      {showResetConfirm && (
        <ui.ConfirmDialog
          title="Reset Workflow State?"
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
          confirmButtonText="Reset"
          confirmButtonColor="danger"
          disabled={resetting}
        >
          <p className="text-sm text-text-secondary">
            This will move all files in the _bmad-output folder to _bmad-output-trash-&lt;timestamp&gt;. Nothing is deleted permanently.
          </p>
        </ui.ConfirmDialog>
      )}
    </>
  );

  // ---- Loading / error / not installed ----
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <ui.LoadingOverlay message="Loading BMAD..." />
      </div>
    );
  }

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

  if (!status) {
    return null;
  }

  if (!status.installed) {
    return renderBmadInstallPrompt();
  }

  // ---- Main ----
  return (
    <div className="absolute inset-0 flex flex-col overflow-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
      <div className="w-full max-w-3xl mx-auto p-6">
        <div className="flex flex-col gap-4">
          {renderBmadWelcomeSection()}

          {renderHelpOrchestrator()}

          <div className="text-xs text-text-tertiary">
            BMAD Extension v{data?.extensionVersion || '?'} · BMAD Library installed (v{status.version || 'Unknown'})
          </div>

          {expectedVersion && status.version && status.version !== expectedVersion && (
            <div className="flex items-center gap-2 bg-warning-subtle border border-warning-emphasis rounded-lg px-3 py-2">
              <FiAlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <span className="text-xs text-warning-light flex-1">
                Installed v{status.version} differs from configured v{expectedVersion}.
              </span>
              <ui.Button onClick={handleInstall} disabled={installing} size="sm" color="tertiary" className="gap-1.5">
                {installing ? <CgSpinner className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
                Update
              </ui.Button>
            </div>
          )}

          {/* Update available banner */}
          {status.installed && data?.updateInfo?.updateAvailable && (
            <div className="flex flex-col gap-2 bg-success-subtle border border-success-emphasis rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FiDownload className="w-4 h-4 text-success flex-shrink-0" />
                <span className="text-xs text-text-primary flex-1">
                  BMAD Method update available: v{data.updateInfo.currentVersion} → v{data.updateInfo.latestPatchVersion}
                </span>
                <ui.Button
                  onClick={async () => {
                    setInstalling(true);
                    try {
                      await executeExtensionAction('perform-update');
                    } finally {
                      setInstalling(false);
                    }
                  }}
                  disabled={installing}
                  size="sm"
                  color="primary"
                  className="gap-1.5"
                >
                  {installing ? <CgSpinner className="w-3.5 h-3.5 animate-spin" /> : <FiDownload className="w-3.5 h-3.5" />}
                  Update Now
                </ui.Button>
              </div>
              {data.updateInfo.notes?.length > 0 && (
                <ul className="text-xs text-text-secondary list-disc pl-5 flex flex-col gap-0.5">
                  {data.updateInfo.notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Update check failed notice */}
          {status.installed && data?.updateInfo?.error && !data.updateInfo.updateAvailable && (
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <FiAlertTriangle className="w-3.5 h-3.5 text-warning" />
              <span>Update check failed: {data.updateInfo.error}</span>
            </div>
          )}

          {uvAvailable === false && (
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <FiAlertTriangle className="w-3.5 h-3.5 text-warning" />
              <span>uv not found — skill helper scripts will use documented fallbacks</span>
            </div>
          )}

          {renderTabs()}

          {activeTab === 'workflows' && (
            <>
              {renderCompass()}
              {renderNextSteps()}
              {renderWorkflowList()}
              {renderOptionalFollowUps()}
            </>
          )}

          {activeTab === 'skills' && renderSkills()}

          {renderResetBanner()}
        </div>
      </div>

      {renderConfirmDialogs()}
    </div>
  );
}

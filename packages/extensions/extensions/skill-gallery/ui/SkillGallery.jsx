(props) => {
  const { useState, useEffect, useCallback, useMemo } = React;
  const { ModalOverlayLayout, Button, IconButton, Input, Select, ConfirmDialog, Tooltip } = props.ui;
  const {
    FiBookOpen,
    FiSearch,
    FiRefreshCw,
    FiDownload,
    FiTrash2,
    FiCheck,
    FiPackage,
    FiAlertCircle,
    FiSettings,
    FiGlobe,
    FiFolder,
    FiPlus,
  } = props.icons.Fi;
  const { executeExtensionAction } = props;
  const data = props.data || {};

  const GLOBAL_TARGET = 'global';

  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [installTarget, setInstallTarget] = useState(GLOBAL_TARGET);
  const [openProjectDirs, setOpenProjectDirs] = useState(data.openProjectDirs !== undefined ? data.openProjectDirs : []);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSwitchingTarget, setIsSwitchingTarget] = useState(false);
  const [skills, setSkills] = useState(data.skills || []);
  const [error, setError] = useState(data.error || null);
  const [customSources, setCustomSources] = useState(data.customSources || []);
  const [showSourcesDialog, setShowSourcesDialog] = useState(false);
  const [sourcesDraft, setSourcesDraft] = useState([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceSubPath, setNewSourceSubPath] = useState('');
  const [isSavingSources, setIsSavingSources] = useState(false);

  useEffect(() => {
    if (data.skills) {
      setSkills(data.skills);
    }
    if (data.error !== undefined) {
      setError(data.error);
    }
    if (data.customSources !== undefined) {
      setCustomSources(data.customSources);
    }
    if (data.openProjectDirs !== undefined) {
      setOpenProjectDirs(data.openProjectDirs);
    }
  }, [data]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpen = useCallback(() => {
    setShowModal(true);
    if ((!data.skills || data.skills.length === 0) && !data.loading) {
      setIsRefreshing(true);
      executeExtensionAction('fetch-skills', GLOBAL_TARGET)
        .then((result) => {
          if (result?.skills) setSkills(result.skills);
          if (result?.error !== undefined) setError(result.error);
        })
        .finally(() => setIsRefreshing(false));
    }
  }, [data.skills, data.loading, executeExtensionAction]);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const result = await executeExtensionAction('fetch-skills', installTarget);
      if (result?.skills) setSkills(result.skills);
      if (result?.error !== undefined) setError(result.error);
    } finally {
      setIsRefreshing(false);
    }
  }, [executeExtensionAction, installTarget]);

  const handleInstall = useCallback(
    async (skillId) => {
      setActionInProgress(skillId);
      try {
        const result = await executeExtensionAction('install-skill', skillId, installTarget);
        if (result?.skills) setSkills(result.skills);
      } finally {
        setActionInProgress(null);
      }
    },
    [executeExtensionAction, installTarget],
  );

  const handleUninstall = useCallback(
    async (skillId) => {
      setActionInProgress(skillId);
      try {
        const result = await executeExtensionAction('uninstall-skill', skillId, installTarget);
        if (result?.skills) setSkills(result.skills);
      } finally {
        setActionInProgress(null);
      }
    },
    [executeExtensionAction, installTarget],
  );

  const handleTargetChange = useCallback(
    async (target) => {
      setInstallTarget(target);
      setIsSwitchingTarget(true);
      try {
        const result = await executeExtensionAction('select-target', target);
        if (result?.skills) setSkills(result.skills);
      } finally {
        setIsSwitchingTarget(false);
      }
    },
    [executeExtensionAction],
  );

  const handleOpenSources = useCallback(() => {
    setSourcesDraft([...customSources]);
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceSubPath('');
    setShowSourcesDialog(true);
  }, [customSources]);

  const handleCancelSources = useCallback(() => {
    setShowSourcesDialog(false);
  }, []);

  const handleAddSource = useCallback(() => {
    const name = newSourceName.trim();
    const url = newSourceUrl.trim();
    if (!name || !url) return;
    const subPath = newSourceSubPath.trim();
    setSourcesDraft((prev) => [...prev, { name, url, subPath }]);
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourceSubPath('');
  }, [newSourceName, newSourceUrl, newSourceSubPath]);

  const handleRemoveSource = useCallback((index) => {
    setSourcesDraft((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSaveSources = useCallback(async () => {
    setIsSavingSources(true);
    try {
      const result = await executeExtensionAction('save-sources', sourcesDraft, installTarget);
      if (result?.skills) setSkills(result.skills);
      if (result?.error !== undefined) setError(result.error);
      if (result?.customSources !== undefined) setCustomSources(result.customSources);
      setShowSourcesDialog(false);
    } finally {
      setIsSavingSources(false);
    }
  }, [executeExtensionAction, sourcesDraft, installTarget]);

  const filteredSkills = useMemo(() => {
    let result = skills;

    if (filterSource !== 'all') {
      result = result.filter((s) => s.sourceId === filterSource);
    }

    if (filterStatus === 'installed') {
      result = result.filter((s) => s.installed);
    } else if (filterStatus === 'available') {
      result = result.filter((s) => !s.installed);
    }

    if (debouncedSearchQuery.trim()) {
      const q = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [skills, filterSource, filterStatus, debouncedSearchQuery]);

  const sourceOptions = useMemo(() => {
    const map = new Map();
    skills.forEach((s) => {
      if (!map.has(s.sourceId)) {
        map.set(s.sourceId, { value: s.sourceId, label: s.sourceName });
      }
    });
    return [{ value: 'all', label: 'All Sources' }, ...Array.from(map.values())];
  }, [skills]);

  const statusOptions = [
    { value: 'all', label: 'All Skills' },
    { value: 'installed', label: 'Installed' },
    { value: 'available', label: 'Available' },
  ];

  const canSelectProjectTarget = Array.isArray(openProjectDirs);

  const targetOptions = useMemo(() => {
    const projectOptions = canSelectProjectTarget
      ? openProjectDirs.map((baseDir) => ({
          value: baseDir,
          label: baseDir.split(/[\\/]/).filter(Boolean).pop() || baseDir,
        }))
      : [];
    return [{ value: GLOBAL_TARGET, label: 'Global' }, ...projectOptions];
  }, [openProjectDirs, canSelectProjectTarget]);

  const targetLabel = useMemo(() => {
    const match = targetOptions.find((t) => t.value === installTarget);
    return match ? match.label : installTarget;
  }, [targetOptions, installTarget]);

  const installedCount = useMemo(() => skills.filter((s) => s.installed).length, [skills]);

  if (!showModal) {
    return (
      <Tooltip content={`Skill Gallery${installedCount > 0 ? ` — ${installedCount} installed` : ''}`}>
        <button
          className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200 cursor-pointer"
          onClick={handleOpen}
        >
          <FiBookOpen className="h-5 w-5 text-text-secondary" />
        </button>
      </Tooltip>
    );
  }

  return (
    <ModalOverlayLayout title="Skill Gallery" onClose={handleClose} closeOnEscape={true}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-border-default flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative min-w-[180px]">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills..."
                size="sm"
                className="pl-10 w-full"
                wrapperClassName="w-full"
              />
            </div>
            <IconButton
              icon={<FiSettings className="w-4 h-4" />}
              onClick={handleOpenSources}
              tooltip="Manage skill sources"
              className="p-2 rounded-md hover:bg-bg-tertiary"
            />
            <IconButton
              icon={<FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              tooltip="Refresh from GitHub"
              disabled={isRefreshing}
              className="p-2 rounded-md hover:bg-bg-tertiary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-64">
              <Select value={filterSource} onChange={setFilterSource} options={sourceOptions} size="sm" />
            </div>
            <div className="w-[150px]">
              <Select value={filterStatus} onChange={setFilterStatus} options={statusOptions} size="sm" />
            </div>
            {canSelectProjectTarget && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="flex items-center gap-1 text-2xs text-text-muted whitespace-nowrap">
                  {installTarget === GLOBAL_TARGET ? <FiGlobe className="w-3 h-3" /> : <FiFolder className="w-3 h-3" />}
                  Install to:
                </span>
                <div className="w-[200px]">
                  <Select value={installTarget} onChange={handleTargetChange} options={targetOptions} size="sm" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
          {isRefreshing && skills.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-accent-primary border-t-transparent rounded-full"></div>
                <span className="text-text-secondary text-sm">Loading skills from GitHub...</span>
              </div>
            </div>
          ) : error && skills.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3 max-w-sm">
                <FiAlertCircle className="w-8 h-8 text-error mx-auto" />
                <p className="text-error text-sm">{error}</p>
                <p className="text-text-muted text-xs">Make sure git is installed and you have an internet connection.</p>
                <Button onClick={handleRefresh} size="sm">Retry</Button>
              </div>
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-1">
                <FiPackage className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-text-muted text-sm">No skills found.</p>
                {searchQuery && <p className="text-text-muted text-xs">Try adjusting your search or filters.</p>}
              </div>
            </div>
          ) : (
            <table className={`w-full border-collapse ${isSwitchingTarget ? 'opacity-50 pointer-events-none' : ''}`}>
              <thead>
                <tr className="border-b border-border-default sticky top-0 bg-bg-secondary z-10">
                  <th className="text-left text-2xs font-semibold text-text-muted uppercase tracking-wide px-3 py-2 w-[20%]">Name</th>
                  <th className="text-left text-2xs font-semibold text-text-muted uppercase tracking-wide px-3 py-2 w-[15%]">Source</th>
                  <th className="text-left text-2xs font-semibold text-text-muted uppercase tracking-wide px-3 py-2">Description</th>
                  <th className="text-right text-2xs font-semibold text-text-muted uppercase tracking-wide px-3 py-2 w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSkills.map((skill) => (
                <tr key={skill.id} className="border-b border-border-default hover:bg-bg-tertiary transition-colors">
                  <td className="px-3 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">{skill.name}</span>
                      {skill.installed && (
                        <Tooltip content="Installed">
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-3xs font-semibold rounded bg-success-subtle text-success flex-shrink-0">
                            <FiCheck className="w-3 h-3" />
                          </span>
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="text-3xs text-text-muted">{skill.sourceName}</span>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <p className="text-xs text-text-secondary leading-relaxed">
                      {skill.description}
                    </p>
                  </td>
                  <td className="px-3 py-2 align-top text-right">
                    {skill.installed ? (
                      <Button
                        onClick={() => handleUninstall(skill.id)}
                        disabled={actionInProgress === skill.id}
                        size="sm"
                        variant="outline"
                        color="danger"
                      >
                        {actionInProgress === skill.id ? (
                          <div className="animate-spin h-3.5 w-3.5 mr-1.5 border border-button-danger border-t-transparent rounded-full" />
                        ) : (
                          <FiTrash2 className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        <span>Uninstall</span>
                      </Button>
                    ) : (
                      <Button onClick={() => handleInstall(skill.id)} disabled={actionInProgress === skill.id} size="sm">
                        {actionInProgress === skill.id ? (
                          <div className="animate-spin h-3.5 w-3.5 mr-1.5 border border-button-primary-text border-t-transparent rounded-full" />
                        ) : (
                          <FiDownload className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        <span>Install</span>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border-default flex-shrink-0">
          <span className="text-2xs text-text-muted">
            {filteredSkills.length} of {skills.length} skills{installedCount > 0 ? ` · ${installedCount} installed` : ''}
          </span>
          <span className="text-2xs text-text-muted">
            Installing to: <span className="text-text-secondary font-medium">{targetLabel}</span>
          </span>
        </div>
      </div>

      {showSourcesDialog && (
        <ConfirmDialog
          title="Manage Skill Sources"
          onCancel={handleCancelSources}
          onConfirm={handleSaveSources}
          confirmButtonText={isSavingSources ? 'Saving...' : 'Save'}
          cancelButtonText="Cancel"
          disabled={isSavingSources}
          width={800}
        >
          <div className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-text-secondary">Custom Skill Source Repositories</span>
              {sourcesDraft.length === 0 ? (
                <p className="text-xs text-text-muted px-1 py-2">No custom repositories added yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth">
                  {sourcesDraft.map((source, index) => (
                    <div
                      key={`${source.url}-${index}`}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-border-default bg-bg-secondary-light"
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-semibold text-text-primary truncate">{source.name}</span>
                          {source.subPath && (
                            <span className="px-1.5 py-0.5 rounded bg-bg-tertiary text-2xs text-text-secondary font-mono flex-shrink-0">
                              {source.subPath}
                            </span>
                          )}
                        </div>
                        <span className="text-3xs font-mono text-text-muted truncate">{source.url}</span>
                      </div>
                      <IconButton
                        icon={<FiTrash2 className="w-3.5 h-3.5" />}
                        onClick={() => handleRemoveSource(index)}
                        tooltip="Remove"
                        className="p-1.5 rounded-md text-text-muted hover:text-error hover:bg-bg-tertiary flex-shrink-0"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-end gap-2">
              <Input
                label="Name"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="My Skills Repo"
                size="sm"
                wrapperClassName="w-32 flex-shrink-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSource();
                  }
                }}
              />
              <Input
                label="Repository URL"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                placeholder="https://github.com/user/skills-repo"
                size="sm"
                wrapperClassName="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSource();
                  }
                }}
              />
              <Input
                label="Subdirectory (optional)"
                value={newSourceSubPath}
                onChange={(e) => setNewSourceSubPath(e.target.value)}
                placeholder="skills"
                size="sm"
                wrapperClassName="w-28 flex-shrink-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSource();
                  }
                }}
              />
              <Button onClick={handleAddSource} size="sm" disabled={!newSourceName.trim() || !newSourceUrl.trim()}>
                <FiPlus className="w-3.5 h-3.5 mr-1.5" />
                Add
              </Button>
            </div>
            <p className="text-xs text-text-secondary">
              Each repository is scanned for directories containing SKILL.md files. Default sources (Anthropic Official Skills, Awesome Claude
              Skills, Agentic Awesome Skills, Matt Pocock: Engineering, and Matt Pocock: Productivity) are always included.
            </p>
          </div>
        </ConfirmDialog>
      )}
    </ModalOverlayLayout>
  );
};

(props) => {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;
  const { ModalOverlayLayout, Select, Input, IconButton, Button, Tooltip, CodeBlock } = props.ui;
  const {
    FiGitBranch,
    FiGitCommit,
    FiSearch,
    FiRefreshCw,
    FiAlertCircle,
    FiFileText,
    FiArrowLeft,
  } = props.icons.Fi;
  const { executeExtensionAction } = props;
  const data = props.data || {};

  const ROW_HEIGHT = 58;
  const OVERSCAN = 6;
  const PAGE_SIZE = 200;
  const SCROLL_THRESHOLD = 400;

  const AVATAR_COLORS = ['#F1502F', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6', '#6366F1'];

  const STATUS_COLORS = {
    A: 'bg-success-subtle text-success',
    M: 'bg-info-subtle text-info',
    D: 'bg-error-subtle text-error',
    R: 'bg-warning-subtle text-warning',
    B: 'bg-bg-tertiary text-text-muted',
  };

  const [showModal, setShowModal] = useState(false);
  const [projectDirs, setProjectDirs] = useState(Array.isArray(data.openProjectDirs) ? data.openProjectDirs : []);
  const [selectedProject, setSelectedProject] = useState('');
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [commits, setCommits] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [commitDetail, setCommitDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState(null);
  const [fileDiff, setFileDiff] = useState('');
  const [fileDiffLoading, setFileDiffLoading] = useState(false);
  const [branchQuery, setBranchQuery] = useState('');
  const [branchOpen, setBranchOpen] = useState(false);

  const listRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const branchContainerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (Array.isArray(data.openProjectDirs)) {
      setProjectDirs(data.openProjectDirs);
    }
  }, [data]);

  useEffect(() => {
    if (!showModal) return;
    const el = listRef.current;
    if (!el) return;
    const update = () => setViewportHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showModal]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [searchQuery, selectedBranch]);

  useEffect(() => {
    const handler = (e) => {
      if (branchContainerRef.current && !branchContainerRef.current.contains(e.target)) {
        setBranchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const baseName = useCallback((p) => {
    if (!p) return '';
    return p.split(/[\\/]/).filter(Boolean).pop() || p;
  }, []);

  const initials = useCallback((name) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = (parts[0] || '')[0] || '';
    const last = parts.length > 1 ? (parts[parts.length - 1] || '')[0] : '';
    return (first + last).toUpperCase();
  }, []);

  const avatarColor = useCallback((email) => {
    if (!email) return AVATAR_COLORS[0];
    let h = 0;
    for (let i = 0; i < email.length; i += 1) {
      h = (h * 31 + email.charCodeAt(i)) >>> 0;
    }
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }, []);

  const formatRelativeDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diff = Date.now() - date.getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + ' hr ago';
    const days = Math.round(hours / 24);
    if (days < 30) return days + ' day' + (days > 1 ? 's' : '') + ' ago';
    const months = Math.round(days / 30);
    if (months < 12) return months + ' month' + (months > 1 ? 's' : '') + ' ago';
    const years = Math.round(months / 12);
    return years + ' year' + (years > 1 ? 's' : '') + ' ago';
  }, []);

  const projectOptions = useMemo(
    () => (projectDirs || []).map((d) => ({ value: d, label: baseName(d) })),
    [projectDirs, baseName],
  );

  const filteredBranches = useMemo(() => {
    const q = branchQuery.trim().toLowerCase();
    const list = q ? branches.filter((b) => b.name.toLowerCase().includes(q)) : branches;
    const limited = list.slice(0, 200);
    return { list: limited, total: list.length, hasMore: list.length > limited.length };
  }, [branches, branchQuery]);

  const filteredCommits = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return commits;
    return commits.filter(
      (c) =>
        c.subject.toLowerCase().includes(q) ||
        (c.body && c.body.toLowerCase().includes(q)) ||
        c.authorName.toLowerCase().includes(q) ||
        c.shortHash.toLowerCase().includes(q) ||
        c.hash.toLowerCase().includes(q),
    );
  }, [commits, searchQuery]);

  const selectProject = useCallback(
    async (dir) => {
      if (!dir) return;
      setSelectedProject(dir);
      setError(null);
      setLoading(true);
      setCommits([]);
      setHasMore(false);
      setSelectedCommit(null);
      setCommitDetail(null);
      setSelectedFilePath(null);
      setFileDiff('');

      const branchResult = await executeExtensionAction('get-branches', dir);
      let branch = 'all';
      if (branchResult && !branchResult.error && Array.isArray(branchResult.branches)) {
        setBranches(branchResult.branches);
        const cur = branchResult.branches.find((b) => b.current);
        branch = cur ? cur.name : 'all';
      } else {
        setBranches([]);
        if (branchResult && branchResult.error) {
          setError(branchResult.error);
        }
      }
      setSelectedBranch(branch);

      const logResult = await executeExtensionAction('get-log', dir, branch, 0, PAGE_SIZE);
      if (logResult) {
        if (logResult.error) {
          setError(logResult.error);
        } else {
          setCommits(logResult.commits || []);
          setHasMore(!!logResult.hasMore);
        }
      }
      setLoading(false);
    },
    [executeExtensionAction],
  );

  const handleOpen = useCallback(async () => {
    setShowModal(true);
    const dirs = Array.isArray(projectDirs) ? projectDirs : [];
    let target = selectedProject;
    if (!dirs.includes(target) && dirs.length > 0) target = dirs[0];
    if (!target && data.currentProjectDir) target = data.currentProjectDir;
    if (!target) {
      setError('No open projects to inspect');
      return;
    }
    await selectProject(target);
  }, [data.currentProjectDir, projectDirs, selectedProject, selectProject]);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleBackToList = useCallback(() => {
    setSelectedCommit(null);
    setCommitDetail(null);
    setSelectedFilePath(null);
    setFileDiff('');
  }, []);

  const handleProjectChange = useCallback(
    (value) => {
      void selectProject(value);
    },
    [selectProject],
  );

  const handleBranchChange = useCallback(
    async (value) => {
      setSelectedBranch(value);
      setError(null);
      setLoading(true);
      setCommits([]);
      setHasMore(false);
      setSelectedCommit(null);
      setCommitDetail(null);
      setSelectedFilePath(null);
      setFileDiff('');
      const result = await executeExtensionAction('get-log', selectedProject, value, 0, PAGE_SIZE);
      if (result) {
        if (result.error) {
          setError(result.error);
        } else {
          setCommits(result.commits || []);
          setHasMore(!!result.hasMore);
        }
      }
      setLoading(false);
    },
    [executeExtensionAction, selectedProject],
  );

  const handleBranchSelect = useCallback(
    (value) => {
      setBranchQuery('');
      setBranchOpen(false);
      void handleBranchChange(value);
    },
    [handleBranchChange],
  );

  const handleRefresh = useCallback(() => {
    void handleBranchChange(selectedBranch);
  }, [handleBranchChange, selectedBranch]);

  const loadMore = useCallback(() => {
    if (!selectedProject || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const skip = commits.length;
    executeExtensionAction('get-log', selectedProject, selectedBranch, skip, PAGE_SIZE)
      .then((result) => {
        if (result && !result.error) {
          setCommits((prev) => [...prev, ...(result.commits || [])]);
          setHasMore(!!result.hasMore);
        }
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [executeExtensionAction, selectedProject, selectedBranch, commits.length]);

  const handleScroll = useCallback(
    (e) => {
      const el = e.currentTarget;
      setScrollTop(el.scrollTop);
      if (hasMore && !loading && el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_THRESHOLD) {
        loadMore();
      }
    },
    [hasMore, loading, loadMore],
  );

  const handleSelectCommit = useCallback(
    async (c) => {
      setSelectedCommit(c);
      setCommitDetail(null);
      setSelectedFilePath(null);
      setFileDiff('');
      setDetailLoading(true);
      const result = await executeExtensionAction('get-commit-detail', selectedProject, c.hash);
      setDetailLoading(false);
      if (result && result.error) {
        setCommitDetail({ error: result.error });
        return;
      }
      setCommitDetail(result);
    },
    [executeExtensionAction, selectedProject],
  );

  const handleSelectFile = useCallback(
    async (file) => {
      if (!selectedCommit) return;
      setSelectedFilePath(file.path);
      setFileDiffLoading(true);
      const result = await executeExtensionAction('get-file-diff', selectedProject, selectedCommit.hash, file.path);
      setFileDiffLoading(false);
      setFileDiff((result && result.diff) || '');
    },
    [executeExtensionAction, selectedProject, selectedCommit],
  );

  const getBadges = useCallback((c) => {
    const badges = [];
    if (c.isHead) badges.push({ label: 'HEAD', kind: 'head' });

    const localBranches = (c.branches || []).filter((b) => !b.includes('/'));
    const remoteBranches = (c.branches || []).filter((b) => b.includes('/'));
    const shownRemote = remoteBranches.filter((r) => {
      const short = r.split('/').slice(1).join('/');
      return !localBranches.includes(short);
    });

    for (const b of localBranches) badges.push({ label: b, kind: 'branch' });
    for (const b of shownRemote) badges.push({ label: b, kind: 'remote' });
    for (const t of c.tags || []) badges.push({ label: t, kind: 'tag' });

    return badges;
  }, []);

  const totalHeight = filteredCommits.length * ROW_HEIGHT;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const end = Math.min(filteredCommits.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleCommits = filteredCommits.slice(start, end);

  if (!showModal) {
    return (
      <Tooltip content="Git Log">
        <button
          className="px-4 py-2 hover:bg-bg-tertiary-emphasis transition-colors duration-200 cursor-pointer"
          onClick={handleOpen}
        >
          <FiGitBranch className="h-5 w-5 text-text-secondary" />
        </button>
      </Tooltip>
    );
  }

  const renderCommitRow = (c, idx) => {
    const badges = getBadges(c);
    const hiddenCount = Math.max(0, badges.length - 3);
    const shownBadges = badges.slice(0, 3);
    const isSelected = selectedCommit && selectedCommit.hash === c.hash;

    return (
      <div
        key={c.hash}
        onClick={() => handleSelectCommit(c)}
        className={
          'absolute left-0 right-0 px-3 py-1.5 flex items-center gap-3 border-b border-border-default cursor-pointer transition-colors ' +
          (isSelected ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary-emphasis')
        }
        style={{ top: idx * ROW_HEIGHT, height: ROW_HEIGHT }}
      >
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-2xs font-semibold text-white"
          style={{ backgroundColor: avatarColor(c.authorEmail) }}
        >
          {initials(c.authorName)}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-medium text-text-primary truncate">{c.subject}</span>
          </div>
          <div className="flex items-center gap-1.5 text-2xs text-text-muted min-w-0">
            <span className="font-mono text-accent-primary flex-shrink-0">{c.shortHash}</span>
            <span className="truncate">{c.authorName}</span>
            <span className="flex-shrink-0">·</span>
            <span className="flex-shrink-0">{formatRelativeDate(c.date)}</span>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1 overflow-hidden" style={{ maxWidth: '45%' }}>
          {shownBadges.map((b) => (
            <span
              key={b.kind + b.label}
              className={
                'px-1.5 py-0.5 rounded text-3xs font-semibold flex-shrink-0 ' +
                (b.kind === 'head'
                  ? 'bg-accent-primary text-white'
                  : b.kind === 'tag'
                    ? 'bg-warning-subtle text-warning'
                    : b.kind === 'remote'
                      ? 'bg-bg-tertiary text-text-muted'
                      : 'bg-bg-tertiary text-text-secondary')
              }
            >
              {b.kind === 'tag' ? '🏷 ' : ''}
              {b.label}
            </span>
          ))}
          {hiddenCount > 0 && <span className="text-3xs text-text-muted flex-shrink-0">+{hiddenCount}</span>}
        </div>
      </div>
    );
  };

  return (
    <ModalOverlayLayout title="Git Log" onClose={handleClose} closeOnEscape={true}>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border-default flex-shrink-0">
          <div className="flex-shrink-0" style={isMobile ? { width: '100%' } : { width: '12rem' }}>
            <Select value={selectedProject} onChange={handleProjectChange} options={projectOptions} size="sm" />
          </div>
          <div
            className="flex-shrink-0 relative"
            style={isMobile ? { width: '100%' } : { width: '14rem' }}
            ref={branchContainerRef}
          >
            <div className="relative">
              <FiGitBranch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
              <Input
                value={branchQuery}
                onChange={(e) => {
                  setBranchQuery(e.target.value);
                  setBranchOpen(true);
                }}
                onFocus={() => setBranchOpen(true)}
                placeholder={selectedBranch === 'all' ? 'All branches' : selectedBranch}
                size="sm"
                className="pl-9 w-full"
              />
            </div>
            {branchOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-bg-secondary-light border border-border-default rounded shadow-lg max-h-56 overflow-y-auto scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-fourth">
                <div
                  className={
                    'px-3 py-1.5 text-xs cursor-pointer hover:bg-bg-tertiary ' +
                    (selectedBranch === 'all' ? 'bg-bg-tertiary text-text-primary' : 'text-text-primary')
                  }
                  onClick={() => handleBranchSelect('all')}
                >
                  All branches
                </div>
                {filteredBranches.list.map((b) => (
                  <div
                    key={b.name}
                    className={
                      'px-3 py-1.5 text-xs cursor-pointer hover:bg-bg-tertiary flex items-center gap-1.5 ' +
                      (selectedBranch === b.name ? 'bg-bg-tertiary' : '')
                    }
                    onClick={() => handleBranchSelect(b.name)}
                  >
                    <span className={'truncate ' + (b.remote ? 'text-text-muted' : 'text-text-primary')}>{b.name}</span>
                    {b.current && <span className="text-3xs text-accent-primary flex-shrink-0">(current)</span>}
                  </div>
                ))}
                {filteredBranches.list.length === 0 && (
                  <div className="px-3 py-1.5 text-2xs text-text-muted">No matching branches</div>
                )}
                {filteredBranches.hasMore && (
                  <div className="px-3 py-1.5 text-2xs text-text-muted">
                    +{filteredBranches.total - filteredBranches.list.length} more — type to filter
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 relative min-w-0" style={isMobile ? { flexBasis: '100%' } : undefined}>
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search commits (message, author, hash)..."
              size="sm"
              className="pl-9 w-full"
              wrapperClassName="w-full"
            />
          </div>
          <IconButton
            icon={<FiRefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />}
            onClick={handleRefresh}
            tooltip="Refresh"
            disabled={loading}
            className="p-2 rounded-md hover:bg-bg-tertiary"
          />
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Commit list */}
          <div
            className={'flex flex-col min-h-0 min-w-0' + (isMobile ? '' : ' border-r border-border-default')}
            style={
              isMobile
                ? { flex: '1 1 0%', width: '100%', display: selectedCommit ? 'none' : 'flex' }
                : { flex: '1 1 0%' }
            }
          >
            <div
              ref={listRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth"
            >
              {loading && commits.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-accent-primary border-t-transparent rounded-full"></div>
                    <span className="text-text-secondary text-sm">Loading commits...</span>
                  </div>
                </div>
              ) : error && commits.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-3 max-w-sm px-6">
                    <FiAlertCircle className="w-8 h-8 text-error mx-auto" />
                    <p className="text-error text-sm">{error}</p>
                    <Button onClick={handleRefresh} size="sm">Retry</Button>
                  </div>
                </div>
              ) : filteredCommits.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-1">
                    <FiGitCommit className="w-8 h-8 text-text-muted mx-auto mb-2" />
                    <p className="text-text-muted text-sm">No commits found.</p>
                    {searchQuery && <p className="text-text-muted text-xs">Try adjusting your search.</p>}
                  </div>
                </div>
              ) : (
                <div style={{ height: totalHeight, position: 'relative' }}>
                  {visibleCommits.map((c, i) => renderCommitRow(c, start + i))}
                </div>
              )}
            </div>
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 py-2 border-t border-border-default flex-shrink-0">
                <div className="animate-spin h-3.5 w-3.5 border-2 border-accent-primary border-t-transparent rounded-full"></div>
                <span className="text-text-muted text-2xs">Loading more...</span>
              </div>
            )}
          </div>

          {/* Commit detail */}
          <div
            className="flex flex-col min-h-0 min-w-0 bg-bg-secondary"
            style={
              isMobile
                ? { flex: '1 1 0%', width: '100%', display: selectedCommit ? 'flex' : 'none' }
                : { flex: '1 1 0%' }
            }
          >
            {detailLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-accent-primary border-t-transparent rounded-full"></div>
                  <span className="text-text-secondary text-sm">Loading commit...</span>
                </div>
              </div>
            ) : !selectedCommit ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-1">
                  <FiFileText className="w-8 h-8 text-text-muted mx-auto mb-2" />
                  <p className="text-text-muted text-sm">Select a commit to view its details.</p>
                </div>
              </div>
            ) : commitDetail && commitDetail.error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3 max-w-sm px-6">
                  <FiAlertCircle className="w-8 h-8 text-error mx-auto" />
                  <p className="text-error text-sm">{commitDetail.error}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                {/* Commit header */}
                <div className="px-4 py-3 border-b border-border-default flex-shrink-0 space-y-2">
                  {isMobile && (
                    <div className="flex items-center gap-2">
                      <IconButton
                        icon={<FiArrowLeft className="w-4 h-4" />}
                        onClick={handleBackToList}
                        tooltip="Back to list"
                        className="p-1.5 rounded-md hover:bg-bg-tertiary -ml-1.5"
                      />
                      <span className="text-xs text-text-muted">Commit details</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-2xs font-semibold text-white mt-0.5"
                      style={{ backgroundColor: avatarColor(selectedCommit.authorEmail) }}
                    >
                      {initials(selectedCommit.authorName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">{selectedCommit.subject}</div>
                      <div className="text-2xs text-text-muted mt-0.5">
                        <span className="font-mono text-accent-primary">{selectedCommit.shortHash}</span>
                        <span> · </span>
                        <span>{selectedCommit.authorName}</span>
                        <span> · </span>
                        <span>{formatRelativeDate(selectedCommit.date)}</span>
                      </div>
                    </div>
                  </div>
                  {selectedCommit.body && (
                    <pre className="text-xs text-text-secondary whitespace-pre-wrap font-sans overflow-y-auto" style={{ maxHeight: '6rem' }}>{selectedCommit.body}</pre>
                  )}
                  {commitDetail && (
                    <div className="flex items-center gap-3 text-2xs text-text-muted">
                      <span className="text-success">+{commitDetail.insertions}</span>
                      <span className="text-error">-{commitDetail.deletions}</span>
                      <span>{commitDetail.files ? commitDetail.files.length : 0} files changed</span>
                    </div>
                  )}
                </div>

                {/* File list */}
                <div className="flex-shrink-0 max-h-48 overflow-y-auto border-b border-border-default scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary">
                  {commitDetail &&
                    commitDetail.files &&
                    commitDetail.files.map((f) => {
                      const isActive = selectedFilePath === f.path;
                      return (
                        <div
                          key={f.path}
                          onClick={() => handleSelectFile(f)}
                          className={
                            'flex items-center gap-2 px-4 py-1.5 cursor-pointer border-b border-border-default transition-colors ' +
                            (isActive ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary-emphasis')
                          }
                        >
                          <span className={'px-1.5 py-0.5 rounded text-3xs font-semibold flex-shrink-0 ' + (STATUS_COLORS[f.status] || STATUS_COLORS.M)}>
                            {f.status}
                          </span>
                          <span className="text-xs text-text-primary truncate flex-1 font-mono">
                            {f.status === 'R' && f.oldPath ? f.oldPath + ' → ' + f.path : f.path}
                          </span>
                          <span className="text-2xs text-success flex-shrink-0">+{f.additions}</span>
                          <span className="text-2xs text-error flex-shrink-0">-{f.deletions}</span>
                        </div>
                      );
                    })}
                </div>

                {/* Diff */}
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary p-3">
                  {fileDiffLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin h-4 w-4 border-2 border-accent-primary border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div>
                      {commitDetail && commitDetail.files && commitDetail.files.length === 0 ? (
                        <div className="text-text-muted text-sm">No changes in this commit.</div>
                      ) : (
                        commitDetail && (
                          <CodeBlock baseDir={selectedProject} language="" isComplete={true}>
                            {selectedFilePath ? fileDiff : commitDetail.diff}
                          </CodeBlock>
                        )
                      )}
                      {commitDetail && commitDetail.truncated && !selectedFilePath && (
                        <div className="text-2xs text-text-muted mt-2">Diff truncated due to size.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalOverlayLayout>
  );
};

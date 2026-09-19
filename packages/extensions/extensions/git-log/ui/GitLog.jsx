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

  const LANG_BY_EXT = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    json: 'json', md: 'markdown', markdown: 'markdown', css: 'css', scss: 'scss', less: 'less',
    html: 'markup', xml: 'markup', svg: 'markup', yml: 'yaml', yaml: 'yaml', py: 'python',
    sh: 'bash', bash: 'bash', zsh: 'bash', rs: 'rust', go: 'go', java: 'java', kt: 'kotlin',
    php: 'php', rb: 'ruby', c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp', cs: 'csharp',
    swift: 'swift', dart: 'dart', lua: 'lua', r: 'r', sql: 'sql', graphql: 'graphql',
    vue: 'vue', svelte: 'svelte', proto: 'protobuf', toml: 'toml', ini: 'ini', gradle: 'kotlin',
    dockerfile: 'docker', env: 'bash', txt: 'text', lock: 'text',
  };

  const getLanguageForFile = useCallback((path) => {
    if (!path) return null;
    const ext = path.split('.').pop().toLowerCase();
    return LANG_BY_EXT[ext] || 'text';
  }, []);


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
  const [gitCtx, setGitCtx] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [banner, setBanner] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [compareDiff, setCompareDiff] = useState(null);
  const [resetMode, setResetMode] = useState('mixed');
  const [undoMode, setUndoMode] = useState('soft');
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [pushForce, setPushForce] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const listRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const branchContainerRef = useRef(null);
  const contextMenuRef = useRef(null);
  const bannerTimerRef = useRef(null);
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
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [contextMenu]);

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

      const ctxResult = await executeExtensionAction('git-context', dir);
      setGitCtx(ctxResult && !ctxResult.error ? ctxResult : null);
      setLoading(false);
    },
    [executeExtensionAction],
  );

  const handleOpen = useCallback(async () => {
    setShowModal(true);
    const dirs = Array.isArray(projectDirs) ? projectDirs : [];
    const activeDir = data.currentProjectDir;
    let target = activeDir && dirs.includes(activeDir) ? activeDir : selectedProject;
    if (!dirs.includes(target) && dirs.length > 0) target = dirs[0];
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

      const ctxResult = await executeExtensionAction('git-context', selectedProject);
      setGitCtx(ctxResult && !ctxResult.error ? ctxResult : null);
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

  const showBanner = useCallback((type, text) => {
    setBanner({ type, text });
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    if (type === 'success') {
      bannerTimerRef.current = setTimeout(() => setBanner(null), 6000);
    }
  }, []);

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

  const runGitAction = useCallback(
    async (action, args, opts) => {
      if (!selectedProject || actionBusy) return;
      setContextMenu(null);
      setDialog(null);
      setActionBusy(true);
      const result = await executeExtensionAction(action, selectedProject, ...args);
      setActionBusy(false);
      if (result && result.error) {
        showBanner('error', result.error);
        return null;
      }
      if (result && result.patchPath) {
        showBanner('success', 'Patch created: ' + result.patchPath);
        return result;
      }
      if (opts && opts.successMsg) {
        showBanner('success', opts.successMsg);
      }
      await selectProject(selectedProject);
      return result;
    },
    [actionBusy, executeExtensionAction, selectProject, selectedProject, showBanner],
  );

  const handleCopyHash = useCallback(
    (commit) => {
      setContextMenu(null);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(commit.hash).then(
          () => showBanner('success', 'Revision number copied'),
          () => showBanner('error', 'Failed to copy revision number'),
        );
      }
    },
    [showBanner],
  );

  const handleShowAtRevision = useCallback(
    (commit) => {
      setContextMenu(null);
      void handleBranchChange(commit.hash);
    },
    [handleBranchChange],
  );

  const handleCompareLocal = useCallback(
    async (commit) => {
      setContextMenu(null);
      if (!selectedCommit || selectedCommit.hash !== commit.hash) {
        void handleSelectCommit(commit);
      }
      const result = await executeExtensionAction('compare-local', selectedProject, commit.hash);
      if (result && result.error) {
        showBanner('error', result.error);
        return;
      }
      setCompareDiff({ hash: commit.hash, diff: result ? result.diff : '' });
    },
    [executeExtensionAction, handleSelectCommit, selectedCommit, selectedProject, showBanner],
  );

  const handleGoToRelative = useCallback(
    async (commit, direction) => {
      setContextMenu(null);
      const result = await executeExtensionAction('get-neighbors', selectedProject, commit.hash);
      if (!result || result.error) {
        showBanner('error', (result && result.error) || 'Failed to resolve neighbors');
        return;
      }
      const targetHash = direction === 'parent' ? result.parent : result.child;
      if (!targetHash) {
        showBanner('info', direction === 'parent' ? 'No parent commit' : 'No child commit');
        return;
      }
      const target = commits.find((c) => c.hash === targetHash);
      if (!target) {
        showBanner('error', 'Target commit is not in the loaded log — reload or scroll to load more');
        return;
      }
      const idx = filteredCommits.findIndex((c) => c.hash === targetHash);
      handleSelectCommit(target);
      if (idx >= 0 && listRef.current) {
        listRef.current.scrollTop = Math.max(0, idx * ROW_HEIGHT);
      }
    },
    [commits, executeExtensionAction, filteredCommits, handleSelectCommit, selectedProject, showBanner],
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

  const diffLanguage =
    getLanguageForFile(selectedFilePath || (commitDetail && commitDetail.files && commitDetail.files.length ? commitDetail.files[0].path : null)) || 'text';
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
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isSelected) handleSelectCommit(c);
          setCompareDiff(null);
          setContextMenu({
            x: Math.min(e.clientX, window.innerWidth - 280),
            y: Math.min(e.clientY, window.innerHeight - 440),
            commit: c,
          });
        }}
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
        {/* Commit context menu */}
        {contextMenu && (() => {
          const commit = contextMenu.commit;
          const isHead = !!(gitCtx && gitCtx.headHash === commit.hash);
          const closeMenu = () => setContextMenu(null);

          const groups = [
            [
              { label: 'Copy Revision Number', run: () => handleCopyHash(commit) },
              { label: 'Create Patch…', run: () => void runGitAction('create-patch', [commit.hash]) },
              { label: 'Cherry-Pick', run: () => void runGitAction('cherry-pick', [commit.hash], { successMsg: 'Commit cherry-picked onto current branch' }) },
            ],
            [
              { label: 'Checkout Revision', run: () => void runGitAction('checkout-revision', [commit.hash], { successMsg: 'Checked out revision ' + commit.shortHash }) },
              { label: 'Show Repository at Revision', run: () => handleShowAtRevision(commit) },
              { label: 'Compare with Local', run: () => void handleCompareLocal(commit) },
            ],
            [
              { label: 'Reset Current Branch to Here…', run: () => { closeMenu(); setResetMode('mixed'); setDialog({ type: 'reset', commit }); } },
              { label: 'Revert Commit', run: () => void runGitAction('revert-commit', [commit.hash], { successMsg: 'Commit reverted' }) },
              { label: 'Undo Commit…', disabled: !isHead || gitCtx.unpushedCount === 0, run: () => { closeMenu(); setUndoMode('soft'); setDialog({ type: 'undo', commit }); } },
            ],
            [
              { label: 'Edit Commit Message…', disabled: !isHead || gitCtx.unpushedCount === 0, run: () => { closeMenu(); setEditSubject(commit.subject); setEditBody(commit.body || ''); setDialog({ type: 'edit-message', commit }); } },
            ],
            [
              { label: 'Push All up to Here…', disabled: !gitCtx || !gitCtx.currentBranch, run: () => { closeMenu(); setPushForce(false); setDialog({ type: 'push', commit }); } },
            ],
            [
              { label: 'New Branch…', run: () => { closeMenu(); setInputValue(''); setDialog({ type: 'new-branch', commit }); } },
              { label: 'New Tag…', run: () => { closeMenu(); setInputValue(''); setDialog({ type: 'new-tag', commit }); } },
            ],
            [
              { label: 'Go to Parent Commit', run: () => void handleGoToRelative(commit, 'parent') },
              { label: 'Go to Child Commit', run: () => void handleGoToRelative(commit, 'child') },
            ],
            [
              { label: 'View in browser', run: () => void runGitAction('open-commit-url', [commit.hash], { successMsg: 'Opened commit in browser' }) },
            ],
          ];

          return (
            <div
              ref={contextMenuRef}
              className="fixed min-w-56 max-h-[420px] overflow-y-auto bg-bg-secondary-light border border-border-default rounded shadow-lg py-1 scrollbar-thin scrollbar-track-bg-secondary-light scrollbar-thumb-bg-tertiary"
              style={{ left: contextMenu.x, top: contextMenu.y, zIndex: 1100 }}
              onClick={(e) => e.stopPropagation()}
            >
              {groups.map((items, gi) => (
                <div key={gi} className={gi > 0 ? 'border-t border-border-default my-1' : ''}>
                  {items.map((item) => (
                    <div
                      key={item.label}
                      onClick={item.disabled ? undefined : () => item.run()}
                      className={
                        'px-3 py-1.5 text-xs whitespace-nowrap ' +
                        (item.disabled ? 'text-text-muted cursor-not-allowed' : 'text-text-primary cursor-pointer hover:bg-bg-tertiary')
                      }
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Action dialogs */}
        {dialog && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/40"
            style={{ zIndex: 1101 }}
            onClick={() => setDialog(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                const form = document.getElementById('git-log-action-form');
                if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
              }
            }}
          >
            <div
              className="bg-bg-secondary-light border border-border-default rounded shadow-lg p-4 min-w-72 max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {dialog.type === 'reset' && (
                <>
                  <div className="text-sm font-medium text-text-primary mb-1">Reset Current Branch to Here…</div>
                  <div className="text-2xs text-text-muted mb-3">
                    Reset <span className="text-accent-primary">{gitCtx ? gitCtx.currentBranch : ''}</span> to{' '}
                    <span className="font-mono">{dialog.commit.shortHash}</span>
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {[
                      ['soft', 'Soft — keep changes staged'],
                      ['mixed', 'Mixed — keep changes in working tree'],
                      ['hard', 'Hard — discard all changes'],
                    ].map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                        <input
                          type="radio"
                          name="git-log-reset-mode"
                          checked={resetMode === mode}
                          onChange={() => setResetMode(mode)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Button onClick={() => void runGitAction('reset-branch', [dialog.commit.hash, resetMode], { successMsg: 'Branch reset to ' + dialog.commit.shortHash })} size="sm">
                    Reset
                  </Button>
                  <Button onClick={() => setDialog(null)} size="sm" color="secondary" className="ml-2">
                    Cancel
                  </Button>
                </>
              )}
              {dialog.type === 'undo' && (
                <>
                  <div className="text-sm font-medium text-text-primary mb-1">Undo Commit</div>
                  <div className="text-2xs text-text-muted mb-3">
                    Undo <span className="font-mono">{dialog.commit.shortHash}</span> — most recent commit
                  </div>
                  <div className="space-y-1.5 mb-4">
                    {[
                      ['soft', 'Soft — keep changes staged'],
                      ['mixed', 'Mixed — keep changes in working tree'],
                    ].map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                        <input type="radio" name="git-log-undo-mode" checked={undoMode === mode} onChange={() => setUndoMode(mode)} />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Button onClick={() => void runGitAction('undo-commit', [undoMode], { successMsg: 'Commit undone' })} size="sm">
                    Undo Commit
                  </Button>
                  <Button onClick={() => setDialog(null)} size="sm" color="secondary" className="ml-2">
                    Cancel
                  </Button>
                </>
              )}
              {dialog.type === 'edit-message' && (
                <>
                  <div className="text-sm font-medium text-text-primary mb-1">Edit Commit Message</div>
                  <div className="text-2xs text-text-muted mb-3">
                    Amend <span className="font-mono">{dialog.commit.shortHash}</span> (most recent commit)
                  </div>
                  <form
                    id="git-log-action-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void runGitAction('amend-message', [editSubject, editBody], { successMsg: 'Commit message updated' });
                    }}
                  >
                    <Input
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      placeholder="Commit subject"
                      size="sm"
                      className="w-full mb-2"
                      wrapperClassName="w-full"
                      autoFocus
                    />
                    <textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      placeholder="Extended description (optional)"
                      className="w-full h-28 mb-3 px-2 py-1.5 text-xs bg-bg-primary border border-border-default rounded resize-y text-text-primary focus:outline-none focus:border-accent-primary"
                    />
                    <Button type="submit" size="sm">
                      Amend Commit
                    </Button>
                    <Button type="button" onClick={() => setDialog(null)} size="sm" color="secondary" className="ml-2">
                      Cancel
                    </Button>
                  </form>
                </>
              )}
              {dialog.type === 'push' && (
                <>
                  <div className="text-sm font-medium text-text-primary mb-1">Push All up to Here…</div>
                  <div className="text-2xs text-text-muted mb-3">
                    Push all commits up to <span className="font-mono">{dialog.commit.shortHash}</span> to{' '}
                    <span className="text-text-primary">{gitCtx && gitCtx.currentBranch ? gitCtx.currentBranch : 'remote'}</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-text-primary mb-4 cursor-pointer">
                    <input type="checkbox" checked={pushForce} onChange={(e) => setPushForce(e.target.checked)} />
                    Force push
                  </label>
                  <Button onClick={() => void runGitAction('push-up-to', [dialog.commit.hash, pushForce], { successMsg: 'Pushed commits up to ' + dialog.commit.shortHash })} size="sm">
                    Push
                  </Button>
                  <Button onClick={() => setDialog(null)} size="sm" color="secondary" className="ml-2">
                    Cancel
                  </Button>
                </>
              )}
              {(dialog.type === 'new-branch' || dialog.type === 'new-tag') && (
                <>
                  <div className="text-sm font-medium text-text-primary mb-1">{dialog.type === 'new-branch' ? 'New Branch…' : 'New Tag…'}</div>
                  <div className="text-2xs text-text-muted mb-3">
                    {dialog.type === 'new-branch' ? 'Create and checkout' : 'Create'} at{' '}
                    <span className="font-mono">{dialog.commit.shortHash}</span>
                  </div>
                  <form
                    id="git-log-action-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = inputValue.trim();
                      if (!name) return;
                      void runGitAction(
                        dialog.type === 'new-branch' ? 'create-branch' : 'create-tag',
                        [name, dialog.commit.hash],
                        { successMsg: (dialog.type === 'new-branch' ? 'Branch ' : 'Tag ') + name + ' created' },
                      );
                    }}
                  >
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={dialog.type === 'new-branch' ? 'Branch name' : 'Tag name'}
                      size="sm"
                      className="w-full mb-3"
                      wrapperClassName="w-full"
                      autoFocus
                    />
                    <Button type="submit" size="sm">
                      {dialog.type === 'new-branch' ? 'Create & Checkout' : 'Create Tag'}
                    </Button>
                    <Button type="button" onClick={() => setDialog(null)} size="sm" color="secondary" className="ml-2">
                      Cancel
                    </Button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* Banner */}
        {banner && (
          <div
            className={
              'fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded shadow-lg text-xs max-w-[80%] flex items-center gap-3 border ' +
              (banner.type === 'error' ? 'bg-error-subtle text-error border-error' : banner.type === 'info' ? 'bg-info-subtle text-info border-info' : 'bg-success-subtle text-success border-success')
            }
            style={{ zIndex: 1102 }}
          >
            <span className="break-all">{banner.text}</span>
            <button className="flex-shrink-0 cursor-pointer opacity-70 hover:opacity-100" onClick={() => setBanner(null)}>
              ✕
            </button>
          </div>
        )}
        {actionBusy && <div className="fixed inset-0 cursor-wait" style={{ zIndex: 1080 }} />}
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
                      {compareDiff && selectedCommit && compareDiff.hash === selectedCommit.hash ? (
                        <>
                          <div className="flex items-center justify-between mb-2 px-1 sticky top-0">
                            <span className="text-2xs text-warning font-semibold">
                              Comparing {selectedCommit.shortHash} with working tree
                            </span>
                            <button
                              className="text-2xs text-text-muted underline cursor-pointer hover:text-text-primary"
                              onClick={() => setCompareDiff(null)}
                            >
                              Clear comparison
                            </button>
                          </div>
                          <CodeBlock baseDir={selectedProject} language={diffLanguage} isComplete={true}>
                            {compareDiff.diff}
                          </CodeBlock>
                        </>
                      ) : commitDetail && commitDetail.files && commitDetail.files.length === 0 ? (
                        <div className="text-text-muted text-sm">No changes in this commit.</div>
                      ) : (
                        commitDetail && (
                          <CodeBlock baseDir={selectedProject} language={diffLanguage} isComplete={true}>
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

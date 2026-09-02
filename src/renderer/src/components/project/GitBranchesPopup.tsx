import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CgSpinner } from 'react-icons/cg';
import { FaChevronDown, FaChevronRight, FaFolder, FaFolderOpen, FaMagnifyingGlass } from 'react-icons/fa6';
import { IoGitBranch } from 'react-icons/io5';
import { clsx } from 'clsx';
import { BranchInfo } from '@common/types';

type Props = {
  branches: BranchInfo[];
  currentBranch: string;
  loading: boolean;
  recentBranches: string[];
  worktreeMode?: boolean;
  onSelect: (branch: BranchInfo) => void;
  onNewBranchFrom: (branch: BranchInfo) => void;
  onUpdateBranch?: (branch: BranchInfo) => void;
  onMergeIntoCurrent: (branch: BranchInfo) => void;
  onRebaseOnto: (branch: BranchInfo) => void;
  onRebaseWorktreeOnto?: (branch: BranchInfo) => void;
  onDelete: (branch: BranchInfo) => void;
};

type BranchTreeNode = {
  name: string;
  fullPath: string;
  branch?: BranchInfo;
  children: BranchTreeNode[];
};

const buildBranchTree = (branches: BranchInfo[]): BranchTreeNode[] => {
  const roots: BranchTreeNode[] = [];

  for (const branch of branches) {
    const segments = branch.name.split('/');
    let level = roots;
    let prefix = '';

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isLeaf = i === segments.length - 1;

      let node = level.find((n) => n.name === segment);
      if (!node) {
        node = { name: segment, fullPath: prefix, children: [], branch: isLeaf ? branch : undefined };
        level.push(node);
      } else if (isLeaf) {
        node.branch = branch;
      }

      level = node.children;
    }
  }

  return roots;
};

export const GitBranchesPopup = ({
  branches,
  currentBranch,
  loading,
  recentBranches,
  worktreeMode,
  onSelect,
  onNewBranchFrom,
  onUpdateBranch,
  onMergeIntoCurrent,
  onRebaseOnto,
  onRebaseWorktreeOnto,
  onDelete,
}: Props) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [folderOverrides, setFolderOverrides] = useState<Map<string, boolean>>(new Map());
  const [openSubmenu, setOpenSubmenu] = useState<{ branch: BranchInfo; top: number; left: number } | null>(null);

  useEffect(() => {
    if (!openSubmenu) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSubmenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSubmenu]);

  const filtered = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();

    if (!normalizedFilter) {
      return branches;
    }

    return branches.filter((b) => b.name.toLowerCase().includes(normalizedFilter));
  }, [branches, filter]);

  const localTree = useMemo(() => buildBranchTree(filtered.filter((b) => !b.isRemote)), [filtered]);
  const remoteTree = useMemo(() => buildBranchTree(filtered.filter((b) => b.isRemote)), [filtered]);

  const isFolderCollapsed = (fullPath: string) => {
    const override = folderOverrides.get(fullPath);
    if (override !== undefined) {
      return override;
    }

    // Collapsed by default; only folders on the current branch's path start expanded
    const segments = currentBranch ? currentBranch.split('/') : [];
    const expandedFolders = new Set(segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/')));

    return !expandedFolders.has(fullPath);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value);
  };

  const toggleFolder = (fullPath: string, currentlyCollapsed: boolean) => {
    setFolderOverrides((prev) => new Map(prev).set(fullPath, !currentlyCollapsed));
  };

  const showSubmenu = (branch: BranchInfo, e: MouseEvent<HTMLElement>) => {
    const row = e.currentTarget.closest('[class*="group/row"]');
    const rect = (row ?? e.currentTarget).getBoundingClientRect();
    const menuWidth = 240;
    const left = rect.right + menuWidth > window.innerWidth ? rect.left - menuWidth - 6 : rect.right + 2;
    const top = Math.max(8, Math.min(rect.top - 3, window.innerHeight - 120));
    setOpenSubmenu({ branch, top, left });
  };

  const getSubmenuItems = (branch: BranchInfo) => {
    const isCurrent = !branch.isRemote && branch.name === currentBranch;
    const canDelete = !branch.isRemote && !isCurrent && !branch.hasWorktree;
    const canUpdate = !branch.isRemote && Boolean(branch.upstream) && Boolean(onUpdateBranch);

    if (worktreeMode) {
      return [
        ...(canUpdate
          ? [
              {
                key: 'update-from-remote',
                label: t('git.updateFromRemote', { upstream: branch.upstream }),
                disabled: false,
                action: () => onUpdateBranch?.(branch),
              },
            ]
          : []),
        {
          key: 'rebase-worktree',
          label: t('git.rebaseWorktreeOnto', { branch: branch.name }),
          disabled: isCurrent,
          action: () => onRebaseWorktreeOnto?.(branch),
        },
        ...(canDelete
          ? [
              {
                key: 'delete',
                label: t('git.deleteBranchName', { branch: branch.name }),
                disabled: false,
                action: () => onDelete(branch),
              },
            ]
          : []),
      ];
    }

    const items = [
      {
        key: 'checkout',
        label: t('git.checkoutBranch', { branch: branch.name }),
        disabled: isCurrent,
        action: () => onSelect(branch),
      },
      {
        key: 'new-branch-from',
        label: t('git.newBranchFrom', { branch: branch.name }),
        disabled: false,
        action: () => onNewBranchFrom(branch),
      },
      ...(canUpdate
        ? [
            {
              key: 'update-from-remote',
              label: t('git.updateFromRemote', { upstream: branch.upstream }),
              disabled: false,
              action: () => onUpdateBranch?.(branch),
            },
          ]
        : []),
      {
        key: 'rebase',
        label: t('git.rebaseOnto', { current: currentBranch, branch: branch.name }),
        disabled: isCurrent,
        action: () => onRebaseOnto(branch),
      },
      {
        key: 'merge',
        label: t('git.mergeBranchInto', { branch: branch.name, current: currentBranch }),
        disabled: isCurrent,
        action: () => onMergeIntoCurrent(branch),
      },
      ...(canDelete
        ? [
            {
              key: 'delete',
              label: t('git.deleteBranchName', { branch: branch.name }),
              disabled: false,
              action: () => onDelete(branch),
            },
          ]
        : []),
    ];

    return items;
  };

  const renderBranchRow = (branch: BranchInfo, depth: number, label?: string) => {
    const isCurrent = !branch.isRemote && branch.name === currentBranch;

    return (
      <div
        key={branch.name}
        onClick={(e) => {
          if (openSubmenu?.branch.name === branch.name) {
            setOpenSubmenu(null);
          } else {
            showSubmenu(branch, e);
          }
        }}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={clsx(
          'group/row flex h-[22px] items-center justify-between gap-1 pr-2 cursor-pointer transition-colors duration-200',
          isCurrent ? 'bg-bg-tertiary' : 'hover:bg-bg-tertiary',
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <IoGitBranch className={clsx('h-2.5 w-2.5 shrink-0', isCurrent ? 'text-warning' : 'text-text-muted')} />
          <span className={clsx('truncate text-2xs', isCurrent ? 'font-medium text-text-primary' : 'text-text-secondary')}>{label ?? branch.name}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!!branch.ahead && <span className="text-2xs text-text-muted">↑{branch.ahead}</span>}
          {!!branch.behind && <span className="text-2xs text-text-muted">↓{branch.behind}</span>}
          {branch.upstream && !branch.ahead && !branch.behind && (
            <span className="max-w-[90px] truncate text-2xs text-text-muted-dark group-hover/row:hidden">{branch.upstream}</span>
          )}
          <span className={clsx('flex items-center p-0.5 text-text-muted', openSubmenu?.branch.name === branch.name ? 'flex' : 'hidden group-hover/row:flex')}>
            <FaChevronRight className="h-2.5 w-2.5" />
          </span>
        </div>
      </div>
    );
  };

  const isFilterActive = filter.trim().length > 0;

  const renderFolderRow = (node: BranchTreeNode, depth: number) => {
    const isCollapsed = !isFilterActive && isFolderCollapsed(node.fullPath);

    return (
      <div key={`folder-${node.fullPath}`}>
        <div
          onClick={() => toggleFolder(node.fullPath, isCollapsed)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className="flex h-[22px] cursor-pointer items-center gap-1.5 pr-2 transition-colors duration-200 hover:bg-bg-tertiary"
        >
          <FaChevronDown className={clsx('h-2 w-2 shrink-0 text-text-muted transition-transform duration-200', isCollapsed && '-rotate-90')} />
          {isCollapsed ? <FaFolder className="h-2.5 w-2.5 shrink-0 text-text-muted" /> : <FaFolderOpen className="h-2.5 w-2.5 shrink-0 text-text-muted" />}
          <span className="truncate text-2xs text-text-secondary">{node.name}</span>
        </div>
        {!isCollapsed && renderNodes(node.children, depth + 1)}
      </div>
    );
  };

  const renderNodes = (nodes: BranchTreeNode[], depth: number) => {
    const sorted = [...nodes].sort((a, b) => {
      if (!!a.children.length !== !!b.children.length) {
        return a.children.length ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return sorted.map((node) => (
      <div key={`node-${node.fullPath}`}>
        {node.branch && renderBranchRow(node.branch, depth, node.name)}
        {node.children.length > 0 && renderFolderRow(node, depth)}
      </div>
    ));
  };

  const renderSection = (title: string, tree: BranchTreeNode[]) => {
    if (tree.length === 0) {
      return null;
    }

    return (
      <div>
        <div className="sticky top-0 z-10 border-b border-border-default-dark bg-bg-secondary px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-text-primary">
          {title}
        </div>
        {renderNodes(tree, 0)}
      </div>
    );
  };

  const recentList = useMemo(() => {
    const recentNames = new Set(recentBranches);

    return branches.filter((b) => !b.isRemote && recentNames.has(b.name)).sort((a, b) => recentBranches.indexOf(a.name) - recentBranches.indexOf(b.name));
  }, [branches, recentBranches]);

  return (
    <div>
      <div className="flex items-center space-x-2 border-t border-border-default-dark bg-bg-primary-light p-2">
        <div className="relative flex-grow">
          <FaMagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" />
          <input
            value={filter}
            onChange={(e) => handleFilterChange(e.target.value)}
            placeholder={t('git.searchBranches')}
            className="w-full rounded border border-border-default bg-bg-secondary-light py-1 pl-7 pr-2 text-xs text-text-primary placeholder-text-muted focus:border-border-accent focus:outline-none"
            autoFocus
          />
        </div>
      </div>

      <div
        className="scrollbar-thin scrollbar-track-bg-primary-light scrollbar-thumb-bg-tertiary hover:scrollbar-thumb-bg-fourth max-h-[300px] overflow-y-auto pb-1"
        onScroll={() => setOpenSubmenu(null)}
      >
        {loading && branches.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-2xs text-text-muted">
            <CgSpinner className="h-3 w-3 animate-spin" />
            {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-4 text-center text-2xs text-text-muted">{t('git.noBranchesFound')}</div>
        ) : (
          <>
            {!isFilterActive && recentList.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 border-b border-border-default-dark bg-bg-secondary px-3 py-1 text-2xs font-semibold uppercase tracking-wide text-text-primary">
                  {t('git.recentBranches')}
                </div>
                {recentList.map((branch) => renderBranchRow(branch, 0))}
              </div>
            )}
            {renderSection(t('git.localBranches'), localTree)}
            {renderSection(t('git.remoteBranches'), remoteTree)}
          </>
        )}
      </div>
      {openSubmenu && (
        <div
          className="fixed z-50 w-60 rounded-md border border-border-default-dark bg-bg-primary-light py-1 shadow-lg"
          style={{ top: openSubmenu.top, left: openSubmenu.left }}
        >
          {getSubmenuItems(openSubmenu.branch).map((item) => (
            <button
              key={item.key}
              disabled={item.disabled}
              onClick={() => {
                setOpenSubmenu(null);
                item.action();
              }}
              className={clsx(
                'flex w-full items-center px-3 py-[3px] text-left text-2xs',
                item.disabled ? 'cursor-default text-text-muted' : 'text-text-primary hover:bg-bg-tertiary',
              )}
            >
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

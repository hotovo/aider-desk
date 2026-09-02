import { useCallback, useEffect, useRef, useState } from 'react';
import { FaArrowsRotate, FaBan, FaCodeMerge, FaCompress, FaDownload, FaFileLines, FaPlay, FaPlus, FaRobot, FaUpload } from 'react-icons/fa6';
import { TbDeviceImacDown } from 'react-icons/tb';
import { FaPencilAlt } from 'react-icons/fa';
import { IoGitBranch } from 'react-icons/io5';
import { VscWorktreeSmall } from 'react-icons/vsc';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { BranchInfo, GitSyncCommits, WorktreeIntegrationStatus } from '@common/types';

import { useApi } from '@/contexts/ApiContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { InlineEditPanel } from '@/components/common/InlineEditPanel';
import { WorktreeActionDialog } from '@/components/project/WorktreeActionDialog';
import { GitStatusBadges } from '@/components/project/GitStatusBadges';
import { GitBranchesPopup } from '@/components/project/GitBranchesPopup';
import { Tooltip } from '@/components/ui/Tooltip';
import { showErrorNotification, showInfoNotification } from '@/utils/notifications';

const LocalModeIcon = TbDeviceImacDown;
const WorktreeModeIcon = VscWorktreeSmall;

const MAX_BRANCH_NAME_LENGTH = 50;
const TRUNCATED_TAIL_LENGTH = 5;

const truncateBranchName = (name: string) => {
  if (name.length <= MAX_BRANCH_NAME_LENGTH) {
    return name;
  }

  const headLength = MAX_BRANCH_NAME_LENGTH - 3 - TRUNCATED_TAIL_LENGTH;
  return `${name.slice(0, headLength)}...${name.slice(-TRUNCATED_TAIL_LENGTH)}`;
};

const MAX_TOOLTIP_ITEMS = 20;

const formatTruncatedList = (items: string[]) => {
  if (items.length <= MAX_TOOLTIP_ITEMS) {
    return items;
  }

  const remaining = items.length - MAX_TOOLTIP_ITEMS;
  return [...items.slice(0, MAX_TOOLTIP_ITEMS), `...and ${remaining} more`];
};

const buildCommitsTooltip = (label: string, commits: string[]) => {
  const list = formatTruncatedList(commits);
  return `${label}\n${list.join('\n')}`;
};

type Props = {
  baseDir: string;
  worktreePath?: string;
  status?: WorktreeIntegrationStatus | null;
  taskName?: string;
  disabled?: boolean;
  onSwitchToLocal: () => void;
  onSwitchToWorktree: () => void;
  willShowConfirmDialog?: boolean;
  onMerge: (targetBranch?: string) => void;
  onSquash: (targetBranch?: string, commitMessage?: string) => void;
  onOnlyUncommitted: (targetBranch?: string) => void;
  onRebaseFromBranch: (fromBranch?: string) => void;
  onAbortRebase: () => void;
  onContinueRebase: () => void;
  onResolveConflictsWithAgent: () => void;
  onRenameBranch: (newBranchName: string) => Promise<void>;
  canAbortRebase?: boolean;
  canContinueRebase?: boolean;
  canResolveConflictsWithAgent?: boolean;
};

export const GitBranchesButton = ({
  baseDir,
  worktreePath,
  status,
  taskName,
  disabled,
  onSwitchToLocal,
  onSwitchToWorktree,
  willShowConfirmDialog,
  onMerge,
  onSquash,
  onOnlyUncommitted,
  onRebaseFromBranch,
  onAbortRebase,
  onContinueRebase,
  onResolveConflictsWithAgent,
  onRenameBranch,
  canAbortRebase,
  canContinueRebase,
  canResolveConflictsWithAgent,
}: Props) => {
  const { t } = useTranslation();
  const api = useApi();

  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncCommits, setSyncCommits] = useState<GitSyncCommits>({ outgoing: { count: 0, commits: [] }, incoming: { count: 0, commits: [] } });
  const [recentBranches, setRecentBranches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`git-recent-branches-${baseDir}`) || '[]');
    } catch {
      return [];
    }
  });

  const [showNewBranchInput, setShowNewBranchInput] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  const [branchToCheckout, setBranchToCheckout] = useState<BranchInfo | null>(null);
  const [branchToBase, setBranchToBase] = useState<BranchInfo | null>(null);
  const [newBranchFromName, setNewBranchFromName] = useState('');
  const [branchToMerge, setBranchToMerge] = useState<BranchInfo | null>(null);
  const [branchToRebase, setBranchToRebase] = useState<BranchInfo | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<BranchInfo | null>(null);
  const [forceDelete, setForceDelete] = useState(false);

  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [editBranchName, setEditBranchName] = useState('');

  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSquashDialog, setShowSquashDialog] = useState(false);
  const [showOnlyUncommittedDialog, setShowOnlyUncommittedDialog] = useState(false);
  const [showAbortRebaseConfirm, setShowAbortRebaseConfirm] = useState(false);
  const [showContinueRebaseConfirm, setShowContinueRebaseConfirm] = useState(false);
  const [showResolveWithAgentConfirm, setShowResolveWithAgentConfirm] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  const repoPath = worktreePath || baseDir;
  const currentBranch = branches.find((b) => b.isCurrent)?.name || status?.currentBranch || '';
  const isWorktree = Boolean(worktreePath);

  const incomingCount = syncCommits.incoming.count;
  const outgoingCount = syncCommits.outgoing.count;
  const commitChanges: string[] = [];
  if (outgoingCount > 0) {
    commitChanges.push(buildCommitsTooltip(t('git.outgoingCommitsTooltip', { count: outgoingCount }), syncCommits.outgoing.commits));
  }
  if (incomingCount > 0) {
    commitChanges.push(buildCommitsTooltip(t('git.incomingCommitsTooltip', { count: incomingCount }), syncCommits.incoming.commits));
  }
  const branchesTooltip = `${t('git.gitBranchLabel', { branch: currentBranch || t('git.noCurrentBranch') })}\n${commitChanges.length > 0 ? `\n${commitChanges.join('\n\n')}` : t('git.upToDate')}`;

  const recentBranchesWithCurrent = currentBranch ? [currentBranch, ...recentBranches.filter((name) => name !== currentBranch)] : recentBranches;

  const [mainBranchName, setMainBranchName] = useState<string | null>(null);

  const loadBranches = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listGitBranches(repoPath, true);
      setBranches(list);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : String(error));
      setBranches([]);
    } finally {
      setLoading(false);
    }
  }, [api, repoPath]);

  const loadMainBranch = useCallback(async () => {
    if (!worktreePath) {
      return;
    }

    try {
      const list = await api.listGitBranches(baseDir, false);
      setMainBranchName(list.find((b) => b.isCurrent)?.name || null);
    } catch {
      setMainBranchName(null);
    }
  }, [api, baseDir, worktreePath]);

  const loadSyncCommits = useCallback(async () => {
    try {
      const result = await api.getSyncCommits(repoPath, isWorktree ? status?.targetBranch : undefined);
      setSyncCommits(result);
    } catch {
      setSyncCommits({ outgoing: { count: 0, commits: [] }, incoming: { count: 0, commits: [] } });
    }
  }, [api, repoPath, isWorktree, status?.targetBranch]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    void loadMainBranch();
  }, [loadMainBranch]);

  useEffect(() => {
    void loadSyncCommits();
  }, [loadSyncCommits]);

  useEffect(() => {
    if (isOpen) {
      void loadBranches();
      void loadMainBranch();
      void loadSyncCommits();
    }
  }, [isOpen, loadBranches, loadMainBranch, loadSyncCommits]);

  const handleError = (error: unknown) => {
    showErrorNotification(error instanceof Error ? error.message : String(error));
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setShowNewBranchInput(false);
    setNewBranchName('');
    setBranchToCheckout(null);
    setBranchToBase(null);
    setNewBranchFromName('');
  };

  const handleCreateBranchConfirm = async () => {
    if (isWorktree) {
      showErrorNotification(t('git.actionNotAvailableInWorktree'));
      return;
    }

    const trimmedName = newBranchName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      await api.createGitBranch(repoPath, trimmedName, undefined, true);
      showInfoNotification(t('git.branchCreated', { branch: trimmedName }));
      trackRecentBranch(trimmedName);
      setShowNewBranchInput(false);
      setNewBranchName('');
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handleNewBranchFrom = (branch: BranchInfo) => {
    setBranchToBase(branch);
    setNewBranchFromName('');
  };

  const handleCreateBranchFromConfirm = async () => {
    if (isWorktree) {
      showErrorNotification(t('git.actionNotAvailableInWorktree'));
      return;
    }

    const trimmedName = newBranchFromName.trim();
    if (!trimmedName || !branchToBase) {
      return;
    }

    try {
      await api.createGitBranch(repoPath, trimmedName, branchToBase.name, true);
      showInfoNotification(t('git.branchCreated', { branch: trimmedName }));
      trackRecentBranch(trimmedName);
      setBranchToBase(null);
      setNewBranchFromName('');
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handleSelect = (branch: BranchInfo) => {
    if (!branch.isRemote && branch.name === currentBranch) {
      return;
    }

    if (!branch.isRemote && branch.hasWorktree) {
      handleCloseDropdown();
      setBranchToCheckout(branch);
      return;
    }

    void performCheckout(branch);
  };

  const trackRecentBranch = (branchName: string) => {
    setRecentBranches((prev) => {
      const next = [branchName, ...prev.filter((name) => name !== branchName)].slice(0, 3);
      try {
        localStorage.setItem(`git-recent-branches-${baseDir}`, JSON.stringify(next));
      } catch {
        // ignore persistence errors
      }
      return next;
    });
  };

  const performCheckout = async (branch: BranchInfo, takeOver = false) => {
    if (isWorktree) {
      showErrorNotification(t('git.actionNotAvailableInWorktree'));
      return;
    }

    handleCloseDropdown();
    try {
      await api.checkoutGitBranch(repoPath, branch.name, branch.isRemote, takeOver);
      showInfoNotification(t('git.checkedOutBranch', { branch: branch.name }));
      trackRecentBranch(branch.name);
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const performMerge = async (branch: BranchInfo) => {
    try {
      const result = await api.mergeIntoCurrentBranch(repoPath, branch.name);
      if (result.conflictedFiles && result.conflictedFiles.length > 0) {
        showErrorNotification(t('git.mergeConflicts', { files: result.conflictedFiles.join(', ') }));
      } else {
        showInfoNotification(t('git.mergedIntoCurrent', { branch: branch.name }));
      }
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const performRebase = async (branch: BranchInfo) => {
    try {
      const result = await api.rebaseOntoBranch(repoPath, branch.name);
      if (result.conflictedFiles && result.conflictedFiles.length > 0) {
        showErrorNotification(t('git.rebaseConflicts', { files: result.conflictedFiles.join(', ') }));
      } else {
        showInfoNotification(t('git.rebasedOnto', { branch: branch.name }));
      }
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handleMergeIntoCurrent = (branch: BranchInfo) => {
    handleCloseDropdown();
    setBranchToMerge(branch);
  };

  const handleRebaseOnto = (branch: BranchInfo) => {
    handleCloseDropdown();
    setBranchToRebase(branch);
  };

  const handleRebaseWorktreeOnto = (branch: BranchInfo) => {
    handleCloseDropdown();
    onRebaseFromBranch(branch.name);
  };

  const handleDelete = (branch: BranchInfo) => {
    handleCloseDropdown();
    setForceDelete(false);
    setBranchToDelete(branch);
  };

  const handleDeleteConfirm = async () => {
    if (!branchToDelete) {
      return;
    }

    try {
      await api.deleteGitBranch(repoPath, branchToDelete.name, forceDelete);
      showInfoNotification(t('git.branchDeleted', { branch: branchToDelete.name }));
      setBranchToDelete(null);
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      setBranchToDelete(null);
      if (!forceDelete && error instanceof Error && error.message.includes('not fully merged')) {
        setForceDelete(true);
        setBranchToDelete(branchToDelete);
      } else {
        handleError(error);
      }
    }
  };

  const handlePull = async () => {
    handleCloseDropdown();
    try {
      const result = await api.gitPull(repoPath);
      const isUpToDate = /up to date/i.test(result.output);
      showInfoNotification(isUpToDate ? t('git.pullUpToDate') : t('git.pullSuccess'));
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handleUpdateBranch = async (branch: BranchInfo) => {
    handleCloseDropdown();
    try {
      await api.updateGitBranch(repoPath, branch.name);
      showInfoNotification(t('git.branchUpdated', { branch: branch.name }));
      await loadBranches();
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handlePush = async () => {
    handleCloseDropdown();
    try {
      await api.gitPush(repoPath);
      showInfoNotification(t('git.pushSuccess'));
      await loadSyncCommits();
    } catch (error) {
      handleError(error);
    }
  };

  const handleEditBranch = () => {
    setEditBranchName(currentBranch);
    setIsEditingBranch(true);
  };

  const handleBranchEditConfirm = async () => {
    const trimmedName = editBranchName.trim();
    if (trimmedName && trimmedName !== currentBranch) {
      await onRenameBranch(trimmedName);
    }
    setIsEditingBranch(false);
  };

  const handleBranchEditCancel = () => {
    setIsEditingBranch(false);
  };

  const handleShowWorktreeDialog = (dialogSetter: (value: boolean) => void) => {
    handleCloseDropdown();
    dialogSetter(true);
  };

  const handleSwitchToLocal = () => {
    if (!disabled) {
      handleCloseDropdown();
      onSwitchToLocal();
    }
  };

  const handleSwitchToWorktree = () => {
    if (!disabled) {
      handleCloseDropdown();
      onSwitchToWorktree();
    }
  };

  const menuItemClass = 'w-full px-3 py-1 text-left text-2xs text-text-primary hover:bg-bg-tertiary transition-colors flex items-center gap-2';

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center min-w-0 gap-0.5">
        <Tooltip content={branchesTooltip}>
          <button
            onClick={handleToggle}
            disabled={disabled}
            className="flex items-center gap-1 px-2 py-1 text-text-primary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-2xs rounded disabled:opacity-50 disabled:cursor-not-allowed min-w-0"
          >
            <IoGitBranch className="w-3.5 h-3.5 shrink-0" />
            {currentBranch && <span className="text-2xs min-w-0 truncate max-w-[140px] md:max-w-none">{truncateBranchName(currentBranch)}</span>}
            <GitStatusBadges status={status} showOutgoing={outgoingCount > 0} showIncoming={incomingCount > 0} />
            <MdKeyboardArrowDown className="w-3 h-3 shrink-0" />
          </button>
        </Tooltip>
        <Tooltip content={`${isWorktree ? t('workingMode.switchToLocal') : t('workingMode.switchToWorktree')}${willShowConfirmDialog ? '...' : ''}`}>
          <button
            onClick={isWorktree ? handleSwitchToLocal : handleSwitchToWorktree}
            disabled={disabled}
            className="p-1.5 rounded text-text-primary hover:bg-bg-secondary-light focus:outline-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isWorktree ? <LocalModeIcon className="w-3.5 h-3.5" /> : <WorktreeModeIcon className="w-3.5 h-3.5" />}
          </button>
        </Tooltip>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded shadow-lg z-50 w-[320px]">
          <div className="border-b border-border-default-dark">
            <div className="group/header px-3 py-1 flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <IoGitBranch className="w-3 h-3 text-text-muted shrink-0" />
                <span className="text-2xs text-text-muted truncate">{currentBranch || t('git.noCurrentBranch')}</span>
              </div>
              {currentBranch && (
                <Tooltip content={t('worktree.renameBranch')}>
                  <button
                    onClick={handleEditBranch}
                    className="ml-1 p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary flex shrink-0"
                    disabled={isEditingBranch || disabled}
                  >
                    <FaPencilAlt className="w-2.5 h-2.5" />
                  </button>
                </Tooltip>
              )}
            </div>
            {status?.baseBranch && (
              <div className="px-3 py-0.5 pb-1.5 text-2xs text-text-muted">
                {t('worktree.basedOn')}: <span className="text-text-secondary">{status.baseBranch}</span>
              </div>
            )}
          </div>
          {isEditingBranch && (
            <InlineEditPanel
              value={editBranchName}
              onChange={setEditBranchName}
              onConfirm={() => void handleBranchEditConfirm()}
              onCancel={handleBranchEditCancel}
              placeholder={t('worktree.branchNamePlaceholder')}
            />
          )}

          <div className="border-b border-border-default-dark">
            <button onClick={isWorktree ? handleSwitchToLocal : handleSwitchToWorktree} className={menuItemClass} disabled={disabled}>
              {isWorktree ? <LocalModeIcon className="w-3 h-3" /> : <WorktreeModeIcon className="w-3 h-3" />}
              {isWorktree ? t('workingMode.switchToLocal') : t('workingMode.switchToWorktree')}
              {willShowConfirmDialog ? '...' : ''}
            </button>
          </div>

          {isWorktree && (
            <div className="border-b border-border-default-dark py-1">
              <Tooltip content={t('worktree.mergeIntoBranchTooltip')} side="left" delayDuration={700}>
                <button onClick={() => handleShowWorktreeDialog(setShowMergeDialog)} className={menuItemClass} disabled={disabled}>
                  <FaCodeMerge className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.mergeIntoBranch')}
                </button>
              </Tooltip>
              <Tooltip content={t('worktree.squashIntoBranchTooltip')} side="left" delayDuration={700}>
                <button onClick={() => handleShowWorktreeDialog(setShowSquashDialog)} className={menuItemClass} disabled={disabled}>
                  <FaCompress className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.squashIntoBranch')}
                </button>
              </Tooltip>
              <Tooltip content={t('worktree.applyUncommittedChangesTooltip')} side="left" delayDuration={700}>
                <button onClick={() => handleShowWorktreeDialog(setShowOnlyUncommittedDialog)} className={menuItemClass} disabled={disabled}>
                  <FaFileLines className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.applyUncommittedChanges')}
                </button>
              </Tooltip>
              <Tooltip
                content={mainBranchName ? t('worktree.rebaseFromCurrentBranchTooltip', { branch: mainBranchName }) : t('worktree.confirmRebaseMessage')}
                side="left"
                delayDuration={700}
              >
                <button
                  onClick={() => {
                    if (mainBranchName) {
                      onRebaseFromBranch(mainBranchName);
                    }
                  }}
                  className={menuItemClass}
                  disabled={disabled || !mainBranchName}
                >
                  <FaArrowsRotate className="w-3 h-3 flex-shrink-0" />
                  {mainBranchName ? t('worktree.rebaseFromCurrentBranch', { branch: mainBranchName }) : t('worktree.rebaseFromBranch')}
                </button>
              </Tooltip>

              {canAbortRebase && (
                <button
                  onClick={() => handleShowWorktreeDialog(setShowAbortRebaseConfirm)}
                  disabled={!canAbortRebase}
                  className={`${menuItemClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FaBan className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.abortRebase')}
                </button>
              )}
              {canContinueRebase && (
                <button
                  onClick={() => handleShowWorktreeDialog(setShowContinueRebaseConfirm)}
                  disabled={!canContinueRebase}
                  className={`${menuItemClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FaPlay className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.continueRebase')}
                </button>
              )}
              {canResolveConflictsWithAgent && (
                <button
                  onClick={() => handleShowWorktreeDialog(setShowResolveWithAgentConfirm)}
                  disabled={!canResolveConflictsWithAgent}
                  className={`${menuItemClass} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <FaRobot className="w-3 h-3 flex-shrink-0" />
                  {t('worktree.resolveConflictsWithAgent')}
                </button>
              )}
            </div>
          )}

          {!isWorktree && (
            <div className="border-b border-border-default-dark py-1">
              {!showNewBranchInput && !branchToBase && (
                <button onClick={() => setShowNewBranchInput(true)} className={menuItemClass}>
                  <FaPlus className="w-3 h-3" />
                  {t('git.newBranch')}
                </button>
              )}
              {branchToBase && (
                <InlineEditPanel
                  value={newBranchFromName}
                  onChange={setNewBranchFromName}
                  onConfirm={() => void handleCreateBranchFromConfirm()}
                  onCancel={() => {
                    setBranchToBase(null);
                    setNewBranchFromName('');
                  }}
                  placeholder={t('git.newBranchNamePlaceholder')}
                />
              )}
              {showNewBranchInput && (
                <InlineEditPanel
                  value={newBranchName}
                  onChange={setNewBranchName}
                  onConfirm={() => void handleCreateBranchConfirm()}
                  onCancel={() => {
                    setShowNewBranchInput(false);
                    setNewBranchName('');
                  }}
                  placeholder={t('git.newBranchNamePlaceholder')}
                />
              )}

              <button onClick={() => void handlePull()} className={menuItemClass}>
                <FaDownload className="w-3 h-3" />
                {t('git.updateProject')}
              </button>
              <button onClick={() => void handlePush()} className={menuItemClass}>
                <FaUpload className="w-3 h-3" />
                {t('git.push')}
              </button>
            </div>
          )}

          <GitBranchesPopup
            branches={branches}
            currentBranch={currentBranch}
            loading={loading}
            recentBranches={recentBranchesWithCurrent}
            worktreeMode={isWorktree}
            onSelect={handleSelect}
            onNewBranchFrom={handleNewBranchFrom}
            onUpdateBranch={handleUpdateBranch}
            onMergeIntoCurrent={handleMergeIntoCurrent}
            onRebaseOnto={handleRebaseOnto}
            onRebaseWorktreeOnto={handleRebaseWorktreeOnto}
            onDelete={handleDelete}
          />
        </div>
      )}

      {branchToCheckout && (
        <ConfirmDialog
          title={t('git.confirmCheckoutTitle')}
          onConfirm={() => void performCheckout(branchToCheckout, true)}
          onCancel={() => setBranchToCheckout(null)}
          confirmButtonText={t('git.checkout')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('git.confirmCheckoutMessage', { branch: branchToCheckout.name })}</p>
        </ConfirmDialog>
      )}

      {branchToMerge && (
        <ConfirmDialog
          title={t('git.confirmMergeTitle')}
          onConfirm={() => {
            const branch = branchToMerge;
            setBranchToMerge(null);
            void performMerge(branch);
          }}
          onCancel={() => setBranchToMerge(null)}
          confirmButtonText={t('git.merge')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('git.confirmMergeMessage', { branch: branchToMerge.name })}</p>
        </ConfirmDialog>
      )}

      {branchToRebase && (
        <ConfirmDialog
          title={t('git.confirmRebaseTitle')}
          onConfirm={() => {
            const branch = branchToRebase;
            setBranchToRebase(null);
            void performRebase(branch);
          }}
          onCancel={() => setBranchToRebase(null)}
          confirmButtonText={t('git.rebase')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('git.confirmRebaseMessage', { branch: branchToRebase.name })}</p>
        </ConfirmDialog>
      )}

      {branchToDelete && (
        <ConfirmDialog
          title={t('git.confirmDeleteTitle')}
          onConfirm={() => void handleDeleteConfirm()}
          onCancel={() => setBranchToDelete(null)}
          confirmButtonText={forceDelete ? t('git.deleteForce') : t('git.deleteBranch')}
          closeOnEscape
        >
          <p className="text-sm mb-3">
            {forceDelete ? t('git.confirmForceDeleteMessage', { branch: branchToDelete.name }) : t('git.confirmDeleteMessage', { branch: branchToDelete.name })}
          </p>
        </ConfirmDialog>
      )}

      {showMergeDialog && (
        <WorktreeActionDialog
          baseDir={baseDir}
          title={t('worktree.confirmMergeTitle')}
          message={t('worktree.confirmMergeMessage')}
          confirmButtonText={t('worktree.merge')}
          defaultBranch={status?.targetBranch}
          onCancel={() => setShowMergeDialog(false)}
          onConfirm={(branch) => {
            setShowMergeDialog(false);
            onMerge(branch);
          }}
        />
      )}

      {showSquashDialog && (
        <WorktreeActionDialog
          baseDir={baseDir}
          title={t('worktree.confirmSquashTitle')}
          message={t('worktree.confirmSquashMessage')}
          confirmButtonText={t('worktree.squash')}
          defaultBranch={status?.targetBranch}
          showCommitMessage
          initialCommitMessage={
            status?.aheadCommits.commits && status.aheadCommits.commits.length > 0 ? status.aheadCommits.commits[0].split(' ').slice(1).join(' ') : taskName
          }
          onCancel={() => setShowSquashDialog(false)}
          onConfirm={(branch, commitMessage) => {
            setShowSquashDialog(false);
            onSquash(branch, commitMessage);
          }}
        />
      )}

      {showOnlyUncommittedDialog && (
        <WorktreeActionDialog
          baseDir={baseDir}
          title={t('worktree.confirmOnlyUncommittedTitle')}
          message={t('worktree.confirmOnlyUncommittedMessage')}
          confirmButtonText={t('worktree.onlyUncommitted')}
          defaultBranch={status?.targetBranch}
          onCancel={() => setShowOnlyUncommittedDialog(false)}
          onConfirm={(branch) => {
            setShowOnlyUncommittedDialog(false);
            onOnlyUncommitted(branch);
          }}
        />
      )}

      {showAbortRebaseConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmAbortRebaseTitle')}
          onConfirm={() => {
            setShowAbortRebaseConfirm(false);
            onAbortRebase();
          }}
          onCancel={() => setShowAbortRebaseConfirm(false)}
          confirmButtonText={t('worktree.abortRebase')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmAbortRebaseMessage')}</p>
        </ConfirmDialog>
      )}

      {showContinueRebaseConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmContinueRebaseTitle')}
          onConfirm={() => {
            setShowContinueRebaseConfirm(false);
            onContinueRebase();
          }}
          onCancel={() => setShowContinueRebaseConfirm(false)}
          confirmButtonText={t('worktree.continueRebase')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmContinueRebaseMessage')}</p>
        </ConfirmDialog>
      )}

      {showResolveWithAgentConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmResolveConflictsWithAgentTitle')}
          onConfirm={() => {
            setShowResolveWithAgentConfirm(false);
            onResolveConflictsWithAgent();
          }}
          onCancel={() => setShowResolveWithAgentConfirm(false)}
          confirmButtonText={t('worktree.resolveConflictsWithAgent')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmResolveConflictsWithAgentMessage')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
};

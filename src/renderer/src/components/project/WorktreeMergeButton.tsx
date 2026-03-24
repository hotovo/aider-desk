import { useState, useRef } from 'react';
import { FaArrowsRotate, FaBan, FaCodeMerge, FaCompress, FaDownload, FaFileLines, FaPlay, FaRobot } from 'react-icons/fa6';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
import { WorktreeIntegrationStatus } from '@common/types';

import { useClickOutside } from '@/hooks/useClickOutside';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { WorktreeActionDialog } from '@/components/project/WorktreeActionDialog';
import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  baseDir: string;
  defaultBranch?: string;
  onMerge: (targetBranch?: string) => void;
  onSquash: (targetBranch?: string, commitMessage?: string) => void;
  onOnlyUncommitted: (targetBranch?: string) => void;
  onRebaseFromBranch: (fromBranch?: string) => void;
  onAbortRebase: () => void;
  onContinueRebase: () => void;
  onResolveConflictsWithAgent: () => void;
  disabled?: boolean;
  canAbortRebase?: boolean;
  canContinueRebase?: boolean;
  canResolveConflictsWithAgent?: boolean;
  status?: WorktreeIntegrationStatus | null;
  taskName?: string;
};

export const WorktreeMergeButton = ({
  baseDir,
  defaultBranch,
  onMerge,
  onSquash,
  onOnlyUncommitted,
  onRebaseFromBranch,
  onAbortRebase,
  onContinueRebase,
  onResolveConflictsWithAgent,
  disabled,
  canAbortRebase,
  canContinueRebase,
  canResolveConflictsWithAgent,
  status,
  taskName,
}: Props) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [showAbortRebaseConfirm, setShowAbortRebaseConfirm] = useState(false);
  const [showContinueRebaseConfirm, setShowContinueRebaseConfirm] = useState(false);
  const [showResolveWithAgentConfirm, setShowResolveWithAgentConfirm] = useState(false);

  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showSquashDialog, setShowSquashDialog] = useState(false);
  const [showOnlyUncommittedDialog, setShowOnlyUncommittedDialog] = useState(false);
  const [showRebaseDialog, setShowRebaseDialog] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleMergeClick = () => {
    setIsOpen(false);
    setShowMergeDialog(true);
  };

  const handleSquashClick = () => {
    setIsOpen(false);
    setShowSquashDialog(true);
  };

  const handleOnlyUncommittedClick = () => {
    setIsOpen(false);
    setShowOnlyUncommittedDialog(true);
  };

  const handleRebaseClick = () => {
    setIsOpen(false);
    setShowRebaseDialog(true);
  };

  const handleAbortRebaseClick = () => {
    setIsOpen(false);
    setShowAbortRebaseConfirm(true);
  };

  const handleContinueRebaseClick = () => {
    setIsOpen(false);
    setShowContinueRebaseConfirm(true);
  };

  const handleResolveWithAgentClick = () => {
    setIsOpen(false);
    setShowResolveWithAgentConfirm(true);
  };

  const handleAbortRebaseConfirm = () => {
    setShowAbortRebaseConfirm(false);
    onAbortRebase();
  };

  const handleContinueRebaseConfirm = () => {
    setShowContinueRebaseConfirm(false);
    onContinueRebase();
  };

  const handleResolveWithAgentConfirm = () => {
    setShowResolveWithAgentConfirm(false);
    onResolveConflictsWithAgent();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Tooltip content={t('worktree.mergeTooltip')}>
        <button
          onClick={handleToggle}
          disabled={disabled}
          className="flex items-center gap-1 px-2 py-1 text-text-tertiary hover:bg-bg-secondary-light hover:text-text-primary focus:outline-none transition-colors duration-200 text-xs rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaDownload className="w-3.5 h-3.5" />
          <MdKeyboardArrowDown className="w-3 h-3" />
        </button>
      </Tooltip>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 bg-bg-primary-light border border-border-default-dark rounded shadow-lg z-50 min-w-[200px]">
          <button
            onClick={handleMergeClick}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <FaCodeMerge className="w-3.5 h-3.5" />
            {t('worktree.merge')}
          </button>
          <button
            onClick={handleSquashClick}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <FaCompress className="w-3 h-3" />
            {t('worktree.squash')}
          </button>
          <button
            onClick={handleOnlyUncommittedClick}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <FaFileLines className="w-3.5 h-3.5 flex-shrink-0" />
            {t('worktree.onlyUncommitted')}
          </button>

          <div className="border-t border-border-default-dark my-1" />

          <button
            onClick={handleRebaseClick}
            className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors flex items-center gap-2"
          >
            <FaArrowsRotate className="w-3.5 h-3.5 flex-shrink-0" />
            {t('worktree.rebaseFromBranch')}
          </button>
          {canAbortRebase && (
            <button
              onClick={handleAbortRebaseClick}
              disabled={!canAbortRebase}
              className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaBan className="w-3.5 h-3.5 flex-shrink-0" />
              {t('worktree.abortRebase')}
            </button>
          )}

          {canContinueRebase && (
            <button
              onClick={handleContinueRebaseClick}
              disabled={!canContinueRebase}
              className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaPlay className="w-3.5 h-3.5 flex-shrink-0" />
              {t('worktree.continueRebase')}
            </button>
          )}
          {canResolveConflictsWithAgent && (
            <button
              onClick={handleResolveWithAgentClick}
              disabled={!canResolveConflictsWithAgent}
              className="w-full px-3 py-1.5 text-left text-xs text-text-primary hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FaRobot className="w-3.5 h-3.5 flex-shrink-0" />
              {t('worktree.resolveConflictsWithAgent')}
            </button>
          )}
        </div>
      )}

      {showAbortRebaseConfirm && (
        <ConfirmDialog
          title={t('worktree.confirmAbortRebaseTitle')}
          onConfirm={handleAbortRebaseConfirm}
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
          onConfirm={handleContinueRebaseConfirm}
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
          onConfirm={handleResolveWithAgentConfirm}
          onCancel={() => setShowResolveWithAgentConfirm(false)}
          confirmButtonText={t('worktree.resolveConflictsWithAgent')}
          closeOnEscape
        >
          <p className="text-sm mb-3">{t('worktree.confirmResolveConflictsWithAgentMessage')}</p>
        </ConfirmDialog>
      )}

      {showMergeDialog && (
        <WorktreeActionDialog
          baseDir={baseDir}
          title={t('worktree.confirmMergeTitle')}
          message={t('worktree.confirmMergeMessage')}
          confirmButtonText={t('worktree.merge')}
          defaultBranch={defaultBranch}
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
          defaultBranch={defaultBranch}
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
          defaultBranch={defaultBranch}
          onCancel={() => setShowOnlyUncommittedDialog(false)}
          onConfirm={(branch) => {
            setShowOnlyUncommittedDialog(false);
            onOnlyUncommitted(branch);
          }}
        />
      )}

      {showRebaseDialog && (
        <WorktreeActionDialog
          baseDir={baseDir}
          title={t('worktree.confirmRebaseTitle')}
          message={t('worktree.confirmRebaseMessage')}
          confirmButtonText={t('worktree.rebaseFromBranch')}
          defaultBranch={defaultBranch}
          onCancel={() => setShowRebaseDialog(false)}
          onConfirm={(branch) => {
            setShowRebaseDialog(false);
            onRebaseFromBranch(branch);
          }}
        />
      )}
    </div>
  );
};

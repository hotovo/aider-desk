import { CgArrowBottomLeft, CgArrowTopRight } from 'react-icons/cg';
import { IoGitBranch } from 'react-icons/io5';
import { TiTick } from 'react-icons/ti';
import { useTranslation } from 'react-i18next';
import { GitSyncCommits } from '@common/types';

const MAX_COMMITS_SHOWN = 20;

type Props = {
  currentBranch: string;
  syncCommits: GitSyncCommits;
  worktreeBaseBranch?: string;
};

const renderCommitList = (commits: string[]) => {
  if (commits.length === 0) {
    return null;
  }

  const visibleCommits = commits.slice(0, MAX_COMMITS_SHOWN);
  const remainingCount = commits.length - visibleCommits.length;

  return (
    <ul className="mt-0.5">
      {visibleCommits.map((commit, index) => (
        <li key={`${index}-${commit}`} className="font-mono text-text-muted truncate">
          {commit}
        </li>
      ))}
      {remainingCount > 0 && <li className="font-mono text-text-muted truncate">{`...and ${remainingCount} more`}</li>}
    </ul>
  );
};

export const GitBranchesTooltipContent = ({ currentBranch, syncCommits, worktreeBaseBranch }: Props) => {
  const { t } = useTranslation();

  const outgoingCount = syncCommits.outgoing.count;
  const incomingCount = syncCommits.incoming.count;

  const outgoingLabel = worktreeBaseBranch
    ? t('worktree.aheadCommitsTooltip', { count: outgoingCount, branch: worktreeBaseBranch })
    : t('git.outgoingCommitsTooltip', { count: outgoingCount });
  const incomingLabel = worktreeBaseBranch
    ? t('worktree.behindCommitsTooltip', { count: incomingCount, branch: worktreeBaseBranch })
    : t('git.incomingCommitsTooltip', { count: incomingCount });

  const hasSyncCommits = outgoingCount > 0 || incomingCount > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 min-w-0">
        <IoGitBranch className="w-3 h-3 text-text-muted shrink-0" />
        <span className="font-medium text-text-primary truncate">{currentBranch || t('git.noCurrentBranch')}</span>
      </div>

      {hasSyncCommits ? (
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-border-default">
          {outgoingCount > 0 && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <CgArrowTopRight className="w-2.5 h-2.5 shrink-0 text-success-light" />
                <span>{outgoingLabel}</span>
              </div>
              {renderCommitList(syncCommits.outgoing.commits)}
            </div>
          )}
          {incomingCount > 0 && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-text-secondary">
                <CgArrowBottomLeft className="w-2.5 h-2.5 shrink-0 text-info-light" />
                <span>{incomingLabel}</span>
              </div>
              {renderCommitList(syncCommits.incoming.commits)}
            </div>
          )}
          {incomingCount > 0 && worktreeBaseBranch && (
            <div className="flex items-center gap-1.5 mt-0.5 text-text-primary">
              <span>{t('worktree.behindCommitsSyncHint', { branch: worktreeBaseBranch })}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-text-muted">
          <TiTick className="w-3 h-3 shrink-0 text-success-light" />
          <span>{t('git.upToDate')}</span>
        </div>
      )}
    </div>
  );
};

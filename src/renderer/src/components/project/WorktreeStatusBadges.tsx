import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TiWarning } from 'react-icons/ti';

import type { WorktreeIntegrationStatus } from '@common/types';

import { Tooltip } from '@/components/ui/Tooltip';

const MAX_TOOLTIP_ITEMS = 20;

const formatTruncatedList = (items: string[]) => {
  if (items.length <= MAX_TOOLTIP_ITEMS) {
    return items;
  }

  const remaining = items.length - MAX_TOOLTIP_ITEMS;
  return [...items.slice(0, MAX_TOOLTIP_ITEMS), `...and ${remaining} more`];
};

type Props = {
  status: WorktreeIntegrationStatus;
  onRefresh: () => void;
};

export const WorktreeStatusBadges = ({ status, onRefresh }: Props) => {
  const { t } = useTranslation();

  const aheadCommits = status.aheadCommits.count;

  const showCommits = aheadCommits > 0;

  const commitsTooltip = useMemo(() => {
    const commits = formatTruncatedList(status.aheadCommits.commits);
    return `${commits.join('\n')}${commits.length > 0 ? '\n\n' : ''}${t('common.clickToRefresh')}`;
  }, [status.aheadCommits.commits, t]);

  const conflictsTooltip = useMemo(() => {
    if (status.rebaseState.hasUnmergedPaths) {
      const files = status.rebaseState.unmergedFiles || [];
      return `${t('worktree.conflictsPresent')}:\n${files.join('\n')}`;
    }

    if (status.predictedConflicts.hasConflicts) {
      const files = status.predictedConflicts.conflictingFiles || [];
      return `${t('worktree.conflictsPredicted')}:\n${files.join('\n')}`;
    }

    return '';
  }, [status.predictedConflicts, status.rebaseState, t]);

  const showConflicts = status.rebaseState.hasUnmergedPaths || status.predictedConflicts.hasConflicts;

  const renderBadge = (tooltipContent: React.ReactNode, onClick: () => void, children: React.ReactNode) => (
    <Tooltip content={tooltipContent} maxWidth="none">
      <span
        className="px-1.5 py-0.5 rounded bg-bg-secondary text-text-primary text-2xs cursor-pointer hover:bg-bg-secondary-light transition-colors"
        onClick={onClick}
      >
        {children}
      </span>
    </Tooltip>
  );

  return (
    <div className="flex items-center gap-1">
      {showConflicts && (
        <Tooltip content={conflictsTooltip} maxWidth="none">
          <TiWarning className="text-text-error w-4.5 h-4.5 mr-1 focus:outline-none" />
        </Tooltip>
      )}
      {showCommits && renderBadge(commitsTooltip, onRefresh, t('worktree.aheadCommits', { count: aheadCommits }))}
    </div>
  );
};

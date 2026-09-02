import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { CgArrowBottomLeft, CgArrowTopRight } from 'react-icons/cg';
import { TiWarning } from 'react-icons/ti';

import type { WorktreeIntegrationStatus } from '@common/types';

import { Tooltip } from '@/components/ui/Tooltip';

type Props = {
  status?: WorktreeIntegrationStatus | null;
  showOutgoing: boolean;
  showIncoming: boolean;
};

export const GitStatusBadges = ({ status, showOutgoing, showIncoming }: Props) => {
  const { t } = useTranslation();

  const conflictsTooltip = useMemo(() => {
    if (!status) {
      return '';
    }

    if (status.rebaseState.hasUnmergedPaths) {
      const files = status.rebaseState.unmergedFiles || [];
      return `${t('worktree.conflictsPresent')}:\n${files.join('\n')}`;
    }

    if (status.predictedConflicts.hasConflicts) {
      const files = status.predictedConflicts.conflictingFiles || [];
      return `${t('worktree.conflictsPredicted')}:\n${files.join('\n')}`;
    }

    return '';
  }, [status, t]);

  const showConflicts = Boolean(status && (status.rebaseState.hasUnmergedPaths || status.predictedConflicts.hasConflicts));

  if (!showConflicts && !showOutgoing && !showIncoming) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 shrink-0">
      {showConflicts && (
        <Tooltip content={conflictsTooltip} maxWidth="none">
          <TiWarning className="text-text-error w-3.5 h-3.5 focus:outline-none" />
        </Tooltip>
      )}
      {showOutgoing && <CgArrowTopRight className="w-2.5 h-2.5 shrink-0 text-success-light" />}
      {showIncoming && <CgArrowBottomLeft className="w-2.5 h-2.5 shrink-0 text-info-light" />}
    </div>
  );
};

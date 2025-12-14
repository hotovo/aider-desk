import { TaskData, WorkingMode } from '@common/types';
import { useState, useEffect, useRef, useCallback } from 'react';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import type { WorktreeIntegrationStatus } from '@common/types';

import { ItemConfig, ItemSelector } from '@/components/common/ItemSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { WorktreeMergeButton } from '@/components/project/WorktreeMergeButton';
import { WorktreeRevertButton } from '@/components/project/WorktreeRevertButton';
import { useApi } from '@/contexts/ApiContext';
import { WorktreeStatusBadges } from '@/components/project/WorktreeStatusBadges';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

const WORKING_MODE_ITEMS: ItemConfig<WorkingMode>[] = [
  {
    value: 'local',
    icon: AiFillFolderOpen,
    labelKey: 'workingMode.local',
    tooltipKey: 'workingModeTooltip.local',
  },
  {
    value: 'worktree',
    icon: IoGitBranch,
    labelKey: 'workingMode.worktree',
    tooltipKey: 'workingModeTooltip.worktree',
  },
];

type Props = {
  task: TaskData;
  onMerge: (targetBranch?: string) => void;
  onSquash: (targetBranch?: string, commitMessage?: string) => void;
  onOnlyUncommitted: (targetBranch?: string) => void;
  onRebaseFromBranch: (fromBranch?: string) => void;
  onAbortRebase: () => void;
  onContinueRebase: () => void;
  onResolveConflictsWithAgent: () => void;
  onRevert: () => void;
  isMerging: boolean;
};

export const TaskWorkingMode = ({
  task,
  onMerge,
  onSquash,
  onOnlyUncommitted,
  onRebaseFromBranch,
  onAbortRebase,
  onContinueRebase,
  onResolveConflictsWithAgent,
  onRevert,
  isMerging,
}: Props) => {
  const { isMobile } = useResponsive();
  const { t } = useTranslation();
  const api = useApi();
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirmLocal, setShowConfirmLocal] = useState(false);
  const [worktreeStatus, setWorktreeStatus] = useState<WorktreeIntegrationStatus | null>(null);
  const currentLoadId = useRef(0);

  const loadStatus = useCallback(
    async (loadId: number) => {
      try {
        const status = await api.getWorktreeIntegrationStatus(task.baseDir, task.id);
        if (loadId === currentLoadId.current) {
          setWorktreeStatus(status);
        }
      } catch {
        if (loadId === currentLoadId.current) {
          setWorktreeStatus(null);
        }
      }
    },
    [api, task.baseDir, task.id],
  );

  const handleRefresh = () => {
    currentLoadId.current += 1;
    void loadStatus(currentLoadId.current);
  };

  useEffect(() => {
    if (task.workingMode !== 'worktree') {
      setWorktreeStatus(null);
      return;
    }

    currentLoadId.current += 1;
    void loadStatus(currentLoadId.current);

    const unsubscribe = api.addWorktreeIntegrationStatusUpdatedListener(task.baseDir, task.id, ({ status }) => {
      setWorktreeStatus(status);
    });

    return () => {
      unsubscribe();
    };
  }, [api, loadStatus, task.baseDir, task.id, task.workingMode]);

  const handleWorkingModeChanged = async (mode: WorkingMode) => {
    if (mode === 'local' && task.workingMode === 'worktree' && worktreeStatus) {
      const hasUncommitted = worktreeStatus.uncommittedFiles.count > 0;
      const hasUnmerged = worktreeStatus.aheadCommits.count > 0;

      if (hasUncommitted || hasUnmerged) {
        setShowConfirmLocal(true);
        return;
      }
    }

    await performSwitch(mode);
  };

  const performSwitch = async (mode: WorkingMode) => {
    setIsSwitching(true);
    try {
      await api.updateTask(task.baseDir, task.id, { workingMode: mode });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update task:', error);
    } finally {
      setIsSwitching(false);
      setShowConfirmLocal(false);
    }
  };

  const getWarningMessage = () => {
    if (!worktreeStatus) {
      return '';
    }
    const warnings: string[] = [];
    if (worktreeStatus.uncommittedFiles.count > 0) {
      warnings.push(`- ${t('workingMode.uncommittedChanges', { count: worktreeStatus.uncommittedFiles.count, defaultValue: 'Uncommitted changes' })}`);
    }
    if (worktreeStatus.aheadCommits.count > 0) {
      warnings.push(
        `- ${t('workingMode.unmergedCommits', {
          count: worktreeStatus.aheadCommits.count,
          defaultValue: `${worktreeStatus.aheadCommits.count} commit${worktreeStatus.aheadCommits.count > 1 ? 's' : ''} not merged to main branch`,
        })}`,
      );
    }
    return warnings.join('\n');
  };

  return (
    <div className="flex items-center gap-1 max-h-5">
      {isSwitching ? (
        <span className="text-2xs">{t('workingMode.switching')}</span>
      ) : (
        <>
          {task.workingMode === 'worktree' && (
            <>
              {worktreeStatus && <WorktreeStatusBadges status={worktreeStatus} onRefresh={handleRefresh} />}
              {task.lastMergeState && <WorktreeRevertButton onRevert={onRevert} disabled={isMerging} />}
              <WorktreeMergeButton
                baseDir={task.baseDir}
                defaultBranch={worktreeStatus?.targetBranch}
                onMerge={onMerge}
                onSquash={onSquash}
                onOnlyUncommitted={onOnlyUncommitted}
                onRebaseFromBranch={onRebaseFromBranch}
                onAbortRebase={onAbortRebase}
                onContinueRebase={onContinueRebase}
                onResolveConflictsWithAgent={onResolveConflictsWithAgent}
                canAbortRebase={worktreeStatus?.rebaseState.inProgress}
                canContinueRebase={worktreeStatus?.rebaseState.inProgress}
                canResolveConflictsWithAgent={worktreeStatus?.rebaseState.hasUnmergedPaths}
                disabled={isMerging}
                status={worktreeStatus}
                taskName={task.name}
              />
            </>
          )}
          <ItemSelector
            items={WORKING_MODE_ITEMS}
            selectedValue={task.workingMode!}
            onChange={handleWorkingModeChanged}
            popupPlacement="bottom-right"
            minWidth={120}
            iconOnly={isMobile}
          />
        </>
      )}
      {showConfirmLocal && (
        <ConfirmDialog
          title={t('workingMode.confirmLocalTitle')}
          onConfirm={() => performSwitch('local')}
          onCancel={() => setShowConfirmLocal(false)}
          confirmButtonText={t('workingMode.confirmLocalAction')}
          confirmButtonColor="danger"
        >
          <div className="whitespace-pre-wrap text-xs">{t('workingMode.confirmLocalMessage', { warnings: getWarningMessage() })}</div>
        </ConfirmDialog>
      )}
    </div>
  );
};

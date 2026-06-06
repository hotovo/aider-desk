import { SwitchToLocalOptions, SwitchToWorktreeOptions, TaskData, WorkingMode, WorktreeUncommittedFiles } from '@common/types';
import { useState } from 'react';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import { ItemConfig, ItemSelector } from '@/components/common/ItemSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { WorktreeMergeButton } from '@/components/project/WorktreeMergeButton';
import { WorktreeRevertButton } from '@/components/project/WorktreeRevertButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Checkbox } from '@/components/common/Checkbox';
import { WorktreeStatusBadges } from '@/components/project/WorktreeStatusBadges';
import { useApi } from '@/contexts/ApiContext';
import { useWorktreeIntegrationStatus } from '@/hooks/useWorktreeIntegrationStatus';

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
  onRenameBranch: (newBranchName: string) => Promise<void>;
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
  onRenameBranch,
  isMerging,
}: Props) => {
  const { isMobile } = useResponsive();
  const { t } = useTranslation();
  const api = useApi();
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirmLocal, setShowConfirmLocal] = useState(false);
  const [showConfirmWorktree, setShowConfirmWorktree] = useState(false);
  const [keepChangesInSource, setKeepChangesInSource] = useState(false);
  const [localUncommittedFiles, setLocalUncommittedFiles] = useState<WorktreeUncommittedFiles | null>(null);
  const isWorktree = task.workingMode === 'worktree';
  const { worktreeStatus, refreshStatus: handleRefresh } = useWorktreeIntegrationStatus(task.baseDir, task.id, isWorktree);

  const handleWorkingModeChanged = async (mode: WorkingMode) => {
    if (mode === 'local' && task.workingMode === 'worktree' && worktreeStatus) {
      const hasUncommitted = worktreeStatus.uncommittedFiles.count > 0;
      const hasUnmerged = worktreeStatus.aheadCommits.count > 0;

      if (hasUncommitted || hasUnmerged) {
        setShowConfirmLocal(true);
        return;
      }
    }

    if (mode === 'worktree' && task.workingMode === 'local') {
      try {
        const uncommittedFiles = await api.getLocalUncommittedFiles(task.baseDir, task.id);
        if (uncommittedFiles.count > 0) {
          setLocalUncommittedFiles(uncommittedFiles);
          setShowConfirmWorktree(true);
          return;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to check local uncommitted files:', error);
      }
    }

    await performSwitch(mode);
  };

  const performSwitch = async (mode: WorkingMode) => {
    setIsSwitching(true);
    try {
      if (mode === 'local') {
        await api.switchToLocalWorkingMode(task.baseDir, task.id);
      } else {
        await api.switchToWorktreeWorkingMode(task.baseDir, task.id);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update task:', error);
    } finally {
      setIsSwitching(false);
      setShowConfirmLocal(false);
      setShowConfirmWorktree(false);
    }
  };

  const performMergeAndSwitch = async () => {
    setIsSwitching(true);
    try {
      const options: SwitchToLocalOptions = { mergeBeforeSwitch: true, targetBranch: worktreeStatus?.targetBranch };
      await api.switchToLocalWorkingMode(task.baseDir, task.id, options);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to merge and switch:', error);
    } finally {
      setIsSwitching(false);
      setShowConfirmLocal(false);
    }
  };

  const performSwitchToWorktreeWithChanges = async () => {
    setIsSwitching(true);
    try {
      const options: SwitchToWorktreeOptions = {
        carryOverUncommittedChanges: true,
        dropSourceChanges: !keepChangesInSource,
      };
      await api.switchToWorktreeWorkingMode(task.baseDir, task.id, options);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to switch to worktree with changes:', error);
    } finally {
      setIsSwitching(false);
      setShowConfirmWorktree(false);
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
                onRenameBranch={onRenameBranch}
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
          width={600}
          additionalAction={{
            label: t('workingMode.mergeAndSwitchAction'),
            onClick: performMergeAndSwitch,
            color: 'primary',
          }}
        >
          <div className="whitespace-pre-wrap text-xs">{t('workingMode.confirmLocalMessage', { warnings: getWarningMessage() })}</div>
        </ConfirmDialog>
      )}
      {showConfirmWorktree && (
        <ConfirmDialog
          title={t('workingMode.confirmWorktreeTitle')}
          onConfirm={() => performSwitch('worktree')}
          onCancel={() => {
            setShowConfirmWorktree(false);
            setKeepChangesInSource(false);
          }}
          confirmButtonText={t('workingMode.confirmWorktreeAction')}
          confirmButtonColor="primary"
          width={600}
          additionalAction={{
            label: t('workingMode.takeChangesAndSwitchAction'),
            onClick: performSwitchToWorktreeWithChanges,
            color: 'primary',
          }}
        >
          <div className="space-y-3">
            <div className="whitespace-pre-wrap text-xs">{t('workingMode.confirmWorktreeMessage', { count: localUncommittedFiles?.count ?? 0 })}</div>
            <Checkbox label={t('workingMode.keepChangesInProject')} checked={keepChangesInSource} onChange={setKeepChangesInSource} size="sm" />
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
};

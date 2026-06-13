import { SwitchToLocalOptions, SwitchToWorktreeOptions, TaskData, WorkingMode, WorktreeUncommittedFiles } from '@common/types';
import { useCallback, useState, useMemo } from 'react';
import { AiFillFolderOpen } from 'react-icons/ai';
import { IoGitBranch } from 'react-icons/io5';
import { useTranslation } from 'react-i18next';

import { ItemConfig, ItemSelector } from '@/components/common/ItemSelector';
import { useResponsive } from '@/hooks/useResponsive';
import { WorktreeMergeButton } from '@/components/project/WorktreeMergeButton';
import { WorktreeRevertButton } from '@/components/project/WorktreeRevertButton';
import { BaseDialog } from '@/components/common/BaseDialog';
import { RadioButton } from '@/components/common/RadioButton';
import { Button } from '@/components/common/Button';
import { WorktreeStatusBadges } from '@/components/project/WorktreeStatusBadges';
import { useApi } from '@/contexts/ApiContext';
import { useWorktreeIntegrationStatus } from '@/hooks/useWorktreeIntegrationStatus';
import { useProjectTasks } from '@/stores/projectStore';

enum LocalSwitchOption {
  Merge = 'merge',
  MergeAll = 'mergeAll',
  Remove = 'remove',
}

enum WorktreeSwitchOption {
  JustSwitch = 'justSwitch',
  CarryOverRemove = 'carryOverRemove',
  CarryOverKeep = 'carryOverKeep',
}

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
  const allTasks = useProjectTasks(task.baseDir);
  const [isSwitching, setIsSwitching] = useState(false);
  const [showConfirmLocal, setShowConfirmLocal] = useState(false);
  const [showConfirmWorktree, setShowConfirmWorktree] = useState(false);
  const [localOption, setLocalOption] = useState<LocalSwitchOption>(LocalSwitchOption.Merge);
  const [worktreeOption, setWorktreeOption] = useState<WorktreeSwitchOption>(WorktreeSwitchOption.JustSwitch);
  const [localUncommittedFiles, setLocalUncommittedFiles] = useState<WorktreeUncommittedFiles | null>(null);
  const isWorktree = task.workingMode === 'worktree';
  const { worktreeStatus, refreshStatus: handleRefresh } = useWorktreeIntegrationStatus(task.baseDir, task.id, isWorktree);

  const isWorktreeShared = useMemo(() => {
    if (!task.worktree?.path) {
      return false;
    }
    return allTasks.some((t) => t.id !== task.id && t.workingMode === 'worktree' && t.worktree?.path === task.worktree!.path);
  }, [allTasks, task.id, task.worktree]);

  const performSwitch = useCallback(
    async (mode: WorkingMode) => {
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
    },
    [api, task.baseDir, task.id],
  );

  const handleWorkingModeChanged = useCallback(
    async (mode: WorkingMode) => {
      if (mode === 'local' && task.workingMode === 'worktree' && worktreeStatus) {
        const hasUncommitted = worktreeStatus.uncommittedFiles.count > 0;
        const hasUnmerged = worktreeStatus.aheadCommits.count > 0;

        if (hasUncommitted || hasUnmerged) {
          setLocalOption(LocalSwitchOption.Merge);
          setShowConfirmLocal(true);
          return;
        }
      }

      if (mode === 'worktree' && task.workingMode === 'local') {
        try {
          const uncommittedFiles = await api.getLocalUncommittedFiles(task.baseDir, task.id);
          if (uncommittedFiles.count > 0) {
            setLocalUncommittedFiles(uncommittedFiles);
            setWorktreeOption(WorktreeSwitchOption.JustSwitch);
            setShowConfirmWorktree(true);
            return;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to check local uncommitted files:', error);
        }
      }

      await performSwitch(mode);
    },
    [task.workingMode, task.baseDir, task.id, worktreeStatus, api, performSwitch],
  );

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

  const performMergeAndSwitchAll = async () => {
    setIsSwitching(true);
    try {
      const options: SwitchToLocalOptions = { mergeBeforeSwitch: true, targetBranch: worktreeStatus?.targetBranch, switchAllInWorktree: true };
      await api.switchToLocalWorkingMode(task.baseDir, task.id, options);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to merge and switch all:', error);
    } finally {
      setIsSwitching(false);
      setShowConfirmLocal(false);
    }
  };

  const handleLocalConfirm = async () => {
    if (localOption === LocalSwitchOption.Remove) {
      await performSwitch('local');
    } else if (localOption === LocalSwitchOption.MergeAll) {
      await performMergeAndSwitchAll();
    } else {
      await performMergeAndSwitch();
    }
  };

  const handleWorktreeConfirm = async () => {
    if (worktreeOption === WorktreeSwitchOption.JustSwitch) {
      await performSwitch('worktree');
    } else {
      const dropSource = worktreeOption === WorktreeSwitchOption.CarryOverRemove;
      await performSwitchToWorktreeWithChanges(dropSource);
    }
  };

  const performSwitchToWorktreeWithChanges = async (dropSourceChanges: boolean) => {
    setIsSwitching(true);
    try {
      const options: SwitchToWorktreeOptions = {
        carryOverUncommittedChanges: true,
        dropSourceChanges,
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
        <BaseDialog
          title={t('workingMode.confirmLocalTitle')}
          onClose={() => setShowConfirmLocal(false)}
          width={600}
          closeOnEscape={false}
          footer={
            <>
              <Button onClick={() => setShowConfirmLocal(false)} variant="text">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleLocalConfirm} autoFocus variant="contained" color="primary">
                {t('common.ok')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-xs">{t('workingMode.confirmLocalMessage', { warnings: getWarningMessage() })}</div>
            <div className="space-y-3">
              <RadioButton
                id="local-merge"
                name="local-switch-option"
                value="merge"
                checked={localOption === LocalSwitchOption.Merge}
                onChange={() => setLocalOption(LocalSwitchOption.Merge)}
                label={
                  <div>
                    <div className="font-medium">{t('workingMode.localOptionMergeLabel')}</div>
                    <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.localOptionMergeDescription')}</div>
                  </div>
                }
              />
              {isWorktreeShared && (
                <RadioButton
                  id="local-merge-all"
                  name="local-switch-option"
                  value="mergeAll"
                  checked={localOption === LocalSwitchOption.MergeAll}
                  onChange={() => setLocalOption(LocalSwitchOption.MergeAll)}
                  label={
                    <div>
                      <div className="font-medium">{t('workingMode.localOptionMergeAllLabel')}</div>
                      <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.localOptionMergeAllDescription')}</div>
                    </div>
                  }
                />
              )}
              <RadioButton
                id="local-remove"
                name="local-switch-option"
                value="remove"
                checked={localOption === LocalSwitchOption.Remove}
                onChange={() => setLocalOption(LocalSwitchOption.Remove)}
                label={
                  <div>
                    <div className="font-medium">{t('workingMode.localOptionRemoveLabel')}</div>
                    <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.localOptionRemoveDescription')}</div>
                  </div>
                }
              />
            </div>
          </div>
        </BaseDialog>
      )}
      {showConfirmWorktree && (
        <BaseDialog
          title={t('workingMode.confirmWorktreeTitle')}
          onClose={() => setShowConfirmWorktree(false)}
          width={600}
          closeOnEscape={false}
          footer={
            <>
              <Button onClick={() => setShowConfirmWorktree(false)} variant="text">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleWorktreeConfirm} autoFocus variant="contained" color="primary">
                {t('common.ok')}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="whitespace-pre-wrap text-xs">{t('workingMode.confirmWorktreeMessage', { count: localUncommittedFiles?.count ?? 0 })}</div>
            <div className="space-y-3">
              <RadioButton
                id="worktree-just-switch"
                name="worktree-switch-option"
                value="justSwitch"
                checked={worktreeOption === WorktreeSwitchOption.JustSwitch}
                onChange={() => setWorktreeOption(WorktreeSwitchOption.JustSwitch)}
                label={
                  <div>
                    <div className="font-medium">{t('workingMode.worktreeOptionJustSwitchLabel')}</div>
                    <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.worktreeOptionJustSwitchDescription')}</div>
                  </div>
                }
              />
              <RadioButton
                id="worktree-carry-remove"
                name="worktree-switch-option"
                value="carryOverRemove"
                checked={worktreeOption === WorktreeSwitchOption.CarryOverRemove}
                onChange={() => setWorktreeOption(WorktreeSwitchOption.CarryOverRemove)}
                label={
                  <div>
                    <div className="font-medium">{t('workingMode.worktreeOptionCarryOverRemoveLabel')}</div>
                    <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.worktreeOptionCarryOverRemoveDescription')}</div>
                  </div>
                }
              />
              <RadioButton
                id="worktree-carry-keep"
                name="worktree-switch-option"
                value="carryOverKeep"
                checked={worktreeOption === WorktreeSwitchOption.CarryOverKeep}
                onChange={() => setWorktreeOption(WorktreeSwitchOption.CarryOverKeep)}
                label={
                  <div>
                    <div className="font-medium">{t('workingMode.worktreeOptionCarryOverKeepLabel')}</div>
                    <div className="text-text-muted text-2xs mt-0.5">{t('workingMode.worktreeOptionCarryOverKeepDescription')}</div>
                  </div>
                }
              />
            </div>
          </div>
        </BaseDialog>
      )}
    </div>
  );
};

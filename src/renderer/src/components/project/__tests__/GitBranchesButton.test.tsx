import { act, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeIntegrationStatus } from '@common/types';

import { GitBranchesButton } from '../GitBranchesButton';

import { invokeAction } from '@/stores/actionsStore';
import { showErrorNotification } from '@/utils/notifications';
import { render } from '@/__tests__/render';
import { useApi } from '@/contexts/ApiContext';
import { createMockApi } from '@/__tests__/mocks/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options && 'count' in options && 'branch' in options) {
        return `${key}:${options.branch}:${options.count}`;
      }
      if (options && 'count' in options) {
        return `${key}:${options.count}`;
      }
      if (options && 'branch' in options) {
        return `${key}:${options.branch}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/utils/notifications', () => ({
  showErrorNotification: vi.fn(),
  showInfoNotification: vi.fn(),
}));

const mockStatus: WorktreeIntegrationStatus = {
  currentBranch: 'task-123',
  baseBranch: 'main',
  targetBranch: 'main',
  aheadCommits: { count: 1, commits: ['commit1'] },
  uncommittedFiles: { count: 0, files: [] },
  predictedConflicts: { hasConflicts: false, conflictingFiles: [] },
  rebaseState: { inProgress: false, hasUnmergedPaths: false },
};

const defaultProps = {
  baseDir: '/project',
  taskId: 'task-123',
  onSwitchToLocal: vi.fn(),
  onSwitchToWorktree: vi.fn(),
  onMerge: vi.fn(),
  onSquash: vi.fn(),
  onOnlyUncommitted: vi.fn(),
  onRebaseFromBranch: vi.fn(),
  onAbortRebase: vi.fn(),
  onContinueRebase: vi.fn(),
  onResolveConflictsWithAgent: vi.fn(),
  onRenameBranch: vi.fn(),
};

describe('GitBranchesButton', () => {
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi = createMockApi({
      listGitBranches: vi.fn().mockResolvedValue([
        { name: 'task-123', isCurrent: true, hasWorktree: true, isRemote: false },
        { name: 'main', isCurrent: false, hasWorktree: false, isRemote: false },
      ]),
      getSyncCommits: vi.fn().mockResolvedValue({
        outgoing: { count: 2, commits: ['hash1 feat: ahead 1', 'hash2 feat: ahead 2'] },
        incoming: { count: 1, commits: ['hash3 feat: incoming from main'] },
      }),
    });
    vi.mocked(useApi).mockReturnValue(mockApi);
  });

  describe('worktree mode', () => {
    it('queries getSyncCommits with baseBranch and formats ahead/behind tooltips relative to base branch', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', 'main');
      });

      // Open branches menu to view rebase button
      fireEvent.click(screen.getByRole('button', { name: /task-123/i }));

      expect(screen.getByText('worktree.rebaseFromCurrentBranch:main')).toBeInTheDocument();
      fireEvent.click(screen.getByText('worktree.rebaseFromCurrentBranch:main'));
      expect(defaultProps.onRebaseFromBranch).toHaveBeenCalledWith('main');
    });
  });

  describe('local mode', () => {
    it('queries getSyncCommits with undefined targetBranch and uses git sync tooltip labels', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });
    });
  });

  describe('push action', () => {
    it('disables push button when outgoing commit count is 0', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue({
        outgoing: { count: 0, commits: [] },
        incoming: { count: 0, commits: [] },
      });

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: /main/i }));

      // Push button should be disabled
      const pushBtn = screen.getByRole('button', { name: 'git.push...' });
      expect(pushBtn).toBeDisabled();
    });

    it('enables push for a branch without upstream and pushes with set-upstream', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue({
        outgoing: { count: 0, commits: [] },
        incoming: { count: 0, commits: [] },
      });

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: /main/i }));

      // Push button should be enabled even with no outgoing commits
      const pushBtn = screen.getByRole('button', { name: 'git.push...' });
      expect(pushBtn).toBeEnabled();

      fireEvent.click(pushBtn);

      // Dialog should show the set-upstream message instead of the commit count
      expect(screen.getByText('git.confirmPushTitle')).toBeInTheDocument();
      expect(screen.getByText('git.confirmPushSetUpstreamMessage:main')).toBeInTheDocument();
      expect(screen.queryByText('git.confirmPushMessage:0')).not.toBeInTheDocument();

      // Confirm push
      fireEvent.click(screen.getByRole('button', { name: 'git.push' }));

      await waitFor(() => {
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', 'task-123', false, true);
      });
    });

    it('opens push confirm dialog with commit summary, commit list, and force checkbox unchecked by default', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: /main/i }));

      // Click push button
      fireEvent.click(screen.getByRole('button', { name: 'git.push...' }));

      // Dialog should be open with commit summary and commit list
      expect(screen.getByText('git.confirmPushTitle')).toBeInTheDocument();
      expect(screen.getByText('git.confirmPushMessage:2')).toBeInTheDocument();
      expect(screen.getByText('hash1 feat: ahead 1')).toBeInTheDocument();
      expect(screen.getByText('hash2 feat: ahead 2')).toBeInTheDocument();

      // Checkbox should be present and unchecked
      const forceCheckbox = screen.getByRole('checkbox');
      expect(forceCheckbox).not.toBeChecked();

      // Confirm push without force
      fireEvent.click(screen.getByRole('button', { name: 'git.push' }));

      await waitFor(() => {
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', 'task-123', false, false);
      });
      expect(screen.queryByText('git.confirmPushTitle')).not.toBeInTheDocument();
    });

    it('force pushes when force checkbox is checked', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu and click push
      fireEvent.click(screen.getByRole('button', { name: /main/i }));
      fireEvent.click(screen.getByRole('button', { name: 'git.push...' }));

      // Check the force checkbox
      const forceLabel = screen.getByText('git.force');
      fireEvent.click(forceLabel);

      const forceCheckbox = screen.getByRole('checkbox');
      expect(forceCheckbox).toBeChecked();

      // Confirm push
      fireEvent.click(screen.getByRole('button', { name: 'git.push' }));

      await waitFor(() => {
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', 'task-123', true, false);
      });
    });

    it('does not show an error notification when push fails (backend logs the error to the task chat)', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);
      mockApi.gitPush = vi.fn().mockRejectedValue(new Error('push failed'));

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu and click push
      fireEvent.click(screen.getByRole('button', { name: /main/i }));
      fireEvent.click(screen.getByRole('button', { name: 'git.push...' }));
      fireEvent.click(screen.getByRole('button', { name: 'git.push' }));

      await waitFor(() => {
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', 'task-123', false, false);
      });

      expect(showErrorNotification).not.toHaveBeenCalled();
    });

    it('cancels push dialog without calling gitPush', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      // Open menu and click push
      fireEvent.click(screen.getByRole('button', { name: /main/i }));
      fireEvent.click(screen.getByRole('button', { name: 'git.push...' }));

      expect(screen.getByText('git.confirmPushTitle')).toBeInTheDocument();

      // Click cancel
      fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));

      expect(screen.queryByText('git.confirmPushTitle')).not.toBeInTheDocument();
      expect(mockApi.gitPush).not.toHaveBeenCalled();
    });
  });

  describe('command palette actions', () => {
    const mockNoSyncCommits = {
      outgoing: { count: 0, commits: [] },
      incoming: { count: 0, commits: [] },
    };

    it('invokes pull from the palette action', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue(mockNoSyncCommits);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.pull');
      });

      await waitFor(() => {
        expect(mockApi.gitPull).toHaveBeenCalledWith('/project', 'task-123', false);
      });
    });

    it('opens the pull confirm dialog from the palette action when there are incoming and outgoing commits', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.pull');
      });

      expect(screen.getByText('git.confirmPullTitle')).toBeInTheDocument();
      expect(mockApi.gitPull).not.toHaveBeenCalled();
    });

    it('opens the push confirm dialog from the palette action and pushes on confirm', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.push');
      });

      expect(screen.getByText('git.confirmPushTitle')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'git.push' }));

      await waitFor(() => {
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', 'task-123', false, false);
      });
    });

    it('does not push when outgoing count is 0', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false, upstream: 'origin/main' }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue(mockNoSyncCommits);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.push');
      });

      expect(screen.queryByText('git.confirmPushTitle')).not.toBeInTheDocument();
      expect(mockApi.gitPush).not.toHaveBeenCalled();
    });

    it('opens the branches dropdown from the palette action', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue(mockNoSyncCommits);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.branches');
      });

      expect(screen.getByText('git.newBranch')).toBeInTheDocument();
      expect(screen.getByText('git.updateProject')).toBeInTheDocument();
    });

    it('opens the new branch input from the palette action', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue(mockNoSyncCommits);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.newBranch');
      });

      expect(screen.getByPlaceholderText('git.newBranchNamePlaceholder')).toBeInTheDocument();
    });

    it('shows a worktree availability error for new branch palette action in worktree mode', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.newBranch');
      });

      expect(showErrorNotification).toHaveBeenCalledWith('git.actionNotAvailableInWorktree');
      expect(screen.queryByPlaceholderText('git.newBranchNamePlaceholder')).not.toBeInTheDocument();
    });

    it('opens the rename branch editor from the palette action', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue(mockNoSyncCommits);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', 'task-123', undefined);
      });

      act(() => {
        invokeAction('git.renameBranch');
      });

      const input = screen.getByPlaceholderText('worktree.branchNamePlaceholder') as HTMLInputElement;
      expect(input.value).toBe('main');
    });

    it('opens the worktree merge dialog from the palette action', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.merge');
      });

      expect(screen.getByText('worktree.confirmMergeTitle')).toBeInTheDocument();
    });

    it('rebases the worktree from the palette action using the base branch', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.rebase');
      });

      expect(defaultProps.onRebaseFromBranch).toHaveBeenCalledWith('main');
    });

    it('applies uncommitted changes from the palette action when there are uncommitted files', async () => {
      const statusWithUncommittedFiles = { ...mockStatus, uncommittedFiles: { count: 2, files: ['a.ts', 'b.ts'] } };
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={statusWithUncommittedFiles} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.applyUncommitted');
      });

      expect(screen.getByText('worktree.confirmOnlyUncommittedTitle')).toBeInTheDocument();
    });

    it('ignores the apply uncommitted changes palette action without uncommitted files', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.applyUncommitted');
      });

      expect(screen.queryByText('worktree.confirmOnlyUncommittedTitle')).not.toBeInTheDocument();
    });

    it('opens the abort rebase confirm from the palette action during a rebase', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} canAbortRebase />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.abortRebase');
      });

      expect(screen.getByText('worktree.confirmAbortRebaseTitle')).toBeInTheDocument();
    });

    it('ignores the abort rebase palette action when no rebase is in progress', async () => {
      render(<GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.abortRebase');
      });

      expect(screen.queryByText('worktree.confirmAbortRebaseTitle')).not.toBeInTheDocument();
    });

    it('opens the resolve conflicts with agent confirm from the palette action when conflicts are resolvable', async () => {
      render(
        <GitBranchesButton {...defaultProps} worktreePath="/project/.aider-desk/tasks/task-123/worktree" status={mockStatus} canResolveConflictsWithAgent />,
      );

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalled();
      });

      act(() => {
        invokeAction('git.worktree.resolveConflicts');
      });

      expect(screen.getByText('worktree.confirmResolveConflictsWithAgentTitle')).toBeInTheDocument();
    });
  });

  describe('background refresh', () => {
    it('refreshes sync commits on an interval', async () => {
      vi.useFakeTimers();
      try {
        render(<GitBranchesButton {...defaultProps} />);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });
        expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(1);

        await act(async () => {
          await vi.advanceTimersByTimeAsync(30_000);
        });
        expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it('refreshes branches and sync commits when the window regains focus', async () => {
      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(1);
        expect(mockApi.listGitBranches).toHaveBeenCalledTimes(1);
      });

      act(() => {
        fireEvent.focus(window);
      });

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(2);
        expect(mockApi.listGitBranches).toHaveBeenCalledTimes(2);
      });
    });

    it('skips refresh on focus while the document is hidden', async () => {
      const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      try {
        render(<GitBranchesButton {...defaultProps} />);

        await waitFor(() => {
          expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(1);
          expect(mockApi.listGitBranches).toHaveBeenCalledTimes(1);
        });

        act(() => {
          fireEvent.focus(window);
        });

        expect(mockApi.getSyncCommits).toHaveBeenCalledTimes(1);
        expect(mockApi.listGitBranches).toHaveBeenCalledTimes(1);
      } finally {
        visibilitySpy.mockRestore();
      }
    });
  });
});

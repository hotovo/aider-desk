import { screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorktreeIntegrationStatus } from '@common/types';

import { GitBranchesButton } from '../GitBranchesButton';

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
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project/.aider-desk/tasks/task-123/worktree', 'main');
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
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
      });
    });
  });

  describe('push action', () => {
    it('disables push button when outgoing commit count is 0', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);
      mockApi.getSyncCommits = vi.fn().mockResolvedValue({
        outgoing: { count: 0, commits: [] },
        incoming: { count: 0, commits: [] },
      });

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
      });

      // Open menu
      fireEvent.click(screen.getByRole('button', { name: /main/i }));

      // Push button should be disabled
      const pushBtn = screen.getByRole('button', { name: 'git.push...' });
      expect(pushBtn).toBeDisabled();
    });

    it('opens push confirm dialog with commit summary, commit list, and force checkbox unchecked by default', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
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
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', false);
      });
      expect(screen.queryByText('git.confirmPushTitle')).not.toBeInTheDocument();
    });

    it('force pushes when force checkbox is checked', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
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
        expect(mockApi.gitPush).toHaveBeenCalledWith('/project', true);
      });
    });

    it('cancels push dialog without calling gitPush', async () => {
      mockApi.listGitBranches = vi.fn().mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false, isRemote: false }]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
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
});

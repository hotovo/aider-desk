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
      render(
        <GitBranchesButton
          {...defaultProps}
          worktreePath="/project/.aider-desk/tasks/task-123/worktree"
          status={mockStatus}
        />,
      );

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith(
          '/project/.aider-desk/tasks/task-123/worktree',
          'main',
        );
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
      mockApi.listGitBranches = vi.fn().mockResolvedValue([
        { name: 'main', isCurrent: true, hasWorktree: false, isRemote: false },
      ]);

      render(<GitBranchesButton {...defaultProps} />);

      await waitFor(() => {
        expect(mockApi.getSyncCommits).toHaveBeenCalledWith('/project', undefined);
      });
    });
  });
});

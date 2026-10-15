import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskData } from '@common/types';

import { TaskGitControls } from '../TaskGitControls';

import { render } from '@/__tests__/render';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.branch ? `${key}:${options.branch}` : key),
  }),
}));

vi.mock('@/contexts/ApiContext', () => ({ useApi: vi.fn() }));
vi.mock('@/stores/projectStore', () => ({ useProjectTasks: () => [] }));
vi.mock('@/hooks/useCommitChanges', () => ({ useCommitChanges: () => ({ isCommitting: false, cancelCommit: vi.fn() }) }));
vi.mock('@/utils/notifications', () => ({ showErrorNotification: vi.fn(), showInfoNotification: vi.fn() }));

const task: TaskData = {
  id: 'task-123',
  baseDir: '/project',
  name: 'Test task',
  workingMode: 'local',
  aiderTotalCost: 0,
  agentTotalCost: 0,
  mainModel: 'test-model',
};

const props = {
  task,
  onMerge: vi.fn(),
  onSquash: vi.fn(),
  onOnlyUncommitted: vi.fn(),
  onRebaseFromBranch: vi.fn(),
  onAbortRebase: vi.fn(),
  onContinueRebase: vi.fn(),
  onResolveConflictsWithAgent: vi.fn(),
  onRevert: vi.fn(),
  onRenameBranch: vi.fn(),
  isMerging: false,
};

describe('TaskGitControls worktree switching', () => {
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockApi({
      isGitRepository: vi.fn().mockResolvedValue(true),
      listGitBranches: vi.fn().mockResolvedValue([
        { name: 'main', isCurrent: true, hasWorktree: false },
        { name: 'develop', isCurrent: false, hasWorktree: false },
        { name: 'origin/develop', isCurrent: false, hasWorktree: false, isRemote: true },
      ]),
      getLocalUncommittedFiles: vi.fn().mockResolvedValue({ count: 1, files: ['changed.ts'] }),
    });
    vi.mocked(useApi).mockReturnValue(api);
  });

  const openBranches = async () => {
    render(<TaskGitControls {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: /main/i }));
    await screen.findByPlaceholderText('git.searchBranches');
  };

  it.each(['main', 'develop', 'origin/develop'])('creates a clean worktree from %s without the carry-over dialog', async (branch) => {
    await openBranches();
    fireEvent.change(screen.getByPlaceholderText('git.searchBranches'), { target: { value: branch } });
    const branchRow = screen.getAllByText(branch.split('/').at(-1)!, { selector: 'span' }).find((element) => element.closest('[class*="group/row"]'));
    fireEvent.click(branchRow!);
    fireEvent.click(screen.getByText(`git.createWorktreeFrom:${branch}`));

    await waitFor(() => {
      expect(api.switchToWorktreeWorkingMode).toHaveBeenCalledWith('/project', 'task-123', { baseBranch: branch });
    });
    expect(screen.queryByText('workingMode.confirmWorktreeTitle')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('git.searchBranches')).not.toBeInTheDocument();
  });

  it('asks for a local merge target when switching a remote-based worktree back to local mode', async () => {
    vi.mocked(api.listBranches).mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false }]);
    vi.mocked(api.getTaskGitStatus).mockResolvedValue({
      currentBranch: 'task-branch',
      uncommittedFiles: { count: 0, files: [] },
      rebaseState: { inProgress: false, hasUnmergedPaths: false },
      worktree: {
        baseBranch: 'origin/develop',
        targetBranch: 'origin/develop',
        aheadCommits: { count: 1, commits: ['task commit'] },
        predictedConflicts: { hasConflicts: false, conflictingFiles: [] },
      },
    });
    render(
      <TaskGitControls
        {...props}
        task={{ ...task, workingMode: 'worktree', worktree: { path: '/worktree', branch: 'task-branch', baseBranch: 'origin/develop' } }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /^main/ }));
    fireEvent.click(screen.getByRole('button', { name: /^workingMode.switchToLocal/ }));
    await screen.findByText('workingMode.confirmLocalTitle');
    fireEvent.click(screen.getByRole('button', { name: 'common.ok' }));

    await screen.findByText('worktree.selectBranch');
    expect(api.switchToLocalWorkingMode).not.toHaveBeenCalled();
    await screen.findByDisplayValue('main (worktree.branchCurrent)');
    fireEvent.click(screen.getByRole('button', { name: 'common.ok' }));

    await waitFor(() => expect(api.switchToLocalWorkingMode).toHaveBeenCalledWith('/project', 'task-123', { mergeBeforeSwitch: true, targetBranch: 'main' }));
  });

  it('switches directly with no dialog when the main checkout is clean', async () => {
    vi.mocked(api.getLocalUncommittedFiles).mockResolvedValue({ count: 0, files: [] });
    await openBranches();
    fireEvent.click(screen.getByRole('button', { name: /^workingMode.switchToWorktree/ }));

    await waitFor(() => expect(api.switchToWorktreeWorkingMode).toHaveBeenCalledWith('/project', 'task-123', undefined));
    expect(screen.queryByText('workingMode.confirmWorktreeTitle')).not.toBeInTheDocument();
  });

  it.each([
    ['workingMode.worktreeOptionCarryOverKeepLabel', false],
    ['workingMode.worktreeOptionCarryOverRemoveLabel', true],
  ])('preserves the %s carry-over option in the normal switch dialog', async (label, dropSourceChanges) => {
    await openBranches();
    fireEvent.click(screen.getByRole('button', { name: /^workingMode.switchToWorktree/ }));
    await screen.findByText('workingMode.confirmWorktreeTitle');
    expect(api.switchToWorktreeWorkingMode).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getByText('common.ok'));

    await waitFor(() => {
      expect(api.switchToWorktreeWorkingMode).toHaveBeenCalledWith('/project', 'task-123', {
        carryOverUncommittedChanges: true,
        dropSourceChanges,
      });
    });
  });
});

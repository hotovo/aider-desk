/**
 * Tests for local-mode rebase conflict banners in TaskStateActions.
 * When a local task's branch is in a rebase-conflict state, the same interactive
 * actions as in worktree mode (continue / resolve with agent / abort) must be shown.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationAPI } from '@common/api';
import { TaskData, TaskGitStatus } from '@common/types';

vi.mock('@/hooks/useTaskGitStatus', () => ({
  useTaskGitStatus: vi.fn(),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('@/components/extensions/useExtensionComponentsWrapper', () => ({
  useExtensionComponentsWrapper: vi.fn(() => ({ components: [], isEmpty: true })),
}));

vi.mock('@/components/extensions/ExtensionComponentRenderer', () => ({
  ExtensionComponentRenderer: () => null,
}));

import { TaskStateActions } from '../TaskStateActions';

import { useApi } from '@/contexts/ApiContext';
import { useTaskGitStatus } from '@/hooks/useTaskGitStatus';

const mockUseTaskGitStatus = vi.mocked(useTaskGitStatus);

type Props = {
  task?: TaskData | null;
  rebaseState: { inProgress: boolean; hasUnmergedPaths: boolean; unmergedFiles?: string[] };
};

const renderWithState = ({ task, rebaseState }: Props) => {
  const status: TaskGitStatus = {
    currentBranch: 'feature',
    uncommittedFiles: { count: 0, files: [] },
    rebaseState,
  };
  mockUseTaskGitStatus.mockReturnValue({ taskGitStatus: status, refreshStatus: vi.fn() });

  return render(<TaskStateActions projectDir="/project" taskId="task-1" state="in-progress" isArchived={false} task={task ?? null} />);
};

describe('TaskStateActions - local mode rebase banners', () => {
  const mockApi = {
    continueRebase: vi.fn(),
    resolveConflictsWithAgent: vi.fn(),
    abortRebase: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApi).mockReturnValue(mockApi as unknown as ApplicationAPI);
  });

  it('shows conflict actions with unmerged files for a local task', () => {
    const task = { workingMode: 'local' } as unknown as TaskData;
    renderWithState({
      task,
      rebaseState: { inProgress: true, hasUnmergedPaths: true, unmergedFiles: ['src/a.ts'] },
    });

    fireEvent.click(screen.getByText('worktree.continueRebase'));
    expect(mockApi.continueRebase).toHaveBeenCalledWith('/project', 'task-1');

    fireEvent.click(screen.getByText('worktree.resolveConflictsWithAgent'));
    expect(mockApi.resolveConflictsWithAgent).toHaveBeenCalledWith('/project', 'task-1');

    fireEvent.click(screen.getByText('worktree.abortRebase'));
    expect(mockApi.abortRebase).toHaveBeenCalledWith('/project', 'task-1');
  });

  it('shows resolved-state actions when rebase is in progress without unmerged files', () => {
    renderWithState({ rebaseState: { inProgress: true, hasUnmergedPaths: false } });

    expect(screen.getByText('worktree.rebaseConflictsResolvedDescription', { exact: false }) || screen.queryByText('worktree.continueRebase')).toBeTruthy();
    expect(screen.queryByText('worktree.abortRebase')).toBeTruthy();
  });

  it('shows default actions when the branch has no rebase in progress', () => {
    renderWithState({ rebaseState: { inProgress: false, hasUnmergedPaths: false } });

    expect(screen.queryByText('worktree.continueRebase')).toBeFalsy();
    expect(screen.queryByText('worktree.abortRebase')).toBeFalsy();
  });
});

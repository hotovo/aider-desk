import { join } from 'path';

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { GitManager } from '../git-manager';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils', () => ({
  execWithShellPath: vi.fn(),
  withLock: vi.fn((_id: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    rm: vi.fn(),
    mkdir: vi.fn(),
  };
});

import { AIDER_DESK_TASKS_DIR } from '@/constants';
import { execWithShellPath } from '@/utils';

const projectPath = '/test/project';
const taskId = 'task-123';
const worktreePath = join(projectPath, AIDER_DESK_TASKS_DIR, taskId, 'worktree');

describe('GitManager - createWorktree', () => {
  let gitManager: GitManager;

  const getCommands = (): string[] => (execWithShellPath as Mock).mock.calls.map((call: unknown[]) => call[0] as string);

  const mockGitCommands = (options?: { pruneFails?: boolean; removeFails?: boolean }) => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { stdout: 'true\n', stderr: '' };
      }
      if (command === 'git worktree prune') {
        if (options?.pruneFails) {
          throw new Error('prune failed');
        }
        return { stdout: '', stderr: '' };
      }
      if (command.startsWith('git worktree remove')) {
        if (options?.removeFails) {
          throw new Error("validation failed, cannot remove working tree: 'worktree/.git' does not exist");
        }
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse HEAD') {
        return { stdout: 'abc123\n', stderr: '' };
      }
      if (command === 'git show-ref --verify --quiet refs/heads/task-branch') {
        throw new Error('branch does not exist');
      }
      if (command.startsWith('git worktree add')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse task-branch') {
        return { stdout: 'def456\n', stderr: '' };
      }
      if (command === 'git rev-parse --abbrev-ref HEAD') {
        return { stdout: 'main\n', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    gitManager = new GitManager();
  });

  it('prunes stale worktree registrations and removes existing worktree before adding', async () => {
    mockGitCommands({ removeFails: true });

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch');

    const commands = getCommands();
    const pruneIndex = commands.indexOf('git worktree prune');
    const removeIndex = commands.findIndex((command) => command.startsWith('git worktree remove'));
    const addIndex = commands.findIndex((command) => command.startsWith('git worktree add'));

    expect(pruneIndex).toBeGreaterThanOrEqual(0);
    expect(removeIndex).toBeGreaterThan(pruneIndex);
    expect(addIndex).toBeGreaterThan(removeIndex);
    expect(execWithShellPath).toHaveBeenCalledWith('git worktree prune', { cwd: projectPath });
    expect(worktree).toEqual({
      path: worktreePath,
      baseCommit: 'abc123',
      baseBranch: 'main',
      branch: 'task-branch',
    });
  });

  it('still creates the worktree when prune fails', async () => {
    mockGitCommands({ pruneFails: true });

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch');

    expect(worktree.path).toBe(worktreePath);
    expect(worktree.branch).toBe('task-branch');
  });

  it('creates a detached worktree when no branch is provided', async () => {
    mockGitCommands();

    const worktree = await gitManager.createWorktree(projectPath, taskId);

    const addCommand = getCommands().find((command) => command.startsWith('git worktree add'));
    expect(addCommand).toBe(`git worktree add "${worktreePath}" HEAD`);
    expect(worktree).toEqual({
      path: worktreePath,
      baseCommit: 'abc123',
      baseBranch: 'main',
      branch: 'main',
    });
  });
});

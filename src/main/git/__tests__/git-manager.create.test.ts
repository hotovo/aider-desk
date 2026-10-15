import { join } from 'path';

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { simpleGit } from 'simple-git';

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

vi.mock('simple-git', () => ({ simpleGit: vi.fn() }));

import { AIDER_DESK_TASKS_DIR } from '@/constants';
import { execWithShellPath } from '@/utils';

const projectPath = '/test/project';
const taskId = 'task-123';
const worktreePath = join(projectPath, AIDER_DESK_TASKS_DIR, taskId, 'worktree');

describe('GitManager - createWorktree', () => {
  let gitManager: GitManager;

  const getCommands = (): string[] =>
    (execWithShellPath as Mock).mock.calls.map((call: unknown[]) => (Array.isArray(call[0]) ? call[0].join(' ') : call[0]) as string);

  const mockGitCommands = (options?: { pruneFails?: boolean; removeFails?: boolean }) => {
    (execWithShellPath as Mock).mockImplementation(async (input: string | string[]) => {
      const command = Array.isArray(input) ? input.join(' ') : input;
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
      if (command === 'git rev-parse HEAD' || command === 'git rev-parse --verify --end-of-options HEAD') {
        return { stdout: 'abc123\n', stderr: '' };
      }
      if (command === 'git show-ref --verify --quiet refs/heads/task-branch') {
        throw new Error('branch does not exist');
      }
      if (command.startsWith('git worktree add')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse --verify --end-of-options task-branch') {
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
    vi.spyOn(gitManager, 'isGitRepository').mockResolvedValue(true);
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

  it('creates a unique sibling branch when the branch is already checked out in another worktree', async () => {
    (execWithShellPath as Mock).mockImplementation(async (input: string | string[]) => {
      const command = Array.isArray(input) ? input.join(' ') : input;
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { stdout: 'true\n', stderr: '' };
      }
      if (command === 'git worktree prune') {
        return { stdout: '', stderr: '' };
      }
      if (command.startsWith('git worktree remove')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse HEAD' || command === 'git rev-parse --verify --end-of-options HEAD') {
        return { stdout: 'abc123\n', stderr: '' };
      }
      if (command === 'git show-ref --verify --quiet refs/heads/task-branch') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git worktree list --porcelain') {
        return {
          stdout: 'worktree /other/project\nbranch refs/heads/task-branch\n\nworktree /main\nbranch refs/heads/main\n',
          stderr: '',
        };
      }
      if (command === 'git show-ref --verify --quiet refs/heads/task-branch-2') {
        throw new Error('branch does not exist');
      }
      if (command === 'git branch') {
        return { stdout: '* task-branch\n', stderr: '' };
      }
      if (command.startsWith('git for-each-ref')) {
        return { stdout: '', stderr: '' };
      }
      if (command.startsWith('git worktree add')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse --verify --end-of-options task-branch-2' || command === 'git rev-parse --verify --end-of-options task-branch') {
        return { stdout: 'def456\n', stderr: '' };
      }
      if (command === 'git rev-parse --abbrev-ref HEAD') {
        return { stdout: 'main\n', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch');

    expect(getCommands()).toContain(`git worktree add -b task-branch-2 ${worktreePath} task-branch`);
    expect(worktree).toEqual({
      path: worktreePath,
      baseCommit: 'def456',
      baseBranch: 'main',
      branch: 'task-branch-2',
    });
  });

  it('reuses the branch when it is checked out in other worktrees but resumes this task own worktree path', async () => {
    (execWithShellPath as Mock).mockImplementation(async (input: string | string[]) => {
      const command = Array.isArray(input) ? input.join(' ') : input;
      if (command === 'git rev-parse --is-inside-work-tree') {
        return { stdout: 'true\n', stderr: '' };
      }
      if (command === 'git worktree prune') {
        return { stdout: '', stderr: '' };
      }
      if (command.startsWith('git worktree remove')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse HEAD' || command === 'git rev-parse --verify --end-of-options HEAD') {
        return { stdout: 'abc123\n', stderr: '' };
      }
      if (command === 'git show-ref --verify --quiet refs/heads/task-branch') {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git worktree list --porcelain') {
        return {
          stdout: `worktree ${worktreePath}\nbranch refs/heads/task-branch\n`,
          stderr: '',
        };
      }
      if (command.startsWith('git worktree add')) {
        return { stdout: '', stderr: '' };
      }
      if (command === 'git rev-parse --verify --end-of-options task-branch') {
        return { stdout: 'def456\n', stderr: '' };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch');

    expect(getCommands()).toContain(`git worktree add ${worktreePath} task-branch`);
    expect(worktree.branch).toBe('task-branch');
  });

  it.each(['develop', 'origin/develop'])('creates a clean task branch from %s without checking out the main directory', async (baseBranch) => {
    mockGitCommands();
    const raw = vi.fn().mockResolvedValueOnce('refs/heads/develop\nrefs/remotes/origin/develop').mockResolvedValue('fedcba\n');
    vi.mocked(simpleGit).mockReturnValue({ raw } as unknown as ReturnType<typeof simpleGit>);
    vi.spyOn(gitManager, 'listBranches').mockResolvedValue([]);

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch', baseBranch);

    expect(raw).toHaveBeenCalledWith([
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${baseBranch.startsWith('origin/') ? 'refs/remotes/' : 'refs/heads/'}${baseBranch}^{commit}`,
    ]);
    expect(getCommands()).toContain(`git worktree add -b task-branch ${worktreePath} fedcba`);
    expect(getCommands().some((command) => /git (checkout|stash|reset)/.test(command))).toBe(false);
    expect(worktree).toEqual({ path: worktreePath, branch: 'task-branch', baseBranch, baseCommit: 'fedcba' });
  });

  it('uses a unique task branch rather than reusing an existing branch when a base is selected', async () => {
    mockGitCommands();
    vi.mocked(simpleGit).mockReturnValue({ raw: vi.fn().mockResolvedValueOnce('refs/heads/develop').mockResolvedValue('fedcba') } as unknown as ReturnType<
      typeof simpleGit
    >);
    vi.spyOn(gitManager, 'listBranches').mockResolvedValue([{ name: 'task-branch', isCurrent: false, hasWorktree: false }]);

    const worktree = await gitManager.createWorktree(projectPath, taskId, 'task-branch', 'develop');

    expect(getCommands()).toContain(`git worktree add -b task-branch-2 ${worktreePath} fedcba`);
    expect(worktree.branch).toBe('task-branch-2');
    expect(worktree.baseBranch).toBe('develop');
  });

  it('rejects an invalid base before modifying the worktree', async () => {
    mockGitCommands();
    vi.mocked(simpleGit).mockReturnValue({ raw: vi.fn().mockRejectedValue(new Error('Unknown branch')) } as unknown as ReturnType<typeof simpleGit>);

    await expect(gitManager.createWorktree(projectPath, taskId, 'task-branch', 'missing')).rejects.toThrow('Unknown branch');

    expect(getCommands().some((command) => command.startsWith('git worktree'))).toBe(false);
  });

  it('creates a detached worktree when no branch is provided', async () => {
    mockGitCommands();

    const worktree = await gitManager.createWorktree(projectPath, taskId);

    const addCommand = getCommands().find((command) => command.startsWith('git worktree add'));
    expect(addCommand).toBe(`git worktree add ${worktreePath} HEAD`);
    expect(worktree).toEqual({
      path: worktreePath,
      baseCommit: 'abc123',
      baseBranch: 'main',
      branch: 'main',
    });
  });
});

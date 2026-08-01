import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { WorktreeManager } from '../worktree-manager';

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

import { execWithShellPath } from '@/utils';

const createAbortError = (): Error => {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
};

describe('WorktreeManager - commitChanges cancellation', () => {
  let worktreeManager: WorktreeManager;
  const worktreePath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
    vi.spyOn(worktreeManager, 'getUpdatedFiles').mockResolvedValue([
      { path: 'file-a.ts', additions: 1, deletions: 0 },
      { path: 'file-b.ts', additions: 2, deletions: 1 },
    ]);
  });

  it('should stage updated files and commit, returning true', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await worktreeManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-b.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "test commit"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should return false and skip commit when cancelled during staging', async () => {
    (execWithShellPath as Mock).mockImplementation(async () => {
      worktreeManager.cancelCommitChanges(worktreePath);
      return { stdout: '', stderr: '' };
    });

    const committed = await worktreeManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(false);
    const commands = (execWithShellPath as Mock).mock.calls.map((call: unknown[]) => call[0] as string);
    expect(commands.some((command) => command.startsWith('git commit'))).toBe(false);
  });

  it('should return false when the commit process is aborted', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command.startsWith('git commit')) {
        worktreeManager.cancelCommitChanges(worktreePath);
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await worktreeManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(false);
  });

  it('should rethrow errors that are not abort errors', async () => {
    const commitError = new Error('pre-commit hook failed');
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command.startsWith('git commit')) {
        throw commitError;
      }
      return { stdout: '', stderr: '' };
    });

    await expect(worktreeManager.commitChanges(worktreePath, 'test commit', false)).rejects.toBe(commitError);
  });

  it('should return false from cancelCommitChanges when no commit is running', () => {
    expect(worktreeManager.cancelCommitChanges(worktreePath)).toBe(false);
  });

  it('should allow a new commit after cancellation', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command.startsWith('git commit')) {
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    expect(await worktreeManager.commitChanges(worktreePath, 'cancelled commit', false)).toBe(false);
    expect(worktreeManager.cancelCommitChanges(worktreePath)).toBe(false);

    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });
    expect(await worktreeManager.commitChanges(worktreePath, 'new commit', false)).toBe(true);
  });
});

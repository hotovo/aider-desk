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

import { execWithShellPath } from '@/utils';

const createAbortError = (): Error => {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
};

describe('GitManager - commitChanges cancellation', () => {
  let gitManager: GitManager;
  const worktreePath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    gitManager = new GitManager();
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([
      { path: 'file-a.ts', additions: 1, deletions: 0 },
      { path: 'file-b.ts', additions: 2, deletions: 1 },
    ]);
  });

  it('should stage updated files and commit, returning true', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-b.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "test commit"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should use a plain commit when filePaths covers all updated files', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'all files commit', false, ['file-a.ts', 'file-b.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).not.toHaveBeenCalledWith(expect.stringContaining('git ls-files'), expect.anything());
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "all files commit"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should commit only the selected files via pathspec when filePaths is provided', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: 'file-a.ts\0', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'partial commit', false, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git ls-files -z "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).not.toHaveBeenCalledWith('git add -- "file-a.ts"', expect.anything());
    expect(execWithShellPath).not.toHaveBeenCalledWith('git add -- "file-b.ts"', expect.anything());
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "partial commit" "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should stage only untracked selected files when filePaths is provided', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'partial commit', false, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).not.toHaveBeenCalledWith('git add -- "file-b.ts"', expect.anything());
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "partial commit" "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should not use pathspec commit when amending an empty message', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, '', true, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git commit --amend --no-edit', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should retry staging with -A -f when git add fails for ignored files', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command === 'git add -- "file-b.ts"') {
        throw new Error('Command failed: git add -- "file-b.ts"\nThe following paths are ignored by one of your .gitignore files:\n.aider-desk');
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git add -- "file-a.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git add -A -f -- "file-b.ts"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "test commit"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should stage deleted files with -A -f when git add fails with pathspec error', async () => {
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([{ path: 'patches/@legendapp+list+3.3.7.patch', additions: 0, deletions: 10 }]);
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command === 'git add -- "patches/@legendapp+list+3.3.7.patch"') {
        throw new Error(
          'Command failed: git add -- "patches/@legendapp+list+3.3.7.patch"\nfatal: pathspec \'patches/@legendapp+list+3.3.7.patch\' did not match any files',
        );
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'remove patch', false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git add -A -f -- "patches/@legendapp+list+3.3.7.patch"', expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith('git commit -m "remove patch"', expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should return false and skip commit when cancelled during staging', async () => {
    (execWithShellPath as Mock).mockImplementation(async () => {
      gitManager.cancelCommitChanges(worktreePath);
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false);

    expect(committed).toBe(false);
    const commands = (execWithShellPath as Mock).mock.calls.map((call: unknown[]) => call[0] as string);
    expect(commands.some((command) => command.startsWith('git commit'))).toBe(false);
  });

  it('should return false when the commit process is aborted', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command.startsWith('git commit')) {
        gitManager.cancelCommitChanges(worktreePath);
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false);

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

    await expect(gitManager.commitChanges(worktreePath, 'test commit', false)).rejects.toBe(commitError);
  });

  it('should return false from cancelCommitChanges when no commit is running', () => {
    expect(gitManager.cancelCommitChanges(worktreePath)).toBe(false);
  });

  it('should allow a new commit after cancellation', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: string) => {
      if (command.startsWith('git commit')) {
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    expect(await gitManager.commitChanges(worktreePath, 'cancelled commit', false)).toBe(false);
    expect(gitManager.cancelCommitChanges(worktreePath)).toBe(false);

    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });
    expect(await gitManager.commitChanges(worktreePath, 'new commit', false)).toBe(true);
  });
});

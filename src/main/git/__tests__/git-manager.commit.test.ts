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

const isArrayCommand = (command: unknown, expected: string[]): boolean =>
  Array.isArray(command) && command.length === expected.length && command.every((part, index) => part === expected[index]);

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

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false, false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'add', '--', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'add', '--', 'file-b.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'test commit'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should use a plain commit when filePaths covers all updated files', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'all files commit', false, false, ['file-a.ts', 'file-b.ts']);

    expect(committed).toBe(true);
    const lsFilesCalled = (execWithShellPath as Mock).mock.calls.some(
      (call: unknown[]) => Array.isArray(call[0]) && (call[0] as string[]).includes('ls-files'),
    );
    expect(lsFilesCalled).toBe(false);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'all files commit'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should commit only the selected files via pathspec when filePaths is provided', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: 'file-a.ts\0', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'partial commit', false, false, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'ls-files', '-z', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).not.toHaveBeenCalledWith(['git', 'add', '--', 'file-a.ts'], expect.anything());
    expect(execWithShellPath).not.toHaveBeenCalledWith(['git', 'add', '--', 'file-b.ts'], expect.anything());
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'partial commit', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should stage only untracked selected files when filePaths is provided', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, 'partial commit', false, false, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'add', '--', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).not.toHaveBeenCalledWith(['git', 'add', '--', 'file-b.ts'], expect.anything());
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'partial commit', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should not use pathspec commit when amending an empty message', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const committed = await gitManager.commitChanges(worktreePath, '', true, false, ['file-a.ts']);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '--amend', '--no-edit'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should retry staging with -A -f when git add fails for ignored files', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (isArrayCommand(command, ['git', 'add', '--', 'file-b.ts'])) {
        throw new Error('Command failed: git add -- "file-b.ts"\nThe following paths are ignored by one of your .gitignore files:\n.aider-desk');
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false, false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'add', '--', 'file-a.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'add', '-A', '-f', '--', 'file-b.ts'], expect.objectContaining({ killSignal: 'SIGINT' }));
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'test commit'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should stage deleted files with -A -f when git add fails with pathspec error', async () => {
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([{ path: 'patches/@legendapp+list+3.3.7.patch', additions: 0, deletions: 10 }]);
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (isArrayCommand(command, ['git', 'add', '--', 'patches/@legendapp+list+3.3.7.patch'])) {
        throw new Error(
          'Command failed: git add -- "patches/@legendapp+list+3.3.7.patch"\nfatal: pathspec \'patches/@legendapp+list+3.3.7.patch\' did not match any files',
        );
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'remove patch', false, false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(
      ['git', 'add', '-A', '-f', '--', 'patches/@legendapp+list+3.3.7.patch'],
      expect.objectContaining({ killSignal: 'SIGINT' }),
    );
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'remove patch'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should skip staging and still commit when the file is deleted and not in the index (staged deletion)', async () => {
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([{ path: 'patches/ai+7.0.60.patch', additions: 0, deletions: 10 }]);
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (
        isArrayCommand(command, ['git', 'add', '--', 'patches/ai+7.0.60.patch']) ||
        isArrayCommand(command, ['git', 'add', '-A', '-f', '--', 'patches/ai+7.0.60.patch'])
      ) {
        throw new Error("Command failed\nfatal: pathspec 'patches/ai+7.0.60.patch' did not match any files");
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'remove patch', false, false);

    expect(committed).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith(
      ['git', 'add', '-A', '-f', '--', 'patches/ai+7.0.60.patch'],
      expect.objectContaining({ killSignal: 'SIGINT' }),
    );
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'commit', '-m', 'remove patch'], expect.objectContaining({ killSignal: 'SIGINT' }));
  });

  it('should fail the commit when the staging retry fails with an unexpected error', async () => {
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([{ path: 'locked-file.ts', additions: 1, deletions: 0 }]);
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (isArrayCommand(command, ['git', 'add', '--', 'locked-file.ts']) || isArrayCommand(command, ['git', 'add', '-A', '-f', '--', 'locked-file.ts'])) {
        throw new Error("Command failed\nfatal: unable to index file 'locked-file.ts'");
      }
      return { stdout: '', stderr: '' };
    });

    await expect(gitManager.commitChanges(worktreePath, 'test commit', false, false)).rejects.toThrow('unable to index file');
    expect(execWithShellPath).not.toHaveBeenCalledWith(['git', 'commit', '-m', 'test commit'], expect.anything());
  });

  it('should return false and skip commit when cancelled during staging', async () => {
    (execWithShellPath as Mock).mockImplementation(async () => {
      gitManager.cancelCommitChanges(worktreePath);
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false, false);

    expect(committed).toBe(false);
    const commitCalled = (execWithShellPath as Mock).mock.calls.some((call: unknown[]) => Array.isArray(call[0]) && (call[0] as string[])[1] === 'commit');
    expect(commitCalled).toBe(false);
  });

  it('should return false when the commit process is aborted', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (Array.isArray(command) && command[1] === 'commit') {
        gitManager.cancelCommitChanges(worktreePath);
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    const committed = await gitManager.commitChanges(worktreePath, 'test commit', false, false);

    expect(committed).toBe(false);
  });

  it('should rethrow errors that are not abort errors', async () => {
    const commitError = new Error('pre-commit hook failed');
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (Array.isArray(command) && command[1] === 'commit') {
        throw commitError;
      }
      return { stdout: '', stderr: '' };
    });

    await expect(gitManager.commitChanges(worktreePath, 'test commit', false, false)).rejects.toBe(commitError);
  });

  it('should return false from cancelCommitChanges when no commit is running', () => {
    expect(gitManager.cancelCommitChanges(worktreePath)).toBe(false);
  });

  it('should allow a new commit after cancellation', async () => {
    (execWithShellPath as Mock).mockImplementation(async (command: unknown) => {
      if (Array.isArray(command) && command[1] === 'commit') {
        throw createAbortError();
      }
      return { stdout: '', stderr: '' };
    });

    expect(await gitManager.commitChanges(worktreePath, 'cancelled commit', false, false)).toBe(false);
    expect(gitManager.cancelCommitChanges(worktreePath)).toBe(false);

    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });
    expect(await gitManager.commitChanges(worktreePath, 'new commit', false, false)).toBe(true);
  });
});

describe('GitManager - commitChanges shell injection safety', () => {
  let gitManager: GitManager;
  const worktreePath = '/test/worktree';
  const maliciousMessage = 'fix: $(touch /tmp/pwned) `rm -rf /` ; echo "hi" && whoami';

  beforeEach(() => {
    vi.clearAllMocks();
    gitManager = new GitManager();
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([
      { path: 'file-a.ts', additions: 1, deletions: 0 },
      { path: 'file-b.ts', additions: 2, deletions: 1 },
    ]);
  });

  const getCommitCall = (): unknown[] | undefined =>
    (execWithShellPath as Mock).mock.calls.find((call: unknown[]) => Array.isArray(call[0]) && (call[0] as string[])[1] === 'commit');

  it('should pass a message containing shell metacharacters literally as the -m argument', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    await gitManager.commitChanges(worktreePath, maliciousMessage, false, false);

    const commitCall = getCommitCall();
    expect(commitCall).toBeDefined();
    const argv = commitCall![0] as string[];
    const messageIndex = argv.indexOf('-m') + 1;
    expect(argv[messageIndex]).toBe(maliciousMessage);
    // The command must be an argv array (execFile, no shell), never a string
    expect(typeof commitCall![0]).not.toBe('string');
  });

  it('should never interpolate the message or paths into a string command (which would invoke a shell)', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    const maliciousPath = 'src/$(whoami).ts';
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([
      { path: maliciousPath, additions: 1, deletions: 0 },
      { path: 'file-b.ts', additions: 2, deletions: 1 },
    ]);

    await gitManager.commitChanges(worktreePath, maliciousMessage, false, false, [maliciousPath]);

    // Any command carrying user-controlled data (message or file path) must be an argv array, never a string.
    const unsafeStringCommand = (execWithShellPath as Mock).mock.calls.some(
      (call: unknown[]) => typeof call[0] === 'string' && ((call[0] as string).includes(maliciousMessage) || (call[0] as string).includes(maliciousPath)),
    );
    expect(unsafeStringCommand).toBe(false);
  });

  it('should pass the message literally when amending with --no-verify', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    await gitManager.commitChanges(worktreePath, maliciousMessage, true, true);

    const commitCall = getCommitCall();
    expect(commitCall).toBeDefined();
    const argv = commitCall![0] as string[];
    expect(argv).toEqual(['git', 'commit', '--amend', '--no-verify', '-m', maliciousMessage]);
  });

  it('should use --no-edit for an empty amend message without interpolating anything', async () => {
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    await gitManager.commitChanges(worktreePath, '   ', true, false);

    const commitCall = getCommitCall();
    expect(commitCall).toBeDefined();
    expect(commitCall![0]).toEqual(['git', 'commit', '--amend', '--no-edit']);
  });

  it('should pass malicious file paths literally as argv elements in a partial commit', async () => {
    const maliciousPath = 'src/$(whoami).ts';
    vi.spyOn(gitManager, 'getUpdatedFiles').mockResolvedValue([
      { path: maliciousPath, additions: 1, deletions: 0 },
      { path: 'file-b.ts', additions: 2, deletions: 1 },
    ]);
    (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

    await gitManager.commitChanges(worktreePath, maliciousMessage, false, false, [maliciousPath]);

    const commitCall = getCommitCall();
    expect(commitCall).toBeDefined();
    const argv = commitCall![0] as string[];
    expect(argv[argv.length - 1]).toBe(maliciousPath);
    expect(argv.indexOf('-m') + 1 < argv.length && argv[argv.indexOf('-m') + 1]).toBe(maliciousMessage);
  });
});

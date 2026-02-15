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

describe('WorktreeManager - stashUncommittedChanges', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  describe('Basic stash with no symlink folders', () => {
    it('should stash changes when symlinkFolders is empty', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'M modified.txt\0', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', []);

      expect(result).toBe('test-stash-id');
      expect(execWithShellPath).toHaveBeenCalledWith('git stash push -u -m "test-stash-id: Test stash message"', {
        cwd: testPath,
      });
    });

    it('should stash changes with default empty symlinkFolders parameter', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'M modified.txt\0', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message');

      expect(result).toBe('test-stash-id');
      expect(execWithShellPath).toHaveBeenCalledWith('git stash push -u -m "test-stash-id: Test stash message"', {
        cwd: testPath,
      });
    });
  });

  describe('Folder in .gitignore with untracked files', () => {
    it('should not add exclude pattern for node_modules (folder in .gitignore)', async () => {
      const symlinkFolders = ['node_modules', '_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(execWithShellPath).toHaveBeenCalledWith('git ls-files --others --exclude-standard -z', {
        cwd: testPath,
      });
      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message" -- . \':(exclude)_bmad\'');
      expect(stashCommand).not.toContain(':(exclude)node_modules');
    });

    it('should not add exclude patterns for multiple folders in .gitignore', async () => {
      const symlinkFolders = ['node_modules', '.next', 'dist', '_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message" -- . \':(exclude)_bmad\'');
      expect(stashCommand).not.toContain(':(exclude)node_modules');
      expect(stashCommand).not.toContain(':(exclude).next');
      expect(stashCommand).not.toContain(':(exclude)dist');
    });
  });

  describe('Folder NOT in .gitignore with untracked files', () => {
    it('should add :(exclude)pattern for folders NOT in .gitignore with untracked files', async () => {
      const symlinkFolders = ['_bmad', '_custom'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0_custom/data.json\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toContain(':(exclude)_bmad');
      expect(stashCommand).toContain(':(exclude)_custom');
    });

    it('should correctly construct exclude patterns for single folder with untracked files', async () => {
      const symlinkFolders = ['_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0_bmad/subdir/other.txt\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message" -- . \':(exclude)_bmad\'');
    });
  });

  describe('Multiple folders mixed scenario', () => {
    it('should handle mix of folders in .gitignore and not in .gitignore', async () => {
      const symlinkFolders = ['node_modules', '_bmad', '.next', '_custom'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0_custom/data.json\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe("git stash push -u -m \"test-stash-id: Test stash message\" -- . ':(exclude)_bmad' ':(exclude)_custom'");
      expect(stashCommand).toContain(':(exclude)_bmad');
      expect(stashCommand).toContain(':(exclude)_custom');
      expect(stashCommand).not.toContain(':(exclude)node_modules');
      expect(stashCommand).not.toContain(':(exclude).next');
    });

    it('should only add exclude patterns for folders that actually have untracked files', async () => {
      const symlinkFolders = ['node_modules', '_bmad', '_custom', '.next'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad/file.txt\0',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message" -- . \':(exclude)_bmad\'');
      expect(stashCommand).not.toContain(':(exclude)node_modules');
      expect(stashCommand).not.toContain(':(exclude)_custom');
      expect(stashCommand).not.toContain(':(exclude).next');
    });
  });

  describe('No untracked files in symlink folders', () => {
    it('should not add exclude patterns when no symlink folders have untracked files', async () => {
      const symlinkFolders = ['node_modules', '_bmad', '_custom'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: 'other-untracked.txt\n',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message"');
    });

    it('should not call git ls-files when symlinkFolders is empty', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', []);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;

      expect(calls).toHaveLength(2);
      expect(calls[0][0]).toBe('git status --porcelain=v1');
      expect(calls[1][0]).toBe('git stash push -u -m "test-stash-id: Test stash message"');
    });
  });

  describe('No changes to stash', () => {
    it('should return null when there are no uncommitted changes', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', ['node_modules']);

      expect(result).toBeNull();
      expect(execWithShellPath).toHaveBeenCalledTimes(1);
      expect(execWithShellPath).toHaveBeenCalledWith('git status --porcelain=v1', { cwd: testPath });
    });

    it('should return null early and not check untracked files when no changes exist', async () => {
      const symlinkFolders = ['_bmad', '_custom'];

      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBeNull();
      expect(execWithShellPath).not.toHaveBeenCalledWith('git ls-files --others --exclude-standard', {
        cwd: testPath,
      });
      expect(execWithShellPath).not.toHaveBeenCalledWith(expect.stringContaining('git stash push'), expect.anything());
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty untracked files output correctly', async () => {
      const symlinkFolders = ['_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toBe('git stash push -u -m "test-stash-id: Test stash message"');
    });

    it('should handle path normalization for Windows-style paths in untracked files', async () => {
      const symlinkFolders = ['_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' })
        .mockResolvedValueOnce({
          stdout: '_bmad\\file.txt\n_bmad/subdir/other.txt\n',
          stderr: '',
        })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toContain(':(exclude)_bmad');
    });

    it('should correctly detect folder with only untracked files (exact match)', async () => {
      const symlinkFolders = ['_bmad'];

      (execWithShellPath as Mock)
        .mockResolvedValueOnce({ stdout: 'M modified.txt\0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '_bmad\0', stderr: '' })
        .mockResolvedValueOnce({ stdout: '', stderr: '' });

      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', symlinkFolders);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toContain(':(exclude)_bmad');
    });

    it('should throw error when execWithShellPath fails during stash', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' }).mockRejectedValueOnce(new Error('Git command failed'));

      await expect(worktreeManager.stashUncommittedChanges('test-stash-id', testPath, 'Test stash message', [])).rejects.toThrow(
        'Failed to stash uncommitted changes: Git command failed',
      );
    });

    it('should properly escape message in stash command', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'M modified.txt\n', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      const messageWithQuotes = 'Test message with "quotes" and special chars';
      const result = await worktreeManager.stashUncommittedChanges('test-stash-id', testPath, messageWithQuotes, []);

      expect(result).toBe('test-stash-id');

      const calls = (execWithShellPath as Mock).mock.calls;
      const stashCommand = calls[calls.length - 1][0];

      expect(stashCommand).toContain(`test-stash-id: ${messageWithQuotes}`);
    });
  });
});

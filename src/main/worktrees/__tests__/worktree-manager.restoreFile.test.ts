import * as fs from 'fs/promises';
import { join } from 'path';

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

vi.mock('fs/promises');

import { execWithShellPath } from '@/utils';

describe('WorktreeManager - restoreFile', () => {
  let worktreeManager: WorktreeManager;
  const worktreePath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  describe('Tracked files', () => {
    it('should use git restore for tracked modified file', async () => {
      // git ls-files --error-unmatch returns exitCode 0 for tracked files
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'tracked-file.txt', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'tracked-file.txt');

      // First call should be to check if file is tracked
      expect(execWithShellPath).toHaveBeenCalledWith('git ls-files --error-unmatch -- "tracked-file.txt"', {
        cwd: worktreePath,
      });

      // Second call should be git restore
      expect(execWithShellPath).toHaveBeenCalledWith('git restore -- "tracked-file.txt"', {
        cwd: worktreePath,
      });
    });

    it('should use git restore for tracked deleted file', async () => {
      // git ls-files --error-unmatch returns exitCode 0 for tracked files
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'deleted-file.txt', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'deleted-file.txt');

      // Should call git restore to recreate the file from HEAD
      expect(execWithShellPath).toHaveBeenCalledWith('git restore -- "deleted-file.txt"', {
        cwd: worktreePath,
      });
    });

    it('should escape quotes in file path for tracked files', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'file with "quotes".txt', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'file with "quotes".txt');

      // Check that quotes are escaped in both commands
      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toBe('git ls-files --error-unmatch -- "file with \\"quotes\\".txt"');
      expect(calls[1][0]).toBe('git restore -- "file with \\"quotes\\".txt"');
    });
  });

  describe('Untracked files', () => {
    it('should delete untracked new file using fs.unlink', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'new-untracked-file.txt' did not match any file(s) known by git"));
      // lstat returns info for a file (not a directory)
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any);
      vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'new-untracked-file.txt');

      // Should check if file is tracked first
      expect(execWithShellPath).toHaveBeenCalledWith('git ls-files --error-unmatch -- "new-untracked-file.txt"', {
        cwd: worktreePath,
      });

      // Should use lstat to check if it's a directory (using absolute path)
      expect(fs.lstat).toHaveBeenCalledWith(join(worktreePath, 'new-untracked-file.txt'));

      // Should delete the untracked file using fs.unlink (using absolute path)
      expect(fs.unlink).toHaveBeenCalledWith(join(worktreePath, 'new-untracked-file.txt'));
    });

    it('should delete untracked symlink without following it', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'untracked-symlink' did not match any file(s) known by git"));
      // lstat returns info for a symlink (not following it)
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => true } as any);
      vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'untracked-symlink');

      // Should use lstat to detect symlink (not following it) - using absolute path
      expect(fs.lstat).toHaveBeenCalledWith(join(worktreePath, 'untracked-symlink'));

      // Should use fs.unlink to remove symlink (not follow it) - using absolute path
      expect(fs.unlink).toHaveBeenCalledWith(join(worktreePath, 'untracked-symlink'));
    });
  });

  describe('Directories', () => {
    it('should use rm with recursive flag for untracked directories', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'untracked-folder' did not match any file(s) known by git"));
      // lstat returns info indicating it's a directory
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => true, isSymbolicLink: () => false } as any);
      vi.mocked(fs.rm).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'untracked-folder');

      // Should check if it's a directory using lstat (absolute path)
      expect(fs.lstat).toHaveBeenCalledWith(join(worktreePath, 'untracked-folder'));

      // Should use rm with recursive and force flags for directories (absolute path)
      expect(fs.rm).toHaveBeenCalledWith(join(worktreePath, 'untracked-folder'), { recursive: true, force: true });
    });

    it('should handle symlink pointing to directory', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'symlink-to-folder' did not match any file(s) known by git"));
      // lstat detects symlink (not following it)
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => true } as any);
      vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'symlink-to-folder');

      // Should use fs.unlink to remove the symlink itself (not the target) - absolute path
      expect(fs.unlink).toHaveBeenCalledWith(join(worktreePath, 'symlink-to-folder'));
    });
  });

  describe('Error handling', () => {
    it('should handle ENOENT (file already deleted) gracefully', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'already-deleted-file.txt' did not match any file(s) known by git"));
      // lstat throws ENOENT - file doesn't exist
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.lstat).mockRejectedValueOnce(enoentError);

      // Should not throw, just log and return
      await expect(worktreeManager.restoreFile(worktreePath, 'already-deleted-file.txt')).resolves.not.toThrow();
    });

    it('should re-throw unexpected errors from lstat', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'permission-denied-file.txt' did not match any file(s) known by git"));
      // lstat throws a different error (not ENOENT)
      const otherError = new Error('EACCES: permission denied');
      (otherError as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.lstat).mockRejectedValueOnce(otherError);

      await expect(worktreeManager.restoreFile(worktreePath, 'permission-denied-file.txt')).rejects.toThrow('EACCES: permission denied');
    });

    it('should log error and re-throw when git restore fails for tracked files', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'tracked.txt', stderr: '' });
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('git restore failed'));

      await expect(worktreeManager.restoreFile(worktreePath, 'tracked.txt')).rejects.toThrow('git restore failed');
    });

    it('should log error and re-throw when unlink fails for untracked files', async () => {
      // git ls-files --error-unmatch returns exit code 1 with "did not match" for untracked files
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("error: pathspec 'untracked.txt' did not match any file(s) known by git"));
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any);
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(worktreeManager.restoreFile(worktreePath, 'untracked.txt')).rejects.toThrow('EACCES: permission denied');
    });
  });

  describe('Path handling', () => {
    it('should handle file paths with spaces', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'path with spaces/file.txt', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'path with spaces/file.txt');

      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toContain('"path with spaces/file.txt"');
      expect(calls[1][0]).toContain('"path with spaces/file.txt"');
    });

    it('should handle relative paths', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '../relative/file.txt', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, '../relative/file.txt');

      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toContain('"../relative/file.txt"');
      expect(calls[1][0]).toContain('"../relative/file.txt"');
    });
  });
});

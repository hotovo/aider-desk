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

  describe('Tracked files (exist in HEAD)', () => {
    it('should use git restore --staged --worktree --source=HEAD for tracked modified file', async () => {
      // git cat-file -e returns exitCode 0 for files that exist in HEAD
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'tracked-file.txt');

      // First call should be to check if file exists in HEAD
      expect(execWithShellPath).toHaveBeenCalledWith('git cat-file -e HEAD:"tracked-file.txt"', {
        cwd: worktreePath,
      });

      // Second call should be git restore with both staged and worktree
      expect(execWithShellPath).toHaveBeenCalledWith('git restore --staged --worktree --source=HEAD -- "tracked-file.txt"', {
        cwd: worktreePath,
      });
    });

    it('should use git restore --staged --worktree --source=HEAD for tracked deleted file', async () => {
      // git cat-file -e returns exitCode 0 for files that exist in HEAD
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'deleted-file.txt');

      // Should call git restore to recreate the file from HEAD
      expect(execWithShellPath).toHaveBeenCalledWith('git restore --staged --worktree --source=HEAD -- "deleted-file.txt"', {
        cwd: worktreePath,
      });
    });

    it('should escape quotes in file path for tracked files', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'file with "quotes".txt');

      // Check that quotes are escaped in both commands
      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toBe('git cat-file -e HEAD:"file with \\"quotes\\".txt"');
      expect(calls[1][0]).toBe('git restore --staged --worktree --source=HEAD -- "file with \\"quotes\\".txt"');
    });
  });

  describe('New files (not in HEAD)', () => {
    it('should remove new staged file from index and delete working tree copy', async () => {
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached succeeds (file is staged)
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
      // lstat returns info for a file (not a directory)
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any);
      vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'new-file.txt');

      // First call should be to check if file exists in HEAD
      expect(execWithShellPath).toHaveBeenCalledWith('git cat-file -e HEAD:"new-file.txt"', {
        cwd: worktreePath,
      });

      // Second call should remove from index
      expect(execWithShellPath).toHaveBeenCalledWith('git rm --cached -f -- "new-file.txt"', {
        cwd: worktreePath,
      });

      // Should delete the file from working tree
      expect(fs.unlink).toHaveBeenCalledWith(join(worktreePath, 'new-file.txt'));
    });

    it('should handle new file not in index gracefully', async () => {
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails (file not in index)
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'untracked.txt' did not match any files"));
      // lstat returns info for a file
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any);
      vi.mocked(fs.unlink).mockResolvedValueOnce(undefined);

      await worktreeManager.restoreFile(worktreePath, 'untracked.txt');

      // Should still try to delete from working tree
      expect(fs.unlink).toHaveBeenCalledWith(join(worktreePath, 'untracked.txt'));
    });

    it('should delete untracked symlink without following it', async () => {
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails (file not in index)
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'untracked-symlink' did not match any files"));
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
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'untracked-folder' did not match any files"));
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
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'symlink-to-folder' did not match any files"));
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
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'already-deleted-file.txt' did not match any files"));
      // lstat throws ENOENT - file doesn't exist
      const enoentError = new Error('ENOENT: no such file or directory');
      (enoentError as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.lstat).mockRejectedValueOnce(enoentError);

      // Should not throw, just log and return
      await expect(worktreeManager.restoreFile(worktreePath, 'already-deleted-file.txt')).resolves.not.toThrow();
    });

    it('should re-throw unexpected errors from lstat', async () => {
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'permission-denied-file.txt' did not match any files"));
      // lstat throws a different error (not ENOENT)
      const otherError = new Error('EACCES: permission denied');
      (otherError as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.lstat).mockRejectedValueOnce(otherError);

      await expect(worktreeManager.restoreFile(worktreePath, 'permission-denied-file.txt')).rejects.toThrow('EACCES: permission denied');
    });

    it('should log error and re-throw when git restore fails for tracked files', async () => {
      // git cat-file -e returns exitCode 0 for files in HEAD
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
      // git restore fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('git restore failed'));

      await expect(worktreeManager.restoreFile(worktreePath, 'tracked.txt')).rejects.toThrow('git restore failed');
    });

    it('should log error and re-throw when unlink fails for new files', async () => {
      // git cat-file -e throws for files not in HEAD
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error('fatal: Not a valid object name'));
      // git rm --cached also fails
      (execWithShellPath as Mock).mockRejectedValueOnce(new Error("fatal: pathspec 'untracked.txt' did not match any files"));
      vi.mocked(fs.lstat).mockResolvedValueOnce({ isDirectory: () => false, isSymbolicLink: () => false } as any);
      vi.mocked(fs.unlink).mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(worktreeManager.restoreFile(worktreePath, 'untracked.txt')).rejects.toThrow('EACCES: permission denied');
    });
  });

  describe('Path handling', () => {
    it('should handle file paths with spaces', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, 'path with spaces/file.txt');

      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toContain('"path with spaces/file.txt"');
      expect(calls[1][0]).toContain('"path with spaces/file.txt"');
    });

    it('should handle relative paths', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await worktreeManager.restoreFile(worktreePath, '../relative/file.txt');

      const calls = (execWithShellPath as Mock).mock.calls;
      expect(calls[0][0]).toContain('"../relative/file.txt"');
      expect(calls[1][0]).toContain('"../relative/file.txt"');
    });
  });
});

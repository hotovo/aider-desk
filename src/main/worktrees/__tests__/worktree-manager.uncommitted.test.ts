import { lstatSync } from 'fs';

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { WorktreeManager } from '../worktree-manager';

import { execWithShellPath } from '@/utils';

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

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  lstatSync: vi.fn(),
}));

describe('WorktreeManager - hasUncommittedChanges', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return false when no uncommitted changes', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(false);
  });

  it('should return true when there are real file changes', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: ' M src/main/file.ts\0',
      stderr: '',
    });
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(true);
  });

  it('should return false when only symlink entries exist', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: '?? resources/linux\0',
      stderr: '',
    });
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => true });

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(false);
  });

  it('should return true when there are real changes alongside symlinks', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: ' M src/main/file.ts\0?? resources/linux\0',
      stderr: '',
    });
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('resources/linux'),
    }));

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(true);
  });

  it('should treat lstatSync failure as non-symlink', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: '?? resources/linux\0',
      stderr: '',
    });
    (lstatSync as Mock).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(true);
  });

  it('should return false on execWithShellPath failure', async () => {
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('git failed'));

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(false);
  });

  it('should handle multiple symlinks and real files correctly', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: '?? node_modules\0?? resources/linux\0 M src/main/file.ts\0',
      stderr: '',
    });
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('node_modules') || p.includes('resources/linux'),
    }));

    const result = await worktreeManager.hasUncommittedChanges(testPath);

    expect(result).toBe(true);
  });
});

describe('WorktreeManager - getUncommittedFiles', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/project/path';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return empty when no uncommitted changes', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await worktreeManager.getUncommittedFiles(testPath);

    expect(result.count).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('should return real files excluding symlinks', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: ' M src/main/file.ts\0?? resources/linux\0',
      stderr: '',
    });
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('resources/linux'),
    }));

    const result = await worktreeManager.getUncommittedFiles(testPath);

    expect(result.count).toBe(1);
    expect(result.files).toEqual(['src/main/file.ts']);
  });

  it('should return all files when none are symlinks', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: ' M src/main/a.ts\0 M src/main/b.ts\0',
      stderr: '',
    });
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });

    const result = await worktreeManager.getUncommittedFiles(testPath);

    expect(result.count).toBe(2);
    expect(result.files).toEqual(['src/main/a.ts', 'src/main/b.ts']);
  });

  it('should return empty when all entries are symlinks', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: '?? node_modules\0?? resources/linux\0?? .venv\0',
      stderr: '',
    });
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => true });

    const result = await worktreeManager.getUncommittedFiles(testPath);

    expect(result.count).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('should deduplicate files', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({
      stdout: ' M src/file.ts\0M  src/file.ts\0',
      stderr: '',
    });
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });

    const result = await worktreeManager.getUncommittedFiles(testPath);

    expect(result.count).toBe(2);
    expect(result.files).toEqual(['src/file.ts']);
  });
});

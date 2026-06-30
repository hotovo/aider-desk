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

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
  },
  access: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  rm: vi.fn(),
  lstat: vi.fn(),
  symlink: vi.fn(),
}));

vi.mock('istextorbinary', () => ({
  isBinary: () => false,
}));

const fs = await import('fs/promises');

interface MockSeq {
  responses: Array<{ stdout: string; stderr: string } | Error>;
  index: number;
}

const createMockSeq = (responses: Array<{ stdout: string; stderr: string } | Error>): MockSeq => ({ responses, index: 0 });

const useMockSeq = (seq: MockSeq): void => {
  (execWithShellPath as Mock).mockImplementation(async () => {
    const resp = seq.responses[seq.index++];
    if (resp instanceof Error) {
      throw resp;
    }
    return resp;
  });
};

describe('WorktreeManager - getUpdatedFiles symlink filtering', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should filter out symlink paths in non-worktree mode (getNonWorktreeUpdatedFiles)', async () => {
    useMockSeq(
      createMockSeq([
        { stdout: 'abc123\n', stderr: '' },
        { stdout: '3\t2\tsrc/main/file.ts\0-\t-\tresources/linux\0', stderr: '' },
        { stdout: 'diff content', stderr: '' },
      ]),
    );
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('resources/linux'),
    }));
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/main/file.ts');
  });

  it('should filter out symlink paths in worktree flat mode (getWorktreeFlatUpdatedFiles)', async () => {
    const mainBranch = 'main';

    useMockSeq(
      createMockSeq([
        { stdout: '5\t1\tsrc/app.ts\0-\t-\tnode_modules\0', stderr: '' },
        { stdout: 'diff content', stderr: '' },
      ]),
    );
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('node_modules'),
    }));
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath, 'worktree', mainBranch, 'flat' as never);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/app.ts');
  });

  it('should filter out symlink paths in worktree grouped uncommitted changes', async () => {
    const mainBranch = 'main';
    const commitDiff = 'diff --git a/src/main/file.ts b/src/main/file.ts\n--- a/src/main/file.ts\n+++ b/src/main/file.ts\n@@ -1 +1 @@\n-old\n+new';

    useMockSeq(
      createMockSeq([
        { stdout: 'abc123|Test commit\n', stderr: '' },
        { stdout: '2\t1\tsrc/main/file.ts\n-\t-\tresources/linux\n', stderr: '' },
        { stdout: commitDiff, stderr: '' },
        { stdout: 'abc123\n', stderr: '' },
        { stdout: '1\t1\tsrc/uncommitted.ts\0-\t-\tresources/linux\0', stderr: '' },
        { stdout: 'diff content', stderr: '' },
        { stdout: '', stderr: '' },
      ]),
    );
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('resources/linux'),
    }));
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath, 'worktree', mainBranch);

    const paths = result.map((f) => f.path);
    expect(paths).toContain('src/main/file.ts');
    expect(paths).toContain('src/uncommitted.ts');
    expect(paths).not.toContain('resources/linux');
  });

  it('should filter out symlink paths in worktree grouped committed changes', async () => {
    const mainBranch = 'main';
    const commitDiff =
      'diff --git a/resources/linux b/resources/linux\n--- a/resources/linux\n+++ b/resources/linux\n@@ -1 +1 @@\n-old\n+new\ndiff --git a/src/main/file.ts b/src/main/file.ts\n--- a/src/main/file.ts\n+++ b/src/main/file.ts\n@@ -1 +1 @@\n-old\n+new';

    useMockSeq(
      createMockSeq([
        { stdout: 'abc123|Test commit\n', stderr: '' },
        { stdout: '2\t1\tsrc/main/file.ts\n-\t-\tresources/linux\n', stderr: '' },
        { stdout: commitDiff, stderr: '' },
        { stdout: 'abc123\n', stderr: '' },
        { stdout: '', stderr: '' },
        { stdout: '', stderr: '' },
      ]),
    );
    (lstatSync as Mock).mockImplementation((p: string) => ({
      isSymbolicLink: () => p.includes('resources/linux'),
    }));
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath, 'worktree', mainBranch);

    const paths = result.map((f) => f.path);
    expect(paths).toContain('src/main/file.ts');
    expect(paths).not.toContain('resources/linux');
  });
});

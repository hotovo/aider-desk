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
  isBinary: vi.fn(() => false),
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

describe('WorktreeManager - getUpdatedFiles no HEAD (no commits)', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return staged files when there are no commits (non-worktree mode)', async () => {
    const diffContent =
      'diff --git a/src/main.ts b/src/main.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/main.ts\n@@ -0,0 +1,3 @@\n+line1\n+line2\n+line3';

    useMockSeq(createMockSeq([new Error('HEAD not found'), { stdout: '3\t0\tsrc/main.ts\0', stderr: '' }, { stdout: diffContent, stderr: '' }]));
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/main.ts');
    expect(result[0].additions).toBe(3);
    expect(result[0].deletions).toBe(0);
    expect(result[0].diff).toBe(diffContent);
  });

  it('should filter symlink paths in no-HEAD mode', async () => {
    useMockSeq(
      createMockSeq([
        new Error('HEAD not found'),
        { stdout: '3\t0\tsrc/main.ts\0-\t-\tresources/linux\0', stderr: '' },
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
    expect(result[0].path).toBe('src/main.ts');
  });

  it('should handle binary files in no-HEAD mode', async () => {
    // @ts-expect-error istextorbinary library does not provide TypeScript definitions
    const { isBinary } = await import('istextorbinary');
    (isBinary as Mock).mockReturnValue(true);

    useMockSeq(createMockSeq([new Error('HEAD not found'), { stdout: '-\t-\tassets/image.png\0', stderr: '' }]));
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = await worktreeManager.getUpdatedFiles(testPath);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('assets/image.png');
    expect(result[0].diff).toBe('');

    (isBinary as Mock).mockReturnValue(false);
  });

  it('should return staged files in worktree mode when no HEAD exists', async () => {
    const mainBranch = 'main';
    const diffContent = 'diff --git a/src/app.ts b/src/app.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/app.ts\n@@ -0,0 +1,2 @@\n+hello\n+world';

    useMockSeq(
      createMockSeq([new Error('log failed'), new Error('HEAD not found'), { stdout: '2\t0\tsrc/app.ts\0', stderr: '' }, { stdout: diffContent, stderr: '' }]),
    );
    (lstatSync as Mock).mockReturnValue({ isSymbolicLink: () => false });
    (fs.default.access as Mock).mockResolvedValue(undefined);
    (fs.default.readFile as Mock).mockResolvedValue(Buffer.from('hello'));

    const result = await worktreeManager.getUpdatedFiles(testPath, 'worktree', mainBranch);

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/app.ts');
    expect(result[0].additions).toBe(2);
    expect(result[0].diff).toBe(diffContent);
  });
});

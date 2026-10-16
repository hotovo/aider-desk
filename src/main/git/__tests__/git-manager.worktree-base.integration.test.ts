import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleGit } from 'simple-git';

import { GitManager } from '../git-manager';

import { execWithShellPath } from '@/utils';

vi.unmock('fs');
vi.unmock('path');
vi.mock('@/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils')>();
  return { ...actual, execWithShellPath: vi.fn(actual.execWithShellPath) };
});

const revisionExpression = 'HEAD^{/.*|$(printf REVIEW_PROBE >&2)}';

describe('GitManager worktree base safety', () => {
  let projectPath: string;
  let manager: GitManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv('GIT_INDEX_FILE', undefined);
    projectPath = await mkdtemp(join(tmpdir(), 'aiderdesk-worktree-base-'));
    manager = new GitManager();
    const git = simpleGit(projectPath);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.invalid');
    await git.checkoutLocalBranch('main');
    await writeFile(join(projectPath, 'tracked.txt'), 'initial');
    await git.add('tracked.txt');
    await git.commit('initial');
  });

  afterEach(async () => {
    try {
      await rm(projectPath, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('rejects revision expressions before creating a worktree even when Git resolves them', async () => {
    expect(await simpleGit(projectPath).revparse([`${revisionExpression}^{commit}`])).toMatch(/^[a-f0-9]+$/);

    await expect(manager.createWorktree(projectPath, 'unsafe', 'task-branch', revisionExpression)).rejects.toThrow('does not exist');

    expect(vi.mocked(execWithShellPath).mock.calls.some(([command]) => String(command).includes('worktree add'))).toBe(false);
    expect(await simpleGit(projectPath).raw(['worktree', 'list', '--porcelain'])).not.toContain('task-branch');
  });

  it('supports literal shell metacharacters in real branch names without evaluating them', async () => {
    const baseBranch = 'feature/$(printf${IFS}REVIEW_PROBE)';
    await simpleGit(projectPath).branch([baseBranch]);
    await writeFile(join(projectPath, 'tracked.txt'), 'local changes');

    const worktree = await manager.createWorktree(projectPath, 'literal', 'task-branch', baseBranch);

    expect(worktree.baseBranch).toBe(baseBranch);
    expect(await simpleGit(worktree.path).revparse(['HEAD'])).toBe(await simpleGit(projectPath).revparse([baseBranch]));
    expect(await readFile(join(projectPath, 'tracked.txt'), 'utf8')).toBe('local changes');
    expect(await simpleGit(worktree.path).status()).toMatchObject({ files: [] });
    await expect(manager.getAheadCommits(worktree.path, baseBranch)).resolves.toEqual({ count: 0, commits: [] });
    expect(execWithShellPath).toHaveBeenCalledWith(['git', 'log', '--oneline', `${baseBranch}..HEAD`, '--'], { cwd: worktree.path });
    expect(vi.mocked(execWithShellPath).mock.calls.some(([command]) => typeof command === 'string' && command.includes(baseBranch))).toBe(false);
  });

  it('keeps legacy revision expressions out of shell commands during status and diff checks', async () => {
    const worktree = await manager.createWorktree(projectPath, 'legacy', 'task-branch');
    vi.mocked(execWithShellPath).mockClear();

    await manager.checkWorktreeForUnmergedWork(projectPath, worktree.path, revisionExpression);
    await manager.checkForRebaseConflicts(worktree.path, revisionExpression);
    await manager.getUpdatedFiles(worktree.path, 'worktree', revisionExpression);
    await manager.getFileDiff(worktree.path, 'worktree', revisionExpression, 'tracked.txt');
    await manager.getFileContents(worktree.path, 'worktree', revisionExpression, 'tracked.txt');
    await manager.getSyncCommits(worktree.path, revisionExpression);

    const calls = vi.mocked(execWithShellPath).mock.calls;
    expect(calls.some(([command]) => Array.isArray(command) && command.some((argument) => argument.includes(revisionExpression)))).toBe(true);
    expect(calls.some(([command]) => typeof command === 'string' && command.includes(revisionExpression))).toBe(false);
  });

  it('rejects remote integration targets before stashing or modifying refs, then allows a selected local target', async () => {
    const git = simpleGit(projectPath);
    await git.raw(['update-ref', 'refs/remotes/origin/develop', 'HEAD']);
    const worktree = await manager.createWorktree(projectPath, 'remote', 'task-branch', 'origin/develop');
    const worktreeGit = simpleGit(worktree.path);
    await writeFile(join(worktree.path, 'task.txt'), 'task changes');
    await worktreeGit.add('task.txt');
    await worktreeGit.commit('task commit');
    vi.mocked(execWithShellPath).mockClear();

    await expect(manager.mergeWorktreeToMainWithUncommitted(projectPath, 'remote', worktree.path, false, undefined, 'origin/develop')).rejects.toThrow(
      'not a local branch',
    );

    expect(vi.mocked(execWithShellPath).mock.calls).toHaveLength(0);
    expect((await git.branchLocal()).all).not.toContain('origin/develop');
    await manager.mergeWorktreeToMainWithUncommitted(projectPath, 'remote', worktree.path, false, undefined, 'main');
    expect(await readFile(join(projectPath, 'task.txt'), 'utf8')).toBe('task changes');
    expect((await git.branchLocal()).all).not.toContain('origin/develop');
  });
});

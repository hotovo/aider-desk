import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { simpleGit } from 'simple-git';

import { GitManager } from '../git-manager';

vi.unmock('fs');
vi.unmock('path');

describe('GitManager push to worktree base', () => {
  let root: string;
  let projectPath: string;
  let remotePath: string;
  let worktreePath: string;
  let originalHead: string;
  let manager: GitManager;

  beforeEach(async () => {
    vi.stubEnv('GIT_INDEX_FILE', undefined);
    root = await mkdtemp(join(tmpdir(), 'aiderdesk-push-base-'));
    projectPath = join(root, 'project');
    remotePath = join(root, 'remote.git');
    worktreePath = join(root, 'worktree');
    await mkdir(projectPath);
    await mkdir(remotePath);
    await simpleGit(remotePath).init(true);
    const git = simpleGit(projectPath);
    await git.init();
    await git.addConfig('user.name', 'Test');
    await git.addConfig('user.email', 'test@example.invalid');
    await git.checkoutLocalBranch('feature-a');
    await writeFile(join(projectPath, 'tracked.txt'), 'PR content');
    await git.add('tracked.txt');
    await git.commit('PR commit');
    originalHead = await git.revparse(['HEAD']);
    await git.addRemote('github', remotePath);
    await git.push(['--set-upstream', 'github', 'HEAD:refs/heads/pr-branch']);
    await git.checkoutLocalBranch('feature-b');
    await writeFile(join(projectPath, 'tracked.txt'), 'unfinished feature B');
    await git.raw(['worktree', 'add', '-b', 'task-fix', worktreePath, 'feature-a']);
    await writeFile(join(worktreePath, 'tracked.txt'), 'fixed PR content');
    const worktreeGit = simpleGit(worktreePath);
    await worktreeGit.add('tracked.txt');
    await worktreeGit.commit('PR commit amended', ['--amend']);
    manager = new GitManager();
  });

  afterEach(async () => {
    try {
      await rm(root, { recursive: true, force: true });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each(['feature-a', 'github/pr-branch'])(
    'publishes the amended HEAD via base %s without touching local branches or unfinished work',
    async (baseBranch) => {
      await manager.gitPush(worktreePath, true, true, baseBranch);

      const git = simpleGit(projectPath);
      const taskGit = simpleGit(worktreePath);
      expect(await simpleGit(remotePath).revparse(['refs/heads/pr-branch'])).toBe(await taskGit.revparse(['HEAD']));
      expect(await git.revparse(['feature-a'])).toBe(originalHead);
      expect(await git.revparse(['feature-b'])).toBe(originalHead);
      expect(await git.branchLocal()).toMatchObject({ current: 'feature-b' });
      expect(await readFile(join(projectPath, 'tracked.txt'), 'utf8')).toBe('unfinished feature B');
      expect(await git.raw(['config', '--get', 'branch.feature-a.merge'])).toBe('refs/heads/pr-branch\n');
      expect((await taskGit.getConfig('branch.task-fix.remote')).value).toBeNull();
    },
  );

  it.each(['--merge', '--apply'])('rejects forced base pushes during a conflicted rebase (%s)', async (backend) => {
    const git = simpleGit(worktreePath);
    await git.checkout(['-b', 'rebase-target', 'feature-a']);
    await writeFile(join(worktreePath, 'tracked.txt'), 'conflicting target content');
    await git.add('tracked.txt');
    await git.commit('target commit');
    await git.checkout('task-fix');
    await expect(git.rebase([backend, 'rebase-target'])).rejects.toThrow();
    expect((await manager.getRebaseState(worktreePath)).inProgress).toBe(true);
    expect(await git.revparse(['HEAD'])).not.toBe(originalHead);

    await expect(manager.gitPush(worktreePath, true, false, 'feature-a')).rejects.toThrow('rebase is in progress');

    expect(await simpleGit(remotePath).revparse(['refs/heads/pr-branch'])).toBe(originalHead);
    expect((await manager.getRebaseState(worktreePath)).inProgress).toBe(true);
  });

  it.each(['+refs/heads/*:refs/remotes/github/review/*', '+refs/heads/pr-branch:refs/remotes/github/review/pr-branch'])(
    'resolves the real remote branch with custom fetch mapping %s',
    async (refspec) => {
      const git = simpleGit(worktreePath);
      await git.addConfig('remote.github.fetch', refspec);
      await git.fetch('github');

      await manager.gitPush(worktreePath, true, false, 'github/review/pr-branch');

      expect(await simpleGit(remotePath).revparse(['refs/heads/pr-branch'])).toBe(await git.revparse(['HEAD']));
      expect((await simpleGit(remotePath).branch()).all).toEqual(['pr-branch']);
      expect(await readFile(join(projectPath, 'tracked.txt'), 'utf8')).toBe('unfinished feature B');
    },
  );

  it('rejects ambiguous fetch mappings without updating any remote branch', async () => {
    const git = simpleGit(worktreePath);
    await git.addConfig('remote.github.fetch', '+refs/heads/*:refs/remotes/github/review/*');
    await git.fetch('github');
    await git.addConfig('remote.github.fetch', '+refs/heads/other/*:refs/remotes/github/review/*', true);

    await expect(manager.gitPush(worktreePath, true, false, 'github/review/pr-branch')).rejects.toThrow('unique push destination');

    expect(await simpleGit(remotePath).revparse(['refs/heads/pr-branch'])).toBe(originalHead);
    expect(await simpleGit(remotePath).branch()).toMatchObject({ all: ['pr-branch'] });
  });

  it('rejects an amended non-fast-forward update without Force', async () => {
    await expect(manager.gitPush(worktreePath, false, false, 'feature-a')).rejects.toThrow();

    expect(await simpleGit(remotePath).revparse(['refs/heads/pr-branch'])).toBe(originalHead);
    expect(await readFile(join(projectPath, 'tracked.txt'), 'utf8')).toBe('unfinished feature B');
  });
});

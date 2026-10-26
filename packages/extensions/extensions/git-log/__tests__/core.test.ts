import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getLog } from '../core';

describe('Git Log history filters', () => {
  let cwd: string;
  let base: string;
  let checkpoint: string;
  let task: string;
  let remote: string;
  let tagged: string;

  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  const createCommit = (subject: string) => git('commit-tree', `${base}^{tree}`, '-p', base, '-m', subject);

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'git-log-filters-'));
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    git('config', 'commit.gpgSign', 'false');
    writeFileSync(join(cwd, 'file.txt'), 'base');
    git('add', 'file.txt');
    git('commit', '-m', 'base');
    base = git('rev-parse', 'HEAD');
    checkpoint = createCommit('aiderdesk-checkpoint:test');
    task = createCommit('task');
    remote = createCommit('remote');
    tagged = createCommit('tagged');
    git('update-ref', 'refs/aiderdesk-checkpoints/test/cp-1', checkpoint);
    git('update-ref', 'refs/heads/aider-desk/test-task', task);
    git('update-ref', 'refs/remotes/origin/test-remote', remote);
    git('update-ref', 'refs/tags/test-tag', tagged);
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('excludes checkpoint-only history by default', async () => {
    const result = await getLog(cwd, 'all', 0, 20);
    expect(result.commits.map((commit) => commit.hash)).toEqual(expect.arrayContaining([base, task, remote, tagged]));
    expect(result.commits.map((commit) => commit.hash)).not.toContain(checkpoint);
  });

  it('includes checkpoints when enabled', async () => {
    const result = await getLog(cwd, 'all', 0, 20, { includeCheckpoints: true });
    expect(result.commits.map((commit) => commit.hash)).toContain(checkpoint);
  });

  it('filters task branches, remotes and tags without excluding shared ancestors', async () => {
    const result = await getLog(cwd, 'all', 0, 20, {
      includeAiderDeskBranches: false,
      includeRemoteBranches: false,
      includeTags: false,
    });
    expect(result.commits.map((commit) => commit.hash)).toEqual([base]);
  });

  it('does not hide a commit reachable through an enabled branch', async () => {
    git('update-ref', 'refs/heads/normal-branch', checkpoint);
    const result = await getLog(cwd, 'all', 0, 20);
    expect(result.commits.map((commit) => commit.hash)).toContain(checkpoint);
  });

  it('preserves explicit branch selections and detached HEAD', async () => {
    const filters = { includeAiderDeskBranches: false, includeRemoteBranches: false, includeTags: false };
    const branchResult = await getLog(cwd, 'aider-desk/test-task', 0, 20, filters);
    expect(branchResult.commits.map((commit) => commit.hash)).toContain(task);
    git('checkout', '--detach', '--quiet', task);
    const allResult = await getLog(cwd, 'all', 0, 20, filters);
    expect(allResult.commits.map((commit) => commit.hash)).toContain(task);
  });

  it('paginates after applying filters', async () => {
    const filters = { includeAiderDeskBranches: false, includeRemoteBranches: false, includeTags: false, includeCheckpoints: true };
    const first = await getLog(cwd, 'all', 0, 1, filters);
    const second = await getLog(cwd, 'all', 1, 1, filters);
    expect(first.hasMore).toBe(true);
    expect(second.hasMore).toBe(false);
    expect([...first.commits, ...second.commits].map((commit) => commit.hash).sort()).toEqual([checkpoint, base].sort());
  });
});
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

describe('WorktreeManager - isCommitAncestorOf', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return true when commit is ancestor of HEAD', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await worktreeManager.isCommitAncestorOf(testPath, 'abc123');

    expect(result).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git merge-base --is-ancestor abc123 HEAD', { cwd: testPath });
  });

  it('should return false when commit is not ancestor of HEAD', async () => {
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('exit code 1'));

    const result = await worktreeManager.isCommitAncestorOf(testPath, 'abc123');

    expect(result).toBe(false);
  });

  it('should use custom descendant ref when provided', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await worktreeManager.isCommitAncestorOf(testPath, 'abc123', 'feature-branch');

    expect(result).toBe(true);
    expect(execWithShellPath).toHaveBeenCalledWith('git merge-base --is-ancestor abc123 feature-branch', { cwd: testPath });
  });
});

describe('WorktreeManager - getRebaseOntoCommit', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return onto commit from rebase-merge', async () => {
    (execWithShellPath as Mock)
      .mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-merge', stderr: '' }) // git rev-parse --git-path rebase-merge
      .mockResolvedValueOnce({ stdout: 'abc123def456\n', stderr: '' }); // cat onto file

    const result = await worktreeManager.getRebaseOntoCommit(testPath);

    expect(result).toBe('abc123def456');
  });

  it('should return onto commit from rebase-apply when rebase-merge does not exist', async () => {
    (execWithShellPath as Mock)
      .mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-merge', stderr: '' }) // git rev-parse --git-path rebase-merge
      .mockRejectedValueOnce(new Error('file not found')) // cat onto file fails
      .mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-apply', stderr: '' }) // git rev-parse --git-path rebase-apply
      .mockResolvedValueOnce({ stdout: 'def789abc012\n', stderr: '' }); // cat onto file

    const result = await worktreeManager.getRebaseOntoCommit(testPath);

    expect(result).toBe('def789abc012');
  });

  it('should return undefined when no rebase is in progress', async () => {
    (execWithShellPath as Mock)
      .mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-merge', stderr: '' })
      .mockRejectedValueOnce(new Error('file not found'))
      .mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-apply', stderr: '' })
      .mockRejectedValueOnce(new Error('file not found'));

    const result = await worktreeManager.getRebaseOntoCommit(testPath);

    expect(result).toBeUndefined();
  });

  it('should return undefined on git command failure', async () => {
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('git failed'));

    const result = await worktreeManager.getRebaseOntoCommit(testPath);

    expect(result).toBeUndefined();
  });
});

describe('WorktreeManager - getBranchPointingAtCommit', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return branch name when a branch points at commit', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });

    const result = await worktreeManager.getBranchPointingAtCommit(testPath, 'abc123');

    expect(result).toBe('main');
    expect(execWithShellPath).toHaveBeenCalledWith("git branch --points-at abc123 --format='%(refname:short)'", { cwd: testPath });
  });

  it('should return first branch when multiple branches point at commit', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'main\ndevelop\n', stderr: '' });

    const result = await worktreeManager.getBranchPointingAtCommit(testPath, 'abc123');

    expect(result).toBe('main');
  });

  it('should return undefined when no branch points at commit', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });

    const result = await worktreeManager.getBranchPointingAtCommit(testPath, 'abc123');

    expect(result).toBeUndefined();
  });

  it('should filter out HEAD and parenthetical entries', async () => {
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '(HEAD detached)\nmain\n', stderr: '' });

    const result = await worktreeManager.getBranchPointingAtCommit(testPath, 'abc123');

    expect(result).toBe('main');
  });

  it('should return undefined on git command failure', async () => {
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('git failed'));

    const result = await worktreeManager.getBranchPointingAtCommit(testPath, 'abc123');

    expect(result).toBeUndefined();
  });
});

describe('WorktreeManager - rebaseMainIntoWorktree baseCommit validation', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';
  const mainBranch = 'main';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should use --onto with valid baseCommit', async () => {
    const baseCommit = 'abc123';

    // hasUncommittedChanges - no changes
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
    // isCommitAncestorOf - returns true (valid)
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
    // rebase command
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Successfully rebased', stderr: '' });

    await worktreeManager.rebaseMainIntoWorktree(testPath, mainBranch, baseCommit);

    expect(execWithShellPath).toHaveBeenCalledWith(`git rebase --onto ${mainBranch} ${baseCommit}`, { cwd: testPath });
  });

  it('should fall back to simple rebase when baseCommit is not ancestor of HEAD', async () => {
    const baseCommit = 'stale123';

    // hasUncommittedChanges - no changes
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
    // isCommitAncestorOf - returns false (stale)
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('exit code 1'));
    // rebase command (should be simple rebase)
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Successfully rebased', stderr: '' });

    await worktreeManager.rebaseMainIntoWorktree(testPath, mainBranch, baseCommit);

    expect(execWithShellPath).toHaveBeenCalledWith(`git rebase ${mainBranch}`, { cwd: testPath });
  });

  it('should use simple rebase when baseCommit is not provided', async () => {
    // hasUncommittedChanges - no changes
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' });
    // rebase command
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Successfully rebased', stderr: '' });

    await worktreeManager.rebaseMainIntoWorktree(testPath, mainBranch);

    expect(execWithShellPath).toHaveBeenCalledWith(`git rebase ${mainBranch}`, { cwd: testPath });
  });
});

describe('WorktreeManager - continueRebase', () => {
  let worktreeManager: WorktreeManager;
  const testPath = '/test/worktree';

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  it('should return onto info when rebase state exists', async () => {
    // getRebaseOntoCommit - rebase-merge path
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-merge', stderr: '' });
    // cat onto file
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'abc123def456\n', stderr: '' });
    // getBranchPointingAtCommit
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
    // git rebase --continue
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Successfully rebased', stderr: '' });
    // git log (for resetTempCommitIfExists)
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Regular commit message', stderr: '' });

    const result = await worktreeManager.continueRebase(testPath);

    expect(result.ontoCommit).toBe('abc123def456');
    expect(result.ontoBranch).toBe('main');
  });

  it('should return empty onto info when no rebase state exists', async () => {
    // getRebaseOntoCommit - fails to find onto
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-merge', stderr: '' });
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('file not found'));
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '/test/worktree/.git/rebase-apply', stderr: '' });
    (execWithShellPath as Mock).mockRejectedValueOnce(new Error('file not found'));
    // git rebase --continue
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Successfully rebased', stderr: '' });
    // git log (for resetTempCommitIfExists)
    (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: 'Regular commit message', stderr: '' });

    const result = await worktreeManager.continueRebase(testPath);

    expect(result.ontoCommit).toBeUndefined();
    expect(result.ontoBranch).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { BranchInfo } from '@common/types';

import { GitError, GitManager } from '../git-manager';

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

describe('GitManager - branch operations', () => {
  let gitManager: GitManager;
  const projectPath = '/test/project';

  const localBranchOutput = '* main\n  feature-a\n  feature-b\n';

  const upstreamRefOutput = ['main\torigin/main\t[ahead 2, behind 1]', 'feature-a\torigin/feature-a\t', 'feature-b\t', ''].join('\n');

  beforeEach(() => {
    vi.clearAllMocks();
    gitManager = new GitManager();
  });

  describe('listBranches', () => {
    it('should return local branches with upstream tracking info', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command === 'git branch') {
          return Promise.resolve({ stdout: localBranchOutput, stderr: '' });
        }
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command.startsWith('git for-each-ref')) {
          return Promise.resolve({ stdout: upstreamRefOutput, stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const branches = await gitManager.listBranches(projectPath);

      expect(branches).toHaveLength(3);

      const main = branches.find((b) => b.name === 'main') as BranchInfo;
      expect(main.isCurrent).toBe(true);
      expect(main.upstream).toBe('origin/main');
      expect(main.ahead).toBe(2);
      expect(main.behind).toBe(1);

      const featureA = branches.find((b) => b.name === 'feature-a') as BranchInfo;
      expect(featureA.ahead).toBe(0);
      expect(featureA.behind).toBe(0);
      expect(featureA.isRemote).toBeFalsy();

      expect(branches[0].name).toBe('main');
    });

    it('should synthesize the current branch when the repository has no commits yet', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command === 'git branch') {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git branch --show-current') {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: 'worktree /test/project\nHEAD 0000000000000000000000000000000000000000\nbranch refs/heads/main\n', stderr: '' });
        }
        if (command.startsWith('git for-each-ref')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const branches = await gitManager.listBranches(projectPath);

      expect(branches).toHaveLength(1);
      expect(branches[0].name).toBe('main');
      expect(branches[0].isCurrent).toBe(true);
      expect(branches[0].isRemote).toBeFalsy();
      expect(branches[0].hasWorktree).toBe(true);
    });

    it('should include remote branches when requested, skipping HEAD pointers, remote-name refs and local duplicates', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command === 'git branch') {
          return Promise.resolve({ stdout: localBranchOutput, stderr: '' });
        }
        if (command === "git branch -r --format='%(refname:short)'") {
          return Promise.resolve({ stdout: 'origin/HEAD\norigin/main\norigin/feature-x\nupstream/docs-only\norigin\n', stderr: '' });
        }
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command.startsWith('git for-each-ref')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const branches = await gitManager.listBranches(projectPath, true);
      const names = branches.map((b) => b.name);

      expect(names).toContain('origin/feature-x');
      expect(names).toContain('upstream/docs-only');
      expect(names).not.toContain('origin/main');
      expect(names).not.toContain('origin/HEAD');
      expect(names).not.toContain('origin');
      expect(branches.filter((b) => b.isRemote)).toHaveLength(2);
    });
  });

  describe('createBranch', () => {
    it('should create and checkout a branch without start point', async () => {
      (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await gitManager.createBranch(projectPath, 'new-feature');

      expect(execWithShellPath).toHaveBeenCalledWith("git check-ref-format --branch 'new-feature'", { cwd: projectPath });
      expect(execWithShellPath).toHaveBeenCalledWith("git checkout -b 'new-feature'", { cwd: projectPath });
    });

    it('should create a branch from a start point without checkout', async () => {
      (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await gitManager.createBranch(projectPath, 'new-feature', 'main', false);

      expect(execWithShellPath).toHaveBeenCalledWith("git branch 'new-feature' 'main'", { cwd: projectPath });
    });

    it('should throw GitError for invalid branch name', async () => {
      (execWithShellPath as Mock).mockRejectedValue(new Error('fatal: not a valid ref'));

      await expect(gitManager.createBranch(projectPath, 'invalid..name')).rejects.toThrow(GitError);
      await expect(gitManager.createBranch(projectPath, 'invalid..name')).rejects.toThrow('Invalid branch name');
    });
  });

  describe('checkoutBranch', () => {
    it('should perform plain checkout', async () => {
      (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await gitManager.checkoutBranch(projectPath, 'feature-b');

      expect(execWithShellPath).toHaveBeenCalledWith("git checkout 'feature-b'", { cwd: projectPath });
    });

    it('should create a tracking branch for a remote branch', async () => {
      (execWithShellPath as Mock).mockResolvedValueOnce({ stdout: '', stderr: '' }).mockResolvedValueOnce({ stdout: '', stderr: '' });

      await gitManager.checkoutBranch(projectPath, 'origin/feature-x', true);

      expect(execWithShellPath).toHaveBeenCalledWith("git branch --list 'feature-x'", { cwd: projectPath });
      expect(execWithShellPath).toHaveBeenCalledWith("git checkout -b 'feature-x' --track 'origin/feature-x'", { cwd: projectPath });
    });

    it('should detach the branch in other worktrees when takeOver is set', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({
            stdout: 'worktree /other/task/worktree\nHEAD abc1234\nbranch refs/heads/feature-b\n\nworktree /main/repo\nHEAD def5678\nbranch refs/heads/master\n',
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitManager.checkoutBranch(projectPath, 'feature-b', false, true);

      expect(execWithShellPath).toHaveBeenCalledWith('git checkout --detach', { cwd: '/other/task/worktree' });
      expect(execWithShellPath).toHaveBeenCalledWith("git checkout 'feature-b'", { cwd: projectPath });
    });

    it('should not detach anything when takeOver is not set', async () => {
      (execWithShellPath as Mock).mockResolvedValue({ stdout: '', stderr: '' });

      await gitManager.checkoutBranch(projectPath, 'feature-b');

      expect(execWithShellPath).not.toHaveBeenCalledWith('git checkout --detach', expect.anything());
    });

    it('should checkout the existing local branch when tracking branch already exists', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git branch --list')) {
          return Promise.resolve({ stdout: '  feature-x\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitManager.checkoutBranch(projectPath, 'origin/feature-x', true);

      expect(execWithShellPath).toHaveBeenCalledWith("git checkout 'feature-x'", { cwd: projectPath });
    });

    it('should provide a friendly error when branch is checked out in another worktree', async () => {
      const error = new Error('command failed') as Error & { stderr: string };
      error.stderr = "fatal: 'feature-a' is already used by worktree at '/other/path'";
      (execWithShellPath as Mock).mockRejectedValue(error);

      await expect(gitManager.checkoutBranch(projectPath, 'feature-a')).rejects.toThrow('already checked out in another worktree');
    });
  });

  describe('deleteBranch', () => {
    it('should refuse to delete a branch checked out in a worktree', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({
            stdout: 'worktree /main\nHEAD abc123\nbranch refs/heads/feature-a\n\nworktree /wt\nHEAD def456\nbranch refs/heads/feature-b\n',
            stderr: '',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await expect(gitManager.deleteBranch(projectPath, 'feature-b')).rejects.toThrow('checked out in a worktree');
    });

    it('should refuse to delete the currently checked out branch', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git branch --show-current') {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await expect(gitManager.deleteBranch(projectPath, 'main')).rejects.toThrow('currently checked out');
    });

    it('should use -d by default and -D when force is set', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git branch --show-current') {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await gitManager.deleteBranch(projectPath, 'feature-a');
      expect(execWithShellPath).toHaveBeenCalledWith("git branch -d 'feature-a'", { cwd: projectPath });

      await gitManager.deleteBranch(projectPath, 'feature-a', true);
      expect(execWithShellPath).toHaveBeenCalledWith("git branch -D 'feature-a'", { cwd: projectPath });
    });

    it('should provide a friendly error for unmerged branches', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git worktree list')) {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git branch --show-current') {
          return Promise.resolve({ stdout: 'main\n', stderr: '' });
        }
        if (command.startsWith('git branch -d')) {
          const error = new Error('not fully merged') as Error & { stderr: string };
          error.stderr = "error: The branch 'feature-a' is not fully merged.";
          return Promise.reject(error);
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await expect(gitManager.deleteBranch(projectPath, 'feature-a')).rejects.toThrow('not fully merged');
    });
  });

  describe('mergeIntoCurrent', () => {
    it('should merge and return empty result on success', async () => {
      (execWithShellPath as Mock).mockResolvedValue({ stdout: 'Merge made by recursive', stderr: '' });

      const result = await gitManager.mergeIntoCurrent(projectPath, 'feature-a');

      expect(execWithShellPath).toHaveBeenCalledWith("git merge --no-edit 'feature-a'", { cwd: projectPath });
      expect(result).toEqual({});
    });

    it('should detect conflicts and return conflicted files', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git merge')) {
          const error = new Error('CONFLICT') as Error & { stderr: string };
          error.stderr = 'CONFLICT (content): Merge conflict in file.txt';
          return Promise.reject(error);
        }
        if (command.includes('--diff-filter=U')) {
          return Promise.resolve({ stdout: 'file.txt\nother.txt\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitManager.mergeIntoCurrent(projectPath, 'feature-a');

      expect(result.conflictedFiles).toEqual(['file.txt', 'other.txt']);
    });
  });

  describe('rebaseOnto', () => {
    it('should refuse to rebase with uncommitted changes', async () => {
      (execWithShellPath as Mock).mockResolvedValue({
        stdout: ' M file.ts\0',
        stderr: '',
      });

      await expect(gitManager.rebaseOnto(projectPath, 'main')).rejects.toThrow('uncommitted changes');
    });

    it('should rebase onto a branch on success', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git status')) {
          return Promise.resolve({ stdout: '\0', stderr: '' });
        }
        return Promise.resolve({ stdout: 'Successfully rebased', stderr: '' });
      });

      const result = await gitManager.rebaseOnto(projectPath, 'main');

      expect(execWithShellPath).toHaveBeenCalledWith("git rebase 'main'", { cwd: projectPath });
      expect(result).toEqual({});
    });

    it('should detect conflicts during rebase', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command.startsWith('git status')) {
          return Promise.resolve({ stdout: '\0', stderr: '' });
        }
        if (command.startsWith('git rebase')) {
          const error = new Error('conflict') as Error & { stderr: string };
          error.stderr = 'CONFLICT (content): Merge conflict in file.txt';
          return Promise.reject(error);
        }
        if (command.includes('--diff-filter=U')) {
          return Promise.resolve({ stdout: 'file.txt\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitManager.rebaseOnto(projectPath, 'main');

      expect(result.conflictedFiles).toEqual(['file.txt']);
    });
  });

  describe('getSyncCommits', () => {
    const mockUpstreamCommits = () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command === "git rev-parse --abbrev-ref '@{upstream}'") {
          return Promise.resolve({ stdout: 'origin/main', stderr: '' });
        }
        if (command === 'git fetch --quiet') {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git log --oneline origin/main..HEAD') {
          return Promise.resolve({ stdout: '', stderr: '' });
        }
        if (command === 'git log --oneline HEAD..origin/main') {
          return Promise.resolve({ stdout: 'abc123 New remote commit\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });
    };

    it('should fetch the remote before computing counts', async () => {
      mockUpstreamCommits();

      const result = await gitManager.getSyncCommits(projectPath);

      const calls = (execWithShellPath as Mock).mock.calls as [string, { cwd: string }][];
      const fetchIndex = calls.findIndex(([command]) => command === 'git fetch --quiet');
      const logIndex = calls.findIndex(([command]) => command.startsWith('git log'));
      expect(fetchIndex).toBeGreaterThanOrEqual(0);
      expect(fetchIndex).toBeLessThan(logIndex);
      expect(calls[fetchIndex][1]).toEqual({ cwd: projectPath });

      expect(result.incoming).toEqual({ count: 1, commits: ['abc123 New remote commit'] });
      expect(result.outgoing).toEqual({ count: 0, commits: [] });
    });

    it('should not fail when fetching the remote fails', async () => {
      (execWithShellPath as Mock).mockImplementation((command: string) => {
        if (command === "git rev-parse --abbrev-ref '@{upstream}'") {
          return Promise.resolve({ stdout: 'origin/main', stderr: '' });
        }
        if (command === 'git fetch --quiet') {
          return Promise.reject(new Error('Could not resolve host'));
        }
        if (command === 'git log --oneline HEAD..origin/main') {
          return Promise.resolve({ stdout: 'def456 Stale remote commit\n', stderr: '' });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const result = await gitManager.getSyncCommits(projectPath);

      expect(result.incoming).toEqual({ count: 1, commits: ['def456 Stale remote commit'] });
      expect(result.outgoing).toEqual({ count: 0, commits: [] });
    });

    it('should throttle repeated remote fetches within the throttle window', async () => {
      mockUpstreamCommits();

      await gitManager.getSyncCommits(projectPath);
      await gitManager.getSyncCommits(projectPath);

      const fetchCalls = ((execWithShellPath as Mock).mock.calls as [string][]).filter(([command]) => command === 'git fetch --quiet');
      expect(fetchCalls).toHaveLength(1);
    });

    it('should not fetch when the current branch has no upstream', async () => {
      (execWithShellPath as Mock).mockRejectedValue(new Error('no upstream configured'));

      const result = await gitManager.getSyncCommits(projectPath);

      expect(result).toEqual({ outgoing: { count: 0, commits: [] }, incoming: { count: 0, commits: [] } });
      expect(execWithShellPath).not.toHaveBeenCalledWith('git fetch --quiet', expect.anything());
    });
  });
});

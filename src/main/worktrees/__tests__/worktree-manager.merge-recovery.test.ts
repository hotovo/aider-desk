import { join } from 'path';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

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

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    rm: vi.fn(),
  };
});

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

import { execWithShellPath } from '@/utils';

const projectPath = '/test/project';
const worktreePath = '/test/project/.aider-desk/tasks/task-123/worktree';
const rebaseMergeDir = '/test/worktree/.git/rebase-merge';

const getCommands = (): string[] => (execWithShellPath as Mock).mock.calls.map((call: unknown[]) => call[0] as string);

const createCollisionError = (): Error =>
  Object.assign(new Error('Command failed: git stash apply stash@{0}'), {
    stderr: 'file.cs already exists, no checkout\nerror: could not restore untracked files from stash',
    stdout: '',
  });

describe('WorktreeManager - merge rebase guard and stash recovery', () => {
  let worktreeManager: WorktreeManager;

  beforeEach(() => {
    vi.clearAllMocks();
    worktreeManager = new WorktreeManager();
  });

  describe('mergeWorktreeToMainWithUncommitted - in-progress rebase guard', () => {
    const mockRebaseInProgress = () => {
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git rev-parse master':
            return { stdout: 'aaa111\n', stderr: '' };
          case 'git rev-parse HEAD':
            return { stdout: 'bbb222\n', stderr: '' };
          case 'git status --porcelain=v1 -z':
            return { stdout: '', stderr: '' };
          case 'git status --porcelain=v1':
            return { stdout: '', stderr: '' };
          case 'git rev-parse --git-path rebase-merge':
            return { stdout: `${rebaseMergeDir}\n`, stderr: '' };
          case `test -e "${rebaseMergeDir}"`:
            return { stdout: '', stderr: '' };
          case 'git merge --abort':
            return { stdout: '', stderr: '' };
          case 'git reset --hard aaa111':
            return { stdout: '', stderr: '' };
          case 'git stash list':
            return { stdout: '', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });
    };

    it('should abort squash merge without touching rebase state when a rebase is in progress', async () => {
      mockRebaseInProgress();

      await expect(
        worktreeManager.mergeWorktreeToMainWithUncommitted(projectPath, 'task-123', worktreePath, true, 'test commit message', 'master'),
      ).rejects.toThrow('Cannot squash merge: a rebase is in progress in the worktree');

      expect(getCommands()).not.toContain('git rebase --abort');
      expect(getCommands()).not.toContain('git rebase master');
      expect(getCommands()).not.toContain('git merge --squash');
    });

    it('should abort plain merge without touching rebase state when a rebase is in progress', async () => {
      mockRebaseInProgress();

      await expect(worktreeManager.mergeWorktreeToMainWithUncommitted(projectPath, 'task-123', worktreePath, false, undefined, 'master')).rejects.toThrow(
        'Cannot merge: a rebase is in progress in the worktree',
      );

      expect(getCommands()).not.toContain('git rebase --abort');
      expect(getCommands()).not.toContain('git rebase master');
    });

    it('should abort its own rebase when the pre-merge rebase conflicts and no rebase was in progress', async () => {
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git rev-parse master':
            return { stdout: 'aaa111\n', stderr: '' };
          case 'git rev-parse HEAD':
            return { stdout: 'bbb222\n', stderr: '' };
          case 'git status --porcelain=v1 -z':
            return { stdout: '', stderr: '' };
          case 'git status --porcelain=v1':
            return { stdout: '', stderr: '' };
          case 'git rev-parse --git-path rebase-merge':
            return { stdout: `${rebaseMergeDir}\n`, stderr: '' };
          case `test -e "${rebaseMergeDir}"`:
            throw new Error('No such file or directory');
          case 'git rev-parse --git-path rebase-apply':
            return { stdout: '/test/worktree/.git/rebase-apply\n', stderr: '' };
          case 'test -e "/test/worktree/.git/rebase-apply"':
            throw new Error('No such file or directory');
          case 'git branch --show-current':
            return { stdout: 'task-branch\n', stderr: '' };
          case 'git log --oneline master..HEAD':
            return { stdout: 'abc123 some commit\n', stderr: '' };
          case 'git rebase master':
            throw new Error('Command failed: git rebase master\nerror: could not apply abc123');
          case 'git rebase --abort':
            return { stdout: '', stderr: '' };
          case 'git merge --abort':
            return { stdout: '', stderr: '' };
          case 'git reset --hard aaa111':
            return { stdout: '', stderr: '' };
          case 'git stash list':
            return { stdout: '', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });

      await expect(
        worktreeManager.mergeWorktreeToMainWithUncommitted(projectPath, 'task-123', worktreePath, true, 'test commit message', 'master'),
      ).rejects.toThrow('Failed to rebase worktree onto master before squashing. Conflicts must be resolved first.');

      expect(getCommands()).toContain('git rebase --abort');
    });

    it('should not abort a pre-existing rebase when its own rebase is blocked by it', async () => {
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git rev-parse master':
            return { stdout: 'aaa111\n', stderr: '' };
          case 'git rev-parse HEAD':
            return { stdout: 'bbb222\n', stderr: '' };
          case 'git status --porcelain=v1 -z':
            return { stdout: '', stderr: '' };
          case 'git status --porcelain=v1':
            return { stdout: '', stderr: '' };
          case 'git rev-parse --git-path rebase-merge':
            return { stdout: `${rebaseMergeDir}\n`, stderr: '' };
          case `test -e "${rebaseMergeDir}"`:
            throw new Error('No such file or directory');
          case 'git rev-parse --git-path rebase-apply':
            return { stdout: '/test/worktree/.git/rebase-apply\n', stderr: '' };
          case 'test -e "/test/worktree/.git/rebase-apply"':
            throw new Error('No such file or directory');
          case 'git branch --show-current':
            return { stdout: 'task-branch\n', stderr: '' };
          case 'git log --oneline master..HEAD':
            return { stdout: 'abc123 some commit\n', stderr: '' };
          case 'git rebase master':
            throw Object.assign(new Error('Command failed: git rebase master'), {
              stderr: 'fatal: It seems that there is already a rebase-merge directory, and\nI wonder if you are in the middle of another rebase.',
              stdout: '',
            });
          case 'git merge --abort':
            return { stdout: '', stderr: '' };
          case 'git reset --hard aaa111':
            return { stdout: '', stderr: '' };
          case 'git stash list':
            return { stdout: '', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });

      await expect(
        worktreeManager.mergeWorktreeToMainWithUncommitted(projectPath, 'task-123', worktreePath, true, 'test commit message', 'master'),
      ).rejects.toThrow('Failed to rebase worktree onto master before squashing. Conflicts must be resolved first.');

      expect(getCommands()).not.toContain('git rebase --abort');
    });

    it('should complete a squash merge when no rebase is in progress', async () => {
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git rev-parse master':
            return { stdout: 'aaa111\n', stderr: '' };
          case 'git rev-parse HEAD':
            return { stdout: 'ccc333\n', stderr: '' };
          case 'git status --porcelain=v1 -z':
            return { stdout: '', stderr: '' };
          case 'git status --porcelain=v1':
            return { stdout: '', stderr: '' };
          case 'git rev-parse --git-path rebase-merge':
            return { stdout: `${rebaseMergeDir}\n`, stderr: '' };
          case `test -e "${rebaseMergeDir}"`:
            throw new Error('No such file or directory');
          case 'git rev-parse --git-path rebase-apply':
            return { stdout: '/test/worktree/.git/rebase-apply\n', stderr: '' };
          case 'test -e "/test/worktree/.git/rebase-apply"':
            throw new Error('No such file or directory');
          case 'git branch --show-current':
            return { stdout: 'task-branch\n', stderr: '' };
          case 'git log --oneline master..HEAD':
            return { stdout: 'abc123 some commit\n', stderr: '' };
          case 'git rebase master':
            return { stdout: '', stderr: '' };
          case 'git checkout master':
            return { stdout: '', stderr: '' };
          case 'git merge --squash ccc333':
            return { stdout: '', stderr: '' };
          case 'git diff --cached --quiet':
            throw new Error('staged changes present');
          case 'git commit -m "test commit message"':
            return { stdout: '', stderr: '' };
          case 'git stash list':
            return { stdout: '', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });

      const result = await worktreeManager.mergeWorktreeToMainWithUncommitted(projectPath, 'task-123', worktreePath, true, 'test commit message', 'master');

      expect(result.beforeMergeCommitHash).toBe('aaa111');
      expect(result.worktreeBranchCommitHash).toBe('ccc333');
      expect(result.targetBranch).toBe('master');
      expect(result.mainOriginalStashId).toBeUndefined();
    });
  });

  describe('rebaseMainIntoWorktree - in-progress rebase guard', () => {
    it('should not start a rebase when one is already in progress', async () => {
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git status --porcelain=v1':
            return { stdout: '', stderr: '' };
          case 'git rev-parse --git-path rebase-merge':
            return { stdout: `${rebaseMergeDir}\n`, stderr: '' };
          case `test -e "${rebaseMergeDir}"`:
            return { stdout: '', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });

      const result = await worktreeManager.rebaseMainIntoWorktree(worktreePath, 'master');

      expect(result.success).toBe(false);
      expect(result.hasTempCommit).toBe(false);
      expect(result.error?.message).toBe('A rebase is already in progress in the worktree. Continue or abort the rebase first.');
      expect(getCommands()).not.toContain('git rebase master');
      expect(getCommands()).not.toContain('git add -A');
    });
  });

  describe('applyStash - untracked file collision', () => {
    const stashId = 'main-task-123-merge-123';

    it('should remove an identical untracked file left by a partial apply and retry the apply', async () => {
      let applyCount = 0;
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git stash list':
            return { stdout: `stash@{0}: WIP on master: 123456 ${stashId}\n`, stderr: '' };
          case 'git stash apply stash@{0}':
            applyCount++;
            if (applyCount === 1) {
              throw createCollisionError();
            }
            return { stdout: '', stderr: '' };
          case 'git ls-tree -r --name-only stash@{0}^3':
            return { stdout: 'file.cs\n', stderr: '' };
          case 'git ls-files --error-unmatch "file.cs"':
            throw new Error("error: pathspec 'file.cs' did not match any file(s) known to git");
          case 'git hash-object "file.cs"':
            return { stdout: 'hash123\n', stderr: '' };
          case 'git rev-parse "stash@{0}^3:file.cs"':
            return { stdout: 'hash123\n', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });
      (existsSync as Mock).mockReturnValue(true);

      await expect(worktreeManager.applyStash(projectPath, stashId)).resolves.toBeUndefined();

      expect(applyCount).toBe(2);
      expect(rm).toHaveBeenCalledWith(join(projectPath, 'file.cs'), { force: true });
    });

    it('should not remove a file with different content and report a clear error', async () => {
      let applyCount = 0;
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git stash list':
            return { stdout: `stash@{0}: WIP on master: 123456 ${stashId}\n`, stderr: '' };
          case 'git stash apply stash@{0}':
            applyCount++;
            throw createCollisionError();
          case 'git ls-tree -r --name-only stash@{0}^3':
            return { stdout: 'file.cs\n', stderr: '' };
          case 'git ls-files --error-unmatch "file.cs"':
            throw new Error("error: pathspec 'file.cs' did not match any file(s) known to git");
          case 'git hash-object "file.cs"':
            return { stdout: 'hashOnDisk\n', stderr: '' };
          case 'git rev-parse "stash@{0}^3:file.cs"':
            return { stdout: 'hashInStash\n', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });
      (existsSync as Mock).mockReturnValue(true);

      await expect(worktreeManager.applyStash(projectPath, stashId)).rejects.toThrow('a different file already exists at that path');

      expect(applyCount).toBe(1);
      expect(rm).not.toHaveBeenCalled();
    });

    it('should not remove tracked files even when they block the untracked restore', async () => {
      let applyCount = 0;
      (execWithShellPath as Mock).mockImplementation(async (command: string) => {
        switch (command) {
          case 'git stash list':
            return { stdout: `stash@{0}: WIP on master: 123456 ${stashId}\n`, stderr: '' };
          case 'git stash apply stash@{0}':
            applyCount++;
            throw createCollisionError();
          case 'git ls-tree -r --name-only stash@{0}^3':
            return { stdout: 'file.cs\n', stderr: '' };
          case 'git ls-files --error-unmatch "file.cs"':
            return { stdout: 'file.cs\n', stderr: '' };
          default:
            throw new Error(`Unexpected command: ${command}`);
        }
      });
      (existsSync as Mock).mockReturnValue(true);

      await expect(worktreeManager.applyStash(projectPath, stashId)).rejects.toThrow('Failed to apply stash');

      expect(applyCount).toBe(2);
      expect(rm).not.toHaveBeenCalled();
    });
  });
});

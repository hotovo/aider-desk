/**
 * Tests for task-scoped git actions in Task class
 * Verifies delegation to GitManager with the correct repo path
 * (project baseDir for local tasks, worktree path for worktree tasks)
 * and error reporting via reportGitActionError.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    stat: vi.fn().mockRejectedValue(new Error('File not found')),
    readdir: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockResolvedValue(undefined),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  stat: vi.fn().mockRejectedValue(new Error('File not found')),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
  filterIgnoredFiles: vi.fn().mockResolvedValue([]),
  isDirectory: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/constants', () => ({
  PROBE_BINARY_PATH: '/probe',
  AIDER_DESK_TASKS_DIR: '.aider-desk/tasks',
  AIDER_DESK_DIR: '.aider-desk',
  AIDER_DESK_TODOS_FILE: 'todos.json',
  AIDER_DESK_RULES_DIR: 'rules',
  AIDER_DESK_PROJECT_RULES_DIR: '.aider-desk/rules',
  AIDER_DESK_GLOBAL_RULES_DIR: '/home/.aider-desk/rules',
  AIDER_DESK_COMMANDS_DIR: '.aider-desk/commands',
  AIDER_DESK_PROMPTS_DIR: '.aider-desk/prompts',
  AIDER_DESK_BUILTIN_PROMPTS_DIR: '/resources/prompts',
  AIDER_DESK_GLOBAL_PROMPTS_DIR: '/home/.aider-desk/prompts',
  AIDER_DESK_AGENTS_DIR: '.aider-desk/agents',
  AIDER_DESK_TMP_DIR: '.aider-desk/tmp',
  AIDER_DESK_WATCH_FILES_LOCK: '.aider-desk/watch-files.lock',
  WORKTREE_BRANCH_PREFIX: 'aider-desk/task/',
  AIDER_DESK_MEMORY_FILE: '/data/memory.db',
  LOGS_DIR: '/logs',
}));

vi.mock('@/agent', () => ({
  Agent: class {
    run = vi.fn();
    dispose = vi.fn();
  },
  McpManager: class {},
  AgentProfileManager: class {},
}));

vi.mock('@/task/aider-manager', () => ({
  AiderManager: class {
    start = vi.fn();
    stop = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@/prompts', () => ({
  PromptsManager: class {},
}));

vi.mock('@/data-manager', () => ({
  DataManager: class {},
}));

vi.mock('@/telemetry', () => ({
  TelemetryManager: class {},
}));

vi.mock('@/models', () => ({
  ModelManager: class {},
}));

vi.mock('@/events', () => ({
  EventManager: class {
    sendTaskUpdated = vi.fn();
    sendTaskCreated = vi.fn();
    sendTaskDeleted = vi.fn();
  },
}));

vi.mock('@/memory/memory-manager', () => ({
  MemoryManager: class {},
}));

vi.mock('@/git', () => ({
  GitManager: class {},
  GitError: class GitError extends Error {},
}));

vi.mock('@/custom-commands', () => ({
  CustomCommandManager: class {},
}));

vi.mock('@/store', () => ({
  Store: class {},
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { Task } from '../task';

describe('Task - git actions', () => {
  const baseDir = '/test/project';
  const worktreePath = '/test/worktrees/task-1';
  const worktreeBranch = 'aider-desk/task/worktree-branch';

  let task: Task;
  let mockProject: any;
  let mockGitManager: any;
  let mockEventManager: any;

  const createTask = (workingMode?: 'local' | 'worktree', worktreeOverrides?: Record<string, unknown>) =>
    new Task(
      mockProject,
      'test-task-id',
      { getSettings: vi.fn(() => ({ language: 'en', aider: { autoCommits: true }, taskSettings: {} })) } as any,
      {} as any,
      {} as any,
      {} as any,
      { getProfile: vi.fn(() => null) } as any,
      {} as any,
      {} as any,
      mockEventManager as any,
      {} as any,
      mockGitManager,
      {} as any,
      {} as any,
      { isInitialized: vi.fn(() => false) } as any,
      {} as any,
      workingMode === 'worktree'
        ? {
            workingMode: 'worktree',
            worktree: { path: worktreePath, branch: worktreeBranch, ...worktreeOverrides },
          }
        : undefined,
    );

  beforeEach(() => {
    vi.clearAllMocks();

    mockProject = {
      baseDir,
      getProjectSettings: vi.fn(() => ({
        mainModel: 'default-model',
        agentProfileId: 'default-profile',
        modelEditFormats: {},
        currentMode: 'agent',
        autonomyModeLocked: false,
      })),
    };

    mockEventManager = {
      sendTaskUpdated: vi.fn(),
      sendTaskCreated: vi.fn(),
      sendTaskDeleted: vi.fn(),
      sendWorktreeIntegrationStatusUpdated: vi.fn(),
      sendUpdatedFilesUpdated: vi.fn(),
    };

    mockGitManager = {
      listBranches: vi.fn().mockResolvedValue([]),
      getSyncCommits: vi.fn().mockResolvedValue({ behindCount: 1, aheadCount: 2 }),
      createBranch: vi.fn().mockResolvedValue(undefined),
      checkoutBranch: vi.fn().mockResolvedValue(undefined),
      deleteBranch: vi.fn().mockResolvedValue(undefined),
      mergeIntoCurrent: vi.fn().mockResolvedValue({ output: 'merged' }),
      rebaseOnto: vi.fn().mockResolvedValue({ output: 'rebased' }),
      updateBranch: vi.fn().mockResolvedValue({ output: 'updated' }),
      gitPull: vi.fn().mockResolvedValue({ output: 'pulled' }),
      gitPush: vi.fn().mockResolvedValue({ output: 'pushed' }),
      renameBranch: vi.fn().mockResolvedValue('renamed-branch'),
    };

    task = createTask();
  });

  describe('listGitBranches', () => {
    it('uses project baseDir for local task', async () => {
      await task.listGitBranches(true);
      expect(mockGitManager.listBranches).toHaveBeenCalledWith(baseDir, true);
    });

    it('uses worktree path for worktree task', async () => {
      const worktreeTask = createTask('worktree');
      await worktreeTask.listGitBranches(false);
      expect(mockGitManager.listBranches).toHaveBeenCalledWith(worktreePath, false);
    });
  });

  describe('getSyncCommits', () => {
    it('delegates to gitManager with task repo path', async () => {
      const result = await task.getSyncCommits('main');
      expect(mockGitManager.getSyncCommits).toHaveBeenCalledWith(baseDir, 'main');
      expect(result).toEqual({ behindCount: 1, aheadCount: 2 });
    });
  });

  describe('branch actions', () => {
    it('createGitBranch delegates with task repo path', async () => {
      await task.createGitBranch('feature', 'main', true);
      expect(mockGitManager.createBranch).toHaveBeenCalledWith(baseDir, 'feature', 'main', true);
    });

    it('checkoutGitBranch delegates with task repo path', async () => {
      await task.checkoutGitBranch('feature', true, false);
      expect(mockGitManager.checkoutBranch).toHaveBeenCalledWith(baseDir, 'feature', true, false);
    });

    it('mergeIntoCurrentBranch delegates with task repo path', async () => {
      await task.mergeIntoCurrentBranch('feature');
      expect(mockGitManager.mergeIntoCurrent).toHaveBeenCalledWith(baseDir, 'feature');
    });

    it('rebaseOntoBranch delegates with task repo path', async () => {
      await task.rebaseOntoBranch('feature');
      expect(mockGitManager.rebaseOnto).toHaveBeenCalledWith(baseDir, 'feature');
    });

    it('updateGitBranch delegates with task repo path', async () => {
      await task.updateGitBranch('feature');
      expect(mockGitManager.updateBranch).toHaveBeenCalledWith(baseDir, 'feature');
    });

    it('gitPull delegates with task repo path and rebase flag', async () => {
      await task.gitPull(true);
      expect(mockGitManager.gitPull).toHaveBeenCalledWith(baseDir, true);
    });

    it('gitPush delegates with task repo path and force flag', async () => {
      await task.gitPush(true);
      expect(mockGitManager.gitPush).toHaveBeenCalledWith(baseDir, true, undefined);
    });

    it('gitPush delegates with setUpstream flag', async () => {
      await task.gitPush(false, true);
      expect(mockGitManager.gitPush).toHaveBeenCalledWith(baseDir, false, true);
    });

    it('deleteGitBranch delegates with task repo path and force flag', async () => {
      await task.deleteGitBranch('feature', true);
      expect(mockGitManager.deleteBranch).toHaveBeenCalledWith(baseDir, 'feature', true);
    });
  });

  describe('worktree status refresh', () => {
    it('sends worktree integration status update after a git action', async () => {
      await task.gitPush(true);

      await vi.waitFor(() => {
        expect(mockEventManager.sendWorktreeIntegrationStatusUpdated).toHaveBeenCalledWith(baseDir, 'test-task-id', null);
      });
    });

    it('sends worktree integration status update when the git action fails', async () => {
      mockGitManager.gitPush.mockRejectedValue(new Error('push failed'));
      vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.gitPush(false)).rejects.toThrow('push failed');

      await vi.waitFor(() => {
        expect(mockEventManager.sendWorktreeIntegrationStatusUpdated).toHaveBeenCalledWith(baseDir, 'test-task-id', null);
      });
    });
  });

  describe('checkoutGitBranch takeOver guard', () => {
    it('delegates takeOver checkout for local task', async () => {
      await task.checkoutGitBranch('feature', false, true);
      expect(mockGitManager.checkoutBranch).toHaveBeenCalledWith(baseDir, 'feature', false, true);
    });

    it('rejects takeOver checkout for worktree task', async () => {
      const worktreeTask = createTask('worktree');

      await expect(worktreeTask.checkoutGitBranch('feature', false, true)).rejects.toThrow('not available in worktree mode');
      expect(mockGitManager.checkoutBranch).not.toHaveBeenCalled();
    });
  });

  describe('getWorktreeIntegrationStatus', () => {
    beforeEach(() => {
      mockGitManager.checkWorktreeForUnmergedWork = vi.fn().mockResolvedValue({ unmergedCommitCount: 0, unmergedCommits: [], uncommittedFiles: [] });
      mockGitManager.checkForRebaseConflicts = vi.fn().mockResolvedValue(null);
      mockGitManager.getRebaseState = vi.fn().mockResolvedValue(undefined);
    });

    it('uses the stored worktree baseBranch as target branch', async () => {
      mockGitManager.getProjectMainBranch = vi.fn();
      const worktreeTask = createTask('worktree', { baseBranch: 'main' });

      const status = await worktreeTask.getWorktreeIntegrationStatus();

      expect(mockGitManager.getProjectMainBranch).not.toHaveBeenCalled();
      expect(mockGitManager.checkWorktreeForUnmergedWork).toHaveBeenCalledWith(baseDir, worktreePath, 'main', []);
      expect(status?.targetBranch).toBe('main');
      expect(status?.baseBranch).toBe('main');
    });

    it('falls back to the project main branch when baseBranch is missing', async () => {
      mockGitManager.getProjectMainBranch = vi.fn().mockResolvedValue('main');
      const worktreeTask = createTask('worktree');

      const status = await worktreeTask.getWorktreeIntegrationStatus();

      expect(mockGitManager.getProjectMainBranch).toHaveBeenCalledWith(baseDir);
      expect(status?.targetBranch).toBe('main');
    });

    it('returns null when no target branch can be determined', async () => {
      mockGitManager.getProjectMainBranch = vi.fn().mockRejectedValue(new Error('detached HEAD'));
      const worktreeTask = createTask('worktree');

      const status = await worktreeTask.getWorktreeIntegrationStatus();

      expect(status).toBeNull();
      expect(mockGitManager.checkWorktreeForUnmergedWork).not.toHaveBeenCalled();
    });

    it('prefers the explicitly provided target branch', async () => {
      mockGitManager.getProjectMainBranch = vi.fn();
      const worktreeTask = createTask('worktree', { baseBranch: 'main' });

      const status = await worktreeTask.getWorktreeIntegrationStatus('develop');

      expect(mockGitManager.getProjectMainBranch).not.toHaveBeenCalled();
      expect(status?.targetBranch).toBe('develop');
    });
  });

  describe('crash-proof event senders', () => {
    it('sendUpdatedFilesUpdated resolves instead of rejecting when the main branch cannot be determined', async () => {
      mockGitManager.getProjectMainBranch = vi.fn().mockRejectedValue(new Error('detached HEAD'));
      const worktreeTask = createTask('worktree');

      await expect(worktreeTask.sendUpdatedFilesUpdated()).resolves.toBeUndefined();
      expect(mockEventManager.sendUpdatedFilesUpdated).not.toHaveBeenCalled();
    });
  });

  describe('error reporting', () => {
    it('reports action error to task and rethrows', async () => {
      const error = new Error('pull failed');
      mockGitManager.gitPull.mockRejectedValue(error);
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.gitPull(false)).rejects.toThrow('pull failed');
      expect(reportSpy).toHaveBeenCalledWith('pull', error);
    });

    it('skips reporting when branch is not fully merged and force is not set', async () => {
      mockGitManager.deleteBranch.mockRejectedValue(new Error('error: the branch feature is not fully merged'));
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.deleteGitBranch('feature', false)).rejects.toThrow('not fully merged');
      expect(reportSpy).not.toHaveBeenCalled();
    });

    it('reports when force-deleting a branch fails', async () => {
      const error = new Error('some other failure');
      mockGitManager.deleteBranch.mockRejectedValue(error);
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.deleteGitBranch('feature', true)).rejects.toThrow('some other failure');
      expect(reportSpy).toHaveBeenCalledWith('delete branch', error);
    });

    it('skips reporting for push rejected due to remote changes', async () => {
      mockGitManager.gitPush.mockRejectedValue(new Error('! [rejected] main -> main (fetch first)'));
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.gitPush(false)).rejects.toThrow('fetch first');
      expect(reportSpy).not.toHaveBeenCalled();
    });

    it('reports when push fails with other error', async () => {
      const error = new Error('authentication failed');
      mockGitManager.gitPush.mockRejectedValue(error);
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.gitPush(false)).rejects.toThrow('authentication failed');
      expect(reportSpy).toHaveBeenCalledWith('push', error);
    });

    it('does not report errors for plain listing operations', async () => {
      mockGitManager.listBranches.mockRejectedValue(new Error('not a repository'));
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.listGitBranches(false)).rejects.toThrow('not a repository');
      expect(reportSpy).not.toHaveBeenCalled();
    });
  });

  describe('renameGitBranch', () => {
    it('renames the current branch of the project repo', async () => {
      mockGitManager.listBranches.mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false }]);
      vi.spyOn(task, 'sendUpdatedFilesUpdated').mockResolvedValue(undefined);

      await task.renameGitBranch('renamed-branch');

      expect(mockGitManager.renameBranch).toHaveBeenCalledWith(baseDir, 'main', 'renamed-branch');
    });

    it('reports error and rethrows when renaming fails', async () => {
      mockGitManager.listBranches.mockResolvedValue([{ name: 'main', isCurrent: true, hasWorktree: false }]);
      const error = new Error('rename failed');
      mockGitManager.renameBranch.mockRejectedValue(error);
      const reportSpy = vi.spyOn(task, 'reportGitActionError').mockImplementation(() => undefined);

      await expect(task.renameGitBranch('renamed-branch')).rejects.toThrow('rename failed');
      expect(reportSpy).toHaveBeenCalledWith('rename branch', error);
    });
  });
});

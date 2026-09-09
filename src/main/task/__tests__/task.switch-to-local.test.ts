/**
 * Tests for Task.switchToLocalWorkingMode with mergeBeforeSwitch
 * Verifies that uncommitted changes left in the worktree by a checkoutless
 * merge are carried over to the project directory before the worktree is
 * removed, and that the switch aborts (worktree preserved) when the carry-over fails.
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

describe('Task - switchToLocalWorkingMode with merge', () => {
  const baseDir = '/test/project';
  const worktreePath = '/test/worktrees/task-1';
  const worktreeBranch = 'aider-desk/task/worktree-branch';

  let mockProject: any;
  let mockGitManager: any;

  const createWorktreeTask = () =>
    new Task(
      mockProject,
      'test-task-id',
      { getSettings: vi.fn(() => ({ language: 'en', taskSettings: { worktreeSymlinkFolders: ['node_modules'] } })) } as any,
      {} as any,
      {} as any,
      {} as any,
      { getProfile: vi.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockGitManager,
      {} as any,
      {} as any,
      { isInitialized: vi.fn(() => false) } as any,
      {} as any,
      {
        workingMode: 'worktree',
        name: 'Test task',
        worktree: { path: worktreePath, branch: worktreeBranch, baseBranch: 'feature/target' },
      },
    );

  const mergeState = (checkoutless: boolean) => ({
    beforeMergeCommitHash: 'aaaa',
    worktreeBranchCommitHash: 'bbbb',
    targetBranch: 'feature/target',
    checkoutless,
    timestamp: 1,
  });

  const prepareTask = (state: ReturnType<typeof mergeState>) => {
    const t = createWorktreeTask();

    vi.spyOn(t as any, 'waitForCurrentPromptToFinish').mockResolvedValue(undefined);
    vi.spyOn(t as any, 'addLogMessage').mockImplementation(() => undefined);
    vi.spyOn(t as any, 'saveTask').mockResolvedValue(undefined as any);
    const updateTaskSpy = vi.spyOn(t as any, 'updateTask').mockResolvedValue(undefined as any);
    const updateAutocompletionSpy = vi.spyOn(t as any, 'updateAutocompletionData').mockResolvedValue(undefined);
    vi.spyOn(t as any, 'sendUpdatedFilesUpdated').mockResolvedValue(undefined);
    vi.spyOn(t as any, 'sendWorktreeIntegrationStatusUpdated').mockResolvedValue(undefined);

    mockGitManager.getRebaseState.mockResolvedValue({ inProgress: false });
    mockGitManager.mergeWorktreeToMainWithUncommitted.mockResolvedValue(state);

    return { t, updateTaskSpy, updateAutocompletionSpy };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockProject = {
      baseDir,
    };

    mockGitManager = {
      getRebaseState: vi.fn(),
      getProjectMainBranch: vi.fn().mockResolvedValue('main'),
      mergeWorktreeToMainWithUncommitted: vi.fn(),
      applyUncommittedChangesToMain: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('carries over uncommitted changes to the project directory after a checkoutless merge', async () => {
    const { t, updateTaskSpy, updateAutocompletionSpy } = prepareTask(mergeState(true));

    await t.switchToLocalWorkingMode({ mergeBeforeSwitch: true, targetBranch: 'feature/target' });

    expect(mockGitManager.mergeWorktreeToMainWithUncommitted).toHaveBeenCalledWith(
      baseDir,
      'test-task-id',
      worktreePath,
      false,
      'Test task',
      'feature/target',
      ['node_modules'],
    );
    expect(mockGitManager.applyUncommittedChangesToMain).toHaveBeenCalledWith(baseDir, 'test-task-id', worktreePath, ['node_modules']);

    const applyOrder = mockGitManager.applyUncommittedChangesToMain.mock.invocationCallOrder[0];
    const updateOrder = updateTaskSpy.mock.invocationCallOrder[0];
    expect(applyOrder).toBeLessThan(updateOrder);

    expect(updateTaskSpy).toHaveBeenCalledWith({ workingMode: 'local' });
    expect(updateAutocompletionSpy).toHaveBeenCalledWith(undefined, true);
  });

  it('does not carry over changes when the merge was not checkoutless', async () => {
    const { t, updateTaskSpy } = prepareTask(mergeState(false));

    await t.switchToLocalWorkingMode({ mergeBeforeSwitch: true, targetBranch: 'feature/target' });

    expect(mockGitManager.applyUncommittedChangesToMain).not.toHaveBeenCalled();
    expect(updateTaskSpy).toHaveBeenCalledWith({ workingMode: 'local' });
  });

  it('aborts the switch without removing the worktree when the carry-over fails', async () => {
    const { t, updateTaskSpy, updateAutocompletionSpy } = prepareTask(mergeState(true));
    mockGitManager.applyUncommittedChangesToMain.mockRejectedValue(new Error('conflict while applying'));

    await expect(t.switchToLocalWorkingMode({ mergeBeforeSwitch: true, targetBranch: 'feature/target' })).rejects.toThrow('conflict while applying');

    expect(updateTaskSpy).not.toHaveBeenCalled();
    expect(updateAutocompletionSpy).not.toHaveBeenCalled();
  });
});

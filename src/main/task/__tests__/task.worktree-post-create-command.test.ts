/**
 * Tests for Task.initWorktree post-create command execution.
 * Verifies that the user-defined worktreePostCreateCommand is executed in the
 * new worktree directory with AiderDesk environment variables, that failures
 * do not abort worktree creation, and that nothing runs when unset.
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

const execWithShellPathMock = vi.fn();

vi.mock('@/utils', () => ({
  execWithShellPath: (...args: unknown[]) => execWithShellPathMock(...args),
  getEnvironmentVariablesForAider: vi.fn().mockReturnValue({}),
  isDirectory: vi.fn().mockResolvedValue(false),
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

const dispatchEvent = vi.fn().mockResolvedValue(undefined);

describe('Task - initWorktree post-create command', () => {
  const baseDir = '/test/project';
  const worktreePath = '/test/project/.aider-desk/tasks/test-task-id/worktree';
  const worktreeBranch = 'aider-desk/task/test-task';

  let mockProject: any;
  let mockGitManager: any;
  let addLogMessageSpy: any;

  const createTask = (taskSettings: Record<string, unknown>) =>
    new Task(
      mockProject,
      'test-task-id',
      { getSettings: vi.fn(() => ({ language: 'en', taskSettings })) } as any,
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
      { isInitialized: vi.fn(() => false), dispatchEvent } as any,
      {} as any,
      {
        workingMode: 'local',
        name: 'Test task',
      },
    );

  const prepareTask = (taskSettings: Record<string, unknown>) => {
    const t = createTask(taskSettings);

    vi.spyOn(t as any, 'generateBranchName').mockReturnValue(worktreeBranch);
    addLogMessageSpy = vi.spyOn(t as any, 'addLogMessage').mockImplementation(() => undefined);

    return t;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    execWithShellPathMock.mockReset();

    mockProject = {
      baseDir,
      id: 'project-id',
      name: 'Test Project',
    };

    mockGitManager = {
      createWorktree: vi.fn().mockResolvedValue({
        path: worktreePath,
        branch: worktreeBranch,
        baseCommit: 'aaaa',
        baseBranch: 'main',
      }),
      createSymlinks: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('runs the configured post-create command in the worktree with environment variables', async () => {
    execWithShellPathMock.mockResolvedValue({ stdout: 'submodule initialized', stderr: '' });
    const t = prepareTask({ worktreePostCreateCommand: 'git submodule update --init --recursive' });

    await (t as any).initWorktree();

    expect(mockGitManager.createWorktree).toHaveBeenCalledWith(baseDir, 'test-task-id', worktreeBranch, undefined);
    expect(execWithShellPathMock).toHaveBeenCalledWith('git submodule update --init --recursive', {
      cwd: worktreePath,
      env: {
        AIDERDESK_PROJECT_PATH: baseDir,
        AIDERDESK_WORKTREE_PATH: worktreePath,
        AIDERDESK_TASK_ID: 'test-task-id',
        AIDERDESK_BRANCH: worktreeBranch,
      },
    });
    expect(addLogMessageSpy).toHaveBeenCalledWith('loading', 'Running worktree post-create command...');
    expect(addLogMessageSpy).toHaveBeenCalledWith('info', 'Worktree post-create command output:\nsubmodule initialized');
    expect(addLogMessageSpy).toHaveBeenCalledWith('loading', 'Worktree post-create command completed.', true);
  });

  it('does not abort worktree creation when the command fails', async () => {
    execWithShellPathMock.mockRejectedValue(Object.assign(new Error('datalad not found'), { stdout: '', stderr: 'command not found' }));
    const t = prepareTask({ worktreePostCreateCommand: 'datalad get .' });

    await expect((t as any).initWorktree()).resolves.not.toThrow();

    expect(mockGitManager.createWorktree).toHaveBeenCalled();
    expect(addLogMessageSpy).toHaveBeenCalledWith('warning', 'Worktree post-create command output:\ncommand not found');
    expect(addLogMessageSpy).toHaveBeenCalledWith('error', 'Worktree post-create command failed: datalad not found');
  });

  it('passes the selected base branch when switching without carrying over local changes', async () => {
    const t = prepareTask({});
    Object.assign(t, {
      waitForCurrentPromptToFinish: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      sendUpdatedFilesUpdated: vi.fn().mockResolvedValue(undefined),
      updateAutocompletionData: vi.fn().mockResolvedValue(undefined),
    });
    mockGitManager.getTaskWorktree = vi.fn().mockResolvedValue(null);
    mockGitManager.stashUncommittedChanges = vi.fn();

    await t.switchToWorktreeWorkingMode({ baseBranch: 'develop' });

    expect(mockGitManager.createWorktree).toHaveBeenCalledWith(baseDir, 'test-task-id', worktreeBranch, 'develop');
    expect(mockGitManager.stashUncommittedChanges).not.toHaveBeenCalled();
    expect(t.updateTask).toHaveBeenCalledWith({ workingMode: 'worktree' });
  });

  it('does not execute anything when no command is configured', async () => {
    const t = prepareTask({});

    await (t as any).initWorktree();

    expect(execWithShellPathMock).not.toHaveBeenCalled();
  });

  it('dispatches creation after symlinks and the legacy command finish', async () => {
    const order: string[] = [];
    mockGitManager.createSymlinks.mockImplementation(async () => {
      order.push('symlinks');
    });
    execWithShellPathMock.mockImplementation(async () => {
      order.push('command');
      return { stdout: '', stderr: '' };
    });
    dispatchEvent.mockImplementationOnce(async () => {
      order.push('hook');
    });
    const t = prepareTask({ worktreeSymlinkFolders: ['node_modules'], worktreePostCreateCommand: 'npm install' });

    await (t as unknown as { initWorktree(): Promise<void> }).initWorktree();

    expect(order).toEqual(['symlinks', 'command', 'hook']);
    expect(dispatchEvent).toHaveBeenCalledWith(
      'onWorktreeCreated',
      {
        task: t.task,
        worktree: t.task.worktree,
      },
      mockProject,
      t,
    );
  });

  it('does not dispatch creation when reusing a worktree', async () => {
    const t = prepareTask({});
    Object.assign(t, {
      waitForCurrentPromptToFinish: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      sendUpdatedFilesUpdated: vi.fn().mockResolvedValue(undefined),
      updateAutocompletionData: vi.fn().mockResolvedValue(undefined),
    });
    mockGitManager.getTaskWorktree = vi.fn().mockResolvedValue({ path: worktreePath });

    await t.switchToWorktreeWorkingMode();

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not dispatch creation if creating the worktree fails', async () => {
    const t = prepareTask({});
    mockGitManager.createWorktree.mockRejectedValueOnce(new Error('creation failed'));

    await expect((t as unknown as { initWorktree(): Promise<void> }).initWorktree()).rejects.toThrow('creation failed');

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  const prepareMergeTask = () => {
    const t = prepareTask({});
    t.task.worktree = { path: worktreePath, branch: worktreeBranch, baseBranch: 'main' };
    Object.assign(t, {
      waitForCurrentPromptToFinish: vi.fn().mockResolvedValue(undefined),
      saveTask: vi.fn().mockResolvedValue(undefined),
      updateTask: vi.fn().mockResolvedValue(undefined),
      updateAutocompletionData: vi.fn().mockResolvedValue(undefined),
      sendUpdatedFilesUpdated: vi.fn().mockResolvedValue(undefined),
      sendTaskGitStatusUpdated: vi.fn().mockResolvedValue(undefined),
    });
    mockGitManager.mergeWorktreeToMainWithUncommitted = vi.fn().mockResolvedValue({ timestamp: 1 });
    mockGitManager.mergeWorktreeToWorktree = vi.fn().mockResolvedValue(undefined);
    mockGitManager.getRebaseState = vi.fn().mockResolvedValue({ inProgress: false });
    return t;
  };

  it.each([false, true])('dispatches after merging to the project (squash: %s)', async (squash) => {
    const t = prepareMergeTask();

    await t.mergeWorktreeToMain(squash, 'develop', 'Test merge');

    expect(dispatchEvent).toHaveBeenCalledWith(
      'onWorktreeMerged',
      {
        task: t.task,
        worktree: t.task.worktree,
        targetPath: baseDir,
        targetBranch: 'develop',
        squash,
        includeUncommitted: true,
      },
      mockProject,
      t,
    );
    expect(mockGitManager.mergeWorktreeToMainWithUncommitted.mock.invocationCallOrder[0]).toBeLessThan(dispatchEvent.mock.invocationCallOrder[0]);
  });

  it('dispatches merge before switching to local mode', async () => {
    const t = prepareMergeTask();

    await t.switchToLocalWorkingMode({ mergeBeforeSwitch: true });

    expect(dispatchEvent).toHaveBeenCalledWith(
      'onWorktreeMerged',
      expect.objectContaining({
        targetPath: baseDir,
        targetBranch: 'main',
        squash: false,
      }),
      mockProject,
      t,
    );
    expect(dispatchEvent.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(t.updateTask).mock.invocationCallOrder[0]);
  });

  it.each([false, true])('dispatches after a worktree-to-worktree merge (uncommitted: %s)', async (includeUncommitted) => {
    const t = prepareMergeTask();

    await t.mergeWorktreeToWorktree('/target', includeUncommitted);

    expect(dispatchEvent).toHaveBeenCalledWith(
      'onWorktreeMerged',
      {
        task: t.task,
        worktree: t.task.worktree,
        targetPath: '/target',
        squash: false,
        includeUncommitted,
      },
      mockProject,
      t,
    );
  });

  it('does not dispatch after a failed merge to the project', async () => {
    const t = prepareMergeTask();
    mockGitManager.mergeWorktreeToMainWithUncommitted.mockRejectedValueOnce(new Error('merge failed'));

    await t.mergeWorktreeToMain(false);

    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('does not dispatch after a failed merge when switching to local mode', async () => {
    const t = prepareMergeTask();
    mockGitManager.mergeWorktreeToMainWithUncommitted.mockRejectedValueOnce(new Error('merge failed'));

    await expect(t.switchToLocalWorkingMode({ mergeBeforeSwitch: true })).rejects.toThrow('merge failed');

    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(t.updateTask).not.toHaveBeenCalled();
  });

  it('does not dispatch after a failed worktree-to-worktree merge', async () => {
    const t = prepareMergeTask();
    mockGitManager.mergeWorktreeToWorktree.mockRejectedValueOnce(new Error('merge failed'));

    await expect(t.mergeWorktreeToWorktree('/target')).rejects.toThrow('merge failed');

    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});

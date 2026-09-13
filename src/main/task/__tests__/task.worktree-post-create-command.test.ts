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
      { isInitialized: vi.fn(() => false) } as any,
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

    expect(mockGitManager.createWorktree).toHaveBeenCalledWith(baseDir, 'test-task-id', worktreeBranch);
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

  it('does not execute anything when no command is configured', async () => {
    const t = prepareTask({});

    await (t as any).initWorktree();

    expect(execWithShellPathMock).not.toHaveBeenCalled();
  });
});

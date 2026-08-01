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
    sendUpdateAiderModels = vi.fn();
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
    sendTaskInitialized = vi.fn();
    sendContextFilesUpdated = vi.fn();
    sendContextInfoUpdated = vi.fn();
  },
}));

vi.mock('@/memory/memory-manager', () => ({
  MemoryManager: class {},
}));

vi.mock('@/worktrees', () => ({
  WorktreeManager: class {},
}));

vi.mock('@/custom-commands', () => ({
  CustomCommandManager: class {},
}));

vi.mock('@/skills/skill-manager', () => ({
  SkillManager: class {
    getSkills = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock('@/store', () => ({
  Store: class {},
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { Task } from '../task';

describe('Task - readonly init', () => {
  let mockWorktreeManager: { getTaskWorktree: ReturnType<typeof vi.fn>; removeWorktree: ReturnType<typeof vi.fn> };
  let mockExtensionManager: { isInitialized: ReturnType<typeof vi.fn>; dispatchEvent: ReturnType<typeof vi.fn> };

  const baseDir = '/test/project';
  const taskId = 'test-task-id';

  const createTask = () => {
    const mockProject = {
      baseDir,
      getProjectSettings: vi.fn(() => ({
        mainModel: 'default-model',
        agentProfileId: 'default-profile',
        modelEditFormats: {},
        currentMode: 'agent',
        autonomyModeLocked: false,
      })),
      isWorktreeSharedWithOtherTasks: vi.fn(() => false),
    };

    const mockStore = {
      getSettings: vi.fn(() => ({
        language: 'en',
        renderMarkdown: true,
        aider: { autoCommits: true, cachingEnabled: true, watchFiles: true },
        promptBehavior: { requireCommandConfirmation: {} },
      })),
    };

    mockWorktreeManager = {
      getTaskWorktree: vi.fn().mockResolvedValue(undefined),
      removeWorktree: vi.fn().mockResolvedValue(undefined),
    };

    mockExtensionManager = {
      isInitialized: vi.fn(() => false),
      dispatchEvent: vi.fn().mockImplementation((_event: string, payload: unknown) => Promise.resolve(payload)),
    };

    const mockEventManager = {
      sendTaskUpdated: vi.fn(),
      sendTaskCreated: vi.fn(),
      sendTaskDeleted: vi.fn(),
      sendTaskInitialized: vi.fn(),
      sendContextFilesUpdated: vi.fn(),
      sendContextInfoUpdated: vi.fn(),
      sendUpdateAutocompletion: vi.fn(),
      sendSkillsUpdated: vi.fn(),
    };

    return new Task(
      mockProject as any,
      taskId,
      mockStore as any,
      {} as any,
      {} as any,
      { getProfile: vi.fn(() => null) } as any,
      {} as any,
      {} as any,
      mockEventManager as any,
      {} as any,
      mockWorktreeManager as any,
      {} as any,
      {} as any,
      mockExtensionManager as any,
      {} as any,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not touch worktrees, connectors, or expensive scans on readonly load', async () => {
    const task = createTask();

    const autocompletionSpy = vi.spyOn(task as any, 'updateAutocompletionData');

    const aiderManager = (task as any).aiderManager;

    const state = await task.load(true);

    expect(state.todoItems).toEqual([]);
    expect(state.messages).toEqual([]);
    expect(mockWorktreeManager.getTaskWorktree).not.toHaveBeenCalled();
    expect(mockWorktreeManager.removeWorktree).not.toHaveBeenCalled();
    expect(aiderManager.start).not.toHaveBeenCalled();
    expect(autocompletionSpy).not.toHaveBeenCalled();
    expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledWith('onTaskInitialized', expect.anything(), expect.anything(), expect.anything());
  });

  it('skips refresh work on repeated readonly loads', async () => {
    const task = createTask();
    await task.load(true);

    const autocompletionSpy = vi.spyOn(task as any, 'updateAutocompletionData');

    await task.load(true);
    await task.init(true);

    expect(autocompletionSpy).not.toHaveBeenCalled();
  });

  it('keeps full refresh behavior on non-readonly init after readonly load', async () => {
    const task = createTask();
    await task.load(true);

    const autocompletionSpy = vi.spyOn(task as any, 'updateAutocompletionData');

    const aiderManager = (task as any).aiderManager;

    await task.init();

    expect(autocompletionSpy).toHaveBeenCalledWith(undefined, true);
    expect(aiderManager.sendUpdateAiderModels).toHaveBeenCalled();
  });
});

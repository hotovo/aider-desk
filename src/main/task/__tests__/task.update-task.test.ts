import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultTaskState } from '@common/types';

import { Task } from '../task';

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

vi.mock('@/git', () => ({
  GitManager: class {},
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

vi.mock('@/utils/atomic-write', () => ({
  atomicWriteJsonFile: vi.fn().mockResolvedValue(undefined),
}));

const OLD_UPDATED_AT = '2026-01-01T00:00:00.000Z';

describe('Task.updateTask timestamps', () => {
  const createTask = (): Task =>
    Object.assign(Object.create(Task.prototype), {
      taskId: 'update-task',
      taskDataPath: '/project/.aider-desk/tasks/update-task/settings.json',
      task: {
        id: 'update-task',
        state: DefaultTaskState.InProgress,
        currentMode: 'agent',
        createdAt: OLD_UPDATED_AT,
        updatedAt: OLD_UPDATED_AT,
      },
      project: { baseDir: '/project' },
      extensionManager: { dispatchEvent: vi.fn().mockResolvedValue({}) },
      eventManager: { sendTaskUpdated: vi.fn() },
      fileWatchGeneration: 0,
      fileWatchHandle: null,
      initialized: true,
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates updatedAt by default', async () => {
    const task = createTask();

    const result = await task.updateTask({ name: 'Renamed' });

    expect(result.name).toBe('Renamed');
    expect(result.updatedAt).not.toBe(OLD_UPDATED_AT);
  });

  it('saves and emits the update without changing updatedAt when updateTimestamps is false', async () => {
    const task = createTask();
    const sendTaskUpdated = (task as unknown as { eventManager: { sendTaskUpdated: ReturnType<typeof vi.fn> } }).eventManager.sendTaskUpdated;

    const result = await task.updateTask({ lastAgentProviderMetadata: { openai: { responseId: 'r1' } } }, false);

    expect(result.updatedAt).toBe(OLD_UPDATED_AT);
    expect(result.lastAgentProviderMetadata).toEqual({ openai: { responseId: 'r1' } });
    expect(sendTaskUpdated).toHaveBeenCalledWith(expect.objectContaining({ updatedAt: OLD_UPDATED_AT }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultTaskState } from '@common/types';

import { Task } from '../task';

import type { WatchHandle } from '@/file-watcher-manager';

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

const pendingWatch = () => {
  let resolve!: (handle: WatchHandle) => void;
  const promise = new Promise<WatchHandle>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('Task file watching lifecycle', () => {
  const watch = vi.fn<() => Promise<WatchHandle>>();

  const createTask = (initialized = false): Task =>
    Object.assign(Object.create(Task.prototype), {
      taskId: 'watch-task',
      task: { state: DefaultTaskState.Todo },
      project: { baseDir: '/project', getFileWatcherManager: () => ({ watch }) },
      extensionManager: { dispatchEvent: vi.fn().mockResolvedValue({}) },
      eventManager: { sendTaskUpdated: vi.fn() },
      fileWatchGeneration: 0,
      fileWatchHandle: null,
      initialized,
      interruptResponse: vi.fn().mockResolvedValue(undefined),
      resolveAgentRunPromises: vi.fn(),
      cleanupChunkBuffers: vi.fn(),
      aiderManager: { kill: vi.fn().mockResolvedValue(undefined) },
    });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([false, true])('releases stale subscriptions across a rapid stop/start (newer resolves first: %s)', async (newerFirst) => {
    const first = pendingWatch();
    const second = pendingWatch();
    watch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const task = createTask();
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    await task.saveTask({ state: DefaultTaskState.Todo }, false);
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);

    const staleHandle = { unwatch: vi.fn() };
    const activeHandle = { unwatch: vi.fn() };
    if (newerFirst) {
      second.resolve(activeHandle);
      await Promise.resolve();
      first.resolve(staleHandle);
    } else {
      first.resolve(staleHandle);
      await Promise.resolve();
      second.resolve(activeHandle);
    }
    await Promise.resolve();
    expect(staleHandle.unwatch).toHaveBeenCalledTimes(1);
    expect(activeHandle.unwatch).not.toHaveBeenCalled();

    await task.saveTask({ state: DefaultTaskState.Todo }, false);
    expect(activeHandle.unwatch).toHaveBeenCalledTimes(1);
  });

  it('releases setup that resolves after the task stops', async () => {
    const pending = pendingWatch();
    watch.mockReturnValueOnce(pending.promise);
    const task = createTask();
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    await task.saveTask({ state: DefaultTaskState.Todo }, false);
    const handle = { unwatch: vi.fn() };
    pending.resolve(handle);
    await Promise.resolve();
    expect(handle.unwatch).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('invalidates pending setup on close (initialized: %s)', async (initialized) => {
    const pending = pendingWatch();
    watch.mockReturnValueOnce(pending.promise);
    const task = createTask(initialized);
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    await task.close(false, false);
    const handle = { unwatch: vi.fn() };
    pending.resolve(handle);
    await Promise.resolve();
    expect(handle.unwatch).toHaveBeenCalledTimes(1);
  });

  it('releases an active subscription on close even before initialization', async () => {
    const handle = { unwatch: vi.fn() };
    watch.mockResolvedValueOnce(handle);
    const task = createTask();
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    await task.close(false, false);
    expect(handle.unwatch).toHaveBeenCalledTimes(1);
  });

  it('does not register again when saving an unchanged running state', async () => {
    watch.mockResolvedValue({ unwatch: vi.fn() });
    const task = createTask();
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    await task.saveTask({ state: DefaultTaskState.InProgress }, false);
    expect(watch).toHaveBeenCalledTimes(1);
  });
});

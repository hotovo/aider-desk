/**
 * Tests for queuing custom commands while a prompt is running.
 * Custom commands invoked while another prompt is executing must be queued
 * instead of running immediately, matching the regular prompt queueing behavior.
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
    isRunning = vi.fn(() => false);
    interrupt = vi.fn();
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
  CustomCommandManager: class {
    getCommand = vi.fn();
    processCommandTemplate = vi.fn();
  },
}));

vi.mock('@/store', () => ({
  Store: class {},
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => `test-uuid-${Math.random()}`),
}));

import { Task } from '../task';

describe('Task - custom commands queued while prompt is running', () => {
  const baseDir = '/test/project';

  let mockProject: any;

  const createTask = () =>
    new Task(
      mockProject,
      'test-task-id',
      { getSettings: vi.fn(() => ({ language: 'en' })) } as any,
      {} as any,
      {} as any,
      {} as any,
      { getProfile: vi.fn(() => null) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { isInitialized: vi.fn(() => false) } as any,
      {} as any,
    );

  const spyInternal = (t: Task): { t: any; sendQueuedPromptsUpdated: any } => {
    vi.spyOn(t as any, 'addLogMessage').mockImplementation(() => undefined);
    vi.spyOn(t as any, 'saveTask').mockResolvedValue(undefined as any);
    const eventManager = (t as any).eventManager;
    eventManager.sendCustomCommandError = vi.fn();
    eventManager.sendUserMessage = vi.fn();
    const sendQueuedPromptsUpdated = vi.fn();
    eventManager.sendQueuedPromptsUpdated = sendQueuedPromptsUpdated;
    return { t, sendQueuedPromptsUpdated };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProject = {
      baseDir,
      addToInputHistory: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('queues the custom command instead of executing it while a prompt is running', async () => {
    const t = createTask();
    const { sendQueuedPromptsUpdated } = spyInternal(t);
    const isPromptRunningSpy = vi.spyOn(t as any, 'isPromptRunning').mockReturnValue(true);
    const runPromptInAiderSpy = vi.spyOn(t as any, 'runPromptInAider').mockResolvedValue([]);
    const runPromptInAgentSpy = vi.spyOn(t as any, 'runPromptInAgent').mockResolvedValue([]);

    await t.runCustomCommand('greet', ['bob'], 'code');

    expect(isPromptRunningSpy).toHaveBeenCalled();
    expect(runPromptInAiderSpy).not.toHaveBeenCalled();
    expect(runPromptInAgentSpy).not.toHaveBeenCalled();

    const queue = sendQueuedPromptsUpdated.mock.calls.at(-1)?.[2];
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      text: '/greet bob',
      mode: 'code',
      customCommand: { name: 'greet', args: ['bob'] },
    });
  });

  it('executes the custom command right away when no prompt is running', async () => {
    const t = createTask();
    spyInternal(t);
    vi.spyOn(t as any, 'isPromptRunning').mockReturnValue(false);

    const command = { name: 'greet', arguments: [] };
    const customCommandManager = (t as any).customCommandManager;
    customCommandManager.getCommand = vi.fn().mockReturnValue(command);
    customCommandManager.processCommandTemplate = vi.fn().mockResolvedValue('processed prompt');
    const extensionManager = (t as any).extensionManager;
    extensionManager.getCommands = vi.fn().mockReturnValue([]);
    extensionManager.dispatchEvent = vi.fn().mockResolvedValue({ blocked: false, mode: 'code' });
    (t as any).telemetryManager.captureCustomCommand = vi.fn();
    const runPromptInAiderSpy = vi.spyOn(t as any, 'runPromptInAider').mockResolvedValue([]);

    await t.runCustomCommand('greet', [], 'code');

    expect(runPromptInAiderSpy).toHaveBeenCalledWith('code', 'processed prompt', expect.objectContaining({ id: expect.any(String) }));
    const queue = vi.mocked((t as any).eventManager.sendQueuedPromptsUpdated).mock.calls;
    expect(queue).toHaveLength(0);
  });

  it('runs the queued custom command from the queue without adding a prompt user message', async () => {
    const t = createTask();
    const { sendQueuedPromptsUpdated } = spyInternal(t);
    (t as any).queuedPrompts = [{ id: 'q1', text: '/greet bob', mode: 'code', timestamp: 1, customCommand: { name: 'greet', args: ['bob'] } }];

    const runCustomCommandSpy = vi.spyOn(t as any, 'runCustomCommand').mockResolvedValue(undefined);
    const addUserMessageSpy = vi.spyOn(t as any, 'addUserMessage').mockImplementation(() => undefined);

    await (t as any).runNextQueuedPrompt();

    expect(runCustomCommandSpy).toHaveBeenCalledWith('greet', ['bob'], 'code');
    expect(addUserMessageSpy).not.toHaveBeenCalled();
    expect(sendQueuedPromptsUpdated).toHaveBeenCalledWith(baseDir, 'test-task-id', []);
  });

  it('interrupts without adding a user message when sending a queued custom command now', async () => {
    const t = createTask();
    spyInternal(t);
    (t as any).queuedPrompts = [{ id: 'q1', text: '/greet bob', mode: 'code', timestamp: 1, customCommand: { name: 'greet', args: ['bob'] } }];

    const addUserMessageSpy = vi.spyOn(t as any, 'addUserMessage').mockImplementation(() => undefined);
    vi.spyOn(t as any, 'findMessageConnectors').mockReturnValue([]);

    await t.sendQueuedPromptNow('q1');

    expect(addUserMessageSpy).not.toHaveBeenCalled();
    expect((t as any).agent.interrupt).toHaveBeenCalled();
    const queue = (t as any).queuedPrompts;
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe('q1');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NOTIFICATION_HOOK_TIMEOUT_MS, Task } from '../task';

import type { NotificationData } from '@common/types';

import logger from '@/logger';

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

// Avoid touching Electron from the notification pipeline under test
vi.mock('@/app', () => ({
  getElectronApp: vi.fn(() => undefined),
}));

describe('Task - notifyIfEnabled', () => {
  const baseDir = '/test/project';
  const taskId = 'test-task-id';

  let mockStore: { getSettings: ReturnType<typeof vi.fn> };
  let mockEventManager: { sendNotificationData: ReturnType<typeof vi.fn> };
  let mockExtensionManager: { isInitialized: ReturnType<typeof vi.fn>; dispatchEvent: ReturnType<typeof vi.fn> };

  // Bound to the instance created by createTask()
  let notifyIfEnabled: (title: string, text: string, kind?: 'task-finished' | 'input-needed' | 'generic') => Promise<void>;

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

    mockEventManager.sendNotificationData = vi.fn();

    const task = new Task(
      mockProject as any,
      taskId,
      mockStore as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockEventManager as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockExtensionManager as any,
      {} as any,
    );

    notifyIfEnabled = (title, text, kind) => (task as any).notifyIfEnabled(title, text, kind);
    return task;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      getSettings: vi.fn(() => ({ notificationsEnabled: true })),
    };
    mockEventManager = { sendNotificationData: vi.fn() };
    mockExtensionManager = {
      isInitialized: vi.fn(() => false),
      dispatchEvent: vi.fn().mockImplementation((_event: string, payload: unknown) => Promise.resolve(payload)),
    };

    createTask();
  });

  it('dispatches the onNotification extension hook and delivers the notification', async () => {
    await notifyIfEnabled('Task finished', 'all done', 'task-finished');

    expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledWith(
      'onNotification',
      expect.objectContaining({ notification: expect.objectContaining({ baseDir, title: 'Task finished', kind: 'task-finished' }) }),
      expect.anything(),
      expect.anything(),
    );
    expect(mockEventManager.sendNotificationData).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir,
        title: 'Task finished',
        body: 'all done',
        kind: 'task-finished',
        id: expect.any(String),
        timestamp: expect.any(Number),
      }),
    );
  });

  it('does not deliver when an extension blocks the notification', async () => {
    mockExtensionManager.dispatchEvent.mockImplementation(() => Promise.resolve({ blocked: true }));

    await notifyIfEnabled('Task finished', 'all done');

    expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();
  });

  it('delivers the extension-modified notification', async () => {
    mockExtensionManager.dispatchEvent.mockImplementation((_event: string, payload: { notification: NotificationData } & { blocked?: boolean }) =>
      Promise.resolve({ ...payload, notification: { ...payload.notification, title: 'Modified title' } }),
    );

    await notifyIfEnabled('Task finished', 'all done');

    expect(mockEventManager.sendNotificationData).toHaveBeenCalledWith(expect.objectContaining({ title: 'Modified title' }));
  });

  it('preserves the original notification when an extension result has notification: undefined and blocked: false', async () => {
    mockExtensionManager.dispatchEvent.mockImplementation(() => Promise.resolve({ notification: undefined, blocked: false }));

    await notifyIfEnabled('Task finished', 'all done');

    // The original id/title payload built by notifyIfEnabled must survive the extension pass
    expect(mockEventManager.sendNotificationData).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir,
        title: 'Task finished',
        body: 'all done',
        id: expect.any(String),
        timestamp: expect.any(Number),
      }),
    );
    const delivered = mockEventManager.sendNotificationData.mock.calls[0][0] as NotificationData;
    expect(delivered.id).toBeTruthy();
  });

  // Extension observation is decoupled from the notificationsEnabled setting: the hook
  // always fires, only the built-in (transport + Electron) delivery is gated by it.
  it('still dispatches the hook when notifications are disabled, but skips core delivery', async () => {
    mockStore.getSettings = vi.fn(() => ({ notificationsEnabled: false }));

    await notifyIfEnabled('Task finished', 'all done', 'task-finished');

    // Sound/relay extensions must be able to observe (or self-deliver) even when the
    // user disabled built-in notifications
    expect(mockExtensionManager.dispatchEvent).toHaveBeenCalledWith(
      'onNotification',
      expect.objectContaining({ notification: expect.objectContaining({ title: 'Task finished', kind: 'task-finished' }) }),
      expect.anything(),
      expect.anything(),
    );
    expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();
  });

  it('does not deliver an extension-modified notification when notifications are disabled', async () => {
    mockStore.getSettings = vi.fn(() => ({ notificationsEnabled: false }));
    mockExtensionManager.dispatchEvent.mockImplementation((_event: string, payload: { notification: NotificationData }) =>
      Promise.resolve({ ...payload, notification: { ...payload.notification, title: 'Modified title' } }),
    );

    await notifyIfEnabled('Task finished', 'all done');

    expect(mockExtensionManager.dispatchEvent).toHaveBeenCalled();
    expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();
  });

  it('preserves original baseDir/body when an extension returns a partial notification', async () => {
    mockExtensionManager.dispatchEvent.mockImplementation(() => Promise.resolve({ notification: { title: 'Only title changed' } }));

    await notifyIfEnabled('Task finished', 'all done', 'task-finished');

    expect(mockEventManager.sendNotificationData).toHaveBeenCalledWith(
      expect.objectContaining({
        baseDir,
        title: 'Only title changed',
        body: 'all done',
        kind: 'task-finished',
        id: expect.any(String),
        timestamp: expect.any(Number),
      }),
    );
    const delivered = mockEventManager.sendNotificationData.mock.calls[0][0] as NotificationData;
    expect(delivered.id).toBeTruthy();
  });

  it('ignores undefined-valued fields in a returned notification instead of clobbering the original', async () => {
    mockExtensionManager.dispatchEvent.mockImplementation(() =>
      Promise.resolve({ notification: { title: 'New title', body: undefined } as unknown as NotificationData }),
    );

    await notifyIfEnabled('Task finished', 'all done');

    const delivered = mockEventManager.sendNotificationData.mock.calls[0][0] as NotificationData;
    expect(delivered.title).toBe('New title');
    expect(delivered.body).toBe('all done');
  });

  describe('per-project delivery ordering', () => {
    it('delivers concurrent notifications for the same project FIFO', async () => {
      let releaseFirst: (() => void) | undefined;
      const firstGate = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      // First notification's hook stalls until released; second must still queue behind it
      mockExtensionManager.dispatchEvent.mockImplementationOnce(() => firstGate.then(() => ({ blocked: false })));

      const first = notifyIfEnabled('first', 'one');
      const second = notifyIfEnabled('second', 'two');

      // Let the queue start the first delivery and stall on its gate
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();

      releaseFirst?.();
      await Promise.all([first, second]);

      const titles = mockEventManager.sendNotificationData.mock.calls.map((call) => (call[0] as NotificationData).title);
      expect(titles).toEqual(['first', 'second']);
    });

    it('a failed delivery does not stall subsequent notifications for the same project', async () => {
      // First delivery fails at the dispatch level; second must still deliver
      mockExtensionManager.dispatchEvent.mockImplementationOnce(() => Promise.reject(new Error('hook blew up')));

      const first = notifyIfEnabled('first', 'one');
      const second = notifyIfEnabled('second', 'two');

      await Promise.all([first, second]);

      const titles = mockEventManager.sendNotificationData.mock.calls.map((call) => (call[0] as NotificationData).title);
      expect(titles).toEqual(['second']);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  // Fire-and-forget call sites use `void this.notifyIfEnabled(...)` — every failure below
  // must resolve (never reject / become an unhandledRejection).
  describe('fire-and-forget safety: errors never reject', () => {
    it('resolves when settings access throws', async () => {
      mockStore.getSettings = vi.fn(() => {
        throw new Error('settings blew up');
      });

      await expect(notifyIfEnabled('Task finished', 'all done')).resolves.toBeUndefined();
      expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();
    });

    it('resolves when transporting via sendNotificationData throws', async () => {
      mockEventManager.sendNotificationData = vi.fn(() => {
        throw new Error('transport blew up');
      });

      await expect(notifyIfEnabled('Task finished', 'all done')).resolves.toBeUndefined();
      expect(mockExtensionManager.dispatchEvent).toHaveBeenCalled();
    });

    it('resolves when the extension hook dispatch throws', async () => {
      mockExtensionManager.dispatchEvent = vi.fn(() => Promise.reject(new Error('extension hook blew up')));

      await expect(notifyIfEnabled('Task finished', 'all done')).resolves.toBeUndefined();
      expect(mockEventManager.sendNotificationData).not.toHaveBeenCalled();
    });
  });

  // A hung onNotification extension must never suppress core delivery indefinitely.
  // Core delivery proceeds with the unmodified notification after NOTIFICATION_HOOK_TIMEOUT_MS.
  describe('hook dispatch timeout', () => {
    it('delivers the unmodified notification when the hook never settles', async () => {
      vi.useFakeTimers();
      try {
        mockExtensionManager.dispatchEvent.mockImplementation(() => new Promise(() => {}));

        const delivery = notifyIfEnabled('Task finished', 'all done');
        await vi.advanceTimersByTimeAsync(NOTIFICATION_HOOK_TIMEOUT_MS);
        await expect(delivery).resolves.toBeUndefined();

        expect(mockEventManager.sendNotificationData).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task finished', body: 'all done' }));
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('did not settle in time'), expect.objectContaining({ title: 'Task finished' }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('delivers the pristine original when a hanging hook mutates the notification in place', async () => {
      vi.useFakeTimers();
      try {
        mockExtensionManager.dispatchEvent.mockImplementation((_event: string, payload: { notification: NotificationData } & { blocked?: boolean }) => {
          // Corrupt the shared payload BEFORE hanging: the timeout fallback must deliver
          // the snapshot, not the mutated in-place object
          payload.notification.title = 'MUTATED';
          payload.notification.body = 'MUTATED';
          return new Promise(() => {});
        });

        const delivery = notifyIfEnabled('Task finished', 'all done');
        await vi.advanceTimersByTimeAsync(NOTIFICATION_HOOK_TIMEOUT_MS);
        await expect(delivery).resolves.toBeUndefined();

        const delivered = mockEventManager.sendNotificationData.mock.calls[0][0] as NotificationData;
        expect(delivered.title).toBe('Task finished');
        expect(delivered.body).toBe('all done');
        expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('did not settle in time'), expect.objectContaining({ title: 'Task finished' }));
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores a hook result that arrives after the timeout (no duplicate delivery once it settles)', async () => {
      vi.useFakeTimers();
      try {
        let resolveLateHook: (value: unknown) => void = () => {};
        mockExtensionManager.dispatchEvent.mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveLateHook = resolve;
            }),
        );

        const delivery = notifyIfEnabled('Task finished', 'all done');
        await vi.advanceTimersByTimeAsync(NOTIFICATION_HOOK_TIMEOUT_MS);
        await delivery;
        expect(mockEventManager.sendNotificationData).toHaveBeenCalledTimes(1);

        // Late hook settlement (blocked: true) must not retroactively suppress delivery
        resolveLateHook({ blocked: true });
        await Promise.resolve();

        expect(mockEventManager.sendNotificationData).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not surface an unhandled rejection when the raced hook rejects after the timeout', async () => {
      vi.useFakeTimers();
      const unhandled: unknown[] = [];
      const unhandledRejectionListener = (reason: unknown) => unhandled.push(reason);
      process.on('unhandledRejection', unhandledRejectionListener);
      try {
        let rejectLateHook: (error: Error) => void = () => {};
        mockExtensionManager.dispatchEvent.mockImplementation(
          () =>
            new Promise((_resolve, reject) => {
              rejectLateHook = reject;
            }),
        );

        const delivery = notifyIfEnabled('Task finished', 'all done');
        await vi.advanceTimersByTimeAsync(NOTIFICATION_HOOK_TIMEOUT_MS);
        await delivery;
        expect(mockEventManager.sendNotificationData).toHaveBeenCalledTimes(1);

        rejectLateHook(new Error('hook blew up after delivery'));
        await vi.advanceTimersByTimeAsync(0);
        await Promise.resolve();

        expect(unhandled).toHaveLength(0);
      } finally {
        process.off('unhandledRejection', unhandledRejectionListener);
        vi.useRealTimers();
      }
    });
  });
});

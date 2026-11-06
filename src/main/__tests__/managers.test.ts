import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Store } from '@/store';

const createManager = () => ({
  init: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  dispose: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
  stop: vi.fn(),
});

const modules: Record<string, string[]> = {
  '@/agent': ['AgentProfileManager', 'McpConfigManager', 'McpManager'],
  '@/server': ['CloudflareTunnelManager', 'ServerController'],
  '@/connector': ['ConnectorManager'],
  '@/project': ['ProjectManager'],
  '@/events': ['EventManager'],
  '@/models': ['ModelManager'],
  '@/data-manager': ['DataManager'],
  '@/terminal': ['TerminalManager'],
  '@/versions': ['VersionsManager'],
  '@/telemetry': ['TelemetryManager'],
  '@/git': ['GitManager', 'GitAskpassManager'],
  '@/memory/memory-manager': ['MemoryManager'],
  '@/extensions/extension-manager': ['ExtensionManager'],
  '@/network-manager': ['NetworkManager'],
  '@/events-handler': ['EventsHandler'],
  '@/prompts': ['PromptsManager'],
  '@/python-dependencies-installer': ['PythonDependenciesInstaller'],
};

const managers: Record<string, ReturnType<typeof createManager>> = {};
const logger = { info: vi.fn(), error: vi.fn() };

const init = async () => {
  const { initManagers } = await import('../managers');
  const store = { getSettings: vi.fn().mockReturnValue({ language: 'en' }) } as unknown as Store;
  const on = vi.spyOn(process, 'on').mockReturnValue(process);
  try {
    return await initManagers(store);
  } finally {
    on.mockRestore();
  }
};

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe('manager cleanup', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    for (const [path, names] of Object.entries(modules)) {
      for (const name of names) {
        managers[name] = createManager();
      }
      vi.doMock(path, () =>
        Object.fromEntries(
          names.map((name) => [
            name,
            class {
              constructor() {
                return managers[name];
              }
            },
          ]),
        ),
      );
    }
    vi.doMock('http', () => ({ createServer: () => ({ listen: vi.fn() }) }));
    vi.doMock('@/logger', () => ({ default: logger, initEventLogging: vi.fn() }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the database open until project and extension cleanup both finish', async () => {
    const project = createDeferred();
    const extension = createDeferred();
    managers.ProjectManager.close.mockReturnValue(project.promise);
    managers.ExtensionManager.dispose.mockReturnValue(extension.promise);
    const { cleanup } = await init();

    const pending = cleanup();
    await vi.waitFor(() => expect(managers.ProjectManager.close).toHaveBeenCalledOnce());
    expect(managers.DataManager.close).not.toHaveBeenCalled();

    project.resolve();
    await project.promise;
    expect(managers.DataManager.close).not.toHaveBeenCalled();

    extension.resolve();
    await pending;
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
    await cleanup();
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('waits for remaining cleanup after an asynchronous failure and logs its manager and stack', async () => {
    const project = createDeferred();
    const error = new Error('MCP cleanup failed');
    managers.ProjectManager.close.mockReturnValue(project.promise);
    managers.McpManager.close.mockRejectedValue(error);
    const { cleanup } = await init();

    const pending = cleanup();
    await vi.waitFor(() => expect(managers.McpManager.close).toHaveBeenCalledOnce());
    expect(managers.DataManager.close).not.toHaveBeenCalled();

    project.resolve();
    await pending;
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('Error during cleanup:', {
      manager: 'mcpManager',
      error: error.message,
      stack: error.stack,
    });
  });

  it('shares pending and completed cleanup work between concurrent callers', async () => {
    const project = createDeferred();
    managers.ProjectManager.close.mockReturnValue(project.promise);
    const { cleanup } = await init();
    const firstFinished = vi.fn();
    const secondFinished = vi.fn();

    const first = cleanup();
    const second = cleanup();
    expect(second).toBe(first);
    const callers = Promise.all([first.then(firstFinished), second.then(secondFinished)]);
    await vi.waitFor(() => expect(managers.ProjectManager.close).toHaveBeenCalledOnce());
    expect(firstFinished).not.toHaveBeenCalled();
    expect(secondFinished).not.toHaveBeenCalled();
    expect(managers.DataManager.close).not.toHaveBeenCalled();

    project.resolve();
    await callers;
    expect(firstFinished).toHaveBeenCalledOnce();
    expect(secondFinished).toHaveBeenCalledOnce();
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
    expect(cleanup()).toBe(first);
    await cleanup();
    expect(managers.ProjectManager.close).toHaveBeenCalledOnce();
    expect(managers.ExtensionManager.dispose).toHaveBeenCalledOnce();
    expect(managers.TerminalManager.close).toHaveBeenCalledOnce();
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
  });

  it('continues cleanup after a synchronous failure', async () => {
    const error = new Error('Terminal cleanup failed');
    managers.TerminalManager.close.mockImplementation(() => {
      throw error;
    });
    const { cleanup } = await init();

    await cleanup();

    expect(managers.ProjectManager.close).toHaveBeenCalledOnce();
    expect(managers.ExtensionManager.dispose).toHaveBeenCalledOnce();
    expect(managers.DataManager.close).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('Error during cleanup:', {
      manager: 'terminalManager',
      error: error.message,
      stack: error.stack,
    });
  });
});

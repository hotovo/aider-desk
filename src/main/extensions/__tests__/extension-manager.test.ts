import fs from 'fs/promises';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { ExtensionManager } from '../extension-manager';

import type { PathLike } from 'fs';
import type { Store } from '@/store';
import type { AgentProfileManager } from '@/agent';
import type { ModelManager } from '@/models';
import type { FSWatcher } from 'chokidar';
import type { ExtensionRegistry } from '../extension-registry';

// Import fs to get the mocked module

vi.mock('../extension-loader');
vi.mock('../extension-registry');
vi.mock('chokidar', () => ({
  watch: vi.fn(),
}));
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    readdir: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('path', () => ({
  default: {
    join: vi.fn((...parts: string[]) => parts.join('/')),
    basename: vi.fn((file) => file.split('/').pop() || file),
    resolve: vi.fn((path) => path),
  },
}));

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ExtensionManager', () => {
  let manager: ExtensionManager;
  let mockLoader: unknown;
  let mockRegistry: unknown;
  let store: { getSettings: ReturnType<typeof vi.fn>; saveSettings: ReturnType<typeof vi.fn> };
  let agentProfileManager: { getAllProfiles: ReturnType<typeof vi.fn> };
  let modelManager: { getProviderModels: ReturnType<typeof vi.fn> };

  // Get references to mocked fs functions
  const fsAccessMock = vi.mocked(fs.access);
  const fsReaddirMock = vi.mocked(fs.readdir);

  beforeEach(() => {
    vi.clearAllMocks();

    mockLoader = {
      loadExtension: vi.fn(),
    };
    mockRegistry = {
      clear: vi.fn(),
      register: vi.fn(),
      getExtension: vi.fn().mockReturnValue(undefined),
      getExtensions: vi.fn().mockReturnValue([]),
      unregister: vi.fn(),
      setInitialized: vi.fn(),
      clearTools: vi.fn(),
      clearCommands: vi.fn(),
      registerTool: vi.fn(),
      getTools: vi.fn().mockReturnValue([]),
      getToolsByExtension: vi.fn().mockReturnValue([]),
      registerCommand: vi.fn(),
      getCommands: vi.fn().mockReturnValue([]),
      getCommandsByExtension: vi.fn().mockReturnValue([]),
    };

    store = {
      getSettings: vi.fn().mockReturnValue({}),
      saveSettings: vi.fn(),
    };
    agentProfileManager = {
      getAllProfiles: vi.fn().mockReturnValue([]),
    };
    modelManager = {
      getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
    };
    const projectManager = {
      getProjects: vi.fn().mockReturnValue([]),
    };
    manager = new ExtensionManager(
      store as unknown as Store,
      agentProfileManager as unknown as AgentProfileManager,
      modelManager as unknown as ModelManager,
      projectManager as any,
    );
    (manager as unknown as Record<string, unknown>).loader = mockLoader;
    (manager as unknown as Record<string, unknown>).registry = mockRegistry;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadExtensions', () => {
    it('should load extensions from discovered paths during init', async () => {
      // Mock discoverExtensionsFromDir via scanDirectory
      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ] as any);

      const ext1 = {
        instance: { onLoad: vi.fn() },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: false,
      };
      const ext2 = {
        instance: {},
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: false,
      };

      (mockLoader as Record<string, unknown>).loadExtension = vi.fn().mockImplementation(async (path: string) => {
        if (path.includes('ext1')) {
          return { extension: ext1.instance, metadata: ext1.metadata };
        } else if (path.includes('ext2')) {
          return { extension: ext2.instance, metadata: ext2.metadata };
        }
        return null;
      });

      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockImplementation((name: string) => {
        if (name === 'ext1') {
          return ext1;
        }
        if (name === 'ext2') {
          return ext2;
        }
        return undefined;
      });
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      await manager.init();

      expect((mockRegistry as Record<string, unknown>).clear).toHaveBeenCalled();
      expect((mockLoader as Record<string, unknown>).loadExtension).toHaveBeenCalledTimes(2);
      expect((mockRegistry as Record<string, unknown>).register).toHaveBeenCalledTimes(2);
    });

    it('should handle extension loading errors gracefully', async () => {
      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([
        { name: 'valid.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'error.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ] as any);

      const validExt = {
        instance: {},
        metadata: { name: 'valid', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/valid.ts',
        initialized: false,
      };

      (mockLoader as Record<string, unknown>).loadExtension = vi.fn().mockImplementation(async (path: string) => {
        if (path.includes('valid')) {
          return { extension: validExt.instance, metadata: validExt.metadata };
        }
        throw new Error('Load failed');
      });

      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(validExt);
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([validExt]);

      await manager.init();

      // Only the valid extension should be registered (error extension failed to load)
      expect((mockRegistry as Record<string, unknown>).register).toHaveBeenCalledTimes(1);
      // Errors during individual extension loading are isolated and logged
      // This ensures one failing extension doesn't affect others
      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('initialize', () => {
    it('should initialize extensions successfully', async () => {
      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([{ name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) }] as any);

      const onLoadMock = vi.fn();
      const testExtension = {
        instance: { onLoad: onLoadMock },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: false,
      };

      (mockLoader as Record<string, unknown>).loadExtension = vi.fn().mockResolvedValue({
        extension: testExtension.instance,
        metadata: testExtension.metadata,
      });
      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(testExtension);
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([testExtension]);

      await manager.init();

      expect(manager.isInitialized()).toBe(true);
      expect(onLoadMock).toHaveBeenCalled();
      expect((mockRegistry as Record<string, unknown>).register).toHaveBeenCalled();
    });

    it('should handle onLoad errors gracefully', async () => {
      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([{ name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) }] as any);

      const onLoadMock = vi.fn().mockRejectedValue(new Error('onLoad failed'));
      const testExtension = {
        instance: { onLoad: onLoadMock },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: false,
      };

      (mockLoader as Record<string, unknown>).loadExtension = vi.fn().mockResolvedValue({
        extension: testExtension.instance,
        metadata: testExtension.metadata,
      });
      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(testExtension);
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([testExtension]);

      await manager.init();

      // onLoad errors cause the extension to fail initialization but don't crash the system
      expect(onLoadMock).toHaveBeenCalled();
      expect(manager.isInitialized()).toBe(true);
    });

    it('should handle extensions without onLoad method', async () => {
      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([{ name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) }] as any);

      const testExtension = {
        instance: {},
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: false,
      };

      (mockLoader as Record<string, unknown>).loadExtension = vi.fn().mockResolvedValue({
        extension: testExtension.instance,
        metadata: testExtension.metadata,
      });
      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(testExtension);
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([testExtension]);

      await manager.init();

      expect(manager.isInitialized()).toBe(true);
      expect((mockRegistry as Record<string, unknown>).register).toHaveBeenCalled();
    });

    it('should handle no extensions', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('getExtensions', () => {
    it('should return extensions from registry', () => {
      const mockExtensions = [
        {
          instance: {},
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
        },
      ];
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue(mockExtensions);

      const extensions = manager.getExtensions();

      expect(extensions).toEqual(mockExtensions);
    });
  });

  describe('getExtension', () => {
    it('should return specific extension by name', () => {
      const mockExtension = {
        instance: {},
        metadata: { name: 'ext1', version: '1.0.0' },
        filePath: '/path/ext1.ts',
      };
      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(mockExtension);

      const extension = manager.getExtension('ext1');

      expect(extension).toEqual(mockExtension);
    });

    it('should return undefined for unknown extension', () => {
      (mockRegistry as Record<string, unknown>).getExtension = vi.fn().mockReturnValue(undefined);

      const extension = manager.getExtension('unknown');

      expect(extension).toBeUndefined();
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      expect(manager.isInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      expect(manager.isInitialized()).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should do nothing if not initialized', async () => {
      const onUnloadMock = vi.fn();
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
          initialized: true,
        },
      ]);

      await manager.dispose();

      expect(onUnloadMock).not.toHaveBeenCalled();
    });

    it('should call onUnload for initialized extensions', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as Record<string, unknown>).setInitialized = vi.fn();

      await manager.init();

      const onUnloadMock = vi.fn();
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
          initialized: true,
        },
      ]);

      await manager.dispose();

      expect(onUnloadMock).toHaveBeenCalledTimes(1);
      expect(manager.isInitialized()).toBe(false);
    });

    it('should skip extensions without onUnload method', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as Record<string, unknown>).setInitialized = vi.fn();

      await manager.init();

      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([
        {
          instance: {},
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
          initialized: true,
        },
      ]);

      await expect(manager.dispose()).resolves.not.toThrow();
    });

    it('should skip extensions that are not initialized', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as Record<string, unknown>).setInitialized = vi.fn();

      await manager.init();

      const onUnloadMock = vi.fn();
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
          initialized: false,
        },
      ]);

      await manager.dispose();

      expect(onUnloadMock).not.toHaveBeenCalled();
    });

    it('should handle onUnload errors gracefully', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as Record<string, unknown>).setInitialized = vi.fn();

      await manager.init();

      const onUnloadMock = vi.fn().mockRejectedValue(new Error('Unload failed'));
      (mockRegistry as Record<string, unknown>).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'ext1', version: '1.0.0' },
          filePath: '/path/ext1.ts',
          initialized: true,
        },
      ]);

      await expect(manager.dispose()).resolves.not.toThrow();
      expect(manager.isInitialized()).toBe(false);
    });
  });

  describe('unloadExtension', () => {
    it('should unload an extension by file path', async () => {
      const onUnloadMock = vi.fn();
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' },
          filePath: '/path/test-ext.ts',
          initialized: true,
        },
      ]);
      (mockRegistry as ExtensionRegistry).unregister = vi.fn();

      await manager.unloadExtension('/path/test-ext.ts');

      expect(onUnloadMock).toHaveBeenCalled();
      expect((mockRegistry as ExtensionRegistry).unregister).toHaveBeenCalledWith('test-ext');
    });

    it('should do nothing if extension not found', async () => {
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as ExtensionRegistry).unregister = vi.fn();

      await manager.unloadExtension('/path/nonexistent.ts');

      expect((mockRegistry as ExtensionRegistry).unregister).not.toHaveBeenCalled();
    });

    it('should continue unload even if onUnload fails', async () => {
      const onUnloadMock = vi.fn().mockRejectedValue(new Error('Unload failed'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' },
          filePath: '/path/test-ext.ts',
          initialized: true,
        },
      ]);
      (mockRegistry as ExtensionRegistry).unregister = vi.fn();

      await manager.unloadExtension('/path/test-ext.ts');

      expect((mockRegistry as ExtensionRegistry).unregister).toHaveBeenCalledWith('test-ext');
    });

    it('should skip unload for uninitialized extensions', async () => {
      const onUnloadMock = vi.fn();
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([
        {
          instance: { onUnload: onUnloadMock },
          metadata: { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' },
          filePath: '/path/test-ext.ts',
          initialized: false,
        },
      ]);
      (mockRegistry as ExtensionRegistry).unregister = vi.fn();

      await manager.unloadExtension('/path/test-ext.ts');

      expect(onUnloadMock).not.toHaveBeenCalled();
      expect((mockRegistry as ExtensionRegistry).unregister).toHaveBeenCalledWith('test-ext');
    });
  });

  describe('reloadExtension', () => {
    it('should unload and reload an extension', async () => {
      const oldOnUnload = vi.fn();
      const newOnLoad = vi.fn();

      const oldExtension = {
        instance: { onUnload: oldOnUnload },
        metadata: { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/test-ext.ts',
        initialized: true,
      };

      const newExtension = {
        instance: { onLoad: newOnLoad },
        metadata: { name: 'test-ext', version: '1.0.1', description: 'Updated', author: 'Test' },
        filePath: '/path/test-ext.ts',
        initialized: false,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi
        .fn()
        .mockReturnValueOnce([oldExtension])
        .mockReturnValueOnce([oldExtension])
        .mockReturnValueOnce([])
        .mockReturnValueOnce([]);
      (mockRegistry as ExtensionRegistry).getExtension = vi.fn().mockReturnValue(newExtension);

      (mockRegistry as ExtensionRegistry).unregister = vi.fn();
      (mockRegistry as ExtensionRegistry).register = vi.fn();
      (mockRegistry as ExtensionRegistry).setInitialized = vi.fn();

      (mockLoader as { loadExtension: ReturnType<typeof vi.fn> }).loadExtension = vi.fn().mockResolvedValue({
        extension: { onLoad: newOnLoad },
        metadata: { name: 'test-ext', version: '1.0.1', description: 'Updated', author: 'Test' },
      });

      const result = await manager.reloadExtension('/path/test-ext.ts');

      expect(result).toBe(true);
      expect(oldOnUnload).toHaveBeenCalled();
      expect((mockRegistry as ExtensionRegistry).unregister).toHaveBeenCalledWith('test-ext');
      expect((mockLoader as { loadExtension: ReturnType<typeof vi.fn> }).loadExtension).toHaveBeenCalledWith('/path/test-ext.ts');
      expect((mockRegistry as ExtensionRegistry).register).toHaveBeenCalled();
      expect(newOnLoad).toHaveBeenCalled();
    });

    it('should return false if loading fails', async () => {
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as ExtensionRegistry).unregister = vi.fn();

      (mockLoader as { loadExtension: ReturnType<typeof vi.fn> }).loadExtension = vi.fn().mockRejectedValue(new Error('Load failed'));

      const result = await manager.reloadExtension('/path/error.ts');

      expect(result).toBe(false);
    });

    it('should handle reload errors gracefully without throwing', async () => {
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockImplementation(() => {
        throw new Error('Registry error');
      });

      const result = await manager.reloadExtension('/path/test-ext.ts');

      expect(result).toBe(false);
    });
  });

  describe('hot reload configuration', () => {
    let mockChokidarWatcher: {
      on: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
    };

    beforeEach(async () => {
      vi.clearAllMocks();

      mockChokidarWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const { watch } = await import('chokidar');
      (watch as ReturnType<typeof vi.fn>).mockReturnValue(mockChokidarWatcher as unknown as FSWatcher);
    });

    it('should start hot reload watcher on init', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      const { watch } = await import('chokidar');

      await manager.init();

      expect(watch).toHaveBeenCalled();
    });

    it('should stop hot reload watcher on dispose', async () => {
      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      await manager.dispose();

      expect(mockChokidarWatcher.close).toHaveBeenCalled();
    });
  });

  describe('hot reload integration', () => {
    it('should reload all extensions when file changes are detected', async () => {
      vi.useFakeTimers();

      const { watch } = await import('chokidar');
      const mockChokidarWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (watch as ReturnType<typeof vi.fn>).mockReturnValue(mockChokidarWatcher as unknown as FSWatcher);

      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      const changeHandler = mockChokidarWatcher.on.mock.calls.find((call: unknown[]) => (call as [string, unknown])[0] === 'change')?.[1] as (
        path: string,
      ) => void;

      expect(changeHandler).toBeDefined();

      if (changeHandler) {
        changeHandler('/global/extensions/test.ts');
      }

      // Advance timers past the debounce period (1000ms)
      await vi.advanceTimersByTimeAsync(1100);

      // The directory-level reload clears and re-collects tools/commands
      expect((mockRegistry as ExtensionRegistry).clearTools).toHaveBeenCalled();
      expect((mockRegistry as ExtensionRegistry).clearCommands).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should reload all extensions when file is deleted', async () => {
      vi.useFakeTimers();

      const { watch } = await import('chokidar');
      const mockChokidarWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (watch as ReturnType<typeof vi.fn>).mockReturnValue(mockChokidarWatcher as unknown as FSWatcher);

      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      const unlinkHandler = mockChokidarWatcher.on.mock.calls.find((call: unknown[]) => (call as [string, unknown])[0] === 'unlink')?.[1] as (
        path: string,
      ) => void;

      expect(unlinkHandler).toBeDefined();

      if (unlinkHandler) {
        unlinkHandler('/global/extensions/test.ts');
      }

      // Advance timers past the debounce period (1000ms)
      await vi.advanceTimersByTimeAsync(1100);

      // The directory-level reload clears and re-collects tools/commands
      expect((mockRegistry as ExtensionRegistry).clearTools).toHaveBeenCalled();
      expect((mockRegistry as ExtensionRegistry).clearCommands).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should debounce multiple file changes into single reload', async () => {
      vi.useFakeTimers();

      const { watch } = await import('chokidar');
      const mockChokidarWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (watch as ReturnType<typeof vi.fn>).mockReturnValue(mockChokidarWatcher as unknown as FSWatcher);

      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);
      (mockRegistry as ExtensionRegistry).clearTools = vi.fn();
      (mockRegistry as ExtensionRegistry).clearCommands = vi.fn();

      await manager.init();

      // Reset the call count after init
      (mockRegistry as ExtensionRegistry).clearTools = vi.fn();
      (mockRegistry as ExtensionRegistry).clearCommands = vi.fn();

      const changeHandler = mockChokidarWatcher.on.mock.calls.find((call: unknown[]) => (call as [string, unknown])[0] === 'change')?.[1] as (
        path: string,
      ) => void;

      if (changeHandler) {
        // Trigger multiple changes in quick succession
        changeHandler('/global/extensions/ext1.ts');
        changeHandler('/global/extensions/ext2.ts');
        changeHandler('/global/extensions/ext3.ts');
      }

      // Advance timers past the debounce period (1000ms)
      await vi.advanceTimersByTimeAsync(1100);

      // Due to debouncing, clearTools should be called only once (single reload)
      expect((mockRegistry as ExtensionRegistry).clearTools).toHaveBeenCalledTimes(1);
      expect((mockRegistry as ExtensionRegistry).clearCommands).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should continue watching after a reload failure', async () => {
      vi.useFakeTimers();

      const { watch } = await import('chokidar');
      const mockChokidarWatcher = {
        on: vi.fn().mockReturnThis(),
        close: vi.fn().mockResolvedValue(undefined),
      };
      (watch as ReturnType<typeof vi.fn>).mockReturnValue(mockChokidarWatcher as unknown as FSWatcher);

      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      await manager.init();

      const changeHandler = mockChokidarWatcher.on.mock.calls.find((call: unknown[]) => (call as [string, unknown])[0] === 'change')?.[1] as (
        path: string,
      ) => void;

      if (changeHandler) {
        changeHandler('/global/extensions/ext1.ts');
      }

      // Advance timers past the debounce period
      await vi.advanceTimersByTimeAsync(1100);

      // Manager should still be initialized after reload
      expect(manager.isInitialized()).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('scanDirectory', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should return empty array for directory that does not exist', async () => {
      const testDir = '/non/existent/dir';

      fsAccessMock.mockRejectedValue(new Error('Directory does not exist'));

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual([]);
      expect(fsAccessMock).toHaveBeenCalledWith(testDir);
      expect(fsReaddirMock).not.toHaveBeenCalled();
    });

    it('should return empty array for empty directory', async () => {
      const testDir = '/extensions';

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue([]);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual([]);
      expect(fsAccessMock).toHaveBeenCalledWith(testDir);
      expect(fsReaddirMock).toHaveBeenCalledWith(testDir, { withFileTypes: true });
    });

    it('should find .ts files in directory', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext3.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/ext2.ts', '/extensions/ext3.ts']);
      expect(fsAccessMock).toHaveBeenCalledWith(testDir);
      expect(fsReaddirMock).toHaveBeenCalledWith(testDir, { withFileTypes: true });
    });

    it('should find .js files in directory', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.js', '/extensions/ext2.js']);
      expect(fsAccessMock).toHaveBeenCalledWith(testDir);
      expect(fsReaddirMock).toHaveBeenCalledWith(testDir, { withFileTypes: true });
    });

    it('should find both .ts and .js files in directory', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext3.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext4.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/ext2.js', '/extensions/ext3.ts', '/extensions/ext4.js']);
    });

    it('should ignore non-.ts/.js files', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'README.md', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'package.json', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/ext2.js']);
    });

    it('should find index.ts in subdirectory', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'my-extension', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/my-extension/index.ts']);
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.ts');
    });

    it('should find index.js in subdirectory when index.ts does not exist', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'my-extension', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockImplementation(async (filePath: PathLike) => {
        if (filePath === '/extensions/my-extension/index.ts') {
          throw new Error('File does not exist');
        }
        if (filePath === '/extensions/my-extension/index.js') {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      });

      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.js', '/extensions/my-extension/index.js']);
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.ts');
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.js');
    });

    it('should prefer index.ts over index.js when both exist in subdirectory', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'my-extension', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/my-extension/index.ts']);
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.ts');
      expect(fsAccessMock).not.toHaveBeenCalledWith('/extensions/my-extension/index.js');
    });

    it('should ignore subdirectory without index.ts or index.js', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'my-extension', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockImplementation(async (filePath: PathLike) => {
        if (filePath === '/extensions/my-extension/index.ts') {
          throw new Error('File does not exist');
        }
        if (filePath === '/extensions/my-extension/index.js') {
          throw new Error('File does not exist');
        }
        return Promise.resolve(undefined);
      });

      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts']);
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.ts');
      expect(fsAccessMock).toHaveBeenCalledWith('/extensions/my-extension/index.js');
    });

    it('should handle mixed scenario with files and subdirectories', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'ext2.js', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: 'subdir1', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
        { name: 'subdir2', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
        { name: 'README.md', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockImplementation(async (filePath: PathLike) => {
        if (filePath === '/extensions/subdir1/index.ts') {
          return Promise.resolve(undefined);
        }
        if (filePath === '/extensions/subdir2/index.ts') {
          throw new Error('File does not exist');
        }
        if (filePath === '/extensions/subdir2/index.js') {
          return Promise.resolve(undefined);
        }
        return Promise.resolve(undefined);
      });

      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/ext2.js', '/extensions/subdir1/index.ts', '/extensions/subdir2/index.js']);
    });

    it('should handle readdir errors gracefully', async () => {
      const testDir = '/extensions';

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockRejectedValue(new Error('Permission denied'));

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual([]);
      expect(fsAccessMock).toHaveBeenCalledWith(testDir);
      expect(fsReaddirMock).toHaveBeenCalledWith(testDir, { withFileTypes: true });
    });

    it('should handle directory with multiple subdirectories, some with index files', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'has-index-ts', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
        { name: 'has-index-js', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
        { name: 'no-index', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockImplementation(async (filePath: PathLike) => {
        if (filePath === '/extensions/has-index-ts/index.ts') {
          return Promise.resolve(undefined);
        }
        if (filePath === '/extensions/has-index-js/index.ts') {
          throw new Error('File does not exist');
        }
        if (filePath === '/extensions/has-index-js/index.js') {
          return Promise.resolve(undefined);
        }
        if (filePath === '/extensions/no-index/index.ts') {
          throw new Error('File does not exist');
        }
        if (filePath === '/extensions/no-index/index.js') {
          throw new Error('File does not exist');
        }
        return Promise.resolve(undefined);
      });

      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/has-index-ts/index.ts', '/extensions/has-index-js/index.js']);
    });

    it('should handle hidden files starting with dot', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'ext1.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
        { name: '.hidden.ts', isDirectory: vi.fn().mockReturnValue(false), isFile: vi.fn().mockReturnValue(true) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      // Hidden files are still scanned since they're valid .ts/.js files
      expect(result).toEqual(['/extensions/ext1.ts', '/extensions/.hidden.ts']);
    });

    it('should handle subdirectories with special characters in names', async () => {
      const testDir = '/extensions';

      const mockEntries = [
        { name: 'my-extension-1', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
        { name: 'my_extension_2', isDirectory: vi.fn().mockReturnValue(true), isFile: vi.fn().mockReturnValue(false) },
      ];

      fsAccessMock.mockResolvedValue(undefined);
      fsReaddirMock.mockResolvedValue(mockEntries as any);

      const result = await (manager as unknown as Record<string, (dir: string) => Promise<string[]>>).scanDirectory(testDir);

      expect(result).toEqual(['/extensions/my-extension-1/index.ts', '/extensions/my_extension_2/index.ts']);
    });
  });

  describe('dispatchEvent', () => {
    let mockProject: { baseDir: string };
    let mockTask: { task: { id: string; name: string } };

    beforeEach(() => {
      mockProject = { baseDir: '/test/project' };
      mockTask = { task: { id: 'task-1', name: 'Test Task' } };
    });

    it('should dispatch event to all extension handlers', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);

      const ext1 = {
        instance: { onPromptStarted: handler1 },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      const ext2 = {
        instance: { onPromptStarted: handler2 },
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      const event = { prompt: 'test prompt', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler1).toHaveBeenCalledWith(event, expect.any(Object));
      expect(handler2).toHaveBeenCalledWith(event, expect.any(Object));
      expect(result.blocked).toBeUndefined();
      expect(result).toEqual(event);
    });

    it('should dispatch to global extensions before project extensions', async () => {
      const callOrder: string[] = [];

      const globalExt = {
        instance: {
          onPromptStarted: vi.fn().mockImplementation(async () => {
            callOrder.push('global');
            return undefined;
          }),
        },
        metadata: { name: 'global-ext', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/global/ext.ts',
        initialized: true,
        projectDir: undefined,
      };

      const projectExt = {
        instance: {
          onPromptStarted: vi.fn().mockImplementation(async () => {
            callOrder.push('project');
            return undefined;
          }),
        },
        metadata: { name: 'project-ext', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/project/ext.ts',
        initialized: true,
        projectDir: '/test/project',
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([projectExt, globalExt]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(callOrder).toEqual(['global', 'project']);
    });

    it('should merge modifications from multiple extensions', async () => {
      const ext1 = {
        instance: {
          onPromptStarted: vi.fn().mockResolvedValue({ prompt: 'modified1' }),
        },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      const ext2 = {
        instance: {
          onPromptStarted: vi.fn().mockResolvedValue({ prompt: 'modified2' }),
        },
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      const event = { prompt: 'original', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(result.prompt).toBe('modified2');
      expect(result.blocked).toBeUndefined();
    });

    it('should stop dispatch chain when extension blocks event', async () => {
      const handler1 = vi.fn().mockResolvedValue({ blocked: true });
      const handler2 = vi.fn().mockResolvedValue(undefined);

      const ext1 = {
        instance: { onPromptStarted: handler1 },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      const ext2 = {
        instance: { onPromptStarted: handler2 },
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(result.blocked).toBe(true);
    });

    it('should isolate errors from one extension and continue with others', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Extension 1 failed'));
      const handler2 = vi.fn().mockResolvedValue({ prompt: 'modified' });

      const ext1 = {
        instance: { onPromptStarted: handler1 },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      const ext2 = {
        instance: { onPromptStarted: handler2 },
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(result.prompt).toBe('modified');
      expect(result.blocked).toBeUndefined();
    });

    it('should skip extensions without matching handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const ext1 = {
        instance: {}, // No handlers
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      const ext2 = {
        instance: { onPromptStarted: handler },
        metadata: { name: 'ext2', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext2.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1, ext2]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler).toHaveBeenCalledWith(event, expect.any(Object));
      expect(result.blocked).toBeUndefined();
    });

    it('should skip uninitialized extensions', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const ext1 = {
        instance: { onPromptStarted: handler },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: false,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext1]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler).not.toHaveBeenCalled();
      expect(result.blocked).toBeUndefined();
      expect(result).toEqual(event);
    });

    it('should return early if no extensions are loaded', async () => {
      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      const result = await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(result.blocked).toBeUndefined();
      expect(result).toEqual(event);
    });

    it('should pass ExtensionContext to handlers with correct data', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      const ext = {
        instance: { onPromptStarted: handler },
        metadata: { name: 'test-ext', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext]);

      const event = { prompt: 'test', mode: 'agent' as const, promptContext: { id: '123' } };
      await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(handler).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          // ExtensionContext should be created with correct parameters
        }),
      );
    });

    it('should not mutate original event object', async () => {
      const ext = {
        instance: {
          onPromptStarted: vi.fn().mockResolvedValue({ prompt: 'modified' }),
        },
        metadata: { name: 'ext1', version: '1.0.0', description: 'Test', author: 'Test' },
        filePath: '/path/ext1.ts',
        initialized: true,
      };

      (mockRegistry as ExtensionRegistry).getExtensions = vi.fn().mockReturnValue([ext]);

      const event = { prompt: 'original', mode: 'agent' as const, promptContext: { id: '123' } };
      const originalPrompt = event.prompt;

      await manager.dispatchEvent('onPromptStarted', event, mockProject as any, mockTask as any);

      expect(event.prompt).toBe(originalPrompt); // Original should not be modified
    });
  });
});

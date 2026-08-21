import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionContextImpl } from '../extension-context';
import { DisposableStore } from '../disposable-store';

import type { Model, ProviderModelsData, ProviderProfile, SettingsData } from '@common/types';
import type { ModelManager } from '@/models';
import type { Project } from '@/project';
import type { Store } from '@/store';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import logger from '@/logger';
const createMockStore = (settings: Partial<SettingsData> = {}, providers: ProviderProfile[] = []): Store => {
  const fullSettings: SettingsData = {
    language: 'en',
    theme: 'dark',
    ...settings,
  } as SettingsData;

  return {
    getSettings: vi.fn(() => fullSettings),
    saveSettings: vi.fn(),
    getProviders: vi.fn(() => providers),
  } as unknown as Store;
};

const createMockProject = (): Project => {
  return {
    baseDir: '/project/path',
  } as unknown as Project;
};

const createMockModelManager = (models: Model[] = []): ModelManager => {
  return {
    getProviderModels: vi.fn(async () => ({ models }) as ProviderModelsData),
  } as unknown as ModelManager;
};

describe('ExtensionContextImpl', () => {
  let context: ExtensionContextImpl;
  let store: DisposableStore;
  const extensionId = 'test-extension';
  const extensionName = 'Test Extension';

  beforeEach(() => {
    vi.clearAllMocks();
    store = new DisposableStore(extensionName);
    context = new ExtensionContextImpl(extensionId, extensionName, store);
  });

  describe('constructor', () => {
    it('should create context with extension id', () => {
      expect(context).toBeDefined();
    });

    it('should create context with project', () => {
      const mockProject = createMockProject();
      const contextWithProject = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        undefined,
        undefined,
        mockProject,
      );
      expect(contextWithProject.getProjectDir()).toBe('/project/path');
    });
  });

  describe('log', () => {
    it('should log info messages', () => {
      context.log('test message');

      expect(logger.info).toHaveBeenCalledWith('[Extension:Test Extension] test message');
    });

    it('should log error messages', () => {
      context.log('error message', 'error');

      expect(logger.error).toHaveBeenCalledWith('[Extension:Test Extension] error message');
    });

    it('should log warning messages', () => {
      context.log('warning message', 'warn');

      expect(logger.warn).toHaveBeenCalledWith('[Extension:Test Extension] warning message');
    });

    it('should log debug messages', () => {
      context.log('debug message', 'debug');

      expect(logger.debug).toHaveBeenCalledWith('[Extension:Test Extension] debug message');
    });

    it('should default to info log type', () => {
      context.log('default message');

      expect(logger.info).toHaveBeenCalledWith('[Extension:Test Extension] default message');
    });
  });

  describe('getProjectDir', () => {
    it('should return empty string when no project is set', () => {
      expect(context.getProjectDir()).toBe('');
    });

    it('should return project path when set', () => {
      const mockProject = createMockProject();
      const contextWithProject = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        undefined,
        undefined,
        mockProject,
      );
      expect(contextWithProject.getProjectDir()).toBe('/project/path');
    });
  });

  describe('getSetting', () => {
    it('should return setting value when Store is available', async () => {
      const mockStore = createMockStore({ language: 'zh', theme: 'light' });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      const result = await contextWithStore.getSetting('language');
      expect(result).toBe('zh');
    });

    it('should support dot notation for nested settings', async () => {
      const mockStore = createMockStore({
        aider: {
          options: '--model gpt-4',
          environmentVariables: '',
          addRuleFiles: true,
          autoCommits: true,
          cachingEnabled: false,
          watchFiles: false,
          confirmBeforeEdit: false,
        },
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      const result = await contextWithStore.getSetting('aider.options');
      expect(result).toBe('--model gpt-4');
    });

    it('should return undefined for non-existent keys', async () => {
      const mockStore = createMockStore();
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      const result = await contextWithStore.getSetting('nonexistent.key');
      expect(result).toBeUndefined();
    });

    it('should throw error when Store not available', async () => {
      await expect(context.getSetting('theme')).rejects.toThrow('Store not available');
    });

    it('should handle errors gracefully', async () => {
      const mockStore = createMockStore();
      vi.mocked(mockStore.getSettings).mockImplementation(() => {
        throw new Error('Store error');
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      await expect(contextWithStore.getSetting('theme')).rejects.toThrow('Store error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should call Store.saveSettings with updated settings', async () => {
      const mockStore = createMockStore({ language: 'en', theme: 'dark' });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      await contextWithStore.updateSettings({ theme: 'light' });

      expect(mockStore.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', theme: 'light' }));
    });

    it('should merge updates with existing settings', async () => {
      const mockStore = createMockStore({ language: 'en', theme: 'dark' });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      await contextWithStore.updateSettings({ language: 'zh' });

      expect(mockStore.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ language: 'zh', theme: 'dark' }));
    });

    it('should throw error when Store not available', async () => {
      await expect(context.updateSettings({ theme: 'light' })).rejects.toThrow('Store not available');
    });

    it('should handle errors gracefully', async () => {
      const mockStore = createMockStore();
      vi.mocked(mockStore.saveSettings).mockImplementation(() => {
        throw new Error('Save error');
      });
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), mockStore);

      await expect(contextWithStore.updateSettings({ theme: 'light' })).rejects.toThrow('Save error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getModelConfigs', () => {
    it('should return model configs from ModelManager', async () => {
      const mockModels: Model[] = [{ id: 'model-1', providerId: 'provider-1' } as Model, { id: 'model-2', providerId: 'provider-2' } as Model];
      const mockModelManager = createMockModelManager(mockModels);

      const contextWithModelManager = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual(mockModels);
    });

    it('should return empty array when ModelManager not available', async () => {
      const result = await context.getModelConfigs();
      expect(result).toEqual([]);
    });

    it('should return empty array when no models in ModelManager', async () => {
      const mockModelManager = createMockModelManager([]);

      const contextWithModelManager = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual([]);
    });

    it('should handle errors gracefully and return empty array', async () => {
      const mockModelManager = createMockModelManager();
      vi.mocked(mockModelManager.getProviderModels).mockImplementation(async () => {
        throw new Error('Model manager error');
      });

      const contextWithModelManager = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName), undefined, mockModelManager);

      const result = await contextWithModelManager.getModelConfigs();
      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('triggerUIDataRefresh', () => {
    it('should call eventManager.sendExtensionUIRefresh without parameters', () => {
      const mockEventManager = {
        sendExtensionUIRefresh: vi.fn(),
      };

      const mockProject = {
        baseDir: '/test/project',
      };

      const contextWithEventManager = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        mockEventManager as any,
        undefined,
        mockProject as any,
      );

      contextWithEventManager.triggerUIDataRefresh();

      expect(mockEventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({
        projectDir: '/test/project',
        extensionId: 'test-extension',
        componentId: undefined,
        taskId: undefined,
      });
    });

    it('should call eventManager.sendExtensionUIRefresh with componentId', () => {
      const mockEventManager = {
        sendExtensionUIRefresh: vi.fn(),
      };

      const mockProject = {
        baseDir: '/test/project',
      };

      const contextWithEventManager = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        mockEventManager as any,
        undefined,
        mockProject as any,
      );

      contextWithEventManager.triggerUIDataRefresh('status-bar');

      expect(mockEventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({
        projectDir: '/test/project',
        extensionId: 'test-extension',
        componentId: 'status-bar',
        taskId: undefined,
      });
    });

    it('should call eventManager.sendExtensionUIRefresh with componentId and taskId', () => {
      const mockEventManager = {
        sendExtensionUIRefresh: vi.fn(),
      };

      const mockProject = {
        baseDir: '/test/project',
      };

      const contextWithEventManager = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        mockEventManager as any,
        undefined,
        mockProject as any,
      );

      contextWithEventManager.triggerUIDataRefresh('status-bar', 'task-123');

      expect(mockEventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({
        projectDir: '/test/project',
        extensionId: 'test-extension',
        componentId: 'status-bar',
        taskId: 'task-123',
      });
    });

    it('should log warning if eventManager is not available', () => {
      const contextWithoutEventManager = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName));

      expect(() => {
        contextWithoutEventManager.triggerUIDataRefresh();
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('triggerUIComponentsReload', () => {
    it('should call eventManager.sendExtensionUIRefresh with reloadComponents flag', () => {
      const mockEventManager = {
        sendExtensionUIRefresh: vi.fn(),
      };

      const mockProject = {
        baseDir: '/test/project',
      };

      const contextWithEventManager = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        mockEventManager as any,
        undefined,
        mockProject as any,
      );

      contextWithEventManager.triggerUIComponentsReload();

      expect(mockEventManager.sendExtensionUIRefresh).toHaveBeenCalledWith({
        projectDir: '/test/project',
        extensionId: 'test-extension',
        reloadComponents: true,
      });
    });

    it('should log warning if eventManager is not available', () => {
      const contextWithoutEventManager = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName));

      expect(() => {
        contextWithoutEventManager.triggerUIComponentsReload();
      }).not.toThrow();

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('addDisposable', () => {
    it('should run the setup function immediately', () => {
      const setup = vi.fn(() => () => {});
      context.addDisposable(setup);
      expect(setup).toHaveBeenCalledTimes(1);
    });

    it('should call the returned cleanup function on disposeExtension', async () => {
      const cleanup = vi.fn();
      context.addDisposable(() => cleanup);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should run cleanups in LIFO order (reverse of registration)', async () => {
      const order: string[] = [];
      context.addDisposable(() => {
        order.push('cleanup-1');
        return () => {
          order.push('cleanup-1');
        };
      });
      context.addDisposable(() => {
        order.push('cleanup-2');
        return () => {
          order.push('cleanup-2');
        };
      });
      await store.disposeExtension();
      expect(order).toEqual(['cleanup-1', 'cleanup-2', 'cleanup-2', 'cleanup-1']);
    });

    it('should handle void-returning setup gracefully (no cleanup, no error)', async () => {
      const setup = vi.fn(() => undefined);
      context.addDisposable(setup);
      expect(setup).toHaveBeenCalledTimes(1);
      await expect(store.disposeExtension()).resolves.not.toThrow();
    });

    it('should catch errors in cleanup functions so subsequent cleanups still run', async () => {
      const cleanup1 = vi.fn(() => {
        throw new Error('cleanup1 failed');
      });
      const cleanup2 = vi.fn();
      context.addDisposable(() => cleanup1);
      context.addDisposable(() => cleanup2);
      await store.disposeExtension();
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it('should clear disposables after disposeExtension so calling twice does not re-run cleanup', async () => {
      const cleanup = vi.fn();
      context.addDisposable(() => cleanup);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should await async cleanup functions', async () => {
      let cleaned = false;
      context.addDisposable(() => async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        cleaned = true;
      });
      await store.disposeExtension();
      expect(cleaned).toBe(true);
    });

    it('should catch rejected async cleanups so subsequent cleanups still run', async () => {
      const order: string[] = [];
      context.addDisposable(() => async () => {
        order.push('async-cleanup-1');
        throw new Error('async cleanup failed');
      });
      context.addDisposable(() => () => {
        order.push('cleanup-2');
      });
      await store.disposeExtension();
      expect(order).toEqual(['cleanup-2', 'async-cleanup-1']);
    });
  });

  describe('addDisposable with DisposableStore (shared context)', () => {
    it('should register cleanup on the shared DisposableStore', async () => {
      const store = new DisposableStore(extensionName);
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, store);

      const cleanup = vi.fn();
      contextWithStore.addDisposable(() => cleanup);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should register multiple cleanups on the shared store and run them in LIFO order', async () => {
      const store = new DisposableStore(extensionName);
      const order: string[] = [];

      const ctx1 = new ExtensionContextImpl(extensionId, extensionName, store);
      const ctx2 = new ExtensionContextImpl(extensionId, extensionName, store);

      ctx1.addDisposable(() => () => {
        order.push('cleanup-1');
      });
      ctx2.addDisposable(() => () => {
        order.push('cleanup-2');
      });

      await store.disposeExtension();
      expect(order).toEqual(['cleanup-2', 'cleanup-1']);
    });

    it('should not re-run cleanups when disposeExtension is called on a context with the same store', async () => {
      const store = new DisposableStore(extensionName);
      const cleanup = vi.fn();

      const ctx1 = new ExtensionContextImpl(extensionId, extensionName, store);

      ctx1.addDisposable(() => cleanup);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
      await store.disposeExtension();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe('project-scoped disposables', () => {
    it('should register cleanup via ProjectContext.addDisposable on the shared store', async () => {
      const store = new DisposableStore(extensionName);
      const mockProject = createMockProject();
      const contextWithStore = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, mockProject as any);

      const cleanup = vi.fn();
      contextWithStore.getProjectContext().addDisposable(() => cleanup);
      await store.disposeProject('/project/path');
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should only dispose project disposables for the specified project', async () => {
      const store = new DisposableStore(extensionName);
      const project1 = { baseDir: '/proj1' } as any;
      const project2 = { baseDir: '/proj2' } as any;

      const ctx1 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project1);
      const ctx2 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project2);

      const cleanup1 = vi.fn();
      const cleanup2 = vi.fn();
      ctx1.getProjectContext().addDisposable(() => cleanup1);
      ctx2.getProjectContext().addDisposable(() => cleanup2);

      await store.disposeProject('/proj1');
      expect(cleanup1).toHaveBeenCalledTimes(1);
      expect(cleanup2).not.toHaveBeenCalled();
    });

    it('should run project cleanups in LIFO order', async () => {
      const store = new DisposableStore(extensionName);
      const project = { baseDir: '/proj' } as any;
      const order: string[] = [];

      const ctx1 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);
      const ctx2 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);

      ctx1.getProjectContext().addDisposable(() => () => {
        order.push('cleanup-1');
      });
      ctx2.getProjectContext().addDisposable(() => () => {
        order.push('cleanup-2');
      });

      await store.disposeProject('/proj');
      expect(order).toEqual(['cleanup-2', 'cleanup-1']);
    });

    it('should not re-run project cleanups after disposal (idempotent)', async () => {
      const store = new DisposableStore(extensionName);
      const project = { baseDir: '/proj' } as any;
      const cleanup = vi.fn();

      const ctx = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);
      ctx.getProjectContext().addDisposable(() => cleanup);

      await store.disposeProject('/proj');
      await store.disposeProject('/proj');
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('should dispose project disposables when disposeExtension is called', async () => {
      const store = new DisposableStore(extensionName);
      const project = { baseDir: '/proj' } as any;
      const extCleanup = vi.fn();
      const projCleanup = vi.fn();

      const ctx = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);
      ctx.addDisposable(() => extCleanup);
      ctx.getProjectContext().addDisposable(() => projCleanup);

      await store.disposeExtension();
      expect(extCleanup).toHaveBeenCalledTimes(1);
      expect(projCleanup).toHaveBeenCalledTimes(1);
    });

    it('should catch errors in project cleanup so subsequent cleanups still run', async () => {
      const store = new DisposableStore(extensionName);
      const project = { baseDir: '/proj' } as any;

      const ctx1 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);
      const ctx2 = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);

      ctx1.addDisposable(() => () => {
        throw new Error('project cleanup failed');
      });
      const cleanup2 = vi.fn();
      ctx2.getProjectContext().addDisposable(() => cleanup2);

      await store.disposeProject('/proj');
      expect(cleanup2).toHaveBeenCalledTimes(1);
    });

    it('should report whether a project has disposables', () => {
      const store = new DisposableStore(extensionName);
      const project = { baseDir: '/proj' } as any;

      expect(store.hasProjectDisposables('/proj')).toBe(false);

      const ctx = new ExtensionContextImpl(extensionId, extensionName, store, undefined, undefined, undefined, undefined, project);
      ctx.getProjectContext().addDisposable(() => () => {});

      expect(store.hasProjectDisposables('/proj')).toBe(true);
    });
  });

  describe('getMemoryContext', () => {
    it('should throw error when memoryManager is not available', () => {
      const contextWithoutMemory = new ExtensionContextImpl(extensionId, extensionName, new DisposableStore(extensionName));

      expect(() => contextWithoutMemory.getMemoryContext()).toThrow('MemoryManager not available');
    });

    it('should return memoryManager when available', () => {
      const mockMemoryManager = {
        isMemoryEnabled: vi.fn().mockReturnValue(true),
      };

      const contextWithMemory = new ExtensionContextImpl(
        extensionId,
        extensionName,
        new DisposableStore(extensionName),
        undefined,
        undefined,
        undefined,
        mockMemoryManager as any,
      );

      const memoryContext = contextWithMemory.getMemoryContext();
      expect(memoryContext).toBe(mockMemoryManager);
    });
  });
});

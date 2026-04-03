/**
 * Tests for Extension Lifecycle Methods
 * Verifies onLoad, onUnload, error handling, and initialization state tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';
import { ExtensionContextImpl } from '../extension-context';

import type { Extension, ExtensionContext, ExtensionMetadata } from '@common/extensions';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../extension-loader', () => ({
  ExtensionLoader: class {
    loadExtension = vi.fn();
  },
}));

vi.mock('../extension-validator', () => ({
  ExtensionValidator: class {
    validateExtension = vi.fn().mockResolvedValue({ isValid: true, errors: [] });
  },
}));

vi.mock('../extension-watcher', () => ({
  ExtensionWatcher: vi.fn(),
}));

const createMockExtension = (overrides: Partial<Extension> = {}): Extension => ({
  onLoad: vi.fn(),
  onUnload: vi.fn(),
  ...overrides,
});

const createMockMetadata = (overrides: Partial<ExtensionMetadata> = {}): ExtensionMetadata => ({
  name: 'test-extension',
  version: '1.0.0',
  description: 'Test extension',
  author: 'Test Author',
  ...overrides,
});

const createMockDeps = () => ({
  store: {} as any,
  modelManager: {
    getAllModels: vi.fn().mockResolvedValue([]),
    registerExtensionProviders: vi.fn(),
    unregisterExtensionProviders: vi.fn(),
  } as any,
  telemetryManager: {} as any,
  registry: new ExtensionRegistry(),
  eventManager: {
    sendSettingsUpdated: vi.fn(),
    sendExtensionUIRefresh: vi.fn(),
  } as any,
});

describe('Extension Lifecycle', () => {
  let manager: ExtensionManager;
  let mockDeps: ReturnType<typeof createMockDeps>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = createMockDeps();
    manager = new ExtensionManager(mockDeps.store, mockDeps.modelManager, mockDeps.eventManager, mockDeps.telemetryManager, mockDeps.registry);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onLoad', () => {
    it('should call onLoad with ExtensionContext during initialization', async () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      await (manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!);

      expect(extension.onLoad).toHaveBeenCalledTimes(1);
      expect(extension.onLoad).toHaveBeenCalledWith(expect.any(ExtensionContextImpl));
    });

    it('should allow extension to initialize state in onLoad', async () => {
      let capturedContext: ExtensionContext | null = null;
      const extension: Extension = {
        async onLoad(context) {
          capturedContext = context;
          context.log('Initializing state', 'info');
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      await (manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!);

      expect(capturedContext).not.toBeNull();
      expect(capturedContext).toBeInstanceOf(ExtensionContextImpl);
    });

    it('should skip initialization if extension has no onLoad method', async () => {
      const extension: Extension = {};
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      const result = await (manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!);

      expect(result).toBe(true);
      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(true);
    });

    it('should mark extension as initialized after successful onLoad', async () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      const loaded = registry.getExtension('/test/extension.ts')!;

      expect(loaded.initialized).toBe(false);

      await (manager as any).initializeExtension(loaded);

      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(true);
    });

    it('should catch and log errors in onLoad', async () => {
      const logger = await import('@/logger');
      const error = new Error('onLoad failed');
      const extension: Extension = {
        async onLoad() {
          throw error;
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');

      await expect((manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!)).rejects.toThrow('onLoad failed');

      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining("Failed to call onLoad for extension 'test-extension'"), error);
    });

    it('should not mark extension as initialized when onLoad fails', async () => {
      const extension: Extension = {
        async onLoad() {
          throw new Error('onLoad failed');
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');

      await expect((manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!)).rejects.toThrow();

      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(false);
    });
  });

  describe('onUnload', () => {
    it('should call onUnload during dispose', async () => {
      const logger = await import('@/logger');
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      (manager as any).initialized = true;
      await manager.dispose();

      expect(extension.onUnload).toHaveBeenCalledTimes(1);
      expect(logger.default.debug).toHaveBeenCalledWith(expect.stringContaining('Unloaded extension: test-extension'));
    });

    it('should not call onUnload if extension not initialized', async () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');

      (manager as any).initialized = true;
      await manager.dispose();

      expect(extension.onUnload).not.toHaveBeenCalled();
    });

    it('should not call onUnload if extension has no onUnload method', async () => {
      const extension: Extension = {};
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      (manager as any).initialized = true;
      await manager.dispose();
    });

    it('should catch and log errors in onUnload', async () => {
      const logger = await import('@/logger');
      const error = new Error('onUnload failed');
      const extension: Extension = {
        async onUnload() {
          throw error;
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      (manager as any).initialized = true;
      await manager.dispose();

      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining("Failed to unload extension 'test-extension'"), error);
    });

    it('should allow extension to release resources in onUnload', async () => {
      const resource = { disposed: false };
      const extension: Extension = {
        async onUnload() {
          resource.disposed = true;
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      (manager as any).initialized = true;
      await manager.dispose();

      expect(resource.disposed).toBe(true);
    });

    it('should continue disposing other extensions when one fails', async () => {
      const logger = await import('@/logger');
      const extension1: Extension = {
        onUnload: vi.fn().mockRejectedValue(new Error('Extension 1 failed')),
      };
      const extension2: Extension = {
        onUnload: vi.fn().mockResolvedValue(undefined),
      };

      const registry = (manager as any).registry as ExtensionRegistry;
      await registry.register(extension1, { name: 'ext1', version: '1.0.0', description: '', author: '' }, '/test/ext1.ts');
      await registry.register(extension2, { name: 'ext2', version: '1.0.0', description: '', author: '' }, '/test/ext2.ts');
      registry.setInitialized('/test/ext1.ts', true);
      registry.setInitialized('/test/ext2.ts', true);

      (manager as any).initialized = true;
      await manager.dispose();

      expect(extension1.onUnload).toHaveBeenCalled();
      expect(extension2.onUnload).toHaveBeenCalled();
      expect(logger.default.error).toHaveBeenCalledWith(expect.stringContaining("Failed to unload extension 'ext1'"), expect.any(Error));
    });
  });

  describe('Error Isolation', () => {
    it('should continue loading other extensions when one fails during init', async () => {
      const failingExtension: Extension = {
        async onLoad() {
          throw new Error('Load failed');
        },
      };
      const successExtension = createMockExtension();

      const registry = (manager as any).registry as ExtensionRegistry;
      await registry.register(failingExtension, { name: 'failing', version: '1.0.0', description: '', author: '' }, '/test/failing.ts');
      await registry.register(successExtension, { name: 'success', version: '1.0.0', description: '', author: '' }, '/test/success.ts');

      (manager as any).initialized = true;
      await manager.dispose();
    });

    it('should not crash AiderDesk on extension errors', async () => {
      const extension: Extension = {
        async onLoad() {
          throw new Error('Critical error');
        },
        async onUnload() {
          throw new Error('Cleanup error');
        },
      };
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');

      await expect((manager as any).initializeExtension(registry.getExtension('/test/extension.ts')!)).rejects.toThrow();

      registry.setInitialized('/test/extension.ts', true);
      (manager as any).initialized = true;
      await expect(manager.dispose()).resolves.not.toThrow();
    });
  });

  describe('unloadExtension', () => {
    it('should call onUnload when unloading an initialized extension', async () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      (manager as any).initialized = true;
      await manager.unloadExtension('/test/extension.ts');

      expect(extension.onUnload).toHaveBeenCalledTimes(1);
    });

    it('should unregister extension from registry after unload', async () => {
      const extension = createMockExtension();
      const metadata = createMockMetadata();
      const registry = (manager as any).registry as ExtensionRegistry;

      await registry.register(extension, metadata, '/test/extension.ts');
      registry.setInitialized('/test/extension.ts', true);

      expect(registry.getExtension('/test/extension.ts')).toBeDefined();

      await manager.unloadExtension('/test/extension.ts');

      expect(registry.getExtension('/test/extension.ts')).toBeUndefined();
    });

    it('should handle unloading non-existent extension gracefully', async () => {
      await expect(manager.unloadExtension('/non/existent.ts')).resolves.not.toThrow();
    });
  });

  describe('Initialization State Tracking', () => {
    it('should track initialization state via registry', async () => {
      const registry = new ExtensionRegistry();
      const extension = createMockExtension();
      const metadata = createMockMetadata();

      await registry.register(extension, metadata, '/test/extension.ts');

      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(false);

      registry.setInitialized('/test/extension.ts', true);

      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(true);

      registry.setInitialized('/test/extension.ts', false);

      expect(registry.getExtension('/test/extension.ts')?.initialized).toBe(false);
    });

    it('should handle setInitialized for non-existent extension', () => {
      const registry = new ExtensionRegistry();

      expect(() => registry.setInitialized('non-existent', true)).not.toThrow();
    });
  });
});

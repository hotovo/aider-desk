import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionManager } from '../extension-manager';
import { ExtensionRegistry } from '../extension-registry';
import { ExtensionContextImpl } from '../extension-context';

import type { Store } from '@/store';
import type { ModelManager } from '@/models';
import type { EventManager } from '@/events';
import type { Project } from '@/project';

import { TelemetryManager } from '@/telemetry';
import logger from '@/logger';

vi.mock('../extension-loader');
vi.mock('../extension-registry');
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ExtensionManager - executeUIExtensionAction', () => {
  let manager: ExtensionManager;
  let mockRegistry: ExtensionRegistry;
  let store: Store;
  let modelManager: ModelManager;
  let eventManager: EventManager;
  let telemetryManager: Partial<TelemetryManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRegistry = {
      clear: vi.fn(),
      register: vi.fn(),
      getExtension: vi.fn().mockReturnValue(undefined),
      getExtensions: vi.fn().mockReturnValue([]),
      unregister: vi.fn(),
      setInitialized: vi.fn(),
    } as unknown as ExtensionRegistry;

    store = {
      getSettings: vi.fn().mockReturnValue({}),
      saveSettings: vi.fn(),
    } as unknown as Store;

    modelManager = {
      getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
    } as unknown as ModelManager;

    eventManager = {
      sendSettingsUpdated: vi.fn(),
    } as unknown as EventManager;

    telemetryManager = {
      captureExtensionsLoaded: vi.fn(),
    };

    manager = new ExtensionManager(
      store as unknown as Store,
      modelManager as unknown as ModelManager,
      eventManager as unknown as EventManager,
      telemetryManager as any,
      mockRegistry as any,
    );
  });

  it('should call extension.executeUIExtensionAction with correct parameters', async () => {
    const mockExecuteUIExtensionAction = vi.fn().mockResolvedValue({ success: true });

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    const mockProject = {
      baseDir: '/test/project',
    } as Project;

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', [{ data: 'value' }], mockProject);

    expect(mockExecuteUIExtensionAction).toHaveBeenCalledTimes(1);
    expect(mockExecuteUIExtensionAction).toHaveBeenCalledWith('test-component', 'save', [{ data: 'value' }], expect.any(ExtensionContextImpl));

    // Verify the context has correct properties
    const contextArg = mockExecuteUIExtensionAction.mock.calls[0][3];
    expect(contextArg).toBeInstanceOf(ExtensionContextImpl);

    expect(result).toEqual({ success: true });
  });

  it('should return undefined when extension is not found', async () => {
    const mockExtension = {
      instance: {
        executeUIExtensionAction: vi.fn(),
      },
      metadata: {
        name: 'different-extension',
        version: '1.0.0',
        description: 'Different Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', []);

    expect(result).toBeUndefined();
  });

  it('should return undefined when extension does not have executeUIExtensionAction method', async () => {
    const mockExtension = {
      instance: {
        // Missing executeUIExtensionAction method
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', []);

    expect(result).toBeUndefined();
  });

  it('should skip uninitialized extensions', async () => {
    const mockExecuteUIExtensionAction = vi.fn();

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: false, // Not initialized
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', []);

    expect(mockExecuteUIExtensionAction).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should handle errors and return undefined', async () => {
    const mockExecuteUIExtensionAction = vi.fn().mockRejectedValue(new Error('Extension action failed'));

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', []);

    expect(mockExecuteUIExtensionAction).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      "[Extensions] Failed to execute UI extension action 'save' from 'test-extension' for component 'test-component':",
      expect.any(Error),
    );
  });

  it('should filter disabled extensions', async () => {
    const mockExecuteUIExtensionAction = vi.fn();

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
      enabled: false, // Disabled extension
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);
    store.getSettings = vi.fn().mockReturnValue({
      extensions: {
        disabled: ['test-extension'],
      },
    });

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'save', []);

    expect(mockExecuteUIExtensionAction).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('should return the result from the extension action', async () => {
    const expectedData = { actionResult: 'success', timestamp: 12345 };
    const mockExecuteUIExtensionAction = vi.fn().mockResolvedValue(expectedData);

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'getData', []);

    expect(result).toEqual(expectedData);
  });

  it('should work without a project parameter', async () => {
    const mockExecuteUIExtensionAction = vi.fn().mockResolvedValue({ result: 'ok' });

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const result = await manager.executeUIExtensionAction('test-extension', 'test-component', 'action', []);

    expect(mockExecuteUIExtensionAction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ result: 'ok' });
  });

  it('should pass project parameter to getExtensions when provided', async () => {
    const mockExecuteUIExtensionAction = vi.fn().mockResolvedValue({});

    const mockExtension = {
      instance: {
        executeUIExtensionAction: mockExecuteUIExtensionAction,
      },
      metadata: {
        name: 'test-extension',
        version: '1.0.0',
        description: 'Test Extension',
        author: 'Test Author',
      },
      filePath: '/path/to/extension.ts',
      initialized: true,
    };

    mockRegistry.getExtensions = vi.fn().mockReturnValue([mockExtension]);

    const mockProject = {
      baseDir: '/test/project/dir',
    } as Project;

    await manager.executeUIExtensionAction('test-extension', 'test-component', 'action', [], mockProject);

    expect(mockRegistry.getExtensions).toHaveBeenCalledWith('/test/project/dir');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { Extension, ExtensionMetadata } from '@common/extensions';

import { ExtensionRegistry } from '../extension-registry';

describe('ExtensionRegistry', () => {
  let registry: ExtensionRegistry;
  let mockExtension: Extension;
  let mockMetadata: ExtensionMetadata;

  beforeEach(() => {
    registry = new ExtensionRegistry();
    mockExtension = {} as Extension;
    mockMetadata = {
      name: 'test-ext',
      version: '1.0.0',
      description: 'Test extension',
      author: 'Tester',
    };
  });

  it('should register and retrieve an extension', () => {
    registry.register(mockExtension, mockMetadata, '/path/to/ext.ts');

    const extension = registry.getExtension('test-ext');
    expect(extension).toBeDefined();
    expect(extension?.instance).toBe(mockExtension);
    expect(extension?.metadata).toEqual(mockMetadata);
    expect(extension?.filePath).toBe('/path/to/ext.ts');
    expect(extension?.initialized).toBe(false);
  });

  it('should set initialized status for an extension', () => {
    registry.register(mockExtension, mockMetadata, '/path/to/ext.ts');

    registry.setInitialized('test-ext', true);
    expect(registry.getExtension('test-ext')?.initialized).toBe(true);

    registry.setInitialized('test-ext', false);
    expect(registry.getExtension('test-ext')?.initialized).toBe(false);
  });

  it('should not throw when setting initialized for unknown extension', () => {
    expect(() => registry.setInitialized('unknown-ext', true)).not.toThrow();
  });

  it('should return undefined for unknown extension', () => {
    const extension = registry.getExtension('unknown-ext');
    expect(extension).toBeUndefined();
  });

  it('should return all registered extensions', () => {
    registry.register(mockExtension, mockMetadata, '/path/1');
    const meta2 = { ...mockMetadata, name: 'other-ext' };
    registry.register(mockExtension, meta2, '/path/2');

    const extensions = registry.getExtensions();
    expect(extensions).toHaveLength(2);
    expect(extensions.some((e) => e.metadata.name === 'test-ext')).toBe(true);
    expect(extensions.some((e) => e.metadata.name === 'other-ext')).toBe(true);
  });

  it('should clear all extensions', () => {
    registry.register(mockExtension, mockMetadata, '/path/1');
    registry.clear();
    expect(registry.getExtensions()).toHaveLength(0);
  });
});

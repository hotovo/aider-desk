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

  it('should unregister an extension', () => {
    registry.register(mockExtension, mockMetadata, '/path/to/ext.ts');
    expect(registry.getExtension('test-ext')).toBeDefined();

    const result = registry.unregister('test-ext');
    expect(result).toBe(true);
    expect(registry.getExtension('test-ext')).toBeUndefined();
  });

  it('should return false when unregistering unknown extension', () => {
    const result = registry.unregister('unknown-ext');
    expect(result).toBe(false);
  });

  describe('Project filtering', () => {
    it('should filter extensions by projectDir', () => {
      registry.register(mockExtension, mockMetadata, '/path/1');
      const meta2 = { ...mockMetadata, name: 'project-ext' };
      registry.register(mockExtension, meta2, '/path/2', '/project/dir');

      const allExtensions = registry.getExtensions();
      expect(allExtensions).toHaveLength(2);

      const filteredExtensions = registry.getExtensions('/project/dir');
      expect(filteredExtensions).toHaveLength(2);
      expect(filteredExtensions.some((e) => e.metadata.name === 'test-ext')).toBe(true);
      expect(filteredExtensions.some((e) => e.metadata.name === 'project-ext')).toBe(true);

      const otherProjectExtensions = registry.getExtensions('/other/project');
      expect(otherProjectExtensions).toHaveLength(1);
      expect(otherProjectExtensions[0].metadata.name).toBe('test-ext');
    });

    it('should include global extensions when filtering by projectDir', () => {
      registry.register(mockExtension, mockMetadata, '/path/1');
      const meta2 = { ...mockMetadata, name: 'project-ext' };
      registry.register(mockExtension, meta2, '/path/2', '/project/dir');

      const extensions = registry.getExtensions('/project/dir');
      expect(extensions).toHaveLength(2);
    });

    it('should return only extensions matching projectDir or global when projectDir is specified', () => {
      registry.register(mockExtension, mockMetadata, '/path/1');
      const meta2 = { ...mockMetadata, name: 'project-a-ext' };
      registry.register(mockExtension, meta2, '/path/2', '/project/a');
      const meta3 = { ...mockMetadata, name: 'project-b-ext' };
      registry.register(mockExtension, meta3, '/path/3', '/project/b');

      const extensionsA = registry.getExtensions('/project/a');
      expect(extensionsA).toHaveLength(2);
      expect(extensionsA.some((e) => e.metadata.name === 'test-ext')).toBe(true);
      expect(extensionsA.some((e) => e.metadata.name === 'project-a-ext')).toBe(true);
      expect(extensionsA.some((e) => e.metadata.name === 'project-b-ext')).toBe(false);

      const extensionsB = registry.getExtensions('/project/b');
      expect(extensionsB).toHaveLength(2);
      expect(extensionsB.some((e) => e.metadata.name === 'project-b-ext')).toBe(true);
    });
  });
});

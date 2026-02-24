import { describe, it, expect, beforeEach } from 'vitest';

import { ContextPreparer, PreparedContext } from '../context-preparer';

import type { BmadStatus } from '@common/types';

describe('ContextPreparer', () => {
  let contextPreparer: ContextPreparer;

  const createMockStatus = (): BmadStatus => ({
    projectDir: '/test/project',
    installed: true,
    version: '1.0.0',
    availableWorkflows: [],
    completedWorkflows: [],
    inProgressWorkflows: [],
    incompleteWorkflows: [],
    detectedArtifacts: {},
    sprintStatus: undefined,
  });

  beforeEach(() => {
    contextPreparer = new ContextPreparer('/test/project');
  });

  describe('prepare()', () => {
    it('should return PreparedContext structure', async () => {
      const mockStatus = createMockStatus();
      const result = await contextPreparer.prepare('research', mockStatus);

      expect(result).toHaveProperty('contextMessages');
      expect(result).toHaveProperty('contextFiles');
      expect(Array.isArray(result.contextMessages)).toBe(true);
      expect(Array.isArray(result.contextFiles)).toBe(true);
    });

    it('should load context messages for research workflow', async () => {
      const mockStatus = createMockStatus();
      const result = await contextPreparer.prepare('research', mockStatus);

      expect(result.contextMessages).toBeDefined();
      expect(Array.isArray(result.contextMessages)).toBe(true);
    });

    it('should load context messages for product-brief workflow', async () => {
      const mockStatus = createMockStatus();
      const result = await contextPreparer.prepare('product-brief', mockStatus);

      expect(result.contextMessages).toBeDefined();
      expect(Array.isArray(result.contextMessages)).toBe(true);
    });

    it('should return empty context for unknown workflow', async () => {
      const mockStatus = createMockStatus();
      const result = await contextPreparer.prepare('unknown-workflow', mockStatus);

      expect(result.contextMessages).toEqual([]);
      expect(result.contextFiles).toEqual([]);
    });

    it('should return empty contextFiles by default', async () => {
      const mockStatus = createMockStatus();
      const result: PreparedContext = await contextPreparer.prepare('research', mockStatus);

      expect(result.contextFiles).toEqual([]);
    });

    it('should handle status parameter', async () => {
      const mockStatus = createMockStatus();
      mockStatus.completedWorkflows = ['research'];

      const result = await contextPreparer.prepare('product-brief', mockStatus);

      expect(result).toBeDefined();
      expect(result.contextMessages).toBeDefined();
    });
  });
});

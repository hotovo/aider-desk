import { describe, it, expect } from 'vitest';

import { TaskDataSchema } from '../types';

describe('TaskDataSchema', () => {
  it('should allow parentId to be string', () => {
    const taskWithParent = {
      id: 'task-1',
      baseDir: '/path',
      name: 'Task 1',
      mainModel: 'gpt-4o',
      aiderTotalCost: 0,
      agentTotalCost: 0,
      parentId: 'parent-1',
    };

    const result = TaskDataSchema.safeParse(taskWithParent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe('parent-1');
    }
  });

  it('should allow parentId to be null', () => {
    const taskWithNullParent = {
      id: 'task-1',
      baseDir: '/path',
      name: 'Task 1',
      mainModel: 'gpt-4o',
      aiderTotalCost: 0,
      agentTotalCost: 0,
      parentId: null,
    };

    const result = TaskDataSchema.safeParse(taskWithNullParent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentId).toBe(null);
    }
  });

  it('should be valid without parentId', () => {
    const taskWithoutParent = {
      id: 'task-1',
      baseDir: '/path',
      name: 'Task 1',
      mainModel: 'gpt-4o',
      aiderTotalCost: 0,
      agentTotalCost: 0,
    };

    const result = TaskDataSchema.safeParse(taskWithoutParent);
    expect(result.success).toBe(true);
  });

  it('should handle tasks without parentId field (backward compatibility)', () => {
    const taskWithoutParentField = {
      id: 'task-2',
      baseDir: '/path',
      name: 'Task 2',
      mainModel: 'gpt-4o',
      aiderTotalCost: 0,
      agentTotalCost: 0,
    };

    const result = TaskDataSchema.safeParse(taskWithoutParentField);
    expect(result.success).toBe(true);

    if (result.success) {
      // Verify parentId is either null or undefined for backward compatibility
      expect(['null', 'undefined']).toContain(String(result.data.parentId));
    }
  });
});

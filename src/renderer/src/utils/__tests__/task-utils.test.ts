import { describe, it, expect } from 'vitest';
import { TaskData } from '@common/types';

import { getSortedVisibleTasks, flattenTasksForVirtualization } from '../task-utils';

describe('task-utils', () => {
  describe('getSortedVisibleTasks', () => {
    const mockTasks: Partial<TaskData>[] = [
      { id: '1', name: 'Parent 1', updatedAt: '2026-01-14T10:00:00Z', archived: false, pinned: false, parentId: null },
      { id: '2', name: 'Subtask 1.1', updatedAt: '2026-01-14T10:05:00Z', archived: false, pinned: false, parentId: '1' },
      { id: '3', name: 'Parent 2', updatedAt: '2026-01-14T11:00:00Z', archived: false, pinned: true, parentId: null },
      { id: '4', name: 'Subtask 2.1', updatedAt: '2026-01-14T11:05:00Z', archived: false, pinned: false, parentId: '3' },
      { id: '5', name: 'Orphan Subtask', updatedAt: '2026-01-14T12:00:00Z', archived: false, pinned: false, parentId: 'non-existent' },
    ];

    it('should group subtasks under their parent tasks', () => {
      const sorted = getSortedVisibleTasks(mockTasks as TaskData[]);

      // Expected order:
      // 1. Parent 2 (Pinned)
      // 2. Subtask 2.1 (Child of Parent 2)
      // 3. Orphan Subtask (Top-level, most recent updatedAt, parent doesn't exist)
      // 4. Parent 1 (Top-level)
      // 5. Subtask 1.1 (Child of Parent 1)

      expect(sorted.map((t) => t.id)).toEqual(['3', '4', '5', '1', '2']);
    });

    it('should maintain sorting for top-level tasks (pinned, then updatedAt)', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'T1', updatedAt: '2026-01-14T10:00:00Z', pinned: false, parentId: null },
        { id: '2', name: 'T2', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: null },
        { id: '3', name: 'T3', updatedAt: '2026-01-14T09:00:00Z', pinned: true, parentId: null },
      ];
      const sorted = getSortedVisibleTasks(tasks as TaskData[]);
      expect(sorted.map((t) => t.id)).toEqual(['3', '2', '1']);
    });

    it('should sort parent tasks based on their most recent updatedAt including subtasks', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'Parent A', updatedAt: '2026-01-14T10:00:00Z', pinned: false, parentId: null },
        { id: '2', name: 'Subtask A1', updatedAt: '2026-01-14T12:00:00Z', pinned: false, parentId: '1' },
        { id: '3', name: 'Parent B', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: null },
        { id: '4', name: 'Subtask B1', updatedAt: '2026-01-14T10:30:00Z', pinned: false, parentId: '3' },
      ];
      const sorted = getSortedVisibleTasks(tasks as TaskData[]);
      // Parent A should be first because its subtask A1 (12:00) is newer than Parent B (11:00)
      expect(sorted.map((t) => t.id)).toEqual(['1', '2', '3', '4']);
    });

    it('should handle deep nesting when calculating most recent updatedAt', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'Parent A', updatedAt: '2026-01-14T08:00:00Z', pinned: false, parentId: null },
        { id: '2', name: 'Subtask A1', updatedAt: '2026-01-14T09:00:00Z', pinned: false, parentId: '1' },
        { id: '3', name: 'Subtask A1.1', updatedAt: '2026-01-14T13:00:00Z', pinned: false, parentId: '2' },
        { id: '4', name: 'Parent B', updatedAt: '2026-01-14T12:00:00Z', pinned: false, parentId: null },
        { id: '5', name: 'Subtask B1', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: '4' },
      ];
      const sorted = getSortedVisibleTasks(tasks as TaskData[]);
      // Parent A should be first because its nested subtask A1.1 (13:00) is newer than Parent B (12:00)
      expect(sorted.map((t) => t.id)).toEqual(['1', '2', '3', '4', '5']);
    });

    it('should handle tasks without updatedAt when considering subtasks', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'Parent A', pinned: false, parentId: null },
        { id: '2', name: 'Subtask A1', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: '1' },
        { id: '3', name: 'Parent B', updatedAt: '2026-01-14T10:00:00Z', pinned: false, parentId: null },
      ];
      const sorted = getSortedVisibleTasks(tasks as TaskData[]);
      // Parent A should be first because its subtask (11:00) is newer than Parent B (10:00)
      expect(sorted.map((t) => t.id)).toEqual(['1', '2', '3']);
    });

    it('should show subtasks of archived parent when showArchived is true', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'Archived Parent', updatedAt: '2026-01-14T10:00:00Z', pinned: false, parentId: null, archived: true },
        { id: '2', name: 'Subtask of Archived Parent', updatedAt: '2026-01-14T10:05:00Z', pinned: false, parentId: '1', archived: false },
        { id: '3', name: 'Active Parent', updatedAt: '2026-01-14T09:00:00Z', pinned: false, parentId: null, archived: false },
        { id: '4', name: 'Archived Subtask of Active Parent', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: '3', archived: true },
      ];
      // When showArchived is true, all tasks should be shown
      // Subtask of archived parent (id: '2') appears as orphan since parent is filtered
      const sorted = getSortedVisibleTasks(tasks as TaskData[], true);
      expect(sorted.map((t) => t.id)).toEqual(['3', '4', '1', '2']);
    });

    it('should show archived subtasks of active parent when showArchived is true', () => {
      const tasks: Partial<TaskData>[] = [
        { id: '1', name: 'Active Parent', updatedAt: '2026-01-14T09:00:00Z', pinned: false, parentId: null, archived: false },
        { id: '2', name: 'Archived Subtask', updatedAt: '2026-01-14T10:00:00Z', pinned: false, parentId: '1', archived: true },
        { id: '3', name: 'Active Subtask', updatedAt: '2026-01-14T11:00:00Z', pinned: false, parentId: '1', archived: false },
      ];
      const sorted = getSortedVisibleTasks(tasks as TaskData[], true);
      // Should include both archived and active subtasks of active parent
      expect(sorted.map((t) => t.id)).toEqual(['1', '3', '2']);
    });
  });

  describe('flattenTasksForVirtualization', () => {
    const mockTasks: Partial<TaskData>[] = [
      { id: '1', name: 'Pinned Task', updatedAt: '2026-01-14T10:00:00Z', pinned: true, parentId: null },
      { id: '2', name: 'Today Task', updatedAt: new Date().toISOString(), pinned: false, parentId: null },
      { id: '3', name: 'Subtask of Today', updatedAt: new Date().toISOString(), pinned: false, parentId: '2' },
      { id: '4', name: 'Yesterday Task', updatedAt: new Date(Date.now() - 86400000).toISOString(), pinned: false, parentId: null },
    ];

    it('should return headers and tasks in correct order', () => {
      const flattened = flattenTasksForVirtualization(mockTasks as TaskData[], new Set(), false, '');

      // Pinned task should be first (without header)
      expect(flattened[0]).toEqual({ type: 'task', id: '1', task: expect.any(Object), level: 0 });
      // Then today header
      expect(flattened[1].type).toBe('header');
      expect((flattened[1] as { type: 'header'; id: string; title: string }).title).toBe('today');
    });

    it('should include subtasks when parent is expanded', () => {
      const flattened = flattenTasksForVirtualization(mockTasks as TaskData[], new Set(['2']), false, '');

      const todayTaskIndex = flattened.findIndex((item) => item.type === 'task' && item.id === '2');
      const subtaskIndex = flattened.findIndex((item) => item.type === 'task' && item.id === '3');

      expect(todayTaskIndex).toBeGreaterThan(-1);
      expect(subtaskIndex).toBeGreaterThan(-1);
      expect(subtaskIndex).toBe(todayTaskIndex + 1);
      expect(flattened[subtaskIndex]).toEqual({ type: 'task', id: '3', task: expect.any(Object), level: 1 });
    });

    it('should not include subtasks when parent is not expanded', () => {
      const flattened = flattenTasksForVirtualization(mockTasks as TaskData[], new Set(), false, '');

      const subtaskIndex = flattened.findIndex((item) => item.type === 'task' && item.id === '3');
      expect(subtaskIndex).toBe(-1);
    });

    it('should not include any pinned header', () => {
      const tasksWithPinned: Partial<TaskData>[] = [
        { id: '1', name: 'Pinned Task 1', updatedAt: new Date().toISOString(), pinned: true, parentId: null },
        { id: '2', name: 'Task 2', updatedAt: new Date().toISOString(), pinned: false, parentId: null },
      ];

      const flattened = flattenTasksForVirtualization(tasksWithPinned as TaskData[], new Set(), false, '');

      // No pinned header should exist
      expect(flattened.find((item) => item.type === 'header' && item.id === 'pinned')).toBeUndefined();
      // Pinned task should be first
      expect(flattened[0]).toEqual({ type: 'task', id: '1', task: expect.any(Object), level: 0 });
    });

    it('should filter tasks based on search query', () => {
      const flattened = flattenTasksForVirtualization(mockTasks as TaskData[], new Set(), false, 'Pinned');

      const taskItems = flattened.filter((item) => item.type === 'task');
      expect(taskItems.length).toBe(1);
      expect(taskItems[0].id).toBe('1');
    });
  });
});

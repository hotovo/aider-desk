import { describe, it, expect } from 'vitest';

import { getSortedVisibleTasks } from '../task-utils';
import { TaskData } from '../../../../common/types';

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
      // 3. Orphan Subtask (Top-level, most recent updatedAt)
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
  });
});

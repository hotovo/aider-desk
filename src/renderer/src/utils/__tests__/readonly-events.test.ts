import { describe, expect, it } from 'vitest';

import { applyReadonlyTaskListEvent, isReadonlyTaskListEvent } from '../readonly-events';

import type { TaskData } from '@common/types';
import type { ReadonlyEvent } from '@/api/readonly-browser-api';

const createTask = (id: string, name: string): TaskData =>
  ({
    id,
    name,
    baseDir: '/project',
  }) as TaskData;

const createEvent = (type: string, data: unknown): ReadonlyEvent => ({ type, data });

describe('readonly task list events', () => {
  it('adds a newly created task', () => {
    const existingTask = createTask('task-1', 'Existing task');
    const createdTask = createTask('task-2', 'Created task');

    const result = applyReadonlyTaskListEvent([existingTask], createEvent('task-created', { baseDir: '/project', task: createdTask }));

    expect(result).toEqual([createdTask, existingTask]);
  });

  it.each(['task-updated', 'task-started', 'task-completed', 'task-cancelled'])('upserts a task for %s', (type) => {
    const existingTask = createTask('task-1', 'Original task');
    const updatedTask = createTask('task-1', 'Updated task');

    const result = applyReadonlyTaskListEvent([existingTask], createEvent(type, updatedTask));

    expect(result).toEqual([updatedTask]);
  });

  it('removes a deleted task', () => {
    const deletedTask = createTask('task-1', 'Deleted task');
    const remainingTask = createTask('task-2', 'Remaining task');

    const result = applyReadonlyTaskListEvent([deletedTask, remainingTask], createEvent('task-deleted', deletedTask));

    expect(result).toEqual([remainingTask]);
  });

  it('leaves the task list unchanged for trace events', () => {
    const tasks = [createTask('task-1', 'Existing task')];
    const event = createEvent('response-chunk', { taskId: 'task-1', chunk: 'Hello' });

    expect(isReadonlyTaskListEvent(event)).toBe(false);
    expect(applyReadonlyTaskListEvent(tasks, event)).toBe(tasks);
  });
});

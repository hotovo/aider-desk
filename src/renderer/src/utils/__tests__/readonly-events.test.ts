import { describe, expect, it } from 'vitest';

import { applyReadonlyLogEvent, applyReadonlyTaskListEvent, isReadonlyTaskListEvent } from '../readonly-events';

import type { LoadingMessage, LogMessage, Message, TaskData } from '@common/types';
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

describe('applyReadonlyLogEvent', () => {
  const createLogEvent = (level: string, taskId: string, message?: string, finished?: boolean): ReadonlyEvent => ({
    type: 'log',
    data: { baseDir: '/project', taskId, level, message, finished, timestamp: 1000 },
  });

  const FALLBACK = 'Thinking...';

  it('ignores non-log events', () => {
    const result = applyReadonlyLogEvent([], createEvent('response-chunk', { taskId: 'task-1' }), 'task-1', FALLBACK);
    expect(result).toEqual([]);
  });

  it('ignores events for other tasks', () => {
    const result = applyReadonlyLogEvent([], createLogEvent('loading', 'task-2'), 'task-1', FALLBACK);
    expect(result).toEqual([]);
  });

  it('adds a loading message', () => {
    const result = applyReadonlyLogEvent([], createLogEvent('loading', 'task-1', 'Working...'), 'task-1', FALLBACK);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('loading');
    expect((result[0] as LoadingMessage).content).toBe('Working...');
  });

  it('falls back to default text when loading message is empty', () => {
    const result = applyReadonlyLogEvent([], createLogEvent('loading', 'task-1', undefined), 'task-1', FALLBACK);
    expect(result).toHaveLength(1);
    expect((result[0] as LoadingMessage).content).toBe(FALLBACK);
  });

  it('updates existing loading message instead of adding a new one', () => {
    const result = applyReadonlyLogEvent(
      applyReadonlyLogEvent([], createLogEvent('loading', 'task-1', 'First'), 'task-1', FALLBACK),
      createLogEvent('loading', 'task-1', 'Second'),
      'task-1',
      FALLBACK,
    );
    expect(result).toHaveLength(1);
    expect((result[0] as LoadingMessage).content).toBe('Second');
  });

  it('removes loading messages when finished=true', () => {
    const messages = applyReadonlyLogEvent([], createLogEvent('loading', 'task-1', 'Thinking...'), 'task-1', FALLBACK);
    const result = applyReadonlyLogEvent(messages, createLogEvent('loading', 'task-1', undefined, true), 'task-1', FALLBACK);
    expect(result).toEqual([]);
  });

  it('adds a log message and removes existing loading messages', () => {
    const withLoading = applyReadonlyLogEvent([], createLogEvent('loading', 'task-1', 'Thinking...'), 'task-1', FALLBACK);
    const result = applyReadonlyLogEvent(withLoading, createLogEvent('error', 'task-1', 'Something went wrong'), 'task-1', FALLBACK);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('log');
    expect((result[0] as LogMessage).level).toBe('error');
    expect((result[0] as LogMessage).content).toBe('Something went wrong');
  });

  it('preserves existing log messages when adding a new one', () => {
    const firstLog = applyReadonlyLogEvent([], createLogEvent('info', 'task-1', 'First log'), 'task-1', FALLBACK);
    const result = applyReadonlyLogEvent(firstLog, createLogEvent('warning', 'task-1', 'Second log'), 'task-1', FALLBACK);
    expect(result).toHaveLength(2);
    expect(result.map((m: Message) => m.content)).toEqual(['First log', 'Second log']);
  });
});

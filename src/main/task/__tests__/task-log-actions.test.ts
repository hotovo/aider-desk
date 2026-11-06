import { describe, expect, it, vi } from 'vitest';

import { Task } from '../task';

import type { LogAction } from '@common/types';

vi.mock('@/logger');

describe('Task log actions', () => {
  it.each([undefined, [{ id: 'interrupt' }], [{ id: 'custom', data: { snapshotId: 'snapshot-1', nested: [null, false, 1] } }]] satisfies (
    | LogAction[]
    | undefined
  )[])('emits structured actions unchanged: %j', (actions) => {
    const sendLog = vi.fn();
    const task = {
      project: { baseDir: '/project' },
      taskId: 'task-1',
      eventManager: { sendLog },
    };

    Task.prototype.addLogMessage.call(task as unknown as Task, 'info', 'Message', false, undefined, actions);

    expect(sendLog).toHaveBeenCalledExactlyOnceWith({
      baseDir: '/project',
      taskId: 'task-1',
      level: 'info',
      message: 'Message',
      finished: false,
      promptContext: undefined,
      actions,
      timestamp: expect.any(Number),
    });
  });
});

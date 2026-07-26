import { describe, expect, it } from 'vitest';

import { AiderManager } from '../aider-manager';

type FakeAiderProcess = { pid?: number };

const createManager = (): AiderManager => {
  const task = {
    getProjectDir: () => '/tmp/aider-desk-test-project',
    getTaskDir: () => '/tmp/aider-desk-test-project/task',
    task: { id: 'task-id' },
    taskId: 'task-id',
  };

  return new AiderManager(task as never, {} as never, {} as never, {} as never, () => [], {} as never);
};

describe('AiderManager process lifecycle', () => {
  it('clears the started state when the child exits naturally', () => {
    const manager = createManager();
    const process = { pid: 1234 } as FakeAiderProcess;
    const internals = manager as unknown as {
      aiderProcess: FakeAiderProcess | null;
      aiderStarting: boolean;
      currentCommand: string | null;
      handleAiderProcessExit: (process: FakeAiderProcess, code: number | null) => void;
    };

    internals.aiderProcess = process;
    internals.aiderStarting = false;
    internals.currentCommand = 'ask';

    internals.handleAiderProcessExit(process, 0);

    expect(manager.isStarted()).toBe(false);
    expect(internals.currentCommand).toBeNull();
  });
});

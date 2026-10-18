import { describe, expect, it, vi } from 'vitest';

import { TaskContextImpl } from '../task-context';

import type { TaskContext } from '@common/extensions';
import type { Task } from '@/task';

describe('TaskContextImpl.getUpdatedFileDiff', () => {
  it.each([undefined, 'commit-hash'])('forwards the original path for rename-aware diffs with commit %s', async (commitHash) => {
    const patch = 'diff --git a/old.ts b/new.ts\nrename from old.ts\nrename to new.ts\n';
    const getUpdatedFileDiff = vi.fn<Task['getUpdatedFileDiff']>().mockResolvedValue(patch);
    const task = { getUpdatedFileDiff } as unknown as Task;
    const context: TaskContext = new TaskContextImpl(task);

    await expect(context.getUpdatedFileDiff('new.ts', commitHash, 'old.ts')).resolves.toBe(patch);

    expect(getUpdatedFileDiff).toHaveBeenCalledWith('new.ts', commitHash, 'old.ts');
  });

  it('continues to support callers that omit the original path', async () => {
    const getUpdatedFileDiff = vi.fn<Task['getUpdatedFileDiff']>().mockResolvedValue('ordinary patch');
    const task = { getUpdatedFileDiff } as unknown as Task;
    const context: TaskContext = new TaskContextImpl(task);

    await expect(context.getUpdatedFileDiff('file.ts')).resolves.toBe('ordinary patch');
    await expect(context.getUpdatedFileDiff('file.ts', 'commit-hash')).resolves.toBe('ordinary patch');

    expect(getUpdatedFileDiff).toHaveBeenNthCalledWith(1, 'file.ts', undefined, undefined);
    expect(getUpdatedFileDiff).toHaveBeenNthCalledWith(2, 'file.ts', 'commit-hash', undefined);
  });
});

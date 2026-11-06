import { Response } from 'express';
import { z } from 'zod';
import { TaskExecutionMode } from '@common/types';

import type { EventsHandler } from '@/events-handler';

import logger from '@/logger';

export const TaskOperationSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  requestId: z.string().uuid().optional(),
  executionMode: z.enum([TaskExecutionMode.WaitForFinish, TaskExecutionMode.RunInBackground]).optional(),
});

const REQUEST_ID_RETENTION_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_REQUEST_IDS = 10_000;

type TaskOperation = z.infer<typeof TaskOperationSchema>;

export class TaskOperations {
  private readonly requestIds = new Map<string, number>();

  constructor(private readonly eventsHandler: EventsHandler) {}

  async execute(res: Response, params: TaskOperation, operation: () => Promise<void>, message: string): Promise<void> {
    if (params.executionMode !== TaskExecutionMode.RunInBackground) {
      await operation();
      res.status(200).json({ message });
      return;
    }

    const { projectDir, taskId, requestId } = params;
    if (requestId) {
      const now = Date.now();
      for (const [id, expiresAt] of this.requestIds) {
        if (expiresAt <= now) {
          this.requestIds.delete(id);
        }
      }
      if (this.requestIds.has(requestId)) {
        res.status(409).json({ error: 'Request ID has already been submitted', requestId });
        return;
      }
      if (this.requestIds.size >= MAX_TRACKED_REQUEST_IDS) {
        res.status(503).json({ error: 'Request ID tracking capacity reached; try again later' });
        return;
      }
      this.requestIds.set(requestId, Infinity);
    }

    res.setHeader('X-Task-Id', taskId);
    res.status(202).json({ taskId, requestId });
    try {
      await operation();
    } catch (error) {
      logger.error('Background task operation failed', { projectDir, taskId, requestId, error });
      this.eventsHandler.getEventManager().sendLog({
        baseDir: projectDir,
        taskId,
        level: 'error',
        message: error instanceof Error ? error.message : String(error),
        finished: true,
      });
    } finally {
      if (requestId) {
        this.requestIds.set(requestId, Date.now() + REQUEST_ID_RETENTION_MS);
      }
    }
  }
}

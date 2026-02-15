import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const ListAllMemoriesSchema = z.object({
  projectId: z.string().optional(),
});

const DeleteMemorySchema = z.object({
  id: z.string().min(1, 'Memory ID is required'),
});

const DeleteProjectMemoriesSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

export class MemoryApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.get(
      '/memories',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ListAllMemoriesSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const memories = await this.eventsHandler.listAllMemories();
        const filtered = parsed.projectId ? memories.filter((m) => m.projectId === parsed.projectId) : memories;
        res.status(200).json(filtered);
      }),
    );

    router.delete(
      '/memories/:id',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DeleteMemorySchema, { id: req.params.id }, res);
        if (!parsed) {
          return;
        }

        const ok = await this.eventsHandler.deleteMemory(parsed.id);
        res.status(200).json({ ok });
      }),
    );

    router.delete(
      '/memories',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DeleteProjectMemoriesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const deletedCount = await this.eventsHandler.deleteProjectMemories(parsed.projectId);
        res.status(200).json({ deletedCount });
      }),
    );

    router.get(
      '/memories/embedding-progress',
      this.handleRequest(async (_req, res) => {
        res.status(200).json(this.eventsHandler.getMemoryEmbeddingProgress());
      }),
    );
  }
}

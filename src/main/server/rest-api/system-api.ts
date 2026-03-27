import { Router } from 'express';
import { z } from 'zod';
import { SystemLogLevel } from '@common/types';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const GetEffectiveEnvironmentVariableSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  baseDir: z.string().optional(),
});

const GetSystemLogsSchema = z.object({
  fromId: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  levels: z.array(z.string()).optional(),
});

export class SystemApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.get(
      '/system/env-var',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetEffectiveEnvironmentVariableSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { key, baseDir } = parsed;
        const envVar = this.eventsHandler.getEffectiveEnvironmentVariable(key, baseDir);
        res.status(200).json(envVar);
      }),
    );

    // Get system logs
    router.get(
      '/system/logs',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetSystemLogsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { fromId, limit, levels } = parsed;
        const logs = this.eventsHandler.getSystemLogs(fromId, limit, levels as SystemLogLevel[] | undefined);
        res.status(200).json(logs);
      }),
    );

    // Clear system logs
    router.delete(
      '/system/logs',
      this.handleRequest(async (_req, res) => {
        this.eventsHandler.clearSystemLogs();
        res.status(200).json({ success: true });
      }),
    );
  }
}

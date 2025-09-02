import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const GetEffectiveEnvironmentVariableSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  baseDir: z.string().optional(),
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
  }
}

import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const QueryUsageDataSchema = z.object({
  from: z.string().min(1, 'From date is required'),
  to: z.string().min(1, 'To date is required'),
});

export class UsageApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.get(
      '/usage',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(QueryUsageDataSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { from, to } = parsed;
        const usageData = await this.eventsHandler.queryUsageData(new Date(from), new Date(to));
        res.status(200).json(usageData);
      }),
    );
  }
}

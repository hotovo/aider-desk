import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const CreateVoiceSessionSchema = z.object({
  provider: z.any(),
});

export class VoiceApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.post(
      '/voice/session',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CreateVoiceSessionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const session = await this.eventsHandler.createVoiceSession(parsed.provider);
        res.status(200).json(session);
      }),
    );
  }
}

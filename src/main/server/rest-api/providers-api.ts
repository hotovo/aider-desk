import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const LlmProviderProfileSchema = z.any(); // Placeholder - can be refined based on LlmProviderProfile type

export class ProvidersApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get providers
    router.get(
      '/providers',
      this.handleRequest(async (_, res) => {
        const providers = this.eventsHandler.getProviders();
        res.status(200).json(providers);
      }),
    );

    // Update providers
    router.post(
      '/providers',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(LlmProviderProfileSchema.array(), req.body, res);
        if (!parsed) {
          return;
        }

        await this.eventsHandler.updateProviders(parsed);
        res.status(200).json({ message: 'Providers updated' });
      }),
    );

    // Get provider models
    router.get(
      '/models',
      this.handleRequest(async (_, res) => {
        const models = await this.eventsHandler.getProviderModels();
        res.status(200).json(models);
      }),
    );
  }
}

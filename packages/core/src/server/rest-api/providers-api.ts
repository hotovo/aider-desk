import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const LlmProviderProfileSchema = z.any(); // Placeholder - can be refined based on LlmProviderProfile type

const ModelUpdateSchema = z.object({
  providerId: z.string(),
  modelId: z.string(),
  model: z.any(), // Model object - will be validated at runtime
});

const BulkUpdateSchema = z.array(ModelUpdateSchema);

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
      this.handleRequest(async (req, res) => {
        const reload = req.query.reload === 'true';
        const models = await this.eventsHandler.getProviderModels(reload);
        res.status(200).json(models);
      }),
    );

    // Bulk update models
    router.put(
      '/models',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(BulkUpdateSchema, req.body, res);
        if (!parsed) {
          return;
        }

        await this.eventsHandler.updateModels(parsed);
        const models = await this.eventsHandler.getProviderModels(false);
        res.status(200).json(models);
      }),
    );

    // Upsert a single model
    router.put(
      '/providers/:providerId/models',
      this.handleRequest(async (req, res) => {
        const { providerId } = req.params;
        const { modelId } = req.query;
        if (!modelId || typeof modelId !== 'string') {
          res.status(400).json({ error: 'modelId is required' });
          return;
        }
        await this.eventsHandler.upsertModel(String(providerId), modelId, req.body);
        const models = await this.eventsHandler.getProviderModels(false);
        res.status(200).json(models);
      }),
    );

    // Delete a model
    router.delete(
      '/providers/:providerId/models',
      this.handleRequest(async (req, res) => {
        const { providerId } = req.params;
        const { modelId } = req.query;
        if (!modelId || typeof modelId !== 'string') {
          res.status(400).json({ error: 'modelId is required' });
          return;
        }
        await this.eventsHandler.deleteModel(String(providerId), modelId);
        const models = await this.eventsHandler.getProviderModels(false);
        res.status(200).json(models);
      }),
    );
  }
}

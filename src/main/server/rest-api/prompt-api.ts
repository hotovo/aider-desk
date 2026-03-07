import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const RunPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context', 'bmad']).optional(),
});

const SavePromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
});

export class PromptApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.post(
      '/run-prompt',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RunPromptSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, prompt, mode } = parsed;

        const responses = await this.eventsHandler.runPrompt(projectDir, taskId, prompt, mode);

        res.status(200).json(responses);
      }),
    );

    router.post(
      '/save-prompt',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SavePromptSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, prompt } = parsed;

        await this.eventsHandler.savePrompt(projectDir, taskId, prompt);

        res.status(200).json({ message: 'Prompt saved successfully' });
      }),
    );
  }
}

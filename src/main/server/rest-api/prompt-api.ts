import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const RunPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  mode: z.enum(['agent', 'code', 'ask', 'architect', 'context']).optional(),
});

export class PromptApi extends BaseApi {
  private isPromptRunning = false;

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

        // Check if another prompt is already running
        if (this.isPromptRunning) {
          res.status(429).json({
            error: 'Too many requests',
            message: 'Another prompt is already being processed',
          });
          return;
        }

        try {
          this.isPromptRunning = true;

          const responses = await this.eventsHandler.runPrompt(projectDir, taskId, prompt, mode);

          res.status(200).json(responses);
        } finally {
          // Clear the running flag even if there's an error
          this.isPromptRunning = false;
        }
      }),
    );
  }
}

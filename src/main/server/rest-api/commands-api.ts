import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const GetCustomCommandsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RunCustomCommandSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task id is required'),
  commandName: z.string().min(1, 'Command name is required'),
  args: z.array(z.string()),
  mode: z.enum(['code', 'ask', 'architect', 'context']),
});

export class CommandsApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get custom commands
    router.get(
      '/project/custom-commands',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetCustomCommandsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const commands = await this.eventsHandler.getCustomCommands(projectDir);
        res.status(200).json(commands);
      }),
    );

    // Run custom command
    router.post(
      '/project/custom-commands',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RunCustomCommandSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, commandName, args, mode } = parsed;
        await this.eventsHandler.runCustomCommand(projectDir, taskId, commandName, args, mode);
        res.status(200).json({ message: 'Custom command executed' });
      }),
    );
  }
}

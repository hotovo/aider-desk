import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AutonomyMode, CreateTaskParams } from '@common/types';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';
import logger from '@/logger';

const RunPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().optional(),
  prompt: z.string().min(1, 'Prompt is required'),
  mode: z.string().optional(),
  images: z.array(z.string()).optional(),
  model: z.string().optional(),
  agentProfileId: z.string().optional(),
  autonomyMode: z.nativeEnum(AutonomyMode).optional(),
});

const parseTaskParams = (model?: string, agentProfileId?: string, autonomyMode?: AutonomyMode): CreateTaskParams | undefined => {
  if (!model && !agentProfileId && !autonomyMode) {
    return undefined;
  }

  const params: CreateTaskParams = {};

  if (agentProfileId) {
    params.agentProfileId = agentProfileId;
  }

  if (autonomyMode) {
    params.autonomyMode = autonomyMode;
  }

  if (model) {
    const slashIndex = model.indexOf('/');
    if (slashIndex > 0) {
      params.provider = model.substring(0, slashIndex);
      params.model = model.substring(slashIndex + 1);
    } else {
      params.model = model;
    }
  }

  return params;
};

const SavePromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  prompt: z.string().min(1, 'Prompt is required'),
});

const SSE_ALLOWED_EVENT_TYPES = new Set([
  'response-chunk',
  'response-completed',
  'tool',
  'user-message',
  'log',
  'ask-question',
  'task-updated',
  'task-created',
]);

export class PromptApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.post('/run-prompt', (req: Request, res: Response) => {
      const acceptsSSE = req.accepts('text/event-stream');
      const acceptsJSON = req.accepts('application/json');

      if (!acceptsSSE && !acceptsJSON) {
        res.status(406).json({ error: 'Accept header must be application/json or text/event-stream' });
        return;
      }

      const parsed = RunPromptSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
      }

      const { projectDir, taskId, prompt, mode, images, model, agentProfileId, autonomyMode } = parsed.data;
      const isSSE = acceptsSSE && !acceptsJSON;

      if (isSSE) {
        void this.handleRunPromptSSE(res, projectDir, prompt, taskId, mode, images, model, agentProfileId, autonomyMode);
      } else {
        void this.handleRunPromptJSON(res, projectDir, prompt, taskId, mode, images, model, agentProfileId, autonomyMode);
      }
    });

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

  private async handleRunPromptJSON(
    res: Response,
    projectDir: string,
    prompt: string,
    taskId?: string,
    mode?: string,
    images?: string[],
    model?: string,
    agentProfileId?: string,
    autonomyMode?: AutonomyMode,
  ): Promise<void> {
    if (taskId) {
      const responses = await this.eventsHandler.runPrompt(projectDir, taskId, prompt, mode, images);
      res.status(200).json(responses);
    } else {
      const taskParams = parseTaskParams(model, agentProfileId, autonomyMode);
      const result = await this.eventsHandler.ensureProjectAndCreateTask(projectDir, taskParams);
      const responses = await this.eventsHandler.runPrompt(result.projectDir, result.taskId, prompt, mode, images);
      res.setHeader('X-Task-Id', result.taskId);
      res.status(200).json(responses);
    }
  }

  private async handleRunPromptSSE(
    res: Response,
    projectDir: string,
    prompt: string,
    taskId?: string,
    mode?: string,
    images?: string[],
    model?: string,
    agentProfileId?: string,
    autonomyMode?: AutonomyMode,
  ): Promise<void> {
    let resolvedTaskId = taskId;

    if (!resolvedTaskId) {
      const taskParams = parseTaskParams(model, agentProfileId, autonomyMode);
      const result = await this.eventsHandler.ensureProjectAndCreateTask(projectDir, taskParams);
      resolvedTaskId = result.taskId;
    }

    const baseDir = projectDir.endsWith('/') ? projectDir.slice(0, -1) : projectDir;

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Task-Id': resolvedTaskId,
    });

    // Send initial comment to establish connection
    res.write(': connected\n\n');

    const eventManager = this.eventsHandler.getEventManager();
    const listenerId = `sse-${uuidv4()}`;

    let closed = false;

    const listener = (event: { type: string; data: unknown }) => {
      if (closed) {
        return;
      }

      const data = event.data as { baseDir?: string; taskId?: string; id?: string };
      if (!SSE_ALLOWED_EVENT_TYPES.has(event.type)) {
        return;
      }

      if (data.baseDir !== undefined && data.baseDir !== baseDir) {
        return;
      }

      const eventTaskId = data.taskId || data.id;
      if (eventTaskId !== undefined && eventTaskId !== resolvedTaskId) {
        return;
      }

      try {
        const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        res.write(sseData);
      } catch (err) {
        logger.error('SSE run-prompt: error writing event', { err });
        cleanup();
      }
    };

    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      eventManager.unsubscribeSSE(listenerId, listener);
      try {
        res.end();
      } catch {
        // already closed
      }
    };

    eventManager.subscribeSSE(listenerId, listener, false);

    res.on('close', () => {
      if (!closed) {
        cleanup();
      }
    });

    try {
      await this.eventsHandler.waitForTaskIdle(baseDir, resolvedTaskId);
      await this.eventsHandler.runPrompt(baseDir, resolvedTaskId, prompt, mode, images);

      if (!closed) {
        try {
          res.write(`event: stream-end\ndata: ${JSON.stringify({ type: 'stream-end' })}\n\n`);
        } catch {
          // Client disconnected
        }
      }
    } catch (error) {
      logger.error('SSE run-prompt: error running prompt', { error });
      if (!closed) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`);
        } catch {
          // Client disconnected
        }
      }
    } finally {
      cleanup();
    }
  }
}

import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const CreateTerminalSchema = z.object({
  baseDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  cols: z.number().int().min(1).optional(),
  rows: z.number().int().min(1).optional(),
});

const WriteToTerminalSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  data: z.string(),
});

const ResizeTerminalSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
  cols: z.number().int().min(1),
  rows: z.number().int().min(1),
});

const CloseTerminalSchema = z.object({
  terminalId: z.string().min(1, 'Terminal ID is required'),
});

export class TerminalApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Create terminal
    router.post(
      '/terminal/create',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CreateTerminalSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const terminalId = await this.eventsHandler.createTerminal(parsed.baseDir, parsed.taskId, parsed.cols, parsed.rows);
        res.status(200).json({ terminalId });
      }),
    );

    // Write to terminal
    router.post(
      '/terminal/write',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(WriteToTerminalSchema, req.body, res);
        if (!parsed) {
          return;
        }

        this.eventsHandler.writeToTerminal(parsed.terminalId, parsed.data);
        res.status(200).json({ success: true });
      }),
    );

    // Resize terminal
    router.post(
      '/terminal/resize',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ResizeTerminalSchema, req.body, res);
        if (!parsed) {
          return;
        }

        this.eventsHandler.resizeTerminal(parsed.terminalId, parsed.cols, parsed.rows);
        res.status(200).json({ success: true });
      }),
    );

    // Close terminal
    router.post(
      '/terminal/close',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(CloseTerminalSchema, req.body, res);
        if (!parsed) {
          return;
        }

        this.eventsHandler.closeTerminal(parsed.terminalId);
        res.status(200).json({ success: true });
      }),
    );

    // Get terminal for task
    router.get(
      '/terminal/:taskId',
      this.handleRequest(async (req, res) => {
        const terminalId = this.eventsHandler.getTerminalForTask(req.params.taskId);
        res.status(200).json({ terminalId });
      }),
    );

    // Get all terminals for task
    router.get(
      '/terminal/:taskId/all',
      this.handleRequest(async (req, res) => {
        const terminals = this.eventsHandler.getTerminalsForTask(req.params.taskId);
        res.status(200).json({ terminals });
      }),
    );
  }
}

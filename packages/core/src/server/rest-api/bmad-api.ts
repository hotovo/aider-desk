import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

// Request schemas
const GetStatusSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const InstallSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ResetWorkflowSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const ExecuteWorkflowSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  workflowId: z.string().min(1, 'Workflow ID is required'),
  asSubtask: z.boolean().optional(),
  options: z
    .object({
      resumeFromStep: z.number().optional(),
    })
    .optional(),
});

export class BmadApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get BMAD status
    router.get(
      '/bmad/status',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetStatusSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const status = await this.eventsHandler.getBmadStatus(projectDir);
        res.status(200).json(status);
      }),
    );

    // Install BMAD library
    router.post(
      '/bmad/install',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(InstallSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const result = await this.eventsHandler.installBmad(projectDir);
        res.status(200).json(result);
      }),
    );

    // Execute BMAD workflow
    router.post(
      '/bmad/execute-workflow',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ExecuteWorkflowSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, workflowId, asSubtask } = parsed;
        const result = await this.eventsHandler.executeWorkflow(projectDir, taskId, workflowId, asSubtask);

        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(500).json(result);
        }
      }),
    );

    // Reset BMAD workflow (clear _bmad-output folder)
    router.post(
      '/bmad/reset-workflow',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ResetWorkflowSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const result = await this.eventsHandler.resetBmadWorkflow(projectDir);

        if (result.success) {
          res.status(200).json(result);
        } else {
          res.status(500).json(result);
        }
      }),
    );
  }
}

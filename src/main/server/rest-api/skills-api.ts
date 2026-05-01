import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const GetSkillsSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
});

const ActivateSkillSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  skillName: z.string().min(1, 'Skill name is required'),
});

export class SkillsApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    router.get(
      '/skills',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetSkillsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const skills = await this.eventsHandler.getSkills(projectDir, taskId);
        res.status(200).json(skills);
      }),
    );

    router.post(
      '/skills/activate',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ActivateSkillSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, skillName } = parsed;
        await this.eventsHandler.activateSkill(projectDir, taskId, skillName);
        res.status(200).json({ success: true });
      }),
    );

    router.post(
      '/skills/deactivate',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ActivateSkillSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, skillName } = parsed;
        await this.eventsHandler.deactivateSkill(projectDir, taskId, skillName);
        res.status(200).json({ success: true });
      }),
    );
  }
}

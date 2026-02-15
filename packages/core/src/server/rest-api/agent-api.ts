import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const CreateAgentProfileSchema = z.object({
  profile: z.any(), // AgentProfile schema
  projectDir: z.string().optional(),
});

const UpdateAgentProfileSchema = z.object({
  profile: z.any(), // AgentProfile schema
  baseDir: z.string().optional(),
});

const DeleteAgentProfileSchema = z.object({
  profileId: z.string().min(1, 'Profile ID is required'),
  baseDir: z.string().optional(),
});

const UpdateAgentProfilesOrderSchema = z.object({
  agentProfiles: z.array(z.any()), // AgentProfile array
});

export class AgentApi extends BaseApi {
  constructor(private eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // GET /agent-profiles
    router.get(
      '/agent-profiles',
      this.handleRequest(async (_, res) => {
        const profiles = await this.eventsHandler.getAllAgentProfiles();
        res.json(profiles);
      }),
    );

    // POST /agent-profile/create
    router.post(
      '/agent-profile/create',
      this.handleRequest(async (req, res) => {
        const { profile, projectDir } = CreateAgentProfileSchema.parse(req.body);
        const profiles = await this.eventsHandler.createAgentProfile(profile, projectDir);
        res.json(profiles);
      }),
    );

    // POST /agent-profile/update
    router.post(
      '/agent-profile/update',
      this.handleRequest(async (req, res) => {
        const { profile } = UpdateAgentProfileSchema.parse(req.body);
        const profiles = await this.eventsHandler.updateAgentProfile(profile);
        res.json(profiles);
      }),
    );

    // POST /agent-profile/delete
    router.post(
      '/agent-profile/delete',
      this.handleRequest(async (req, res) => {
        const { profileId } = DeleteAgentProfileSchema.parse(req.body);
        const profiles = await this.eventsHandler.deleteAgentProfile(profileId);
        res.json(profiles);
      }),
    );

    // POST /agent-profiles/order
    router.post(
      '/agent-profiles/order',
      this.handleRequest(async (req, res) => {
        const { agentProfiles } = UpdateAgentProfilesOrderSchema.parse(req.body);
        await this.eventsHandler.updateAgentProfilesOrder(agentProfiles);
        res.json({ success: true });
      }),
    );
  }
}

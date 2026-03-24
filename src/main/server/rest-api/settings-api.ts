import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const SettingsDataSchema = z.any(); // Placeholder - can be refined based on SettingsData type

const GetRecentProjectsSchema = z.object({});

const AddRecentProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const RemoveRecentProjectSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const SetZoomLevelSchema = z.object({
  level: z.number().min(0.5).max(3).step(0.1),
});

const GetVersionsSchema = z.object({
  forceRefresh: z.string().optional(),
});

const DownloadLatestAiderDeskSchema = z.object({});

const GetReleaseNotesSchema = z.object({});

const ClearReleaseNotesSchema = z.object({});

const GetOSSchema = z.object({});

export class SettingsApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get settings
    router.get(
      '/settings',
      this.handleRequest(async (_, res) => {
        const settings = this.eventsHandler.loadSettings();
        res.status(200).json(settings);
      }),
    );

    // Update settings
    router.post(
      '/settings',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SettingsDataSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const settings = await this.eventsHandler.saveSettings(parsed);
        res.status(200).json(settings);
      }),
    );

    // Get recent projects
    router.get(
      '/settings/recent-projects',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetRecentProjectsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const recentProjects = this.eventsHandler.getRecentProjects();
        res.status(200).json(recentProjects);
      }),
    );

    // Add recent project
    router.post(
      '/settings/add-recent-project',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(AddRecentProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        this.eventsHandler.addRecentProject(projectDir);
        res.status(200).json({ message: 'Recent project added' });
      }),
    );

    // Remove recent project
    router.post(
      '/settings/remove-recent-project',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(RemoveRecentProjectSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        this.eventsHandler.removeRecentProject(projectDir);
        res.status(200).json({ message: 'Recent project removed' });
      }),
    );

    // Set zoom level
    router.post(
      '/settings/zoom',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(SetZoomLevelSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { level } = parsed;
        await this.eventsHandler.setZoomLevel(level);
        res.status(200).json({ message: 'Zoom level set' });
      }),
    );

    // Get versions
    router.get(
      '/versions',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetVersionsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { forceRefresh } = parsed;
        const versions = await this.eventsHandler.getVersions(forceRefresh === 'true');
        res.status(200).json(versions);
      }),
    );

    // Download latest AiderDesk
    router.post(
      '/download-latest',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DownloadLatestAiderDeskSchema, req.body, res);
        if (!parsed) {
          return;
        }

        await this.eventsHandler.downloadLatestAiderDesk();
        res.status(200).json({ message: 'Download started' });
      }),
    );

    // Get release notes
    router.get(
      '/release-notes',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetReleaseNotesSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const releaseNotes = this.eventsHandler.getReleaseNotes();
        res.status(200).json({ releaseNotes });
      }),
    );

    // Clear release notes
    router.post(
      '/clear-release-notes',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ClearReleaseNotesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        this.eventsHandler.clearReleaseNotes();
        res.status(200).json({ message: 'Release notes cleared' });
      }),
    );

    // Get OS
    router.get(
      '/os',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetOSSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const os = this.eventsHandler.getOS();
        res.status(200).json({ os });
      }),
    );
  }
}

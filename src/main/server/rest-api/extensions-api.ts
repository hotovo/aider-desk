import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import type { EventsHandler } from '@/events-handler';

const GetInstalledExtensionsSchema = z.object({
  projectDir: z.string().optional(),
});

const GetAvailableExtensionsSchema = z.object({
  repositories: z.string().optional(), // Comma-separated URLs
  forceRefresh: z.coerce.boolean().optional(),
  fetchOnly: z.coerce.boolean().optional(),
});

const InstallExtensionSchema = z.object({
  extensionId: z.string().min(1, 'Extension ID is required'),
  repositoryUrl: z.string().url('Repository URL must be a valid URL'),
  projectDir: z.string().optional(),
});

const UninstallExtensionSchema = z.object({
  extensionId: z.string().min(1, 'Extension ID is required'),
  projectDir: z.string().optional(),
});

const UpdateExtensionSchema = z.object({
  extensionId: z.string().min(1, 'Extension ID is required'),
  repositoryUrl: z.string().url('Repository URL must be a valid URL'),
  projectDir: z.string().optional(),
});

export class ExtensionsApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get installed extensions
    router.get(
      '/extensions',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetInstalledExtensionsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const extensions = this.eventsHandler.getInstalledExtensions(projectDir);
        res.status(200).json(extensions);
      }),
    );

    // Get available extensions from repositories
    router.get(
      '/extensions/available',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetAvailableExtensionsSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const repositories = parsed.repositories ? parsed.repositories.split(',') : [];
        const extensions = await this.eventsHandler.getAvailableExtensions(repositories, parsed.forceRefresh, parsed.fetchOnly);
        res.status(200).json(extensions);
      }),
    );

    // Install extension
    router.post(
      '/extensions/install',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(InstallExtensionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { extensionId, repositoryUrl, projectDir } = parsed;
        const success = await this.eventsHandler.installExtension(extensionId, repositoryUrl, projectDir);

        if (success) {
          res.status(200).json({ message: 'Extension installed successfully', success });
        } else {
          res.status(500).json({ message: 'Failed to install extension', success });
        }
      }),
    );

    // Uninstall extension
    router.post(
      '/extensions/uninstall',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UninstallExtensionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { extensionId, projectDir } = parsed;
        const success = await this.eventsHandler.uninstallExtension(extensionId, projectDir);

        if (success) {
          res.status(200).json({ message: 'Extension uninstalled successfully', success });
        } else {
          res.status(500).json({ message: 'Failed to uninstall extension', success });
        }
      }),
    );

    // Update extension
    router.post(
      '/extensions/update',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateExtensionSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { extensionId, repositoryUrl, projectDir } = parsed;
        const success = await this.eventsHandler.updateExtension(extensionId, repositoryUrl, projectDir);

        if (success) {
          res.status(200).json({ message: 'Extension updated successfully', success });
        } else {
          res.status(500).json({ message: 'Failed to update extension', success });
        }
      }),
    );

    // Get extension UI components
    router.get(
      '/extensions/ui-components',
      this.handleRequest(async (req, res) => {
        const { projectDir, placement, taskId } = req.query as { projectDir?: string; placement?: string; taskId?: string };
        const components = this.eventsHandler.getUIComponents(placement, projectDir, taskId);
        res.status(200).json(components);
      }),
    );

    // Get extension UI component data
    router.get(
      '/extensions/ui-data',
      this.handleRequest(async (req, res) => {
        const { extensionId, componentId, projectDir, taskId } = req.query as {
          extensionId?: string;
          componentId?: string;
          projectDir?: string;
          taskId?: string;
        };

        if (!extensionId || !componentId) {
          res.status(400).json({ message: 'extensionId and componentId are required' });
          return;
        }

        const data = await this.eventsHandler.getUIExtensionData(extensionId, componentId, projectDir, taskId);
        res.status(200).json(data);
      }),
    );

    // Execute extension UI action
    router.post(
      '/extensions/ui-action',
      this.handleRequest(async (req, res) => {
        const { extensionId, componentId, action, args, projectDir, taskId } = req.body as {
          extensionId?: string;
          componentId?: string;
          action?: string;
          args?: unknown[];
          projectDir?: string;
          taskId?: string;
        };

        if (!extensionId || !componentId || !action) {
          res.status(400).json({ message: 'extensionId, componentId, and action are required' });
          return;
        }

        const result = await this.eventsHandler.executeUIExtensionAction(extensionId, componentId, action, args ?? [], projectDir, taskId);
        res.status(200).json(result);
      }),
    );

    // Get extension config component (per-extension settings)
    router.get(
      '/extensions/config-component',
      this.handleRequest(async (req, res) => {
        const { extensionId, projectDir } = req.query as { extensionId?: string; projectDir?: string };
        if (!extensionId) {
          res.status(400).json({ message: 'extensionId is required' });
          return;
        }
        const component = this.eventsHandler.getExtensionConfigComponent(extensionId, projectDir);
        res.status(200).json(component);
      }),
    );

    // Get extension config data
    router.get(
      '/extensions/config',
      this.handleRequest(async (req, res) => {
        const { extensionId, projectDir } = req.query as { extensionId?: string; projectDir?: string };
        if (!extensionId) {
          res.status(400).json({ message: 'extensionId is required' });
          return;
        }
        const config = await this.eventsHandler.getExtensionConfig(extensionId, projectDir);
        res.status(200).json(config);
      }),
    );

    // Save extension config
    router.post(
      '/extensions/config',
      this.handleRequest(async (req, res) => {
        const { extensionId, configData, projectDir } = req.body as {
          extensionId?: string;
          configData: unknown;
          projectDir?: string;
        };
        if (!extensionId) {
          res.status(400).json({ message: 'extensionId is required' });
          return;
        }
        const result = await this.eventsHandler.saveExtensionConfig(extensionId, configData, projectDir);
        res.status(200).json(result);
      }),
    );
  }
}

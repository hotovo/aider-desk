import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import type { ExtensionManager } from '@/extensions/extension-manager';

const GetInstalledExtensionsSchema = z.object({
  projectDir: z.string().optional(),
});

const GetAvailableExtensionsSchema = z.object({
  repositories: z.string().optional(), // Comma-separated URLs
  forceRefresh: z.coerce.boolean().optional(),
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

export class ExtensionsApi extends BaseApi {
  constructor(private readonly extensionManager: ExtensionManager) {
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
        const extensions = this.extensionManager.getExtensions(projectDir);
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
        const extensions = await this.extensionManager.getAvailableExtensions(repositories, parsed.forceRefresh);
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
        const success = await this.extensionManager.installExtension(extensionId, repositoryUrl, projectDir);

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
        const success = await this.extensionManager.uninstallExtension(extensionId, projectDir);

        if (success) {
          res.status(200).json({ message: 'Extension uninstalled successfully', success });
        } else {
          res.status(500).json({ message: 'Failed to uninstall extension', success });
        }
      }),
    );
  }
}

import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';
import { ProjectManager } from '@/project';

const ContextFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  path: z.string().min(1, 'File path is required'),
  readOnly: z.boolean().optional(),
});

const GetContextFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
});

const GetAddableFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  searchRegex: z.string().optional(),
});

export class ContextApi extends BaseApi {
  constructor(
    private readonly projectManager: ProjectManager,
    private readonly eventsHandler: EventsHandler,
  ) {
    super();
  }

  registerRoutes(router: Router): void {
    // Add context file
    router.post(
      '/add-context-file',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ContextFileSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, path, readOnly } = parsed;
        await this.eventsHandler.addFile(projectDir, path, readOnly);
        res.status(200).json({ message: 'File added to context' });
      }),
    );

    // Drop context file
    router.post(
      '/drop-context-file',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ContextFileSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, path } = parsed;
        this.eventsHandler.dropFile(projectDir, path);
        res.status(200).json({ message: 'File dropped from context' });
      }),
    );

    // Get context files
    router.post(
      '/get-context-files',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetContextFilesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir } = parsed;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        const contextFiles = validatedProject.getContextFiles();
        res.status(200).json(contextFiles);
      }),
    );

    // Get addable files
    router.post(
      '/get-addable-files',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetAddableFilesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, searchRegex } = parsed;
        const addableFiles = await this.eventsHandler.getAddableFiles(projectDir, searchRegex);
        res.status(200).json(addableFiles);
      }),
    );
  }
}

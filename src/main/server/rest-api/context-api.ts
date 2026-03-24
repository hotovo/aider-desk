import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';
import { ProjectManager } from '@/project';

const ContextFileSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  path: z.string().min(1, 'File path is required'),
  readOnly: z.boolean().optional(),
});

const GetContextFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
});

const GetAddableFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  searchRegex: z.string().optional(),
});

const GetAllFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  useGit: z.boolean().optional(),
});

const GetUpdatedFilesSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
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

        const { projectDir, taskId, path, readOnly } = parsed;
        await this.eventsHandler.addFile(projectDir, taskId, path, readOnly);
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

        const { projectDir, taskId, path } = parsed;
        this.eventsHandler.dropFile(projectDir, taskId, path);
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

        const { projectDir, taskId } = parsed;
        const project = this.projectManager.getProject(projectDir);
        const validatedProject = this.findProject(project, projectDir, res);
        if (!validatedProject) {
          return;
        }

        const task = validatedProject.getTask(taskId);
        const contextFiles = task ? await task.getContextFiles() : [];
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

        const { projectDir, taskId, searchRegex } = parsed;
        const addableFiles = await this.eventsHandler.getAddableFiles(projectDir, taskId, searchRegex);
        res.status(200).json(addableFiles);
      }),
    );

    router.post(
      '/get-all-files',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetAllFilesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, useGit } = parsed;
        const allFiles = await this.eventsHandler.getAllFiles(projectDir, taskId, useGit);
        res.status(200).json(allFiles);
      }),
    );

    router.post(
      '/get-updated-files',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetUpdatedFilesSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const updatedFiles = await this.eventsHandler.getUpdatedFiles(projectDir, taskId);
        res.status(200).json(updatedFiles);
      }),
    );
  }
}

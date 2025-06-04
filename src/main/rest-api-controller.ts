import { Server } from 'http';

import express, { Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { SERVER_PORT } from 'src/main/constants';
import { Project } from 'src/main/project';
import { delay } from '@common/utils';

import { ProjectManager } from './project-manager';
import logger from './logger';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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

const RunPromptSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  prompt: z.string().min(1, 'Prompt is required'),
  editFormat: z.enum(['code', 'ask', 'architect', 'context']).optional(),
});

export class RestApiController {
  private app = express();
  private isPromptRunning = false;

  constructor(
    private readonly projectManager: ProjectManager,
    private readonly server: Server,
  ) {
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(cors());

    // Set timeout for all requests
    this.app.use((req, res, next) => {
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        res.status(504).json({ error: 'Request timeout' });
      });
      res.setTimeout(REQUEST_TIMEOUT_MS, () => {
        res.status(504).json({ error: 'Response timeout' });
      });
      next();
    });

    this.init();
  }

  private findProject(projectDir: string, res: Response): Project | null {
    const project = this.projectManager.getProject(projectDir);
    if (!project.isStarted()) {
      res.status(403).json({
        error: 'Project not started',
        message: 'Please open the project in AiderDesk first',
      });
      return null;
    }
    return project;
  }

  private setupRoutes(): void {
    // Add context file
    this.app.post('/api/add-context-file', async (req, res) => {
      try {
        logger.debug('REST API: Add context file request received', { body: req.body });
        const result = ContextFileSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, path, readOnly } = result.data;
        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        await project.addFile({ path, readOnly });

        // add delay to allow Aider to verify the added files
        await delay(1000);

        const contextFiles = project.getContextFiles();
        res.status(200).json(contextFiles);
      } catch (error) {
        logger.error('REST API: Error adding context file', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Drop context file
    this.app.post('/api/drop-context-file', async (req, res) => {
      try {
        logger.debug('REST API: Drop context file request received', { body: req.body });
        const result = ContextFileSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, path } = result.data;
        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        project.dropFile(path);

        // add delay to allow Aider to verify the dropped files
        await delay(1000);

        const contextFiles = project.getContextFiles();
        res.status(200).json(contextFiles);
      } catch (error) {
        logger.error('REST API: Error dropping context file', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get context files
    this.app.post('/api/get-context-files', async (req, res) => {
      try {
        logger.debug('REST API: Get context files request received', { body: req.body });
        const result = GetContextFilesSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir } = result.data;

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        // Get context files from project (you'll need to add a getContextFiles method to Project class)
        const contextFiles = project.getContextFiles();
        res.status(200).json(contextFiles);
      } catch (error) {
        logger.error('REST API: Error getting context files', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get addable files
    this.app.post('/api/get-addable-files', async (req, res) => {
      try {
        logger.debug('REST API: Get addable files request received', { body: req.body });
        const result = GetAddableFilesSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, searchRegex } = result.data;

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        const addableFiles = project.getAddableFiles(searchRegex);
        res.status(200).json(addableFiles);
      } catch (error) {
        logger.error('REST API: Error getting addable files', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.app.post('/api/run-prompt', async (req, res) => {
      try {
        logger.debug('REST API: Run prompt request received', { body: req.body });
        // Validate request body
        const result = RunPromptSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const { projectDir, prompt, editFormat } = result.data;

        logger.info('REST API: Run prompt request', { projectDir, editFormat });

        // Check if another prompt is already running
        if (this.isPromptRunning) {
          res.status(429).json({
            error: 'Too many requests',
            message: 'Another prompt is already being processed',
          });
          return;
        }

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        try {
          this.isPromptRunning = true;

          const responses = await project.sendPrompt(prompt, editFormat);

          res.status(200).json(responses);
        } finally {
          // Clear the running flag even if there's an error
          this.isPromptRunning = false;
        }
      } catch (error) {
        logger.error('REST API: Error processing run-prompt request', {
          error,
        });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  private init() {
    this.setupRoutes();

    // The server is already listening from the main process,
    // so we just need to attach our Express app to it
    this.server.on('request', this.app);

    // Get the actual port the server is listening on
    const address = this.server.address();
    const port = typeof address === 'object' && address ? address.port : SERVER_PORT;
    
    logger.info(`REST API routes registered on port ${port}`);
  }

  async close() {
    // nothing for now
  }
}

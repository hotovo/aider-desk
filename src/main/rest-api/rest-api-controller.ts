import { Server } from 'http';

import express, { Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { delay } from '@common/utils';

import logger from '@/logger';
import { EditFormat, Mode } from '@common/types';
import { Project, ProjectManager } from '@/project';
import { Store } from '@/store';
import { SERVER_PORT } from '@/constants';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const UpdateProjectSettingsSchema = z.object({
  mainModel: z.string().optional(),
  weakModel: z.string().optional().nullable(),
  architectModel: z.string().optional().nullable(),
  agentProfileId: z.string().optional(),
  editFormat: z.nativeEnum(EditFormat).optional().nullable(),
  reasoningEffort: z.string().optional(),
  thinkingTokens: z.string().optional(),
  currentMode: z.nativeEnum(Mode).optional(),
  renderMarkdown: z.boolean().optional(),
});

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
    private readonly store: Store,
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
    // Get all projects
    this.app.get('/api/projects', async (req, res) => {
      try {
        logger.debug('REST API: Get all projects request received', { body: req.body });
        const projects = this.store.getOpenProjects();
        res.status(200).json(projects);
      } catch (error) {
        logger.error('REST API: Error getting all projects', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get project models
    this.app.get('/api/projects/:projectDir/models', async (req, res) => {
      try {
        const projectDir = decodeURIComponent(req.params.projectDir);
        logger.debug('REST API: Get project models request received', { projectDir });

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        const models = project.getAiderModels();
        res.status(200).json(models);
      } catch (error) {
        logger.error('REST API: Error getting project models', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Update project settings
    this.app.post('/api/projects/:projectDir/settings', async (req, res) => {
      try {
        const projectDir = decodeURIComponent(req.params.projectDir);
        logger.debug('REST API: Update project settings request received', { projectDir, body: req.body });

        const result = UpdateProjectSettingsSchema.safeParse(req.body);
        if (!result.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: result.error.issues,
          });
          return;
        }

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        const currentSettings = this.store.getProjectSettings(projectDir);
        const newSettings = { ...currentSettings, ...result.data };
        this.store.saveProjectSettings(projectDir, newSettings);

        if (
          currentSettings.mainModel !== newSettings.mainModel ||
          currentSettings.weakModel !== newSettings.weakModel ||
          currentSettings.editFormat !== newSettings.editFormat
        ) {
          project.updateModels(newSettings.mainModel, newSettings.weakModel, newSettings.editFormat || undefined);
        }

        if (currentSettings.architectModel !== newSettings.architectModel) {
          project.setArchitectModel(newSettings.architectModel || '');
        }

        res.status(200).json(newSettings);
      } catch (error) {
        logger.error('REST API: Error updating project settings', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get project messages
    this.app.get('/api/projects/:projectDir/messages', async (req, res) => {
      try {
        const projectDir = decodeURIComponent(req.params.projectDir);
        logger.debug('REST API: Get project messages request received', { projectDir });

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        const messages = project.getContextMessages();
        res.status(200).json(messages);
      } catch (error) {
        logger.error('REST API: Error getting project messages', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // Get project status
    this.app.get('/api/projects/:projectDir/status', async (req, res) => {
      try {
        const projectDir = decodeURIComponent(req.params.projectDir);
        logger.debug('REST API: Get project status request received', { projectDir });

        const project = this.findProject(projectDir, res);
        if (!project) {
          return;
        }

        const settings = this.store.getProjectSettings(projectDir);
        const contextFiles = project.getContextFiles();
        const messages = project.getContextMessages();
        const models = project.getAiderModels();
        const tokensInfo = project.getTokensInfo();

        res.status(200).json({
          settings,
          contextFiles,
          messages,
          models,
          tokensInfo,
        });
      } catch (error) {
        logger.error('REST API: Error getting project status', { error });
        res.status(500).json({
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

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

    logger.info(`REST API routes registered on port ${SERVER_PORT}`);
  }

  async close() {
    // nothing for now
  }
}

import { Server } from 'http';
import { join } from 'path';

import express from 'express';
import cors from 'cors';
import { is } from '@electron-toolkit/utils';

import { ContextApi } from './context-api';
import { PromptApi } from './prompt-api';
import { SettingsApi } from './settings-api';
import { ProjectApi } from './project-api';
import { CommandsApi } from './commands-api';
import { UsageApi } from './usage-api';
import { SystemApi } from './system-api';
import { TodoApi } from './todo-api';
import { McpApi } from './mcp-api';

import { SERVER_PORT } from '@/constants';
import logger from '@/logger';
import { ProjectManager } from '@/project';
import { EventsHandler } from '@/events-handler';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class RestApiController {
  private app = express();

  constructor(
    private readonly server: Server,
    private readonly projectManager: ProjectManager,
    private readonly eventsHandler: EventsHandler,
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

  private setupApiRoutes(): void {
    // Create API router
    const apiRouter = express.Router();

    // Register all API modules
    new ContextApi(this.projectManager, this.eventsHandler).registerRoutes(apiRouter);
    new PromptApi(this.eventsHandler).registerRoutes(apiRouter);
    new SettingsApi(this.eventsHandler).registerRoutes(apiRouter);
    new ProjectApi(this.eventsHandler).registerRoutes(apiRouter);
    new CommandsApi(this.eventsHandler).registerRoutes(apiRouter);
    new UsageApi(this.eventsHandler).registerRoutes(apiRouter);
    new SystemApi(this.eventsHandler).registerRoutes(apiRouter);
    new TodoApi(this.eventsHandler).registerRoutes(apiRouter);
    new McpApi(this.eventsHandler).registerRoutes(apiRouter);

    // Mount the API router globally under /api
    this.app.use('/api', apiRouter);
  }

  private init() {
    this.setupApiRoutes();

    // Serve static renderer files in production (for browser access)
    if (!is.dev) {
      logger.info(`Serving static renderer files on port ${SERVER_PORT}...`);
      this.app.use(express.static(join(__dirname, '../renderer')));
      // Handle SPA routing: serve index.html for non-API routes
      this.app.get('*', (_, res) => {
        res.sendFile(join(__dirname, '../renderer/index.html'));
      });
    }

    // The server is already listening from the main process,
    // so we just need to attach our Express app to it
    this.server.on('request', this.app);

    logger.info(`REST API routes registered on port ${SERVER_PORT}`);
  }

  async close() {
    // nothing for now
  }
}

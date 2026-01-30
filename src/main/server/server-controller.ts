import { Server } from 'http';
import { join } from 'path';

import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';

import {
  AgentApi,
  CommandsApi,
  ContextApi,
  McpApi,
  ProjectApi,
  PromptApi,
  ProvidersApi,
  SettingsApi,
  SystemApi,
  TodoApi,
  UsageApi,
  MemoryApi,
  VoiceApi,
  TerminalApi,
} from '@/server/rest-api';
import { AUTH_PASSWORD, AUTH_USERNAME, SERVER_PORT } from '@/constants';
import logger from '@/logger';
import { ProjectManager } from '@/project';
import { EventsHandler } from '@/events-handler';
import { Store } from '@/store';
import { isDev, isElectron } from '@/app';
import { isBunBinary, createRendererMiddleware } from '@/bun-resources';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class ServerController {
  private readonly app = express();
  private isStarted = false;

  constructor(
    private readonly server: Server,
    private readonly projectManager: ProjectManager,
    private readonly eventsHandler: EventsHandler,
    private readonly store: Store,
  ) {
    this.init();
  }

  private serverGuardMiddleware(_: Request, res: Response, next: NextFunction): void {
    // In headless mode, always allow requests regardless of server.enabled setting
    if (process.env.AIDER_DESK_HEADLESS === 'true' || this.isStarted) {
      next();
    } else {
      res.status(503).json({
        error: 'Server is not started. Enable the server in your AiderDesk -> Settings -> Server.',
      });
    }
  }

  private timeoutMiddleware(req: Request, res: Response, next: NextFunction): void {
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      res.status(504).json({ error: 'Request timeout' });
    });
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
      res.status(504).json({ error: 'Response timeout' });
    });
    next();
  }

  private basicAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    const settings = this.store.getSettings().server;

    // Check if environment variables for auth are provided, which overrides settings
    const useEnvAuth = !!(AUTH_USERNAME && AUTH_PASSWORD);
    if (useEnvAuth) {
      logger.info('Using Basic Auth credentials from environment variables AIDER_DESK_USERNAME and AIDER_DESK_PASSWORD');
    }

    if (useEnvAuth || settings.basicAuth.enabled) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="AiderDesk"');
        res.status(401).send('Authentication required');
        return;
      }

      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
      const [username, password] = credentials.split(':');

      const expectedUsername = useEnvAuth ? (AUTH_USERNAME as string) : settings.basicAuth.username;
      const expectedPassword = useEnvAuth ? (AUTH_PASSWORD as string) : settings.basicAuth.password;

      if (username !== expectedUsername || password !== expectedPassword) {
        res.status(401).send('Invalid credentials');
        return;
      }
    }

    next();
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
    new ProvidersApi(this.eventsHandler).registerRoutes(apiRouter);
    new AgentApi(this.eventsHandler).registerRoutes(apiRouter);
    new MemoryApi(this.eventsHandler).registerRoutes(apiRouter);
    new VoiceApi(this.eventsHandler).registerRoutes(apiRouter);
    new TerminalApi(this.eventsHandler).registerRoutes(apiRouter);

    // Mount the API router globally under /api
    this.app.use('/api', apiRouter);
  }

  private init() {
    // Configure Express
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(cors());

    // Add server guard middleware as the first middleware
    this.app.use(this.serverGuardMiddleware.bind(this));

    // Set timeout for all requests
    this.app.use(this.timeoutMiddleware.bind(this));

    // Add Basic Auth
    this.app.use(this.basicAuthMiddleware.bind(this));

    this.setupApiRoutes();

    // Serve static renderer files in production (for browser access)
    if (!isElectron() || !isDev()) {
      if (isBunBinary()) {
        // Use Bun's embedded renderer middleware with CWD workaround and caching
        // Middleware handles:
        // 1. Serve static files from embedded resources
        // 2. Fall back to index.html for SPA routes (no file extension)
        // 3. Fall through for API routes (handled by API router)
        this.app.use(createRendererMiddleware());
      } else {
        logger.info(`Serving static renderer files on port ${SERVER_PORT}...`, {
          dirname: __dirname,
        });
        this.app.use(express.static(join(__dirname, '../renderer')));
        // Handle SPA routing: serve index.html for non-API routes
        this.app.get('*', (_, res) => {
          res.sendFile(join(__dirname, '../renderer/index.html'));
        });
      }
    }

    logger.debug(`REST API routes registered on port ${SERVER_PORT}`);
    this.server.on('request', this.app);

    this.isStarted = this.store.getSettings().server.enabled;
  }

  async close() {
    // No need to stop server anymore - it's always attached
    this.server.off('request', this.app);
  }

  async startServer() {
    if (this.isStarted) {
      logger.info('Server already started');
      return false;
    }

    this.isStarted = true;
    logger.info('Starting server...');
    return true;
  }

  async stopServer() {
    if (!this.isStarted) {
      logger.info('Server already stopped');
      return false;
    }

    this.isStarted = false;
    logger.info('Server stopped');
    return true;
  }
}

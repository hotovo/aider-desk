import { createServer } from 'http';

import type { BrowserWindow } from 'electron';

import { AgentProfileManager, McpManager } from '@/agent';
import { CloudflareTunnelManager, ServerController } from '@/server';
import { ConnectorManager } from '@/connector';
import { ProjectManager } from '@/project';
import { EventManager } from '@/events';
import { ModelManager } from '@/models';
import { DataManager } from '@/data-manager';
import { TerminalManager } from '@/terminal';
import { VersionsManager } from '@/versions';
import { TelemetryManager } from '@/telemetry';
import { WorktreeManager } from '@/worktrees';
import { MemoryManager } from '@/memory/memory-manager';
import { ExtensionManager } from '@/extensions/extension-manager';
import { Store } from '@/store';
import { SERVER_PORT } from '@/constants';
import logger from '@/logger';
import { EventsHandler } from '@/events-handler';
import { HookManager } from '@/hooks/hook-manager';
import { PromptsManager } from '@/prompts';

export interface ManagersResult {
  eventsHandler: EventsHandler;
  serverController: ServerController;
  cleanup: () => Promise<void>;
  modelManager: ModelManager;
  agentProfileManager: AgentProfileManager;
  extensionManager: ExtensionManager;
}

export const initManagers = async (store: Store, mainWindow: BrowserWindow | null = null): Promise<ManagersResult> => {
  // Initialize telemetry manager
  const telemetryManager = new TelemetryManager(store);
  await telemetryManager.init();

  // Initialize MCP manager
  const mcpManager = new McpManager();
  await mcpManager.init();

  // Initialize event manager (no main window in headless)
  const eventManager = new EventManager(mainWindow);

  // Initialize model manager
  const modelManager = new ModelManager(store, eventManager);

  // Initialize data manager
  const dataManager = new DataManager();
  dataManager.init();

  // Initialize memory manager
  const memoryManager = new MemoryManager(store);
  await memoryManager.init();

  const hookManager = new HookManager();
  await hookManager.init();

  const promptsManager = new PromptsManager();
  await promptsManager.init();

  const worktreeManager = new WorktreeManager();

  // Initialize agent profile manager
  const agentProfileManager = new AgentProfileManager(eventManager);
  await agentProfileManager.start();

  // Create a temporary project manager reference for circular dependency resolution
  // eslint-disable-next-line prefer-const
  let projectManager: ProjectManager;

  // Initialize extension manager with lazy project manager access (non-blocking - errors should not crash app per NFR6)
  const extensionManager = new ExtensionManager(
    store,
    agentProfileManager,
    modelManager,
    // Lazy getter for project manager to resolve circular dependency
    {
      getProjects: () => projectManager.getProjects(),
    } as ProjectManager,
  );

  // Initialize project manager
  projectManager = new ProjectManager(
    store,
    mcpManager,
    telemetryManager,
    dataManager,
    eventManager,
    modelManager,
    worktreeManager,
    agentProfileManager,
    memoryManager,
    hookManager,
    promptsManager,
    extensionManager,
  );

  const extensionInitPromise = extensionManager.init().catch((error) => {
    logger.error('[Extensions] Extension system initialization failed, continuing without extensions:', error);
  });

  // Initialize terminal manager
  const terminalManager = new TerminalManager(eventManager, worktreeManager, telemetryManager);

  // Initialize Versions Manager
  const versionsManager = new VersionsManager(eventManager, store);

  // Create HTTP server
  const httpServer = createServer();

  // Initialize Cloudflare tunnel manager
  const cloudflareTunnelManager = new CloudflareTunnelManager();

  // Initialize events handler (no main window)
  const eventsHandler = new EventsHandler(
    mainWindow,
    projectManager,
    store,
    mcpManager,
    versionsManager,
    modelManager,
    telemetryManager,
    dataManager,
    terminalManager,
    cloudflareTunnelManager,
    eventManager,
    agentProfileManager,
    memoryManager,
  );

  // Create and initialize REST API controller with the server
  const serverController = new ServerController(httpServer, projectManager, eventsHandler, store);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(httpServer, projectManager, eventManager);

  // Wait for extension initialization to complete (but don't block startup)
  await extensionInitPromise;

  // Start listening
  httpServer.listen(SERVER_PORT);
  logger.info(`AiderDesk headless server listening on http://localhost:${SERVER_PORT}`);

  let cleanedUp = false;
  const cleanup = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }

    try {
      cloudflareTunnelManager.stop();
      terminalManager.close();
      versionsManager.destroy();
      dataManager.close();

      await Promise.all([
        connectorManager.close(),
        serverController.close(),
        projectManager.close(),
        mcpManager.close(),
        telemetryManager.destroy(),
        agentProfileManager.dispose(),
        hookManager.dispose(),
        promptsManager.dispose(),
        extensionManager.dispose(),
      ]);
    } catch (error) {
      logger.error('Error during cleanup:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    cleanedUp = true;
  };

  // Handle process signals
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await cleanup();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await cleanup();
    process.exit(0);
  });

  return {
    eventsHandler,
    serverController,
    cleanup,
    modelManager,
    agentProfileManager,
    extensionManager,
  };
};

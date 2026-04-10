import { createServer } from 'http';

import type { WindowManager } from '@/window-manager';

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
import logger, { initEventLogging } from '@/logger';
import { EventsHandler } from '@/events-handler';
import { PromptsManager } from '@/prompts';
import { PythonDependenciesInstaller } from '@/python-dependencies-installer';

export interface ManagersResult {
  eventsHandler: EventsHandler;
  serverController: ServerController;
  cleanup: () => Promise<void>;
  modelManager: ModelManager;
  agentProfileManager: AgentProfileManager;
  extensionManager: ExtensionManager;
  pythonInstaller: PythonDependenciesInstaller;
}

export const initManagers = async (store: Store, windowManager?: WindowManager): Promise<ManagersResult> => {
  // Initialize telemetry manager (non-blocking - analytics not critical for startup)
  const telemetryManager = new TelemetryManager(store);
  telemetryManager.init().catch((error) => {
    logger.error('[Telemetry] Telemetry initialization failed, continuing without analytics:', error);
  });

  // Initialize MCP manager
  const mcpManager = new McpManager();
  mcpManager.init().catch((error) => {
    logger.error('[MCP] MCP manager initialization failed, continuing without MCP:', error);
  });

  // Initialize event manager with window manager
  const eventManager = new EventManager(windowManager);

  // Initialize event-based logging (adds transport to logger)
  initEventLogging(eventManager);

  // Create Python dependencies installer (self-wires status events via EventManager)
  const pythonInstaller = new PythonDependenciesInstaller(eventManager);

  // Initialize model manager
  const modelManager = new ModelManager(store, eventManager);

  // Initialize data manager
  const dataManager = new DataManager();
  dataManager.init();

  // Initialize memory manager (non-blocking - heavy operation with lazy loading)
  const memoryManager = new MemoryManager(store);
  memoryManager.init().catch((error) => {
    logger.error('[Memory] Memory system initialization failed, continuing without memories:', error);
  });

  // Initialize extension manager (non-blocking - errors should not crash app)
  const extensionManager = new ExtensionManager(store, modelManager, eventManager, telemetryManager);
  extensionManager.init().catch((error) => {
    logger.error('[Extensions] Extension system initialization failed, continuing without extensions:', error);
  });

  // Initialize prompts manager (non-blocking - templates compile lazily)
  const promptsManager = new PromptsManager(extensionManager);
  promptsManager.init().catch((error) => {
    logger.error('[Prompts] Prompts system initialization failed:', error);
  });

  const worktreeManager = new WorktreeManager();

  // Initialize agent profile manager with extension manager for unified profile access
  const agentProfileManager = new AgentProfileManager(eventManager, extensionManager);
  agentProfileManager.init().catch((error) => {
    logger.error('[AgentProfile] Agent profile system initialization failed:', error);
  });

  // Initialize project manager
  const projectManager = new ProjectManager(
    store,
    mcpManager,
    telemetryManager,
    dataManager,
    eventManager,
    modelManager,
    worktreeManager,
    agentProfileManager,
    memoryManager,
    promptsManager,
    extensionManager,
    pythonInstaller,
  );

  // Initialize terminal manager
  const terminalManager = new TerminalManager(eventManager, telemetryManager);

  // Initialize Versions Manager
  const versionsManager = new VersionsManager(eventManager, store, pythonInstaller);

  // Create HTTP server
  const httpServer = createServer();

  // Initialize Cloudflare tunnel manager
  const cloudflareTunnelManager = new CloudflareTunnelManager();

  // Initialize events handler with window manager
  const eventsHandler = new EventsHandler(
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
    extensionManager,
    windowManager,
  );

  // Create and initialize REST API controller with the server
  const serverController = new ServerController(httpServer, projectManager, eventsHandler, store);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(httpServer, projectManager, eventManager);

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
    pythonInstaller,
  };
};

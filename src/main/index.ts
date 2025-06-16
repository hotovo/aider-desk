import { join } from 'path';
import { createServer } from 'http';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, shell } from 'electron';
import { McpManager } from 'src/main/agent/mcp-manager';

import icon from '../../resources/icon.png?asset';

import { ProgressWindow } from './progress-window';
import { Agent } from './agent';
import { RestApiController } from './rest-api-controller';
import { ConnectorManager } from './connector-manager';
import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { performStartUp, UpdateProgressData } from './start-up';
import { Store } from './store';
import { VersionsManager } from './versions-manager';
import logger from './logger';
import { TelemetryManager } from './telemetry-manager';
import { ModelInfoManager } from './model-info-manager';

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init();
  return store;
};

const initWindow = async (store: Store): Promise<BrowserWindow> => {
  const lastWindowState = store.getWindowState();
  const mainWindow = new BrowserWindow({
    width: lastWindowState.width,
    height: lastWindowState.height,
    x: lastWindowState.x,
    y: lastWindowState.y,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  const saveWindowState = (): void => {
    const [width, height] = mainWindow.getSize();
    const [x, y] = mainWindow.getPosition();
    store.setWindowState({
      width,
      height,
      x,
      y,
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  // Initialize telemetry manager
  const telemetryManager = new TelemetryManager(store);
  await telemetryManager.init();

  // Initialize MCP manager
  const mcpManager = new McpManager();
  const activeProject = store.getOpenProjects().find((project) => project.active);

  void mcpManager.initMcpConnectors(store.getSettings().mcpServers, activeProject?.baseDir);

  // Initialize model info manager
  const modelInfoManager = new ModelInfoManager();
  void modelInfoManager.init();

  // Initialize agent
  const agent = new Agent(store, mcpManager, modelInfoManager, telemetryManager);

  // Initialize project manager
  const projectManager = new ProjectManager(mainWindow, store, agent, telemetryManager);

  // Create HTTP server
  const httpServer = createServer();

  // Create and initialize REST API controller
  const restApiController = new RestApiController(projectManager, httpServer);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(mainWindow, projectManager, httpServer);

  // Initialize Versions Manager (this also sets up listeners)
  const versionsManager = new VersionsManager(mainWindow, store);

  // Initialize IPC handlers
  setupIpcHandlers(mainWindow, projectManager, store, mcpManager, agent, versionsManager, modelInfoManager, telemetryManager);

  const beforeQuit = async () => {
    await mcpManager.close();
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
    versionsManager.destroy();
    await telemetryManager.destroy();
  };

  app.on('before-quit', beforeQuit);

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await beforeQuit();
    process.exit(0);
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    await mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Apply saved zoom level
  const settings = store.getSettings();
  mainWindow.webContents.setZoomFactor(settings.zoomLevel ?? 1.0);

  return mainWindow;
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.hotovo.aider-desk');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  logger.info('------------ Starting AiderDesk... ------------');
  logger.info('Initializing fix-path...');
  (await import('fix-path')).default();

  const progressBar = new ProgressWindow({
    width: 400,
    icon,
  });
  progressBar.text = 'Starting AiderDesk...';
  progressBar.detail = 'Initializing...';

  await new Promise((resolve) => {
    progressBar.on('ready', () => {
      resolve(null);
    });
  });
  await delay(1000);

  const updateProgress = ({ step, message, progress }: UpdateProgressData) => {
    progressBar.detail = message;
    progressBar.text = step;
    if (progress !== undefined) {
      progressBar.setProgress(progress);
    }
  };

  try {
    await performStartUp(updateProgress);
    progressBar.text = 'Startup complete';
    progressBar.detail = 'Everything is ready! Have fun coding!" - "Booting up UI...';
    progressBar.setCompleted();
  } catch (error) {
    progressBar.close();
    dialog.showErrorBox('Setup Failed', error instanceof Error ? error.message : 'Unknown error occurred during setup');
    app.quit();
    return;
  }

  const store = await initStore();
  await initWindow(store);

  progressBar.close();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0 && store) {
      void initWindow(store);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('exit', () => {
  app.quit();
});

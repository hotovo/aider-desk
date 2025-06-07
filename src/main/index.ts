import { join } from 'path';
import { createServer } from 'http';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, shell } from 'electron';
import ProgressBar from 'electron-progressbar';
import { McpManager } from 'src/main/agent/mcp-manager';

import icon from '../../resources/icon.png?asset';

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
import { ThemesManager } from './themes-manager';

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init();
  return store;
};

const initWindow = async (store: Store) => {
  const lastWindowState = store.getWindowState();
  const mainWindow = new BrowserWindow({
    width: lastWindowState.width,
    height: lastWindowState.height,
    x: lastWindowState.x,
    y: lastWindowState.y,
    show: false,
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 10, y: 10 },
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

  const telemetryManager = new TelemetryManager(store);
  await telemetryManager.init();

  const mcpManager = new McpManager();
  const activeProject = store.getOpenProjects().find((project) => project.active);

  void mcpManager.initMcpConnectors(store.getSettings().mcpServers, activeProject?.baseDir);

  const modelInfoManager = new ModelInfoManager();
  void modelInfoManager.init();

  const agent = new Agent(store, mcpManager, modelInfoManager, telemetryManager);

  // Initialize project manager
  const projectManager = new ProjectManager(mainWindow, store, agent, telemetryManager);

  // Create HTTP server
  const httpServer = createServer();

  // Create and initialize REST API controller
  const restApiController = new RestApiController(projectManager, httpServer);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(mainWindow, projectManager, httpServer);
  await connectorManager.init(httpServer);

  // Initialize Versions Manager (this also sets up listeners)
  const versionsManager = new VersionsManager(mainWindow, store);
  
  // Initialize Themes Manager
  const themesManager = new ThemesManager();

  setupIpcHandlers(mainWindow, projectManager, store, mcpManager, agent, versionsManager, modelInfoManager, telemetryManager, themesManager);

  const beforeQuit = async () => {
    try {
      await mcpManager.close();
      await restApiController.close();
      await connectorManager.close();
      await projectManager.close();
      versionsManager.destroy();
      await telemetryManager.destroy();
      
      // Close Winston logger transports to prevent EPIPE errors
      logger.close();
    } catch (error) {
      // Silently ignore errors during shutdown to prevent EPIPE issues
      console.error('Error during shutdown:', error);
    }
  };

  app.on('before-quit', beforeQuit);

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await beforeQuit();
    process.exit(0);
  });
  
  // Handle SIGTERM
  process.on('SIGTERM', async () => {
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

  logger.info('Initializing fix-path...');
  (await import('fix-path')).default();

  const progressBar = new ProgressBar({
    text: 'Starting AiderDesk...',
    detail: 'Initializing...',
    closeOnComplete: false,
    indeterminate: true,
    style: {
      text: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#f1f3f5',
      },
      detail: {
        fontSize: '12px',
        color: '#adb5bd',
      },
      bar: {
        height: '16px',
        borderRadius: '4px',
        backgroundColor: '#1c2025',
      },
      value: {
        backgroundColor: '#1c2025',
        borderRadius: '4px',
      },
    },
    browserWindow: {
      width: 400,
      icon,
      backgroundColor: '#1c2025',
      webPreferences: {
        nodeIntegration: true,
      },
    },
  });

  await new Promise((resolve) => {
    progressBar.on('ready', () => {
      resolve(null);
    });
  });
  await delay(1000);

  const updateProgress = ({ step, message }: UpdateProgressData) => {
    progressBar.detail = message;
    progressBar.text = step;
  };

  try {
    await performStartUp(updateProgress);
    updateProgress({
      step: 'Startup complete',
      message: 'Everything is ready! Have fun coding!',
    });
    progressBar.setCompleted();
    await delay(1000);
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
    if (BrowserWindow.getAllWindows().length === 0) {
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

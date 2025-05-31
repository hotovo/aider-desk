import { join } from 'path';
import { createServer } from 'http';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, shell } from 'electron';
import ProgressBar from 'electron-progressbar';
import { PostHog } from 'posthog-node';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { McpManager } from 'src/main/agent/mcp-manager';

import icon from '../../resources/icon.png?asset';

import { Agent } from './agent';
import { RestApiController } from './rest-api-controller';
import { ConnectorManager } from './connector-manager';
import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { performStartUp, UpdateProgressData } from './start-up';
import { Store, SettingsData } from './store'; // Modified import
import { VersionsManager } from './versions-manager';
import logger from './logger';

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

  const mcpManager = new McpManager();
  const activeProject = store.getOpenProjects().find((project) => project.active);

  void mcpManager.initMcpConnectors(store.getSettings().mcpServers, activeProject?.baseDir);

  const agent = new Agent(store, mcpManager);

  // Initialize project manager
  const projectManager = new ProjectManager(mainWindow, store, agent);

  // Create HTTP server
  const httpServer = createServer();

  // Create and initialize REST API controller
  const restApiController = new RestApiController(projectManager, httpServer);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(mainWindow, projectManager, httpServer);

  // Initialize Versions Manager (this also sets up listeners)
  const versionsManager = new VersionsManager(mainWindow, store);

  setupIpcHandlers(mainWindow, projectManager, store, mcpManager, agent, versionsManager);

  const beforeQuit = async () => {
    await mcpManager.close();
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
    versionsManager.destroy();
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
export let posthog: PostHog | null = null; // Keep this export

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

  // PostHog Initialization based on settings
  let settings = store.getSettings();
  let distinctId = settings.distinctId;

  if (!distinctId) {
    distinctId = uuidv4();
    settings = { ...settings, distinctId };
    store.saveSettings(settings);
  }

  if (settings.posthog?.enabled && settings.posthog?.apiKey) {
    posthog = new PostHog(settings.posthog.apiKey, {
      host: settings.posthog.host || 'https://app.posthog.com',
    });

    posthog.capture({
      distinctId,
      event: 'application_startup',
    });

    // Assign to a local variable before using in the event handler
    const phInstance = posthog;
    app.on('will-quit', async () => {
      if (phInstance) {
        await phInstance.shutdownAsync();
      }
    });
  } else {
    logger.info('PostHog telemetry is disabled or API key is not provided.');
  }

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

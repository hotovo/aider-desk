import { join } from 'path';
import { createServer } from 'http';

import { delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, shell } from 'electron';
import ProgressBar from 'electron-progressbar';

import icon from '../../resources/icon.png?asset';

import { Agent } from './agent';
import { RestApiController } from './rest-api-controller';
import { checkForUpdates, setupAutoUpdater } from './auto-updater';
import { ConnectorManager } from './connector-manager';
import { setupIpcHandlers } from './ipc-handlers';
import { ProjectManager } from './project-manager';
import { performStartUp, UpdateProgressData } from './start-up';
import { Store } from './store';

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init();
  return store;
};

const initWindow = (store: Store) => {
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

  const agent = new Agent(store);
  void agent.initMcpServers();

  // Initialize project manager
  const projectManager = new ProjectManager(mainWindow, store, agent);

  // Create HTTP server
  const httpServer = createServer();

  // Create and initialize REST API controller
  const restApiController = new RestApiController(projectManager, httpServer);

  // Initialize connector manager with the server
  const connectorManager = new ConnectorManager(mainWindow, projectManager, httpServer);

  setupIpcHandlers(mainWindow, projectManager, store, agent);

  app.on('before-quit', async () => {
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
  });

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await restApiController.close();
    await connectorManager.close();
    await projectManager.close();
    process.exit(0);
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
};

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.hotovo.aider-desk');

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  if (!is.dev && process.env.AIDER_DESK_NO_AUTO_UPDATE !== 'true') {
    setupAutoUpdater();
    await checkForUpdates();
  }

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
  initWindow(store);

  progressBar.close();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      initWindow(store);
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

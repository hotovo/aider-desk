import { join } from 'path';
import { existsSync, statSync } from 'fs';

import { compareBaseDirs, delay } from '@common/utils';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, Menu, session, shell } from 'electron';

import icon from '../../resources/icon.png?asset';

import { AIDER_DESK_DATA_DIR, HEADLESS_MODE } from '@/constants';
import { ProgressWindow } from '@/progress-window';
import { setupIpcHandlers } from '@/ipc-handlers';
import { performStartUp, UpdateProgressData } from '@/start-up';
import { Store } from '@/store';
import logger from '@/logger';
import { initManagers } from '@/managers';
import { getDefaultProjectSettings } from '@/utils';

const setupCustomMenu = (): void => {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    // File menu
    {
      label: 'File',
      submenu: [{ role: 'quit', label: 'Quit', accelerator: 'CmdOrCtrl+Q' }],
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'selectAll', label: 'Select All' },
      ],
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Reset Zoom' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
      ],
    },
    // Settings menu
    {
      label: 'Settings',
      submenu: [
        {
          label: 'General',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 'general');
          },
        },
        {
          label: 'Aider',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 'aider');
          },
        },
        {
          label: 'Agent',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 'agents');
          },
        },
        {
          label: 'Server',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 'server');
          },
        },
        {
          label: 'About',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('open-settings', 'about');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
};

const initStore = async (): Promise<Store> => {
  const store = new Store();
  await store.init(AIDER_DESK_DATA_DIR);

  const args = process.argv.slice(app.isPackaged ? 1 : 2);
  if (args.length > 0) {
    const potentialDir = args[args.length - 1];
    try {
      const absolutePath = join(process.cwd(), potentialDir);
      if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
        const normalizedDir = absolutePath;
        const projectOpened = store.getOpenProjects().some((project) => compareBaseDirs(project.baseDir, normalizedDir));

        if (!projectOpened) {
          store.setOpenProjects([
            ...store.getOpenProjects().map((project) => ({ ...project, active: false })),
            {
              baseDir: normalizedDir,
              active: true,
              settings: getDefaultProjectSettings(store, [], normalizedDir),
            },
          ]);
        } else {
          store.setOpenProjects(
            store.getOpenProjects().map((project) => ({
              ...project,
              active: compareBaseDirs(project.baseDir, normalizedDir),
            })),
          );
        }
      } else {
        logger.warn(`Provided path is not a directory: ${potentialDir}`);
      }
    } catch (error) {
      logger.error(`Error checking directory path: ${(error as Error).message}`);
    }
  }

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
    if (lastWindowState.isMaximized) {
      mainWindow.maximize();
    }
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('context-menu', (_event, params) => {
    mainWindow.webContents.send('context-menu', params);
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

  const { eventsHandler, serverController, cleanup, extensionManager } = await initManagers(store, mainWindow);

  let cleanedUp = false;
  const beforeQuit = async (event?: Electron.Event) => {
    if (cleanedUp) {
      return;
    }

    event?.preventDefault();

    try {
      await cleanup();
    } catch (error) {
      logger.error('Error during cleanup:', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    cleanedUp = true;
    app.quit();
  };

  app.on('before-quit', beforeQuit);

  // Handle CTRL+C (SIGINT)
  process.on('SIGINT', async () => {
    await beforeQuit();
    process.exit(0);
  });

  if (process.platform === 'darwin') {
    // Allow renderer getUserMedia() microphone access.
    // Without this, Electron may never surface the macOS TCC permission prompt and the mic stays unavailable.
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      if (permission === 'media') {
        callback(true);
        return;
      }

      callback(false);
    });
  }

  // Initialize IPC handlers
  setupIpcHandlers(eventsHandler, serverController, extensionManager);

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

  if (settings.fontSize) {
    mainWindow.webContents.on('did-finish-load', () => {
      mainWindow.webContents.insertCSS(`:root { --font-size: ${settings.fontSize}px !important; }`);
    });
  }

  return mainWindow;
};

app.whenReady().then(async () => {
  try {
    electronApp.setAppUserModelId('com.hotovo.aider-desk');

    if (!HEADLESS_MODE) {
      // Setup custom menu only in GUI mode
      setupCustomMenu();

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window);
      });
    }

    logger.info('------------ Starting AiderDesk... ------------');
    logger.info('Initializing fix-path...');
    (await import('fix-path')).default();

    let progressBar: ProgressWindow | null = null;
    let updateProgress: ((data: UpdateProgressData) => void) | null;

    if (!HEADLESS_MODE) {
      progressBar = new ProgressWindow({
        width: 400,
        icon,
      });
      progressBar.title = 'Starting AiderDesk...';
      progressBar.setDetail('Initializing core components...');

      await new Promise((resolve) => {
        progressBar?.on('ready', () => {
          resolve(null);
        });
      });
      await delay(1000);

      updateProgress = ({ step, message, info, progress }: UpdateProgressData) => {
        progressBar!.title = step;
        progressBar!.setDetail(message, info);
        if (progress !== undefined) {
          progressBar!.setProgress(progress);
        }
      };
    } else {
      logger.info('Starting in headless mode...');
      // In headless mode, use a no-op updateProgress
      updateProgress = () => {};
    }

    try {
      await performStartUp(updateProgress);
      if (progressBar) {
        progressBar.title = 'Startup complete';
        progressBar.setDetail('Everything is ready! Have fun coding!', 'Booting up UI...');
        progressBar.setCompleted();
      }
    } catch (error) {
      if (progressBar) {
        progressBar?.close();
      }
      dialog.showErrorBox('Setup Failed', error instanceof Error ? error.message : 'Unknown error occurred during setup');
      app.quit();
      return;
    }

    const store = await initStore();

    if (HEADLESS_MODE) {
      // Initialize managers without window in headless mode
      await initManagers(store, null);
    } else {
      await initWindow(store);
      progressBar?.close();

      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0 && store) {
          void initWindow(store);
        }
      });
    }
  } catch (error) {
    logger.error('Failed to start AiderDesk:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (!HEADLESS_MODE) {
    app.quit();
  }
});

process.on('exit', () => {
  app.quit();
});

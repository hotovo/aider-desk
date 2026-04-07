import { join } from 'path';
import { existsSync, statSync } from 'fs';

import { compareBaseDirs, delay } from '@common/utils';
import { ContextMenuParams } from '@common/types';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { app, BrowserWindow, dialog, Menu, session, shell } from 'electron';

import icon from '../../resources/icon.png?asset';
import splashImage from '../../build/splash.mp4?asset';

import { AIDER_DESK_DATA_DIR, HEADLESS_MODE } from '@/constants';
import { ProgressWindow } from '@/progress-window';
import { setupIpcHandlers } from '@/ipc-handlers';
import { performStartUp, UpdateProgressData } from '@/start-up';
import { Store } from '@/store';
import logger, { eventTransport } from '@/logger';
import { initManagers } from '@/managers';
import { getDefaultProjectSettings } from '@/utils';
import { WindowManager } from '@/window-manager';

// Global instances shared across all windows
let windowManager: WindowManager;
let store: Store;

const setupCustomMenu = (createWindowFn: () => void): void => {
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: createWindowFn,
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit', accelerator: 'CmdOrCtrl+Q' },
      ],
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
        { type: 'separator' },
        {
          label: 'Show Logs',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'logs');
          },
        },
      ],
    },
    // Settings menu
    {
      label: 'Settings',
      submenu: [
        {
          label: 'General',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'settings/general');
          },
        },
        {
          label: 'Aider',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'settings/aider');
          },
        },
        {
          label: 'Agent',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'settings/agents');
          },
        },
        {
          label: 'Server',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'settings/server');
          },
        },
        {
          label: 'About',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('show-view', 'settings/about');
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

const initWindow = async (windowMgr: WindowManager, storeInstance: Store, projectToActivate?: string): Promise<BrowserWindow> => {
  const lastWindowState = storeInstance.getWindowState();

  // Calculate position - offset from focused window if exists
  const focusedWindow = BrowserWindow.getFocusedWindow();
  let x = lastWindowState.x;
  let y = lastWindowState.y;

  if (focusedWindow && !focusedWindow.isDestroyed()) {
    const [focusedX, focusedY] = focusedWindow.getPosition();
    x = focusedX + 30;
    y = focusedY + 30;
  }

  const newWindow = new BrowserWindow({
    width: lastWindowState.width,
    height: lastWindowState.height,
    x,
    y,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      webviewTag: true,
    },
  });

  // Register window with window manager
  windowMgr.addWindow(newWindow);

  newWindow.on('ready-to-show', () => {
    newWindow.show();
    if (lastWindowState.isMaximized && windowMgr.isMainWindow(newWindow)) {
      newWindow.maximize();
    }
  });

  newWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  newWindow.webContents.on('context-menu', (_event, params) => {
    const contextMenuParams: ContextMenuParams = {
      x: params.x,
      y: params.y,
      selectionText: params.selectionText,
      isEditable: params.isEditable,
    };
    newWindow.webContents.send('context-menu', contextMenuParams);
  });

  const saveWindowState = (): void => {
    // Only save state if this is the main window
    if (!windowMgr.isMainWindow(newWindow)) {
      return;
    }

    const [width, height] = newWindow.getSize();
    const [x, y] = newWindow.getPosition();
    storeInstance.setWindowState({
      width,
      height,
      x,
      y,
      isMaximized: newWindow.isMaximized(),
    });
  };

  newWindow.on('resize', saveWindowState);
  newWindow.on('move', saveWindowState);
  newWindow.on('maximize', saveWindowState);
  newWindow.on('unmaximize', saveWindowState);

  // Handle window close
  newWindow.on('closed', () => {
    windowMgr.removeWindow(newWindow);
  });

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    let url = process.env['ELECTRON_RENDERER_URL'];
    // For HashRouter, query params must come after the hash: #/home?project=...
    if (projectToActivate) {
      url += `#/home?project=${encodeURIComponent(projectToActivate)}`;
    }
    await newWindow.loadURL(url);
  } else {
    // For production with HashRouter, append hash with query params
    let url = `file://${join(__dirname, '../renderer/index.html')}`;
    if (projectToActivate) {
      url += `#/home?project=${encodeURIComponent(projectToActivate)}`;
    }
    await newWindow.loadURL(url);
  }

  // Apply saved zoom level
  const settings = storeInstance.getSettings();
  newWindow.webContents.setZoomFactor(settings.zoomLevel ?? 1.0);

  if (settings.fontSize) {
    newWindow.webContents.on('did-finish-load', () => {
      newWindow.webContents.insertCSS(`:root { --font-size: ${settings.fontSize}px !important; }`);
    });
  }

  return newWindow;
};

// Function to create a new window
const createNewWindow = async (projectToActivate?: string) => {
  if (!store || !windowManager) {
    logger.error('Cannot create window: store or windowManager not initialized');
    return;
  }
  await initWindow(windowManager, store, projectToActivate);
};

// Export getter for IPC handlers
export const getCreateNewWindow = () => createNewWindow;

app.whenReady().then(async () => {
  try {
    electronApp.setAppUserModelId('com.hotovo.aider-desk');

    if (!HEADLESS_MODE) {
      // Setup custom menu only in GUI mode - pass createNewWindow function
      setupCustomMenu(() => void createNewWindow());

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
        icon,
        splashImage,
      });
      progressBar.setDetail('Launching AiderDesk...');

      await new Promise((resolve) => {
        progressBar?.on('ready', () => {
          resolve(null);
        });
      });
      await delay(1000);

      updateProgress = ({ message }: UpdateProgressData) => {
        progressBar!.setDetail(message);
      };

      // Forward logger.info messages to splash screen
      eventTransport.setSplashLogCallback((msg: string) => {
        progressBar!.addLog(msg);
      });
    } else {
      logger.info('Starting in headless mode...');
      // In headless mode, use a no-op updateProgress
      updateProgress = () => {};
    }

    // Initialize store globally
    store = await initStore();

    // Initialize window manager
    windowManager = new WindowManager();

    // Initialize managers (shared across all windows) — creates pythonInstaller
    const managers = await initManagers(store, windowManager);

    try {
      // performStartUp is now non-blocking — it kicks off background installation
      // and returns immediately. The progress bar acts as a splash screen.
      await performStartUp(managers.pythonInstaller, updateProgress);

      if (progressBar) {
        progressBar.setDetail('Starting up...');
      }
    } catch (error) {
      // performStartUp no longer throws for install errors (handled async)
      // but guard against unexpected issues
      logger.error('Unexpected error during startup', { error });
      if (progressBar) {
        eventTransport.clearSplashLogCallback();
        progressBar?.close();
      }
      dialog.showErrorBox('Startup Error', error instanceof Error ? error.message : 'Unknown error occurred during startup');
      app.quit();
      return;
    }

    // Setup global cleanup
    const globalCleanup = async () => {
      try {
        await managers.cleanup();
      } catch (error) {
        logger.error('Error during cleanup:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    app.on('before-quit', async (event) => {
      event.preventDefault();
      await globalCleanup();
      app.exit(0);
    });

    // Handle CTRL+C (SIGINT)
    process.on('SIGINT', async () => {
      await globalCleanup();
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
    setupIpcHandlers(managers.eventsHandler, managers.serverController, managers.pythonInstaller);

    if (!HEADLESS_MODE) {
      // Create the first window
      // Create the first window
      await createNewWindow();

      // Show ready state before closing
      if (progressBar) {
        progressBar.setDetail('Everything is ready. Happy coding!');
        progressBar.setCompleted();
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Stop forwarding logs to splash before closing
      eventTransport.clearSplashLogCallback();
      progressBar?.close();

      app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) {
          void createNewWindow();
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

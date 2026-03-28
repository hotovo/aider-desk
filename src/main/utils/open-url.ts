import { execSync } from 'child_process';
import { join } from 'path';
import os from 'os';

import { isElectron } from '@/app';
import logger from '@/logger';

/**
 * Opens a URL either in external browser or a new BrowserWindow.
 * In Node/Docker environments, 'window' falls back to external with a warning.
 *
 * @param url - URL to open
 * @param target - Where to open: 'external' (system browser) or 'window' (new Electron window)
 */
export const openUrl = async (url: string, target: 'external' | 'window' = 'window'): Promise<Electron.BrowserWindow | null> => {
  logger.debug(`[openUrl] Opening URL: ${url} (position: ${target})`);

  if (isElectron()) {
    const { shell, BrowserWindow } = await import('electron');

    if (target === 'window') {
      try {
        const win = new BrowserWindow({
          width: 1200,
          height: 800,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        });
        win.removeMenu();
        win.maximize();

        // If URL starts with #/, it's an internal app route
        let loadUrl = url;
        if (url.startsWith('#/')) {
          loadUrl = process.env['ELECTRON_RENDERER_URL']
            ? `${process.env['ELECTRON_RENDERER_URL']}${url}`
            : `file://${join(__dirname, '../renderer/index.html')}${url}`;
        }

        await win.loadURL(loadUrl);
        return win;
      } catch (error) {
        logger.error('[openUrl] Failed to create BrowserWindow:', error);
        throw error;
      }
    } else {
      await shell.openExternal(url);
      return null;
    }
  } else {
    if (target === 'window') {
      logger.warn('[openUrl] Opening URL in window not supported in headless mode, opening externally');
    }
    openInExternalBrowser(url);
    return null;
  }
};

/**
 * Opens a URL in the system's default browser using platform-specific commands.
 * Works in Node.js environments without Electron.
 */
const openInExternalBrowser = (url: string): void => {
  try {
    const browser = process.env.PLANNOTATOR_BROWSER || process.env.BROWSER;
    const platform = process.platform;
    const wsl = platform === 'linux' && os.release().toLowerCase().includes('microsoft');

    if (browser) {
      if (process.env.PLANNOTATOR_BROWSER && platform === 'darwin') {
        execSync(`open -a ${JSON.stringify(browser)} ${JSON.stringify(url)}`, { stdio: 'ignore' });
      } else if (platform === 'win32' || wsl) {
        execSync(`cmd.exe /c start "" ${JSON.stringify(browser)} ${JSON.stringify(url)}`, { stdio: 'ignore' });
      } else {
        execSync(`${JSON.stringify(browser)} ${JSON.stringify(url)}`, { stdio: 'ignore' });
      }
    } else if (platform === 'win32' || wsl) {
      execSync(`cmd.exe /c start "" ${JSON.stringify(url)}`, { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync(`open ${JSON.stringify(url)}`, { stdio: 'ignore' });
    } else {
      execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: 'ignore' });
    }
  } catch (error) {
    logger.error('[openUrl] Failed to open URL in external browser:', error);
    throw error;
  }
};

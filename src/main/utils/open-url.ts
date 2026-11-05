import { execSync } from 'child_process';
import { join } from 'path';
import os from 'os';

import icon from '../../../resources/icon.png?asset';

import { isElectron } from '@/app';
import logger from '@/logger';

/**
 * Placeholder written in place of a redacted token value.
 */
export const REDACTED_TOKEN_PLACEHOLDER = '<redacted>';

/**
 * Redacts token credentials from a URL for logging purposes.
 *
 * Some URLs carry secrets in their token parameter (e.g. an out-of-band
 * `#token=...` fragment in a review URL) that must never be persisted in
 * logs. Only the token VALUE is masked — host, path, other query parameters
 * and the parameter itself are preserved. Use the original URL for navigation;
 * use this only when writing the URL to a log.
 */
export const redactUrlToken = (url: string): string => url.replace(/([?#&]token=)[^&#]*/gi, `$1${REDACTED_TOKEN_PLACEHOLDER}`);

/**
 * Opens a URL either in external browser or a new BrowserWindow.
 * In Node/Docker environments, 'window' falls back to external with a warning.
 *
 * @param url - URL to open
 * @param target - Where to open: 'external' (system browser) or 'window' (new Electron window)
 * @param title - Window title (only used when opening in a new window)
 */
export const openUrl = async (url: string, target: 'external' | 'window' = 'window', title?: string): Promise<Electron.BrowserWindow | null> => {
  // Log the sanitized URL only — the secret-bearing token value (if any) must
  // not be persisted. The original URL is used for the actual navigation below.
  logger.debug(`[openUrl] Opening URL: ${redactUrlToken(url)} (position: ${target})`);

  if (isElectron()) {
    const { shell, BrowserWindow } = await import('electron');

    if (target === 'window') {
      try {
        const win = new BrowserWindow({
          width: 1200,
          height: 800,
          title: title || 'AiderDesk',
          icon,
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
        // Chromium/loadURL failure messages embed the requested URL —
        // including the secret-bearing token fragment (e.g.
        // 'Error: ERR_FAILED (http://localhost:41475/#token=SECRET)') — so
        // only the redacted message may reach the logger. Never log the raw
        // error object. The original error still propagates to the caller.
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[openUrl] Failed to create BrowserWindow: ${redactUrlToken(message)}`);
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
    const browser = process.env.BROWSER;
    const platform = process.platform;
    const wsl = platform === 'linux' && os.release().toLowerCase().includes('microsoft');

    if (browser) {
      if (platform === 'darwin') {
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
    // execSync error messages embed the full command — including the raw
    // token-bearing URL (e.g. 'Command failed: "xdg-open"
    // "http://localhost:41475/#token=SECRET"') — so the message must be
    // redacted before it reaches the logger. Never log the raw error object.
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[openUrl] Failed to open URL in external browser: ${redactUrlToken(message)}`);
    throw error;
  }
};

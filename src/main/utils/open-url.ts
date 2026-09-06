import { execFileSync, spawnSync } from 'child_process';
import { join } from 'path';
import os from 'os';

import icon from '../../../resources/icon.png?asset';

import { isElectron } from '@/app';
import logger from '@/logger';

/**
 * Credential-like query parameters: names whose values must never reach the
 * log files. Redaction is name-based (case-insensitive) and bounded to the
 * `=`-terminated name, so ordinary parameters (e.g. `sort=key`, `q=auth`) are
 * left untouched.
 */
const CREDENTIAL_QUERY_PARAMS = /([?&#])(token|key|auth|secret|password|passwd|api_?key|access_?token|refresh_?token|id_?token|client_?secret)=[^&#]*/gi;

/**
 * Redacts credentials (extension-provided URLs commonly carry unguessable auth
 * tokens such as a `?token=...` review-server token): userinfo
 * (`user:pass@host`, including the token-as-username basic-auth idiom) and
 * credential-like query parameters in both the query string and `#` fragment,
 * across repeated occurrences and any letter case, so they never reach the log
 * files. The actual URL dispatch must always receive the raw, unmodified URL.
 */
export const redactTokenQueryParam = (url: string): string =>
  url
    // userinfo: keep the scheme, drop the credentials entirely.
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/?#@\]]*@/gi, '$1<hidden>@')
    // credential-like query/fragment parameters: keep the name, hide the value.
    .replace(CREDENTIAL_QUERY_PARAMS, '$1$2=<hidden>');

/**
 * Stringifies an error for logging with token-bearing URL fragments redacted.
 * Child-process errors (e.g. a failed browser dispatch) embed the full command
 * (program + arguments) including the raw URL, so success-path redaction alone
 * is not enough on failure paths. Only the log string is redacted — rethrown
 * errors and dispatched URLs always stay untouched.
 */
export const redactErrorForLog = (error: unknown): string => redactTokenQueryParam(error instanceof Error ? error.message : String(error));

/**
 * Opens a URL either in external browser or a new BrowserWindow.
 * In Node/Docker environments, 'window' falls back to external with a warning.
 *
 * @param url - URL to open
 * @param target - Where to open: 'external' (system browser) or 'window' (new Electron window)
 * @param title - Window title (only used when opening in a new window)
 */
export const openUrl = async (url: string, target: 'external' | 'window' = 'window', title?: string): Promise<Electron.BrowserWindow | null> => {
  logger.debug(`[openUrl] Opening URL: ${redactTokenQueryParam(url)} (position: ${target})`);

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
        // The error message may embed the raw, token-bearing URL (e.g. from a
        // failed loadURL) — redact only what reaches the log.
        logger.error('[openUrl] Failed to create BrowserWindow:', redactErrorForLog(error));
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
 * Quotes a value for the `cmd.exe /c start "" <browser> <url>` command line.
 * Each argument is embedded as one double-quoted string, so cmd metacharacters
 * that appear inside a URL (`&`, `|`, `(`, `)`, `^`) stay literal arguments to
 * `start` instead of command separators. Double quotes never occur in valid
 * URLs and would break the quoting — they are stripped from the cmd-line value
 * only. Residual cmd quirk: `%VAR%`-shaped spans inside a URL could be expanded
 * as environment variables by cmd (documented platform limitation).
 */
const cmdQuote = (value: string): string => `"${value.replace(/"/g, '')}"`;

/**
 * Opens a URL in the system's default browser using platform-specific commands.
 * Works in Node.js environments without Electron.
 *
 * Dispatch is argument-array based (`execFileSync` with no shell), so shells
 * and shell-style substitution in the URL or browser path (`$(...)`,
 * backticks, `;`, pipes) are never interpreted — the URL reaches the browser
 * opener as a single raw argv element. The only exception is the Windows/WSL
 * path: `cmd.exe /c start` is itself a shell, so its arguments are
 * pre-quoted via cmdQuote (+ windowsVerbatimArguments, which joins the argv
 * array verbatim) as defense in depth.
 */
const openInExternalBrowser = (url: string): void => {
  try {
    const browser = process.env.AIDER_DESK_BROWSER || process.env.BROWSER;
    const platform = process.platform;
    const wsl = platform === 'linux' && os.release().toLowerCase().includes('microsoft');

    if (platform === 'win32' || wsl) {
      // `start` treats the first quoted argument as the window title, hence the
      // empty `""` placeholder; the optional browser path follows second.
      spawnSync('cmd.exe', ['/d', '/s', '/c', 'start', '', ...(browser ? [cmdQuote(browser)] : []), cmdQuote(url)], {
        stdio: 'ignore',
        windowsVerbatimArguments: true,
      });
    } else if (browser && process.env.AIDER_DESK_BROWSER && platform === 'darwin') {
      execFileSync('open', ['-a', browser, url], { stdio: 'ignore' });
    } else if (browser) {
      // Browser binary and URL are separate argv entries — never a shell string.
      execFileSync(browser, [url], { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execFileSync('open', [url], { stdio: 'ignore' });
    } else {
      execFileSync('xdg-open', [url], { stdio: 'ignore' });
    }
  } catch (error) {
    // Child-process errors embed the full command (including any token-bearing
    // URL) in their message — redact only the log string, then rethrow unchanged.
    logger.error('[openUrl] Failed to open URL in external browser:', redactErrorForLog(error));
    throw error;
  }
};

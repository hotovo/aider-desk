import Turndown from 'turndown';
import * as cheerio from 'cheerio';

import type { BrowserWindow as BrowserWindowType } from 'electron';

import { isAbortError } from '@/utils/errors';
import { isElectron } from '@/app';

type WebScrapeFormat = 'markdown' | 'html' | 'raw';

export class WebScraper {
  async scrape(url: string, timeout: number = 60000, abortSignal?: AbortSignal, format: WebScrapeFormat = 'markdown'): Promise<string> {
    if (format === 'raw') {
      return await this.scrapeWithFetch(url, timeout, abortSignal);
    }

    if (isElectron()) {
      return await this.scrapeWithBrowserWindow(url, timeout, abortSignal, format);
    } else {
      return await this.scrapeWithFetch(url, timeout, abortSignal);
    }
  }

  private async scrapeWithBrowserWindow(
    url: string,
    timeout: number = 60000,
    abortSignal?: AbortSignal,
    format: WebScrapeFormat = 'markdown',
  ): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BrowserWindow } = require('electron');

    // Create hidden BrowserWindow for scraping
    const window: BrowserWindowType = new BrowserWindow({
      show: false,
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
      },
    });

    let timeoutTimerId: NodeJS.Timeout | null = null;
    const timers: NodeJS.Timeout[] = [];
    const abortHandlers: (() => void)[] = [];

    const clearAllTimers = () => {
      if (timeoutTimerId) {
        clearTimeout(timeoutTimerId);
        timeoutTimerId = null;
      }
      timers.forEach((id) => clearTimeout(id));
      timers.length = 0;
    };

    const removeAbortListeners = () => {
      if (abortSignal) {
        abortHandlers.forEach((handler) => abortSignal!.removeEventListener('abort', handler));
        abortHandlers.length = 0;
      }
    };

    const cleanupWindow = async (win: BrowserWindowType): Promise<void> => {
      if (!win.isDestroyed()) {
        const wc = win.webContents;
        if (!wc.isDestroyed()) {
          wc.removeAllListeners('render-process-gone');
          wc.removeAllListeners('did-fail-load');
        }
        win.destroy();
      }
    };

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutTimerId = setTimeout(() => reject(new Error(`Scraping timeout after ${timeout}ms`)), timeout);
      });

      // Create abort promise if signal is provided
      const abortHandler = () => {
        clearAllTimers();
        removeAbortListeners();
      };

      let abortPromise: Promise<never>;
      let abortReject: (reason?: unknown) => void;
      if (abortSignal) {
        abortHandlers.push(abortHandler);
        abortSignal.addEventListener('abort', abortHandler);
        abortPromise = new Promise<never>((_, reject) => {
          abortReject = reject;
          abortSignal!.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
        abortHandlers.push(() => {
          abortReject(new Error('The operation was aborted'));
        });
      } else {
        abortPromise = new Promise<never>(() => {});
      }

      // Add crash handlers
      const renderProcessGoneHandler = () => {
        throw new Error('Browser window render process crashed');
      };
      const didFailLoadHandler = (_event: Electron.Event, errorCode: number, errorDescription: string) => {
        throw new Error(`Failed to load: ${errorCode} - ${errorDescription}`);
      };

      window.webContents.on('render-process-gone', renderProcessGoneHandler);
      window.webContents.on('did-fail-load', didFailLoadHandler);

      abortHandlers.push(() => {
        window.webContents.removeListener('render-process-gone', renderProcessGoneHandler);
        window.webContents.removeListener('did-fail-load', didFailLoadHandler);
      });

      // Load the URL with timeout and abort signal
      await Promise.race([window.loadURL(url), timeoutPromise, abortPromise]);

      // Wait for page to load completely with timeout and abort signal
      await Promise.race([this.waitForPageLoad(window, timers), timeoutPromise, abortPromise]);

      // Check if window is destroyed before executing JavaScript
      if (window.isDestroyed() || window.webContents.isDestroyed()) {
        throw new Error('Window was destroyed before content could be retrieved');
      }

      // Get page content with timeout and abort signal
      const content = await Promise.race([
        window.webContents.executeJavaScript(`
          document.documentElement.outerHTML;
        `),
        timeoutPromise,
        abortPromise,
      ]);

      // Check if window is destroyed before getting content type
      if (window.isDestroyed() || window.webContents.isDestroyed()) {
        throw new Error('Window was destroyed before content type could be retrieved');
      }

      // Get content type from headers with timeout and abort signal
      const contentType = await Promise.race([this.getContentType(window), timeoutPromise, abortPromise]);

      // If it's HTML, convert to markdown-like text or return HTML based on format
      if (contentType.includes('text/html') || this.looksLikeHTML(content)) {
        if (format === 'html') {
          return content;
        }
        return this.htmlToMarkDown(content);
      }

      return content;
    } catch (error) {
      if (isAbortError(error)) {
        return 'Operation was cancelled by user.';
      }
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      clearAllTimers();
      removeAbortListeners();
      await cleanupWindow(window);
    }
  }

  private async waitForPageLoad(window: BrowserWindowType, timers: NodeJS.Timeout[]): Promise<void> {
    return new Promise((resolve) => {
      if (!window || window.isDestroyed()) {
        return resolve();
      }

      const checkLoadState = () => {
        if (window.isDestroyed()) {
          return resolve();
        }

        if (window.webContents.isLoading()) {
          const timerId = setTimeout(checkLoadState, 100);
          timers.push(timerId);
        } else {
          // Additional wait for dynamic content to load
          const timerId = setTimeout(resolve, 1000);
          timers.push(timerId);
        }
      };

      checkLoadState();
    });
  }

  private async getContentType(window: BrowserWindowType): Promise<string> {
    if (window.isDestroyed() || window.webContents.isDestroyed()) {
      return '';
    }

    try {
      const contentType = await window.webContents.executeJavaScript(`
        (() => {
          const xhr = new XMLHttpRequest();
          xhr.open('HEAD', window.location.href, false);
          xhr.send();
          return xhr.getResponseHeader('content-type') || '';
        })()
      `);
      return contentType;
    } catch {
      return '';
    }
  }

  private async scrapeWithFetch(url: string, timeout: number = 60000, abortSignal?: AbortSignal): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const abortHandlers: (() => void)[] = [];

    const cleanup = () => {
      clearTimeout(timeoutId);
      if (abortSignal) {
        abortHandlers.forEach((handler) => abortSignal!.removeEventListener('abort', handler));
      }
    };

    if (abortSignal) {
      const abortHandler = () => controller.abort();
      abortHandlers.push(abortHandler);
      abortSignal.addEventListener('abort', abortHandler);
    }

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      // If it's HTML, return the text content
      if (contentType.includes('text/html')) {
        const text = await response.text();
        return text;
      }

      // For other content types, return as text
      return await response.text();
    } catch (error) {
      if (isAbortError(error)) {
        return 'Operation was cancelled by user.';
      }
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      cleanup();
    }
  }

  private looksLikeHTML(content: string): boolean {
    const htmlPatterns = [/<!DOCTYPE\s+html/i, /<html/i, /<head/i, /<body/i, /<div/i, /<p>/i, /<a\s+href=/i];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  private cleanHtml(content: string): string {
    const $ = cheerio.load(content);

    $('script, style, link, noscript, iframe, svg, meta, img, video, audio, canvas, form, button, input, select, textarea').remove();

    // Remove comments
    $('*')
      .contents()
      .filter((_, node) => node.type === 'comment')
      .remove();

    return $.html();
  }

  private htmlToMarkDown(content: string): string {
    const cleanedHtml = this.cleanHtml(content);
    const turndownService = new Turndown();

    return turndownService.turndown(cleanedHtml);
  }
}

export const scrapeWeb = async (url: string, timeout: number = 60000, abortSignal?: AbortSignal, format: WebScrapeFormat = 'markdown') => {
  const scraper = new WebScraper();
  return await scraper.scrape(url, timeout, abortSignal, format);
};

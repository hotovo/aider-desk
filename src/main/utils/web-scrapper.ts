import Turndown from 'turndown';
import * as cheerio from 'cheerio';

import type { BrowserWindow as BrowserWindowType } from 'electron';

import { isAbortError } from '@/utils/errors';
import { isElectron } from '@/app';

type WebScrapeFormat = 'markdown' | 'html' | 'raw';

const MAX_SCRAPE_CONTENT_BYTES = 10 * 1024 * 1024;
const MAX_SCRAPE_CONTENT_CHARS = 10 * 1024 * 1024;

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

    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Scraping timeout after ${timeout}ms`)), timeout);
      });

      // Create abort promise if signal is provided
      const abortPromise = abortSignal
        ? new Promise<never>((_, reject) => {
            abortSignal.addEventListener('abort', () => {
              reject(new Error('The operation was aborted'));
            });
          })
        : new Promise<never>(() => {});

      // Load the URL with timeout and abort signal
      await Promise.race([window.loadURL(url), timeoutPromise, abortPromise]);

      // Wait for page to load completely with timeout and abort signal
      await Promise.race([this.waitForPageLoad(window), timeoutPromise, abortPromise]);

      // Get page content with timeout and abort signal
      const content = await Promise.race([
        window.webContents.executeJavaScript(`
          (() => {
            const html = document.documentElement.outerHTML;
            return html.length > ${MAX_SCRAPE_CONTENT_CHARS}
              ? html.substring(0, ${MAX_SCRAPE_CONTENT_CHARS}) + '\\n<!-- content truncated at ${MAX_SCRAPE_CONTENT_CHARS} characters -->'
              : html;
          })()
        `),
        timeoutPromise,
        abortPromise,
      ]);

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
      // Cleanup window
      await this.cleanupWindow(window);
    }
  }

  private async waitForPageLoad(window: BrowserWindowType): Promise<void> {
    return new Promise((resolve) => {
      if (!window) {
        return resolve();
      }

      const checkLoadState = () => {
        if (window!.webContents.isLoading()) {
          setTimeout(checkLoadState, 100);
        } else {
          // Additional wait for dynamic content to load
          setTimeout(resolve, 1000);
        }
      };

      checkLoadState();
    });
  }

  private async getContentType(window: BrowserWindowType): Promise<string> {
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

  private async cleanupWindow(window: BrowserWindowType): Promise<void> {
    if (!window.isDestroyed()) {
      window.close();
    }
  }

  private async scrapeWithFetch(url: string, timeout: number = 60000, abortSignal?: AbortSignal): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => controller.abort());
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

      // Return the bounded text content for HTML and other content types
      return await this.readBodyWithLimit(response, MAX_SCRAPE_CONTENT_BYTES);
    } catch (error) {
      clearTimeout(timeoutId);
      if (isAbortError(error)) {
        return 'Operation was cancelled by user.';
      }
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
    const reader = (response.body as unknown as ReadableStream<Uint8Array> | null)?.getReader?.();
    if (!reader) {
      // no streaming body available - fall back to full text with post-hoc cap
      const text = await response.text();
      return text.length > maxBytes ? text.slice(0, maxBytes) + `\n[Content truncated at ${maxBytes} bytes]` : text;
    }

    const chunks: Buffer[] = [];
    let received = 0;
    let truncated = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const buf = Buffer.from(value);
      if (received + buf.length > maxBytes) {
        chunks.push(buf.subarray(0, maxBytes - received));
        received = maxBytes;
        truncated = true;
        await reader.cancel().catch(() => {});
        break;
      }
      chunks.push(buf);
      received += buf.length;
    }

    let text = Buffer.concat(chunks).toString('utf8');
    if (truncated) {
      text += `\n[Content truncated at ${Math.floor(maxBytes / (1024 * 1024))} MB]`;
    }
    return text;
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

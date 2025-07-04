import { chromium } from 'playwright-core';
import Turndown from 'turndown';

interface ScraperOptions {
  verifySSL?: boolean;
  printError?: (message: string) => void;
}

export class WebScraper {
  private verifySSL: boolean;

  constructor(options: ScraperOptions = {}) {
    this.verifySSL = options.verifySSL ?? true;
  }

  async scrape(url: string): Promise<string> {
    return await this.scrapeWithPlaywright(url);
  }

  private async scrapeWithPlaywright(url: string): Promise<string> {
    const browser = await chromium.launch();
    const context = await browser.newContext({
      ignoreHTTPSErrors: !this.verifySSL,
    });
    const page = await context.newPage();

    try {
      const response = await page.goto(url, { waitUntil: 'networkidle' });
      const content = await page.content();
      const contentType = response?.headers()['content-type'] ?? '';

      // If it's HTML, convert to markdown-like text
      if (contentType.includes('text/html') || this.looksLikeHTML(content)) {
        return this.htmlToMarkDown(content);
      }

      return content;
    } finally {
      await browser.close();
    }
  }

  private looksLikeHTML(content: string): boolean {
    const htmlPatterns = [/<!DOCTYPE\s+html/i, /<html/i, /<head/i, /<body/i, /<div/i, /<p>/i, /<a\s+href=/i];

    return htmlPatterns.some((pattern) => pattern.test(content));
  }

  private htmlToMarkDown(content: string): string {
    const turndownService = new Turndown();
    const markdown = turndownService.turndown(content);
    return markdown;
  }
}

export const scrapeWeb = async (url: string) => {
  const scraper = new WebScraper();
  return await scraper.scrape(url);
};

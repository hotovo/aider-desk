import { chromium } from 'playwright-core';
import Turndown from 'turndown';
import * as cheerio from 'cheerio';

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
    const markdown = turndownService.turndown(cleanedHtml);
    return markdown;
  }
}

export const scrapeWeb = async (url: string) => {
  const scraper = new WebScraper();
  return await scraper.scrape(url);
};

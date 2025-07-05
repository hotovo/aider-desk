import * as cheerio from 'cheerio';
import { chromium } from 'playwright-core';

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
        return this.htmlToMarkdownLike(content);
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

  private htmlToMarkdownLike(html: string): string {
    const $ = cheerio.load(html);

    // Remove SVG, images, and data-based links/sources
    $('svg, img').remove();
    $('[href^="data:"], [src^="data:"]').remove();

    // Keep only href attributes
    $('*').each((_, el) => {
      if (el.type === 'tag') {
        const $el = $(el);
        // Get all current attributes
        const currentAttributes = Object.keys($el[0].attribs);

        // Remove attributes that are not 'href'
        currentAttributes.forEach((attr) => {
          if (attr !== 'href') {
            $el.removeAttr(attr);
          }
        });
      }
    });

    // Convert to text, preserving some structure
    const text = $('body')
      .text()
      .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
      .trim();

    return text;
  }
}

export const scrapeWeb = async (url: string) => {
  const scraper = new WebScraper();
  return await scraper.scrape(url);
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to define mocks before they are hoisted
const { mockIsElectron } = vi.hoisted(() => {
  return {
    mockIsElectron: vi.fn().mockReturnValue(false),
  };
});

vi.mock('@/app', () => ({
  isElectron: mockIsElectron,
}));

import { WebScraper, scrapeWeb } from '../web-scrapper';

describe('WebScraper - Fetch Path', () => {
  let scraper: WebScraper;

  beforeEach(() => {
    scraper = new WebScraper();
    vi.useFakeTimers();
    mockIsElectron.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Timer Cleanup Tests', () => {
    it('should clear timeout timers after successful operation', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      global.fetch = vi.fn().mockResolvedValue(new Response('<html><body>Test</body></html>', {
        headers: { 'content-type': 'text/html' },
      }));

      await scraper.scrape('https://example.com', 60000);

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should clear timeout timers after error', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await scraper.scrape('https://example.com', 60000);

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('AbortSignal Listener Cleanup Tests', () => {
    it('should remove abort listeners after successful operation', async () => {
      const abortController = new AbortController();
      const removeEventListenerSpy = vi.spyOn(abortController.signal, 'removeEventListener');
      
      global.fetch = vi.fn().mockResolvedValue(new Response('<html><body>Test</body></html>', {
        headers: { 'content-type': 'text/html' },
      }));

      await scraper.scrape('https://example.com', 60000, abortController.signal);

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });

    it('should remove abort listeners after error', async () => {
      const abortController = new AbortController();
      const removeEventListenerSpy = vi.spyOn(abortController.signal, 'removeEventListener');
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await scraper.scrape('https://example.com', 60000, abortController.signal);

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('Fetch Error Handling', () => {
    it('should handle fetch error gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await scraper.scrape('https://example.com', 60000);

      expect(result).toContain('Error');
    });

    it('should handle non-ok responses', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));

      const result = await scraper.scrape('https://example.com', 60000);

      expect(result).toContain('Error');
    });

    it('should return HTML content for HTML responses', async () => {
      const htmlContent = '<html><body>Test</body></html>';
      global.fetch = vi.fn().mockResolvedValue(new Response(htmlContent, {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await scraper.scrape('https://example.com', 60000);

      expect(result).toBe(htmlContent);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid successive operations without issues', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('<html><body>Test</body></html>', {
        headers: { 'content-type': 'text/html' },
      }));

      await Promise.all([
        scraper.scrape('https://example.com/1', 60000),
        scraper.scrape('https://example.com/2', 60000),
        scraper.scrape('https://example.com/3', 60000),
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('scrapeWeb convenience function', () => {
    it('should export a working convenience function', async () => {
      global.fetch = vi.fn().mockResolvedValue(new Response('<html><body>Test</body></html>', {
        headers: { 'content-type': 'text/html' },
      }));

      const result = await scrapeWeb('https://example.com', 60000);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});

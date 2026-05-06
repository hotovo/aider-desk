import fs from 'fs/promises';

import { describe, expect, it, vi } from 'vitest';

import { truncateToolResult } from '../utils';

describe('truncateToolResult', () => {
  it('should return content unchanged when within both limits', async () => {
    const content = 'line1\nline2\nline3';

    const result = await truncateToolResult(content);

    expect(result).toBe(content);
  });

  it('should return content unchanged when exactly at line limit', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const content = lines.join('\n');

    const result = await truncateToolResult(content, 10, 50);

    expect(result).toBe(content);
  });

  it('should return content unchanged when exactly at size limit', async () => {
    const targetBytes = 1024;
    const content = 'a'.repeat(targetBytes);

    const result = await truncateToolResult(content, 1000, 1);

    expect(result).toBe(content);
  });

  describe('line-based truncation', () => {
    it('should truncate when line count exceeds maxLines', async () => {
      const lines = Array.from({ length: 1500 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');

      const result = await truncateToolResult(content, 1000, 50000);

      expect(result).toContain('Content truncated');
      expect(result).toContain('1500 lines exceeded limit of 1000');
      expect(result).toContain('Full content saved to');

      const previewLines = result.split('\n');
      const truncationLine = previewLines.findIndex((l) => l.startsWith('... Content truncated'));
      expect(truncationLine).toBe(1000);
    });

    it('should use custom maxLines parameter', async () => {
      const lines = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`);
      const content = lines.join('\n');

      const result = await truncateToolResult(content, 10, 50000);

      expect(result).toContain('50 lines exceeded limit of 10');

      const previewLines = result.split('\n');
      const truncationLine = previewLines.findIndex((l) => l.startsWith('... Content truncated'));
      expect(truncationLine).toBe(10);
    });
  });

  describe('size-based truncation', () => {
    it('should truncate when size exceeds maxSizeKB', async () => {
      const content = 'a'.repeat(100 * 1024);

      const result = await truncateToolResult(content, 1000, 10);

      expect(result).toContain('Content truncated');
      expect(result).toContain('KB exceeded limit of 10 KB');
      expect(result).toContain('Full content saved to');

      const truncationLine = result.split('\n').pop()!;
      expect(truncationLine).toMatch(/^\.\.\. Content truncated/);

      const previewSection = result.split('\n... Content truncated')[0];
      const previewBytes = Buffer.byteLength(previewSection, 'utf8');
      expect(previewBytes).toBeLessThanOrEqual(10 * 1024);
    });

    it('should truncate by bytes when size exceeds limit even if line count is within limit', async () => {
      const longLine = 'b'.repeat(60 * 1024);
      const content = longLine;

      const result = await truncateToolResult(content, 1000, 10);

      expect(result).toContain('Content truncated');
      expect(result).toContain('KB exceeded limit of 10 KB');

      const previewSection = result.split('\n... Content truncated')[0];
      const previewBytes = Buffer.byteLength(previewSection, 'utf8');
      expect(previewBytes).toBeLessThanOrEqual(10 * 1024);
    });

    it('should use custom maxSizeKB parameter', async () => {
      const content = 'x'.repeat(200 * 1024);

      const result = await truncateToolResult(content, 1000, 100, Infinity);

      expect(result).toContain('Content truncated');
      expect(result).toContain('KB exceeded limit of 100 KB');

      const previewSection = result.split('\n... Content truncated')[0];
      const previewBytes = Buffer.byteLength(previewSection, 'utf8');
      expect(previewBytes).toBeLessThanOrEqual(100 * 1024);
    });
  });

  describe('both limits exceeded', () => {
    it('should prioritize size truncation when both limits are exceeded', async () => {
      const lines = Array.from({ length: 2000 }, () => 'a'.repeat(100));
      const content = lines.join('\n');

      const result = await truncateToolResult(content, 1000, 10, Infinity);

      expect(result).toContain('Content truncated');
      expect(result).toContain('KB exceeded limit of 10 KB');

      const previewSection = result.split('\n... Content truncated')[0];
      const previewBytes = Buffer.byteLength(previewSection, 'utf8');
      expect(previewBytes).toBeLessThanOrEqual(10 * 1024);
    });
  });

  describe('tmp file', () => {
    it('should save full content to a temp file when truncating', async () => {
      const content = 'c'.repeat(100 * 1024);

      const result = await truncateToolResult(content, 1000, 10);

      const tmpPathMatch = result.match(/saved to (.+\.txt)/);
      expect(tmpPathMatch).not.toBeNull();

      const tmpFilePath = tmpPathMatch![1];
      expect(tmpFilePath).toContain('aider-desk-tool-result-');

      const savedContent = await fs.readFile(tmpFilePath, 'utf8');
      expect(savedContent).toBe(content);

      await fs.unlink(tmpFilePath);
    });

    it('should not create tmp file when content is within limits', async () => {
      const content = 'short content';
      const writeSpy = vi.spyOn(fs, 'writeFile');

      await truncateToolResult(content);

      const tmpFileCalls = writeSpy.mock.calls.filter((call) => String(call[0]).includes('aider-desk-tool-result-'));
      expect(tmpFileCalls).toHaveLength(0);

      writeSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', async () => {
      const result = await truncateToolResult('');

      expect(result).toBe('');
    });

    it('should handle single character', async () => {
      const result = await truncateToolResult('x');

      expect(result).toBe('x');
    });

    it('should handle content with only newlines', async () => {
      const content = '\n'.repeat(2000);

      const result = await truncateToolResult(content, 1000, 50000);

      expect(result).toContain('Content truncated');
      expect(result).toContain('2001 lines exceeded limit of 1000');
    });

    it('should handle multiline content that exceeds size by small amount', async () => {
      const maxSizeKB = 1;
      const maxBytes = maxSizeKB * 1024;
      const content = 'a'.repeat(maxBytes + 100);

      const result = await truncateToolResult(content, 1000, maxSizeKB);

      expect(result).toContain('Content truncated');

      const previewSection = result.split('\n... Content truncated')[0];
      const previewBytes = Buffer.byteLength(previewSection, 'utf8');
      expect(previewBytes).toBeLessThanOrEqual(maxBytes);
    });

    it('should produce valid utf8 when truncating mid-multibyte character', async () => {
      const emoji = '😀';
      const maxSizeKB = 1;
      const maxBytes = maxSizeKB * 1024;
      const filler = 'a'.repeat(maxBytes);
      const content = filler + emoji + emoji + emoji;

      const result = await truncateToolResult(content, 1000, maxSizeKB);

      expect(result).toContain('Content truncated');

      const previewSection = result.split('\n... Content truncated')[0];
      expect(() => Buffer.from(previewSection, 'utf8')).not.toThrow();
    });
  });
});

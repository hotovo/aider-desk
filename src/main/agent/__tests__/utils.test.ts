import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFileContent, truncateToolResult } from '../utils';

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
    }, 30000);

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
  }, 30000);

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

describe('readFileContent', () => {
  const tmpDir = path.join(os.tmpdir(), 'aider-desk-test-readFileContent');

  const createTempFile = async (content: string, fileName = 'test.txt'): Promise<string> => {
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, fileName);
    await fs.writeFile(filePath, content, 'utf8');
    return filePath;
  };

  const createBinaryFile = async (fileName = 'binary.bin'): Promise<string> => {
    await fs.mkdir(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, fileName);
    const buffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    await fs.writeFile(filePath, buffer);
    return filePath;
  };

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should read full file content', async () => {
    const content = 'line1\nline2\nline3';
    const filePath = await createTempFile(content);

    const result = await readFileContent(filePath);

    expect(result).toBe(content);
  });

  it('should throw for binary files', async () => {
    const filePath = await createBinaryFile();

    await expect(readFileContent(filePath)).rejects.toThrow('Binary files cannot be read.');
  });

  describe('lineOffset and lineLimit', () => {
    it('should apply lineOffset to skip first N lines', async () => {
      const content = 'line0\nline1\nline2\nline3\nline4';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 2, 1000);

      expect(result).toBe('line2\nline3\nline4');
    });

    it('should apply lineLimit to return at most N lines', async () => {
      const content = 'line0\nline1\nline2\nline3\nline4';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 0, 3);

      expect(result).toBe('line0\nline1\nline2\n...\nTotal lines in the file: 5');
    });

    it('should apply both lineOffset and lineLimit', async () => {
      const content = 'line0\nline1\nline2\nline3\nline4';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 1, 2);

      expect(result).toBe('line1\nline2\n...\nTotal lines in the file: 5');
    });

    it('should not show truncation indicator when all lines are returned', async () => {
      const content = 'line0\nline1\nline2';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 1, 10);

      expect(result).toBe('line1\nline2');
      expect(result).not.toContain('Total lines');
    });

    it('should handle lineOffset beyond file length', async () => {
      const content = 'line0\nline1';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 100, 10);

      expect(result).toBe('');
    });
  });

  describe('withLines', () => {
    it('should prefix lines with line numbers', async () => {
      const content = 'alpha\nbeta\ngamma';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, true, 0, 1000);

      expect(result).toBe('1|alpha\n2|beta\n3|gamma');
    });

    it('should number lines starting from offset position', async () => {
      const content = 'alpha\nbeta\ngamma\ndelta\nepsilon';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, true, 2, 2);

      expect(result).toBe('3|gamma\n4|delta\n...\nTotal lines in the file: 5');
    });
  });

  describe('sizeLimit applied to limited content', () => {
    it('should NOT truncate when full file is large but requested range is small', async () => {
      const bigLine = 'x'.repeat(1024);
      const lines = Array.from({ length: 200 }, () => bigLine);
      const content = lines.join('\n');
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 0, 5, 100);

      expect(result).not.toContain('File size limit');
      const resultLines = result.split('\n');
      expect(resultLines[0]).toBe(bigLine);
      expect(resultLines[resultLines.length - 1]).toBe('Total lines in the file: 200');
    });

    it('should NOT truncate when using lineOffset to read a small slice of a large file', async () => {
      const bigLine = 'y'.repeat(512);
      const lines = Array.from({ length: 500 }, () => bigLine);
      const content = lines.join('\n');
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 490, 5, 10);

      expect(result).not.toContain('File size limit');
      const resultLines = result.split('\n');
      expect(resultLines.length).toBe(7);
      expect(resultLines[resultLines.length - 1]).toBe('Total lines in the file: 500');
    });

    it('should truncate when the limited content exceeds sizeLimit', async () => {
      const bigLine = 'a'.repeat(1024);
      const lines = Array.from({ length: 10 }, () => bigLine);
      const content = lines.join('\n');
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 0, 10, 2);

      expect(result).toContain('File size limit (2.0 KB) exceeded');
    });

    it('should truncate limited content with line numbers when withLines is true', async () => {
      const bigLine = 'b'.repeat(1024);
      const lines = Array.from({ length: 10 }, () => bigLine);
      const content = lines.join('\n');
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, true, 0, 10, 2);

      expect(result).toContain('File size limit (2.0 KB) exceeded');
      expect(result).toMatch(/^1\|/);
    });

    it('should use default sizeLimit based on lineLimit when not specified', async () => {
      const lines = Array.from({ length: 10 }, () => 'x'.repeat(1024));
      const content = lines.join('\n');
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 0, 5);

      expect(result).not.toContain('File size limit');
    });
  });

  describe('edge cases', () => {
    it('should handle empty file', async () => {
      const filePath = await createTempFile('');

      const result = await readFileContent(filePath);

      expect(result).toBe('');
    });

    it('should handle single line file', async () => {
      const filePath = await createTempFile('only line');

      const result = await readFileContent(filePath);

      expect(result).toBe('only line');
    });

    it('should handle file ending with newline', async () => {
      const filePath = await createTempFile('line1\nline2\n');

      const result = await readFileContent(filePath);

      expect(result).toBe('line1\nline2\n');
    });

    it('should handle zero lineLimit by defaulting to 1000', async () => {
      const content = 'line0\nline1\nline2';
      const filePath = await createTempFile(content);

      const result = await readFileContent(filePath, false, 0, 1000);

      expect(result).toBe(content);
    });
  });
});

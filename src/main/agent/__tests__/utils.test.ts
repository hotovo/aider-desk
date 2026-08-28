import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ModelMessage } from 'ai';

import { BoundedOutputAccumulator, readFileContent, safeJsonStringify, stripImageParts, stringifyWithBudget, truncateToolResult } from '../utils';

describe('stripImageParts', () => {
  it('removes image file parts and their intro text, keeping other text', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please review this' },
          { type: 'text', text: 'Here is image foo.png for your reference.' },
          { type: 'file', mediaType: 'image/png', data: 'abc123' },
        ],
      },
    ];

    const result = stripImageParts(messages);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual([{ type: 'text', text: 'Please review this' }]);
  });

  it('removes type "image" parts', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Look' }, { type: 'image', image: 'abc123', mediaType: 'image/png' }],
      },
    ];

    const result = stripImageParts(messages);

    expect(result[0].content).toEqual([{ type: 'text', text: 'Look' }]);
  });

  it('replaces an image-only user message with a note', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'Here is content of image file bar.png' }, { type: 'image', image: 'abc123', mediaType: 'image/png' }],
      },
    ];

    const result = stripImageParts(messages);

    expect(result).toHaveLength(1);
    const content = result[0].content as Array<{ type: string; text?: string }>;
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe('text');
    expect(content[0].text).toMatch(/does not support image input/);
  });

  it('leaves messages without images unchanged', () => {
    const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }, { role: 'assistant', content: 'hi' }];

    const result = stripImageParts(messages);

    expect(result).toEqual(messages);
  });

  it('leaves non-image file parts intact', () => {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [{ type: 'text', text: 'data' }, { type: 'file', mediaType: 'application/json', data: '{}' }],
      },
    ];

    const result = stripImageParts(messages);

    expect(result[0].content).toEqual([{ type: 'text', text: 'data' }, { type: 'file', mediaType: 'application/json', data: '{}' }]);
  });
});

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

describe('BoundedOutputAccumulator', () => {
  it('returns exact content when below the spill threshold', async () => {
    const acc = new BoundedOutputAccumulator();
    acc.append(Buffer.from('hello '));
    acc.append(Buffer.from('world'));

    expect(acc.getTotalChars()).toBe(11);
    expect(await acc.finish()).toBe('hello world');
    expect(acc.didSpill()).toBe(false);
  });

  it('decodes multi-byte characters split across chunks', async () => {
    const acc = new BoundedOutputAccumulator();
    const bytes = Buffer.from('héllo 😀 world', 'utf8');
    const splitAt = bytes.indexOf(0xa9); // byte inside the 'é' sequence
    acc.append(bytes.subarray(0, splitAt));
    acc.append(bytes.subarray(splitAt));

    expect(await acc.finish()).toBe('héllo 😀 world');
  });

  it('keeps bounded head and tail after overflow and spills full output to a file', async () => {
    const acc = new BoundedOutputAccumulator();
    const headText = 'A'.repeat(200 * 1024);
    const middle = 'B'.repeat(200 * 1024);
    const tailText = 'C'.repeat(200 * 1024);
    acc.append(Buffer.from(headText + middle + tailText));

    expect(acc.didSpill()).toBe(true);
    const spillPath = acc.getSpillFilePath();
    expect(spillPath).toBeTruthy();

    const result = await acc.finish();

    expect(result.length).toBeLessThan(110 * 1024);
    expect(result.slice(0, 1000)).toBe('A'.repeat(1000));
    expect(result.slice(-1000)).toBe('C'.repeat(1000));
    expect(result).toContain('characters omitted');
    expect(result).toContain('Full output saved to');

    const spilled = await fs.readFile(spillPath as string, 'utf8');
    expect(spilled).toBe(headText + middle + tailText);
  });

  it('produces bounded previews while accumulating', () => {
    const acc = new BoundedOutputAccumulator();
    acc.append(Buffer.from('x'.repeat(50 * 1024)));

    const preview = acc.getPreview(8 * 1024);
    expect(preview.length).toBeLessThanOrEqual(9 * 1024);
    expect(preview).toContain('earlier characters omitted');
    expect(preview.endsWith('x'.repeat(8 * 1024))).toBe(true);
  });

  it('removes the spill file on dispose', async () => {
    const acc = new BoundedOutputAccumulator();
    acc.append(Buffer.from('z'.repeat(300 * 1024)));
    const spillPath = acc.getSpillFilePath();
    expect(spillPath).toBeTruthy();

    await acc.dispose();

    await expect(fs.access(spillPath as string)).rejects.toThrow();
  });
});

describe('safeJsonStringify', () => {
  it('returns natural JSON when within budget', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
    expect(safeJsonStringify('plain')).toBe('"plain"');
  });

  it('returns a valid JSON envelope when over budget', () => {
    const text = safeJsonStringify({ big: 'x'.repeat(300_000) }, 1000);

    const parsed = JSON.parse(text) as { truncated: boolean; preview: string; originalLength: number };
    expect(parsed.truncated).toBe(true);
    expect(parsed.originalLength).toBeGreaterThan(300_000);
    expect(parsed.preview.length).toBeLessThanOrEqual(1000);
    expect(parsed.preview).toContain('"big"');
  });

  it('handles circular references', () => {
    const value: Record<string, unknown> = {};
    value.self = value;

    const text = safeJsonStringify(value);

    expect(JSON.parse(text)).toEqual({ truncated: true, note: 'Value could not be serialized to JSON.' });
  });

  it('handles undefined values', () => {
    expect(safeJsonStringify(undefined)).toBe('undefined');
  });
});

describe('stringifyWithBudget', () => {
  it('reports whether truncation occurred', () => {
    expect(stringifyWithBudget('short').truncated).toBe(false);
    expect(stringifyWithBudget('x'.repeat(100), 10).truncated).toBe(true);
  });
});

describe('readFileContent large files', () => {
  const largeTmpDir = path.join(os.tmpdir(), 'aider-desk-test-readFileContent-large');

  afterEach(async () => {
    await fs.rm(largeTmpDir, { recursive: true, force: true });
  });

  const createLargeFile = async (): Promise<[string, string[]]> => {
    await fs.mkdir(largeTmpDir, { recursive: true });
    const filePath = path.join(largeTmpDir, 'large.txt');
    const lines = Array.from({ length: 220_000 }, (_, i) => `line ${i} ${'p'.repeat(40)}`);
    await fs.writeFile(filePath, lines.join('\n'), 'utf8');
    return [filePath, lines];
  };

  it('streams large files instead of loading them fully', async () => {
    const [filePath, lines] = await createLargeFile();

    const result = await readFileContent(filePath, false, 0, 500);

    const resultLines = result.split('\n');
    expect(resultLines[0]).toBe(lines[0]);
    expect(resultLines[499]).toBe(lines[499]);
    expect(result).toContain('exact count skipped for large file');
  });

  it('applies lineOffset when streaming large files', async () => {
    const [filePath] = await createLargeFile();

    const result = await readFileContent(filePath, false, 100_000, 5);

    expect(result.split('\n')[0]).toBe(`line 100000 ${'p'.repeat(40)}`);
  });

  it('throws for large binary files', async () => {
    await fs.mkdir(largeTmpDir, { recursive: true });
    const filePath = path.join(largeTmpDir, 'large.bin');
    await fs.writeFile(filePath, Buffer.alloc(11 * 1024 * 1024, 0));

    await expect(readFileContent(filePath)).rejects.toThrow('Binary files cannot be read.');
  });
});

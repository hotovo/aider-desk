import { Buffer } from 'node:buffer';

import { describe, it, expect } from 'vitest';

import { formatSize, truncateHead, truncateTail, truncateLine, DEFAULT_MAX_LINES, DEFAULT_MAX_BYTES, GREP_MAX_LINE_LENGTH } from '../truncate';

import type { TruncationResult } from '../truncate';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
describe('constants', () => {
  it('should export DEFAULT_MAX_LINES as 2000', () => {
    expect(DEFAULT_MAX_LINES).toBe(2000);
  });

  it('should export DEFAULT_MAX_BYTES as 50KB', () => {
    expect(DEFAULT_MAX_BYTES).toBe(50 * 1024);
  });

  it('should export GREP_MAX_LINE_LENGTH as 500', () => {
    expect(GREP_MAX_LINE_LENGTH).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// formatSize
// ---------------------------------------------------------------------------
describe('formatSize', () => {
  it('should format bytes below 1024 as B', () => {
    expect(formatSize(0)).toBe('0B');
    expect(formatSize(1)).toBe('1B');
    expect(formatSize(512)).toBe('512B');
    expect(formatSize(1023)).toBe('1023B');
  });

  it('should format bytes between 1024 and 1MB as KB', () => {
    expect(formatSize(1024)).toBe('1.0KB');
    expect(formatSize(1536)).toBe('1.5KB');
    expect(formatSize(51200)).toBe('50.0KB');
    expect(formatSize(1024 * 1024 - 1)).toBe('1024.0KB');
  });

  it('should format bytes at or above 1MB as MB', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0MB');
    expect(formatSize(1024 * 1024 * 5)).toBe('5.0MB');
    expect(formatSize(1024 * 1024 * 2.5)).toBe('2.5MB');
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeContent = (lineCount: number, bytesPerLine: number = 10): string => {
  // Each line is `bytesPerLine` ASCII characters, no newlines inside the line itself
  const line = 'x'.repeat(bytesPerLine);
  return Array.from({ length: lineCount }, () => line).join('\n');
};

const assertNotTruncated = (
  result: TruncationResult,
  expectedContent: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxBytes: number = DEFAULT_MAX_BYTES,
): void => {
  expect(result.truncated).toBe(false);
  expect(result.truncatedBy).toBeNull();
  expect(result.content).toBe(expectedContent);
  expect(result.outputLines).toBe(result.totalLines);
  expect(result.outputBytes).toBe(result.totalBytes);
  expect(result.lastLinePartial).toBe(false);
  expect(result.firstLineExceedsLimit).toBe(false);
  expect(result.maxLines).toBe(maxLines);
  expect(result.maxBytes).toBe(maxBytes);
};

// ---------------------------------------------------------------------------
// truncateHead
// ---------------------------------------------------------------------------
describe('truncateHead', () => {
  // -- No truncation --------------------------------------------------------
  it('should not truncate empty string', () => {
    const result = truncateHead('');
    assertNotTruncated(result, '');
    expect(result.totalLines).toBe(1);
    expect(result.totalBytes).toBe(0);
  });

  it('should not truncate content within limits', () => {
    const content = 'hello\nworld';
    const result = truncateHead(content);
    assertNotTruncated(result, content);
    expect(result.totalLines).toBe(2);
    expect(result.totalBytes).toBe(Buffer.byteLength(content, 'utf-8'));
  });

  it('should not truncate single line within byte limit', () => {
    const content = 'short';
    const result = truncateHead(content);
    assertNotTruncated(result, content);
    expect(result.totalLines).toBe(1);
  });

  it('should use custom options when provided', () => {
    const content = 'line1\nline2\nline3';
    const result = truncateHead(content, { maxLines: 5, maxBytes: 1024 });
    assertNotTruncated(result, content, 5, 1024);
  });

  it('should use custom maxLines with default maxBytes', () => {
    const content = 'a\nb';
    const result = truncateHead(content, { maxLines: 10 });
    assertNotTruncated(result, content, 10, DEFAULT_MAX_BYTES);
  });

  it('should use custom maxBytes with default maxLines', () => {
    const content = 'a\nb';
    const result = truncateHead(content, { maxBytes: 1024 });
    assertNotTruncated(result, content, DEFAULT_MAX_LINES, 1024);
  });

  // -- Line truncation ------------------------------------------------------
  it('should truncate by lines when content exceeds maxLines but fits in bytes', () => {
    // 5 lines × 10 bytes each = ~50 bytes
    const content = makeContent(5, 10);
    const result = truncateHead(content, { maxLines: 3, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(3);
    expect(result.totalLines).toBe(5);
    expect(result.maxLines).toBe(3);

    // Should have first 3 lines
    const expectedContent = Array.from({ length: 3 }, () => 'x'.repeat(10)).join('\n');
    expect(result.content).toBe(expectedContent);
    expect(result.lastLinePartial).toBe(false);
    expect(result.firstLineExceedsLimit).toBe(false);
  });

  it('should truncate to exactly maxLines at boundary', () => {
    const content = makeContent(5, 10);
    const result = truncateHead(content, { maxLines: 5, maxBytes: 1024 });

    // Exactly at limit — no truncation
    assertNotTruncated(result, content, 5, 1024);
  });

  // -- Byte truncation ------------------------------------------------------
  it('should truncate by bytes when content exceeds maxBytes before hitting maxLines', () => {
    // 5 lines × 20 bytes each = 100 bytes total (plus 4 newlines = 104)
    const content = makeContent(5, 20);
    // Set maxBytes to fit ~3 lines (3*20 + 2 newlines = 62)
    const result = truncateHead(content, { maxLines: 100, maxBytes: 62 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.lastLinePartial).toBe(false);
    expect(result.firstLineExceedsLimit).toBe(false);
    expect(result.outputBytes).toBeLessThanOrEqual(62);
    expect(result.outputLines).toBe(3);
  });

  // -- First line exceeds byte limit ----------------------------------------
  it('should return empty content when first line exceeds maxBytes', () => {
    const longLine = 'x'.repeat(100);
    const result = truncateHead(longLine, { maxBytes: 50, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.content).toBe('');
    expect(result.outputLines).toBe(0);
    expect(result.outputBytes).toBe(0);
    expect(result.lastLinePartial).toBe(false);
    expect(result.firstLineExceedsLimit).toBe(true);
    expect(result.totalLines).toBe(1);
    expect(result.totalBytes).toBe(100);
  });

  it('should return empty content when first multi-byte line exceeds maxBytes', () => {
    // Japanese characters are 3 bytes each in UTF-8
    const longLine = 'あ'.repeat(30); // 90 bytes, 30 chars
    const result = truncateHead(longLine, { maxBytes: 50, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.content).toBe('');
    expect(result.firstLineExceedsLimit).toBe(true);
    expect(result.totalBytes).toBe(90);
  });

  // -- Multi-byte UTF-8 -----------------------------------------------------
  it('should handle multi-byte UTF-8 characters correctly', () => {
    const lines = ['こんにちは世界', '你好世界', 'Γειά σου'];
    const content = lines.join('\n');
    const result = truncateHead(content, { maxLines: 2, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(2);
    expect(result.content).toBe('こんにちは世界\n你好世界');
    expect(result.lastLinePartial).toBe(false);
  });

  it('should count multi-byte bytes correctly for byte truncation', () => {
    // Each 'あ' is 3 bytes. 10 chars = 30 bytes per line
    const content = Array.from({ length: 5 }, () => 'あ'.repeat(10)).join('\n');
    // Total bytes: 5 * 30 + 4 = 154
    // Allow ~2 lines: 2*30 + 1 = 61 bytes
    const result = truncateHead(content, { maxLines: 100, maxBytes: 61 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.outputLines).toBe(2);
    expect(result.outputBytes).toBeLessThanOrEqual(61);
    expect(result.lastLinePartial).toBe(false);
  });

  // -- Edge cases -----------------------------------------------------------
  it('should handle content that is just newlines', () => {
    const content = '\n\n\n';
    const result = truncateHead(content, { maxLines: 2, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.totalLines).toBe(4); // split produces 4 elements for "\n\n\n"
    expect(result.outputLines).toBe(2);
  });

  it('should handle single line exactly at byte limit', () => {
    const content = 'x'.repeat(100);
    const result = truncateHead(content, { maxBytes: 100, maxLines: 100 });

    assertNotTruncated(result, content, 100, 100);
  });

  it('should handle single line exactly one byte over limit', () => {
    const content = 'x'.repeat(101);
    const result = truncateHead(content, { maxBytes: 100, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.firstLineExceedsLimit).toBe(true);
    expect(result.content).toBe('');
  });
});

// ---------------------------------------------------------------------------
// truncateTail
// ---------------------------------------------------------------------------
describe('truncateTail', () => {
  // -- No truncation --------------------------------------------------------
  it('should not truncate empty string', () => {
    const result = truncateTail('');
    assertNotTruncated(result, '');
    expect(result.totalLines).toBe(1);
    expect(result.totalBytes).toBe(0);
  });

  it('should not truncate content within limits', () => {
    const content = 'hello\nworld';
    const result = truncateTail(content);
    assertNotTruncated(result, content);
    expect(result.totalLines).toBe(2);
  });

  it('should not truncate single line within byte limit', () => {
    const content = 'short';
    const result = truncateTail(content);
    assertNotTruncated(result, content);
    expect(result.totalLines).toBe(1);
  });

  it('should use custom options when provided', () => {
    const content = 'line1\nline2\nline3';
    const result = truncateTail(content, { maxLines: 5, maxBytes: 1024 });
    assertNotTruncated(result, content, 5, 1024);
  });

  // -- Line truncation ------------------------------------------------------
  it('should truncate by lines when content exceeds maxLines but fits in bytes', () => {
    const content = makeContent(5, 10);
    const result = truncateTail(content, { maxLines: 3, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(3);
    expect(result.totalLines).toBe(5);
    expect(result.lastLinePartial).toBe(false);

    // Should have last 3 lines
    const expectedContent = Array.from({ length: 3 }, () => 'x'.repeat(10)).join('\n');
    expect(result.content).toBe(expectedContent);
  });

  it('should keep last N lines from the end', () => {
    const content = 'first\nsecond\nthird\nfourth\nfifth';
    const result = truncateTail(content, { maxLines: 2, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.content).toBe('fourth\nfifth');
    expect(result.outputLines).toBe(2);
  });

  // -- Byte truncation ------------------------------------------------------
  it('should truncate by bytes when content exceeds maxBytes before hitting maxLines', () => {
    // 5 lines × 20 bytes each = 100 bytes + 4 newlines = 104
    const content = makeContent(5, 20);
    // Fit ~3 lines from end: 3*20 + 2 = 62 bytes
    const result = truncateTail(content, { maxLines: 100, maxBytes: 62 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.lastLinePartial).toBe(false);
    expect(result.outputBytes).toBeLessThanOrEqual(62);
    expect(result.outputLines).toBe(3);
  });

  // -- Partial line (last line alone exceeds maxBytes) ----------------------
  it('should return partial last line when it alone exceeds maxBytes', () => {
    // Single long line
    const longLine = 'x'.repeat(100);
    const result = truncateTail(longLine, { maxBytes: 50, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.lastLinePartial).toBe(true);
    expect(result.outputLines).toBe(1);
    expect(result.content.length).toBeLessThan(100);
    // The partial content should be valid UTF-8 and <= 50 bytes
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(50);
  });

  it('should return partial line preserving multi-byte character boundaries', () => {
    // 'あ' is 3 bytes. 20 chars = 60 bytes.
    const longLine = 'あ'.repeat(20);
    const result = truncateTail(longLine, { maxBytes: 15, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.lastLinePartial).toBe(true);
    expect(result.outputLines).toBe(1);
    // Should have exactly 5 complete 'あ' characters = 15 bytes
    expect(result.content).toBe('あ'.repeat(5));
    expect(Buffer.byteLength(result.content, 'utf-8')).toBe(15);
  });

  it('should handle partial line that splits within a 4-byte character', () => {
    // Emoji '😀' is 4 bytes in UTF-8
    const longLine = '😀'.repeat(10); // 40 bytes
    const result = truncateTail(longLine, { maxBytes: 13, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.lastLinePartial).toBe(true);
    // 13 bytes: 3 complete emoji (12 bytes) + 1 byte remaining
    // The truncation should skip the partial byte and give 3 emoji = 12 bytes
    expect(result.content).toBe('😀'.repeat(3));
    expect(Buffer.byteLength(result.content, 'utf-8')).toBe(12);
  });

  // -- Multi-byte UTF-8 -----------------------------------------------------
  it('should keep correct last N lines with multi-byte content', () => {
    const lines = ['こんにちは世界', '你好世界', 'Γειά σου'];
    const content = lines.join('\n');
    const result = truncateTail(content, { maxLines: 2, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(2);
    expect(result.content).toBe('你好世界\nΓειά σου');
    expect(result.lastLinePartial).toBe(false);
  });

  it('should count multi-byte bytes correctly for byte truncation from tail', () => {
    const content = Array.from({ length: 5 }, () => 'あ'.repeat(10)).join('\n');
    // Total: 5*30 + 4 = 154. Allow ~2 lines from end: 2*30 + 1 = 61
    const result = truncateTail(content, { maxLines: 100, maxBytes: 61 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('bytes');
    expect(result.outputLines).toBe(2);
    expect(result.lastLinePartial).toBe(false);
  });

  // -- Edge cases -----------------------------------------------------------
  it('should handle content that is just newlines', () => {
    const content = '\n\n\n';
    const result = truncateTail(content, { maxLines: 2, maxBytes: 1024 });

    expect(result.truncated).toBe(true);
    expect(result.truncatedBy).toBe('lines');
    expect(result.totalLines).toBe(4);
    expect(result.outputLines).toBe(2);
  });

  it('should handle single line exactly at byte limit', () => {
    const content = 'x'.repeat(100);
    const result = truncateTail(content, { maxBytes: 100, maxLines: 100 });

    assertNotTruncated(result, content, 100, 100);
  });

  it('should handle single line one byte over limit with partial truncation', () => {
    const content = 'x'.repeat(101);
    const result = truncateTail(content, { maxBytes: 100, maxLines: 100 });

    expect(result.truncated).toBe(true);
    expect(result.lastLinePartial).toBe(true);
    expect(result.outputLines).toBe(1);
    // Should have 100 bytes of the original
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(100);
    expect(result.content).toBe('x'.repeat(100));
  });

  it('should correctly handle byte truncation with many short lines', () => {
    // 100 lines × 2 bytes each = 200 bytes + 99 newlines = 299 bytes
    const content = Array.from({ length: 100 }, () => 'ab').join('\n');
    const result = truncateTail(content, { maxLines: 10, maxBytes: 50 });

    expect(result.truncated).toBe(true);
    // With 50 bytes and 2-byte lines + 1 newline: can fit ~16 lines (16*2 + 15 = 47)
    // But maxLines is 10, so it depends which limit hits first
    expect(result.outputLines).toBeLessThanOrEqual(10);
    expect(result.outputBytes).toBeLessThanOrEqual(50);
    // Lines limit should hit first since 10 lines = 10*2 + 9 = 29 bytes < 50
    expect(result.truncatedBy).toBe('lines');
    expect(result.outputLines).toBe(10);
  });

  it('should not have lastLinePartial when byte limit is not hit', () => {
    const content = makeContent(10, 5);
    const result = truncateTail(content, { maxLines: 5, maxBytes: 1024 });

    expect(result.lastLinePartial).toBe(false);
    expect(result.firstLineExceedsLimit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// truncateLine
// ---------------------------------------------------------------------------
describe('truncateLine', () => {
  it('should not truncate line shorter than maxChars', () => {
    const result = truncateLine('short');
    expect(result.text).toBe('short');
    expect(result.wasTruncated).toBe(false);
  });

  it('should not truncate line exactly at maxChars', () => {
    const line = 'x'.repeat(GREP_MAX_LINE_LENGTH);
    const result = truncateLine(line);
    expect(result.text).toBe(line);
    expect(result.wasTruncated).toBe(false);
  });

  it('should truncate line longer than default maxChars', () => {
    const line = 'x'.repeat(GREP_MAX_LINE_LENGTH + 10);
    const result = truncateLine(line);
    expect(result.wasTruncated).toBe(true);
    expect(result.text).toBe('x'.repeat(GREP_MAX_LINE_LENGTH) + '... [truncated]');
    expect(result.text.length).toBe(GREP_MAX_LINE_LENGTH + '... [truncated]'.length);
  });

  it('should use custom maxChars when provided', () => {
    const line = 'x'.repeat(20);
    const result = truncateLine(line, 10);
    expect(result.wasTruncated).toBe(true);
    expect(result.text).toBe('x'.repeat(10) + '... [truncated]');
  });

  it('should handle empty string', () => {
    const result = truncateLine('');
    expect(result.text).toBe('');
    expect(result.wasTruncated).toBe(false);
  });

  it('should handle line one char over limit', () => {
    const result = truncateLine('x'.repeat(501));
    expect(result.wasTruncated).toBe(true);
    expect(result.text).toBe('x'.repeat(500) + '... [truncated]');
  });

  it('should handle multi-byte characters correctly', () => {
    // maxChars counts characters, not bytes
    const line = 'あ'.repeat(600); // 600 chars, 1800 bytes
    const result = truncateLine(line, 500);
    expect(result.wasTruncated).toBe(true);
    expect(result.text).toBe('あ'.repeat(500) + '... [truncated]');
    expect(result.text.length).toBe(500 + '... [truncated]'.length);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encode } from 'gpt-tokenizer/model/gpt-4o';

import { estimateMessageTokens, truncateToolResult } from '../utils';

import logger from '@/logger';

vi.mock('gpt-tokenizer/model/gpt-4o', () => ({ encode: vi.fn() }));
vi.mock('@/logger', () => ({ default: { warn: vi.fn() } }));

describe('token counting fallback', () => {
  let now = 0;

  beforeEach(() => {
    now += 120_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    vi.mocked(logger.warn).mockClear();
    vi.mocked(encode)
      .mockReset()
      .mockImplementation(() => {
        throw new Error('Tokenizer failed on sensitive input');
      });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses rounded-up length estimates for messages and preserves image estimates', () => {
    expect(
      estimateMessageTokens([
        { role: 'user', content: '1234567' },
        { role: 'tool', content: [{ type: 'tool-result', output: { type: 'text', value: '1234' } }] },
        { role: 'user', content: [{ type: 'image', image: 'image-data' }] },
      ]),
    ).toBe(1005);
    expect(estimateMessageTokens([{ role: 'user', content: '' }])).toBe(0);
  });

  it('preserves tool output within the fallback token budget', async () => {
    await expect(truncateToolResult('1234567', 1000, 50, 3, false)).resolves.toBe('1234567');
  });

  it('uses the fallback for total, head, and tail token counts during truncation', async () => {
    const content = Array.from({ length: 10 }, () => '123456').join('\n');

    const result = await truncateToolResult(content, 1000, 50, 4, false, 'truncated');

    expect(result).toBe('123456\n\n... 8 lines omitted. truncated\n\n123456');
    expect(encode).toHaveBeenCalledTimes(5);
  });

  it('rate-limits warnings without logging input text or tokenizer error details', () => {
    const messages = [{ role: 'user', content: 'sensitive input' }];

    estimateMessageTokens(messages);
    now += 3000;
    estimateMessageTokens(messages);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Tokenizer failed; using a length-based token estimate.');

    now += 60_000;
    estimateMessageTokens(messages);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});

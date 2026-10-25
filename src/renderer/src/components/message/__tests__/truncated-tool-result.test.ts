import { describe, expect, it } from 'vitest';

import { getTruncatedToolResult } from '../truncated-tool-result';

const envelope = {
  truncated: true,
  note: 'Content truncated due to size.',
  originalLength: 300_000,
  preview: 'Partial result',
};

describe('getTruncatedToolResult', () => {
  it('recognizes an oversized result envelope without changing its preview', () => {
    expect(getTruncatedToolResult(envelope)).toBe(envelope);
  });

  it('recognizes serialization failures without a preview', () => {
    const failure = { truncated: true, note: 'Value could not be serialized to JSON.' };
    expect(getTruncatedToolResult(failure)).toBe(failure);
  });

  it.each([
    null,
    undefined,
    '',
    'ordinary result',
    [],
    { stdout: 'output', exitCode: 0 },
    { ...envelope, truncated: false },
    { ...envelope, note: undefined },
    { ...envelope, preview: { text: 'not a string' } },
    { ...envelope, originalLength: '300000' },
    { ...envelope, originalLength: -1 },
    { ...envelope, originalLength: Infinity },
  ])('rejects ordinary results and malformed envelopes: %j', (value) => {
    expect(getTruncatedToolResult(value)).toBeNull();
  });
});

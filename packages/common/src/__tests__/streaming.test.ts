import { describe, expect, it } from 'vitest';

import { resolveStreamingConfig } from '../streaming';

describe('resolveStreamingConfig', () => {
  it('defaults to neither disabled nor required', () => {
    expect(resolveStreamingConfig()).toEqual({ disableStreaming: false, requireStreaming: false });
  });

  it.each([
    [{ requireStreaming: true }, {}, { disableStreaming: false, requireStreaming: true }],
    [{ requireStreaming: true }, { disableStreaming: true }, { disableStreaming: true, requireStreaming: false }],
    [{ disableStreaming: true }, { requireStreaming: true }, { disableStreaming: false, requireStreaming: true }],
    [{ requireStreaming: true }, { requireStreaming: false }, { disableStreaming: false, requireStreaming: false }],
    [{ requireStreaming: true }, { disableStreaming: false }, { disableStreaming: false, requireStreaming: true }],
    [{ disableStreaming: true }, { disableStreaming: false }, { disableStreaming: false, requireStreaming: false }],
    [{ disableStreaming: true }, { requireStreaming: false }, { disableStreaming: true, requireStreaming: false }],
  ])('resolves lower-priority %j followed by %j', (base, override, expected) => {
    expect(resolveStreamingConfig(base, override)).toEqual(expected);
  });

  it('gives requireStreaming priority for contradictory flags at the same level', () => {
    expect(resolveStreamingConfig({ disableStreaming: true, requireStreaming: true })).toEqual({ disableStreaming: false, requireStreaming: true });
  });

  it('ignores invalid persisted values and undefined sources', () => {
    expect(resolveStreamingConfig({ requireStreaming: true }, undefined, { disableStreaming: 'true', requireStreaming: null })).toEqual({
      disableStreaming: false,
      requireStreaming: true,
    });
  });

  it('does not mutate any source', () => {
    const source = { disableStreaming: true, requireStreaming: true };
    resolveStreamingConfig(source);
    expect(source).toEqual({ disableStreaming: true, requireStreaming: true });
  });
});

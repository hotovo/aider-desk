import { describe, expect, it } from 'vitest';

import { OpenCodeRuntime } from '../runtime';

describe('runtime cancellation', () => {
  it('can close before startup and never launches after close', async () => {
    const runtime = new OpenCodeRuntime();
    const first = runtime.close();
    expect(runtime.close()).toBe(first);
    await first;
    await expect(runtime.start()).rejects.toThrow();
    await runtime.close();
  });
});

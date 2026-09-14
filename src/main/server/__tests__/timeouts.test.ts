import { describe, expect, it } from 'vitest';

import { REQUEST_TIMEOUT_MS } from '../timeouts';

describe('server request timeout', () => {
  it('allows long-running model/proxy requests for 30 minutes', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});

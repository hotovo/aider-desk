import { describe, expect, it, vi } from 'vitest';

import { CursorRunSession } from '../lifecycle';
import { formatCursorError, redactCursorDiagnostic } from '../diagnostics';

import type { Run } from '@cursor/sdk';

const makeRun = (supportsCancel = true) => {
  const cancel = vi.fn(async () => {});
  return { run: { supports: () => supportsCancel, cancel } as unknown as Run, cancel };
};

describe('Cursor run lifecycle', () => {
  it('cancels a run that arrives after interruption', async () => {
    const session = new CursorRunSession();
    await session.cancel();
    const { run, cancel } = makeRun();
    await expect(session.attach(run)).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent cancellation requests', async () => {
    const session = new CursorRunSession();
    const { run, cancel } = makeRun();
    await session.attach(run);
    await Promise.all([session.cancel(), session.cancel(), session.cancel()]);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(() => session.throwIfAborted()).toThrow('interrupted');
  });

  it('does not attempt unsupported cancellation', async () => {
    const session = new CursorRunSession();
    const { run, cancel } = makeRun(false);
    await session.cancel();
    await expect(session.attach(run)).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe('Cursor diagnostics', () => {
  it('redacts configured keys, authorization, query parameters and URL credentials', () => {
    const message = 'private-key Bearer token123 api_key=abc https://user:pass@host/?access_token=xyz';
    const result = redactCursorDiagnostic(message, ['private-key']);
    for (const secret of ['private-key', 'token123', 'abc', 'user:pass', 'xyz']) expect(result).not.toContain(secret);
  });

  it('preserves structured error fields without exposing causes', () => {
    const error = Object.assign(new Error('Failed with private-key'), { code: 'AUTH', status: 401, isRetryable: false, cause: 'hidden-secret' });
    const message = formatCursorError(error, ['private-key']);
    expect(message).toContain('code=AUTH');
    expect(message).toContain('status=401');
    expect(message).toContain('isRetryable=false');
    expect(message).not.toContain('private-key');
    expect(message).not.toContain('hidden-secret');
  });
});

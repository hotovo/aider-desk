import { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { LONG_RUNNING_API_PATHS, requestTimeoutMiddleware } from '@/server/request-timeout';

const invokeMiddleware = (path: string, method = 'POST', accept?: string) => {
  const req = { path, method, headers: { accept } } as unknown as Request;
  const res = {
    setTimeout: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    headersSent: false,
    writableEnded: false,
    destroyed: false,
  };
  const next = vi.fn();
  requestTimeoutMiddleware(req, res as unknown as Response, next);
  expect(next).toHaveBeenCalledOnce();
  return res;
};

describe('requestTimeoutMiddleware', () => {
  it.each([undefined, '*/*', 'application/json, text/plain, */*', 'text/event-stream'])('does not exempt ordinary requests based on Accept: %s', (accept) => {
    const res = invokeMiddleware('/api/settings', 'GET', accept);
    expect(res.setTimeout).toHaveBeenCalledWith(300_000, expect.any(Function));
  });

  it.each([...LONG_RUNNING_API_PATHS])('disables the socket timeout for the long-running POST %s', (path) => {
    expect(invokeMiddleware(path).setTimeout).toHaveBeenCalledWith(0);
  });

  it.each(['/api/run-prompt/', '/API/RUN-PROMPT'])('matches Express route variants: %s', (path) => {
    expect(invokeMiddleware(path).setTimeout).toHaveBeenCalledWith(0);
  });

  it('does not exempt other methods or similarly named routes', () => {
    expect(invokeMiddleware('/api/run-prompt', 'GET').setTimeout).toHaveBeenCalledWith(300_000, expect.any(Function));
    expect(invokeMiddleware('/api/run-prompt/other').setTimeout).toHaveBeenCalledWith(300_000, expect.any(Function));
  });

  it('returns a single gateway timeout response', () => {
    const res = invokeMiddleware('/api/settings');
    const onTimeout = res.setTimeout.mock.calls[0][1] as () => void;
    onTimeout();
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith({ error: 'Response timeout' });
    res.writableEnded = true;
    onTimeout();
    expect(res.json).toHaveBeenCalledOnce();
  });

  it.each(['headersSent', 'writableEnded', 'destroyed'] as const)('does not write to a response with %s', (state) => {
    const res = invokeMiddleware('/api/settings');
    res[state] = true;
    const onTimeout = res.setTimeout.mock.calls[0][1] as () => void;
    onTimeout();
    expect(res.status).not.toHaveBeenCalled();
  });
});

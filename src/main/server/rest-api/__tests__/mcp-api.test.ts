import { createServer, type Server } from 'node:http';
import { type AddressInfo } from 'node:net';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { McpApi } from '../mcp-api';

import { type EventsHandler } from '@/events-handler';

describe('McpApi OAuth routes', () => {
  let server: Server;
  let baseUrl: string;
  let eventsHandler: EventsHandler;

  beforeEach(async () => {
    eventsHandler = {
      startMcpOAuth: vi.fn(() => Promise.resolve('https://mcp.example.com/oauth/authorize')),
      disconnectMcpOAuth: vi.fn(() => Promise.resolve()),
      completeMcpOAuth: vi.fn(() => Promise.resolve()),
      cancelMcpOAuth: vi.fn(() => Promise.resolve()),
    } as unknown as EventsHandler;
    const app = express();
    app.use(express.json());
    const router = express.Router();
    new McpApi(eventsHandler).registerRoutes(router);
    app.use('/api', router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('returns the authorization URL when connecting', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/oauth/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverName: 'sentry', config: { url: 'https://mcp.sentry.dev/mcp' } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authorizationUrl: 'https://mcp.example.com/oauth/authorize' });
    expect(eventsHandler.startMcpOAuth).toHaveBeenCalledWith('sentry', { url: 'https://mcp.sentry.dev/mcp' });
  });

  it('completes the callback without exposing callback values in the response', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/oauth/callback?code=secret-code&state=expected-state`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).toContain('Authentication complete');
    expect(html).not.toContain('secret-code');
    expect(eventsHandler.completeMcpOAuth).toHaveBeenCalledWith('secret-code', 'expected-state');
  });

  it('cancels pending authorization when the OAuth server returns an error', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/oauth/callback?error=access_denied&state=expected-state`);

    expect(response.status).toBe(400);
    expect(eventsHandler.cancelMcpOAuth).toHaveBeenCalledWith('expected-state');
  });

  it('rejects an invalid callback', async () => {
    const response = await fetch(`${baseUrl}/api/mcp/oauth/callback?error=access_denied`);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Authentication failed');
    expect(eventsHandler.completeMcpOAuth).not.toHaveBeenCalled();
  });
});

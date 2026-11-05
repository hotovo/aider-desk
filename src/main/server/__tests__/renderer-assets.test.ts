import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { serveRendererAssets } from '../renderer-assets';

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

let directory: string;
let server: Server;
let base: string;
const javascript = 'const value = "a long repeated value";\n'.repeat(1000);

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'aiderdesk-assets-'));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'assets/index-abcdefgh.js'), javascript);
  await writeFile(path.join(directory, 'index.html'), '<html>AiderDesk</html>');
  await writeFile(path.join(directory, 'sw.js'), '// service worker');
  const app = express();
  app.get('/api/events', (_request, response) => {
    response.type('text/event-stream').send('data: hello\n\n');
  });
  app.use(serveRendererAssets(directory));
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await rm(directory, { recursive: true, force: true });
});

describe('renderer assets', () => {
  it('compresses large assets and keeps their decoded bytes unchanged', async () => {
    const response = await fetch(`${base}/assets/index-abcdefgh.js`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('vary')).toContain('Accept-Encoding');
    expect(await response.text()).toBe(javascript);
  });

  it('makes hashed assets immutable so tracked downloads can be reused by module and stylesheet requests', async () => {
    const response = await fetch(`${base}/assets/index-abcdefgh.js`);
    expect(response.headers.get('cache-control')).toBe('private, max-age=31536000, immutable');
    await response.text();
  });

  it.each(['/', '/index.html', '/sw.js'])('revalidates non-hashed resource %s', async (file) => {
    const response = await fetch(`${base}${file}`);
    expect(response.headers.get('cache-control')).toBe('no-cache');
    await response.text();
  });

  it('does not compress API event streams', async () => {
    const response = await fetch(`${base}/api/events`, { headers: { 'Accept-Encoding': 'gzip' } });
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(await response.text()).toBe('data: hello\n\n');
  });
});

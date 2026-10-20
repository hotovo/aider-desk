import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { OpenCode } from '@opencode/client';
import { createOpencode } from 'ai-sdk-provider-opencode-sdk';

import { ToolBridge } from './bridge';

import type { ToolSet } from 'ai';

const freePort = async (): Promise<number> => {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const address = socket.address();
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  if (!address || typeof address === 'string') {
    throw new Error('Unable to allocate an OpenCode port');
  }
  return address.port;
};

export class OpenCodeRuntime {
  private child?: ChildProcess;
  private root?: string;
  private bridge?: ToolBridge;
  private stopping?: Promise<void>;
  private starting?: ReturnType<OpenCodeRuntime['initialize']>;
  private controller = new AbortController();
  private provider?: ReturnType<typeof createOpencode>;
  private client?: ReturnType<typeof OpenCode.make>;

  start(directory?: string, tools?: ToolSet, storageDirectory?: string) {
    this.starting ??= this.initialize(directory, tools, storageDirectory);
    return this.starting;
  }

  private async initialize(directory?: string, tools?: ToolSet, storageDirectory?: string) {
    try {
      this.controller.signal.throwIfAborted();
      this.root = await mkdtemp(join(tmpdir(), 'aiderdesk-opencode-free-'));
      this.controller.signal.throwIfAborted();
      const workspace = directory ?? join(this.root, 'workspace');
      await mkdir(workspace, { recursive: true });
      const storage = storageDirectory ?? this.root;
      await mkdir(storage, { recursive: true, mode: 0o700 });
      const password = randomBytes(32).toString('hex');
      this.controller.signal.throwIfAborted();
      const port = await freePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      const headers = {
        Authorization: `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`,
      };
      let mcp = {};
      if (tools && Object.keys(tools).length) {
        this.bridge = new ToolBridge(tools);
        const url = await this.bridge.start();
        mcp = {
          servers: {
            aiderdesk: { type: 'remote', url, oauth: false, codemode: false },
          },
        };
      }
      const permissions = [
        { action: '*', resource: '*', effect: 'deny' },
        { action: 'shell', resource: '*', effect: 'ask' },
        { action: 'read', resource: '*', effect: 'ask' },
        { action: 'aiderdesk_*', resource: '*', effect: 'ask' },
      ];
      const env: NodeJS.ProcessEnv = {};
      for (const key of ['PATH', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP', 'TMPDIR', 'LANG']) {
        if (process.env[key]) {
          env[key] = process.env[key];
        }
      }
      Object.assign(env, {
        HOME: this.root,
        USERPROFILE: this.root,
        XDG_CONFIG_HOME: join(this.root, 'config'),
        XDG_DATA_HOME: join(storage, 'data'),
        XDG_STATE_HOME: join(storage, 'state'),
        XDG_CACHE_HOME: join(this.root, 'cache'),
        OPENCODE_PASSWORD: password,
        OPENCODE_CONFIG_PROJECT_DISABLE: 'true',
        OPENCODE_CONFIG_CONTENT: JSON.stringify({ permissions, mcp }),
      });
      const require = createRequire(join(__dirname, 'package.json'));
      const binary = join(dirname(require.resolve('@opencode/cli/package.json')), 'bin', 'opencode.exe');
      this.child = spawn(binary, ['serve', '--hostname', '127.0.0.1', '--port', String(port)], {
        cwd: workspace,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let failure: Error | undefined;
      this.child.once('error', (error) => {
        failure = error;
      });
      this.child.stdout?.resume();
      this.child.stderr?.resume();
      this.client = OpenCode.make({ baseUrl, headers });
      const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(60000)]);
      while (true) {
        signal.throwIfAborted();
        if (failure || this.child.exitCode !== null) {
          throw failure ?? new Error(`OpenCode exited during startup (${this.child.exitCode})`);
        }
        try {
          const info = await this.client.server.info({
            signal: AbortSignal.any([signal, AbortSignal.timeout(1500)]),
          });
          if (!info.version.startsWith('2.')) {
            throw new Error('OpenCode Free requires OpenCode 2.x');
          }
          break;
        } catch {
          await delay(150, undefined, { signal });
        }
      }
      if (this.bridge) {
        while (true) {
          signal.throwIfAborted();
          const servers = await this.client.mcp.list({ location: { directory: workspace } }, { signal });
          const status = servers.data.find((server) => server.name === 'aiderdesk')?.status;
          if (status?.status === 'connected') {
            break;
          }
          if (status?.status === 'failed' || status?.status === 'needs_auth') {
            throw new Error(`AiderDesk MCP bridge failed: ${status.status}`);
          }
          await delay(150, undefined, { signal });
        }
      }
      this.provider = createOpencode({ client: this.client });
      return {
        client: this.client,
        provider: this.provider,
        bridge: this.bridge,
        workspace,
        permissions,
      };
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  close(): Promise<void> {
    this.controller.abort();
    this.stopping ??= (async () => {
      await this.starting?.catch(() => undefined);
      await this.stop();
    })();
    return this.stopping;
  }

  private async stop(): Promise<void> {
    this.controller.abort();
    if (this.child?.pid && this.child.exitCode === null && this.child.signalCode === null) {
      this.child.kill();
      await Promise.race([new Promise<void>((resolve) => this.child!.once('exit', () => resolve())), delay(3000)]);
      if (this.child.exitCode === null && this.child.signalCode === null) {
        this.child.kill('SIGKILL');
        await new Promise<void>((resolve) => this.child!.once('exit', () => resolve()));
      }
    }
    await this.provider?.dispose();
    await this.bridge?.close();
    if (this.root) {
      await rm(this.root, { recursive: true, force: true });
    }
  }
}

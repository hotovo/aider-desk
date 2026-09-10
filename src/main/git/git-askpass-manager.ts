import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { AddressInfo } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { InputPromptData } from '@common/types';

import { EventManager } from '@/events';
import { AIDER_DESK_DATA_DIR } from '@/constants';
import logger from '@/logger';

interface PendingRequest {
  resolve: (answer: string) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
  prompt: string;
}

const ASKPASS_TIMEOUT_MS = 180_000;

export class GitAskpassManager {
  private server: Server | null = null;
  private port: number = 0;
  private token: string = randomUUID();
  private askpassDir: string;
  private askpassScriptPath: string = '';
  private askpassClientPath: string = '';
  private pendingRequests = new Map<string, PendingRequest>();
  private sessionCache = new Map<string, string>();
  private initialized = false;

  constructor(
    private readonly eventManager?: EventManager,
    customAskpassDir?: string,
  ) {
    this.askpassDir = customAskpassDir || path.join(AIDER_DESK_DATA_DIR, 'git-askpass');
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await fs.promises.mkdir(this.askpassDir, { recursive: true });
    this.writeAskpassFiles();

    await this.startServer();
    this.initialized = true;

    // Export askpass environment variables to process.env so all git commands inherit them
    const env = this.getEnv();
    for (const [key, value] of Object.entries(env)) {
      if (value !== undefined) {
        process.env[key] = value;
      }
    }

    logger.info(`GitAskpassManager initialized on port ${this.port}`);
  }

  private writeAskpassFiles(): void {
    this.askpassClientPath = path.join(this.askpassDir, 'askpass-client.cjs');
    const isWindows = process.platform === 'win32';
    this.askpassScriptPath = path.join(this.askpassDir, isWindows ? 'askpass.bat' : 'askpass.sh');

    const clientScript = `
const http = require('http');

const prompt = process.argv[2] || '';
const port = parseInt(process.env.AIDER_DESK_ASKPASS_PORT || '0', 10);
const token = process.env.AIDER_DESK_ASKPASS_TOKEN || '';

if (!port || !token) {
  process.exit(1);
}

const payload = JSON.stringify({ token, prompt });

const req = http.request(
  {
    hostname: '127.0.0.1',
    port,
    path: '/askpass',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  },
  (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      body += chunk;
    });
    res.on('end', () => {
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(body);
          if (typeof data.answer === 'string') {
            process.stdout.write(data.answer);
            process.exit(0);
          }
        } catch {}
      }
      process.exit(1);
    });
  },
);

req.on('error', () => {
  process.exit(1);
});

req.write(payload);
req.end();
`.trim();

    fs.writeFileSync(this.askpassClientPath, clientScript, { mode: 0o644 });

    if (isWindows) {
      const batScript = '@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"%AIDER_DESK_ELECTRON_PATH%" "%AIDER_DESK_ASKPASS_SCRIPT%" %*\r\n';
      fs.writeFileSync(this.askpassScriptPath, batScript);
    } else {
      const shScript = '#!/bin/sh\nELECTRON_RUN_AS_NODE=1 exec "$AIDER_DESK_ELECTRON_PATH" "$AIDER_DESK_ASKPASS_SCRIPT" "$@"\n';
      fs.writeFileSync(this.askpassScriptPath, shScript, { mode: 0o755 });
    }
  }

  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((req, res) => this.handleHttpRequest(req, res));
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        this.port = address.port;
        this.server = server;
        resolve();
      });
      server.on('error', (err) => {
        logger.error('GitAskpassManager server error:', err);
        reject(err);
      });
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== 'POST' || req.url !== '/askpass') {
      res.statusCode = 404;
      res.end();
      return;
    }

    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body) as { token?: string; prompt?: string };
        if (!data.token || data.token !== this.token) {
          res.statusCode = 403;
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        const prompt = data.prompt ?? '';

        // Check if there is a cached answer for this prompt
        const cached = this.sessionCache.get(prompt);
        if (cached !== undefined) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ answer: cached }));
          return;
        }

        const answer = await this.promptUser(prompt);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ answer }));
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Prompt cancelled' }));
      }
    });
  }

  private promptUser(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const requestId = randomUUID();

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Input prompt timed out'));
      }, ASKPASS_TIMEOUT_MS);

      // Check if there is already another request active for this exact prompt text
      let alreadyActive = false;
      for (const req of this.pendingRequests.values()) {
        if (req.prompt === prompt) {
          alreadyActive = true;
          break;
        }
      }

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timer,
        prompt,
      });

      if (!alreadyActive) {
        const promptData = this.buildPromptData(requestId, prompt);
        this.eventManager?.sendInputPrompt(promptData);
      }
    });
  }

  private buildPromptData(id: string, prompt: string): InputPromptData {
    const isConfirmation = /\(yes\/no(\/\[fingerprint\])?\)/i.test(prompt);
    if (isConfirmation) {
      return {
        id,
        title: 'git.askpass.confirmationTitle',
        message: prompt,
        type: 'confirmation',
        confirmLabel: 'common.yes',
        cancelLabel: 'common.no',
      };
    }

    const isUsername = /^username for/i.test(prompt);
    if (isUsername) {
      return {
        id,
        title: 'git.askpass.usernameTitle',
        message: prompt,
        type: 'text',
      };
    }

    return {
      id,
      title: 'git.askpass.passwordTitle',
      message: prompt,
      type: 'password',
      allowRememberSession: true,
      rememberSessionLabel: 'git.askpass.rememberSession',
    };
  }

  respond(id: string, value: string | null, rememberSession?: boolean): boolean {
    const pending = this.pendingRequests.get(id);
    if (!pending) {
      return false;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(id);
    const promptText = pending.prompt;

    if (value === null) {
      pending.reject(new Error('User cancelled'));
      for (const [otherId, req] of this.pendingRequests.entries()) {
        if (req.prompt === promptText) {
          clearTimeout(req.timer);
          this.pendingRequests.delete(otherId);
          req.reject(new Error('User cancelled'));
        }
      }
      return true;
    }

    if (rememberSession) {
      this.sessionCache.set(promptText, value);
    }

    pending.resolve(value);

    for (const [otherId, req] of this.pendingRequests.entries()) {
      if (req.prompt === promptText) {
        clearTimeout(req.timer);
        this.pendingRequests.delete(otherId);
        req.resolve(value);
      }
    }

    return true;
  }

  getEnv(): NodeJS.ProcessEnv {
    if (!this.initialized) {
      return {};
    }

    return {
      GIT_ASKPASS: this.askpassScriptPath,
      SSH_ASKPASS: this.askpassScriptPath,
      SSH_ASKPASS_REQUIRE: 'force',
      DISPLAY: process.env.DISPLAY || ':0',
      AIDER_DESK_ELECTRON_PATH: process.execPath,
      AIDER_DESK_ASKPASS_SCRIPT: this.askpassClientPath,
      AIDER_DESK_ASKPASS_PORT: String(this.port),
      AIDER_DESK_ASKPASS_TOKEN: this.token,
    };
  }

  clearSessionCache(): void {
    this.sessionCache.clear();
  }

  async close(): Promise<void> {
    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('GitAskpassManager closed'));
      this.pendingRequests.delete(id);
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server?.close(() => resolve());
      });
      this.server = null;
    }

    const env = this.getEnv();
    for (const key of Object.keys(env)) {
      delete process.env[key];
    }

    this.initialized = false;
  }
}

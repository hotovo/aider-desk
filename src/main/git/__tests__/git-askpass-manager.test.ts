import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import http from 'http';

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { InputPromptData } from '@common/types';

import { GitAskpassManager } from '../git-askpass-manager';

import { EventManager } from '@/events';

describe('GitAskpassManager', () => {
  let tmpDir: string;
  let mockEventManager: EventManager;
  let sentPrompt: InputPromptData | null = null;
  let manager: GitAskpassManager;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'askpass-test-'));
    sentPrompt = null;
    mockEventManager = {
      sendInputPrompt: vi.fn((prompt: InputPromptData) => {
        sentPrompt = prompt;
      }),
    } as unknown as EventManager;

    manager = new GitAskpassManager(mockEventManager, tmpDir);
  });

  afterEach(async () => {
    await manager.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates askpass scripts and initializes server on an ephemeral port', async () => {
    await manager.init();

    const env = manager.getEnv();
    expect(env.GIT_ASKPASS).toBeDefined();
    expect(env.SSH_ASKPASS).toBeDefined();
    expect(env.SSH_ASKPASS_REQUIRE).toBe('force');
    expect(env.AIDER_DESK_ASKPASS_PORT).toBeDefined();
    expect(parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10)).toBeGreaterThan(0);
    expect(env.AIDER_DESK_ASKPASS_TOKEN).toBeDefined();

    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('handles prompt request and resolves with user answer', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;

    const payload = JSON.stringify({
      token,
      prompt: "Enter passphrase for key '/home/test/.ssh/id_ed25519':",
    });

    const responsePromise = new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
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
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    // Wait for the prompt to be dispatched
    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    expect(sentPrompt?.type).toBe('password');
    expect(sentPrompt?.allowRememberSession).toBe(true);
    expect(sentPrompt?.message).toBe("Enter passphrase for key '/home/test/.ssh/id_ed25519':");

    // Respond with password
    manager.respond(sentPrompt!.id, 'my-secret-passphrase');

    const response = await responsePromise;
    expect(response.statusCode).toBe(200);
    const json = JSON.parse(response.body);
    expect(json.answer).toBe('my-secret-passphrase');
  });

  it('detects confirmation prompt for host authenticity', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;

    const payload = JSON.stringify({
      token,
      prompt: "The authenticity of host 'github.com' can't be established. Are you sure you want to continue connecting (yes/no/[fingerprint])?",
    });

    const responsePromise = new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
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
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    expect(sentPrompt?.type).toBe('confirmation');
    expect(sentPrompt?.title).toBe('git.askpass.confirmationTitle');

    manager.respond(sentPrompt!.id, 'yes');
    const response = await responsePromise;
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).answer).toBe('yes');
  });

  it('detects username prompt', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;

    const payload = JSON.stringify({
      token,
      prompt: "Username for 'https://github.com':",
    });

    const responsePromise = new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
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
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    expect(sentPrompt?.type).toBe('text');
    expect(sentPrompt?.title).toBe('git.askpass.usernameTitle');

    manager.respond(sentPrompt!.id, 'octocat');
    const response = await responsePromise;
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).answer).toBe('octocat');
  });

  it('handles cancellation by user with HTTP 400', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;

    const payload = JSON.stringify({
      token,
      prompt: 'Password:',
    });

    const responsePromise = new Promise<{ statusCode: number }>((resolve, reject) => {
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
          res.resume();
          res.on('end', () => resolve({ statusCode: res.statusCode || 0 }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    // User cancels by responding with null
    manager.respond(sentPrompt!.id, null);

    const response = await responsePromise;
    expect(response.statusCode).toBe(400);
  });

  it('rejects unauthorized requests with invalid token', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);

    const payload = JSON.stringify({
      token: 'invalid-token',
      prompt: 'Password:',
    });

    const response = await new Promise<{ statusCode: number }>((resolve, reject) => {
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
          res.resume();
          res.on('end', () => resolve({ statusCode: res.statusCode || 0 }));
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    expect(response.statusCode).toBe(403);
  });

  it('caches answer in memory when rememberSession is true', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;
    const promptText = "Enter passphrase for key '/id_rsa':";

    const makeRequest = () => {
      const payload = JSON.stringify({ token, prompt: promptText });
      return new Promise<{ statusCode: number; answer: string }>((resolve, reject) => {
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
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, answer: JSON.parse(body).answer }));
          },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    };

    // First request
    const firstPromise = makeRequest();
    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    // Respond with rememberSession: true
    manager.respond(sentPrompt!.id, 'saved-password', true);
    const firstResult = await firstPromise;
    expect(firstResult.answer).toBe('saved-password');

    // Second request with exact same prompt should be answered immediately from cache
    sentPrompt = null;
    const secondResult = await makeRequest();
    expect(secondResult.answer).toBe('saved-password');
    expect(sentPrompt).toBeNull(); // Did not need to ask user again!

    // Clear cache
    manager.clearSessionCache();

    // Third request should prompt user again
    const thirdPromise = makeRequest();
    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });
    manager.respond(sentPrompt!.id, 'new-password');
    const thirdResult = await thirdPromise;
    expect(thirdResult.answer).toBe('new-password');
  });

  it('deduplicates concurrent prompts for the same prompt string', async () => {
    await manager.init();
    const env = manager.getEnv();
    const port = parseInt(env.AIDER_DESK_ASKPASS_PORT!, 10);
    const token = env.AIDER_DESK_ASKPASS_TOKEN!;
    const promptText = "Enter passphrase for key '/id_concurrent':";

    const makeRequest = () => {
      const payload = JSON.stringify({ token, prompt: promptText });
      return new Promise<{ statusCode: number; answer: string }>((resolve, reject) => {
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
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => resolve({ statusCode: res.statusCode || 0, answer: JSON.parse(body).answer }));
          },
        );
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    };

    let promptCount = 0;
    (mockEventManager.sendInputPrompt as Mock).mockImplementation((prompt: InputPromptData) => {
      sentPrompt = prompt;
      promptCount++;
    });

    const p1 = makeRequest();
    const p2 = makeRequest();

    await vi.waitFor(() => {
      expect(sentPrompt).not.toBeNull();
    });

    // Only one prompt sent to UI
    expect(promptCount).toBe(1);

    manager.respond(sentPrompt!.id, 'concurrent-pass');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.answer).toBe('concurrent-pass');
    expect(r2.answer).toBe('concurrent-pass');
  });
});

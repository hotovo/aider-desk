/**
 * Proxy lifecycle management — adapted from pi-cursor (github.com/schultzp2020/pi-extensions).
 *
 * Manages the cursor-proxy child process from the extension side:
 * spawn, discover via stdout ready signal, heartbeat, token push, shutdown.
 *
 * Each project gets its own proxy process with conversation state stored
 * in ${projectDir}/.aider-desk/cursor/.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';

interface CursorModel {
  id: string;
  name: string;
  reasoning: boolean;
  contextWindow: number;
  maxTokens: number;
  supportsImages: boolean;
  contextWindowMaxMode?: number;
  supportsMaxMode?: boolean;
}

const HEARTBEAT_INTERVAL_MS = 10_000;
const PROXY_STARTUP_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_TIMEOUT_MS = 2_000;
const HEARTBEAT_TIMEOUT_MS = 2_000;
const TOKEN_PUSH_TIMEOUT_MS = 2_000;
const MODEL_FETCH_TIMEOUT_MS = 10_000;

export interface ProxyConnection {
  port: number;
  pid: number;
  heartbeatTimer: ReturnType<typeof setInterval>;
  sessionId: string;
  child: ChildProcess;
}

export interface ProxySpawnConfig {
  accessToken: string;
  conversationDir: string;
  nativeToolsMode: string;
  maxMode: boolean;
  fast: boolean;
  thinking: boolean;
  maxRetries: number;
}

function portFilePath(conversationDir: string): string {
  return join(conversationDir, 'cursor-proxy.json');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface ProxyInfo {
  port: number;
  pid: number;
}

function readPortFile(conversationDir: string): ProxyInfo | null {
  const portFile = portFilePath(conversationDir);
  try {
    if (!existsSync(portFile)) {
      return null;
    }
    const data = JSON.parse(readFileSync(portFile, 'utf8')) as ProxyInfo;
    if (data.port && data.pid && isProcessAlive(data.pid)) {
      return data;
    }
    try {
      unlinkSync(portFile);
    } catch {
      // Ignore cleanup errors
    }
    return null;
  } catch {
    return null;
  }
}

function writePortFile(conversationDir: string, info: ProxyInfo): void {
  mkdirSync(conversationDir, { recursive: true });
  writeFileSync(portFilePath(conversationDir), JSON.stringify(info));
}

export async function checkProxyHealth(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${String(port)}/internal/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendHeartbeat(port: number, sessionId: string): Promise<void> {
  try {
    await fetch(`http://localhost:${String(port)}/internal/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(HEARTBEAT_TIMEOUT_MS),
    });
  } catch {
    // Heartbeat failures are non-fatal
  }
}

export async function pushToken(port: number, accessToken: string): Promise<void> {
  try {
    await fetch(`http://localhost:${String(port)}/internal/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access: accessToken }),
      signal: AbortSignal.timeout(TOKEN_PUSH_TIMEOUT_MS),
    });
  } catch {
    // Token push failures are non-fatal
  }
}

async function fetchModelsFromProxy(port: number): Promise<CursorModel[]> {
  const res = await fetch(`http://localhost:${String(port)}/internal/models`, {
    signal: AbortSignal.timeout(MODEL_FETCH_TIMEOUT_MS),
  });
  const data = (await res.json()) as { models: CursorModel[] };
  return data.models;
}

function resolveProxyEntry(): string {
  return resolve(__dirname, 'dist', 'proxy.js');
}

function startHeartbeat(
  port: number,
  pid: number,
  sessionId: string,
  child: ChildProcess,
): ReturnType<typeof setInterval> {
  void sendHeartbeat(port, sessionId);
  const timer = setInterval(() => {
    void sendHeartbeat(port, sessionId);
  }, HEARTBEAT_INTERVAL_MS);
  if (typeof timer === 'object' && 'unref' in timer) {
    timer.unref();
  }
  return timer;
}

export interface ConnectResult {
  port: number;
  models: CursorModel[];
  connection: ProxyConnection;
}

export async function connectToProxy(
  sessionId: string,
  spawnConfig: ProxySpawnConfig,
): Promise<ConnectResult> {
  // 1. Try existing proxy via port file
  const existing = readPortFile(spawnConfig.conversationDir);
  if (existing && (await checkProxyHealth(existing.port))) {
    await pushToken(existing.port, spawnConfig.accessToken);
    const models = await fetchModelsFromProxy(existing.port);
    const timer = startHeartbeat(existing.port, existing.pid, sessionId, null as unknown as ChildProcess);
    return {
      port: existing.port,
      models,
      connection: { port: existing.port, pid: existing.pid, heartbeatTimer: timer, sessionId, child: null as unknown as ChildProcess },
    };
  }

  // 2. No existing proxy — spawn a new one
  return spawnProxy(sessionId, spawnConfig);
}

async function spawnProxy(
  sessionId: string,
  spawnConfig: ProxySpawnConfig,
): Promise<ConnectResult> {
  const proxyEntry = resolveProxyEntry();

  if (!existsSync(proxyEntry)) {
    throw new Error(`Proxy entry not found at ${proxyEntry}. Run 'npm install' in the cursor extension directory to build it.`);
  }

  const child = spawn('node', [proxyEntry], {
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  // Accumulate stderr from the start so we can include it in error messages
  let stderrBuffer = '';
  child.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
  });

  // Send config on stdin
  child.stdin.write(`${JSON.stringify(spawnConfig)}\n`);
  child.stdin.end();

  // Read ready signal from stdout
  const rl = createInterface({ input: child.stdout });
  const readyLine = await new Promise<string>((resolvePromise, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Proxy startup timeout. Stderr:\n${stderrBuffer.trim() || '(none)'}`));
    }, PROXY_STARTUP_TIMEOUT_MS);
    rl.once('line', (line) => {
      clearTimeout(timeout);
      resolvePromise(line);
    });
    child.on('exit', (code) => {
      clearTimeout(timeout);
      const stderr = stderrBuffer.trim() || '(none)';
      reject(new Error(`Proxy exited with code ${String(code)}. Stderr:\n${stderr}`));
    });
  });
  rl.close();

  const ready = JSON.parse(readyLine) as { type: string; port: number; models?: CursorModel[] };
  if (ready.type !== 'ready' || !ready.port) {
    throw new Error(`Unexpected proxy output: ${readyLine}`);
  }

  // Write port file for potential reuse
  writePortFile(spawnConfig.conversationDir, { port: ready.port, pid: child.pid! });

  // Start heartbeat
  const timer = startHeartbeat(ready.port, child.pid!, sessionId, child);

  // Forward stderr (append to the already-running accumulation listener)
  child.stderr.on('data', (chunk: Buffer) => {
    process.stderr.write(`[cursor-proxy] ${chunk.toString()}`);
  });
  if (stderrBuffer) {
    process.stderr.write(`[cursor-proxy] ${stderrBuffer}`);
    stderrBuffer = '';
  }

  // Clean up if the proxy dies unexpectedly
  child.on('exit', (code) => {
    clearInterval(timer);
    try {
      unlinkSync(portFilePath(spawnConfig.conversationDir));
    } catch {
      // Ignore
    }
    console.error(`[cursor-proxy] Process exited unexpectedly with code ${String(code)}`);
  });

  child.unref();

  return {
    port: ready.port,
    models: ready.models ?? [],
    connection: { port: ready.port, pid: child.pid!, heartbeatTimer: timer, sessionId, child },
  };
}

export function stopProxy(connection: ProxyConnection | null, conversationDir: string): void {
  if (!connection) return;
  clearInterval(connection.heartbeatTimer);
  try {
    if (connection.child && typeof connection.child.kill === 'function') {
      connection.child.kill('SIGTERM');
    } else if (connection.pid) {
      process.kill(connection.pid, 'SIGTERM');
    }
  } catch {
    // Ignore kill errors
  }
  try {
    unlinkSync(portFilePath(conversationDir));
  } catch {
    // Ignore
  }
}

export async function cleanupSession(port: number, sessionId: string): Promise<void> {
  try {
    await fetch(`http://localhost:${String(port)}/internal/cleanup-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // Best-effort cleanup
  }
}

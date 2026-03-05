/**
 * Sandbox Extension - OS-level sandboxing for bash commands
 *
 * Uses @anthropic-ai/sandbox-runtime to enforce filesystem and network
 * restrictions on bash commands at the OS level (sandbox-exec on macOS,
 * bubblewrap on Linux).
 *
 * Config files (merged, project takes precedence):
 * - ~/.aider-desk/sandbox.json (global)
 * - <project>/.aider-desk/sandbox.json (project-local)
 *
 * Example .aider-desk/sandbox.json:
 * ```json
 * {
 *   "enabled": true,
 *   "network": {
 *     "allowedDomains": ["github.com", "*.github.com"],
 *     "deniedDomains": []
 *   },
 *   "filesystem": {
 *     "denyRead": ["~/.ssh", "~/.aws"],
 *     "allowWrite": [".", "/tmp"],
 *     "denyWrite": [".env"]
 *   }
 * }
 * ```
 *
 * Setup:
 * 1. Copy this file to ~/.aider-desk/extensions/
 * 2. Run `npm install @anthropic-ai/sandbox-runtime` in ~/.aider-desk/extensions/
 *
 * Linux also requires: bubblewrap, socat, ripgrep
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Extension, ExtensionContext, ToolCalledEvent } from '@aiderdesk/extensions';

interface SandboxConfig {
  enabled?: boolean;
  network?: {
    allowedDomains?: string[];
    deniedDomains?: string[];
  };
  filesystem?: {
    denyRead?: string[];
    allowWrite?: string[];
    denyWrite?: string[];
  };
  ignoreViolations?: Record<string, string[]>;
  enableWeakerNestedSandbox?: boolean;
}

const DEFAULT_CONFIG: SandboxConfig = {
  enabled: true,
  network: {
    allowedDomains: [
      'npmjs.org',
      '*.npmjs.org',
      'registry.npmjs.org',
      'registry.yarnpkg.com',
      'pypi.org',
      '*.pypi.org',
      'github.com',
      '*.github.com',
      'api.github.com',
      'raw.githubusercontent.com',
    ],
    deniedDomains: [],
  },
  filesystem: {
    denyRead: ['~/.ssh', '~/.aws', '~/.gnupg'],
    allowWrite: ['.', '/tmp'],
    denyWrite: ['.env', '.env.*', '*.pem', '*.key'],
  },
};

let sandboxEnabled = false;
let sandboxInitialized = false;
let SandboxManager: typeof import('@anthropic-ai/sandbox-runtime').SandboxManager | null = null;

function loadConfig(cwd: string): SandboxConfig {
  const projectConfigPath = join(cwd, '.aider-desk', 'sandbox.json');
  const globalConfigPath = join(homedir(), '.aider-desk', 'sandbox.json');

  let globalConfig: Partial<SandboxConfig> = {};
  let projectConfig: Partial<SandboxConfig> = {};

  if (existsSync(globalConfigPath)) {
    try {
      globalConfig = JSON.parse(readFileSync(globalConfigPath, 'utf-8'));
    } catch (e) {
      console.error(`Warning: Could not parse ${globalConfigPath}: ${e}`);
    }
  }

  if (existsSync(projectConfigPath)) {
    try {
      projectConfig = JSON.parse(readFileSync(projectConfigPath, 'utf-8'));
    } catch (e) {
      console.error(`Warning: Could not parse ${projectConfigPath}: ${e}`);
    }
  }

  return deepMerge(deepMerge(DEFAULT_CONFIG, globalConfig), projectConfig);
}

function deepMerge(base: SandboxConfig, overrides: Partial<SandboxConfig>): SandboxConfig {
  const result: SandboxConfig = { ...base };

  if (overrides.enabled !== undefined) {
    result.enabled = overrides.enabled;
  }
  if (overrides.network) {
    result.network = { ...base.network, ...overrides.network };
  }
  if (overrides.filesystem) {
    result.filesystem = { ...base.filesystem, ...overrides.filesystem };
  }
  if (overrides.ignoreViolations) {
    result.ignoreViolations = overrides.ignoreViolations;
  }
  if (overrides.enableWeakerNestedSandbox !== undefined) {
    result.enableWeakerNestedSandbox = overrides.enableWeakerNestedSandbox;
  }

  return result;
}

interface ExecResult {
  exitCode: number | null;
  output: string;
}

async function execSandboxedCommand(command: string, cwd: string, signal: AbortSignal | undefined, timeout?: number): Promise<ExecResult> {
  if (!existsSync(cwd)) {
    throw new Error(`Working directory does not exist: ${cwd}`);
  }

  if (!SandboxManager) {
    throw new Error('SandboxManager not initialized');
  }

  const wrappedCommand = await SandboxManager.wrapWithSandbox(command);

  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', wrappedCommand], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timedOut = false;
    let timeoutHandle: NodeJS.Timeout | undefined;
    let output = '';

    if (timeout !== undefined && timeout > 0) {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            child.kill('SIGKILL');
          }
        }
      }, timeout * 1000);
    }

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });
    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('error', (err) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      reject(err);
    });

    const onAbort = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    child.on('close', (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      signal?.removeEventListener('abort', onAbort);

      if (signal?.aborted) {
        reject(new Error('aborted'));
      } else if (timedOut) {
        reject(new Error(`timeout:${timeout}`));
      } else {
        resolve({ exitCode: code, output });
      }
    });
  });
}

async function initializeSandbox(config: SandboxConfig, context: ExtensionContext): Promise<boolean> {
  const platform = process.platform;
  if (platform !== 'darwin' && platform !== 'linux') {
    context.log(`Sandbox not supported on ${platform}`, 'warn');
    return false;
  }

  try {
    const sandboxModule = await import('@anthropic-ai/sandbox-runtime');
    SandboxManager = sandboxModule.SandboxManager;

    await SandboxManager.initialize({
      network: config.network,
      filesystem: config.filesystem,
      ignoreViolations: config.ignoreViolations,
      enableWeakerNestedSandbox: config.enableWeakerNestedSandbox,
    });

    return true;
  } catch (err) {
    context.log(`Sandbox initialization failed: ${err instanceof Error ? err.message : err}`, 'error');
    return false;
  }
}

async function resetSandbox(): Promise<void> {
  if (sandboxInitialized && SandboxManager) {
    try {
      await SandboxManager.reset();
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function tryInitialize(context: ExtensionContext): Promise<void> {
  const projectContext = context.getProjectContext();
  if (!projectContext) {
    context.log('No project context available for sandbox initialization', 'warn');
    return;
  }

  const config = loadConfig(projectContext.baseDir);

  if (!config.enabled) {
    sandboxEnabled = false;
    context.log('Sandbox disabled via config', 'info');
    return;
  }

  const initialized = await initializeSandbox(config, context);

  if (initialized) {
    sandboxEnabled = true;
    sandboxInitialized = true;

    const networkCount = config.network?.allowedDomains?.length ?? 0;
    const writeCount = config.filesystem?.allowWrite?.length ?? 0;
    context.log(`Sandbox initialized: ${networkCount} domains, ${writeCount} write paths`, 'info');
  } else {
    sandboxEnabled = false;
  }
}

export default class SandboxExtension implements Extension {
  static metadata = {
    name: 'Sandbox Extension',
    version: '1.0.0',
    description: 'OS-level sandboxing for bash commands using @anthropic-ai/sandbox-runtime (sandbox-exec on macOS, bubblewrap on Linux)',
    author: 'wladimiiir',
    capabilities: ['events', 'tools'],
  };

  async onLoad(context: ExtensionContext) {
    context.log('Sandbox Extension loaded', 'info');
  }

  async onUnload() {
    await resetSandbox();
  }

  async onTaskInitialized(event, context: ExtensionContext): Promise<void> {
    context.log('onTaskInitialized called', 'info');
    await tryInitialize(context);
  }

  async onTaskClosed(): Promise<void> {
    await resetSandbox();
    sandboxEnabled = false;
    sandboxInitialized = false;
  }

  async onToolCalled(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>> {
    context.log(`onToolCalled triggered: toolName=${event.toolName}`, 'info');

    if (event.toolName !== 'power---bash') {
      return undefined;
    }

    if (!sandboxEnabled || !sandboxInitialized || !SandboxManager) {
      context.log(`Sandbox not active: enabled=${sandboxEnabled}, initialized=${sandboxInitialized}, manager=${!!SandboxManager}`, 'warn');

      const projectContext = context.getProjectContext();
      if (projectContext && !sandboxInitialized) {
        context.log('Attempting lazy initialization...', 'info');
        await tryInitialize(context);
      }

      if (!sandboxEnabled || !sandboxInitialized || !SandboxManager) {
        return undefined;
      }
    }

    const input = event.input as { command?: string; timeout?: number };
    const command = input?.command;
    const timeout = input?.timeout;

    if (typeof command !== 'string') {
      return undefined;
    }

    const taskContext = context.getTaskContext();
    if (!taskContext) {
      return undefined;
    }

    const projectContext = context.getProjectContext();
    if (!projectContext) {
      return undefined;
    }

    try {
      const result = await execSandboxedCommand(command, projectContext.baseDir, undefined, timeout);

      const output = result.output || `(exit code: ${result.exitCode})`;

      return {
        output: {
          content: [{ type: 'text', text: output }],
          details: { exitCode: result.exitCode, sandboxed: true },
        },
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      context.log(`Sandboxed command failed: ${errorMessage}`, 'error');

      return {
        output: {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
          details: { sandboxed: true },
        },
      };
    }
  }
}

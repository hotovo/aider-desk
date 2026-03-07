/**
 * ChunkHound Search Tool Extension
 *
 * Provides a 'chunkhound-search' tool via getTools() that uses ChunkHound
 * for semantic code search. This demonstrates how to register custom tools
 * that extend AiderDesk's capabilities.
 *
 * ChunkHound provides:
 * - Better semantic understanding of code
 * - Multi-hop BFS traversal for architectural exploration
 * - Support for 29+ programming languages
 * - Auto-indexing on project open
 * - Auto-reindexing when files are modified
 * - Proper abort handling for interrupted operations
 *
 * Prerequisites:
 * 1. Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh
 * 2. Install ChunkHound: uv tool install chunkhound
 * 3. Add .chunkhound.json to this extension folder with your embedding provider config
 *
 * Configuration:
 * Create .chunkhound.json in this extension folder with your embedding provider config.
 * See https://chunkhound.github.io/quickstart/ for details.
 *
 * Example .chunkhound.json for VoyageAI:
 * ```json
 * {
 *   "embedding": {
 *     "provider": "voyageai",
 *     "api_key": "pa-your-voyage-key"
 *   }
 * }
 * ```
 *
 * Example .chunkhound.json for OpenAI:
 * ```json
 * {
 *   "embedding": {
 *     "provider": "openai",
 *     "api_key": "sk-your-openai-key"
 *   }
 * }
 * ```
 *
 * Example .chunkhound.json for Ollama (local/offline):
 * ```json
 * {
 *   "embedding": {
 *     "provider": "openai",
 *     "base_url": "http://localhost:11434/v1",
 *     "model": "dengcao/Qwen3-Embedding-8B:Q5_K_M",
 *     "api_key": "dummy-key"
 *   }
 * }
 * ```
 */

import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

import type { Extension, ExtensionContext, ProjectStartedEvent, ToolFinishedEvent, ToolDefinition } from '@aiderdesk/extensions';

const CHUNKHOUND_DB_NAME = '.chunkhound.db';
const CHUNKHOUND_CONFIG_NAME = '.chunkhound.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const getConfigPath = function (): string {
  return join(__dirname, CHUNKHOUND_CONFIG_NAME);
};

const needsReindex: Record<string, boolean> = {};
const runningIndexProcesses: Map<string, { process: ChildProcess; promise: Promise<boolean> }> = new Map();
const runningSearchProcesses: Map<string, ChildProcess> = new Map();

const getSpawnEnv = function (configPath?: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (configPath) {
    env.CHUNKHOUND_CONFIG_FILE = configPath;
  }
  return env;
};

const execCommand = function (
  command: string,
  args: string[],
  cwd: string,
  signal?: AbortSignal,
  processTracker?: Map<string, ChildProcess>,
  configPath?: string,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: getSpawnEnv(configPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (processTracker) {
      processTracker.set(cwd, child);
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const onAbort = () => {
      child.kill('SIGTERM');
      if (processTracker) {
        processTracker.delete(cwd);
      }
      reject(new Error('Operation aborted'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (processTracker) {
        processTracker.delete(cwd);
      }
      reject(err);
    });

    child.on('close', (_code) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (processTracker) {
        processTracker.delete(cwd);
      }
      if (signal?.aborted) {
        reject(new Error('Operation aborted'));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
};

const isChunkhoundInstalled = async function (): Promise<boolean> {
  try {
    await execCommand('chunkhound', ['--version'], process.cwd());
    return true;
  } catch {
    return false;
  }
};

const hasConfig = function (): boolean {
  return existsSync(getConfigPath());
};

const hasIndex = function (projectDir: string): boolean {
  const dbPath = join(projectDir, CHUNKHOUND_DB_NAME);
  return existsSync(dbPath);
};

const getDbPath = function (projectDir: string): string {
  return join(projectDir, CHUNKHOUND_DB_NAME);
};

const runIndex = async function (projectDir: string, context: ExtensionContext, signal?: AbortSignal): Promise<boolean> {
  const existing = runningIndexProcesses.get(projectDir);
  if (existing) {
    context.log('Waiting for existing index process...', 'info');
    return existing.promise;
  }

  const dbPath = getDbPath(projectDir);
  const configPath = hasConfig() ? getConfigPath() : undefined;

  const args = ['index', '--db', dbPath];
  if (configPath) {
    args.push('--config', configPath);
  }

  context.log('Running ChunkHound index...', 'info');

  let resolvePromise: (value: boolean) => void;
  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  const child = spawn('chunkhound', args, {
    cwd: projectDir,
    env: getSpawnEnv(configPath),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  runningIndexProcesses.set(projectDir, { process: child, promise });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  const onAbort = () => {
    child.kill('SIGTERM');
    runningIndexProcesses.delete(projectDir);
    context.log('ChunkHound indexing aborted', 'info');
    resolvePromise!(false);
  };

  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  }

  child.on('error', (error) => {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    runningIndexProcesses.delete(projectDir);
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.log(`ChunkHound indexing failed: ${errorMsg}`, 'error');
    resolvePromise!(false);
  });

  child.on('close', (_code) => {
    if (signal) {
      signal.removeEventListener('abort', onAbort);
    }
    runningIndexProcesses.delete(projectDir);

    if (signal?.aborted) {
      resolvePromise!(false);
      return;
    }

    if (stderr && !stderr.includes('indexed')) {
      context.log(`ChunkHound indexing warnings: ${stderr}`, 'warn');
    }

    context.log(`ChunkHound indexing completed: ${stdout}`, 'info');
    needsReindex[projectDir] = false;
    resolvePromise!(true);
  });

  return promise;
};

const ensureIndexed = async function (projectDir: string, context: ExtensionContext, signal?: AbortSignal): Promise<boolean> {
  const existing = runningIndexProcesses.get(projectDir);
  if (existing) {
    context.log('Waiting for existing index process...', 'info');
    return existing.promise;
  }

  if (hasIndex(projectDir) && !needsReindex[projectDir]) {
    return true;
  }

  return runIndex(projectDir, context, signal);
};

const chunkhoundSearch = async function (
  query: string,
  projectDir: string,
  context: ExtensionContext,
  signal?: AbortSignal,
  pageSize?: number,
  offset?: number,
): Promise<string> {
  const indexed = await ensureIndexed(projectDir, context, signal);
  if (!indexed) {
    if (signal?.aborted) {
      return 'Error: Search was aborted.';
    }
    return 'Error: Failed to index project with ChunkHound. Make sure ChunkHound is installed and configured correctly.';
  }

  const dbPath = getDbPath(projectDir);
  const configPath = hasConfig() ? getConfigPath() : undefined;

  const args = ['search', '--db', dbPath, query];
  if (configPath) {
    args.push('--config', configPath);
  }
  if (pageSize !== undefined) {
    args.push('--page-size', String(pageSize));
  }
  if (offset !== undefined && offset > 0) {
    args.push('--offset', String(offset));
  }

  try {
    const { stdout, stderr } = await execCommand('chunkhound', args, projectDir, signal, runningSearchProcesses, configPath);

    if (stderr && !stdout) {
      context.log(`ChunkHound search error: ${stderr}`, 'error');
      return `Error: ChunkHound search failed: ${stderr}`;
    }

    return stdout.trim() || 'No results found.';
  } catch (error) {
    if (error instanceof Error && error.message === 'Operation aborted') {
      return 'Error: Search was aborted.';
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    context.log(`ChunkHound search failed: ${errorMsg}`, 'error');
    return `Error: ChunkHound search failed: ${errorMsg}`;
  }
};

const inputSchema = z.object({
  query: z.string().describe('Search query with Elasticsearch syntax. Use + for important terms.'),
  pageSize: z.number().optional().default(10).describe('Number of results per page'),
  offset: z.number().optional().default(0).describe('Page offset for results (0-based)'),
});

export default class ChunkhoundSearchExtension implements Extension {
  static metadata = {
    name: 'ChunkHound Search Tool Extension',
    version: '1.0.0',
    description: 'Replaces power semantic_search tool with ChunkHound for semantic code search',
    author: 'wladimiiir',
    capabilities: ['search'],
  };

  private initialized = false;
  private context: ExtensionContext | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    this.context = context;
    context.log('ChunkHound Search Tool Extension loading...', 'info');

    const installed = await isChunkhoundInstalled();
    if (!installed) {
      context.log('ChunkHound is not installed. Please install it with: uv tool install chunkhound', 'error');
      return;
    }

    if (!hasConfig()) {
      context.log('ChunkHound config not found. Please create .chunkhound.json in the extension folder.', 'error');
      return;
    }

    context.log('ChunkHound Search Tool Extension loaded successfully', 'info');
    this.initialized = true;
  }

  async onUnload(): Promise<void> {
    runningIndexProcesses.forEach(({ process }) => {
      process.kill('SIGTERM');
    });
    runningIndexProcesses.clear();

    runningSearchProcesses.forEach((process) => {
      process.kill('SIGTERM');
    });
    runningSearchProcesses.clear();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStartedEvent>> {
    if (!this.initialized) {
      return undefined;
    }

    const projectDir = event.baseDir;
    context.log(`Project opened: ${projectDir}`, 'info');

    if (!hasIndex(projectDir)) {
      context.log('Starting background indexing for new project...', 'info');
      runIndex(projectDir, context).catch((error) => {
        context.log(`Background indexing failed: ${error}`, 'error');
      });
    }

    return undefined;
  }

  async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>> {
    if (!this.initialized) {
      return undefined;
    }

    const fileEditTools = ['power---file_edit', 'power---file_write'];

    if (!fileEditTools.includes(event.toolName)) {
      return undefined;
    }

    const input = event.input as { filePath?: string } | undefined;
    const filePath = input?.filePath;

    if (!filePath) {
      return undefined;
    }

    context.log(`File modification detected: ${event.toolName} on ${filePath}`, 'info');

    const projectDir = context.getProjectDir();
    needsReindex[projectDir] = true;

    context.log('Marked project for reindexing before next search', 'debug');

    return undefined;
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    if (!this.initialized || !this.context) {
      return [];
    }

    const context = this.context;

    const searchTool: ToolDefinition<typeof inputSchema> = {
      // override power---semantic_search tool
      name: 'power---semantic_search',
      description:
        'Search code in repository using semantic search powered by ChunkHound. Use natural language queries with 2-5 descriptive words including key concepts and context. Can filter results with hints like ext:ts, dir:src, or lang:typescript. Use this tool first for any code-related questions to find relationships between files and identify files to change.',
      inputSchema,
      execute: async (input, signal) => {
        const { query, pageSize, offset } = input;

        if (!context) {
          return 'Error: Extension context not available.';
        }

        const projectDir = context.getProjectDir();
        context.log(`Running ChunkHound search: query="${query}", path="${projectDir}", pageSize=${pageSize ?? 10}, offset=${offset ?? 0}`, 'info');

        return chunkhoundSearch(query, projectDir, context, signal, pageSize, offset);
      },
    };

    return [searchTool];
  }
}

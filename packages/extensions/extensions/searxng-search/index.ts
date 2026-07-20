import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { request as httpRequest } from 'node:http';

import { z } from 'zod';
import { GenericContainer, PullPolicy, Wait } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';

import type { Extension, ExtensionContext, ProjectStartedEvent, ProjectStoppedEvent, ToolDefinition } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');
const settingsYml = readFileSync(join(__dirname, './settings.yml'), 'utf-8');

const SEARXNG_IMAGE = 'searxng/searxng:latest';
const SEARXNG_INTERNAL_PORT = 8080;
const CONTAINER_STARTUP_TIMEOUT_MS = 120_000;

enum ContainerState {
  Idle = 'idle',
  Starting = 'starting',
  Started = 'started',
  Error = 'error',
}

interface SearXngConfig {
  mode: 'docker' | 'url';
  url: string;
}

const DEFAULT_CONFIG: SearXngConfig = {
  mode: 'docker',
  url: '',
};

const inputSchema = z.object({
  query: z.string().describe('The search query to execute.'),
  language: z.string().optional().default('en').describe('Language to search in (e.g., "en", "es", "fr"). Default: "en".'),
  categories: z.string().optional().describe('Comma-separated list of categories (e.g., "news,science", "images", "it").'),
  maxResults: z.number().int().min(1).optional().default(5).describe('Maximum number of results to return. Default: 5.'),
});

type SearchInput = z.infer<typeof inputSchema>;

interface SearchResult {
  title: string;
  url: string;
  engine: string;
  content?: string;
}

const formatResultsAsMarkdown = (results: SearchResult[], query: string, maxResults: number): string => {
  if (results.length === 0) {
    return `No results found for "${query}".`;
  }

  const lines: string[] = [];
  lines.push(`## Search Results: "${query}" (${results.length} result${results.length === 1 ? '' : 's'})`);
  lines.push('');

  for (const result of results) {
    lines.push(`### [${result.title}](${result.url})`);
    lines.push(`_Engine: ${result.engine}_`);
    if (result.content) {
      lines.push('');
      lines.push(result.content);
    }
    lines.push('');
  }

  if (results.length >= maxResults) {
    lines.push('---');
    lines.push(`${maxResults} results limit reached. Increase maxResults for more.`);
  }

  return lines.join('\n');
};

const execSearXng = (
  args: string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> => {
  return new Promise((resolve, reject) => {
    const cliBin = join(__dirname, 'node_modules', '.bin', 'searchxng');

    const child = spawn(cliBin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const onAbort = () => {
      child.kill('SIGTERM');
      reject(new Error('Search was cancelled by user.'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.on('error', (err) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      reject(err);
    });

    child.on('close', (code) => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      if (signal?.aborted) {
        reject(new Error('Search was cancelled by user.'));
        return;
      }
      resolve({ stdout, stderr, exitCode: code });
    });
  });
};

export default class SearXngSearchExtension implements Extension {
  static metadata = {
    name: 'SearXNG Search',
    version: '1.0.2',
    description: 'Web search tool using SearXNG with auto-starting Docker container support',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/searxng-search/icon.png',
    author: 'wladimiiir',
    capabilities: ['tools', 'search'],
  };

  private configPath = join(__dirname, 'config.json');
  private containerState: ContainerState = ContainerState.Idle;
  private startedContainer: StartedTestContainer | null = null;
  private containerUrl: string = '';
  private containerStartPromise: Promise<void> | null = null;
  private containerError: string = '';

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('[searxng-search] extension loaded', 'info');

    const config = this.getConfigDataSync();
    if (config.mode === 'docker') {
      this.startContainer(context).catch(() => {});
    }
  }

  async onUnload(): Promise<void> {
    await this.stopContainer();
  }

  async onProjectStarted(event: ProjectStartedEvent, context: ExtensionContext): Promise<void> {
    context.log(`[searxng-search] project started: ${event.baseDir}`, 'info');
  }

  async onProjectStopped(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void> {
    context.log(`[searxng-search] project stopped: ${event.baseDir}`, 'info');
  }

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(_context: ExtensionContext): Promise<SearXngConfig> {
    return this.getConfigDataSync();
  }

  async saveConfigData(configData: unknown, _context: ExtensionContext): Promise<unknown> {
    const merged: SearXngConfig = { ...DEFAULT_CONFIG, ...(configData as Partial<SearXngConfig>) };
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');

    if (merged.mode === 'docker' && this.containerState === ContainerState.Idle) {
      this.startContainer(_context).catch(() => {});
    } else if (merged.mode === 'url' && this.containerState !== ContainerState.Idle) {
      await this.stopContainer();
    }

    return merged;
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'search',
        description:
          'Search the web using a SearXNG instance. Returns web search results with titles, URLs, and snippets. Supports language filtering and category selection.',
        inputSchema,
        execute: async (input, signal, context) => {
          return this.executeSearch(input as SearchInput, signal, context);
        },
      },
    ];
  }

  private getConfigDataSync(): SearXngConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch {
      // fall back to defaults
    }
    return { ...DEFAULT_CONFIG };
  }

  private async startContainer(context: ExtensionContext): Promise<void> {
    if (this.containerState === ContainerState.Started || this.containerState === ContainerState.Starting) {
      return;
    }

    this.containerState = ContainerState.Starting;
    this.containerError = '';
    this.containerStartPromise = this.doStartContainer(context);

    try {
      await this.containerStartPromise;
    } catch {
      // Error is handled inside doStartContainer
    }
  }

  private async doStartContainer(context: ExtensionContext): Promise<void> {
    try {
      context.log('[searxng-search] starting SearXNG container...', 'info');

      const container = await new GenericContainer(SEARXNG_IMAGE)
        .withExposedPorts(SEARXNG_INTERNAL_PORT)
        .withPullPolicy(PullPolicy.alwaysPull())
        .withCopyContentToContainer([
          {
            content: settingsYml,
            target: '/etc/searxng/settings.yml',
          },
        ])
        .withWaitStrategy(
          Wait.forHttp('/search?q=test&format=json', SEARXNG_INTERNAL_PORT)
            .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS),
        )
        .withStartupTimeout(CONTAINER_STARTUP_TIMEOUT_MS)
        .start();

      const host = container.getHost();
      const port = container.getMappedPort(SEARXNG_INTERNAL_PORT);
      const url = `http://${host}:${port}`;

      context.log('[searxng-search] container process started, verifying HTTP connectivity...', 'info');

      await this.verifyHttpConnectivity(url);

      this.startedContainer = container;
      this.containerUrl = url;
      this.containerState = ContainerState.Started;

      context.log(`[searxng-search] container ready at ${this.containerUrl}`, 'info');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.containerState = ContainerState.Error;
      this.containerError = errorMsg;
      context.log(`[searxng-search] failed to start container: ${errorMsg}`, 'error');
    }
  }

  private verifyHttpConnectivity(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts = 20;
      const delayMs = 1500;
      let attempts = 0;

      const attempt = () => {
        attempts++;
        const req = httpRequest(`${url}/search?q=test&format=json`, { method: 'GET', timeout: 5000 }, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`SearXNG returned status ${res.statusCode}`));
          }
        });

        req.on('error', (err) => {
          if (attempts < maxAttempts) {
            setTimeout(attempt, delayMs);
          } else {
            reject(new Error(`SearXNG HTTP check failed after ${maxAttempts} attempts: ${err.message}`));
          }
        });

        req.on('timeout', () => {
          req.destroy();
          if (attempts < maxAttempts) {
            setTimeout(attempt, delayMs);
          } else {
            reject(new Error(`SearXNG HTTP check timed out after ${maxAttempts} attempts`));
          }
        });

        req.end();
      };

      attempt();
    });
  }

  private async stopContainer(): Promise<void> {
    if (this.startedContainer) {
      try {
        await this.startedContainer.stop();
      } catch {
        // best effort
      }
      this.startedContainer = null;
    }

    this.containerState = ContainerState.Idle;
    this.containerUrl = '';
    this.containerStartPromise = null;
  }

  private getEndpointUrl(): string | null {
    const config = this.getConfigDataSync();

    if (config.mode === 'url' && config.url) {
      return config.url.replace(/\/+$/, '');
    }

    if (config.mode === 'docker' && this.containerState === ContainerState.Started && this.containerUrl) {
      return this.containerUrl;
    }

    return null;
  }

  private async executeSearch(input: SearchInput, signal: AbortSignal | undefined, context: ExtensionContext): Promise<string> {
    const config = this.getConfigDataSync();

    if (config.mode === 'docker') {
      if (this.containerState === ContainerState.Starting) {
        context.getTaskContext()?.addLogMessage('info', 'Preparing the SearXNG container...');
        context.log('[searxng-search] waiting for container to start...', 'info');

        if (this.containerStartPromise) {
          try {
            await this.containerStartPromise;
          } catch {
            // Error handled in doStartContainer
          }
        }
      }

      if (this.containerState === ContainerState.Idle) {
        context.log('[searxng-search] container not started, attempting to start...', 'info');
        await this.startContainer(context);
      }

      if (this.containerState === ContainerState.Error) {
        const errorMsg = `SearXNG container failed to start: ${this.containerError}`;
        context.getTaskContext()?.addLogMessage('error', errorMsg);
        context.log(`[searxng-search] ${errorMsg}`, 'error');
        return `Error: ${errorMsg}. You can switch to "Existing SearXNG instance" mode in the extension settings and provide a URL to a running instance.`;
      }

      if (this.containerState !== ContainerState.Started) {
        const errorMsg = 'SearXNG container is not available.';
        context.getTaskContext()?.addLogMessage('error', errorMsg);
        return `Error: ${errorMsg}`;
      }
    }

    const endpointUrl = this.getEndpointUrl();
    if (!endpointUrl) {
      const modeHint = config.mode === 'docker'
        ? 'Docker container is not running. Make sure Docker is installed and running.'
        : 'Please configure a SearXNG URL in the extension settings.';
      return `Error: No SearXNG endpoint available. ${modeHint}`;
    }

    const args: string[] = [input.query, '-e', endpointUrl, '-j'];

    if (input.language) {
      args.push('-l', input.language);
    }
    if (input.categories) {
      args.push('-c', input.categories);
    }
    if (input.maxResults) {
      args.push('-m', String(input.maxResults));
    }

    context.log(`[searxng-search] searching: "${input.query}" on ${endpointUrl}`, 'info');

    try {
      const result = await execSearXng(args, signal);

      if (result.exitCode !== 0) {
        const errorDetail = result.stderr || result.stdout || 'Unknown error';
        context.log(`[searxng-search] search failed: ${errorDetail}`, 'error');
        return `Search error: ${errorDetail}`;
      }

      const output = result.stdout.trim();
      if (!output) {
        return `No results found for "${input.query}".`;
      }

      try {
        const parsed = JSON.parse(output);

        if (!parsed.results || !Array.isArray(parsed.results)) {
          return output;
        }

        const searchResults: SearchResult[] = parsed.results
          .slice(0, input.maxResults)
          .map((r: Record<string, unknown>) => ({
            title: String(r.title || 'Untitled'),
            url: String(r.url || ''),
            engine: Array.isArray(r.engines) ? r.engines.join(', ') : String(r.engines || 'unknown'),
            content: r.content ? String(r.content) : undefined,
          }));

        return formatResultsAsMarkdown(searchResults, input.query, input.maxResults);
      } catch {
        return output;
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'Search was cancelled by user.') {
        return 'Search was cancelled by user.';
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      context.getTaskContext()?.addLogMessage('error', `Search failed: ${errorMsg}`);
      context.log(`[searxng-search] search error: ${errorMsg}`, 'error');
      return `Search error: ${errorMsg}`;
    }
  }
}

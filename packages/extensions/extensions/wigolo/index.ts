import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';
import type { LocalClient } from 'wigolo-sdk/local';

import type { Extension, ExtensionContext, ToolDefinition } from '@aiderdesk/extensions';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCAL_WIGOLO_BIN = join(__dirname, 'node_modules', '.bin', 'wigolo');

const configComponentJsx = readFileSync(join(__dirname, './ConfigComponent.jsx'), 'utf-8');

interface WigoloConfig {
  command: string;
  provider: string;
  apiKey: string;
  hybridSearch: boolean;
  env: Record<string, string>;
}

const DEFAULT_CONFIG: WigoloConfig = {
  command: '',
  provider: '',
  apiKey: '',
  hybridSearch: false,
  env: {},
};

const configPath = join(__dirname, 'config.json');

const getConfigDataSync = (): WigoloConfig => {
  try {
    if (existsSync(configPath)) {
      const data = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // fall back to defaults
  }
  return { ...DEFAULT_CONFIG };
};

enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Error = 'error',
}

const searchSchema = z.object({
  query: z.string().describe('Search query — use keywords, not natural language questions'),
  max_results: z.number().int().min(1).max(20).optional().describe('Max results (default 5)'),
  include_domains: z.array(z.string()).optional().describe('Only return results from these domains'),
  exclude_domains: z.array(z.string()).optional().describe('Exclude results from these domains'),
  category: z.enum(['general', 'news', 'code', 'docs', 'papers', 'images']).optional().describe('Search category'),
  from_date: z.string().optional().describe('ISO date — results after this date'),
  to_date: z.string().optional().describe('ISO date — results before this date'),
  time_range: z.enum(['day', 'week', 'month', 'year']).optional().describe('Time range filter'),
  format: z.enum(['full', 'context']).optional().describe("'context' returns a single token-budgeted string for LLM injection"),
});

const fetchSchema = z.object({
  url: z.string().url().describe('URL to fetch'),
  section: z.string().optional().describe('Extract content under this heading only'),
  render_js: z.enum(['auto', 'always', 'never']).optional().describe('JS rendering: auto (default), always (force browser), never (HTTP only)'),
  max_chars: z.number().int().min(0).optional().describe('Maximum characters to return'),
  use_auth: z.boolean().optional().describe('Use stored browser session for auth pages'),
});

const crawlSchema = z.object({
  url: z.string().url().describe('Seed URL to start crawling from'),
  strategy: z.enum(['bfs', 'dfs', 'sitemap', 'map']).optional().describe('Crawl strategy (default: bfs). Use sitemap for doc sites, map for URL discovery only'),
  max_depth: z.number().int().min(0).optional().describe('Maximum link depth (default 2)'),
  max_pages: z.number().int().min(1).optional().describe('Maximum pages to crawl (default 20)'),
  include_patterns: z.array(z.string()).optional().describe('URL regex whitelist'),
  exclude_patterns: z.array(z.string()).optional().describe('URL regex blacklist'),
});

const findSimilarSchema = z
  .object({
    url: z.string().optional().describe('URL to find similar pages for'),
    text: z.string().optional().describe('Text to find similar pages for'),
    max_results: z.number().int().min(1).max(20).optional().describe('Max results (default 5)'),
  })
  .refine((data) => data.url || data.text, {
    message: 'Either url or text must be provided',
  });

const researchSchema = z.object({
  question: z.string().describe('Research topic or question'),
  max_depth: z.number().int().min(1).max(10).optional().describe('Research depth: 2=quick, 3=standard, 5=thorough'),
  max_sources: z.number().int().min(1).optional().describe('Maximum sources to consult'),
});

const agentSchema = z.object({
  prompt: z.string().describe('The goal or question to investigate'),
  max_steps: z.number().int().min(1).max(50).optional().describe('Maximum agent steps (default 10)'),
});

export default class WigoloExtension implements Extension {
  static metadata = {
    name: 'wigolo',
    version: '1.0.0',
    description:
      'Local-first web search, fetch, crawl & research tools powered by wigolo. No API keys required for core functionality.',
    iconUrl:
      'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/wigolo/icon.png',
    // Icon source: wigolo brand assets (w monogram), AGPL-3.0, (c) KnockOutEZ
    author: 'wladimiiir',
    capabilities: ['tools', 'search'],
  };

  private localClient: LocalClient | null = null;
  private connectionState: ConnectionState = ConnectionState.Disconnected;
  private connectionError = '';
  private connectionPromise: Promise<LocalClient | null> | null = null;

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('[wigolo] extension loaded', 'info');
    this.ensureClient(context).catch(() => {});
  }

  async onUnload(): Promise<void> {
    await this.disconnect();
  }

  async onProjectStarted(_event: { baseDir: string }, context: ExtensionContext): Promise<void> {
    this.ensureClient(context).catch(() => {});
  }

  getConfigComponent(_context: ExtensionContext): string {
    return configComponentJsx;
  }

  async getConfigData(
    _context: ExtensionContext,
  ): Promise<WigoloConfig & { connectionState: string; connectionError: string }> {
    return {
      ...getConfigDataSync(),
      connectionState: this.connectionState,
      connectionError: this.connectionError,
    };
  }

  async saveConfigData(configData: unknown, context: ExtensionContext): Promise<unknown> {
    const incoming = configData as Partial<WigoloConfig>;
    const merged: WigoloConfig = {
      command: incoming.command ?? DEFAULT_CONFIG.command,
      provider: incoming.provider ?? DEFAULT_CONFIG.provider,
      apiKey: incoming.apiKey ?? DEFAULT_CONFIG.apiKey,
      hybridSearch: incoming.hybridSearch ?? DEFAULT_CONFIG.hybridSearch,
      env: incoming.env ?? {},
    };

    writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');

    await this.disconnect();
    this.ensureClient(context).catch(() => {});

    return {
      ...merged,
      connectionState: this.connectionState,
      connectionError: this.connectionError,
    };
  }

  getTools(_context: ExtensionContext): ToolDefinition[] {
    return [
      {
        name: 'web-search',
        description:
          'Search the web for information on any topic. Returns titles, URLs, relevance scores, ' +
          'and full extracted markdown content. Supports domain filtering, date ranges, and categories.',
        inputSchema: searchSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.search(input as never));
        },
      },
      {
        name: 'web-fetch',
        description:
          'Fetch a specific web page and return clean markdown content. Supports JavaScript rendering, ' +
          'section extraction (extract only content under a heading), and authenticated browsing.',
        inputSchema: fetchSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.fetch(input as never));
        },
      },
      {
        name: 'web-crawl',
        description:
          'Crawl a website starting from a URL. Supports BFS, DFS, sitemap (fastest for doc sites), ' +
          'and map (URL-only discovery) strategies. Returns pages with titles and markdown content.',
        inputSchema: crawlSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.crawl(input as never));
        },
      },
      {
        name: 'find-similar',
        description:
          'Find pages semantically similar to a given URL or text from the local cache. ' +
          'No network calls — uses embedding-based similarity over previously fetched content.',
        inputSchema: findSimilarSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.findSimilar(input as never));
        },
      },
      {
        name: 'research',
        description:
          'Deep multi-step research on a topic. Automatically plans search queries, fetches pages, ' +
          'cross-references findings, and returns a structured research report with citations.',
        inputSchema: researchSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.research(input as never));
        },
      },
      {
        name: 'web-agent',
        description:
          'Autonomous web agent that breaks down complex goals into search/fetch/extract steps. ' +
          'Handles multi-hop reasoning, follow-up queries, and iterative refinement.',
        inputSchema: agentSchema,
        execute: async (input, _signal, context) => {
          return this.callTool(context, (client) => client.agent(input as never));
        },
      },
    ];
  }

  private async callTool(
    context: ExtensionContext,
    fn: (client: LocalClient['client']) => Promise<unknown>,
  ): Promise<unknown> {
    const localClient = await this.ensureClient(context);
    if (!localClient) {
      return {
        error: 'wigolo daemon is not running. Check the extension settings and ensure wigolo can be started.',
      };
    }
    try {
      return await fn(localClient.client);
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private ensureClient(context: ExtensionContext): Promise<LocalClient | null> {
    if (this.localClient && this.connectionState === ConnectionState.Connected) {
      return Promise.resolve(this.localClient);
    }
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionState = ConnectionState.Connecting;
    this.connectionError = '';

    this.connectionPromise = this.doConnect(context);
    return this.connectionPromise;
  }

  private async doConnect(context: ExtensionContext): Promise<LocalClient | null> {
    try {
      context.log('[wigolo] starting/connecting to wigolo daemon...', 'info');

      const config = getConfigDataSync();

      const { createLocalClient } = await import('wigolo-sdk/local');

      const options: Record<string, unknown> = {};

      if (config.command) {
        options.command = config.command.split(' ').filter((a) => a.length > 0);
      } else if (existsSync(LOCAL_WIGOLO_BIN)) {
        options.command = [LOCAL_WIGOLO_BIN];
      }

      for (const [key, value] of Object.entries(config.env)) {
        if (value) {
          process.env[key] = value;
        }
      }

      if (config.provider) {
        process.env.WIGOLO_LLM_PROVIDER = config.provider;
      }

      const localClient = await createLocalClient(options);

      this.localClient = localClient;
      this.connectionState = ConnectionState.Connected;
      this.connectionError = '';
      this.connectionPromise = null;

      context.log('[wigolo] connected successfully', 'info');
      return localClient;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.connectionState = ConnectionState.Error;
      this.connectionError = msg;
      this.connectionPromise = null;
      context.log(`[wigolo] failed to connect: ${msg}`, 'error');
      return null;
    }
  }

  private async disconnect(): Promise<void> {
    if (this.localClient) {
      try {
        await this.localClient.close();
      } catch {
        // best effort
      }
      this.localClient = null;
    }
    this.connectionState = ConnectionState.Disconnected;
    this.connectionError = '';
    this.connectionPromise = null;
  }
}

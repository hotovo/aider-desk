import path from 'path';
import fs from 'fs/promises';

import { v4 as uuidv4 } from 'uuid';
import { McpServerConfig, McpTool } from '@aider-desk/common/types';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

import logger from '@/logger';
import { AIDER_DESK_CACHE_DIR } from '@/constants';

const MCP_TOOLS_CACHE_FILE = path.join(AIDER_DESK_CACHE_DIR, 'mcp-tools-cache.json');
const MCP_TOOLS_CACHE_VERSION = 1;

export interface McpToolsCacheEntry {
  tools: McpTool[];
  cachedAt: number;
}

export interface McpToolsCache {
  version: number;
  servers: Record<string, McpToolsCacheEntry>;
}

// increasing timeout for MCP client requests
export const MCP_CLIENT_TIMEOUT = 600_000;

export interface McpConnector {
  client: McpSdkClient;
  serverName: string;
  tools: McpTool[];
  serverConfig: McpServerConfig;
}

export class McpManager {
  private mcpConnectors: Map<string, Promise<McpConnector>> = new Map();
  private currentInitId: string | null = null;
  private toolsCache: McpToolsCache = { version: MCP_TOOLS_CACHE_VERSION, servers: {} };

  async init() {
    await this.loadToolsCache();
  }

  async initMcpConnectors(
    mcpServers: Record<string, McpServerConfig>,
    projectDir: string | null,
    taskDir: string | null,
    forceReload = false,
    enabledServers?: string[],
  ): Promise<McpConnector[]> {
    const initId = uuidv4();

    this.currentInitId = initId;

    const connectorsToInitialize: Promise<McpConnector>[] = [];
    const serversToInitialize = enabledServers || Object.keys(mcpServers);
    for (const serverName of serversToInitialize) {
      const serverConfig = mcpServers[serverName];
      if (!serverConfig) {
        continue;
      }
      const scope = this.calculateServerScope(serverConfig, projectDir, taskDir, serverName);
      const existingConnector = this.getPooledConnector(scope, serverName);
      if (!existingConnector || forceReload) {
        const connectorPromise = this.initMcpConnector(projectDir, taskDir, serverName, serverConfig, forceReload, initId, scope);
        this.setPooledConnector(scope, serverName, connectorPromise);
        connectorsToInitialize.push(connectorPromise);

        if (existingConnector) {
          // close old connector
          try {
            const oldConnector = await existingConnector;
            await oldConnector.client.close();
            logger.info(`Closed old MCP connector for server: ${serverName}`);
          } catch (error) {
            logger.error(`Error closing old MCP connector for server ${serverName}:`, error);
          }
        }
      }
    }

    // Wait for initialization and update cache
    const initializedConnectors: McpConnector[] = [];
    for (const connectorPromise of connectorsToInitialize) {
      try {
        const connector = await connectorPromise;
        initializedConnectors.push(connector);
        this.updateToolsCache(connector.serverName, connector.tools);
      } catch (error) {
        logger.error('Failed to initialize MCP connector:', error);
      }
    }

    // Save cache to disk after initialization
    if (initializedConnectors.length > 0) {
      await this.saveToolsCache();
    }

    const allConnectors: Promise<McpConnector>[] = [];
    const serversToReturn = enabledServers || Object.keys(mcpServers);
    for (const serverName of serversToReturn) {
      const serverConfig = mcpServers[serverName];
      if (!serverConfig) {
        continue;
      }
      const scope = this.calculateServerScope(serverConfig, projectDir, taskDir, serverName);
      const connector = this.getPooledConnector(scope, serverName);
      if (connector) {
        allConnectors.push(connector);
      }
    }

    const results = await Promise.allSettled(allConnectors);
    const successfullyResolvedConnectors: McpConnector[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfullyResolvedConnectors.push(result.value);
      } else {
        const serverNames = Object.keys(allConnectors);
        // Ensure index is within bounds for serverNames, though it should be if Object.values and Object.keys maintain order
        const failedServerName = serverNames[index] || 'unknown server';
        logger.warn(`Connector promise for server '${failedServerName}' was rejected when trying to get all connectors:`, result.reason);
      }
    });
    return successfullyResolvedConnectors;
  }

  private async initMcpConnector(
    projectDir: string | null,
    taskDir: string | null,
    serverName: string,
    config: McpServerConfig,
    forceReload = false,
    initId?: string,
    scope: string = 'global',
  ): Promise<McpConnector> {
    const oldConnectorPromise = this.getPooledConnector(scope, serverName);

    config = this.interpolateServerConfig(config, projectDir, taskDir);

    let oldConnector: McpConnector | null = null;
    if (oldConnectorPromise) {
      try {
        oldConnector = await oldConnectorPromise;

        if (initId !== this.currentInitId) {
          logger.info('MCP initialization aborted as a new request has been received.');
          return oldConnector;
        }
      } catch (error) {
        logger.warn(`Error retrieving old MCP connector for server ${serverName}:`, error);
      }

      if (oldConnector && (forceReload || !this.compareServerConfig(oldConnector.serverConfig, config))) {
        try {
          await oldConnector.client.close();
          logger.info(`Closed old MCP connector for server: ${serverName}`);
          oldConnector = null; // Clear the old client reference
        } catch (closeError) {
          logger.error(`Error closing old MCP connector for server ${serverName}:`, closeError);
        }
      }
    }

    if (oldConnector) {
      logger.debug(`Using existing MCP connector for server: ${serverName}`);
      return oldConnector;
    }

    return this.createMcpConnector(serverName, config, projectDir, taskDir).catch((error) => {
      logger.error(`MCP Client creation failed for server during init: ${serverName}`, error);
      throw error;
    });
  }

  async close(): Promise<void> {
    await this.closeAllPooledConnectors();
    logger.debug('MCP clients closed and record cleared/updated.');
  }

  private interpolateServerConfig(serverConfig: McpServerConfig, projectDir: string | null, taskDir: string | null): McpServerConfig {
    const config = JSON.parse(JSON.stringify(serverConfig)) as McpServerConfig;

    const interpolateValue = (value: string): string => {
      // Replace ${projectDir} with the project root directory
      let result = value.replace(/\${projectDir}/g, projectDir || '.');
      // Replace ${taskDir} with the task directory (worktree dir or project root)
      result = result.replace(/\${taskDir}/g, taskDir || projectDir || '.');
      return result;
    };

    if (config.env) {
      const newEnv: Record<string, string> = {};

      Object.keys(config.env).forEach((key) => {
        if (typeof config.env![key] === 'string') {
          newEnv[key] = interpolateValue(config.env![key]);
        } else {
          newEnv[key] = config.env![key];
        }
      });

      config.env = newEnv;
    }

    if (config.args) {
      config.args = config.args.map(interpolateValue);
    }

    return config;
  }

  private hasInterpolation(value: string, pattern: string): boolean {
    return value.includes(pattern);
  }

  private configHasInterpolation(serverConfig: McpServerConfig, pattern: string): boolean {
    if (serverConfig.command && this.hasInterpolation(serverConfig.command, pattern)) {
      return true;
    }
    if (serverConfig.url && this.hasInterpolation(serverConfig.url, pattern)) {
      return true;
    }
    if (serverConfig.args) {
      for (const arg of serverConfig.args) {
        if (typeof arg === 'string' && this.hasInterpolation(arg, pattern)) {
          return true;
        }
      }
    }
    if (serverConfig.env) {
      for (const envValue of Object.values(serverConfig.env)) {
        if (typeof envValue === 'string' && this.hasInterpolation(envValue, pattern)) {
          return true;
        }
      }
    }
    if (serverConfig.headers) {
      for (const headerValue of Object.values(serverConfig.headers)) {
        if (typeof headerValue === 'string' && this.hasInterpolation(headerValue, pattern)) {
          return true;
        }
      }
    }
    return false;
  }

  private calculateServerScope(serverConfig: McpServerConfig, projectDir: string | null, taskDir: string | null, serverName: string): string {
    const hasProjectDirInterpolation = this.configHasInterpolation(serverConfig, '${projectDir}');
    const hasTaskDirInterpolation = this.configHasInterpolation(serverConfig, '${taskDir}');

    let scope: string;
    if (!hasProjectDirInterpolation && !hasTaskDirInterpolation) {
      // No interpolation: scope = ${taskDir || projectDir || 'global'}
      scope = taskDir || projectDir || 'global';
    } else if (hasProjectDirInterpolation && !hasTaskDirInterpolation) {
      // Has ${projectDir} only: scope = ${projectDir || 'global'}
      scope = projectDir || 'global';
    } else {
      // Has both ${projectDir} and ${taskDir}: scope = ${projectDir}:${taskDir}
      scope = projectDir ? `${projectDir}:${taskDir || ''}` : 'global';
    }

    logger.info(`Calculated scope for MCP server: ${serverName}`, {
      scope,
      hasProjectDirInterpolation,
      hasTaskDirInterpolation,
      projectDir,
      taskDir,
    });

    return scope;
  }

  private async createMcpConnector(serverName: string, config: McpServerConfig, projectDir: string | null, taskDir: string | null): Promise<McpConnector> {
    logger.info(`Initializing MCP client for server: ${serverName}`);
    logger.debug(`Server configuration: ${JSON.stringify(config)}`);

    const client = new McpSdkClient(
      {
        name: 'aider-desk-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      },
    );

    if (config.command) {
      const env = { ...config.env };
      if (!env.PATH && process.env.PATH) {
        env.PATH = process.env.PATH;
      }
      if (!env.HOME && process.env.HOME) {
        env.HOME = process.env.HOME;
      }

      // Handle npx command on Windows
      let command = config.command;
      let args = config.args || [];
      if (process.platform === 'win32' && command === 'npx') {
        command = 'cmd.exe';
        args = ['/c', 'npx', ...args];
      }

      // If command is 'docker', ensure '--init' is present after 'run'
      // so the container properly handles SIGINT and SIGTERM
      if (command === 'docker') {
        let runSubcommandIndex = -1;

        // Find the index of 'run'. This handles both 'docker run' and 'docker container run'.
        const runIndex = args.indexOf('run');

        if (runIndex !== -1) {
          // Verify it's likely the actual 'run' subcommand
          // e.g., 'run' is the first arg, or it follows 'container'
          if (runIndex === 0 || (runIndex === 1 && args[0] === 'container')) {
            runSubcommandIndex = runIndex;
          }
        }

        if (runSubcommandIndex !== -1) {
          // Check if '--init' already exists anywhere in the arguments
          // (Docker might tolerate duplicates, but it's cleaner not to add it if present)
          if (!args.includes('--init')) {
            // Insert '--init' immediately after the 'run' subcommand
            args.splice(runSubcommandIndex + 1, 0, '--init');
            logger.debug(`Added '--init' flag after 'run' for server ${serverName} docker command.`);
          }
        } else {
          // Log a warning if we couldn't confidently find the 'run' command
          // This might happen with unusual docker commands defined in the config
          logger.warn(`Could not find 'run' subcommand at the expected position in docker args for server ${serverName} from config.`);
        }
      }

      const transport = new StdioClientTransport({
        command,
        args,
        env,
        cwd: taskDir || projectDir || undefined,
      });

      logger.debug(`Connecting to MCP server using STDIO: ${serverName}`);
      await client.connect(transport);
      logger.debug(`Connected to MCP server: ${serverName}`);
    } else if (config.url) {
      const baseUrl = new URL(config.url);
      try {
        const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
          requestInit: {
            headers: config.headers,
          },
        });
        logger.debug(`Connecting to MCP server using Streamable HTTP: ${serverName}`);
        await client.connect(transport);
        logger.debug(`Connected to MCP server: ${serverName}`);
      } catch (error) {
        logger.debug(`Failed to connect to MCP server using Streamable HTTP: ${serverName}`, { message: (error as Error).message });

        const sseTransport = new SSEClientTransport(baseUrl, {
          requestInit: {
            headers: config.headers,
          },
        });
        logger.debug(`Connecting to MCP server using SSE: ${serverName}`);
        await client.connect(sseTransport);
        logger.debug(`Connected to MCP server: ${serverName}`);
      }
    } else {
      throw new Error(`MCP server ${serverName} has invalid configuration: missing command or url`);
    }

    // Get tools from this server using the SDK client
    logger.debug(`Fetching tools for MCP server: ${serverName}`);
    const toolsResponse = (await client.listTools(undefined, {
      timeout: MCP_CLIENT_TIMEOUT,
    })) as unknown as { tools: McpTool[] }; // Cast back to expected structure
    const toolsList = toolsResponse.tools;
    logger.debug(`Found ${toolsList.length} tools for MCP server: ${serverName}`);

    const clientHolder: McpConnector = {
      client,
      serverName,
      serverConfig: config,
      tools: toolsList.map((tool) => ({
        ...tool,
        serverName,
      })),
    };

    logger.info(`MCP client initialized successfully for server: ${serverName}`);
    return clientHolder;
  }

  async getMcpServerTools(serverName: string, config?: McpServerConfig): Promise<McpTool[] | null> {
    const cachedTools = this.getCachedTools(serverName);
    if (cachedTools) {
      return cachedTools;
    }

    let connectorPromise = this.getPooledConnector('global', serverName);
    if (!connectorPromise && config) {
      connectorPromise = this.initMcpConnector(null, null, serverName, config!);
      this.setPooledConnector('global', serverName, connectorPromise);
    }
    if (connectorPromise) {
      try {
        const connector = await connectorPromise;
        return connector.tools;
      } catch (error) {
        logger.error(`Error retrieving tools for MCP server ${serverName}, client promise rejected:`, error);
        throw error;
      }
    }
    logger.warn(`No MCP client promise found for server: ${serverName}`);
    return null;
  }

  private compareServerConfig(config: McpServerConfig, otherConfig: McpServerConfig) {
    return JSON.stringify(config) === JSON.stringify(otherConfig);
  }

  private async loadToolsCache(): Promise<void> {
    try {
      const cacheFile = MCP_TOOLS_CACHE_FILE;
      await fs.mkdir(AIDER_DESK_CACHE_DIR, { recursive: true });
      await fs.access(cacheFile);
      const cachedData = await fs.readFile(cacheFile, 'utf-8');
      const cachedJson = JSON.parse(cachedData) as McpToolsCache;
      if (cachedJson.version === MCP_TOOLS_CACHE_VERSION) {
        this.toolsCache = cachedJson;
        logger.info('MCP tools cache loaded successfully');
      } else {
        logger.warn('MCP tools cache version mismatch, ignoring');
      }
    } catch {
      logger.debug('MCP tools cache file not found or invalid, starting with empty cache');
      this.toolsCache = { version: MCP_TOOLS_CACHE_VERSION, servers: {} };
    }
  }

  async saveToolsCache(): Promise<void> {
    try {
      await fs.mkdir(AIDER_DESK_CACHE_DIR, { recursive: true });
      await fs.writeFile(MCP_TOOLS_CACHE_FILE, JSON.stringify(this.toolsCache, null, 2));
      logger.debug('MCP tools cache saved successfully');
    } catch (error) {
      logger.error('Error saving MCP tools cache:', error);
    }
  }

  getCachedTools(serverName: string): McpTool[] | null {
    const cacheEntry = this.toolsCache.servers[serverName];
    if (!cacheEntry) {
      return null;
    }
    logger.debug(`Returning cached tools for server: ${serverName}`);
    return cacheEntry.tools;
  }

  updateToolsCache(serverName: string, tools: McpTool[]): void {
    this.toolsCache.servers[serverName] = {
      tools,
      cachedAt: Date.now(),
    };
    logger.debug(`Updated cache for server: ${serverName}`);
  }

  // Pool methods
  private getPoolKey(scope: string, serverName: string): string {
    return `${scope}:${serverName}`;
  }

  private getPooledConnector(scope: string, serverName: string): Promise<McpConnector> | undefined {
    return this.mcpConnectors.get(this.getPoolKey(scope, serverName));
  }

  private setPooledConnector(scope: string, serverName: string, connector: Promise<McpConnector>): void {
    this.mcpConnectors.set(this.getPoolKey(scope, serverName), connector);
  }

  private async closeAllPooledConnectors(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const [key, connectorPromise] of this.mcpConnectors.entries()) {
      closePromises.push(
        (async () => {
          try {
            const connector = await connectorPromise;
            await connector.client.close();
            logger.debug(`Closed pooled connector for ${key}`);
          } catch (error) {
            logger.error(`Error closing pooled connector for ${key}:`, error);
          }
        })(),
      );
    }
    await Promise.all(closePromises);
    this.mcpConnectors.clear();
    logger.debug('All pooled connectors closed');
  }

  async reloadAllServers(mcpServers: Record<string, McpServerConfig>, force: boolean): Promise<void> {
    logger.info('Reloading all MCP servers');
    this.toolsCache.servers = {};
    await this.initMcpConnectors(mcpServers, null, null, force);
    logger.info('All MCP servers reloaded');
  }

  async reloadSingleServer(serverName: string, config: McpServerConfig): Promise<McpTool[]> {
    logger.info(`Reloading single MCP server: ${serverName}`);

    const scope = 'global';
    const poolKey = this.getPoolKey(scope, serverName);

    const connectorPromise = this.getPooledConnector(scope, serverName);
    if (connectorPromise) {
      try {
        const connector = await connectorPromise;
        await connector.client.close();
        logger.debug(`Closed connector for server: ${serverName}`);
      } catch (error) {
        logger.error(`Error closing connector for server ${serverName}:`, error);
      }
      this.mcpConnectors.delete(poolKey);
    }

    delete this.toolsCache.servers[serverName];

    const newConnectorPromise = this.initMcpConnector(null, null, serverName, config);
    this.setPooledConnector(scope, serverName, newConnectorPromise);

    try {
      const connector = await newConnectorPromise;
      this.updateToolsCache(serverName, connector.tools);
      await this.saveToolsCache();
      logger.info(`Successfully reloaded MCP server: ${serverName}`);
      return connector.tools;
    } catch (error) {
      logger.error(`Failed to reload MCP server ${serverName}:`, error);
      this.mcpConnectors.delete(poolKey);
      throw error;
    }
  }
}

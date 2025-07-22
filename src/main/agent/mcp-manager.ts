import { v4 as uuidv4 } from 'uuid';
import { McpServerConfig, McpTool, SettingsData } from '@common/types';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';

import logger from '@/logger';

// increasing timeout for MCP client requests
export const MCP_CLIENT_TIMEOUT = 600_000;

export interface McpConnector {
  client: McpSdkClient;
  serverName: string;
  tools: McpTool[];
  serverConfig: McpServerConfig;
}

export class McpManager {
  private mcpConnectors: Record<string, Promise<McpConnector>> = {};
  private currentProjectDir: string | null = null;
  private currentInitId: string | null = null;

  async initMcpConnectors(
    mcpServers: Record<string, McpServerConfig>,
    projectDir: string | null = this.currentProjectDir,
    forceReload = false,
    enabledServers?: string[],
  ): Promise<McpConnector[]> {
    const initId = uuidv4();
    const activeServerNames = new Set(Object.keys(mcpServers));
    const connectorsToClose: Promise<McpConnector>[] = [];

    this.currentInitId = initId;

    for (const serverName of Object.keys(this.mcpConnectors)) {
      if (!activeServerNames.has(serverName)) {
        connectorsToClose.push(this.mcpConnectors[serverName]);
        delete this.mcpConnectors[serverName];
      }
    }

    await Promise.all(
      connectorsToClose.map(async (connectorPromise) => {
        try {
          const connector = await connectorPromise;
          await connector.client.close();
          logger.info(`Closed extraneous MCP connector for server: ${connector.serverName}`);
        } catch (error) {
          logger.error('Error closing extraneous MCP connector:', error);
        }
      }),
    );

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      this.mcpConnectors[serverName] = this.initMcpConnector(
        projectDir,
        serverName,
        serverConfig,
        forceReload || (!!projectDir && projectDir !== this.currentProjectDir),
        initId,
      );
    }
    this.currentProjectDir = projectDir;

    const enabledMcpConnectors = enabledServers
      ? enabledServers.filter((serverName) => this.mcpConnectors[serverName]).map((serverName) => this.mcpConnectors[serverName])
      : Object.values(this.mcpConnectors);

    return Promise.all(enabledMcpConnectors);
  }

  private async initMcpConnector(
    projectDir: string | null,
    serverName: string,
    config: McpServerConfig,
    forceReload = false,
    initId?: string,
  ): Promise<McpConnector> {
    const oldConnectorPromise = this.mcpConnectors[serverName];

    config = this.interpolateServerConfig(config, projectDir);

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

    return this.createMcpConnector(serverName, config, projectDir).catch((error) => {
      logger.error(`MCP Client creation failed for server during init: ${serverName}`, error);
      throw error;
    });
  }

  settingsChanged(_: SettingsData, newSettings: SettingsData) {
    void this.initMcpConnectors(newSettings.mcpServers);
  }

  async close(): Promise<void> {
    const closePromises = Object.entries(this.mcpConnectors).map(async ([serverName, connectorPromise]) => {
      try {
        const mcpConnector = await connectorPromise;
        await mcpConnector.client.close();
        logger.debug(`Closed MCP client for server: ${serverName}`);
      } catch (error) {
        logger.error(`Error closing or awaiting MCP client for server ${serverName}:`, error);
      }
    });

    await Promise.all(closePromises);
    logger.debug('MCP clients closed and record cleared/updated.');
  }

  private interpolateServerConfig(serverConfig: McpServerConfig, projectDir: string | null): McpServerConfig {
    const config = JSON.parse(JSON.stringify(serverConfig)) as McpServerConfig;

    const interpolateValue = (value: string): string => {
      return value.replace(/\${projectDir}/g, projectDir || '.');
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

  private async createMcpConnector(serverName: string, config: McpServerConfig, projectDir: string | null): Promise<McpConnector> {
    logger.info(`Initializing MCP client for server: ${serverName}`);
    logger.debug(`Server configuration: ${JSON.stringify(config)}`);

    const client = new McpSdkClient(
      {
        name: 'aider-desk-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
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
        cwd: projectDir || undefined,
      });

      logger.debug(`Connecting to MCP server using STDIO: ${serverName}`);
      await client.connect(transport);
      logger.debug(`Connected to MCP server: ${serverName}`);
    } else if (config.url) {
      const baseUrl = new URL(config.url);
      try {
        const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
          headers: config.headers,
        });
        logger.debug(`Connecting to MCP server using Streamable HTTP: ${serverName}`);
        await client.connect(transport);
        logger.debug(`Connected to MCP server: ${serverName}`);
      } catch {
        const sseTransport = new SSEClientTransport(baseUrl, {
          headers: config.headers,
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
    if (config) {
      // reload the connector if config is provided
      this.mcpConnectors[serverName] = this.initMcpConnector(this.currentProjectDir, serverName, config);
    }

    const connectorPromise = this.mcpConnectors[serverName];
    if (connectorPromise) {
      try {
        const connector = await connectorPromise;
        return connector.tools;
      } catch (error) {
        logger.error(`Error retrieving tools for MCP server ${serverName}, client promise rejected:`, error);
        return null;
      }
    }
    logger.warn(`No MCP client promise found for server: ${serverName}`);
    return null;
  }

  async getConnectors(): Promise<McpConnector[]> {
    const connectorPromises = Object.values(this.mcpConnectors);
    const results = await Promise.allSettled(connectorPromises);
    const successfullyResolvedConnectors: McpConnector[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfullyResolvedConnectors.push(result.value);
      } else {
        const serverNames = Object.keys(this.mcpConnectors);
        // Ensure index is within bounds for serverNames, though it should be if Object.values and Object.keys maintain order
        const failedServerName = serverNames[index] || 'unknown server';
        logger.warn(`Connector promise for server '${failedServerName}' was rejected when trying to get all connectors:`, result.reason);
      }
    });
    return successfullyResolvedConnectors;
  }

  private compareServerConfig(config: McpServerConfig, otherConfig: McpServerConfig) {
    return JSON.stringify(config) === JSON.stringify(otherConfig);
  }
}

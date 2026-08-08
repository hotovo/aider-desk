import path from 'path';
import fs from 'fs/promises';

import { v4 as uuidv4 } from 'uuid';
import { createMCPClient, UnauthorizedError as AiSdkUnauthorizedError, type CallToolResult, type ListToolsResult, type MCPClient } from '@ai-sdk/mcp';
import { type JSONValue } from '@ai-sdk/provider';
import { UnauthorizedError as McpSdkUnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Tool, type ToolExecutionOptions, type ToolSet } from 'ai';
import {
  AgentProfile,
  McpOAuthStatus,
  McpServerConfig,
  McpTool,
  McpToolInputSchema,
  PromptContext,
  ToolApprovalState,
  type McpOAuthStatusData,
} from '@common/types';
import { LlmProviderName } from '@common/agent';
import { delay } from '@common/utils';
import { TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { ApprovalManager } from './tools/approval-manager';
import { McpOAuthManager } from './mcp-oauth-manager';
import { truncateToolResult } from './utils';

import logger from '@/logger';
import { AIDER_DESK_CACHE_DIR } from '@/constants';
import { Task } from '@/task';

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

const MCP_CLIENT_TIMEOUT = 600_000;

export class McpAuthenticationRequiredError extends Error {
  constructor(serverName: string) {
    super(`MCP server '${serverName}' requires OAuth authentication. Connect it in Settings → Agents → Tools → MCP Servers.`);
    this.name = 'McpAuthenticationRequiredError';
  }
}

interface McpConnector {
  client: MCPClient;
  serverName: string;
  tools: McpTool[];
  toolDefinitions: ListToolsResult;
  serverConfig: McpServerConfig;
}

type McpClientTransport = Parameters<typeof createMCPClient>[0]['transport'];

export class McpManager {
  private mcpConnectors: Map<string, Promise<McpConnector>> = new Map();
  private connectorServerUrls: Map<string, string> = new Map();
  private currentInitId: string | null = null;
  private toolsCache: McpToolsCache = { version: MCP_TOOLS_CACHE_VERSION, servers: {} };

  constructor(private readonly oauthManager = new McpOAuthManager()) {}

  async init() {
    await Promise.all([this.loadToolsCache(), this.oauthManager.init()]);
  }

  async createToolset(
    task: Task,
    profile: AgentProfile,
    providerName: LlmProviderName,
    mcpServers: Record<string, McpServerConfig>,
    approvalManager: ApprovalManager,
    promptContext?: PromptContext,
  ): Promise<ToolSet> {
    let connectors: McpConnector[] = [];
    try {
      const initStartTime = Date.now();
      let loadingMessageShown = false;

      const loadingTimeout = setTimeout(() => {
        loadingMessageShown = true;
        task.addLogMessage('loading', 'Initializing MCP servers...', false, promptContext);
      }, 3000);

      try {
        connectors = await this.initMcpConnectors(mcpServers, task.getProjectDir(), task.getTaskDir(), false, profile.enabledServers);
      } finally {
        clearTimeout(loadingTimeout);
        if (loadingMessageShown) {
          task.addLogMessage('loading', undefined, false, promptContext);
        }
      }

      for (const serverName of profile.enabledServers) {
        const config = mcpServers[serverName];
        if (!config?.url) {
          continue;
        }
        const oauthStatus = await this.oauthManager.getStatus(config.url);
        if (oauthStatus.status === McpOAuthStatus.AuthenticationRequired || oauthStatus.status === McpOAuthStatus.Authorizing) {
          task.addLogMessage(
            'error',
            `MCP server '${serverName}' requires OAuth authentication. Connect it in Settings → Agents → Tools → MCP Servers.`,
            false,
            promptContext,
          );
        }
      }

      const initTime = Date.now() - initStartTime;
      logger.debug(`MCP servers initialized in ${initTime}ms`);
    } catch (error) {
      logger.error('Error initializing MCP clients:', error);
      task.addLogMessage('error', `Error initializing MCP clients: ${error}`, false, promptContext);
    }

    const toolSet: ToolSet = {};
    const lastToolCallTimeRef = { value: 0 };

    for (const mcpConnector of connectors) {
      if (!profile.enabledServers.includes(mcpConnector.serverName)) {
        continue;
      }

      const toolDefinitions = {
        ...mcpConnector.toolDefinitions,
        tools: mcpConnector.toolDefinitions.tools.map((toolDefinition) => ({
          ...toolDefinition,
          inputSchema: this.fixInputSchema(providerName, toolDefinition.inputSchema),
        })),
      } satisfies ListToolsResult;
      const mcpTools = mcpConnector.client.toolsFromDefinitions(toolDefinitions);

      for (const toolDefinition of toolDefinitions.tools) {
        const toolId = `${mcpConnector.serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDefinition.name}`;
        const normalizedToolId = toolId.toLowerCase().replaceAll(/\s+/g, '_');

        const approvalState = profile.toolApprovals[toolId];
        if (approvalState === ToolApprovalState.Never) {
          logger.debug(`Skipping tool due to 'Never' approval state: ${toolId}`);
          continue;
        }

        const mcpTool = mcpTools[toolDefinition.name];
        if (!mcpTool) {
          logger.warn(`AI SDK did not create MCP tool: ${toolId}`);
          continue;
        }

        toolSet[normalizedToolId] = this.wrapMcpTool(
          mcpConnector.serverName,
          toolDefinition.name,
          task,
          profile,
          mcpTool,
          approvalManager,
          lastToolCallTimeRef,
          promptContext,
        );
      }
    }

    return toolSet;
  }

  private wrapMcpTool(
    serverName: string,
    toolName: string,
    task: Task,
    profile: AgentProfile,
    toolDef: Tool,
    approvalManager: ApprovalManager,
    lastToolCallTimeRef: { value: number },
    promptContext?: PromptContext,
  ): Tool {
    const toolId = `${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolName}`;
    const originalExecute = toolDef.execute;
    if (!originalExecute) {
      throw new Error(`AI SDK MCP tool ${toolId} does not have an execute function`);
    }

    const execute = async (args: unknown, options: ToolExecutionOptions<unknown>) => {
      const input = args as Record<string, unknown> | undefined;
      task.addToolMessage(options.toolCallId, serverName, toolName, input, undefined, undefined, promptContext);

      const questionText = `Approve tool ${toolName} from ${serverName} MCP server?`;
      const questionSubject = input ? JSON.stringify(input) : undefined;
      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolId, input, toolId, questionText, questionSubject);

      if (!isApproved) {
        logger.warn(`Tool execution denied by user: ${toolId}`);
        return this.createMcpErrorResult(`Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`);
      }
      logger.debug(`Tool execution approved: ${toolId}`);

      const timeSinceLastCall = Date.now() - lastToolCallTimeRef.value;
      const currentMinTime = profile.minTimeBetweenToolCalls;
      const remainingDelay = currentMinTime - timeSinceLastCall;

      if (remainingDelay > 0) {
        logger.debug(`Delaying tool call by ${remainingDelay}ms to respect minTimeBetweenToolCalls (${currentMinTime}ms)`);
        await delay(remainingDelay);
      }

      try {
        const timeoutSignal = AbortSignal.timeout(MCP_CLIENT_TIMEOUT);
        const abortSignal = options.abortSignal ? AbortSignal.any([options.abortSignal, timeoutSignal]) : timeoutSignal;
        const response = await originalExecute(args, { ...options, abortSignal });

        logger.debug(`Tool ${toolName} returned response`, { response });

        if (response && typeof response === 'object' && 'content' in response && Array.isArray(response.content)) {
          for (const part of response.content) {
            if (part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string') {
              part.text = await truncateToolResult(part.text);
            }
          }
        }

        lastToolCallTimeRef.value = Date.now();
        return response;
      } catch (error) {
        lastToolCallTimeRef.value = Date.now();
        if (options.abortSignal?.aborted) {
          throw error;
        }

        logger.error(`Error calling tool ${toolId}:`, error);
        return this.createMcpErrorResult(`Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    const originalToModelOutput = toolDef.toModelOutput;
    const toModelOutput: Tool['toModelOutput'] = originalToModelOutput
      ? (options) => {
          if (this.isMcpCallToolResult(options.output)) {
            return originalToModelOutput(options);
          }
          return { type: 'json', value: options.output as JSONValue };
        }
      : undefined;

    logger.debug(`Wrapping AI SDK MCP tool: ${toolName}`, toolDef);
    return {
      ...toolDef,
      execute,
      ...(toModelOutput ? { toModelOutput } : {}),
    };
  }

  private createMcpErrorResult(message: string): CallToolResult {
    return {
      content: [{ type: 'text', text: message }],
      isError: true,
    };
  }

  private isMcpCallToolResult(value: unknown): value is CallToolResult {
    return typeof value === 'object' && value !== null && 'content' in value && Array.isArray(value.content);
  }

  private stripUnsupportedSchemaKeywords(schema: Record<string, unknown>): Record<string, unknown> {
    const unsupportedKeywords = [
      'propertyNames',
      'unevaluatedProperties',
      'dependentSchemas',
      'dependentRequired',
      'contains',
      'contentMediaType',
      'contentEncoding',
      'examples',
      '$defs',
      '$anchor',
      '$recursiveRef',
      '$recursiveAnchor',
    ];

    const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        if (unsupportedKeywords.includes(key)) {
          continue;
        }

        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            result[key] = value.map((item) => (item !== null && typeof item === 'object' ? processObject(item as Record<string, unknown>) : item));
          } else {
            result[key] = processObject(value as Record<string, unknown>);
          }
        } else {
          result[key] = value;
        }
      }

      return result;
    };

    return processObject(schema);
  }

  private fixInputSchema(provider: LlmProviderName, inputSchema: McpToolInputSchema): McpToolInputSchema {
    if (provider === 'gemini') {
      const fixedSchema = JSON.parse(JSON.stringify(inputSchema));

      const strippedSchema = this.stripUnsupportedSchemaKeywords(fixedSchema) as unknown as McpToolInputSchema;

      if (strippedSchema.properties) {
        for (const key of Object.keys(strippedSchema.properties)) {
          let property = strippedSchema.properties[key] as Record<string, unknown>;

          if (property.anyOf) {
            property = { any_of: property.anyOf };
            strippedSchema.properties[key] = property as import('json-schema').JSONSchema7Definition;
          } else if (property.oneOf) {
            property = { one_of: property.oneOf };
            strippedSchema.properties[key] = property as import('json-schema').JSONSchema7Definition;
          } else if (property.allOf) {
            property = { all_of: property.allOf };
            strippedSchema.properties[key] = property as import('json-schema').JSONSchema7Definition;
          } else {
            if (property.default !== undefined) {
              delete property.default;
            }

            if (property.type === 'string' && property.format && !['enum', 'date-time'].includes(property.format as string)) {
              logger.debug(`Removing unsupported format '${property.format}' for property '${key}' in Gemini schema`);
              delete property.format;
            }

            if (!property.type || property.type === 'null') {
              property.type = 'string';
            }
          }
        }
        if (Object.keys(strippedSchema.properties).length === 0) {
          strippedSchema.properties = {
            placeholder: {
              type: 'string',
              description: 'Placeholder property to satisfy Gemini schema requirements',
            },
          };
        }
      }

      return strippedSchema;
    }

    return inputSchema;
  }

  private async initMcpConnectors(
    mcpServers: Record<string, McpServerConfig>,
    projectDir: string | null,
    taskDir: string | null,
    forceReload = false,
    enabledServers?: string[],
  ): Promise<McpConnector[]> {
    logger.info('Initializing MCP connectors', {
      projectDir,
      taskDir,
      forceReload,
      enabledServers,
    });
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
        this.setPooledConnector(scope, serverName, connectorPromise, serverConfig);
        connectorsToInitialize.push(connectorPromise);

        if (existingConnector) {
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
        // Ensure index is within bounds for serverNames, though it should be if Object.values and Object.keys maintain order
        const serverNames = Object.keys(allConnectors);
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
          oldConnector = null;
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
      let result = value.replace(/\${projectDir}/g, projectDir || '.');
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
      scope = !serverConfig.command && serverConfig.url ? 'global' : taskDir || projectDir || 'global';
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

  private createClient(transport: McpClientTransport): Promise<MCPClient> {
    return createMCPClient({
      transport,
      clientName: 'aider-desk-client',
      version: '1.0.0',
    });
  }

  private async createMcpConnector(serverName: string, config: McpServerConfig, projectDir: string | null, taskDir: string | null): Promise<McpConnector> {
    logger.info(`Initializing MCP client for server: ${serverName}`);
    logger.debug(`Server configuration: ${JSON.stringify(config)}`);

    let client: MCPClient;

    if (config.command) {
      const env = { ...config.env };
      if (!env.PATH && process.env.PATH) {
        env.PATH = process.env.PATH;
      }
      if (!env.HOME && process.env.HOME) {
        env.HOME = process.env.HOME;
      }

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
          if (!args.includes('--init')) {
            args.splice(runSubcommandIndex + 1, 0, '--init');
            logger.debug(`Added '--init' flag after 'run' for server ${serverName} docker command.`);
          }
        } else {
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
      client = await this.createClient(transport);
      logger.debug(`Connected to MCP server: ${serverName}`);
    } else if (config.url) {
      const headers = config.headers ? { ...config.headers } : undefined;
      const oauthProvider = await this.oauthManager.getProvider(config.url);
      const mcpSdkOAuthProvider = await this.oauthManager.getMcpSdkProvider(config.url);
      const validatedFetch = this.oauthManager.createValidatedFetch(config.url);
      const transport = new StreamableHTTPClientTransport(new URL(config.url), {
        requestInit: { headers, redirect: 'error' },
        authProvider: mcpSdkOAuthProvider,
        fetch: validatedFetch,
      });

      try {
        logger.debug(`Connecting to MCP server using Streamable HTTP: ${serverName}`);
        client = await this.createClient(transport);
        logger.debug(`Connected to MCP server: ${serverName}`);
      } catch (error) {
        if (error instanceof McpSdkUnauthorizedError) {
          throw new McpAuthenticationRequiredError(serverName);
        }

        logger.debug(`Failed to connect to MCP server using Streamable HTTP: ${serverName}`, { message: (error as Error).message });
        logger.debug(`Connecting to MCP server using SSE: ${serverName}`);
        try {
          client = await this.createClient({
            type: 'sse',
            url: config.url,
            headers,
            authProvider: oauthProvider,
            redirect: 'error',
            fetch: validatedFetch,
          });
          logger.debug(`Connected to MCP server: ${serverName}`);
        } catch (sseError) {
          if (sseError instanceof AiSdkUnauthorizedError) {
            throw new McpAuthenticationRequiredError(serverName);
          }
          throw sseError;
        }
      }
    } else {
      throw new Error(`MCP server ${serverName} has invalid configuration: missing command or url`);
    }

    logger.debug(`Fetching tools for MCP server: ${serverName}`);
    const toolsResponse = await client.listTools({
      options: { timeout: MCP_CLIENT_TIMEOUT },
    });
    const toolsList = toolsResponse.tools;
    logger.debug(`Found ${toolsList.length} tools for MCP server: ${serverName}`);

    const connector: McpConnector = {
      client,
      serverName,
      serverConfig: config,
      toolDefinitions: toolsResponse,
      tools: toolsList.map((tool) => ({
        serverName,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };

    logger.info(`MCP client initialized successfully for server: ${serverName}`);
    return connector;
  }

  async getMcpServerTools(serverName: string, config?: McpServerConfig): Promise<McpTool[] | null> {
    const cachedTools = this.getCachedTools(serverName);
    if (cachedTools) {
      return cachedTools;
    }

    let connectorPromise = this.getPooledConnector('global', serverName);
    if (!connectorPromise && config) {
      connectorPromise = this.initMcpConnector(null, null, serverName, config!);
      this.setPooledConnector('global', serverName, connectorPromise, config);
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

  async getOAuthStatus(config: McpServerConfig): Promise<McpOAuthStatusData> {
    if (!config.url) {
      return { status: McpOAuthStatus.NotRequired };
    }
    return this.oauthManager.getStatus(config.url);
  }

  async startOAuth(serverName: string, config: McpServerConfig): Promise<string> {
    if (!config.url) {
      throw new Error(`MCP server '${serverName}' does not use a remote URL`);
    }

    let authorizationUrl = await this.oauthManager.startAuthorization(config.url);
    if (!authorizationUrl) {
      try {
        await this.reloadSingleServer(serverName, config);
      } catch (error) {
        if (!(error instanceof McpAuthenticationRequiredError)) {
          throw error;
        }
      }
      authorizationUrl = await this.oauthManager.startAuthorization(config.url);
    }
    if (!authorizationUrl) {
      throw new Error(`MCP server '${serverName}' did not provide an OAuth authorization URL`);
    }
    return authorizationUrl;
  }

  async completeOAuth(code: string, state: string): Promise<void> {
    const serverUrl = await this.oauthManager.completeAuthorization(code, state);
    await this.invalidateConnectorsForUrl(serverUrl);
  }

  async cancelOAuth(state: string): Promise<void> {
    await this.oauthManager.cancelAuthorization(state);
  }

  async disconnectOAuth(config: McpServerConfig): Promise<void> {
    if (!config.url) {
      return;
    }
    await this.oauthManager.disconnect(config.url);
    await this.invalidateConnectorsForUrl(config.url);
  }

  private async invalidateConnectorsForUrl(serverUrl: string): Promise<void> {
    const normalizedUrl = new URL(serverUrl).toString();
    const matchingKeys = Array.from(this.connectorServerUrls.entries())
      .filter(([, connectorUrl]) => connectorUrl === normalizedUrl)
      .map(([poolKey]) => poolKey);

    for (const poolKey of matchingKeys) {
      const connectorPromise = this.mcpConnectors.get(poolKey);
      if (connectorPromise) {
        try {
          const connector = await connectorPromise;
          await connector.client.close();
          delete this.toolsCache.servers[connector.serverName];
        } catch {
          const serverName = poolKey.slice(poolKey.indexOf(':') + 1);
          delete this.toolsCache.servers[serverName];
        }
      }
      this.mcpConnectors.delete(poolKey);
      this.connectorServerUrls.delete(poolKey);
    }
    await this.saveToolsCache();
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

  private getPoolKey(scope: string, serverName: string): string {
    return `${scope}:${serverName}`;
  }

  private getPooledConnector(scope: string, serverName: string): Promise<McpConnector> | undefined {
    return this.mcpConnectors.get(this.getPoolKey(scope, serverName));
  }

  private setPooledConnector(scope: string, serverName: string, connector: Promise<McpConnector>, config: McpServerConfig): void {
    const poolKey = this.getPoolKey(scope, serverName);
    this.mcpConnectors.set(poolKey, connector);
    if (config.url) {
      this.connectorServerUrls.set(poolKey, new URL(config.url).toString());
    } else {
      this.connectorServerUrls.delete(poolKey);
    }
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
    this.connectorServerUrls.clear();
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
      this.connectorServerUrls.delete(poolKey);
    }

    delete this.toolsCache.servers[serverName];

    const newConnectorPromise = this.initMcpConnector(null, null, serverName, config);
    this.setPooledConnector(scope, serverName, newConnectorPromise, config);

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

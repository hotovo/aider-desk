import { Project } from 'src/main/project';
import { AgentConfig, McpServerConfig, McpTool } from '@common/types';
import { ZodSchema } from 'zod';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js'; // Use the SDK client
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
import logger from 'src/main/logger';
import { delay, SERVER_TOOL_SEPARATOR } from '@common/utils';
import { LlmProvider } from '@common/llm-providers';

import type { JsonSchema } from '@n8n/json-schema-to-zod';
import type { Tool, ToolExecutionOptions } from 'ai';

// increasing timeout for MCP client requests
const MCP_CLIENT_TIMEOUT = 600_000;

export interface ClientHolder {
  client: McpSdkClient;
  serverName: string;
  tools: McpTool[];
}

const interpolateServerConfig = (serverConfig: McpServerConfig, project: Project | null): McpServerConfig => {
  const config = JSON.parse(JSON.stringify(serverConfig)) as McpServerConfig;

  const interpolateValue = (value: string): string => {
    return value.replace(/\${projectDir}/g, project?.baseDir || '.');
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

  config.args = config.args.map(interpolateValue);

  return config;
};

export const initMcpClient = async (serverName: string, originalServerConfig: McpServerConfig, project: Project | null): Promise<ClientHolder> => {
  const serverConfig = interpolateServerConfig(originalServerConfig, project);

  logger.info(`Initializing MCP client for server: ${serverName}`);
  logger.debug(`Server configuration: ${JSON.stringify(serverConfig)}`);

  const env = { ...serverConfig.env };
  if (!env.PATH) {
    env.PATH = process.env.PATH || '';
  }

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args,
    env,
  });

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

  logger.debug(`Connecting to MCP server: ${serverName}`);
  await client.connect(transport);
  logger.debug(`Connected to MCP server: ${serverName}`);

  // Get tools from this server using the SDK client
  logger.debug(`Fetching tools for MCP server: ${serverName}`);
  const toolsResponse = (await client.listTools(undefined, {
    timeout: MCP_CLIENT_TIMEOUT,
  })) as unknown as { tools: McpTool[] }; // Cast back to expected structure
  const toolsList = toolsResponse.tools;
  logger.debug(`Found ${toolsList.length} tools for MCP server: ${serverName}`);

  const clientHolder: ClientHolder = {
    client,
    serverName,
    tools: toolsList.map((tool) => ({
      ...tool,
      serverName,
    })),
  };

  logger.info(`MCP client initialized successfully for server: ${serverName}`);
  return clientHolder;
};

let lastToolCallTime = 0;

/**
 * Fixes the input schema for various providers.
 */
const fixInputSchema = (provider: LlmProvider, inputSchema: JsonSchema): JsonSchema => {
  if (provider.name === 'gemini') {
    // Deep clone to avoid modifying the original schema
    const fixedSchema = JSON.parse(JSON.stringify(inputSchema));

    if (fixedSchema.properties) {
      for (const key of Object.keys(fixedSchema.properties)) {
        const property = fixedSchema.properties[key];
        // gemini does not like "default" in the schema
        if (property.default !== undefined) {
          delete property.default;
        }

        if (property.type === 'string' && property.format && !['enum', 'date-time'].includes(property.format)) {
          logger.debug(`Removing unsupported format '${property.format}' for property '${key}' in Gemini schema`);
          delete property.format;
        }
      }
      if (Object.keys(fixedSchema.properties).length === 0) {
        // gemini requires at least one property in the schema
        fixedSchema.properties = {
          placeholder: {
            type: 'string',
            description: 'Placeholder property to satisfy Gemini schema requirements',
          },
        };
      }
    }

    return fixedSchema;
  }

  return inputSchema;
};

export const convertMpcToolToAiSdkTool = (
  provider: LlmProvider,
  agentConfig: AgentConfig,
  serverName: string,
  project: Project,
  mcpClient: McpSdkClient,
  toolDef: McpTool,
): Tool => {
  let zodSchema: ZodSchema;
  try {
    zodSchema = jsonSchemaToZod(fixInputSchema(provider, toolDef.inputSchema));
  } catch (e) {
    logger.error(`Failed to convert JSON schema to Zod for tool ${toolDef.name}:`, e);
    // Fallback to a generic object schema if conversion fails
    zodSchema = jsonSchemaToZod({ type: 'object', properties: {} });
  }

  const execute = async (params: { [x: string]: unknown } | undefined, { toolCallId, messages }: ToolExecutionOptions) => {
    logger.info('Messages: ', { messages });
    project.addToolMessage(toolCallId, serverName, toolDef.name, params);

    // Enforce minimum time between tool calls
    const timeSinceLastCall = Date.now() - lastToolCallTime;
    const remainingDelay = agentConfig.minTimeBetweenToolCalls - timeSinceLastCall;

    if (remainingDelay > 0) {
      logger.debug(`Delaying tool call by ${remainingDelay}ms to respect minTimeBetweenToolCalls`);
      await delay(remainingDelay);
    }

    try {
      const response = await mcpClient.callTool(
        {
          name: toolDef.name,
          arguments: params,
        },
        undefined,
        {
          timeout: MCP_CLIENT_TIMEOUT,
        },
      );

      logger.debug(`Tool ${toolDef.name} returned response`, { response });

      // Update last tool call time
      lastToolCallTime = Date.now();
      return response;
    } catch (error) {
      logger.error(`Error calling tool ${serverName}${SERVER_TOOL_SEPARATOR}${toolDef.name}:`, error);
      // Update last tool call time even if there's an error
      lastToolCallTime = Date.now();
      // Return an error message string to the agent
      return `Error executing tool ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
    }
  };

  logger.debug(`Converting MCP tool to AI SDK tool: ${toolDef.name}`, toolDef);

  return {
    description: toolDef.description ?? '',
    parameters: zodSchema,
    execute,
  };
};

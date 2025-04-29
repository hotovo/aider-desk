import { Project } from 'src/main/project';
import { McpServerConfig, McpTool, QuestionData, ToolApprovalState } from '@common/types';
import { ZodSchema } from 'zod';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Store } from 'src/main/store'; // Added Store
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
  if (!env.PATH && process.env.PATH) {
    env.PATH = process.env.PATH;
  }

  // Handle npx command on Windows
  let command = serverConfig.command;
  let args = serverConfig.args;
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
        logger.debug("Added '--init' flag after 'run' for docker command.");
      }
    } else {
      // Log a warning if we couldn't confidently find the 'run' command
      // This might happen with unusual docker commands defined in the config
      logger.warn("Could not find 'run' subcommand at the expected position in docker args. '--init' flag not added automatically.");
    }
  }

  const transport = new StdioClientTransport({
    command,
    args,
    env,
    cwd: project?.baseDir,
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

        if (property.anyOf) {
          property.any_of = property.anyOf;
          delete property.anyOf;
        }
        if (property.oneOf) {
          property.one_of = property.oneOf;
          delete property.oneOf;
        }
        if (property.allOf) {
          property.all_of = property.allOf;
          delete property.allOf;
        }

        // gemini does not like "default" in the schema
        if (property.default !== undefined) {
          delete property.default;
        }

        if (property.type === 'string' && property.format && !['enum', 'date-time'].includes(property.format)) {
          logger.debug(`Removing unsupported format '${property.format}' for property '${key}' in Gemini schema`);
          delete property.format;
        }

        if (!property.type || property.type === 'null') {
          property.type = 'string';
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

let lastToolCallTime = 0;

export const convertMpcToolToAiSdkTool = (
  provider: LlmProvider,
  serverName: string,
  project: Project,
  store: Store,
  mcpClient: McpSdkClient,
  toolDef: McpTool,
): Tool => {
  const toolId = `${serverName}${SERVER_TOOL_SEPARATOR}${toolDef.name}`;
  let zodSchema: ZodSchema;
  try {
    zodSchema = jsonSchemaToZod(fixInputSchema(provider, toolDef.inputSchema));
  } catch (e) {
    logger.error(`Failed to convert JSON schema to Zod for tool ${toolDef.name}:`, e);
    // Fallback to a generic object schema if conversion fails
    zodSchema = jsonSchemaToZod({ type: 'object', properties: {} });
  }

  const execute = async (args: { [x: string]: unknown } | undefined, { toolCallId }: ToolExecutionOptions) => {
    // --- Tool Approval Logic ---
    const currentSettings = store.getSettings();
    const currentAgentConfig = currentSettings.agentConfig; // Use current config
    const currentApprovalState = currentAgentConfig.toolApprovals[toolId] || ToolApprovalState.Always; // Default to Always

    if (currentApprovalState === ToolApprovalState.Never) {
      logger.warn(`Tool execution denied (Never): ${toolId}`);
      return `Tool execution denied by user configuration (${toolId}).`;
    }

    project.addToolMessage(toolCallId, serverName, toolDef.name, args);

    if (currentApprovalState === ToolApprovalState.Ask) {
      const questionData: QuestionData = {
        baseDir: project.baseDir,
        text: `Approve tool ${toolDef.name} from MCP ${serverName}?`,
        subject: `${JSON.stringify(args)}`,
        defaultAnswer: 'y',
        key: toolId, // Use toolId as the key for storing the answer
      };

      // Ask the question and wait for the answer
      const [yesNoAnswer, userInput] = await project.askQuestion(questionData);

      const isApproved = yesNoAnswer === 'y';

      if (!isApproved) {
        logger.warn(`Tool execution denied by user: ${toolId}`);
        return `Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`;
      }
      logger.debug(`Tool execution approved by user: ${toolId}`);
    } else {
      // If Always approved
      logger.debug(`Tool execution automatically approved (Always): ${toolId}`);
    }
    // --- End Tool Approval Logic ---

    // Enforce minimum time between tool calls (using potentially updated agentConfig)
    const timeSinceLastCall = Date.now() - lastToolCallTime;
    const currentMinTime = currentAgentConfig.minTimeBetweenToolCalls; // Use current value
    const remainingDelay = currentMinTime - timeSinceLastCall;

    if (remainingDelay > 0) {
      logger.debug(`Delaying tool call by ${remainingDelay}ms to respect minTimeBetweenToolCalls (${currentMinTime}ms)`);
      await delay(remainingDelay);
    }

    try {
      const response = await mcpClient.callTool(
        {
          name: toolDef.name,
          arguments: args,
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

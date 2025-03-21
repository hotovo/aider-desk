import { getActiveProvider, McpServerConfig, McpTool, UsageReportData } from '@common/types';
import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredTool, tool } from '@langchain/core/tools';
import { z } from 'zod';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { BedrockChat } from '@langchain/community/chat_models/bedrock';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { jsonSchemaToZod } from '@n8n/json-schema-to-zod';
import { v4 as uuidv4 } from 'uuid';
import { delay } from '@common/utils';
import { BaseMessage } from '@langchain/core/dist/messages/base';
import { isAnthropicProvider, isGeminiProvider, isOpenAiProvider, isBedrockProvider, LlmProvider, PROVIDER_MODELS } from '@common/llm-providers';
import { BaseChatModel } from '@langchain/core/dist/language_models/chat_models';

import logger from './logger';
import { Store } from './store';
import { Project } from './project';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

type TextContent =
  | string
  | {
      type: 'text';
      text: string;
    };

type ClientHolder = {
  client: Client;
  serverName: string;
  tools: McpTool[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTextContent = (content: any): content is TextContent => content?.type === 'text' || typeof content === 'string';

const extractTextContent = (content: unknown): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .filter(isTextContent)
      .map((c) => (typeof c === 'string' ? c : c.text))
      .join('\n\n');
  }

  if (typeof content === 'object' && content !== null && 'content' in content) {
    return extractTextContent((content as { content: unknown }).content);
  }

  return '';
};

const createAiderTool = () => {
  return tool(
    async (params: { prompt: string }) => {
      logger.info('Aider tool called with params:', params);
      // This is a noop tool that just returns the prompt
      return params.prompt;
    },
    {
      name: 'aider',
      description: 'Use the Aider AI pair programming assistant to perform coding tasks',
      schema: z.object({
        prompt: z.string().describe('The prompt in natural language to send to Aider for coding assistance including <OriginalPrompt>.'),
      }),
    },
  );
};

const calculateCost = (llmProvider: LlmProvider, sentTokens: number, receivedTokens: number) => {
  const providerModels = PROVIDER_MODELS[llmProvider.name];
  if (!providerModels) {
    return 0;
  }

  // Get the model name directly from the provider
  const model = llmProvider.model;
  if (!model) {
    return 0;
  }

  // Find the model cost configuration
  const modelCost = providerModels.models[model];
  if (!modelCost) {
    return 0;
  }

  // Calculate cost in dollars (costs are per million tokens)
  const inputCost = (sentTokens * modelCost.inputCost) / 1_000_000;
  const outputCost = (receivedTokens * modelCost.outputCost) / 1_000_000;

  return inputCost + outputCost;
};

export class McpAgent {
  private store: Store;
  private currentInitId: string | null = null;
  private clients: ClientHolder[] = [];
  private lastToolCallTime: number = 0;
  private currentProjectBaseDir: string | null = null;
  private isInterrupted: boolean = false;
  private messages: Map<string, BaseMessage[]> = new Map();

  constructor(store: Store) {
    this.store = store;
  }

  async init(project?: Project, initId = uuidv4()) {
    try {
      this.currentInitId = initId;
      await this.closeClients();
      const clients: ClientHolder[] = [];

      const { mcpConfig } = this.store.getSettings();

      // Initialize each MCP server
      for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
        const clientHolder = await this.initMcpClient(serverName, this.interpolateServerConfig(serverConfig, project));

        if (this.currentInitId !== initId) {
          return;
        }
        clients.push(clientHolder);
      }

      this.clients = clients;
      this.currentProjectBaseDir = project?.baseDir || null;
    } catch (error) {
      logger.error('MCP Client initialization failed:', error);
      throw error;
    }
  }

  private async closeClients() {
    for (const clientHolder of this.clients) {
      try {
        await clientHolder.client.close();
      } catch (error) {
        logger.error('Error closing MCP client:', error);
      }
    }
    this.clients = [];
  }

  private createLlm() {
    const { mcpConfig } = this.store.getSettings();
    const { providers } = mcpConfig;
    const provider = getActiveProvider(providers);

    if (!provider) {
      throw new Error('No active MCP provider found');
    }

    if (isAnthropicProvider(provider)) {
      if (!provider.apiKey) {
        throw new Error('Anthropic API key is required');
      }
      return new ChatAnthropic({
        model: provider.model,
        temperature: 0,
        maxTokens: 1000,
        apiKey: provider.apiKey,
      });
    } else if (isOpenAiProvider(provider)) {
      if (!provider.apiKey) {
        throw new Error('OpenAI API key is required');
      }
      return new ChatOpenAI({
        model: provider.model,
        // o3-mini does not support temperature
        temperature: provider.model === 'o3-mini' ? undefined : 0,
        maxTokens: 1000,
        apiKey: provider.apiKey,
      });
    } else if (isGeminiProvider(provider)) {
      if (!provider.apiKey) {
        throw new Error('Gemini API key is required');
      }
      return new ChatGoogleGenerativeAI({
        model: provider.model,
        temperature: 0,
        maxOutputTokens: 1000,
        apiKey: provider.apiKey,
      });
    } else if (isBedrockProvider(provider)) {
      if (!provider.accessKeyId || !provider.secretAccessKey || !provider.region) {
        throw new Error('AWS accessKeyId, secretAccessKey and region are required for Bedrock');
      }
      return new BedrockChat({
        model: provider.model,
        region: provider.region,
        credentials: {
          accessKeyId: provider.accessKeyId,
          secretAccessKey: provider.secretAccessKey,
        },
        temperature: 0,
        maxTokens: 1000,
      }) as BaseChatModel;
    } else {
      throw new Error(`Unsupported MCP provider: ${JSON.stringify(provider)}`);
    }
  }

  async getMcpServerTools(name: string, config: McpServerConfig, project?: Project): Promise<McpTool[] | null> {
    try {
      const clientHolder = await this.initMcpClient(name, this.interpolateServerConfig(config, project));
      const tools = clientHolder.tools;
      await clientHolder.client.close();
      return tools;
    } catch (error) {
      logger.error('Error getting MCP server tools:', error);
      return null;
    }
  }

  async runPrompt(project: Project, prompt: string): Promise<string | null> {
    const { mcpConfig } = this.store.getSettings();
    logger.debug('McpConfig:', mcpConfig);

    // Reset interruption flag
    this.isInterrupted = false;

    // Get the message history for this project, or create a new one if it doesn't exist
    let messages = this.messages.get(project.baseDir);
    if (!messages) {
      messages = [new SystemMessage(mcpConfig.systemPrompt)];
      this.messages.set(project.baseDir, messages);
    }

    // Add the user message to the message history
    messages.push(new HumanMessage(prompt));

    if (!mcpConfig.agentEnabled) {
      logger.debug('MCP agent disabled, returning original prompt');
      return prompt;
    }

    const tools = this.clients.filter((clientHolder) => !mcpConfig.disabledServers.includes(clientHolder.serverName));
    if (!tools.length) {
      logger.info('No tools found for prompt, returning original prompt');
      return prompt;
    }

    // Check if we need to reinitialize for a different project
    if (this.currentProjectBaseDir !== project.baseDir) {
      logger.info(`Reinitializing MCP clients for project: ${project.baseDir}`);
      try {
        await this.init(project, uuidv4());
      } catch (error) {
        logger.error('Error reinitializing MCP clients:', error);
        project.addLogMessage('error', `Error reinitializing MCP clients: ${error}`);
        return prompt;
      }
    }

    // Get MCP server tools
    const mcpServerTools = this.clients
      .filter((clientHolder) => !mcpConfig.disabledServers.includes(clientHolder.serverName))
      .flatMap((clientHolder) =>
        clientHolder.tools.map((tool) =>
          convertMpcToolToLangchainTool(project, clientHolder.serverName, clientHolder.client, tool, getActiveProvider(mcpConfig.providers)!),
        ),
      );

    if (!mcpServerTools.length) {
      logger.info('No tools found for prompt, returning original prompt');
      return prompt;
    }

    // Add the Aider tool
    const aiderTool = createAiderTool();
    const allTools = [...mcpServerTools, aiderTool];

    logger.info(`Running prompt with ${allTools.length} tools.`);
    logger.debug('Tools:', {
      prompt,
      tools: allTools.map((tool) => tool.name),
    });

    const usageReport: UsageReportData = {
      sentTokens: 0,
      receivedTokens: 0,
      messageCost: 0,
      totalCost: 0,
      mcpToolsCost: 0,
    };

    try {
      const baseChatModel = this.createLlm();
      const llmWithTools = baseChatModel.bindTools!(allTools);
      const toolsByName: { [key: string]: StructuredTool } = {};
      allTools.forEach((tool) => {
        toolsByName[tool.name] = tool;
      });

      let iteration = 0;

      while (iteration < mcpConfig.maxIterations) {
        iteration++;
        logger.debug(`Running prompt iteration ${iteration}`, { messages });

        // Get LLM response which may contain tool calls
        const aiMessage = await llmWithTools.invoke(messages);

        // Check for interruption
        if (this.checkInterrupted(project, usageReport)) {
          return null;
        }

        // Add AI message to messages
        messages.push(aiMessage);

        // Update usage report
        usageReport.sentTokens += aiMessage.usage_metadata?.input_tokens ?? aiMessage.response_metadata?.usage?.input_tokens ?? 0;
        usageReport.receivedTokens += aiMessage.usage_metadata?.output_tokens ?? aiMessage.response_metadata?.usage?.output_tokens ?? 0;
        usageReport.mcpToolsCost = calculateCost(getActiveProvider(mcpConfig.providers)!, usageReport.sentTokens, usageReport.receivedTokens);

        logger.debug(`Tool calls: ${aiMessage.tool_calls?.length}, message: ${JSON.stringify(aiMessage.content)}`);

        // If no tool calls, check if there's content to send
        if (!aiMessage.tool_calls?.length) {
          const textContent = extractTextContent(aiMessage.content);

          if (textContent) {
            logger.info(`Sending final response: ${textContent}`);

            project.processResponseMessage({
              action: 'response',
              content: textContent,
              finished: true,
              usageReport,
            });

            // Push messages to the aider's chat history
            project.sendAddContextMessage('user', prompt, false);
            project.sendAddContextMessage('assistant', textContent);

            return null;
          } else {
            break;
          }
        }

        // Collect tool results for potential Aider tool
        const toolResults: string[] = [];

        for (const toolCall of aiMessage.tool_calls) {
          // Check for interruption before each tool call
          if (this.checkInterrupted(project, usageReport)) {
            return null;
          }

          // Calculate how much time to wait based on the minimum time between tool calls
          const now = Date.now();
          const elapsedSinceLastCall = now - this.lastToolCallTime;
          const remainingDelay = Math.max(0, mcpConfig.minTimeBetweenToolCalls - elapsedSinceLastCall);

          if (remainingDelay > 0) {
            await delay(remainingDelay);
          }

          // Check if Aider tool is being called
          if (toolCall.name === 'aider') {
            logger.debug('Aider tool called. Sending prompt to Aider.');
            // If Aider tool is called, use its prompt as the response
            const aiderPrompt = toolCall.args.prompt as string;

            // Append previous tool results to the Aider prompt
            const toolResultsText = toolResults.length > 0 ? `Previous Tool Results:\n${toolResults.join('\n\n')}\n\nTask:\n` : '';

            const fullAiderPrompt = `${toolResultsText}${aiderPrompt}`;

            if (prompt !== fullAiderPrompt) {
              project.addUserMessage(fullAiderPrompt);
            }

            return fullAiderPrompt;
          }

          const selectedTool = toolsByName[toolCall.name];
          if (!selectedTool) {
            logger.error(`Tool ${toolCall.name} not found`);
            continue;
          }

          // Check for interruption before sending tool message
          if (this.checkInterrupted(project, usageReport)) {
            return null;
          }

          const [serverName, toolName] = this.extractServerNameToolName(toolCall.name);
          project.addToolMessage(serverName, toolName, toolCall.args);

          try {
            const toolResponse = await selectedTool.invoke(toolCall);

            logger.debug(`Tool ${toolCall.name} returned response`, {
              toolResponse,
            });
            if (!toolResponse) {
              logger.warn(`Tool ${toolCall.name} didn't return a response`);
              return null;
            }

            // Add tool message to messages
            messages.push(toolResponse);

            // Store tool result for potential Aider tool
            const toolResultText = extractTextContent(toolResponse);
            if (toolResultText) {
              toolResults.push(`Tool: ${toolCall.name}\n${toolResultText}`);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error invoking tool ${toolCall.name}:`, error);

            // Send log message about the tool error
            project.addLogMessage('error', `Tool ${toolCall.name} failed: ${errorMessage}`);

            // Add user message to messages for next iteration
            messages.push(new HumanMessage(errorMessage));
          }

          // Update the last tool call time after the delay
          this.lastToolCallTime = Date.now();
        }
      }

      // If no Aider tool was called after max iterations, do nothing
      project.addLogMessage('info', 'Max iterations for MCP tools reached. Increase the max iterations in the settings.');
      return null;
    } catch (error) {
      logger.error('Error running prompt:', error);
      if (error instanceof Error && error.message.includes('API key is required')) {
        project.addLogMessage('error', `Error running MCP servers. ${error.message}. Configure it in the Settings -> MCP Config tab.`);
      } else {
        project.addLogMessage('error', `Error running MCP servers: ${error}`);
      }
      project.processResponseMessage({
        action: 'response',
        content: '',
        finished: true,
        usageReport,
      });
      throw error;
    }
  }

  private interpolateServerConfig(serverConfig: McpServerConfig, project?: Project): McpServerConfig {
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
  }

  private extractServerNameToolName(toolCallName: string): [string, string] {
    // Find the first matching client's server name that is a prefix of the tool call name
    const matchingClient = this.clients.find((clientHolder) => toolCallName.startsWith(`${clientHolder.serverName}-`));

    if (!matchingClient) {
      logger.warn(`No matching server found for tool call: ${toolCallName}`);
      return ['unknown', toolCallName];
    }

    // Remove the server name prefix and underscore
    const toolName = toolCallName.slice(matchingClient.serverName.length + 1);
    return [matchingClient.serverName, toolName];
  }

  private checkInterrupted(project: Project, usageReport?: UsageReportData): boolean {
    if (this.isInterrupted) {
      logger.info('Prompt processing interrupted');
      project.processResponseMessage({
        action: 'response',
        content: '',
        finished: true,
        usageReport,
      });
      return true;
    }
    return false;
  }

  public interrupt() {
    logger.info('Interrupting MCP client');
    this.isInterrupted = true;
  }

  public clearMessages(project: Project) {
    logger.info('Clearing message history');
    this.messages.delete(project.baseDir);
  }

  public addMessage(project: Project, role: 'user' | 'assistant', content: string) {
    logger.debug(`Adding message to MCP agent history: ${content}`);
    let messages = this.messages.get(project.baseDir);
    if (!messages) {
      const { mcpConfig } = this.store.getSettings();
      messages = [new SystemMessage(mcpConfig.systemPrompt)];
      this.messages.set(project.baseDir, messages);
    }

    messages.push(role === 'user' ? new HumanMessage(content) : new AIMessage(content));
  }

  private async initMcpClient(serverName: string, serverConfig: McpServerConfig): Promise<ClientHolder> {
    logger.info(`Initializing MCP client for server: ${serverName}`);

    logger.debug(`Server configuration: ${JSON.stringify(serverConfig)}`);

    // NOTE: Some servers (e.g. Brave) seem to require PATH to be set.
    const env = { ...serverConfig.env };
    if (!env.PATH) {
      env.PATH = process.env.PATH || '';
    }

    const transport = new StdioClientTransport({
      command: serverConfig.command,
      args: serverConfig.args,
      env,
    });

    const client = new Client(
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

    // Get tools from this server
    logger.debug(`Fetching tools for MCP server: ${serverName}`);
    const tools = (await client.listTools()) as unknown as { tools: McpTool[] };
    logger.debug(`Found ${tools.tools.length} tools for MCP server: ${serverName}`);

    const clientHolder: ClientHolder = {
      client,
      serverName,
      tools: tools.tools.map((tool) => ({
        ...tool,
        serverName: serverName,
      })),
    };

    logger.info(`MCP client initialized successfully for server: ${serverName}`);
    return clientHolder;
  }
}

const convertMpcToolToLangchainTool = (project: Project, serverName: string, client: Client, toolDef: McpTool, provider: LlmProvider): StructuredTool => {
  const normalizeSchemaForProvider = (schema: JsonSchema): JsonSchema => {
    if (provider.name === 'gemini') {
      // gemini does not like "default" in the schema
      const normalized = JSON.parse(JSON.stringify(schema));
      if (normalized.properties) {
        for (const key of Object.keys(normalized.properties)) {
          if (normalized.properties[key].default !== undefined) {
            delete normalized.properties[key].default;
          }
        }
      }
      return normalized;
    }
    return schema;
  };

  return tool(
    async (params: unknown) => {
      const response = await client.callTool({
        name: toolDef.name,
        arguments: params as Record<string, unknown>,
      });

      logger.debug(`Tool ${toolDef.name} returned response`, { response });

      const extractContent = (response) => {
        if (!response?.content) {
          return null;
        } else if (Array.isArray(response.content)) {
          return (
            response.content
              .filter(isTextContent)
              .map((textContent) => (typeof textContent === 'string' ? textContent : textContent.text))
              .join('\n\n') ?? null
          );
        } else {
          return response.content;
        }
      };

      const content = extractContent(response);

      if (content) {
        project.addToolMessage(serverName, toolDef.name, undefined, content);
      }

      return content;
    },
    {
      name: `${serverName}-${toolDef.name}`,
      description: toolDef.description ?? '',
      schema: jsonSchemaToZod(normalizeSchemaForProvider(toolDef.inputSchema)),
    },
  );
};

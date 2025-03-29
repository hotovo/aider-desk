import fs from 'fs/promises';
import path from 'path';

import { ContextFile, getActiveProvider, McpServerConfig, McpTool, UsageReportData } from '@common/types';
import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { StructuredTool, tool } from '@langchain/core/tools';
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
import { EditFormat } from 'src/main/messages';

import logger from '../logger';
import { Store } from '../store';
import { Project } from '../project';

import { createAiderTools } from './tools/aider';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

// some results are too long, so we limit the length
const MAX_SAFE_TOOL_RESULT_CONTENT_LENGTH = 32_000;

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
  private contextFilesMessages: Map<string, BaseMessage[]> = new Map();

  constructor(store: Store) {
    this.store = store;
  }

  async init(project?: Project, initId = uuidv4()) {
    try {
      this.currentInitId = initId;
      await this.closeClients();
      const clients: ClientHolder[] = [];

      const { mcpAgent } = this.store.getSettings();

      // Initialize each MCP server
      for (const [serverName, serverConfig] of Object.entries(mcpAgent.mcpServers)) {
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
    const { mcpAgent } = this.store.getSettings();
    const { providers, maxTokens } = mcpAgent;
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
        maxTokens: maxTokens,
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
        maxTokens: maxTokens,
        apiKey: provider.apiKey,
      });
    } else if (isGeminiProvider(provider)) {
      if (!provider.apiKey) {
        throw new Error('Gemini API key is required');
      }
      return new ChatGoogleGenerativeAI({
        model: provider.model,
        temperature: 0,
        maxOutputTokens: maxTokens,
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
        maxTokens: maxTokens,
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

  private async getFileSections(files: ContextFile[], project: Project): Promise<string[]> {
    // Common binary file extensions to exclude
    /* eslint-disable prettier/prettier */
    const BINARY_EXTENSIONS = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', // Images
      '.mp3', '.wav', '.ogg', '.flac', // Audio
      '.mp4', '.mov', '.avi', '.mkv', // Video
      '.zip', '.tar', '.gz', '.7z', // Archives
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', // Documents
      '.exe', '.dll', '.so', // Binaries
    ]);
    /* eslint-enable prettier/prettier */

    const filesWithContent = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.resolve(project.baseDir, file.path);
          const ext = path.extname(filePath).toLowerCase();

          // Skip known binary extensions
          if (BINARY_EXTENSIONS.has(ext)) {
            logger.debug(`Skipping binary file: ${file.path}`);
            return null;
          }

          // Read file as text
          const content = await fs.readFile(filePath, 'utf8');
          return {
            path: file.path,
            content,
            readOnly: file.readOnly,
          };
        } catch (error) {
          logger.error('Error reading context file:', {
            path: file.path,
            error,
          });
          return null;
        }
      }),
    );

    return filesWithContent.filter(Boolean).map((file) => {
      const filePath = path.isAbsolute(file!.path) ? path.relative(project.baseDir, file!.path) : file!.path;
      return `File: ${filePath}\n\`\`\`\n${file!.content}\n\`\`\`\n\n`;
    });
  }

  private async getContextFilesMessages(project: Project): Promise<BaseMessage[]> {
    const { mcpAgent } = this.store.getSettings();
    const messages: BaseMessage[] = [];

    if (mcpAgent.includeContextFiles) {
      const contextFiles = project.getContextFiles();
      if (contextFiles.length > 0) {
        // Separate readonly and editable files
        const [readOnlyFiles, editableFiles] = contextFiles.reduce(
          ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
          [[], []] as [ContextFile[], ContextFile[]],
        );

        // Process readonly files first
        if (readOnlyFiles.length > 0) {
          const fileSections = await this.getFileSections(readOnlyFiles, project);
          if (fileSections.length > 0) {
            messages.push(
              new HumanMessage('Here are some READ ONLY files, provided for your reference. Do not try to edit these files!\n\n' + fileSections.join('\n\n')),
            );
            messages.push(new AIMessage('Ok, I will use these files as references and will not try to edit them.'));
          }
        }

        // Process editable files
        if (editableFiles.length > 0) {
          const fileSections = await this.getFileSections(editableFiles, project);
          if (fileSections.length > 0) {
            messages.push(new HumanMessage('These are files that can be edited, if needed.\n\n' + fileSections.join('\n\n')));
            messages.push(new AIMessage('OK, I understand that I can update those files, but only when needed.'));
          }
        }
      }
    }

    return messages;
  }

  async runPrompt(project: Project, prompt: string, editFormat?: EditFormat): Promise<string | null> {
    const { mcpAgent } = this.store.getSettings();
    logger.debug('McpConfig:', mcpAgent);

    // Reset interruption flag
    this.isInterrupted = false;

    const tools = this.clients.filter((clientHolder) => !mcpAgent.disabledServers.includes(clientHolder.serverName));
    const enabled = mcpAgent.agentEnabled && (tools.length > 0 || mcpAgent.useAiderTools);
    const messages = await this.prepareMessages(project, enabled);

    // Add the user message to the message history
    messages.push(new HumanMessage(prompt));

    if (!enabled) {
      logger.debug('MCP agent disabled, returning original prompt');
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
      .filter((clientHolder) => !mcpAgent.disabledServers.includes(clientHolder.serverName))
      .flatMap((clientHolder) =>
        clientHolder.tools.map((tool) =>
          convertMpcToolToLangchainTool(project, clientHolder.serverName, clientHolder.client, tool, getActiveProvider(mcpAgent.providers)!),
        ),
      );

    // Add Aider tools if enabled
    const allTools = [...mcpServerTools];
    if (mcpAgent.useAiderTools) {
      const aiderTools = createAiderTools(project, editFormat);
      allTools.push(...aiderTools);
    }

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

      while (iteration < mcpAgent.maxIterations) {
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
        usageReport.mcpToolsCost = calculateCost(getActiveProvider(mcpAgent.providers)!, usageReport.sentTokens, usageReport.receivedTokens);

        logger.debug(`Tool calls: ${aiMessage.tool_calls?.length}, message: ${JSON.stringify(aiMessage.content)}`);

        // If no tool calls, check if there's content to send
        if (!aiMessage.tool_calls?.length) {
          const textContent = extractTextContent(aiMessage.content);

          if (textContent) {
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

        for (const toolCall of aiMessage.tool_calls) {
          // Check for interruption before each tool call
          if (this.checkInterrupted(project, usageReport)) {
            return null;
          }

          // Calculate how much time to wait based on the minimum time between tool calls
          const now = Date.now();
          const elapsedSinceLastCall = now - this.lastToolCallTime;
          const remainingDelay = Math.max(0, mcpAgent.minTimeBetweenToolCalls - elapsedSinceLastCall);

          if (remainingDelay > 0) {
            await delay(remainingDelay);
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
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error invoking tool ${toolCall.name}:`, error);

            // Send log message about the tool error
            project.addLogMessage('error', `Tool ${toolCall.name} failed: ${errorMessage}`);
            project.addToolMessage(serverName, toolName, undefined, errorMessage);

            // Add user message to messages for next iteration
            messages.push(new HumanMessage(errorMessage));
          }

          // Update the last tool call time after the delay
          this.lastToolCallTime = Date.now();
        }
      }

      if (iteration >= mcpAgent.maxIterations) {
        // If no Aider tool was called after max iterations, do nothing
        project.addLogMessage('info', 'Max iterations for MCP tools reached. Increase the max iterations in the settings.');
      }

      return null;
    } catch (error) {
      logger.error('Error running prompt:', error);
      if (error instanceof Error && error.message.includes('API key is required')) {
        project.addLogMessage('error', `Error running MCP servers. ${error.message}. Configure it in the Settings -> MCP Config tab.`);
      } else {
        project.addLogMessage('error', `Error running MCP servers: ${error}`);
      }
      throw error;
    } finally {
      project.processResponseMessage({
        action: 'response',
        content: '',
        finished: true,
        usageReport,
      });
    }
  }

  private async prepareMessages(project: Project, enabled: boolean): Promise<BaseMessage[]> {
    const { mcpAgent } = this.store.getSettings();
    let messages = this.messages.get(project.baseDir) || [new SystemMessage(mcpAgent.systemPrompt)];

    // Remove previous context files messages if they exist
    const previousContextMessages = this.contextFilesMessages.get(project.baseDir);
    if (previousContextMessages) {
      messages = messages.filter((msg) => !previousContextMessages.includes(msg));
    }

    if (mcpAgent.includeContextFiles && enabled) {
      // Get and store new context files messages
      const contextFilesMessages = await this.getContextFilesMessages(project);
      this.contextFilesMessages.set(project.baseDir, contextFilesMessages);
      messages.push(...contextFilesMessages);
    } else {
      // Remove context files messages if includeContextFiles is disabled
      this.contextFilesMessages.delete(project.baseDir);
    }

    // Update messages map
    this.messages.set(project.baseDir, messages);
    return messages;
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
    if (toolCallName.startsWith('aider-')) {
      return ['aider', toolCallName.slice(6)];
    }

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
    this.contextFilesMessages.delete(project.baseDir);
  }

  public addMessage(project: Project, role: 'user' | 'assistant', content: string) {
    logger.debug(`Adding message to MCP agent history: ${content}`);
    let messages = this.messages.get(project.baseDir);
    if (!messages) {
      const { mcpAgent } = this.store.getSettings();
      messages = [new SystemMessage(mcpAgent.systemPrompt)];
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
    const normalized = JSON.parse(JSON.stringify(schema));

    if (provider.name === 'gemini') {
      if (normalized.properties) {
        for (const key of Object.keys(normalized.properties)) {
          // gemini does not like "default" in the schema
          if (normalized.properties[key].default !== undefined) {
            delete normalized.properties[key].default;
          }
        }
        if (Object.keys(normalized.properties).length === 0) {
          // gemini requires at least one property in the schema
          normalized.properties = {
            placeholder: {
              type: 'string',
              description: 'Placeholder property to satisfy Gemini schema requirements',
            },
          };
        }
      }
    }

    return normalized;
  };

  logger.debug(`Converting MCP tool to Langchain tool: ${toolDef.name}`, toolDef);

  return tool(
    async (params: unknown) => {
      try {
        const response = await client.callTool({
          name: toolDef.name,
          arguments: params as Record<string, unknown>,
        });

        logger.debug(`Tool ${toolDef.name} returned response`, { response });

        const extractContent = (response): string | null => {
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

        const content = extractContent(response)?.slice(0, MAX_SAFE_TOOL_RESULT_CONTENT_LENGTH);

        if (content) {
          project.addToolMessage(serverName, toolDef.name, undefined, content);
        }

        return content;
      } catch (error) {
        logger.error(`Error calling tool ${toolDef.name}:`, error);
        return `Error calling tool: ${(error as Error).message}`;
      }
    },
    {
      name: `${serverName}-${toolDef.name}`,
      description: toolDef.description ?? '',
      schema: jsonSchemaToZod(normalizeSchemaForProvider(toolDef.inputSchema)),
    },
  );
};

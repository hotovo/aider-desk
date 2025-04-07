import fs from 'fs/promises';
import path from 'path';

import { ContextFile, ContextMessage, McpServerConfig, McpTool, UsageReportData } from '@common/types';
import { generateText, NoSuchToolError, streamText } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { calculateCost, delay, extractServerNameToolName, SERVER_TOOL_SEPARATOR } from '@common/utils';
import { getActiveProvider, LlmProvider } from '@common/llm-providers';

import logger from '../logger';
import { Store } from '../store';
import { Project } from '../project';

import { createAiderToolset } from './tools/aider';
import { createHelpersToolset } from './tools/helpers';
import { createLlm } from './llm-provider';
import { ClientHolder, convertMpcToolToAiSdkTool, initMcpClient } from './mcp-client';

import type { CoreMessage, StepResult, ToolSet } from 'ai';

export class Agent {
  private store: Store;
  private currentInitId: string | null = null;
  private initializedForProject: Project | null = null;
  private clients: ClientHolder[] = [];
  private abortController: AbortController | null = null;

  constructor(store: Store) {
    this.store = store;
  }

  async initMcpServers(project: Project | null = this.initializedForProject, initId = uuidv4()) {
    // Set the current init ID to track this specific initialization process
    this.currentInitId = initId;
    try {
      const clients: ClientHolder[] = [];
      const { agentConfig } = this.store.getSettings();

      await this.closeClients();

      // Initialize each MCP server
      for (const [serverName, serverConfig] of Object.entries(agentConfig.mcpServers)) {
        // Check for interruption before initializing each client
        if (this.currentInitId !== initId) {
          logger.info(`MCP initialization cancelled before starting server ${serverName} due to new init request.`);
          await this.closeClients(clients); // Ensure partially initialized clients are closed
          return;
        }
        try {
          const clientHolder = await initMcpClient(serverName, serverConfig, project);

          // Check for interruption again after the async operation
          if (this.currentInitId !== initId) {
            // If initId changed during async operation, stop initialization
            logger.info(`MCP initialization cancelled for server ${serverName} due to new init request.`);
            await this.closeClients(); // Ensure partially initialized clients are closed
            return;
          }
          clients.push(clientHolder);
        } catch (error) {
          logger.error(`MCP Client initialization failed for server: ${serverName}`, error);
          // Optionally notify the user in the UI about the specific failure
          project?.addLogMessage('error', `Failed to initialize MCP server: ${serverName}. Check logs for details.`);
        }
      }

      this.clients = clients;
      this.initializedForProject = project;
    } finally {
      // Clear the init ID only if it matches the ID of this init call
      // This prevents a newer init call from clearing the ID of an older, still running init
      if (this.currentInitId === initId) {
        this.currentInitId = null;
      }
    }
  }

  private async closeClients(clients = this.clients) {
    // Create a promise for each client close operation
    const closePromises = clients.map(async (clientHolder) => {
      try {
        await clientHolder.client.close();
        logger.debug(`Closed MCP client for server: ${clientHolder.serverName}`);
      } catch (error) {
        logger.error(`Error closing MCP client for server ${clientHolder.serverName}:`, error);
      }
    });

    // Wait for all close operations to complete
    await Promise.all(closePromises);
    clients.splice(0, clients.length); // Clear the list
    logger.debug('All MCP clients closed and list cleared.');
  }

  async reloadMcpServer(serverName: string, config: McpServerConfig, project: Project | null = this.initializedForProject): Promise<McpTool[] | null> {
    try {
      const newClient = await initMcpClient(serverName, config, project);

      const oldClientIndex = this.clients.findIndex((client) => client.serverName === serverName);

      // Close the old client if it exists
      if (oldClientIndex !== -1) {
        const oldClient = this.clients[oldClientIndex];
        try {
          await oldClient.client.close();
          logger.info(`Closed old MCP client for server: ${serverName}`);
          // Remove the old client from the list immediately after closing
          this.clients.splice(oldClientIndex, 1);
        } catch (closeError) {
          logger.error(`Error closing old MCP client for server ${serverName}:`, closeError);
          // Decide if we should proceed or throw an error. For now, log and continue.
        }
      }

      // Add the new client
      this.clients.push(newClient);
      logger.debug(`Added new MCP client for server: ${serverName}`);

      return newClient.tools;
    } catch (error) {
      logger.error(`Error reloading MCP server ${serverName}:`, error);
      project?.addLogMessage('error', `Failed to reload MCP server: ${serverName}. Check logs for details.`);
      return null;
    }
  }

  async getMcpServerTools(serverName: string): Promise<McpTool[] | null> {
    // Wait for any ongoing initialization to complete
    while (this.currentInitId) {
      logger.debug(`MCP Agent is initializing (ID: ${this.currentInitId}), waiting...`);
      await delay(100); // Wait for 100ms before checking again
    }

    const clientHolder = this.clients.find((client) => client.serverName === serverName);
    return clientHolder ? clientHolder.tools : null;
  }

  private async getFileContentForPrompt(files: ContextFile[], project: Project): Promise<string> {
    // Common binary file extensions to exclude
    const BINARY_EXTENSIONS = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.bmp',
      '.tiff',
      '.ico', // Images
      '.mp3',
      '.wav',
      '.ogg',
      '.flac', // Audio
      '.mp4',
      '.mov',
      '.avi',
      '.mkv', // Video
      '.zip',
      '.tar',
      '.gz',
      '.7z', // Archives
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx', // Documents
      '.exe',
      '.dll',
      '.so', // Binaries
    ]);

    const fileSections = await Promise.all(
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

    return fileSections
      .filter(Boolean)
      .map((file) => {
        const filePath = path.isAbsolute(file!.path) ? path.relative(project.baseDir, file!.path) : file!.path;
        return `File: ${filePath}\n\`\`\`\n${file!.content}\n\`\`\`\n\n`;
      })
      .join('\n\n'); // Join sections into a single string
  }

  private async getContextFilesMessages(project: Project): Promise<CoreMessage[]> {
    const { agentConfig } = this.store.getSettings();
    const messages: CoreMessage[] = [];

    if (agentConfig.includeContextFiles) {
      const contextFiles = project.getContextFiles();
      if (contextFiles.length > 0) {
        // Separate readonly and editable files
        const [readOnlyFiles, editableFiles] = contextFiles.reduce(
          ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
          [[], []] as [ContextFile[], ContextFile[]],
        );

        // Process readonly files first
        if (readOnlyFiles.length > 0) {
          const fileContent = await this.getFileContentForPrompt(readOnlyFiles, project);
          if (fileContent) {
            messages.push({
              role: 'user',
              content: 'Here are READ ONLY files included in the aider context, provided for your reference. Do not try to edit these files!\n\n' + fileContent,
            });
            messages.push({
              role: 'assistant',
              content: 'Ok, I will use these files as references and will not try to edit them.',
            });
          }
        }

        // Process editable files
        if (editableFiles.length > 0) {
          const fileContent = await this.getFileContentForPrompt(editableFiles, project);
          if (fileContent) {
            messages.push({
              role: 'user',
              content: 'These are files included in the aider context that can be edited, if needed.\n\n' + fileContent,
            });
            messages.push({
              role: 'assistant',
              content: 'OK, I understand that I can update those files, but only when needed.',
            });
          }
        }
      }
    }

    return messages;
  }

  async runAgent(project: Project, prompt: string): Promise<ContextMessage[]> {
    // Wait for any ongoing initialization to complete
    while (this.currentInitId) {
      logger.debug(`MCP Agent is initializing (ID: ${this.currentInitId}), waiting...`);
      await delay(100); // Wait for 100ms before checking again
    }

    const { agentConfig } = this.store.getSettings();
    logger.debug('McpConfig:', agentConfig);

    const activeProvider = getActiveProvider(agentConfig.providers);
    if (!activeProvider) {
      throw new Error('No active MCP provider found');
    }

    // Create new abort controller for this run
    this.abortController = new AbortController();

    // Track new messages created during this run
    const agentMessages: CoreMessage[] = [{ role: 'user', content: prompt }];
    const messages = await this.prepareMessages(project);

    // add user message
    messages.push(...agentMessages);

    // Check if we need to reinitialize for a different project
    if (this.initializedForProject?.baseDir !== project.baseDir) {
      logger.info(`Reinitializing MCP clients for project: ${project.baseDir}`);
      try {
        await this.initMcpServers(project, uuidv4());
      } catch (error) {
        logger.error('Error reinitializing MCP clients:', error);
        project.addLogMessage('error', `Error reinitializing MCP clients: ${error}`);
        return [];
      }
    }

    // Build the toolSet directly from enabled clients and tools
    const toolSet: ToolSet = this.clients.reduce((acc, clientHolder) => {
      // Skip disabled servers
      if (agentConfig.disabledServers.includes(clientHolder.serverName)) {
        return acc;
      }

      // Process tools for this enabled server
      clientHolder.tools.forEach((tool) => {
        const fullToolName = `${clientHolder.serverName}${SERVER_TOOL_SEPARATOR}${tool.name}`;
        // Skip disabled tools
        if (agentConfig.disabledTools.includes(fullToolName)) {
          return;
        }

        acc[fullToolName] = convertMpcToolToAiSdkTool(activeProvider, agentConfig, clientHolder.serverName, project, clientHolder.client, tool);
      });

      return acc;
    }, {} as ToolSet);

    if (agentConfig.useAiderTools) {
      const aiderTools = createAiderToolset(project);
      // Add Aider tools to the toolSet
      Object.assign(toolSet, aiderTools);
    }

    // Add helper tools
    const helperTools = createHelpersToolset();
    Object.assign(toolSet, helperTools);

    logger.info(`Running prompt with ${Object.keys(toolSet).length} tools.`);
    logger.debug('Tools:', {
      tools: Object.keys(toolSet),
    });

    try {
      const model = createLlm(activeProvider);
      const systemPrompt = await this.getSystemMessage(project, agentConfig.systemPrompt);

      // repairToolCall function that attempts to repair tool calls
      const repairToolCall = async ({ toolCall, tools, error, messages, system }) => {
        logger.error('Error during tool call:', { error, toolCall });

        if (NoSuchToolError.isInstance(error)) {
          // If the tool doesn't exist, return a call to the helper tool
          // to inform the LLM about the missing tool.
          logger.warn(`Attempted to call non-existent tool: ${error.toolName}`);
          return {
            toolCallType: 'function' as const,
            toolCallId: toolCall.toolCallId,
            toolName: `helpers${SERVER_TOOL_SEPARATOR}no_such_tool`,
            args: JSON.stringify({
              toolName: error.toolName,
              availableTools: error.availableTools,
            }), // Pass the original tool name as args
          };
        }

        // Existing repair logic for other errors
        const result = await generateText({
          model,
          system,
          messages: [
            ...messages,
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool-call',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                },
              ],
            },
            {
              role: 'tool' as const,
              content: [
                {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: error.message,
                },
              ],
            },
          ],
          tools,
        });

        const newToolCall = result.toolCalls.find((newToolCall) => newToolCall.toolName === toolCall.toolName);
        return newToolCall != null
          ? {
              toolCallType: 'function' as const,
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              // Ensure args are stringified for the AI SDK tool call format
              args: typeof newToolCall.args === 'string' ? newToolCall.args : JSON.stringify(newToolCall.args),
            }
          : null; // Return null if the LLM couldn't repair the call
      };

      let currentResponseId: null | string = null;

      const result = streamText({
        model,
        system: systemPrompt,
        messages,
        tools: toolSet,
        abortSignal: this.abortController.signal,
        maxSteps: agentConfig.maxIterations,
        maxTokens: agentConfig.maxTokens,
        temperature: 0, // Keep deterministic for agent behavior
        onError: ({ error }) => {
          if (typeof error === 'string') {
            project.addLogMessage('error', error);
          } else if (error instanceof Error) {
            project.addLogMessage('error', error.message);
          } else {
            project.addLogMessage('error', JSON.stringify(error));
          }
        },
        onChunk: ({ chunk }) => {
          if (chunk.type === 'text-delta') {
            currentResponseId = project.processResponseMessage({
              action: 'response',
              content: chunk.textDelta,
              finished: false,
            });
          }
        },
        onStepFinish: (stepResult) => {
          const { response, finishReason } = stepResult;

          if (finishReason === 'error') {
            logger.error('Error during prompt:', { stepResult });
            return;
          }

          // Replace agentMessages with the latest full history from the response keeping the user message
          agentMessages.length = 1;
          agentMessages.push(...response.messages);

          if (this.abortController?.signal.aborted) {
            logger.info('Prompt aborted by user');
            return;
          }

          this.processStep<typeof toolSet>(currentResponseId, stepResult, project, activeProvider);

          currentResponseId = null;
        },
        onFinish: ({ finishReason }) => {
          logger.info(`Prompt finished. Reason: ${finishReason}`);
        },
        experimental_repairToolCall: repairToolCall,
      });

      // Consume the stream to ensure it runs to completion
      await result.consumeStream();
    } catch (error) {
      if (this.abortController?.signal.aborted) {
        logger.info('Prompt aborted by user');
        return agentMessages;
      }

      logger.error('Error running prompt:', error);
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('credentials'))) {
        project.addLogMessage('error', `Error running MCP servers. ${error.message}. Configure credentials in the Settings -> MCP Config tab.`);
      } else {
        project.addLogMessage('error', `Error running MCP servers: ${error instanceof Error ? error.message : String(error)}`);
      }
    } finally {
      // Clean up abort controller
      this.abortController = null;

      // Always send a final "finished" message, regardless of whether there was text or tools
      project.processResponseMessage({
        action: 'response',
        content: '',
        finished: true,
      });
    }

    return agentMessages;
  }

  private async getSystemMessage(project: Project, systemPrompt: string): Promise<string> {
    const currentDate = new Date().toISOString();
    const osName = (await import('os-name')).default;

    return `${systemPrompt}

## System Information

Current Date: ${currentDate}
Operating System: ${osName()}
Current Working/Project Directory: ${project.baseDir}
`;
  }

  private async prepareMessages(project: Project): Promise<CoreMessage[]> {
    const { agentConfig } = this.store.getSettings();
    const messages = project.getContextMessages();

    if (agentConfig.includeContextFiles) {
      // Get and store new context files messages
      const contextFilesMessages = await this.getContextFilesMessages(project);
      messages.push(...contextFilesMessages);
    }

    return messages;
  }

  public interrupt() {
    logger.info('Interrupting MCP agent run');
    this.abortController?.abort();
  }

  private processStep<TOOLS extends ToolSet>(
    currentResponseId: string | null,
    { reasoning, text, toolCalls, toolResults, finishReason, usage }: StepResult<TOOLS>,
    project: Project,
    activeProvider: LlmProvider,
  ): void {
    logger.info(`Step finished. Reason: ${finishReason}`, {
      reasoning: reasoning?.substring(0, 100), // Log truncated reasoning
      text: text?.substring(0, 100), // Log truncated text
      toolCalls: toolCalls?.map((tc) => tc.toolName),
      toolResults: toolResults?.map((tr) => tr.toolName),
      usage,
    });

    const messageCost = calculateCost(activeProvider, usage.promptTokens, usage.completionTokens);
    const usageReport: UsageReportData = {
      sentTokens: usage.promptTokens,
      receivedTokens: usage.completionTokens,
      messageCost: messageCost,
      mcpAgentTotalCost: project.mcpAgentTotalCost + messageCost,
    };

    // Process text/reasoning content
    if (reasoning || text) {
      project.processResponseMessage({
        id: currentResponseId,
        action: 'response',
        content:
          reasoning && text
            ? `---
► **THINKING**
${reasoning.trim()}
---
► **ANSWER**
${text.trim()}`
            : reasoning || text,
        finished: true,
        usageReport,
      });
      project.addLogMessage('loading');
    }

    if (toolResults) {
      // Process successful tool results *after* sending text/reasoning and handling errors
      for (const toolResult of toolResults) {
        const [serverName, toolName] = extractServerNameToolName(toolResult.toolName);
        // Update the existing tool message with the result
        project.addToolMessage(toolResult.toolCallId, serverName, toolName, toolResult.args, JSON.stringify(toolResult.result), usageReport);
      }
    }
  }
}

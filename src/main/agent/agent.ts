import fs from 'fs/promises';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import {
  AgentProfile,
  ContextCompactionType,
  ContextFile,
  ContextMessage,
  ContextUserMessage,
  DefaultTaskState,
  McpTool,
  McpToolInputSchema,
  Mode,
  PromptContext,
  ProviderProfile,
  ToolApprovalState,
  UsageReportData,
} from '@common/types';
import {
  APICallError,
  type FinishReason,
  generateText,
  type ImagePart,
  InvalidToolInputError,
  jsonSchema,
  type ModelMessage,
  NoSuchToolError,
  smoothStream,
  type StepResult,
  streamText,
  type Tool,
  type ToolCallOptions,
  type ToolSet,
  type TypedToolResult,
  wrapLanguageModel,
} from 'ai';
import { delay, extractServerNameToolName } from '@common/utils';
import { LlmProviderName } from '@common/agent';
import { countTokens } from 'gpt-tokenizer/model/gpt-4o';
import { Client as McpSdkClient } from '@modelcontextprotocol/sdk/client/index.js';
// @ts-expect-error istextorbinary is not typed properly
import { isBinary } from 'istextorbinary';
import { fileTypeFromBuffer } from 'file-type';
import {
  HELPERS_TOOL_GROUP_NAME,
  POWER_TOOL_FILE_READ,
  POWER_TOOL_GROUP_NAME,
  TASKS_TOOL_GROUP_NAME,
  TASKS_TOOL_SEARCH_PARENT_TASK,
  TOOL_GROUP_NAME_SEPARATOR,
} from '@common/tools';

import { createPowerToolset, readFileContent } from './tools/power';
import { createTodoToolset } from './tools/todo';
import { createSearchParentTaskTool, createTasksToolset } from './tools/tasks';
import { createAiderToolset } from './tools/aider';
import { createHelpersToolset } from './tools/helpers';
import { createMemoryToolset } from './tools/memory';
import { createSkillsToolset } from './tools/skills';
import { MCP_CLIENT_TIMEOUT, McpConnector, McpManager } from './mcp-manager';
import { ApprovalManager } from './tools/approval-manager';
import { ANSWER_RESPONSE_START_TAG, extractPromptContextFromToolResult, findLastUserMessage, THINKING_RESPONSE_STAR_TAG } from './utils';
import { extractReasoningMiddleware } from './middlewares/extract-reasoning-middleware';

import type { JSONSchema7Definition } from '@ai-sdk/provider';

import { MemoryManager } from '@/memory/memory-manager';
import { PromptsManager } from '@/prompts';
import { AIDER_DESK_PROJECT_RULES_DIR } from '@/constants';
import { Task } from '@/task';
import { Store } from '@/store';
import logger from '@/logger';
import { optimizeMessages } from '@/agent/optimizer';
import { ModelManager } from '@/models/model-manager';
import { TelemetryManager } from '@/telemetry/telemetry-manager';
import { ResponseMessage } from '@/messages';
import { createSubagentsToolset } from '@/agent/tools/subagents';
import { AgentProfileManager } from '@/agent/agent-profile-manager';
import { ExtensionManager } from '@/extensions/extension-manager';

const MAX_RETRIES = 3;

export class Agent {
  private abortControllers: Map<string, AbortController> = new Map();
  private lastToolCallTime: number = 0;

  constructor(
    private readonly store: Store,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly mcpManager: McpManager,
    private readonly modelManager: ModelManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly memoryManager: MemoryManager,
    private readonly promptsManager: PromptsManager,
    private readonly extensionManager: ExtensionManager,
  ) {}

  private async getFilesContentForPrompt(files: ContextFile[], task: Task): Promise<{ textFileContents: string[]; imageParts: ImagePart[] }> {
    const textFileContents: string[] = [];
    const imageParts: ImagePart[] = [];

    const fileInfos = await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.resolve(task.getTaskDir(), file.path);
          const fileContentBuffer = await fs.readFile(filePath);

          // If binary, try to detect if it's an image using image-type and return base64
          if (isBinary(filePath, fileContentBuffer)) {
            try {
              const detected = await fileTypeFromBuffer(fileContentBuffer);
              if (detected?.mime.startsWith('image/')) {
                const imageBase64 = fileContentBuffer.toString('base64');
                logger.debug(`Detected image file: ${file.path}`);

                return {
                  path: file.path,
                  content: null,
                  readOnly: file.readOnly,
                  imageBase64,
                  mimeType: detected.mime,
                  isImage: true,
                };
              }
            } catch (e) {
              logger.warn(`image-type failed to detect image for ${file.path}`, { error: e instanceof Error ? e.message : String(e) });
            }

            logger.debug(`Skipping non-image binary file: ${file.path}`);
            return null;
          }

          // Read file as text
          const fileContent = fileContentBuffer.toString('utf8');

          // Add line numbers to content
          const lines = fileContent.split('\n');
          const numberedLines = lines.map((line, index) => `${index + 1} | ${line}`);
          const content = numberedLines.join('\n');

          return {
            path: file.path,
            content,
            readOnly: file.readOnly,
            isImage: false,
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

    // Process the results and separate text files from images
    fileInfos.filter(Boolean).forEach((file) => {
      if (file!.isImage && file!.imageBase64) {
        // Add to imageParts array
        imageParts.push({
          type: 'image',
          image: `data:${file!.mimeType};base64,${file!.imageBase64}`,
          mediaType: file!.mimeType,
        });
      } else if (!file!.isImage && file!.content) {
        // Add to textFileContents array
        const filePath = path.isAbsolute(file!.path) ? path.relative(task.getTaskDir(), file!.path) : file!.path;
        const textContent = `<file>\n  <path>${filePath}</path>\n  <content-with-line-numbers>\n${file!.content}</content-with-line-numbers>\n</file>`;
        textFileContents.push(textContent);
      }
    });

    return { textFileContents, imageParts };
  }

  private async getContextFilesMessages(task: Task, profile: AgentProfile, contextFiles: ContextFile[]): Promise<ModelMessage[]> {
    const messages: ModelMessage[] = [];

    // Filter out rule files as they are already included in the system prompt
    const filteredContextFiles = contextFiles.filter((file) => {
      const normalizedPath = path.normalize(file.path);
      const normalizedRulesDir = path.normalize(AIDER_DESK_PROJECT_RULES_DIR);

      // Check if the file is within the rules directory
      return (
        !normalizedPath.startsWith(normalizedRulesDir + path.sep) &&
        !normalizedPath.startsWith(normalizedRulesDir + '/') &&
        normalizedPath !== normalizedRulesDir
      );
    });

    if (filteredContextFiles.length > 0) {
      // Separate readonly and editable files
      const [readOnlyFiles, editableFiles] = filteredContextFiles.reduce(
        ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
        [[], []] as [ContextFile[], ContextFile[]],
      );
      const allImageParts: ImagePart[] = [];

      // Process readonly files first
      if (readOnlyFiles.length > 0) {
        const { textFileContents, imageParts } = await this.getFilesContentForPrompt(readOnlyFiles, task);

        if (textFileContents.length > 0) {
          messages.push({
            role: 'user',
            content:
              (profile.useAiderTools
                ? 'The following files are already part of the Aider context as READ-ONLY reference material. You can analyze and reference their content, but you must NOT modify, edit, or suggest changes to these files. Use them only for understanding context and making informed decisions about other files:\n\n'
                : 'The following files are provided as READ-ONLY reference material. You can analyze and reference their content, but you must NOT modify, edit, or suggest changes to these files. Use them only for understanding context and making informed decisions:\n\n') +
              textFileContents.join('\n\n'),
          });
          messages.push({
            role: 'assistant',
            content: 'Understood. I will use the provided files as read-only references and will not attempt to modify their content.',
          });
        }

        allImageParts.push(...imageParts);
      }

      // Process editable files
      if (editableFiles.length > 0) {
        const { textFileContents, imageParts } = await this.getFilesContentForPrompt(editableFiles, task);

        if (textFileContents.length > 0) {
          messages.push({
            role: 'user',
            content:
              (profile.useAiderTools
                ? 'The following files are available for editing and modification. These files are already loaded in the Aider context, so you can directly use Aider tools to modify them without needing to add them to the context first. The content shown below is current and up-to-date:\n\n'
                : 'The following files are available for editing and modification. The content shown below is current and up-to-date, so you can reference it directly without needing to read the files again. You may suggest changes or modifications to these files:\n\n') +
              textFileContents.join('\n\n'),
          });
          messages.push({
            role: 'assistant',
            content: profile.useAiderTools
              ? 'Acknowledged. These files are already part of the Aider context and are available for direct editing using Aider tools. I do not need to re-add them.'
              : 'Understood. The content of these files is current, and I will refer to them as editable files without needing to read them again.',
          });
        }

        allImageParts.push(...imageParts);
      }

      if (allImageParts.length > 0) {
        messages.push({
          role: 'user',
          content: allImageParts,
        });
        messages.push({
          role: 'assistant',
          content: 'I can see the provided images and will use them for reference.',
        });
      }
    }

    return messages;
  }

  private async getWorkingFilesMessages(task: Task, contextFiles: ContextFile[]): Promise<ModelMessage[]> {
    const messages: ModelMessage[] = [];

    if (contextFiles.length > 0) {
      const imageParts: ImagePart[] = [];
      const nonImageFiles: ContextFile[] = [];

      // Separate image files from non-image files
      for (const file of contextFiles) {
        try {
          const filePath = path.resolve(task.getTaskDir(), file.path);
          const fileContentBuffer = await fs.readFile(filePath);

          if (isBinary(filePath, fileContentBuffer)) {
            try {
              const detected = await fileTypeFromBuffer(fileContentBuffer);
              if (detected?.mime.startsWith('image/')) {
                const imageBase64 = fileContentBuffer.toString('base64');
                imageParts.push({
                  type: 'image',
                  image: `data:${detected.mime};base64,${imageBase64}`,
                  mediaType: detected.mime,
                });
                continue;
              }
            } catch (e) {
              logger.warn(`image-type failed to detect image for ${file.path}`, { error: e instanceof Error ? e.message : String(e) });
            }
          }
          nonImageFiles.push(file);
        } catch (error) {
          logger.error('Error reading context file:', {
            path: file.path,
            error,
          });
          nonImageFiles.push(file);
        }
      }

      // Add file list for non-image files
      if (nonImageFiles.length > 0) {
        logger.debug('Adding file list for non-image files', {
          files: nonImageFiles.map((f) => f.path),
        });
        const fileList = nonImageFiles
          .map((file) => {
            return `- ${file.path}`;
          })
          .join('\n');

        messages.push({
          role: 'user',
          content: `The following files are currently in the working context:\n\n${fileList}`,
        });
        messages.push({
          role: 'assistant',
          content: 'OK, I have noted the files in the context.',
        });
      }

      // Add images as separate messages
      if (imageParts.length > 0) {
        logger.debug('Adding images as separate messages', {
          count: imageParts.length,
        });
        messages.push({
          role: 'user',
          content: imageParts,
        });
        messages.push({
          role: 'assistant',
          content: 'I can see the provided images and will use them for reference.',
        });
      }
    }

    return messages;
  }

  private async getAvailableTools(
    task: Task,
    mode: Mode,
    profile: AgentProfile,
    provider: ProviderProfile,
    model: string,
    mcpConnectors: McpConnector[] = [],
    messages?: ContextMessage[],
    resultMessages?: ContextMessage[],
    abortSignal?: AbortSignal,
    promptContext?: PromptContext,
  ): Promise<ToolSet> {
    logger.debug('getAvailableTools', {
      enabledServers: profile.enabledServers,
      promptContext,
    });

    const approvalManager = new ApprovalManager(task, profile);

    // Build the toolSet directly from enabled clients and tools
    const toolSet: ToolSet = mcpConnectors.reduce((acc, mcpConnector) => {
      // Skip if serverName is not in the profile's enabledServers
      if (!profile.enabledServers.includes(mcpConnector.serverName)) {
        return acc;
      }

      // Process tools for this enabled server
      mcpConnector.tools.forEach((tool) => {
        const toolId = `${mcpConnector.serverName}${TOOL_GROUP_NAME_SEPARATOR}${tool.name}`;
        const normalizedToolId = toolId.toLowerCase().replaceAll(/\s+/g, '_');

        // Check approval state first from the profile
        const approvalState = profile.toolApprovals[toolId];

        // Skip tools marked as 'Never' approved
        if (approvalState === ToolApprovalState.Never) {
          logger.debug(`Skipping tool due to 'Never' approval state: ${toolId}`);
          return; // Do not add the tool if it's never approved
        }

        acc[normalizedToolId] = this.convertMpcToolToAiSdkTool(
          provider.provider.name,
          mcpConnector.serverName,
          task,
          profile,
          mcpConnector.client,
          tool,
          approvalManager,
          promptContext,
        );
      });

      return acc;
    }, {} as ToolSet);

    if (profile.useAiderTools) {
      const aiderTools = createAiderToolset(task, profile, promptContext);
      Object.assign(toolSet, aiderTools);
    }

    if (profile.usePowerTools) {
      const powerTools = createPowerToolset(task, profile, promptContext, abortSignal);
      Object.assign(toolSet, powerTools);
    }

    if (profile.useSubagents) {
      const subagentsToolset = await createSubagentsToolset(
        this.store.getSettings(),
        task,
        this.agentProfileManager,
        profile,
        abortSignal,
        messages,
        resultMessages,
      );
      Object.assign(toolSet, subagentsToolset);
    }

    if (profile.useTodoTools) {
      const todoTools = createTodoToolset(task, profile, promptContext);
      Object.assign(toolSet, todoTools);
    }

    if (profile.useTaskTools) {
      const taskTools = createTasksToolset(this.store.getSettings(), task, profile, promptContext);
      Object.assign(toolSet, taskTools);
    }

    // Add search parent task tool for subtasks
    if (task.task.parentId !== null) {
      toolSet[`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_PARENT_TASK}`] = createSearchParentTaskTool(task, promptContext);
    }

    if (profile.useMemoryTools) {
      const memoryTools = createMemoryToolset(task, profile, this.memoryManager, promptContext);
      Object.assign(toolSet, memoryTools);
    }

    if (profile.useSkillsTools) {
      const skillsTools = await createSkillsToolset(task, profile, promptContext);
      Object.assign(toolSet, skillsTools);
    }

    // Add helper tools
    const helperTools = createHelpersToolset();
    Object.assign(toolSet, helperTools);

    // Add provider-specific tools
    const providerTools = await this.modelManager.getProviderTools(provider, model);
    Object.assign(toolSet, providerTools);

    // Add extension tools
    if (this.extensionManager.isInitialized() && profile.useExtensionTools !== false) {
      const extensionTools = this.extensionManager.createExtensionToolset(task, mode, profile, abortSignal);
      Object.assign(toolSet, extensionTools);
    }

    return this.wrapToolsWithHooks(task, toolSet, abortSignal, promptContext);
  }

  private wrapToolsWithHooks(task: Task, toolSet: ToolSet, abortSignal?: AbortSignal, promptContext?: PromptContext): ToolSet {
    const wrappedToolSet: ToolSet = {};

    for (const [toolName, toolDef] of Object.entries(toolSet)) {
      wrappedToolSet[toolName] = {
        ...toolDef,
        execute: async (input: Record<string, unknown> | undefined, options: ToolCallOptions) => {
          const hookResult = await task.hookManager.trigger('onToolCalled', { toolName, args: input }, task, task.project);
          if (hookResult.blocked) {
            logger.warn(`Tool execution blocked by hook: ${toolName}`);
            return 'Tool execution blocked by hook.';
          }
          let effectiveInput = hookResult.event.args ?? (input as Record<string, unknown> | undefined);
          const [serverName, messageToolName] = extractServerNameToolName(toolName);

          task.addToolMessage(options.toolCallId, serverName, messageToolName, effectiveInput, undefined, undefined, promptContext);

          const toolCalledExtensionResult = await this.extensionManager.dispatchEvent(
            'onToolCalled',
            { toolName, input: effectiveInput, abortSignal: options.abortSignal || abortSignal },
            task.project,
            task,
          );
          if (toolCalledExtensionResult.output) {
            return toolCalledExtensionResult.output;
          }

          // Use modified input from extension if provided
          effectiveInput = (toolCalledExtensionResult.input ?? effectiveInput) as Record<string, unknown> | undefined;

          if (!options.abortSignal && abortSignal) {
            options.abortSignal = abortSignal;
          }

          const result = await toolDef.execute!(effectiveInput, options);
          const toolFinishedHookResult = await task.hookManager.trigger('onToolFinished', { toolName, args: effectiveInput, result }, task, task.project);
          const toolFinishedExtensionResult = await this.extensionManager.dispatchEvent(
            'onToolFinished',
            { toolName, input: effectiveInput, output: result },
            task.project,
            task,
          );

          if (toolFinishedExtensionResult.output) {
            return toolFinishedExtensionResult.output;
          } else if (toolFinishedHookResult.event.result) {
            return toolFinishedHookResult.event.result;
          } else {
            return result;
          }
        },
      };
    }

    return wrappedToolSet;
  }

  private convertMpcToolToAiSdkTool(
    providerName: LlmProviderName,
    serverName: string,
    task: Task,
    profile: AgentProfile,
    mcpClient: McpSdkClient,
    toolDef: McpTool,
    approvalManager: ApprovalManager,
    promptContext?: PromptContext,
  ): Tool {
    const toolId = `${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}`;

    const execute = async (args: { [x: string]: unknown } | undefined, { toolCallId }: ToolCallOptions) => {
      task.addToolMessage(toolCallId, serverName, toolDef.name, args, undefined, undefined, promptContext);

      // --- Tool Approval Logic ---
      const toolName = toolId;
      const questionKey = toolId;
      const questionText = `Approve tool ${toolDef.name} from ${serverName} MCP server?`;
      const questionSubject = args ? JSON.stringify(args) : undefined;

      const [isApproved, userInput] = await approvalManager.handleToolApproval(toolName, args, questionKey, questionText, questionSubject);

      if (!isApproved) {
        logger.warn(`Tool execution denied by user: ${toolId}`);
        return `Tool execution denied by user.${userInput ? ` User input: ${userInput}` : ''}`;
      }
      logger.debug(`Tool execution approved: ${toolId}`);
      // --- End Tool Approval Logic ---

      // Enforce minimum time between tool calls
      const timeSinceLastCall = Date.now() - this.lastToolCallTime;
      const currentMinTime = profile.minTimeBetweenToolCalls;
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
        this.lastToolCallTime = Date.now();
        return response;
      } catch (error) {
        logger.error(`Error calling tool ${serverName}${TOOL_GROUP_NAME_SEPARATOR}${toolDef.name}:`, error);
        // Update last tool call time even if there's an error
        this.lastToolCallTime = Date.now();
        // Return an error message string to the agent
        return `Error executing tool ${toolDef.name}: ${error instanceof Error ? error.message : String(error)}`;
      }
    };

    logger.debug(`Converting MCP tool to AI SDK tool: ${toolDef.name}`, toolDef);
    const inputSchema = this.fixInputSchema(providerName, toolDef.inputSchema);

    return {
      description: toolDef.description ?? '',
      inputSchema: jsonSchema({
        ...inputSchema,
        properties: inputSchema.properties ? inputSchema.properties : {},
        additionalProperties: false,
      }),
      execute,
    };
  }

  /**
   * Recursively strips unsupported JSON Schema 2019-09 keywords that are not
   * recognized by some MCP servers (like gemini-cli).
   */
  private stripUnsupportedSchemaKeywords(schema: Record<string, unknown>): Record<string, unknown> {
    // JSON Schema 2019-09 keywords to remove
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

    // Recursive helper to process schema objects
    const processObject = (obj: Record<string, unknown>): Record<string, unknown> => {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        // Skip unsupported keywords
        if (unsupportedKeywords.includes(key)) {
          continue;
        }

        // Recursively process objects
        if (value !== null && typeof value === 'object') {
          if (Array.isArray(value)) {
            // Process arrays (e.g., anyOf, oneOf, allOf, enum items)
            result[key] = value.map((item) => (item !== null && typeof item === 'object' ? processObject(item as Record<string, unknown>) : item));
          } else {
            // Process nested objects (e.g., properties, items, additionalProperties)
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
    if (provider === 'gemini' || provider === 'gemini-cli') {
      // Deep clone to avoid modifying the original schema
      const fixedSchema = JSON.parse(JSON.stringify(inputSchema));

      // First, strip JSON Schema 2019-09 keywords that are not supported
      const strippedSchema = this.stripUnsupportedSchemaKeywords(fixedSchema) as unknown as McpToolInputSchema;

      if (strippedSchema.properties) {
        for (const key of Object.keys(strippedSchema.properties)) {
          let property = strippedSchema.properties[key] as Record<string, unknown>;

          // Gemini requires that when any_of/one_of/all_of is present,
          // it must be the ONLY field in the property
          if (property.anyOf) {
            property = { any_of: property.anyOf };
            strippedSchema.properties[key] = property as JSONSchema7Definition;
          } else if (property.oneOf) {
            property = { one_of: property.oneOf };
            strippedSchema.properties[key] = property as JSONSchema7Definition;
          } else if (property.allOf) {
            property = { all_of: property.allOf };
            strippedSchema.properties[key] = property as JSONSchema7Definition;
          } else {
            // gemini does not like "default" in the schema
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
          // gemini requires at least one property in the schema
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

  async runAgent(
    task: Task,
    profile: AgentProfile,
    prompt: string | null,
    mode: Mode = 'agent',
    promptContext?: PromptContext,
    initialContextMessages?: ContextMessage[],
    initialContextFiles?: ContextFile[],
    systemPrompt?: string,
    includeInContext = true,
    abortSignal?: AbortSignal,
  ): Promise<ContextMessage[]> {
    let contextMessages = initialContextMessages ?? (await task.getContextMessages());
    let contextFiles = initialContextFiles ?? (await task.getContextFiles());

    const hookResult = await task.hookManager.trigger('onAgentStarted', { prompt, contextMessages, contextFiles }, task, task.project);
    if (hookResult.blocked) {
      logger.info('Agent execution blocked by hook');
      return [];
    }
    prompt = hookResult.event.prompt;
    if (hookResult.event.contextMessages) {
      contextMessages = hookResult.event.contextMessages;
    }
    if (hookResult.event.contextFiles) {
      contextFiles = hookResult.event.contextFiles;
    }

    if (!systemPrompt) {
      systemPrompt = await this.promptsManager.getSystemPrompt(this.store.getSettings(), task, profile);
    }

    const userRequestMessage: ContextUserMessage | null = prompt
      ? {
          id: promptContext?.id || uuidv4(),
          role: 'user',
          content: prompt,
          promptContext,
        }
      : null;

    const settings = this.store.getSettings();
    const projectProfiles = this.agentProfileManager.getProjectProfiles(task.getProjectDir());
    let resultMessages: ContextMessage[] = userRequestMessage ? [userRequestMessage] : [];

    const providers = this.store.getProviders();
    let provider = providers.find((p) => p.id === profile.provider);
    let modelName = profile.model;

    if (provider) {
      const extensionResult = await this.extensionManager.dispatchEvent(
        'onAgentStarted',
        {
          mode,
          prompt,
          agentProfile: profile,
          providerProfile: provider,
          model: modelName,
          promptContext,
          contextMessages,
          contextFiles,
          systemPrompt,
        },
        task.project,
        task,
      );
      if (extensionResult.blocked) {
        logger.info('Agent execution blocked by extension');
        return [];
      }
      profile = extensionResult.agentProfile;
      provider = extensionResult.providerProfile;
      modelName = extensionResult.model;
      prompt = extensionResult.prompt;
      promptContext = extensionResult.promptContext;
      contextMessages = extensionResult.contextMessages;
      contextFiles = extensionResult.contextFiles;
      systemPrompt = extensionResult.systemPrompt;
    }

    if (userRequestMessage && includeInContext) {
      await task.addContextMessage(userRequestMessage);
    }
    if (!provider) {
      logger.error(`Provider ${profile.provider} not found`);
      task.addLogMessage('error', 'Selected model is not configured. Select another model and try again.', true, promptContext);
      return resultMessages;
    }

    // Store resolved provider for use in retry logic
    const resolvedProvider = provider;

    this.telemetryManager.captureAgentRun(profile, task.task);

    logger.debug('runAgent', {
      taskId: task.taskId,
      profile,
      prompt,
      promptContext,
      contextMessages,
      contextFiles,
      systemPrompt: systemPrompt?.substring(0, 100),
    });

    // Create new abort controller for this run only if abortSignal is not provided
    const shouldCreateAbortController = !abortSignal;
    let controllerId: string | null = null;

    if (shouldCreateAbortController) {
      controllerId = uuidv4();
      logger.debug('Creating new abort controller for Agent run', {
        taskId: task.taskId,
        controllerId: controllerId,
      });
      const newController = new AbortController();
      this.abortControllers.set(controllerId, newController);
    }
    const effectiveAbortSignal = abortSignal || (controllerId ? this.abortControllers.get(controllerId)?.signal : undefined);

    const cacheControl = this.modelManager.getCacheControl(profile, provider.provider);
    const providerOptions = this.modelManager.getProviderOptions(provider, modelName);
    const providerParameters = this.modelManager.getProviderParameters(provider, modelName);

    const firstUserMessage = contextMessages.length > 0 ? contextMessages[0] : null;
    let messages = await this.prepareMessages(task, profile, contextMessages, contextFiles);
    const initialUserRequestMessageIndex = firstUserMessage
      ? messages.findIndex((message) => message.role === 'user' && message.content === firstUserMessage.content)
      : messages.length;

    // add user message
    messages.push(...resultMessages);

    // Normalize messages for provider-specific requirements
    messages = this.modelManager.normalizeMessages(provider, modelName, messages);

    let mcpConnectors: McpConnector[] = [];
    try {
      // Lazily initialize MCP clients for the current task
      const initStartTime = Date.now();
      let loadingMessageShown = false;

      const loadingTimeout = setTimeout(() => {
        loadingMessageShown = true;
        task.addLogMessage('loading', 'Initializing MCP servers...', false, promptContext);
      }, 3000);

      try {
        mcpConnectors = await this.mcpManager.initMcpConnectors(settings.mcpServers, task.getProjectDir(), task.getTaskDir(), false, profile.enabledServers);
      } finally {
        clearTimeout(loadingTimeout);
        if (loadingMessageShown) {
          task.addLogMessage('loading', undefined, false, promptContext);
        }
      }

      const initTime = Date.now() - initStartTime;
      logger.debug(`MCP servers initialized in ${initTime}ms`);
    } catch (error) {
      logger.error('Error initializing MCP clients:', error);
      task.addLogMessage('error', `Error initializing MCP clients: ${error}`, false, promptContext);
    }

    if (effectiveAbortSignal?.aborted) {
      logger.info('Prompt aborted by user (before Agent run)');
      return resultMessages;
    }

    const toolSet = await this.getAvailableTools(
      task,
      mode,
      profile,
      provider,
      modelName,
      mcpConnectors,
      contextMessages,
      resultMessages,
      effectiveAbortSignal,
      promptContext,
    );

    logger.info(`Running prompt with ${Object.keys(toolSet).length} tools.`);
    logger.debug('Tools:', {
      tools: Object.keys(toolSet),
    });

    let currentResponseId: string = uuidv4();

    try {
      logger.debug('Creating LLM model', {
        providerId: provider.id,
        providerName: provider.provider.name,
        modelName: modelName,
      });

      const model = await this.modelManager.createLlm(
        provider,
        modelName,
        settings,
        task.getProjectDir(),
        toolSet,
        systemPrompt,
        task.task.lastAgentProviderMetadata,
      );
      logger.debug('LLM model created successfully', {
        model: model.modelId,
      });

      // repairToolCall function that attempts to repair tool calls
      const repairToolCall = async ({ toolCall, tools, error, messages, system }) => {
        if (NoSuchToolError.isInstance(error)) {
          // If the tool doesn't exist, return a call to the helper tool
          // to inform the LLM about the missing tool.
          logger.warn(`Attempted to call non-existent tool: ${error.toolName}`);

          const matchingTool = error.availableTools?.find((availableTool) => availableTool.endsWith(`${TOOL_GROUP_NAME_SEPARATOR}${error.toolName}`));
          if (matchingTool) {
            logger.info(`Found matching tool for ${error.toolName}: ${matchingTool}. Retrying with full name.`);
            return {
              ...toolCall,
              toolName: matchingTool,
            };
          } else {
            return {
              ...toolCall,
              toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}no_such_tool`,
              input: JSON.stringify({
                toolName: error.toolName,
                availableTools: error.availableTools,
              }),
            };
          }
        } else if (InvalidToolInputError.isInstance(error)) {
          // If the arguments are invalid, return a call to the helper tool
          // to inform the LLM about the argument error.
          logger.warn(`Invalid input for tool: ${error.toolName}`, {
            input: error.toolInput,
            error: error.message,
          });
          return {
            ...toolCall,
            toolName: `helpers${TOOL_GROUP_NAME_SEPARATOR}invalid_tool_arguments`,
            input: JSON.stringify({
              toolName: error.toolName,
              toolInput: JSON.stringify(error.toolInput), // Pass the problematic input
              error: error.message, // Pass the validation error message
            }),
          };
        }

        // Attempt generic repair for other types of errors
        try {
          logger.info(`Attempting generic repair for tool call error: ${toolCall.toolName}`);
          const result = await generateText({
            model,
            system,
            messages: [
              ...messages,
              {
                role: 'assistant',
                parts: [
                  {
                    type: 'tool-call',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: JSON.stringify(toolCall.input),
                  },
                ],
              },
              {
                role: 'tool' as const,
                parts: [
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

          logger.info('Repair tool call result:', result);
          const newToolCall = result.toolCalls.find((newToolCall) => newToolCall.toolName === toolCall.toolName);
          return newToolCall != null
            ? {
                ...toolCall,
                // Ensure args are stringified for the AI SDK tool call format
                input: typeof newToolCall.input === 'string' ? newToolCall.input : JSON.stringify(newToolCall.input),
              }
            : null; // Return null if the LLM couldn't repair the call
        } catch (repairError) {
          logger.error('Error during tool call repair:', repairError);
          return null;
        }
      };

      // Get the model to use its temperature and max output tokens settings
      const modelSettings = this.modelManager.getModelSettings(provider.provider.name, modelName);
      const effectiveTemperature = profile.temperature ?? modelSettings?.temperature;
      const effectiveMaxOutputTokens = profile.maxTokens ?? modelSettings?.maxOutputTokens;

      logger.info('Parameters:', {
        model: model.modelId,
        temperature: effectiveTemperature,
        maxOutputTokens: effectiveMaxOutputTokens,
        minTimeBetweenToolCalls: profile.minTimeBetweenToolCalls,
        ...providerParameters,
      });

      const getBaseModelCallParams = async () => {
        const getOptimizedMessages = async () => {
          const originalMessages = messages as ContextMessage[];
          const optimized = await optimizeMessages(
            messages,
            cacheControl,
            task,
            profile,
            projectProfiles,
            initialUserRequestMessageIndex,
            this.extensionManager,
          );

          const extensionResult = await this.extensionManager.dispatchEvent(
            'onOptimizeMessages',
            {
              originalMessages,
              optimizedMessages: optimized as ContextMessage[],
            },
            task.project,
            task,
          );

          return (extensionResult.optimizedMessages as ModelMessage[]) ?? optimized;
        };

        const optimizedMessages = await getOptimizedMessages();

        return {
          providerOptions,
          model: wrapLanguageModel({
            model,
            middleware: extractReasoningMiddleware({
              tagName: 'think',
            }),
          }),
          system: systemPrompt,
          messages: optimizedMessages,
          tools: toolSet,
          abortSignal: effectiveAbortSignal,
          maxOutputTokens: effectiveMaxOutputTokens,
          maxRetries: 5,
          temperature: effectiveTemperature,
          experimental_telemetry: {
            isEnabled: true,
          },
          ...providerParameters,
        };
      };

      let iterationCount = 0;
      let retryCount = 0;

      while (true) {
        logger.info(`Starting iteration ${iterationCount}`);
        iterationCount++;

        if (iterationCount > profile.maxIterations) {
          logger.warn(`Max iterations (${profile.maxIterations}) reached. Stopping agent.`);
          task.addLogMessage(
            'warning',
            `The Agent has reached the maximum number of allowed iterations (${profile.maxIterations}). To allow more iterations, go to Settings -> Agent -> Parameters and increase Max Iterations.`,
            false,
            promptContext,
          );
          break;
        }

        let iterationError: unknown | null = null;
        let hasReasoning: boolean = false;
        let finishReason: null | FinishReason = null;
        let responseMessages: ContextMessage[] = [];
        let responseMessageIndex: number = 0;

        const onStepFinish = async (stepResult: StepResult<typeof toolSet>) => {
          finishReason = stepResult.finishReason;

          if (finishReason === 'error') {
            logger.error('Error during prompt:', { stepResult });
            return;
          }

          if (effectiveAbortSignal?.aborted) {
            logger.info('Prompt aborted by user');
            return;
          }

          responseMessages = await this.processStep(currentResponseId, stepResult, task, provider, modelName, promptContext, abortSignal);
          const hookResult = await task.hookManager.trigger('onAgentStepFinished', { stepResult, finishReason, responseMessages }, task, task.project);
          if (hookResult?.event?.finishReason) {
            finishReason = hookResult.event.finishReason;
          }
          if (hookResult?.event?.responseMessages) {
            responseMessages = hookResult.event.responseMessages;
          }
          const extensionResult = await this.extensionManager.dispatchEvent(
            'onAgentStepFinished',
            {
              mode,
              agentProfile: profile,
              currentResponseId,
              stepResult,
              finishReason,
              responseMessages,
            },
            task.project,
            task,
          );
          responseMessages = extensionResult.responseMessages;
          finishReason = extensionResult.finishReason;

          currentResponseId = uuidv4();
          responseMessageIndex = 0;
          hasReasoning = false;
        };

        const shouldContinue = await this.compactMessagesIfNeeded(
          task,
          profile,
          provider,
          modelName,
          userRequestMessage || findLastUserMessage(contextMessages)!,
          contextMessages,
          contextFiles,
          messages,
          resultMessages,
          promptContext,
          effectiveAbortSignal,
        );

        if (!shouldContinue) {
          logger.debug('Agent run aborted due to context compaction');
          await task.updateTask({
            state: DefaultTaskState.Interrupted,
          });
          break;
        }

        if (this.modelManager.isStreamingDisabled(provider, modelName)) {
          logger.debug('Streaming disabled, using generateText');
          await generateText({
            ...(await getBaseModelCallParams()),
            onStepFinish,
            experimental_repairToolCall: repairToolCall,
          });
        } else {
          logger.debug('Streaming enabled, using streamText');
          const result = streamText({
            ...(await getBaseModelCallParams()),
            experimental_transform: smoothStream({
              delayInMs: 20,
              chunking: 'line',
            }),
            onError: ({ error }) => {
              if (effectiveAbortSignal?.aborted) {
                return;
              }

              logger.error('Error during prompt:', { error });
              iterationError = error;
              if (typeof error === 'string') {
                task.addLogMessage('error', error, false, promptContext);
                // @ts-expect-error checking keys in error
              } else if (APICallError.isInstance(error) || ('message' in error && 'responseBody' in error)) {
                task.addLogMessage('error', `${error.message}: ${error.responseBody}`, false, promptContext);
              } else if (error instanceof Error) {
                task.addLogMessage('error', error.message, false, promptContext);
              } else {
                task.addLogMessage('error', JSON.stringify(error), false, promptContext);
              }
            },
            onStepFinish,
            experimental_repairToolCall: repairToolCall,
          });

          for await (const chunk of result.fullStream) {
            logger.debug('Chunk:', { chunk: chunk.type, responseMessageIndex });

            const responseMessageId = responseMessageIndex > 0 ? `${currentResponseId}-${responseMessageIndex}` : currentResponseId;
            if (chunk.type === 'text-start') {
              if (hasReasoning) {
                await task.processResponseMessage({
                  id: responseMessageId,
                  action: 'response',
                  content: ANSWER_RESPONSE_START_TAG,
                  finished: false,
                  promptContext,
                });
                hasReasoning = false;
              }
            } else if (chunk.type === 'text-end') {
              responseMessageIndex++;
            } else if (chunk.type === 'text-delta') {
              if (chunk.text.trim()) {
                await task.processResponseMessage({
                  id: responseMessageId,
                  action: 'response',
                  content: chunk.text,
                  finished: false,
                  promptContext,
                });
              }
            } else if (chunk.type === 'reasoning-start') {
              await task.processResponseMessage({
                id: responseMessageId,
                action: 'response',
                content: THINKING_RESPONSE_STAR_TAG,
                finished: false,
                promptContext,
              });
              hasReasoning = true;
            } else if (chunk.type === 'reasoning-delta') {
              await task.processResponseMessage({
                id: responseMessageId,
                action: 'response',
                content: chunk.text,
                finished: false,
                promptContext,
              });
            } else if (chunk.type === 'tool-input-start') {
              task.addLogMessage('loading', 'Preparing tool...', false, promptContext);
            } else if (chunk.type === 'tool-call') {
              task.addLogMessage('loading', 'Executing tool...', false, promptContext);
            } else if (chunk.type === 'tool-result') {
              const [serverName, toolName] = extractServerNameToolName(chunk.toolName);
              const toolPromptContext = extractPromptContextFromToolResult(chunk.output) ?? promptContext;
              task.addToolMessage(chunk.toolCallId, serverName, toolName, chunk.input, JSON.stringify(chunk.output), undefined, toolPromptContext);
              task.addLogMessage('loading', undefined, false, promptContext);
            }
          }
        }

        if (iterationError) {
          logger.error('Error during prompt:', iterationError);
          if (
            iterationError instanceof APICallError &&
            iterationError.isRetryable &&
            this.modelManager.isRetryable(resolvedProvider, modelName, iterationError)
          ) {
            // try again
            continue;
          } else {
            // stop
            break;
          }
        }

        const newMessages = this.filterResultMessages(responseMessages);
        messages.push(...responseMessages);
        resultMessages.push(...newMessages);

        if (includeInContext) {
          // Persist new messages incrementally after each iteration
          try {
            for (const message of newMessages) {
              await task.addContextMessage(message);
            }
          } catch (error) {
            logger.error('Failed to persist messages incrementally:', {
              taskId: task.taskId,
              error,
            });
          }
        }

        if (effectiveAbortSignal?.aborted) {
          logger.info('Prompt aborted by user (inside loop)');
          break;
        }

        if ((finishReason === 'unknown' || finishReason === 'other' || !finishReason) && retryCount < MAX_RETRIES) {
          logger.debug(`Finish reason is "${finishReason}". Retrying...`);
          retryCount++;
          continue;
        }

        // Check for 'stop' with trailing tool message
        const lastMessage = responseMessages[responseMessages.length - 1];
        if (finishReason === 'stop' && lastMessage?.role === 'tool') {
          logger.debug('Finish reason is "stop" but last message is a tool call. Retrying...');
          retryCount++;
          continue;
        }

        retryCount = 0;

        if (lastMessage?.role === 'user') {
          // if response messages have been modified by other means (e.g. hooks), we need to continue when the last message is a user message
          logger.debug('Last message is a user message. Continuing...');
          continue;
        }

        if (finishReason === 'length') {
          task.addLogMessage(
            'warning',
            'The Agent has reached the maximum number of allowed tokens. To allow more tokens, go to Settings -> Agent -> Parameters and increase Max Tokens.',
            false,
            promptContext,
          );
        }

        if (finishReason !== 'tool-calls') {
          logger.info(`Prompt finished. Reason: ${finishReason}`);
          break;
        }
      }

      const hookResult = await task.hookManager.trigger('onAgentFinished', { aborted: false, contextMessages, resultMessages }, task, task.project);
      if (hookResult?.event?.resultMessages) {
        resultMessages = hookResult.event.resultMessages;
      }
      const extensionResult = await this.extensionManager.dispatchEvent(
        'onAgentFinished',
        {
          mode,
          aborted: false,
          contextMessages,
          resultMessages,
        },
        task.project,
        task,
      );
      resultMessages = extensionResult.resultMessages;
    } catch (error) {
      if (effectiveAbortSignal?.aborted) {
        logger.info('Prompt aborted by user');

        const hookResult = await task.hookManager.trigger('onAgentFinished', { aborted: true, contextMessages, resultMessages }, task, task.project);
        if (hookResult?.event?.resultMessages) {
          resultMessages = hookResult.event.resultMessages;
        }
        const extensionResult = await this.extensionManager.dispatchEvent(
          'onAgentFinished',
          {
            mode,
            aborted: true,
            contextMessages,
            resultMessages,
          },
          task.project,
          task,
        );
        resultMessages = extensionResult.resultMessages;

        return resultMessages;
      }

      logger.error('Error running prompt:', error);

      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('credentials'))) {
        task.addLogMessage('error', `${error.message}. Configure credentials in the Model Library.`, false, promptContext);
      } else {
        task.addLogMessage('error', `${error instanceof Error ? error.message : String(error)}`, false, promptContext);
      }
    } finally {
      // Clean up abort controller only if we created it
      if (controllerId) {
        this.abortControllers.delete(controllerId);
        logger.debug('Cleaned up abort controller', {
          taskId: task.taskId,
          controllerId: controllerId,
        });
      }
    }

    return resultMessages;
  }

  private filterResultMessages(resultMessages: ContextMessage[]) {
    return resultMessages.filter((message) => {
      if (message.role === 'tool' && message.id.startsWith(`${HELPERS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}`)) {
        return false;
      }
      if (message.role === 'assistant') {
        if (
          Array.isArray(message.content) &&
          message.content.some(
            (content) => content.type === 'tool-call' && content.toolName.startsWith(`${HELPERS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}`),
          )
        ) {
          return false;
        }
        return true;
      }
      return true;
    });
  }

  private async getContextFilesAsToolCallMessages(task: Task, profile: AgentProfile, contextFiles: ContextFile[]): Promise<ModelMessage[]> {
    const messages: ModelMessage[] = [];

    // Check if power file_read tool is available (not 'Never')
    const fileReadToolId = `${POWER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${POWER_TOOL_FILE_READ}`;
    const fileReadApprovalState = profile.toolApprovals[fileReadToolId];
    const useToolCallFormat = fileReadApprovalState !== ToolApprovalState.Never;

    // Filter out rule files as they are already included in the system prompt
    const filteredContextFiles = contextFiles.filter((file) => {
      const normalizedPath = path.normalize(file.path);
      const normalizedRulesDir = path.normalize(AIDER_DESK_PROJECT_RULES_DIR);

      return (
        !normalizedPath.startsWith(normalizedRulesDir + path.sep) &&
        !normalizedPath.startsWith(normalizedRulesDir + '/') &&
        normalizedPath !== normalizedRulesDir
      );
    });

    if (filteredContextFiles.length === 0) {
      return messages;
    }

    // Separate readonly and editable files
    const [readOnlyFiles, editableFiles] = filteredContextFiles.reduce(
      ([readOnly, editable], file) => (file.readOnly ? [[...readOnly, file], editable] : [readOnly, [...editable, file]]),
      [[], []] as [ContextFile[], ContextFile[]],
    );

    // If tool call format is not available, fall back to the old user message format
    if (!useToolCallFormat) {
      return await this.getContextFilesMessages(task, profile, contextFiles);
    }

    // Use tool call format
    const createToolCallAndResult = async (files: ContextFile[], readOnlyFile: boolean): Promise<ModelMessage[]> => {
      if (files.length === 0) {
        return [];
      }

      const fileMessages: ModelMessage[] = [];
      const nonBinaryFiles: Array<{ path: string; relativePath: string }> = [];
      const imageFiles: Array<{
        path: string;
        relativePath: string;
        mimeType: string;
        imageBase64: string;
      }> = [];

      // Read all files and categorize them
      for (const file of files) {
        try {
          const filePath = path.resolve(task.getTaskDir(), file.path);
          const fileContentBuffer = await fs.readFile(filePath);
          const relativePath = path.isAbsolute(file.path) ? path.relative(task.getTaskDir(), file.path) : file.path;

          // If binary, try to detect if it's an image
          if (isBinary(filePath, fileContentBuffer)) {
            try {
              const detected = await fileTypeFromBuffer(fileContentBuffer);
              if (detected?.mime.startsWith('image/')) {
                imageFiles.push({
                  path: filePath,
                  relativePath,
                  mimeType: detected.mime,
                  imageBase64: fileContentBuffer.toString('base64'),
                });
                continue;
              }
            } catch (e) {
              logger.warn(`image-type failed to detect image for ${file.path}`, { error: e instanceof Error ? e.message : String(e) });
            }
            continue;
          }

          nonBinaryFiles.push({
            path: filePath,
            relativePath,
          });
        } catch (error) {
          logger.error('Error reading context file:', {
            path: file.path,
            error,
          });
        }
      }

      // Process non-binary files: each file gets its own assistant message with tool-call and tool-result
      for (const { path: filePath, relativePath } of nonBinaryFiles) {
        try {
          const content = await readFileContent(filePath, true);
          const toolCallId = uuidv4();

          const assistantMessage: ModelMessage = {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: readOnlyFile
                  ? 'The following file is part of the working context as read-only reference material.'
                  : 'The following file is part of the working context and can be edited.',
              },
              {
                type: 'tool-call' as const,
                toolCallId,
                toolName: fileReadToolId,
                input: {
                  filePath: relativePath,
                  withLines: true,
                },
              },
            ],
          };

          const toolResultMessage: ModelMessage = {
            role: 'tool' as const,
            content: [
              {
                type: 'tool-result',
                toolCallId,
                toolName: fileReadToolId,
                output: {
                  type: 'text',
                  value: content,
                },
              },
            ],
          };

          fileMessages.push(assistantMessage, toolResultMessage);
        } catch (error) {
          logger.error('Error processing context file with readFileContent:', {
            path: relativePath,
            error,
          });
        }
      }

      // Process image files: keep current behavior
      for (const imageData of imageFiles) {
        fileMessages.push({
          role: 'assistant',
          content: `Provide content of image file: ${imageData.relativePath}`,
        });

        const imageMessage: ModelMessage = {
          role: 'user',
          content: [
            {
              type: 'image',
              image: `data:${imageData.mimeType};base64,${imageData.imageBase64}`,
              mediaType: imageData.mimeType,
            },
          ],
        };
        fileMessages.push(imageMessage);
      }

      return fileMessages;
    };

    // Process read-only files
    if (readOnlyFiles.length > 0) {
      const readOnlyMessages = await createToolCallAndResult(readOnlyFiles, true);
      messages.push(...readOnlyMessages);
    }

    // Process editable files
    if (editableFiles.length > 0) {
      const editableMessages = await createToolCallAndResult(editableFiles, false);
      messages.push(...editableMessages);
    }

    return messages;
  }

  private async prepareMessages(task: Task, profile: AgentProfile, contextMessages: ModelMessage[], contextFiles: ContextFile[]): Promise<ModelMessage[]> {
    const messages: ModelMessage[] = [];

    // Add repo map if enabled
    if (profile.includeRepoMap) {
      const repoMap = task.getRepoMap();
      if (repoMap) {
        messages.push({
          role: 'user',
          content: repoMap,
        });
        messages.push({
          role: 'assistant',
          content: 'Ok, I will use the repository map as a reference.',
        });
      }
    }

    // Add context files with content or just list of working files
    if (profile.includeContextFiles) {
      const contextFilesMessages = await this.getContextFilesAsToolCallMessages(task, profile, contextFiles);
      // Add message history before context files
      messages.push(...contextMessages);
      messages.push(...contextFilesMessages);
    } else {
      const workingFilesMessages = await this.getWorkingFilesMessages(task, contextFiles);
      messages.push(...workingFilesMessages);
      // Add message history after working files
      messages.push(...contextMessages);
    }

    return messages;
  }

  async generateText(
    agentProfile: AgentProfile,
    systemPrompt: string,
    prompt: string,
    projectDir: string,
    messages: ContextMessage[] = [],
    abortable = true,
    abortSignal?: AbortSignal,
  ): Promise<string | undefined> {
    const providers = this.store.getProviders();
    const provider = providers.find((p) => p.id === agentProfile.provider);
    if (!provider) {
      throw new Error(`Provider ${agentProfile.provider} not found`);
    }

    const settings = this.store.getSettings();
    const model = await this.modelManager.createLlm(provider, agentProfile.model, settings, projectDir, undefined, systemPrompt, undefined);
    const providerOptions = this.modelManager.getProviderOptions(provider, agentProfile.model);
    const providerParameters = this.modelManager.getProviderParameters(provider, agentProfile.model);

    const controllerId = uuidv4();
    const newController = abortable ? new AbortController() : null;
    if (newController) {
      this.abortControllers.set(controllerId, newController);
    }
    const effectiveAbortSignal = abortSignal || newController?.signal;

    logger.info('Generating text:', {
      providerId: provider.id,
      providerName: provider.provider.name,
      modelName: agentProfile.model,
      systemPrompt: systemPrompt.substring(0, 100),
      prompt: prompt.substring(0, 100),
    });

    messages.push({
      id: uuidv4(),
      role: 'user',
      content: prompt,
    });

    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: await optimizeMessages(messages),
        abortSignal: effectiveAbortSignal,
        providerOptions,
        ...providerParameters,
      });

      return result.text;
    } catch (error) {
      if (effectiveAbortSignal?.aborted) {
        logger.info('Generating text aborted by user');
        return undefined;
      }
      logger.error('Error generating text:', error);
      throw error;
    } finally {
      if (newController) {
        logger.debug('Cleaned up abort controller', { controllerId });
        this.abortControllers.delete(controllerId);
      }
    }
  }

  async estimateTokens(task: Task, profile: AgentProfile): Promise<number> {
    try {
      const providers = this.store.getProviders();
      const provider = providers.find((p) => p.id === profile.provider);
      if (!provider) {
        logger.warn(`Estimation failed: Provider ${profile.provider} not found`);
        return 0;
      }

      const messages = await this.prepareMessages(task, profile, await task.getContextMessages(), await task.getContextFiles());
      const toolSet = await this.getAvailableTools(task, 'agent', profile, provider, profile.model);
      const systemPrompt = await this.promptsManager.getSystemPrompt(this.store.getSettings(), task, profile);

      const cacheControl = this.modelManager.getCacheControl(profile, provider.provider);

      const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');
      const userRequestMessageIndex = lastUserIndex >= 0 ? lastUserIndex : 0;

      const optimizedMessages = await optimizeMessages(
        messages,
        cacheControl,
        task,
        profile,
        this.agentProfileManager.getProjectProfiles(task.getProjectDir()),
        userRequestMessageIndex,
      );

      // Format tools for the prompt
      const toolDefinitions = Object.entries(toolSet).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema ? tool.inputSchema : '', // Get Zod schema description
      }));
      const toolDefinitionsString = `Available tools: ${JSON.stringify(toolDefinitions, null, 2)}`;

      // Add tool definitions and system prompt to the beginning
      optimizedMessages.unshift({
        role: 'system',
        content: toolDefinitionsString,
      });
      optimizedMessages.unshift({ role: 'system', content: systemPrompt });

      const chatMessages = optimizedMessages.map((msg) => ({
        role: msg.role === 'tool' ? 'user' : msg.role, // Map 'tool' role to user message as gpt-tokenizer does not support tool messages
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content), // Handle potential non-string content if necessary
      }));

      return countTokens(chatMessages);
    } catch (error) {
      logger.error(`Error counting tokens: ${error}`);
      return 0;
    }
  }

  interrupt() {
    if (this.abortControllers.size > 0) {
      logger.info(`Interrupting ${this.abortControllers.size} Agent run(s)`);
      for (const [controllerId, controller] of this.abortControllers) {
        controller.abort();
        logger.debug('Aborted controller', { controllerId });
      }
    }
  }

  isRunning() {
    return this.abortControllers.size > 0;
  }

  private async processStep<TOOLS extends ToolSet>(
    currentResponseId: string,
    { content, reasoningText, text, toolCalls, toolResults, finishReason, usage, providerMetadata, response, reasoning, files }: StepResult<TOOLS>,
    task: Task,
    provider: ProviderProfile,
    model: string,
    promptContext?: PromptContext,
    abortSignal?: AbortSignal,
  ): Promise<ContextMessage[]> {
    logger.info(`Step finished. Reason: ${finishReason}`, {
      currentResponseId,
      reasoningText: reasoningText?.substring(0, 100), // Log truncated reasoning
      text: text?.substring(0, 100), // Log truncated text
      toolCalls: toolCalls?.map((tc) => tc.toolName),
      toolResults: toolResults?.map((tr) => tr.toolName),
      files: files?.map((f) => f.mediaType),
      usage,
      providerMetadata,
      promptContext,
      reasoning,
      responseBody: response.body,
    });

    const messages: ContextMessage[] = [];
    const usageReport: UsageReportData = this.modelManager.getUsageReport(task, provider, model, usage, providerMetadata);

    if (providerMetadata) {
      await task.updateTask({ lastAgentProviderMetadata: providerMetadata });
    }

    let responseMessageIndex: number = 0;

    const processToolResult = (toolResult: TypedToolResult<TOOLS>, isLast = true) => {
      const [serverName, toolName] = extractServerNameToolName(toolResult.toolName);
      const toolPromptContext = extractPromptContextFromToolResult(toolResult.output) ?? promptContext;

      // Update the existing tool message with the result
      task.addToolMessage(
        toolResult.toolCallId,
        serverName,
        toolName,
        toolResult.input,
        JSON.stringify(toolResult.output),
        isLast ? usageReport : undefined, // Only add usage report to the last tool message
        toolPromptContext,
      );
    };

    for (let i = 0; i < content.length; i++) {
      let part = content[i];
      if (part.type === 'reasoning') {
        reasoningText = part.text;
        // move to the next one right away
        part = content[++i];
      }
      if (part?.type === 'text') {
        text = part.text;
      }

      if (text || reasoningText) {
        const message: ResponseMessage = {
          id: responseMessageIndex > 0 ? `${currentResponseId}-${responseMessageIndex}` : currentResponseId,
          action: 'response',
          content: reasoningText?.trim() ? `${THINKING_RESPONSE_STAR_TAG}${reasoningText.trim()}${ANSWER_RESPONSE_START_TAG}${text.trim()}` : text,
          finished: true,
          usageReport: i === content.length - 1 && toolResults.length === 0 ? usageReport : undefined,
          promptContext,
        };
        await task.processResponseMessage(message);

        text = '';
        reasoningText = undefined;
        responseMessageIndex++;
      }

      if (part?.type === 'tool-result') {
        const toolResult = toolResults.find((toolResult) => toolResult.toolCallId === part.toolCallId);
        if (toolResult) {
          toolResults = toolResults.filter((toolResult) => toolResult.toolCallId !== part.toolCallId);
          processToolResult(toolResult, i === content.length - 1 && toolResults.length === 0);
        }
      }
    }

    // Process successful tool results *after* sending text/reasoning and handling errors
    for (let i = 0; i < toolResults.length; i++) {
      const toolResult = toolResults[i];
      processToolResult(toolResult, i === toolResults.length - 1);
    }

    if (!abortSignal?.aborted) {
      task.addLogMessage('loading', undefined, false, promptContext);
    }

    response.messages.forEach((message) => {
      if (message.role === 'assistant') {
        messages.push({
          ...message,
          id: currentResponseId,
          usageReport: toolResults?.length && responseMessageIndex === 0 ? undefined : usageReport,
          promptContext,
        });
      } else if (message.role === 'tool') {
        messages.push({
          ...message,
          // @ts-expect-error the id is there
          id: message.id || uuidv4(),
          usageReport,
          promptContext,
        });
      }
    });

    return messages;
  }

  private async compactMessagesIfNeeded(
    task: Task,
    profile: AgentProfile,
    provider: ProviderProfile,
    model: string,
    userRequestMessage: ContextUserMessage,
    contextMessages: ContextMessage[],
    contextFiles: ContextFile[],
    messages: ModelMessage[],
    resultMessages: ContextMessage[],
    promptContext?: PromptContext,
    abortSignal?: AbortSignal,
  ) {
    const contextCompactingThreshold =
      task.task.contextCompactingThreshold ?? this.store.getProjectSettings(task.getProjectDir())?.contextCompactingThreshold ?? 0;
    const contextCompactionType = profile.isSubagent
      ? ContextCompactionType.Compact
      : (this.store.getSettings().taskSettings.contextCompactionType ?? ContextCompactionType.Compact);
    const usageReport = resultMessages[resultMessages.length - 1]?.usageReport;
    const maxTokens = this.modelManager.getModelSettings(provider.provider.name, model)?.maxInputTokens;

    if (contextCompactingThreshold === 0 || !usageReport || !maxTokens) {
      return true;
    }

    // Check for context compacting
    const totalTokens = usageReport.sentTokens + usageReport.receivedTokens + (usageReport.cacheReadTokens ?? 0);
    if (maxTokens && totalTokens > (maxTokens * contextCompactingThreshold) / 100) {
      logger.info(
        `Token usage ${totalTokens} exceeds threshold of ${contextCompactingThreshold}%. Compacting conversation with type: ${contextCompactionType}.`,
      );

      if (contextCompactionType === ContextCompactionType.Compact) {
        await task.compactConversation(
          'agent',
          undefined,
          profile,
          [...contextMessages, ...resultMessages],
          promptContext,
          abortSignal,
          false,
          'Token usage exceeds threshold. Compacting conversation...',
        );

        // reload messages after compacting
        messages.length = 0;
        resultMessages.length = 0;

        messages.push(...(await this.prepareMessages(task, profile, await task.getContextMessages(), contextFiles)));
        resultMessages.push({
          id: uuidv4(),
          role: 'user',
          content: `Based on your compacted summary of our previous conversation, please continue our work with my request:\n\n${userRequestMessage.content}`,
          promptContext,
        });
        messages.push(...resultMessages);
      } else if (contextCompactionType === ContextCompactionType.Handoff) {
        // Perform handoff
        await task.handoffConversation(
          'agent',
          'Continue with the task based on the last user message',
          true,
          [...contextMessages, ...resultMessages],
          false,
          'Token usage exceeds threshold. Handing off conversation to new task...',
        );

        return false;
      }
    }

    return true;
  }
}

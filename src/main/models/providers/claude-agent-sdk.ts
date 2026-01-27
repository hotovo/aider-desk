import { claudeCode } from 'ai-sdk-provider-claude-code';
import { type JSONSchema, JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import { isClaudeAgentSdkProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import type { ClaudeCodeSettings } from 'ai-sdk-provider-claude-code';
import type { LanguageModelUsage, ToolSet } from 'ai';
import type { LanguageModelV2, JSONSchema7 } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import { Task } from '@/task/task';
import { calculateCost } from '@/models/providers/default';
import { isDev, isElectron } from '@/app';
import { CLAUDE_CODE_EXECUTABLE_PATH } from '@/constants';
import { findExecutableInPath } from '@/utils/shell';

interface ClaudeCodeProviderMetadata {
  'claude-code': {
    costUsd?: number;
    rawUsage: {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      input_tokens: number;
      output_tokens: number;
    };
    lastMessageRawUsage?: {
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
      input_tokens: number;
      output_tokens: number;
    };
    sessionId?: string;
  };
}

export const loadClaudeAgentSdkModels = async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isClaudeAgentSdkProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  try {
    const models: Model[] = [
      {
        id: 'haiku',
        providerId: profile.id,
        maxInputTokens: 200000,
        maxOutputTokensLimit: 64000,
      },
      {
        id: 'sonnet',
        providerId: profile.id,
        maxInputTokens: 200000,
        maxOutputTokens: 64000,
      },
      {
        id: 'opus',
        providerId: profile.id,
        maxInputTokens: 200000,
        maxOutputTokensLimit: 64000,
      },
    ];

    logger.info(`Loaded ${models.length} Claude Agent SDK models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Claude Agent SDK models';
    logger.error('Error loading Claude Agent SDK models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

const hasClaudeAgentSdkEnvVars = (): boolean => {
  return findExecutableInPath('claude') !== null;
};

const getClaudeAgentSdkAiderMapping = (_provider: ProviderProfile, modelId: string): AiderModelMapping => {
  return {
    environmentVariables: {},
    modelName: `claude-agent-sdk/${modelId}`,
  };
};

/**
 * Normalizes the AI SDK ToolSet for Claude Agent SDK by:
 * 1. Converting JSONSchema-based inputSchemas (from MCP tools) to Zod schemas
 * 2. Wrapping specific tools to optimize their output
 *
 * This is necessary because:
 * - Claude Agent SDK provider internally needs ZodRawShape to extract from inputSchema
 * - Tools converted from MCP use jsonSchema() which wraps JSONSchema7, not Zod
 * - Some tools return large amounts of data that need to be optimized
 */
const normalizeAiSdkToolSet = (toolSet: ToolSet): ToolSet => {
  const normalizedToolSet: ToolSet = {};

  for (const [toolName, toolDefinition] of Object.entries(toolSet)) {
    // First, check if the inputSchema is a jsonSchema wrapper (from MCP tools)
    // and convert it to a proper Zod schema
    let normalizedTool = { ...toolDefinition };

    const inputSchema = toolDefinition.inputSchema;
    // Check if this is a jsonSchema() wrapper by looking for the jsonSchema property
    // The AI SDK's jsonSchema() function wraps a JSONSchema7 in a Schema object
    if (inputSchema && typeof inputSchema === 'object' && 'jsonSchema' in inputSchema) {
      const jsonSchemaObj = (inputSchema as { jsonSchema: JSONSchema7 | (() => JSONSchema7) }).jsonSchema;
      const schema = typeof jsonSchemaObj === 'function' ? jsonSchemaObj() : jsonSchemaObj;

      // Convert JSONSchema7 to Zod schema
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zodShape = JSONSchemaToZod.convert(schema as JSONSchema) as any;
      normalizedTool = {
        ...toolDefinition,
        inputSchema: zodShape,
      };

      logger.debug(`Converted JSONSchema to Zod for tool: ${toolName}`);
    }

    // Check if this is the aider run_prompt tool
    if (toolName === `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`) {
      const originalExecute = normalizedTool.execute;
      if (!originalExecute) {
        normalizedToolSet[toolName] = normalizedTool;
        continue;
      }
      normalizedToolSet[toolName] = {
        ...normalizedTool,
        execute: async (args, options) => {
          // Run the original execute function
          const result = await originalExecute(args, options);

          // Optimize the result by removing responses and promptContext (same as optimizer.ts)
          if (result && typeof result === 'object') {
            delete result.responses;
          }

          return result;
        },
      };
    }
    // Check if this is the subagent run_task tool
    else if (toolName === `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`) {
      const originalExecute = normalizedTool.execute;
      if (!originalExecute) {
        normalizedToolSet[toolName] = normalizedTool;
        continue;
      }
      normalizedToolSet[toolName] = {
        ...normalizedTool,
        execute: async (args, options) => {
          // Run the original execute function
          const result = await originalExecute(args, options);

          // Optimize the result by keeping only the last message (same as optimizer.ts)
          if (result && typeof result === 'object') {
            try {
              const messages = result.messages;
              if (Array.isArray(messages) && messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                return {
                  messages: [lastMessage],
                  promptContext: result.promptContext,
                };
              }
            } catch (error) {
              logger.warn('Failed to optimize subagent result:', error);
              // If optimization fails, return the original result
            }
          }

          return result;
        },
      };
    } else {
      // For all other tools, use the normalized tool
      normalizedToolSet[toolName] = normalizedTool;
    }
  }

  return normalizedToolSet;
};

export const createClaudeAgentSdkLlm = (
  _profile: ProviderProfile,
  model: Model,
  _settings: SettingsData,
  _projectDir: string,
  toolSet?: ToolSet,
  systemPrompt?: string,
  providerMetadata?: unknown,
): LanguageModelV2 => {
  const settings: ClaudeCodeSettings = {
    env: {
      // setting MAX_MCP_OUTPUT_TOKENS to a high number to avoid errors
      MAX_MCP_OUTPUT_TOKENS: '9999999',
    },
    // for now only tools from AiderDesk are allowed
    disallowedTools: [
      'AskUserQuestion',
      'Bash',
      'TaskOutput',
      'Edit',
      'ExitPlanMode',
      'Glob',
      'Grep',
      'KillShell',
      'MCPSearch',
      'NotebookEdit',
      'Read',
      'Skill',
      'Task',
      'TaskCreate',
      'TaskGet',
      'TaskList',
      'TaskUpdate',
      'TodoWrite',
      'WebFetch',
      'WebSearch',
      'Write',
      'LSP',
    ],
  };

  if (providerMetadata && typeof providerMetadata === 'object' && 'claude-code' in providerMetadata) {
    const metadata = (providerMetadata as ClaudeCodeProviderMetadata)['claude-code'] || {};
    settings.resume = metadata.sessionId;
  }

  if (!isDev() && isElectron()) {
    settings.pathToClaudeCodeExecutable = CLAUDE_CODE_EXECUTABLE_PATH;
  }

  if (toolSet) {
    logger.debug(`Adding ${Object.keys(toolSet).length} tools to Claude Agent SDK`, {
      tools: Object.keys(toolSet),
    });
    settings.aiSdkTools = normalizeAiSdkToolSet(toolSet);
    settings.allowedTools = ['mcp__ai-sdk'];
  } else {
    settings.allowedTools = [];
  }

  if (systemPrompt) {
    settings.systemPrompt = systemPrompt;
  }

  return claudeCode(model.id, settings);
};

const getClaudeAgentSdkUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  _usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const data = (providerMetadata as ClaudeCodeProviderMetadata)['claude-code'] || {};
  const usage = data.lastMessageRawUsage || data.rawUsage || {};

  logger.debug('Claude Agent SDK usage:', { usage: _usage, providerMetadata });
  const sentTokens = usage.input_tokens || 0;
  const receivedTokens = usage.output_tokens || 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;

  const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    cacheWriteTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

const getClaudeAgentSdkProviderParameters = (): Record<string, unknown> => {
  return {
    system: undefined,
  };
};

export const claudeAgentSdkProviderStrategy: LlmProviderStrategy = {
  createLlm: createClaudeAgentSdkLlm,
  getUsageReport: getClaudeAgentSdkUsageReport,
  loadModels: loadClaudeAgentSdkModels,
  hasEnvVars: hasClaudeAgentSdkEnvVars,
  getAiderMapping: getClaudeAgentSdkAiderMapping,
  getProviderParameters: getClaudeAgentSdkProviderParameters,
};

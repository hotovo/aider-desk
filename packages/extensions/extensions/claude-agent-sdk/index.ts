import { claudeCode, createAiSdkMcpServer } from 'ai-sdk-provider-claude-code';
import { type JSONSchema, JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

import type {
  Extension,
  ExtensionContext,
  LoadModelsResponse,
  Model,
  ProviderDefinition,
  ProviderProfile,
  SettingsData,
  AiderModelMapping,
  UsageReportData,
} from '@aiderdesk/extensions';

import type { ClaudeCodeSettings } from 'ai-sdk-provider-claude-code';

const CLAUDE_AGENT_SDK_PROVIDER_NAME = 'claude-agent-sdk';

interface Usage {
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
}

interface ClaudeCodeMetadata {
  costUsd?: number;
  rawUsage?: Usage;
  lastMessageRawUsage?: Usage;
  sessionId?: string;
}

interface ClaudeCodeProviderMetadata {
  'claude-code': ClaudeCodeMetadata;
}

const normalizeAiSdkToolSet = (toolSet: Record<string, unknown>): Record<string, unknown> => {
  const normalizedToolSet: Record<string, unknown> = {};

  for (const [toolName, toolDefinition] of Object.entries(toolSet)) {
    let normalizedTool = { ...(toolDefinition as Record<string, unknown>) };

    const inputSchema = (toolDefinition as Record<string, unknown>).inputSchema;
    if (inputSchema && typeof inputSchema === 'object' && 'jsonSchema' in (inputSchema as object)) {
      const jsonSchemaObj = (inputSchema as { jsonSchema: unknown | (() => unknown) }).jsonSchema;
      const schema = typeof jsonSchemaObj === 'function' ? jsonSchemaObj() : jsonSchemaObj;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const zodShape = JSONSchemaToZod.convert(schema as JSONSchema) as any;
      normalizedTool = {
        ...toolDefinition,
        inputSchema: zodShape,
      };
    }

    // Optimize aider run_prompt tool
    if (toolName === 'aider---run_prompt') {
      const originalExecute = (normalizedTool as Record<string, unknown>).execute;
      if (!originalExecute) {
        normalizedToolSet[toolName] = normalizedTool;
        continue;
      }
      normalizedToolSet[toolName] = {
        ...normalizedTool,
        execute: async (args: unknown, options: unknown) => {
          const result = await (originalExecute as (args: unknown, options: unknown) => Promise<unknown>)(args, options);
          if (result && typeof result === 'object') {
            delete (result as Record<string, unknown>).responses;
          }
          return result;
        },
      };
    }
    // Optimize subagents run_task tool
    else if (toolName === 'subagents---run_task') {
      const originalExecute = (normalizedTool as Record<string, unknown>).execute;
      if (!originalExecute) {
        normalizedToolSet[toolName] = normalizedTool;
        continue;
      }
      normalizedToolSet[toolName] = {
        ...normalizedTool,
        execute: async (args: unknown, options: unknown) => {
          const result = await (originalExecute as (args: unknown, options: unknown) => Promise<unknown>)(args, options);
          if (result && typeof result === 'object') {
            try {
              const messages = (result as Record<string, unknown>).messages;
              if (Array.isArray(messages) && messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                return {
                  messages: [lastMessage],
                  promptContext: (result as Record<string, unknown>).promptContext,
                };
              }
            } catch {
              // If optimization fails, return the original result
            }
          }
          return result;
        },
      };
    } else {
      normalizedToolSet[toolName] = normalizedTool;
    }
  }

  return normalizedToolSet;
};

export default class ClaudeAgentSdkExtension implements Extension {
  static metadata = {
    name: 'Claude Agent SDK',
    version: '2.0.0',
    description: 'Integrates the Claude Agent SDK as a provider using Claude Code CLI',
    author: 'wladimiiir',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/claude-agent-sdk/icon.png',
    capabilities: ['providers'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Claude Agent SDK extension loaded', 'info');
  }

  getProviders(_context: ExtensionContext): ProviderDefinition[] {
    return [
      {
        id: CLAUDE_AGENT_SDK_PROVIDER_NAME,
        name: 'Claude Agent SDK',
        provider: { name: CLAUDE_AGENT_SDK_PROVIDER_NAME },
        strategy: {
          createLlm: (
            _profile: ProviderProfile,
            model: Model,
            _settings: SettingsData,
            _projectDir: string,
            toolSet?: unknown,
            systemPrompt?: string,
            providerMetadata?: unknown,
          ): unknown => {
            const settings: ClaudeCodeSettings = {
              env: {
                MAX_MCP_OUTPUT_TOKENS: '9999999',
              },
              thinking: {
                type: 'adaptive',
                display: 'summarized',
              },
              disallowedTools: [
                'AskUserQuestion',
                'Bash',
                'TaskOutput',
                'Edit',
                'EnterPlanMode',
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
                'ToolSearch',
                'WebFetch',
                'WebSearch',
                'Write',
                'LSP',
                'CronCreate',
                'CronDelete',
                'CronList',
                'Monitor',
                'ScheduleWakeup',
                'EnterWorktree',
                'ExitWorktree',
                'PushNotification',
                'DesignSync',
                'RemoteTrigger',
                'SendMessage',
                'Workflow',
                'ReportFindings',
              ],
            };

            if (providerMetadata && typeof providerMetadata === 'object' && 'claude-code' in providerMetadata) {
              const metadata = (providerMetadata as ClaudeCodeProviderMetadata)['claude-code'] || {} satisfies ClaudeCodeMetadata;
              settings.resume = metadata.sessionId;
            }

            if (toolSet && typeof toolSet === 'object' && Object.keys(toolSet).length > 0) {
              settings.mcpServers = {
                'ai-sdk': createAiSdkMcpServer('ai-sdk', normalizeAiSdkToolSet(toolSet as Record<string, unknown>)),
              };
              settings.allowedTools = ['mcp__ai-sdk'];
            } else {
              settings.allowedTools = [];
            }

            if (systemPrompt) {
              settings.systemPrompt = systemPrompt;
            }

            return claudeCode(model.id, settings);
          },

          loadModels: async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
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
                {
                  id: 'fable',
                  providerId: profile.id,
                  maxInputTokens: 1000000,
                  maxOutputTokensLimit: 64000,
                }
              ];

              return { models, success: true };
            } catch (error) {
              const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Claude Agent SDK models';
              return { models: [], success: false, error: errorMsg };
            }
          },

          getAiderMapping: (_provider: ProviderProfile, modelId: string): AiderModelMapping => {
            return {
              environmentVariables: {},
              modelName: `claude-agent-sdk/${modelId}`,
            };
          },

          getUsageReport: (
            task: unknown,
            provider: ProviderProfile,
            model: Model,
            _usage: unknown,
            providerMetadata?: unknown,
          ): UsageReportData => {
            const data = (providerMetadata as ClaudeCodeProviderMetadata)?.['claude-code'] || {} satisfies ClaudeCodeMetadata;
            const usage = data.lastMessageRawUsage || data.rawUsage || {} satisfies Usage;

            const sentTokens = usage.input_tokens || 0;
            const receivedTokens = usage.output_tokens || 0;
            const cacheWriteTokens = usage.cache_creation_input_tokens || 0;
            const cacheReadTokens = usage.cache_read_input_tokens || 0;

            const messageCost = calculateCost(model, sentTokens, receivedTokens, cacheReadTokens);

            const taskData = (task as { task?: { agentTotalCost?: number } }).task;

            return {
              model: `${provider.id}/${model.id}`,
              sentTokens: sentTokens + cacheReadTokens,
              receivedTokens: receivedTokens + cacheWriteTokens,
              messageCost,
              agentTotalCost: (taskData?.agentTotalCost ?? 0) + messageCost,
            };
          },

          getProviderParameters: () => {
            return {
              system: undefined,
            };
          },
        },
      },
    ];
  }
}

const calculateCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

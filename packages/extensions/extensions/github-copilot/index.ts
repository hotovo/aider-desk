import fs from 'fs';
import path from 'path';

import { execFileSync } from 'child_process';

import { CopilotClient, RuntimeConnection, defineTool, ToolSet, type ModelInfo } from '@github/copilot-sdk';

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

const PROVIDER_NAME = 'github-copilot';

const findSystemCopilot = (): string | null => {
  const lookupCommand = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(lookupCommand, ['copilot'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf-8',
    });
    const resolved = output.trim().split('\n')[0].trim();
    return resolved || null;
  } catch {
    return null;
  }
};

const getCopilotCliPath = (): string => {
  const systemCopilotPath = findSystemCopilot();
  if (systemCopilotPath && fs.existsSync(systemCopilotPath)) {
    return systemCopilotPath;
  }

  const platform = process.platform;
  const arch = process.arch;

  let pkgPlatform: string;
  if (platform === 'linux') {
    let isMusl = false;
    try {
      const { isNonGlibcLinuxSync } = require('detect-libc');
      isMusl = isNonGlibcLinuxSync();
    } catch {
      // detect-libc not available, assume glibc
    }
    pkgPlatform = isMusl ? 'linuxmusl' : 'linux';
  } else {
    pkgPlatform = platform;
  }

  const packageName = `copilot-${pkgPlatform}-${arch}`;
  const binaryPath = path.join(__dirname, 'node_modules', '@github', packageName, 'copilot');

  if (fs.existsSync(binaryPath)) {
    return binaryPath;
  }

  // Fallback: let the SDK resolve the bundled JS entry point
  return '';
};

const copilotConnection = RuntimeConnection.forStdio(
  getCopilotCliPath() ? { path: getCopilotCliPath() } : {},
);

type LogFn = (message: string, type?: 'info' | 'error' | 'warn' | 'debug') => void;

type CopilotTool = ReturnType<typeof defineTool>;

const normalizeToolSet = (
  toolSet: Record<string, unknown> | undefined,
  log: LogFn,
): CopilotTool[] => {
  if (!toolSet || typeof toolSet !== 'object' || Object.keys(toolSet).length === 0) {
    log('No tools provided to normalizeToolSet', 'debug');
    return [];
  }

  const tools: CopilotTool[] = [];

  for (const [toolName, toolDefinition] of Object.entries(toolSet)) {
    const tool = toolDefinition as Record<string, unknown>;
    if (!tool || typeof tool !== 'object') continue;

    const execute = tool.execute as ((args: unknown, options: { toolCallId: string }) => Promise<unknown>) | undefined;
    if (!execute) {
      log(`Tool "${toolName}" has no execute function, skipping`, 'warn');
      continue;
    }

    const description = (tool.description as string) ?? toolName;

    const inputSchema = tool.inputSchema;
    let parameters: Record<string, unknown> | undefined;
    if (inputSchema && typeof inputSchema === 'object') {
      if ('jsonSchema' in inputSchema) {
        const jsonSchemaObj = (inputSchema as { jsonSchema: unknown | (() => unknown) }).jsonSchema;
        parameters =
          typeof jsonSchemaObj === 'function' ? (jsonSchemaObj() as Record<string, unknown>) : (jsonSchemaObj as Record<string, unknown>);
      } else {
        parameters = inputSchema as Record<string, unknown>;
      }
    }

    log(`Registering tool "${toolName}" (has params: ${!!parameters})`, 'info');

    // Declaration-only tool: the CLI presents the tool to the model, but does NOT
    // execute it. AiderDesk's AI SDK handles tool execution and iteration control.
    const copilotTool = defineTool(toolName, {
      description,
      ...(parameters ? { parameters } : {}),
    });

    tools.push(copilotTool);
  }

  log(`Normalized ${tools.length} tools from ${Object.keys(toolSet).length} entries`, 'info');
  return tools;
};

type ModelInfoRuntime = ModelInfo & {
  capabilities?: {
    limits?: {
      max_output_tokens?: number;
    };
    supports?: {
      tool_calls?: boolean;
    };
  };
};

const mapModelInfo = (info: ModelInfoRuntime, providerId: string): Model | null => {
  if (info.policy?.state === 'disabled') return null;

  return {
    id: info.id,
    providerId,
    maxInputTokens: info.capabilities?.limits?.max_prompt_tokens ?? info.capabilities?.limits?.max_context_window_tokens,
    maxOutputTokensLimit: info.capabilities?.limits?.max_output_tokens,
    supportsTools: info.capabilities?.supports?.tool_calls ?? false,
    isHidden: false,
  };
};

const fetchModels = async (providerId: string): Promise<Model[]> => {
  const client = new CopilotClient({ useLoggedInUser: true, connection: copilotConnection });
  await client.start();
  try {
    const modelInfos = await client.listModels();
    return modelInfos
      .map((info) => mapModelInfo(info, providerId))
      .filter((m): m is Model => m !== null);
  } finally {
    await client.stop().catch(() => {});
  }
};

type V2Message = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: unknown;
};

const convertPromptToText = (prompt: V2Message[]): string => {
  const parts: string[] = [];

  for (const message of prompt) {
    switch (message.role) {
      case 'system': {
        const content = message.content;
        if (typeof content === 'string' && content.trim()) {
          parts.push(`System: ${content}`);
        }
        break;
      }
      case 'user': {
        const content = message.content;
        if (typeof content === 'string') {
          parts.push(`User: ${content}`);
        } else if (Array.isArray(content)) {
          const texts = content
            .filter((p: Record<string, unknown>) => p.type === 'text')
            .map((p: Record<string, unknown>) => p.text as string);
          if (texts.length > 0) parts.push(`User: ${texts.join('\n')}`);
        }
        break;
      }
      case 'assistant': {
        const content = message.content;
        if (typeof content === 'string') {
          parts.push(`Assistant: ${content}`);
        } else if (Array.isArray(content)) {
          const texts: string[] = [];
          for (const part of content as Record<string, unknown>[]) {
            if (part.type === 'text') texts.push(part.text as string);
            else if (part.type === 'tool-call') texts.push(`[Tool call: ${part.toolName}]`);
          }
          if (texts.length > 0) parts.push(`Assistant: ${texts.join('\n')}`);
        }
        break;
      }
      case 'tool': {
        const content = message.content;
        if (Array.isArray(content)) {
          for (const part of content as Record<string, unknown>[]) {
            if (part.type === 'tool-result') {
              const output = part.output as Record<string, unknown> | undefined;
              let resultStr = '';
              if (output) {
                if (output.type === 'text' || output.type === 'error-text') {
                  resultStr = String(output.value ?? '');
                } else if (output.type === 'json' || output.type === 'error-json') {
                  resultStr = JSON.stringify(output.value);
                } else {
                  resultStr = JSON.stringify(output);
                }
              }
              parts.push(`Tool result (${part.toolName}): ${resultStr}`);
            }
          }
        }
        break;
      }
    }
  }

  return parts.join('\n\n');
};

const extractSystemMessage = (prompt: V2Message[]): string | undefined => {
  for (const message of prompt) {
    if (message.role === 'system' && typeof message.content === 'string') {
      return message.content.trim() || undefined;
    }
  }
  return undefined;
};

type SessionEventData = Record<string, unknown>;

type ToolRequest = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
};

const handleSessionEvent = (
  event: { type: string; data?: SessionEventData },
  log: LogFn,
  callbacks: {
    onTextDelta: (delta: string) => void;
    onReasoningDelta: (delta: string) => void;
    onAssistantMessage: (content: string | undefined, toolRequests: ToolRequest[]) => void;
    onUsage: (usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number; reasoningTokens?: number; cost?: number; model?: string }) => void;
    onFinish: () => void;
    onError: (message: string) => void;
  },
): void => {
  switch (event.type) {
    case 'assistant.message_delta': {
      const delta = event.data?.deltaContent as string | undefined;
      if (delta) callbacks.onTextDelta(delta);
      break;
    }
    case 'assistant.reasoning_delta': {
      const delta = event.data?.deltaContent as string | undefined;
      if (delta) callbacks.onReasoningDelta(delta);
      break;
    }
    case 'assistant.message': {
      const content = event.data?.content as string | undefined;
      const rawRequests = event.data?.toolRequests as Array<Record<string, unknown>> | undefined;
      const toolRequests: ToolRequest[] = [];
      if (rawRequests?.length) {
        for (const tr of rawRequests) {
          toolRequests.push({
            toolCallId: (tr.toolCallId as string) ?? '',
            toolName: (tr.name as string) ?? '',
            args: (tr.arguments as Record<string, unknown>) ?? {},
          });
        }
      }
      log(`Assistant message: contentLen=${content?.length ?? 0}, toolRequests=${toolRequests.length} [${toolRequests.map((t) => t.toolName).join(', ')}]`, 'info');
      callbacks.onAssistantMessage(content, toolRequests);
      break;
    }
    case 'assistant.usage': {
      const data = event.data ?? {};
      log(
        `Usage: input=${data.inputTokens}, output=${data.outputTokens}, cacheRead=${data.cacheReadTokens}, cacheWrite=${data.cacheWriteTokens}, reasoning=${data.reasoningTokens}, cost=${data.cost}, model=${data.model}`,
        'debug',
      );
      callbacks.onUsage({
        inputTokens: data.inputTokens as number | undefined,
        outputTokens: data.outputTokens as number | undefined,
        cacheReadTokens: data.cacheReadTokens as number | undefined,
        cacheWriteTokens: data.cacheWriteTokens as number | undefined,
        reasoningTokens: data.reasoningTokens as number | undefined,
        cost: data.cost as number | undefined,
        model: data.model as string | undefined,
      });
      break;
    }
    case 'session.idle': {
      log('Session idle — finishing', 'info');
      callbacks.onFinish();
      break;
    }
    case 'session.error': {
      const errMsg = (event.data?.message as string) ?? 'Session error';
      log(`Session error: ${errMsg}`, 'error');
      callbacks.onError(errMsg);
      break;
    }
    default: {
      log(`Unhandled session event: ${event.type}`, 'debug');
      break;
    }
  }
};

const buildSessionConfig = (
  modelId: string,
  streaming: boolean,
  tools: CopilotTool[],
  systemMessage?: string,
): Record<string, unknown> => {
  const config: Record<string, unknown> = {
    model: modelId,
    streaming,
  };

  if (tools.length > 0) {
    config.tools = tools;
    config.availableTools = new ToolSet().addCustom('*');
  }

  if (systemMessage) {
    config.systemMessage = { mode: 'append', content: systemMessage };
  }

  return config;
};

const createLlm = (
  modelId: string,
  options: {
    systemPrompt?: string;
    toolSet?: unknown;
    projectDir?: string;
  },
  log: LogFn,
): unknown => {
  const tools = normalizeToolSet(options.toolSet as Record<string, unknown> | undefined, log);

  let client: CopilotClient | null = null;

  const getClient = (): CopilotClient => {
    if (!client) {
      client = new CopilotClient({
        useLoggedInUser: true,
        connection: copilotConnection,
        ...(options.projectDir ? { workingDirectory: options.projectDir } : {}),
      });
    }
    return client;
  };

  return {
    specificationVersion: 'v3' as const,
    provider: PROVIDER_NAME,
    modelId,
    supportedUrls: { '*/*': [] },

    async doGenerate(callOptions: {
      prompt: V2Message[];
      abortSignal?: AbortSignal;
    }): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      finishReason: { unified: string; raw: unknown };
      usage: {
        inputTokens: { total: number | undefined; noCache: number | undefined; cacheRead: number | undefined; cacheWrite: number | undefined };
        outputTokens: { total: number | undefined; text: number | undefined; reasoning: number | undefined };
        raw?: unknown;
      };
      warnings: Array<{ type: string; setting: string; message: string }>;
    }> {
      const promptText = convertPromptToText(callOptions.prompt);
      const systemMessage = extractSystemMessage(callOptions.prompt) ?? options.systemPrompt;

      log(`doGenerate: model=${modelId}, tools=${tools.length}, systemMessage=${!!systemMessage}, promptLength=${promptText.length}`, 'info');

      const c = getClient();
      await c.start();

      const sessionConfig = buildSessionConfig(modelId, false, tools, systemMessage);
      log(`doGenerate: session config: ${JSON.stringify({ ...sessionConfig, tools: `[${tools.length} tools]` })}`, 'debug');

      const session = await c.createSession(
        sessionConfig as Parameters<typeof c.createSession>[0],
      );

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;

      session.on((event) => {
        if (event.type === 'assistant.usage') {
          inputTokens = event.data.inputTokens;
          outputTokens = event.data.outputTokens;
        }
      });

      callOptions.abortSignal?.addEventListener(
        'abort',
        () => {
          session.abort();
          void session.disconnect().catch(() => {});
        },
        { once: true },
      );

      try {
        const result = await session.sendAndWait(
          { prompt: promptText },
          callOptions.abortSignal?.aborted ? 0 : 120_000,
        );

        const responseText = (result as { data?: { content?: string } })?.data?.content ?? '';

        return {
          content: [{ type: 'text', text: responseText }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: {
              total: inputTokens,
              noCache: inputTokens,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: outputTokens,
              text: outputTokens,
              reasoning: undefined,
            },
          },
          warnings: [],
        };
      } finally {
        await session.disconnect().catch(() => {});
      }
    },

    async doStream(callOptions: {
      prompt: V2Message[];
      abortSignal?: AbortSignal;
    }): Promise<{
      stream: ReadableStream<Record<string, unknown>>;
      warnings: Array<{ type: string; setting: string; message: string }>;
    }> {
      const promptText = convertPromptToText(callOptions.prompt);
      const systemMessage = extractSystemMessage(callOptions.prompt) ?? options.systemPrompt;

      log(`doStream: model=${modelId}, tools=${tools.length}, systemMessage=${!!systemMessage}, promptLength=${promptText.length}`, 'info');

      const c = getClient();
      await c.start();

      const sessionConfig = buildSessionConfig(modelId, true, tools, systemMessage);
      log(`doStream: session config: ${JSON.stringify({ ...sessionConfig, tools: `[${tools.length} tools]` })}`, 'debug');

      const session = await c.createSession(
        sessionConfig as Parameters<typeof c.createSession>[0],
      );

      const stream = new ReadableStream<Record<string, unknown>>({
        start(controller) {
          let textPartId: string | undefined;
          let finished = false;
          let cachedUsage: {
            inputTokens?: number;
            outputTokens?: number;
            cacheReadTokens?: number;
            cacheWriteTokens?: number;
            reasoningTokens?: number;
            cost?: number;
            model?: string;
            apiEndpoint?: string;
          } = {};

          const ensureClose = () => {
            if (!finished) {
              finished = true;
              try {
                controller.close();
              } catch {
                // already closed
              }
              void session.disconnect().catch(() => {});
            }
          };

          controller.enqueue({ type: 'stream-start', warnings: [] });

          if (callOptions.abortSignal?.aborted) {
            controller.enqueue({ type: 'error', error: new Error('Aborted') });
            ensureClose();
            return;
          }

          callOptions.abortSignal?.addEventListener(
            'abort',
            () => {
              session.abort();
              controller.enqueue({ type: 'error', error: new Error('Aborted') });
              ensureClose();
            },
            { once: true },
          );

          let reasoningPartId: string | undefined;

          const closeTextPart = () => {
            if (textPartId) {
              controller.enqueue({ type: 'text-end', id: textPartId });
              textPartId = undefined;
            }
          };

          const closeReasoningPart = () => {
            if (reasoningPartId) {
              controller.enqueue({ type: 'reasoning-end', id: reasoningPartId });
              reasoningPartId = undefined;
            }
          };

          session.on((event) => {
            handleSessionEvent(event as unknown as { type: string; data?: SessionEventData }, log, {
              onTextDelta: (delta) => {
                if (finished) return;
                closeReasoningPart();
                if (!textPartId) {
                  textPartId = `text-${Date.now()}`;
                  controller.enqueue({ type: 'text-start', id: textPartId });
                }
                controller.enqueue({ type: 'text-delta', id: textPartId, delta });
              },
              onReasoningDelta: (delta) => {
                if (finished) return;
                closeTextPart();
                if (!reasoningPartId) {
                  reasoningPartId = `reasoning-${Date.now()}`;
                  controller.enqueue({ type: 'reasoning-start', id: reasoningPartId });
                }
                controller.enqueue({ type: 'reasoning-delta', id: reasoningPartId, delta });
              },
              onAssistantMessage: (content, toolRequests) => {
                if (finished) return;

                // If no tool requests, just handle any late-arriving non-streamed text
                if (toolRequests.length === 0) {
                  if (content && !textPartId) {
                    textPartId = `text-${Date.now()}`;
                    controller.enqueue({ type: 'text-start', id: textPartId });
                    controller.enqueue({ type: 'text-delta', id: textPartId, delta: content });
                    controller.enqueue({ type: 'text-end', id: textPartId });
                    textPartId = undefined;
                  }
                  return;
                }

                // Model requested tool calls — close any open text and emit tool calls,
                // then end the stream with finishReason 'tool-calls'. The AI SDK will
                // handle tool execution and call doStream() again for the next turn.
                closeTextPart();
                closeReasoningPart();

                for (const tr of toolRequests) {
                  const argsJson = JSON.stringify(tr.args);
                  log(`Stream: tool-call ${tr.toolName} (id=${tr.toolCallId}, args=${argsJson})`, 'info');
                  controller.enqueue({
                    type: 'tool-input-start',
                    id: tr.toolCallId,
                    toolName: tr.toolName,
                  });
                  controller.enqueue({ type: 'tool-input-end', id: tr.toolCallId });
                  controller.enqueue({
                    type: 'tool-call',
                    toolCallId: tr.toolCallId,
                    toolName: tr.toolName,
                    input: argsJson,
                  });
                }

                log(`Stream: finishing with reason=tool-calls (${toolRequests.length} tool calls)`, 'debug');
                controller.enqueue({
                  type: 'finish',
                  finishReason: { unified: 'tool-calls', raw: undefined },
                  usage: {
                    inputTokens: {
                      total: cachedUsage.inputTokens,
                      noCache: undefined,
                      cacheRead: cachedUsage.cacheReadTokens,
                      cacheWrite: cachedUsage.cacheWriteTokens,
                    },
                    outputTokens: {
                      total: cachedUsage.outputTokens,
                      text: undefined,
                      reasoning: cachedUsage.reasoningTokens,
                    },
                  },
                  providerMetadata: {
                    [PROVIDER_NAME]: {
                      usage: cachedUsage,
                    },
                  },
                });
                ensureClose();
              },
              onUsage: (u) => {
                cachedUsage = { ...cachedUsage, ...u };
              },
              onFinish: () => {
                if (finished) return;
                closeTextPart();
                closeReasoningPart();
                controller.enqueue({
                  type: 'finish',
                  finishReason: { unified: 'stop', raw: undefined },
                  usage: {
                    inputTokens: {
                      total: cachedUsage.inputTokens,
                      noCache: undefined,
                      cacheRead: cachedUsage.cacheReadTokens,
                      cacheWrite: cachedUsage.cacheWriteTokens,
                    },
                    outputTokens: {
                      total: cachedUsage.outputTokens,
                      text: undefined,
                      reasoning: cachedUsage.reasoningTokens,
                    },
                  },
                  providerMetadata: {
                    [PROVIDER_NAME]: {
                      usage: cachedUsage,
                    },
                  },
                });
                ensureClose();
              },
              onError: (message) => {
                if (finished) return;
                controller.enqueue({ type: 'error', error: new Error(message) });
                ensureClose();
              },
            });
          });

          session.send({ prompt: promptText }).catch((error: unknown) => {
            if (!finished) {
              controller.enqueue({ type: 'error', error });
              ensureClose();
            }
          });
        },

        cancel() {
          session.abort();
        },
      });

      return { stream, warnings: [] };
    },
  };
};

export default class GithubCopilotExtension implements Extension {
  static metadata = {
    name: 'GitHub Copilot',
    version: '2.0.0',
    description: 'Integrates GitHub Copilot as an LLM provider using the official Copilot CLI via the Copilot SDK',
    author: 'wladimiiir',
    iconUrl:
      'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/github-copilot/icon.png',
    capabilities: ['providers'],
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('GitHub Copilot extension loaded', 'info');
  }

  getProviders(context: ExtensionContext): ProviderDefinition[] {
    const log: LogFn = (message, type) => context.log(message, type);

    return [
      {
        id: PROVIDER_NAME,
        name: 'GitHub Copilot',
        provider: { name: PROVIDER_NAME },
        strategy: {
          createLlm: (
            _profile: ProviderProfile,
            model: Model,
            _settings: SettingsData,
            projectDir: string,
            toolSet?: unknown,
            systemPrompt?: string,
          ): unknown => {
            return createLlm(model.id, { systemPrompt, toolSet, projectDir }, log);
          },

          loadModels: async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
            try {
              log(`Loading models for provider ${profile.id}...`, 'info');
              const models = await fetchModels(profile.id);
              log(`Loaded ${models.length} models from GitHub Copilot`, 'info');
              return { models, success: true };
            } catch (error) {
              const errorMsg =
                typeof error === 'string'
                  ? error
                  : error instanceof Error
                    ? error.message
                    : 'Unknown error loading GitHub Copilot models';
              log(`Failed to load models: ${errorMsg}`, 'error');
              return { models: [], success: false, error: errorMsg };
            }
          },

          getAiderMapping: (_provider: ProviderProfile, modelId: string): AiderModelMapping => {
            return {
              modelName: `github-copilot/${modelId}`,
              environmentVariables: {},
            };
          },

          getUsageReport: (
            _task: unknown,
            provider: ProviderProfile,
            model: Model,
            usage?: unknown,
            providerMetadata?: unknown,
          ): UsageReportData => {
            type CopilotUsage = {
              inputTokens?: number;
              outputTokens?: number;
              cacheReadTokens?: number;
              cacheWriteTokens?: number;
              reasoningTokens?: number;
              cost?: number;
              model?: string;
              apiEndpoint?: string;
            };

            const v3Usage = usage as {
              inputTokens?: number;
              outputTokens?: number;
              inputTokenDetails?: { cacheReadTokens?: number };
              outputTokenDetails?: { reasoningTokens?: number };
            } | undefined;
            const copilotMeta = (providerMetadata as Record<string, unknown> | undefined)?.[PROVIDER_NAME] as { usage?: CopilotUsage } | undefined;
            const copilotUsage = copilotMeta?.usage;

            const inputTokens = copilotUsage?.inputTokens ?? v3Usage?.inputTokens ?? 0;
            const outputTokens = copilotUsage?.outputTokens ?? v3Usage?.outputTokens ?? 0;
            const cacheReadTokens = copilotUsage?.cacheReadTokens ?? v3Usage?.inputTokenDetails?.cacheReadTokens ?? 0;
            const cacheWriteTokens = copilotUsage?.cacheWriteTokens ?? 0;
            const reasoningTokens = copilotUsage?.reasoningTokens ?? v3Usage?.outputTokenDetails?.reasoningTokens ?? 0;
            const cost = copilotUsage?.cost ?? 0;

            return {
              model: `${provider.id}/${model.id}`,
              sentTokens: inputTokens - cacheReadTokens,
              receivedTokens: outputTokens + reasoningTokens,
              messageCost: cost,
              cacheWriteTokens,
              cacheReadTokens,
              agentTotalCost: cost,
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

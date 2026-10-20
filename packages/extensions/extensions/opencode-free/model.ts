import { NATIVE_TOOLS, nativeInput, PROVIDER_ID } from './catalog';
import { asToolResult, nativeResultText, nativeShellResult, normalizeProviderResult } from './result';

import type { ProviderToolApprovalHandler } from '@aiderdesk/extensions';
import type { ToolSet } from 'ai';
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4Content,
  LanguageModelV4GenerateResult,
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
  LanguageModelV4ToolCall,
} from '@ai-sdk/provider';
import type { ToolBridge } from './bridge';

type Approval = Extract<LanguageModelV4StreamPart, { type: 'tool-approval-request' }>;
type Finish = Extract<LanguageModelV4StreamPart, { type: 'finish' }>;

export class OpenCodeFreeModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4';
  readonly provider = PROVIDER_ID;
  readonly supportedUrls = {};

  constructor(
    readonly modelId: string,
    private model: LanguageModelV4,
    private tools: ToolSet,
    private bridge: ToolBridge | undefined,
    private dispose: () => Promise<void>,
    private approveTool?: ProviderToolApprovalHandler,
    private onFinish?: (metadata: Finish['providerMetadata']) => Promise<void>,
  ) {}

  async doStream(options: LanguageModelV4CallOptions) {
    const cancellation = new AbortController();
    const signal = options.abortSignal ? AbortSignal.any([options.abortSignal, cancellation.signal]) : cancellation.signal;
    if (this.bridge) {
      this.bridge.signal = signal;
    }
    return {
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start: (controller) => {
          void this.run(
            {
              ...options,
              abortSignal: signal,
              tools: undefined,
              toolChoice: undefined,
            },
            (part) => controller.enqueue(part),
          )
            .then(async () => {
              await this.dispose();
              controller.close();
            })
            .catch(async (error: unknown) => {
              await this.dispose();
              if (!cancellation.signal.aborted) {
                controller.error(error);
              }
            });
        },
        cancel: async () => {
          cancellation.abort();
          await this.dispose();
        },
      }),
    };
  }

  private async run(options: LanguageModelV4CallOptions, emit: (part: LanguageModelV4StreamPart) => void): Promise<void> {
    const calls = new Map<string, LanguageModelV4ToolCall>();
    const completed = new Set<string>();
    const approvals = new Set<string>();
    let prompt = options.prompt;
    for (let round = 0; round < 100; round++) {
      options.abortSignal?.throwIfAborted();
      const pending: Approval[] = [];
      let finish: Finish | undefined;
      const response = await this.model.doStream({ ...options, prompt });
      for await (const part of response.stream) {
        options.abortSignal?.throwIfAborted();
        if (part.type === 'tool-call') {
          if (!calls.has(part.toolCallId)) {
            calls.set(part.toolCallId, part);
            const input = JSON.parse(part.input) as Record<string, unknown>;
            emit({
              ...part,
              toolName: this.toolName(part.toolName),
              input: JSON.stringify(NATIVE_TOOLS.has(part.toolName) ? nativeInput(part.toolName, input) : input),
              providerExecuted: true,
              dynamic: true,
            });
          }
        } else if (part.type === 'tool-result') {
          if (!completed.has(part.toolCallId)) {
            completed.add(part.toolCallId);
            const original = this.bridge?.getOutput(part.toolCallId);
            const result = original
              ? original.value
              : part.toolName === 'read'
                ? nativeResultText(part.result)
                : part.toolName === 'shell'
                  ? nativeShellResult(part.result, part.isError)
                  : normalizeProviderResult(part.result);
            emit({
              ...part,
              toolName: this.toolName(part.toolName),
              result: asToolResult(result),
              dynamic: true,
            });
          }
        } else if (part.type === 'tool-approval-request') {
          pending.push(part);
        } else if (part.type === 'finish') {
          finish = part;
        } else if (part.type === 'error') {
          throw part.error;
        } else if (part.type === 'stream-start') {
          if (round === 0) {
            emit(part);
          }
        } else if (!part.type.startsWith('tool-input-')) {
          if ('id' in part && typeof part.id === 'string') {
            emit({ ...part, id: `${round}:${part.id}` });
          } else {
            emit(part);
          }
        }
      }
      if (!finish) {
        throw new Error('OpenCode ended without a finish event');
      }
      if (finish.finishReason.unified === 'error') {
        throw new Error('OpenCode execution failed. No prompt retry was attempted to avoid duplicate tool execution.');
      }
      if (!pending.length) {
        await this.onFinish?.(finish.providerMetadata);
        emit(finish);
        return;
      }
      const responses: Extract<LanguageModelV4Prompt[number], { role: 'tool' }>['content'] = [];
      const history: Extract<LanguageModelV4Prompt[number], { role: 'assistant' }>['content'] = [];
      for (const approval of pending) {
        if (approvals.has(approval.approvalId)) {
          throw new Error('OpenCode repeated a handled approval');
        }
        approvals.add(approval.approvalId);
        const call = calls.get(approval.toolCallId);
        if (!call) {
          throw new Error('OpenCode requested approval without a tool call');
        }
        const input = JSON.parse(call.input) as Record<string, unknown>;
        const original = this.bridge?.names.get(call.toolName);
        let approved = false;
        let reason = 'This native tool is unavailable. Use the enabled AiderDesk MCP tools instead; do not retry this tool.';
        if (original) {
          this.bridge!.allowCall(call.toolName, call.toolCallId, input);
          approved = true;
        } else if (NATIVE_TOOLS.has(call.toolName) && this.tools[this.toolName(call.toolName)]?.execute) {
          const decision = await this.approveNative(call.toolName, input, options.abortSignal);
          approved = decision[0];
          reason = decision[1] ?? 'Native tool execution denied by AiderDesk. Do not retry or use another tool to perform the rejected operation.';
        }
        options.abortSignal?.throwIfAborted();
        history.push({
          type: 'tool-call',
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input,
        });
        responses.push({
          type: 'tool-approval-response',
          approvalId: approval.approvalId,
          approved,
          ...(approved ? {} : { reason }),
        });
      }
      prompt = [...prompt, { role: 'assistant', content: history }, { role: 'tool', content: responses }];
    }
    throw new Error('OpenCode exceeded the approval continuation limit');
  }

  private toolName(name: string): string {
    return NATIVE_TOOLS.get(name) ?? this.bridge?.names.get(name) ?? `opencode---${name}`;
  }

  private async approveNative(name: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<[boolean, string?]> {
    signal?.throwIfAborted();
    if (!this.approveTool) {
      return [false, 'This AiderDesk version does not supply native tool approval policies. Update AiderDesk to use native tools.'];
    }
    const decision = this.approveTool(
      this.toolName(name),
      nativeInput(name, input),
      `Allow OpenCode native ${name}?\n${JSON.stringify(input, null, 2)}`,
      'OpenCode Free native tool approval',
    );
    if (!signal) {
      return decision;
    }
    return new Promise<[boolean, string?]>((resolve, reject) => {
      const abort = () => reject(signal.reason ?? new Error('OpenCode run cancelled'));
      signal.addEventListener('abort', abort, { once: true });
      void decision.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      if (signal.aborted) {
        abort();
      }
    });
  }

  async doGenerate(options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    const { stream } = await this.doStream(options);
    const content: LanguageModelV4Content[] = [];
    const text = new Map<string, Extract<LanguageModelV4Content, { type: 'text' | 'reasoning' }>>();
    let finish: Finish | undefined;
    let warnings: LanguageModelV4GenerateResult['warnings'] = [];
    for await (const part of stream) {
      if (part.type === 'stream-start') {
        warnings = part.warnings;
      } else if (part.type === 'text-start' || part.type === 'reasoning-start') {
        const value: Extract<LanguageModelV4Content, { type: 'text' | 'reasoning' }> = {
          type: part.type === 'text-start' ? 'text' : 'reasoning',
          text: '',
        };
        text.set(part.id, value);
        content.push(value);
      } else if (part.type === 'text-delta' || part.type === 'reasoning-delta') {
        const value = text.get(part.id);
        if (value) {
          value.text += part.delta;
        }
      } else if (part.type === 'tool-call' || part.type === 'tool-result') {
        content.push(part);
      } else if (part.type === 'finish') {
        finish = part;
      }
    }
    if (!finish) {
      throw new Error('OpenCode ended without a result');
    }
    return {
      content,
      finishReason: finish.finishReason,
      usage: finish.usage,
      providerMetadata: finish.providerMetadata,
      warnings,
    };
  }
}

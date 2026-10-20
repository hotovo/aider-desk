import { setTimeout as delay } from 'node:timers/promises';

import { describe, expect, it } from 'vitest';
import { streamText } from 'ai';

import { AssistantMessageState, StepResultQueue } from '../assistant-message-state';

import type { LanguageModelV4, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { StepResult, ToolSet } from 'ai';

describe('reasoning, native tools, and final text in one provider step', () => {
  it('keeps streamed IDs aligned and finalizes only after queued deltas are consumed', async () => {
    const parts: LanguageModelV4StreamPart[] = [
      { type: 'stream-start', warnings: [] },
      { type: 'reasoning-start', id: 'reasoning' },
      { type: 'reasoning-delta', id: 'reasoning', delta: 'Thinking before the tool' },
      { type: 'reasoning-end', id: 'reasoning' },
      { type: 'tool-call', toolCallId: 'call', toolName: 'native_read', input: '{}', providerExecuted: true, dynamic: true },
      { type: 'tool-result', toolCallId: 'call', toolName: 'native_read', result: 'file contents', dynamic: true },
      { type: 'text-start', id: 'text' },
      { type: 'text-delta', id: 'text', delta: 'The final answer' },
      { type: 'text-end', id: 'text' },
      {
        type: 'finish',
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 2, text: 1, reasoning: 1 } },
      },
    ];
    const model: LanguageModelV4 = {
      specificationVersion: 'v4',
      provider: 'test',
      modelId: 'test',
      supportedUrls: {},
      doGenerate: async () => {
        throw new Error('Streaming only');
      },
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            parts.forEach((part) => controller.enqueue(part));
            controller.close();
          },
        }),
      }),
    };
    const state = new AssistantMessageState();
    const steps = new StepResultQueue<StepResult<ToolSet>>();
    const streamed = new Map<string, { text: string; reasoning: string }>();
    const completed: string[] = [];
    const result = streamText({ model, prompt: 'Read and answer', onStepEnd: (step) => steps.push(step) });
    for await (const chunk of result.stream) {
      if (chunk.type === 'reasoning-delta' || chunk.type === 'text-delta') {
        const id = state.messageId('response');
        const message = streamed.get(id) ?? { text: '', reasoning: '' };
        if (chunk.type === 'reasoning-delta') {
          state.reasoning(chunk.text);
          message.reasoning += chunk.text;
        } else {
          state.text();
          message.text += chunk.text;
        }
        streamed.set(id, message);
        expect(completed).toHaveLength(0);
        await delay(1);
      } else if (chunk.type === 'tool-call' || chunk.type === 'tool-result') {
        state.tool();
      } else if (chunk.type === 'finish-step') {
        const step = await steps.next();
        completed.push(step.text);
        state.reset();
      }
    }
    expect([...streamed.entries()]).toEqual([
      ['response', { text: '', reasoning: 'Thinking before the tool' }],
      ['response-1', { text: 'The final answer', reasoning: '' }],
    ]);
    expect(completed).toEqual(['The final answer']);
  });
});

import { describe, expect, it } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { Output } from 'ai';
import { z } from 'zod';

import { generateOnce } from '../generate-once';

import type { LanguageModelV4StreamPart } from '@ai-sdk/provider';

const usage = {
  inputTokens: { total: 100, noCache: 20, cacheRead: 80, cacheWrite: 0 },
  outputTokens: { total: 8, text: 8, reasoning: 0 },
};

const createModel = (text = '{"verdict":"ok"}', extraParts: LanguageModelV4StreamPart[] = []) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    },
    doStream: async () => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          const parts: LanguageModelV4StreamPart[] = [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: text },
            { type: 'text-end', id: 'text' },
            ...extraParts,
            { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage, providerMetadata: { test: { cached: true } } },
          ];
          parts.forEach((part) => controller.enqueue(part));
          controller.close();
        },
      }),
    }),
  });

describe('generateOnce', () => {
  it('uses non-streaming by default and returns token usage', async () => {
    const model = createModel();
    const result = await generateOnce({ model, prompt: 'Review' }, false);
    expect(result.text).toBe('{"verdict":"ok"}');
    expect(result.usage.inputTokenDetails.cacheReadTokens).toBe(80);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it('silently collects a required stream and preserves tools, metadata and usage', async () => {
    const model = createModel();
    const result = await generateOnce(
      { model, prompt: 'Review', tools: { read_file: { inputSchema: z.object({ path: z.string() }) } }, toolChoice: 'none' },
      true,
    );
    expect(result.text).toBe('{"verdict":"ok"}');
    expect(result.usage.inputTokenDetails.cacheReadTokens).toBe(80);
    expect(result.providerMetadata).toEqual({ test: { cached: true } });
    expect(result.finishReason).toBe('stop');
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0].tools).toEqual([expect.objectContaining({ name: 'read_file' })]);
    expect(model.doStreamCalls[0].toolChoice).toEqual({ type: 'none' });
  });

  it.each([false, true])('validates structured output with requireStreaming=%s', async (required) => {
    const result = await generateOnce(
      { model: createModel(), prompt: 'Review', output: Output.object({ schema: z.object({ verdict: z.literal('ok') }) }) },
      required,
    );
    expect(result.output).toEqual({ verdict: 'ok' });
  });

  it('propagates request failures from streaming-only models', async () => {
    const model = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error('Provider rejected request');
      },
    });
    await expect(generateOnce({ model, prompt: 'Review', maxRetries: 0 }, true)).rejects.toThrow('Provider rejected request');
  });

  it('propagates errors emitted inside a stream', async () => {
    const error = new Error('Stream interrupted');
    await expect(generateOnce({ model: createModel('partial', [{ type: 'error', error }]), prompt: 'Review' }, true)).rejects.toThrow('Stream interrupted');
  });

  it('propagates invalid structured output from a completed stream', async () => {
    await expect(
      generateOnce(
        { model: createModel('{"verdict":"wrong"}'), prompt: 'Review', output: Output.object({ schema: z.object({ verdict: z.literal('ok') }) }) },
        true,
      ),
    ).rejects.toThrow();
  });

  it('honors cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(generateOnce({ model: createModel(), prompt: 'Review', abortSignal: controller.signal }, true)).rejects.toThrow();
  });
});

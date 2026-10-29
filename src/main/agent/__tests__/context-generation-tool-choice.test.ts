import { describe, expect, it } from 'vitest';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

import type { LanguageModelV4 } from '@ai-sdk/provider';

const captureRequest = async (createModel: (fetch: typeof globalThis.fetch) => LanguageModelV4, streaming = false, structured = false) => {
  let body: Record<string, unknown> | undefined;
  const fetch: typeof globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    throw new Error('Request captured without network access');
  };
  const model = createModel(fetch);
  const call = streaming ? model.doStream.bind(model) : model.doGenerate.bind(model);
  await expect(
    call({
      prompt: [
        { role: 'system', content: 'Review the evidence' },
        { role: 'user', content: [{ type: 'text', text: 'Review' }] },
      ],
      tools: [{ type: 'function', name: 'read_file', description: 'Read a file', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } }],
      toolChoice: { type: 'none' },
      responseFormat: structured ? { type: 'json', schema: { type: 'object', properties: { verdict: { type: 'string' } } } } : undefined,
    }),
  ).rejects.toThrow();
  return body;
};

describe('provider tool-choice none request serialization', () => {
  it('retains OpenAI Chat tool schemas', async () => {
    const body = await captureRequest((fetch) => createOpenAI({ apiKey: 'test', fetch }).chat('gpt-4o'));
    expect(body?.tool_choice).toBe('none');
    expect(body?.tools).toEqual([expect.objectContaining({ type: 'function', function: expect.objectContaining({ name: 'read_file' }) })]);
  });

  it('retains OpenAI Responses tool schemas', async () => {
    const body = await captureRequest((fetch) => createOpenAI({ apiKey: 'test', fetch }).responses('gpt-4o'));
    expect(body?.tool_choice).toBe('none');
    expect(body?.tools).toEqual([expect.objectContaining({ type: 'function', name: 'read_file' })]);
  });

  it.each([false, true])('sets stream true and keeps tools for OpenAI Responses with structured output=%s', async (structured) => {
    const body = await captureRequest((fetch) => createOpenAI({ apiKey: 'test', fetch }).responses('gpt-4o'), true, structured);
    expect(body?.stream).toBe(true);
    expect(body?.tool_choice).toBe('none');
    expect(body?.tools).toEqual([expect.objectContaining({ type: 'function', name: 'read_file' })]);
    if (structured) {
      expect(body?.text).toMatchObject({ format: { type: 'json_schema' } });
    }
  });

  it('retains Anthropic tool schemas', async () => {
    const body = await captureRequest((fetch) => createAnthropic({ apiKey: 'test', fetch })('claude-sonnet-4-5'));
    expect(body?.tool_choice).toEqual({ type: 'none' });
    expect(body?.tools).toEqual([expect.objectContaining({ name: 'read_file', input_schema: expect.objectContaining({ type: 'object' }) })]);
  });
});

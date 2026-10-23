import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { LanguageModelV3Prompt } from '@ai-sdk/provider';

const bundleDir = fileURLToPath(new URL('../node_modules/ai-sdk-provider-claude-code/dist', import.meta.url));

type ContentPart = Record<string, unknown>;
type McpResult = { content: ContentPart[]; isError?: boolean };
type Handler = (args: unknown, extra?: unknown) => Promise<McpResult>;
type ConvertedPrompt = {
  messagesPrompt: string;
  systemPrompt?: string;
  streamingContentParts: ContentPart[];
  hasImageParts: boolean;
  warnings?: string[];
};
type BundleHelpers = {
  createAiSdkMcpServer: (name: string, tools: Record<string, unknown>) => { tools: Handler[] };
  convertToClaudeCodeMessages: (prompt: LanguageModelV3Prompt, sessionId?: string) => ConvertedPrompt;
};

const loadBundleHelpers = (bundle: string): BundleHelpers => {
  const source = readFileSync(resolve(bundleDir, bundle), 'utf8');
  const converter = source.slice(source.indexOf('var IMAGE_URL_WARNING'), source.indexOf('// src/errors.ts'));
  const bridgeStart = source.indexOf('function buildIsErrorResult');
  const bridgeEnd = source.indexOf(bundle.endsWith('.cjs') ? '// Annotate the CommonJS export names' : '\nexport {', bridgeStart);
  const bridge = source.slice(bridgeStart, bridgeEnd);
  const sdk = {
    tool: (_name: string, _description: string, _schema: unknown, handler: Handler) => handler,
    createSdkMcpServer: (config: unknown) => config,
  };

  return runInNewContext(`${converter}\n${bridge}\n({ createAiSdkMcpServer, convertToClaudeCodeMessages })`, {
    Buffer,
    Uint8Array,
    ArrayBuffer,
    Error,
    tool: sdk.tool,
    createSdkMcpServer: sdk.createSdkMcpServer,
    import_claude_agent_sdk2: sdk,
  }) as BundleHelpers;
};

describe.each(['index.js', 'index.cjs'])('Claude Agent SDK multimodal bridge (%s)', (bundle) => {
  let helpers: BundleHelpers;

  beforeAll(() => {
    helpers = loadBundleHelpers(bundle);
  });
  const execute = async (output: unknown): Promise<McpResult> => {
    const server = helpers.createAiSdkMcpServer('test', {
      read_binary_file: { inputSchema: z.object({}), execute: async () => output },
    });
    return server.tools[0]({});
  };

  it.each(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])('returns %s binary data as an MCP image, not JSON text', async (mimeType) => {
    const result = await execute({
      content: [
        { type: 'text', text: 'Attached binary file.' },
        { type: 'media', data: 'YWJj', mimeType },
      ],
    });

    expect(result.content).toEqual([
      { type: 'text', text: 'Attached binary file.' },
      { type: 'image', data: 'YWJj', mimeType },
    ]);
  });

  it('returns PDFs as embedded MCP resources', async () => {
    expect(await execute({ content: [{ type: 'media', data: 'YWJj', mimeType: 'application/pdf' }] })).toEqual({
      content: [{ type: 'resource', resource: { uri: 'binary:///attachment-0.pdf', mimeType: 'application/pdf', blob: 'YWJj' } }],
    });
  });

  it('preserves standard MCP content and error flags', async () => {
    const result = {
      isError: true,
      content: [
        { type: 'text', text: 'A tool error' },
        { type: 'image', data: 'YWJj', mimeType: 'image/png' },
        { type: 'resource', resource: { uri: 'file:///test.txt', text: 'test' } },
      ],
    };
    expect(await execute(result)).toEqual(result);
  });

  it('supports image-data aliases', async () => {
    expect(await execute({ content: [{ type: 'image-data', image: 'YWJj', mediaType: 'image/png' }] })).toEqual({
      content: [{ type: 'image', data: 'YWJj', mimeType: 'image/png' }],
    });
  });

  it.each(['application/msword', 'audio/mpeg', 'image/svg+xml'])('reports unsupported %s without sending base64 as text', async (mimeType) => {
    const result = await execute({ content: [{ type: 'media', data: 'YWJj', mimeType }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`unsupported binary media type "${mimeType}"`);
    expect(JSON.stringify(result)).not.toContain('YWJj');
  });

  it('reports malformed binary content as a tool error', async () => {
    const result = await execute({ content: [{ type: 'media', data: 123, mimeType: 'image/png' }] });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('invalid binary content');
  });

  it('keeps plain strings and ordinary JSON results working', async () => {
    expect(await execute('hello')).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    expect(await execute({ count: 2 })).toEqual({ content: [{ type: 'text', text: '{"count":2}' }] });
  });

  it('normalizes the final result of an async iterable', async () => {
    const output = {
      async *[Symbol.asyncIterator]() {
        yield 'working';
        yield { content: [{ type: 'media', data: 'YWJj', mimeType: 'image/png' }] };
      },
    };
    expect(await execute(output)).toEqual({ content: [{ type: 'image', data: 'YWJj', mimeType: 'image/png' }] });
  });

  it('preserves the real Claude tool-call ID', async () => {
    let toolCallId: string | undefined;
    const server = helpers.createAiSdkMcpServer('test', {
      read_binary_file: {
        inputSchema: z.object({}),
        execute: async (_args: unknown, options: { toolCallId: string }) => {
          toolCallId = options.toolCallId;
          return 'ok';
        },
      },
    });
    await server.tools[0]({}, { requestId: 12, _meta: { 'claudecode/toolUseId': 'claude-call' } });
    expect(toolCallId).toBe('claude-call');
  });

  it.each([undefined, 'session-id'])('preserves text and image files with session %s', (sessionId) => {
    const prompt: LanguageModelV3Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Inspect this' },
          { type: 'file', data: new Uint8Array([97, 98, 99]), mediaType: 'image/png' },
        ],
      },
    ];
    const result = helpers.convertToClaudeCodeMessages(prompt, sessionId);
    expect(result.hasImageParts).toBe(true);
    expect(result.streamingContentParts).toEqual([
      { type: 'text', text: 'Inspect this' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'YWJj' } },
    ]);
  });

  it('only sends the latest user message on resume while retaining the system prompt and PDF', () => {
    const result = helpers.convertToClaudeCodeMessages(
      [
        { role: 'system', content: 'System instructions' },
        { role: 'user', content: [{ type: 'text', text: 'Old request' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Old response' }] },
        { role: 'user', content: [{ type: 'file', data: 'YWJj', mediaType: 'application/pdf' }] },
      ],
      'session-id',
    );
    expect(result.systemPrompt).toBe('System instructions');
    expect(result.hasImageParts).toBe(true);
    expect(result.streamingContentParts).toEqual([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'YWJj' } }]);
  });

  it('handles data-wrapped file parts from tool-result conversion', () => {
    const result = helpers.convertToClaudeCodeMessages([
      { role: 'user', content: [{ type: 'file', data: { type: 'data', data: 'YWJj' }, mediaType: 'image/png' }] },
    ] as unknown as LanguageModelV3Prompt);
    expect(result.streamingContentParts).toEqual([{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'YWJj' } }]);
  });

  it('reports unsupported prompt file types rather than silently discarding them', () => {
    const result = helpers.convertToClaudeCodeMessages([{ role: 'user', content: [{ type: 'file', data: 'YWJj', mediaType: 'audio/mpeg' }] }], 'session-id');
    expect(result.warnings).toEqual(['Unsupported file media type: audio/mpeg. Claude supports images and PDFs.']);
  });
});

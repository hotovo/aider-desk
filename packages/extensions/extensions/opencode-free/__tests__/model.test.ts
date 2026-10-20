import { describe, expect, it, vi } from 'vitest';
import { generateText, jsonSchema } from 'ai';

import { OpenCodeFreeModel } from '../model';

import type { ProviderToolApprovalHandler } from '@aiderdesk/extensions';
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { ToolBridge } from '../bridge';

const finish: LanguageModelV4StreamPart = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 5, text: 5, reasoning: 0 },
  },
};
const call: LanguageModelV4StreamPart = {
  type: 'tool-call',
  toolCallId: 'call-1',
  toolName: 'read',
  input: '{"path":"/fixture"}',
};
const approval: LanguageModelV4StreamPart = {
  type: 'tool-approval-request',
  approvalId: 'approval-1',
  toolCallId: 'call-1',
};
const text: LanguageModelV4StreamPart[] = [
  { type: 'text-start', id: 'text' },
  { type: 'text-delta', id: 'text', delta: 'done' },
  { type: 'text-end', id: 'text' },
];

const setup = (rounds: LanguageModelV4StreamPart[][], answer = 'y', enabled = true, bridge?: ToolBridge) => {
  const options: LanguageModelV4CallOptions[] = [];
  const nativeExecute = vi.fn();
  const dispose = vi.fn(async () => undefined);
  const approveTool = vi.fn<ProviderToolApprovalHandler>(async () => [answer === 'y', answer === 'y' ? undefined : 'Denied by Power tool policy']);
  const delegate: LanguageModelV4 = {
    specificationVersion: 'v4',
    provider: 'fake',
    modelId: 'free',
    supportedUrls: {},
    doGenerate: vi.fn(),
    doStream: async (input) => {
      options.push(input);
      const parts = rounds.shift() ?? [];
      return {
        stream: new ReadableStream({
          start: (controller) => {
            parts.forEach((part) => controller.enqueue(part));
            controller.close();
          },
        }),
      };
    },
  };
  const tools = enabled
    ? {
        'power---bash': {
          inputSchema: jsonSchema({ type: 'object', properties: { command: { type: 'string' } } }),
          execute: nativeExecute,
        },
        'power---file_read': {
          inputSchema: jsonSchema({
            type: 'object',
            properties: { filePath: { type: 'string' } },
          }),
          execute: nativeExecute,
        },
      }
    : {};
  const model = new OpenCodeFreeModel('opencode/free', delegate, tools, bridge, dispose, approveTool);
  return { model, delegate, options, nativeExecute, dispose, approveTool, tools };
};
const prompt: LanguageModelV4CallOptions['prompt'] = [{ role: 'user', content: [{ type: 'text', text: 'read' }] }];

const read = async (model: OpenCodeFreeModel) => {
  const { stream } = await model.doStream({ prompt });
  const parts: LanguageModelV4StreamPart[] = [];
  for await (const part of stream) {
    parts.push(part);
  }
  return parts;
};

describe('OpenCode Free approval adapter', () => {
  it('approves native reads, preserves arguments across replay, and never executes Power', async () => {
    const test = setup([
      [call, approval, finish],
      [
        { ...call, input: '{}' },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'read',
          result: 'fixture',
        },
        ...text,
        finish,
      ],
    ]);
    const parts = await read(test.model);
    expect(parts.filter((part) => part.type === 'tool-call')).toEqual([
      expect.objectContaining({
        toolName: 'power---file_read',
        input: '{"filePath":"/fixture"}',
        providerExecuted: true,
        dynamic: true,
      }),
    ]);
    expect(parts.filter((part) => part.type === 'finish')).toHaveLength(1);
    expect(test.nativeExecute).not.toHaveBeenCalled();
    expect(test.approveTool).toHaveBeenCalledOnce();
    expect(test.options[1].prompt.at(-1)).toMatchObject({
      role: 'tool',
      content: [{ approved: true }],
    });
  });

  it('uses reasoned rejection so the provider resumes instead of aborting', async () => {
    const test = setup(
      [
        [call, approval, finish],
        [...text, finish],
      ],
      'n',
    );
    await read(test.model);
    expect(test.options[1].prompt.at(-1)).toMatchObject({
      content: [{ approved: false, reason: 'Denied by Power tool policy' }],
    });
    expect(test.nativeExecute).not.toHaveBeenCalled();
  });

  it('never approves a disabled native tool', async () => {
    const test = setup(
      [
        [call, approval, finish],
        [...text, finish],
      ],
      'y',
      false,
    );
    await read(test.model);
    expect(test.approveTool).not.toHaveBeenCalled();
    expect(test.options[1].prompt.at(-1)).toMatchObject({
      content: [{ approved: false }],
    });
  });

  it('authorizes MCP transport only after observing its correlated call', async () => {
    const bridge = {
      names: new Map([['aiderdesk_tool_0', 'test---tool']]),
      allowCall: vi.fn(),
      getOutput: vi.fn(),
    } as unknown as ToolBridge;
    const test = setup(
      [
        [{ ...call, toolName: 'aiderdesk_tool_0' }, approval, finish],
        [...text, finish],
      ],
      'y',
      true,
      bridge,
    );
    const parts = await read(test.model);
    expect(bridge.allowCall).toHaveBeenCalledExactlyOnceWith('aiderdesk_tool_0', 'call-1', { path: '/fixture' });
    expect(test.approveTool).not.toHaveBeenCalled();
    expect(parts.find((part) => part.type === 'tool-call')).toMatchObject({
      toolName: 'test---tool',
      providerExecuted: true,
    });
  });

  it('does not replay side effects when a turn fails', async () => {
    const test = setup([[{ type: 'error', error: new Error('transport lost') }]]);
    await expect(read(test.model)).rejects.toThrow('transport lost');
    expect(test.options).toHaveLength(1);
    expect(test.dispose).toHaveBeenCalledOnce();
  });

  it('rejects repeated approval IDs instead of executing twice', async () => {
    const test = setup([
      [call, approval, finish],
      [call, approval, finish],
    ]);
    await expect(read(test.model)).rejects.toThrow('repeated a handled approval');
    expect(test.approveTool).toHaveBeenCalledOnce();
  });

  it('rejects unknown native tools without asking the user', async () => {
    const test = setup([
      [{ ...call, toolName: 'edit' }, approval, finish],
      [...text, finish],
    ]);
    await read(test.model);
    expect(test.approveTool).not.toHaveBeenCalled();
    expect(test.options[1].prompt.at(-1)).toMatchObject({
      content: [{ approved: false }],
    });
  });

  it('marks native tools provider-executed through the real AI SDK', async () => {
    const test = setup([
      [call, approval, finish],
      [
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'read',
          result: 'fixture',
        },
        ...text,
        finish,
      ],
    ]);
    const result = await generateText({
      model: test.model,
      tools: test.tools,
      prompt: 'read',
      maxRetries: 0,
    });
    expect(result.text).toBe('done');
    expect(result.toolCalls).toEqual([
      expect.objectContaining({
        toolName: 'power---file_read',
        providerExecuted: true,
      }),
    ]);
    expect(test.nativeExecute).not.toHaveBeenCalled();
  });
});

describe('native shell ownership', () => {
  it('maps approved shell events without running the Power executor and disposes its own runtime', async () => {
    const shell = { ...call, toolName: 'shell', input: '{"command":"pwd","timeout":1000}' };
    const test = setup([
      [shell, approval, finish],
      [{ type: 'tool-result', toolCallId: 'call-1', toolName: 'shell', result: '/workspace' }, ...text, finish],
    ]);
    const parts = await read(test.model);
    expect(parts.filter((part) => part.type === 'tool-call')).toEqual([
      expect.objectContaining({ toolName: 'power---bash', input: shell.input, providerExecuted: true }),
    ]);
    expect(test.nativeExecute).not.toHaveBeenCalled();
    expect(test.approveTool).toHaveBeenCalledOnce();
    expect(test.dispose).toHaveBeenCalledOnce();
  });
});

describe('native policy delegation and result ownership', () => {
  it('passes mapped Power inputs to the shared approval handler', async () => {
    const test = setup([
      [call, approval, finish],
      [...text, finish],
    ]);
    await read(test.model);
    expect(test.approveTool).toHaveBeenCalledWith('power---file_read', { filePath: '/fixture' }, expect.any(String), expect.any(String));
    expect(test.nativeExecute).not.toHaveBeenCalled();
  });

  it('forwards the Power approval rejection reason back to OpenCode', async () => {
    const test = setup(
      [
        [call, approval, finish],
        [...text, finish],
      ],
      'n',
    );
    await read(test.model);
    expect(test.options[1].prompt.at(-1)).toMatchObject({
      content: [{ approved: false, reason: 'Denied by Power tool policy' }],
    });
  });

  it('retains the original MCP output instead of overwriting it with text content blocks', async () => {
    const original = { files: ['README.md', 'index.ts'] };
    const bridge = {
      names: new Map([['aiderdesk_tool_0', 'power---glob']]),
      allowCall: vi.fn(),
      getOutput: vi.fn(() => ({ value: original })),
    } as unknown as ToolBridge;
    const test = setup(
      [
        [
          { ...call, toolName: 'aiderdesk_tool_0' },
          { type: 'tool-result', toolCallId: call.toolCallId, toolName: 'aiderdesk_tool_0', result: [{ type: 'text', text: JSON.stringify(original) }] },
          ...text,
          finish,
        ],
      ],
      'y',
      true,
      bridge,
    );
    const parts = await read(test.model);
    expect(parts.find((part) => part.type === 'tool-result')).toMatchObject({ toolName: 'power---glob', result: original });
  });

  it('normalizes native read text blocks into text rather than React children', async () => {
    const test = setup([
      [
        call,
        { type: 'tool-result', toolCallId: call.toolCallId, toolName: 'read', result: { type: 'json', value: [{ type: 'text', text: 'file contents' }] } },
        ...text,
        finish,
      ],
    ]);
    const parts = await read(test.model);
    expect(parts.find((part) => part.type === 'tool-result')).toMatchObject({ toolName: 'power---file_read', result: 'file contents' });
  });
  it('fails closed when the host does not supply its approval callback', async () => {
    const test = setup([
      [call, approval, finish],
      [...text, finish],
    ]);
    const model = new OpenCodeFreeModel('opencode/free', test.delegate, test.tools, undefined, test.dispose);
    await read(model);
    expect(test.options[1].prompt.at(-1)).toMatchObject({ content: [{ approved: false, reason: expect.stringContaining('Update AiderDesk') }] });
    expect(test.approveTool).not.toHaveBeenCalled();
    expect(test.nativeExecute).not.toHaveBeenCalled();
  });
  it('checkpoints the session only after the final approval continuation completes', async () => {
    const completed = vi.fn(async () => undefined);
    const metadata = { opencode: { sessionId: 'ses_completed' } };
    const test = setup([
      [call, approval, finish],
      [...text, { ...finish, providerMetadata: metadata }],
    ]);
    const model = new OpenCodeFreeModel('opencode/free', test.delegate, test.tools, undefined, test.dispose, test.approveTool, completed);
    await read(model);
    expect(completed).toHaveBeenCalledExactlyOnceWith(metadata);
    expect(test.dispose).toHaveBeenCalledOnce();
  });

  it('does not checkpoint an interrupted or failed native session', async () => {
    const completed = vi.fn(async () => undefined);
    const test = setup([[{ ...finish, finishReason: { unified: 'error', raw: 'error' } }]]);
    const model = new OpenCodeFreeModel('opencode/free', test.delegate, test.tools, undefined, test.dispose, test.approveTool, completed);
    await expect(read(model)).rejects.toThrow('execution failed');
    expect(completed).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { prepareMessagesForModel } from '../message-preparation';
import { transformMessages } from '../message-preparation/transformations';
import { applyCacheControl } from '../message-preparation/cache-control';
import { getSubagentFinalText } from '../message-preparation/tool-results';

import type { ModelMessage, ToolResultPart } from 'ai';
import type { ExtensionManager } from '@/extensions';
import type { Task } from '@/task';

vi.mock('@/logger');

const subagentTool = `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`;
const aiderTool = `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`;
const cacheControl = { providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } };
const task = { project: {} } as Task;

const toolMessage = (toolName: string, output: ToolResultPart['output']): ModelMessage => ({
  role: 'tool',
  content: [{ type: 'tool-result', toolCallId: 'call-1', toolName, output }],
});

const subagentMessage = () =>
  toolMessage(subagentTool, {
    type: 'json',
    value: {
      messages: [
        { role: 'assistant', content: 'intermediate' },
        { role: 'assistant', content: 'final' },
      ],
      promptContext: { id: 'ui-only' },
    },
  });

const extensionManager = (dispatchEvent: ReturnType<typeof vi.fn>) => ({ dispatchEvent }) as unknown as ExtensionManager;

describe('message transformation', () => {
  it('strips Aider UI fields without mutating source context', () => {
    const messages = [toolMessage(aiderTool, { type: 'json', value: { responses: ['ui'], promptContext: {}, result: 'done' } })];
    const snapshot = structuredClone(messages);
    const transformed = transformMessages(messages);
    expect(transformed).toEqual([toolMessage(aiderTool, { type: 'json', value: { result: 'done' } })]);
    expect(messages).toEqual(snapshot);
  });

  it('reduces subagent history and is idempotent', () => {
    const messages = [subagentMessage()];
    const transformed = transformMessages(messages);
    expect(transformed).toEqual([toolMessage(subagentTool, { type: 'text', value: 'final' })]);
    expect(transformMessages(transformed)).toEqual(transformed);
    expect(messages).toEqual([subagentMessage()]);
  });

  it('supports current and legacy subagent results and empty histories', () => {
    expect(getSubagentFinalText({ messages: [{ role: 'assistant', content: 'final' }] })).toBe('final');
    expect(getSubagentFinalText([{ role: 'assistant', content: 'legacy' }])).toBe('legacy');
    expect(getSubagentFinalText({ messages: [] })).toBe('');
    expect(getSubagentFinalText({ messages: [null] })).toBeUndefined();
    expect(getSubagentFinalText({ messages: 'invalid' })).toBeUndefined();
    const malformed = [toolMessage(subagentTool, { type: 'json', value: { error: 'failed' } })];
    expect(transformMessages(malformed)).toEqual(malformed);
  });
});

describe('message preparation hooks', () => {
  it('allows restoring subagent history without reapplying transformations', async () => {
    const dispatchEvent = vi.fn(async (event, payload) => {
      if (event === 'onTransformMessages') {
        expect(payload.transformedMessages).toEqual([toolMessage(subagentTool, { type: 'text', value: 'final' })]);
        return { ...payload, transformedMessages: payload.originalMessages };
      }
      if (event === 'onOptimizeMessages') {
        expect(payload.originalMessages).toEqual([subagentMessage()]);
      }
      return payload;
    });
    const messages = [subagentMessage()];
    const result = await prepareMessagesForModel(messages, undefined, task, null, [], -1, extensionManager(dispatchEvent));
    expect(result).toEqual(messages);
    expect(dispatchEvent.mock.calls.map(([event]) => event)).toEqual(['onTransformMessages', 'onOptimizeMessages', 'onApplyCacheControl']);
  });

  it('allows overriding default duplicate-call optimization with the transformed baseline', async () => {
    const call: ModelMessage = { role: 'assistant', content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'test', input: {} }] };
    const result = toolMessage('test', { type: 'text', value: 'success' });
    const messages = [call, result, structuredClone(call), structuredClone(result)];
    const dispatchEvent = vi.fn(async (event, payload) => {
      if (event === 'onOptimizeMessages') {
        expect(payload.optimizedMessages).not.toEqual(payload.originalMessages);
        return { ...payload, optimizedMessages: payload.originalMessages };
      }
      return payload;
    });
    expect(await prepareMessagesForModel(messages, undefined, task, null, [], -1, extensionManager(dispatchEvent))).toEqual(messages);
  });

  it('allows disabling cache annotation without mutating the baseline', async () => {
    const messages: ModelMessage[] = [{ role: 'user', content: 'hello' }];
    const dispatchEvent = vi.fn(async (event, payload) => {
      if (event === 'onApplyCacheControl') {
        expect(payload.cacheControl).toEqual(cacheControl);
        expect(payload.messages[0].providerOptions).toEqual(cacheControl.providerOptions);
        expect(payload.originalMessages[0].providerOptions).toBeUndefined();
        return { ...payload, messages: payload.originalMessages };
      }
      return payload;
    });
    expect(await prepareMessagesForModel(messages, cacheControl, task, null, [], -1, extensionManager(dispatchEvent))).toEqual(messages);
    expect(messages[0].providerOptions).toBeUndefined();
  });

  it('dispatches cache hook even without a policy or messages', async () => {
    const dispatchEvent = vi.fn(async (event, payload) =>
      event === 'onApplyCacheControl'
        ? { ...payload, messages: [{ role: 'user', content: 'custom', providerOptions: cacheControl.providerOptions }] }
        : payload,
    );
    const result = await prepareMessagesForModel([], undefined, task, null, [], -1, extensionManager(dispatchEvent));
    expect(result[0].providerOptions).toEqual(cacheControl.providerOptions);
  });

  it('annotates the final message after compatibility inserts an image message', async () => {
    const messages = [
      toolMessage('image-tool', {
        type: 'json',
        value: { content: [{ type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' }] },
      }),
    ];
    const result = await prepareMessagesForModel(messages, cacheControl);
    expect(result).toHaveLength(2);
    expect(result[0].providerOptions).toBeUndefined();
    expect(result[1].role).toBe('user');
    expect(result[1].providerOptions).toEqual(cacheControl.providerOptions);
    expect(messages[0].providerOptions).toBeUndefined();
  });
});

describe('duplicate screenshot preservation', () => {
  const formats: Array<{ name: string; output: (data: string) => ToolResultPart['output'] }> = [
    { name: 'MCP JSON', output: (data) => ({ type: 'json', value: { content: [{ type: 'image', data, mimeType: 'image/png' }] } }) },
    { name: 'MCP text JSON', output: (data) => ({ type: 'text', value: JSON.stringify({ content: [{ type: 'image', data, mimeType: 'image/png' }] }) }) },
    { name: 'native content', output: (data) => ({ type: 'content', value: [{ type: 'file', data: { type: 'data', data }, mediaType: 'image/png' }] }) },
  ];

  it.each(formats)('preserves both fresh images from identical screenshot calls in $name results', async ({ output }) => {
    const screenshot = (toolCallId: string, data: string): ModelMessage[] => [
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId, toolName: 'screenshot', input: {} }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId, toolName: 'screenshot', output: output(data) }] },
    ];
    const messages = [...screenshot('first', 'Zmlyc3Q='), ...screenshot('second', 'c2Vjb25k')];
    const snapshot = structuredClone(messages);
    const result = await prepareMessagesForModel(messages);
    const images = result.flatMap((message) =>
      message.role === 'user' && Array.isArray(message.content) ? message.content.filter((part) => part.type === 'file') : [],
    );
    expect(images.map((part) => part.data)).toEqual([
      { type: 'data', data: 'Zmlyc3Q=' },
      { type: 'data', data: 'c2Vjb25k' },
    ]);
    expect(JSON.stringify(result)).not.toContain('Duplicate tool call detected');
    expect(messages).toEqual(snapshot);
  });

  it.each(['plain result', '{invalid JSON'])('still suppresses duplicate non-media results: %s', async (value) => {
    const invocation = (toolCallId: string): ModelMessage[] => [
      { role: 'assistant', content: [{ type: 'tool-call', toolCallId, toolName: 'read', input: {} }] },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId, toolName: 'read', output: { type: 'text', value } }] },
    ];
    const result = await prepareMessagesForModel([...invocation('first'), ...invocation('second')]);
    expect(result).toHaveLength(4);
    const last = result.at(-1);
    expect(last?.role === 'tool' && last.content[0].type === 'tool-result' && last.content[0].output).toEqual({
      type: 'text',
      value: expect.stringContaining('Duplicate tool call detected'),
    });
  });
});

describe('cache annotation', () => {
  it('handles empty messages', () => {
    expect(applyCacheControl([], cacheControl)).toEqual([]);
  });

  it('annotates the last content part without changing existing options', () => {
    const messages: ModelMessage[] = [{ role: 'user', content: [{ type: 'text', text: 'hello', providerOptions: { custom: { key: true } } }] }];
    const result = applyCacheControl(messages, { ...cacheControl, placement: 'message-part' });
    expect(result).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'hello', providerOptions: { custom: { key: true }, ...cacheControl.providerOptions } }] },
    ]);
    expect(messages[0].providerOptions).toBeUndefined();
  });
});

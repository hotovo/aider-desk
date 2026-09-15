import type { ExtensionContext, ResponseChunkEvent, ResponseCompletedEvent } from '@aiderdesk/extensions';
import { afterEach, describe, expect, it, vi } from 'vitest';

import TPSCounterExtension from '../index';

const createContext = (taskId?: string) => ({
  triggerUIDataRefresh: vi.fn(),
  log: vi.fn(),
  getTaskContext: taskId ? () => ({ data: { id: taskId } }) : () => null,
  getProjectContext: () => ({
    getTasks: async () => [
      { id: 'parent', parentId: null },
      { id: 'child', parentId: 'parent' },
    ],
  }),
}) as unknown as ExtensionContext;

const createChunk = (messageId: string, chunk: string, reasoning?: string, taskId = 'task-1'): ResponseChunkEvent => ({
  chunk: {
    messageId,
    baseDir: '/tmp/project',
    taskId,
    chunk,
    reasoning,
  },
});

const createCompletion = (messageId: string, receivedTokens?: number, taskId = 'task-1'): ResponseCompletedEvent => ({
  response: {
    type: 'response-completed',
    messageId,
    baseDir: '/tmp/project',
    taskId,
    content: 'completed response',
    usageReport: receivedTokens === undefined
      ? undefined
      : { model: 'test-model', sentTokens: 1, receivedTokens, messageCost: 0 },
  },
});

describe('TPSCounterExtension', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates live TPS from streamed chunks and throttles refreshes', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_050)
      .mockReturnValueOnce(1_200);
    const extension = new TPSCounterExtension();
    const context = createContext();

    await extension.onResponseChunk(createChunk('message-1', '12345678'), context);
    await extension.onResponseChunk(createChunk('message-1', '12345678'), context);

    const data = await extension.getUIExtensionData('tps-counter', context) as {
      currentTps: number;
      currentTokens: number;
      isStreaming: boolean;
    };

    expect(data.currentTokens).toBe(4);
    expect(data.currentTps).toBeGreaterThan(0);
    expect(data.currentTps).toBeLessThanOrEqual(4);
    expect(data.isStreaming).toBe(true);
    expect(context.triggerUIDataRefresh).toHaveBeenCalledTimes(4);
  });

  it('uses provider usage when available and streamed tokens as fallback', async () => {
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(3_000)
      .mockReturnValueOnce(4_000)
      .mockReturnValueOnce(4_000);
    const extension = new TPSCounterExtension();
    const context = createContext();

    await extension.onResponseChunk(createChunk('reported', '1234'), context);
    await extension.onResponseCompleted(createCompletion('reported', 20), context);
    await extension.onResponseChunk(createChunk('fallback', '12345678'), context);
    await extension.onResponseCompleted(createCompletion('fallback'), context);

    const data = await extension.getUIExtensionData('tps-counter', context) as {
      totalTokens: number;
      messageCount: number;
      isStreaming: boolean;
    };
    const messages = await extension.getUIExtensionData('tps-counter-message-bar', context) as Record<string, { tokens: number }>;

    expect(data.totalTokens).toBe(22);
    expect(data.messageCount).toBe(2);
    expect(data.isStreaming).toBe(false);
    expect(messages.reported.tokens).toBe(20);
    expect(messages.fallback.tokens).toBe(2);
  });

  it('keeps parent TPS separate and exposes active subagent TPS on the parent dashboard', async () => {
    let now = 1_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const extension = new TPSCounterExtension();
    const parentContext = createContext('parent');

    await extension.onResponseChunk(createChunk('parent-message', '12345678', undefined, 'parent'), parentContext);
    now = 2_000;
    await extension.onResponseCompleted(createCompletion('parent-message', 4, 'parent'), parentContext);
    now = 3_000;
    await extension.onResponseChunk(createChunk('child-message', '12345678', undefined, 'child'), parentContext);
    now = 4_000;
    await extension.onResponseChunk(createChunk('child-message', '12345678', undefined, 'child'), parentContext);

    const data = await extension.getUIExtensionData('tps-counter', parentContext) as {
      currentTps: number;
      subagentTps: number;
      subagentCount: number;
      isStreaming: boolean;
    };

    expect(data.currentTps).toBe(0);
    expect(data.subagentTps).toBeGreaterThan(0);
    expect(data.subagentCount).toBe(1);
    expect(data.isStreaming).toBe(false);
  });
});

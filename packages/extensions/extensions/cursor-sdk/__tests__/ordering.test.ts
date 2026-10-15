import { describe, expect, it, vi } from 'vitest';

import { createStreamProcessor } from '../index';

import type { InteractionUpdate } from '@cursor/sdk';
import type { ContextMessage, ExtensionContext, TaskContext } from '@aiderdesk/extensions';

vi.mock('@cursor/sdk', () => ({ Agent: {}, Cursor: {} }));

const setup = () => {
  const stored: ContextMessage[] = [];
  const task = {
    data: { agentTotalCost: 0 },
    addContextMessage: vi.fn(async (message: ContextMessage) => {
      stored.push(structuredClone(message));
    }),
    addResponseMessage: vi.fn(),
    addToolMessage: vi.fn(),
    addToGit: vi.fn(),
    removeMessage: vi.fn(),
    getTaskDir: () => '/tmp',
  };
  const processor = createStreamProcessor(task as unknown as TaskContext, { log: vi.fn() } as unknown as ExtensionContext, 'auto');
  const emit = async (type: string, callId: string, toolType = 'read', result: unknown = { status: 'success', value: { content: 'hello' } }) => {
    await processor.onDelta({
      type,
      callId,
      toolCall: { type: toolType, args: { path: 'file.txt' }, result },
    } as unknown as InteractionUpdate);
  };
  return { stored, task, processor, emit };
};

const expectOrdered = (messages: ContextMessage[]) => {
  const calls = new Set<string>();
  for (const message of messages) {
    if (!Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part.type === 'tool-call') calls.add(part.toolCallId);
      if (part.type === 'tool-result') expect(calls.has(part.toolCallId)).toBe(true);
    }
  }
  expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
};

describe('Cursor context persistence ordering', () => {
  it('deduplicates completed calls and ignores late starts', async () => {
    const { stored, processor, emit, task } = setup();
    await emit('tool-call-completed', 'one', 'write');
    await emit('tool-call-completed', 'one', 'write');
    await emit('tool-call-started', 'one', 'write');
    await processor.finish();
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool']);
    expect(task.addToGit).toHaveBeenCalledTimes(1);
    expectOrdered(stored);
  });

  it('drains unawaited callbacks before an idempotent finish', async () => {
    const { stored, processor, emit } = setup();
    const callbacks = [emit('tool-call-started', 'one'), emit('tool-call-completed', 'one')];
    await Promise.all([processor.finish(), processor.finish(), ...callbacks]);
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool']);
    expectOrdered(stored);
    await emit('tool-call-completed', 'late');
    expect(stored).toHaveLength(2);
  });

  it('persists partial messages and reports callback failures at finish', async () => {
    const { stored, processor, task, emit } = setup();
    task.addToGit.mockRejectedValueOnce(new Error('Git failed'));
    await emit('tool-call-completed', 'one', 'write');
    await expect(processor.finish()).rejects.toThrow('Git failed');
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool']);
    expectOrdered(stored);
  });

  it('persists a multi-call assistant before its results, incrementally on the next response', async () => {
    const { stored, processor, emit } = setup();
    for (const id of ['one', 'two']) {
      await emit('tool-call-started', id);
      await emit('tool-call-completed', id);
    }
    expect(stored).toEqual([]);
    await processor.onDelta({
      type: 'text-delta',
      text: 'Done',
    } as InteractionUpdate);
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool', 'tool']);
    await processor.finish();
    expectOrdered(stored);
  });

  it('flushes partial runs and retains unfinished tool calls', async () => {
    const { stored, processor, emit } = setup();
    await emit('tool-call-completed', 'one');
    await emit('tool-call-started', 'two');
    await processor.finish();
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool']);
    expectOrdered(stored);
  });

  it('does not remove/reappend the final assistant when attaching usage', async () => {
    const { stored, task, processor, emit } = setup();
    await emit('tool-call-completed', 'one');
    await processor.finish({
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(stored[0].usageReport).toBeDefined();
    expect(task.removeMessage).not.toHaveBeenCalled();
    expectOrdered(stored);
  });

  it('retains reasoning and text together before a tool result', async () => {
    const { stored, processor, emit } = setup();
    await processor.onDelta({
      type: 'thinking-delta',
      text: 'Thinking',
    } as InteractionUpdate);
    await processor.onDelta({
      type: 'text-delta',
      text: 'Checking',
    } as InteractionUpdate);
    await emit('tool-call-started', 'one');
    await emit('tool-call-completed', 'one');
    await processor.finish();
    expect(stored[0].content).toMatchObject([
      { type: 'reasoning', text: 'Thinking' },
      { type: 'text', text: 'Checking' },
      { type: 'tool-call', toolCallId: 'one' },
    ]);
    expectOrdered(stored);
  });

  it('retries a failed append before persisting dependent results', async () => {
    const { stored, task, processor, emit } = setup();
    task.addContextMessage.mockRejectedValueOnce(new Error('Temporary failure'));
    await emit('tool-call-completed', 'one');
    await processor.onDelta({
      type: 'text-delta',
      text: 'Done',
    } as InteractionUpdate);
    expect(stored).toEqual([]);
    await processor.finish();
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'tool', 'assistant']);
    expectOrdered(stored);
  });

  it('hydrates subagent steps from onStep before persisting the parent result', async () => {
    const { stored, processor, emit } = setup();
    await emit('tool-call-started', 'child', 'task');
    await emit('tool-call-completed', 'child', 'task', {
      status: 'success',
      value: {},
    });
    await processor.onStep({
      type: 'toolCall',
      message: {
        type: 'task',
        args: { path: 'file.txt' },
        result: {
          status: 'success',
          value: {
            conversationSteps: [{ type: 'assistantMessage', message: { text: 'Child done' } }],
          },
        },
      },
    } as unknown as Parameters<typeof processor.onStep>[0]);
    await processor.finish();
    expect(stored.map((message) => message.role)).toEqual(['assistant', 'assistant', 'tool']);
    expectOrdered(stored);
  });

  it('persists split edit calls before their results', async () => {
    const { stored, processor, emit } = setup();
    await emit('tool-call-started', 'edit', 'edit');
    await emit('tool-call-completed', 'edit', 'edit', {
      status: 'success',
      value: {
        diffString: '@@ -1 +1 @@\n-old\n+new\n@@ -3 +3 @@\n-other\n+updated',
      },
    });
    await processor.finish();
    expect(stored).toHaveLength(3);
    expectOrdered(stored);
  });

  it('persists sibling subagent calls, nested messages and parent results exactly once', async () => {
    const { stored, processor, emit } = setup();
    for (const id of ['child-one', 'child-two']) {
      await emit('tool-call-started', id, 'task');
      await emit('tool-call-completed', id, 'task', {
        status: 'success',
        value: {
          conversationSteps: [
            { type: 'assistantMessage', message: { text: 'Working' } },
            {
              type: 'toolCall',
              message: {
                type: 'read',
                args: { path: 'file.txt' },
                result: { status: 'success', value: { content: 'hello' } },
              },
            },
          ],
        },
      });
    }
    await processor.finish({
      inputTokens: 10,
      outputTokens: 2,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    expect(stored).toHaveLength(8);
    expectOrdered(stored);
    const parentMessages = stored.filter((message) => message.id.startsWith('cursor-'));
    expect(parentMessages).toHaveLength(2);
    expect(parentMessages[1].usageReport).toBeDefined();
    expect(stored.filter((message) => !message.id.startsWith('cursor-')).every((message) => !message.usageReport)).toBe(true);
  });
});

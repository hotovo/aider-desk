import { describe, expect, it } from 'vitest';

import { AssistantMessageState, StepResultQueue } from '../assistant-message-state';

describe('assistant message boundaries', () => {
  it('keeps reasoning before tools separate from the final response', () => {
    const state = new AssistantMessageState();
    const initialId = state.messageId('response');
    state.reasoning();
    state.tool();
    state.tool();
    const finalId = state.messageId('response');
    state.text();
    expect(initialId).toBe('response');
    expect(finalId).toBe('response-1');
    expect(state.hasReasoning).toBe(false);
  });

  it('combines reasoning and text when no tool separates them', () => {
    const state = new AssistantMessageState();
    state.reasoning();
    state.text();
    expect(state.messageId('response')).toBe('response');
    expect(state.hasReasoning).toBe(true);
  });

  it('advances only once for a text segment followed by multiple tool events', () => {
    const state = new AssistantMessageState();
    state.reasoning();
    state.text();
    state.tool();
    state.tool();
    expect(state.messageId('response')).toBe('response-1');
  });

  it('does not create phantom assistant messages for tool-only turns', () => {
    const state = new AssistantMessageState();
    state.tool();
    state.tool();
    expect(state.messageId('response')).toBe('response');
  });

  it('keeps adjacent assistant text blocks on the same message', () => {
    const state = new AssistantMessageState();
    state.text();
    const first = state.messageId('response');
    state.text();
    expect(state.messageId('response')).toBe(first);
  });

  it('does not count empty or whitespace-only reasoning as a message before tools', () => {
    const state = new AssistantMessageState();
    state.reasoning('  ');
    state.tool();
    expect(state.messageId('response')).toBe('response');
  });

  it('resets all state for a new SDK step', () => {
    const state = new AssistantMessageState();
    state.reasoning();
    state.tool();
    state.text();
    state.reset();
    state.tool();
    expect(state.index).toBe(0);
    expect(state.hasReasoning).toBe(false);
  });
});

describe('stream step completion ordering', () => {
  it('accepts results before the consumer drains delayed text chunks', async () => {
    const queue = new StepResultQueue<string>();
    const state = new AssistantMessageState();
    state.reasoning();
    queue.push('step-complete');
    state.tool();
    expect(state.messageId('response')).toBe('response-1');
    state.text();
    expect(await queue.next()).toBe('step-complete');
    state.reset();
    expect(state.index).toBe(0);
  });

  it('waits when finish-step arrives before the SDK callback', async () => {
    const queue = new StepResultQueue<string>();
    const result = queue.next();
    queue.push('step-complete');
    await expect(result).resolves.toBe('step-complete');
  });

  it('preserves ordering across multiple buffered steps', async () => {
    const queue = new StepResultQueue<string>();
    queue.push('first');
    queue.push('second');
    expect(await queue.next()).toBe('first');
    expect(await queue.next()).toBe('second');
  });
});

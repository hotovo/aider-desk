import { describe, it, expect } from 'vitest';
import { AssistantGroupMessage, Message, ResponseMessage, ToolMessage } from '@common/types';

import { areMessagesEqual, groupAssistantMessages, groupMessagesByPromptContext, includeMessageProperty } from '../utils';

const createUserMessage = (id: string, content = 'hello'): Message =>
  ({
    id,
    type: 'user',
    content,
    timestamp: '2026-01-01T00:00:00.000Z',
  }) as unknown as Message;

const createResponseMessage = (id: string): ResponseMessage =>
  ({
    id,
    type: 'response',
    content: 'response',
    timestamp: '2026-01-01T00:00:01.000Z',
  }) as unknown as ResponseMessage;

const createToolMessage = (id: string): ToolMessage =>
  ({
    id,
    type: 'tool',
    content: 'tool',
    timestamp: '2026-01-01T00:00:02.000Z',
  }) as unknown as ToolMessage;

describe('groupMessagesByPromptContext', () => {
  it('returns unique ids even when the input contains duplicate message ids', () => {
    const duplicated = createUserMessage('msg-1');
    const messages = [duplicated, createUserMessage('msg-2'), { ...duplicated }];

    const result = groupMessagesByPromptContext(messages);

    const ids = result.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps original ids unchanged when there are no duplicates', () => {
    const messages = [createUserMessage('msg-1'), createUserMessage('msg-2')];

    const result = groupMessagesByPromptContext(messages);

    expect(result.map((message) => message.id)).toEqual(['msg-1', 'msg-2']);
    expect(result[0]).toBe(messages[0]);
  });

  it('does not collide a group id with a message id sharing the same value', () => {
    const grouped: Message = {
      ...createUserMessage('shared-id'),
      promptContext: { group: { id: 'shared-id', name: 'group', finished: false } },
    } as unknown as Message;
    const plain = createUserMessage('shared-id');

    const result = groupMessagesByPromptContext([grouped, plain]);

    const ids = result.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('groupAssistantMessages', () => {
  it('keeps ids unique when a response message id appears twice', () => {
    const response = createResponseMessage('resp-1');
    const messages = [response, createToolMessage('tool-1'), { ...response }];

    const result = groupAssistantMessages(messages);

    const ids = result.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('tool-only assistant groups', () => {
  it('groups tools after a user prompt without creating a response', () => {
    const user = createUserMessage('user');
    const tools = [createToolMessage('tool-1'), createToolMessage('tool-2')];

    expect(groupAssistantMessages([user, ...tools])).toEqual([user, { id: 'tool-1', type: 'assistant-group', content: '', toolMessages: tools }]);
  });

  it('keeps a stable id as a leading tool group grows', () => {
    const tools = [createToolMessage('tool-1'), createToolMessage('tool-2')];

    expect(groupAssistantMessages([tools[0]])[0].id).toBe('tool-1');
    expect(groupAssistantMessages(tools)[0].id).toBe('tool-1');
  });

  it('does not group across user messages, responses, or other message types', () => {
    const first = createToolMessage('first');
    const second = createToolMessage('second');
    const response = createResponseMessage('response');
    const afterResponse = createToolMessage('after-response');
    const user = createUserMessage('user');
    const log: Message = { id: 'log', type: 'log', content: 'log' };
    const last = createToolMessage('last');

    expect(groupAssistantMessages([first, user, second, response, afterResponse, log, last])).toEqual([
      { id: first.id, type: 'assistant-group', content: '', toolMessages: [first] },
      user,
      { id: second.id, type: 'assistant-group', content: '', toolMessages: [second] },
      { id: response.id, type: 'assistant-group', content: '', responseMessage: response, toolMessages: [afterResponse] },
      log,
      { id: last.id, type: 'assistant-group', content: '', toolMessages: [last] },
    ]);
  });

  it('preserves standalone responses', () => {
    const response = createResponseMessage('response');
    expect(groupAssistantMessages([response])).toEqual([response]);
  });

  it('keeps ids unique for duplicate tool-only groups', () => {
    const tool = createToolMessage('tool');
    const result = groupAssistantMessages([tool, createUserMessage('user'), { ...tool }]);
    expect(new Set(result.map((message) => message.id)).size).toBe(result.length);
  });

  const group: AssistantGroupMessage = {
    id: 'tools',
    type: 'assistant-group',
    content: '',
    toolMessages: [{ ...createToolMessage('tool'), finished: false }],
  };

  it('only exposes tool-only groups to extensions when all tools finish', () => {
    expect(includeMessageProperty(group)).toBe(false);
    const finished = { ...group, toolMessages: group.toolMessages.map((tool) => ({ ...tool, finished: true })) };
    expect(includeMessageProperty(finished)).toBe(true);
    const pending: AssistantGroupMessage = { ...finished, toolMessages: [...finished.toolMessages, createToolMessage('pending')] };
    expect(includeMessageProperty(pending)).toBe(false);
  });

  it('compares tool-only groups and detects streaming updates or response changes', () => {
    expect(areMessagesEqual(group, { ...group })).toBe(true);
    const updated: AssistantGroupMessage = { ...group, toolMessages: [{ ...group.toolMessages[0], content: 'updated' }] };
    expect(areMessagesEqual(group, updated)).toBe(false);
    const withResponse = { ...group, responseMessage: createResponseMessage('response') };
    expect(areMessagesEqual(group, withResponse)).toBe(false);
    expect(areMessagesEqual(withResponse, group)).toBe(false);
  });
});

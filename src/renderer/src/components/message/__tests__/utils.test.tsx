import { describe, it, expect } from 'vitest';
import { Message, ResponseMessage, ToolMessage } from '@common/types';

import { groupAssistantMessages, groupMessagesByPromptContext } from '../utils';

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

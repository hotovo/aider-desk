import { describe, expect, expectTypeOf, it } from 'vitest';

import type { ApplyCacheControlEvent } from '@common/extensions';
import type { ContextMessage, ProviderOptions } from '@common/types';

const messages: ContextMessage[] = [
  {
    id: 'user',
    role: 'user',
    content: [
      { type: 'text', text: 'hello' },
      { type: 'image', image: 'aGVsbG8=' },
      { type: 'file', data: 'aGVsbG8=', mediaType: 'image/png' },
    ],
  },
  {
    id: 'assistant',
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'thinking' },
      { type: 'tool-call', toolCallId: 'call', toolName: 'test', input: {} },
    ],
  },
  {
    id: 'tool',
    role: 'tool',
    content: [{ type: 'tool-result', toolCallId: 'call', toolName: 'test', output: { type: 'text', value: 'done' } }],
  },
];

const providerOptions: ProviderOptions = { anthropic: { cacheControl: { type: 'ephemeral' } } };

const annotateMessages = (event: ApplyCacheControlEvent) => {
  for (const message of event.messages) {
    expectTypeOf(message.providerOptions).toEqualTypeOf<ProviderOptions | undefined>();
    message.providerOptions = providerOptions;
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        expectTypeOf(part.providerOptions).toEqualTypeOf<ProviderOptions | undefined>();
        part.providerOptions = providerOptions;
      }
    }
  }
};

const clearCacheMarkers = (event: ApplyCacheControlEvent) => {
  for (const message of event.messages) {
    delete message.providerOptions;
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        delete part.providerOptions;
      }
    }
  }
};

describe('cache-control event provider options', () => {
  it('supports typed inspection, modification and removal on every message and content-part type', () => {
    const event: ApplyCacheControlEvent = { originalMessages: structuredClone(messages), messages: structuredClone(messages) };
    annotateMessages(event);
    for (const message of event.messages) {
      expect(message.providerOptions).toEqual(providerOptions);
      if (Array.isArray(message.content)) {
        for (const part of message.content) {
          expect(part.providerOptions).toEqual(providerOptions);
        }
      }
    }
    clearCacheMarkers(event);
    expect(event.messages).toEqual(messages);
    expect(event.originalMessages).toEqual(messages);
  });
});

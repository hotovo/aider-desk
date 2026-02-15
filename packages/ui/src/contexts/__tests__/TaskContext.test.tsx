/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';

import { Message, ToolMessage } from '@/types/message';

describe('TaskContext - Message Removal Logic', () => {
  describe('Message filtering after removal event', () => {
    it('should filter out single tool message', () => {
      const messages: Message[] = [
        { id: 'assistant-1', type: 'response', content: 'Hello' },
        {
          id: 'tool-1',
          type: 'tool',
          serverName: 'test',
          toolName: 'test',
          args: {},
          content: 'success',
        } as ToolMessage,
      ];

      const messageIds = ['tool-1'];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('assistant-1');
    });

    it('should filter out both tool and assistant message (cascade)', () => {
      const messages: Message[] = [
        { id: 'assistant-1', type: 'response', content: 'Tool call response' },
        {
          id: 'tool-1',
          type: 'tool',
          serverName: 'test',
          toolName: 'test',
          args: {},
          content: 'success',
        } as ToolMessage,
      ];

      const messageIds = ['tool-1', 'assistant-1'];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(0);
    });

    it('should filter out one of two tool messages (partial removal)', () => {
      const messages: Message[] = [
        {
          id: 'assistant-1',
          type: 'response',
          content: 'Multiple tool calls',
        },
        { id: 'tool-1', type: 'tool', serverName: 'test', toolName: 'test', args: {}, content: 'ok' } as ToolMessage,
        { id: 'tool-2', type: 'tool', serverName: 'test', toolName: 'test', args: {}, content: 'ok' } as ToolMessage,
      ];

      const messageIds = ['tool-1'];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('assistant-1');
      expect(filtered[1].id).toBe('tool-2');
    });

    it('should filter out multiple messages', () => {
      const messages: Message[] = [
        { id: 'user-1', type: 'user', content: 'Hello' },
        { id: 'assistant-1', type: 'response', content: 'Hi' },
        {
          id: 'tool-1',
          type: 'tool',
          serverName: 'test',
          toolName: 'test',
          args: {},
          content: 'success',
        } as ToolMessage,
        { id: 'assistant-2', type: 'response', content: 'How can I help?' },
      ];

      const messageIds = ['user-1', 'tool-1'];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('assistant-1');
      expect(filtered[1].id).toBe('assistant-2');
    });

    it('should preserve all messages if none match', () => {
      const messages: Message[] = [
        { id: 'assistant-1', type: 'response', content: 'Hello' },
        {
          id: 'tool-1',
          type: 'tool',
          serverName: 'test',
          toolName: 'test',
          args: {},
          content: 'success',
        } as ToolMessage,
      ];

      const messageIds: string[] = [];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(2);
      expect(filtered).toEqual(messages);
    });

    it('should handle empty message array', () => {
      const messages: Message[] = [];
      const messageIds = ['tool-1'];
      const filtered = messages.filter((m) => !messageIds.includes(m.id));

      expect(filtered.length).toBe(0);
    });
  });
});

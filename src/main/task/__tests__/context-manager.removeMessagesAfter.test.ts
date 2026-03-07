/**
 * Tests for the removeMessagesAfter functionality in ContextManager
 * These tests verify "Delete up to here" action - keeping messages up to specified message and removing all after
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextMessage } from '@common/types';

describe('ContextManager - removeMessagesAfter', () => {
  let ContextManager: any;
  let mockTask: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockTask = {
      taskId: 'test-task-id',
      getProjectDir: vi.fn(() => '/test/project'),
    };

    ContextManager = (await import('../context-manager')).ContextManager;
  });

  describe('Basic Message Removal', () => {
    it('should remove all messages after a user message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First message' },
        { id: 'msg-2', role: 'assistant', content: 'Response 1' },
        { id: 'msg-3', role: 'user', content: 'Second message' },
        { id: 'msg-4', role: 'assistant', content: 'Response 2' },
        { id: 'msg-5', role: 'user', content: 'Third message' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);
      expect(messages.map((m: ContextMessage) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);

      expect(removedIds).toHaveLength(2);
      expect(removedIds).toContain('msg-4');
      expect(removedIds).toContain('msg-5');
    });

    it('should remove all messages after an assistant message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First message' },
        { id: 'msg-2', role: 'assistant', content: 'Response 1' },
        { id: 'msg-3', role: 'user', content: 'Second message' },
        { id: 'msg-4', role: 'assistant', content: 'Response 2' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(messages.map((m: ContextMessage) => m.id)).toEqual(['msg-1', 'msg-2']);

      expect(removedIds).toHaveLength(2);
      expect(removedIds).toContain('msg-3');
      expect(removedIds).toContain('msg-4');
    });

    it('should return empty array when removing after last message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First message' },
        { id: 'msg-2', role: 'assistant', content: 'Response' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(removedIds).toHaveLength(0);
    });

    it('should keep only first message when removing after it', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First message' },
        { id: 'msg-2', role: 'assistant', content: 'Response 1' },
        { id: 'msg-3', role: 'user', content: 'Second message' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');

      expect(removedIds).toHaveLength(2);
    });
  });

  describe('Tool Message Handling', () => {
    it('should remove tool messages after specified user message', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will execute the tool' },
            { type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
        { id: 'msg-4', role: 'user', content: 'Next question' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');

      expect(removedIds).toHaveLength(3);
      expect(removedIds).toContain('msg-2');
      expect(removedIds).toContain('msg-3');
      expect(removedIds).toContain('msg-4');
    });

    it('should intelligently slice assistant message when removing after tool message', async () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will execute two tools' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool-1', args: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool-2', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, result: 'Success 1' }],
        },
        {
          id: 'msg-4',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, result: 'Success 2' }],
        },
        { id: 'msg-5', role: 'user', content: 'Next question' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);
      expect(messages.map((m: ContextMessage) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);

      // Assistant message should be intelligently sliced to only include first tool call
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantMessage?.content).toHaveLength(2);
      expect(assistantMessage?.content[0].type).toBe('text');
      expect(assistantMessage?.content[1].type).toBe('tool-call');
      expect(assistantMessage?.content[1].toolCallId).toBe(toolCallId1);

      expect(removedIds).toHaveLength(2);
      expect(removedIds).toContain('msg-4');
      expect(removedIds).toContain('msg-5');
    });

    it('should handle removal after tool message by toolCallId', async () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool-1', args: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool-2', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, result: 'Success 1' }],
        },
        {
          id: 'msg-4',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, result: 'Success 2' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter(toolCallId1);

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);

      // Assistant should be sliced to only include first tool call
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantMessage?.content).toHaveLength(1);
      expect(assistantMessage?.content[0].toolCallId).toBe(toolCallId1);

      expect(removedIds).toHaveLength(1);
      expect(removedIds).toContain('msg-4');
    });

    it('should remove assistant message if it becomes empty after intelligent slicing', async () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'reasoning', reasoning: 'I will call the first tool' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool-1', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, result: 'Success 1' }],
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool-2', args: {} }],
        },
        {
          id: 'msg-5',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, result: 'Success 2' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);
      expect(messages.map((m: ContextMessage) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);

      // Assistant message should have reasoning filtered out, keeping only tool call
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantMessage?.content).toHaveLength(1);
      expect(assistantMessage?.content[0].type).toBe('tool-call');

      expect(removedIds).toHaveLength(2);
    });
  });

  describe('Assistant Message with Mixed Content', () => {
    it('should keep text and reasoning and remove tool calls when removing after assistant message', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'reasoning', reasoning: 'I need to think' },
            { type: 'text', text: 'I will call a tool' },
            { type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
        { id: 'msg-4', role: 'user', content: 'Next question' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      // Assistant message should have tool calls filtered out, keeping text and reasoning
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantMessage?.content).toHaveLength(2);
      expect(assistantMessage?.content[0].type).toBe('reasoning');
      expect(assistantMessage?.content[1].type).toBe('text');

      expect(removedIds).toHaveLength(2);
    });

    it('should keep assistant message as-is when it has no tool calls', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Question' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'reasoning', reasoning: 'Let me think' },
            { type: 'text', text: 'Here is the answer' },
          ],
        },
        { id: 'msg-3', role: 'user', content: 'Follow-up' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      // Assistant message should remain unchanged
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantMessage?.content).toHaveLength(2);
      expect(assistantMessage?.content[0].type).toBe('reasoning');
      expect(assistantMessage?.content[1].type).toBe('text');

      expect(removedIds).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when message ID does not exist', () => {
      const initialMessages = [{ id: 'msg-1', role: 'user', content: 'Hello' }];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.removeMessagesAfter('non-existent-id')).toThrow();
    });

    it('should not modify messages array when error is thrown', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Response' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const originalCount = (await manager.getContextMessages()).length;

      expect(() => manager.removeMessagesAfter('non-existent-id')).toThrow();
      expect((await manager.getContextMessages()).length).toBe(originalCount);
    });
  });

  describe('Autosave Verification', () => {
    it('should call autosave after removing messages', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi' },
        { id: 'msg-3', role: 'user', content: 'How are you?' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessagesAfter('msg-1');

      expect(autosaveSpy).toHaveBeenCalled();
    });

    it('should not call autosave when no messages are removed', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessagesAfter('msg-2');

      expect(autosaveSpy).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty messages array', () => {
      const initialMessages = [];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.removeMessagesAfter('msg-1')).toThrow();
    });

    it('should handle single message array', async () => {
      const initialMessages = [{ id: 'msg-1', role: 'user', content: 'Only message' }];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessagesAfter('msg-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(removedIds).toHaveLength(0);
    });

    it('should preserve message clones to avoid reference issues', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Response' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'tool', args: {} },
          ],
        },
        { id: 'msg-3', role: 'user', content: 'Third' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessagesAfter('msg-2');

      const messages = await manager.getContextMessages();
      const assistantMessage = messages.find((m: ContextMessage) => m.id === 'msg-2');

      // Modify the returned message
      if (Array.isArray(assistantMessage?.content)) {
        assistantMessage.content.push({ type: 'text', text: 'Modified' });
      }

      // Original internal messages should not be affected
      const messagesAgain = await manager.getContextMessages();
      const assistantAgain = messagesAgain.find((m: ContextMessage) => m.id === 'msg-2');
      expect(assistantAgain?.content).toHaveLength(1);
    });
  });
});

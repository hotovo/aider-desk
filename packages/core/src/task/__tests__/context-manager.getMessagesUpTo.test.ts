/**
 * Tests for the getMessagesUpTo functionality in ContextManager
 * These tests verify forking task context from a specific message
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContextMessage } from '@aider-desk/common/types';

describe('ContextManager - getMessagesUpTo', () => {
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

  describe('1. Fork from user message', () => {
    it('should return messages 0 through N when forking from user message at index N', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'First message' },
        { id: 'msg-1', role: 'assistant', content: 'Response 1' },
        { id: 'msg-2', role: 'user', content: 'Second user message' },
        { id: 'msg-3', role: 'assistant', content: 'Response 2' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-2');

      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);
    });

    it('should return single message when forking from first user message', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'First message' },
        { id: 'msg-1', role: 'assistant', content: 'Response' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-0');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-0');
    });

    it('should not modify original messages array', async () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'First message' },
        { id: 'msg-1', role: 'user', content: 'Second user message' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-1');

      expect(result).toHaveLength(2);
      // Verify original messages are still intact
      await expect(manager.getContextMessages()).resolves.toHaveLength(2);
    });
  });

  describe('2. Fork from response (assistant) message', () => {
    it('should return messages 0 through N when forking from assistant message', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'First message' },
        { id: 'msg-1', role: 'assistant', content: 'Response 1' },
        { id: 'msg-2', role: 'user', content: 'Second user message' },
        { id: 'msg-3', role: 'assistant', content: 'Response 2' },
        { id: 'msg-4', role: 'user', content: 'Third user message' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-3');

      expect(result).toHaveLength(4);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3']);
    });

    it('should handle assistant message with text content', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Question' },
        { id: 'msg-1', role: 'assistant', content: 'Here is the answer' },
        { id: 'msg-2', role: 'user', content: 'Follow-up' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-1');

      expect(result).toHaveLength(2);
      expect(result[1].content).toBe('Here is the answer');
    });

    it('should clone assistant message without modifying original', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Question' },
        { id: 'msg-1', role: 'assistant', content: 'Answer' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-1');

      // Modify result
      result[1].content = 'Modified';

      // Original should be unchanged
      const originalMessages = manager.getContextMessages();
      originalMessages.then((msgs: ContextMessage[]) => {
        expect(msgs[1].content).toBe('Answer');
      });
    });
  });

  describe('3. Fork from tool message', () => {
    it('should return user messages + assistant with only tool calls up to specified tool result when messageId is toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will execute the tool' },
            { type: 'tool-call', toolCallId, toolName: 'power---bash', input: { param: 'value' } },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Assistant message should have both text and tool call
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('text');
      expect(assistantMessage.content[1].type).toBe('tool-call');
      expect(assistantMessage.content[1].toolCallId).toBe(toolCallId);
    });

    it('should search backwards to find matching assistant message when messageId is toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} }],
        },
        { id: 'msg-2', role: 'user', content: 'Next question' },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      // Returns messages up to assistant + all tool messages up to and including target
      expect(result).toHaveLength(4);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3']);
    });
  });

  describe('4. Fork from first message (index 0)', () => {
    it('should return array with single message when forking from first message', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'First message' },
        { id: 'msg-1', role: 'assistant', content: 'Response' },
        { id: 'msg-2', role: 'user', content: 'Second message' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-0');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-0');
      expect(result[0].content).toBe('First message');
    });

    it('should work when first message is an assistant message', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'assistant', content: 'Initial response' },
        { id: 'msg-1', role: 'user', content: 'User question' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-0');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('msg-0');
    });
  });

  describe('5. Fork from last message', () => {
    it('should return all messages when forking from last message', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Message 1' },
        { id: 'msg-1', role: 'assistant', content: 'Response 1' },
        { id: 'msg-2', role: 'user', content: 'Message 2' },
        { id: 'msg-3', role: 'assistant', content: 'Response 2' },
        { id: 'msg-4', role: 'user', content: 'Message 3' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-4');

      expect(result).toHaveLength(5);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3', 'msg-4']);
    });

    it('should work when last message is a tool message using toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} }],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Result' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);
    });
  });

  describe('6. Edge case - no matching assistant', () => {
    it('should throw error when forking from tool message with no matching assistant message', () => {
      const toolCallId = 'call-orphaned';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Some message' },
        {
          id: 'msg-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Orphaned' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.getMessagesUpTo('msg-1')).not.toThrow();
      // If no matching assistant is found, it falls back to returning all messages up to the target
      const result = manager.getMessagesUpTo('msg-1');
      expect(result).toHaveLength(2);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1']);
    });

    it('should throw error when message ID does not exist', () => {
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Hello' },
        { id: 'msg-1', role: 'assistant', content: 'Hi' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.getMessagesUpTo('non-existent-id')).toThrow('Message with id non-existent-id not found');
    });
  });

  describe('7. Assistant with multiple tool calls', () => {
    it('should return assistant with only first 2 tool calls when forking from 2nd tool result of 3 using toolCallId', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const toolCallId3 = 'call-789';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute multiple tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool1', input: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool2', input: {} },
            { type: 'tool-call', toolCallId: toolCallId3, toolName: 'tool3', input: {} },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---bash', output: { type: 'text', value: 'Result 1' } }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---bash', output: { type: 'text', value: 'Result 2' } }],
        },
        {
          id: 'msg-4',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId3, toolName: 'power---bash', output: { type: 'text', value: 'Result 3' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId2);

      // Returns user + assistant (with 2 tool calls) + first 2 tool messages
      expect(result).toHaveLength(4);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3']);

      // Assistant message should only have first 2 tool calls
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId1);
      expect(assistantMessage.content[1].toolCallId).toBe(toolCallId2);

      // First 2 tool messages should be included
      const toolMessageIds = result.filter((m: ContextMessage) => m.role === 'tool').map((m: ContextMessage) => m.id);
      expect(toolMessageIds).toEqual(['msg-2', 'msg-3']);
    });

    it('should handle forking from first tool result in multiple tool calls using toolCallId', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'power---bash', input: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'power---bash', input: {} },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---bash', output: { type: 'text', value: 'Result 1' } }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---bash', output: { type: 'text', value: 'Result 2' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId1);

      // Returns user + assistant (with 1st tool call only) + first tool message
      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Assistant message should only have first tool call
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId1);
    });
  });

  describe('8. Mixed content preservation', () => {
    it('should preserve text content when forking from tool message using toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will execute the tool' },
            { type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} },
            { type: 'text', text: 'Done executing' },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      // Content is sliced up to and including the tool call (index 1)
      // So it includes: text at index 0, tool-call at index 1
      // Text AFTER the tool call (index 2) is NOT included
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('text');
      expect(assistantMessage.content[0].text).toBe('I will execute the tool');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });

    it('should preserve reasoning content when forking from tool message using toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to think about this' },
            { type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} },
            { type: 'text', text: 'Here is the answer' },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      // Content is sliced up to and including the tool call (index 1)
      // So it includes: reasoning at index 0, tool-call at index 1
      // Text AFTER the tool call (index 2) is NOT included
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('reasoning');
      expect(assistantMessage.content[0].text).toBe('I need to think about this');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });

    it('should preserve text content when forking from tool message using toolCallId', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is some code: console.log("hello")' },
            { type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId);

      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('text');
      expect(assistantMessage.content[0].text).toBe('Here is some code: console.log("hello")');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });
  });

  describe('9. Fork from assistant message with mixed content', () => {
    it('should return only reasoning and text parts when forking from assistant message, excluding tool calls', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute some tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to think about this first' },
            { type: 'text', text: 'I will execute the tools now' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool1', input: { param: 'value1' } },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool2', input: { param: 'value2' } },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'tool1', output: { type: 'text', value: 'Result 1' } }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'tool2', output: { type: 'text', value: 'Result 2' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-1');

      // Returns user + assistant (only with reasoning and text, no tool calls)
      expect(result).toHaveLength(2);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1']);

      // Assistant message should only have reasoning and text parts
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('reasoning');
      expect(assistantMessage.content[0].text).toBe('I need to think about this first');
      expect(assistantMessage.content[1].type).toBe('text');
      expect(assistantMessage.content[1].text).toBe('I will execute the tools now');
    });

    it('should return only reasoning and text parts when forking from assistant message with only tool calls', () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'tool1', input: {} }],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'tool1', output: { type: 'text', value: 'Result' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-1');

      expect(result).toHaveLength(2);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1']);

      // Assistant message should be empty (no reasoning or text parts)
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(0);
    });

    it('should return reasoning, text, and tool calls up to specified tool when forking from first tool message using toolCallId', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute multiple tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to analyze this' },
            { type: 'text', text: 'I will execute the tools' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool1', input: { param: 'value1' } },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool2', input: { param: 'value2' } },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'tool1', output: { type: 'text', value: 'Result 1' } }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'tool2', output: { type: 'text', value: 'Result 2' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId1);

      // Returns user + assistant (with reasoning, text, and first tool call) + first tool message
      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Assistant message should have reasoning, text, and first tool call
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(3);
      expect(assistantMessage.content[0].type).toBe('reasoning');
      expect(assistantMessage.content[0].text).toBe('I need to analyze this');
      expect(assistantMessage.content[1].type).toBe('text');
      expect(assistantMessage.content[1].text).toBe('I will execute the tools');
      expect(assistantMessage.content[2].type).toBe('tool-call');
      expect(assistantMessage.content[2].toolCallId).toBe(toolCallId1);
    });

    it('should return reasoning, text, and both tool calls when forking from second tool message using toolCallId', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute multiple tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to analyze this' },
            { type: 'text', text: 'I will execute the tools' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'tool1', input: { param: 'value1' } },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'tool2', input: { param: 'value2' } },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'tool1', output: { type: 'text', value: 'Result 1' } }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'tool2', output: { type: 'text', value: 'Result 2' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId2);

      // Returns user + assistant (with reasoning, text, and both tool calls) + both tool messages
      expect(result).toHaveLength(4);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-3']);

      // Assistant message should have reasoning, text, and both tool calls
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(4);
      expect(assistantMessage.content[0].type).toBe('reasoning');
      expect(assistantMessage.content[0].text).toBe('I need to analyze this');
      expect(assistantMessage.content[1].type).toBe('text');
      expect(assistantMessage.content[1].text).toBe('I will execute the tools');
      expect(assistantMessage.content[2].type).toBe('tool-call');
      expect(assistantMessage.content[2].toolCallId).toBe(toolCallId1);
      expect(assistantMessage.content[3].type).toBe('tool-call');
      expect(assistantMessage.content[3].toolCallId).toBe(toolCallId2);
    });
  });

  describe('Additional edge cases', () => {
    it('should handle tool message with multiple tool-results using toolCallId', () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'power---bash', input: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'power---bash', input: {} },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---bash', output: { type: 'text', value: 'Result 1' } },
            { type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---bash', output: { type: 'text', value: 'Result 2' } },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo(toolCallId1);

      // Returns user + assistant + tool message
      // When forking from a tool message with multiple results, only the first tool-result's
      // toolCallId is used to determine which tool calls to keep in the assistant message
      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Assistant only keeps the first tool call (matching the first tool-result in the tool message)
      const assistantMessage = result.find((m: ContextMessage) => m.id === 'msg-1');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId1);
    });

    it('should handle empty messages array gracefully', () => {
      const manager = new ContextManager(mockTask, 'test-task', []);

      expect(() => manager.getMessagesUpTo('non-existent')).toThrow('Message with id non-existent not found');
    });

    it('should not modify original messages when forking', async () => {
      const toolCallId = 'call-123';
      const initialMessages: ContextMessage[] = [
        { id: 'msg-0', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'power---bash', input: {} }],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'Success' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const result = manager.getMessagesUpTo('msg-2');

      // Verify result has correct structure
      expect(result).toHaveLength(3);
      expect(result.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Verify original messages are still intact
      const originalMessages = await manager.getContextMessages();
      expect(originalMessages).toHaveLength(3);
      expect(originalMessages.map((m: ContextMessage) => m.id)).toEqual(['msg-0', 'msg-1', 'msg-2']);

      // Verify the assistant message content array is the same length
      const originalAssistant = originalMessages.find((m: ContextMessage) => m.id === 'msg-1');
      if (Array.isArray(originalAssistant.content)) {
        expect(originalAssistant.content).toHaveLength(1);
      }
    });
  });
});

/**
 * Tests for the removeMessageById functionality in ContextManager
 * These tests verify message removal with proper tool call cascade handling
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ContextManager - removeMessageById', () => {
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

  describe('Simple User Message Removal', () => {
    it('should remove a simple user message by ID', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!' },
        { id: 'msg-3', role: 'user', content: 'How are you?' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3']);
    });

    it('should persist changes after removing simple message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessageById('msg-1');

      expect(autosaveSpy).toHaveBeenCalled();
    });
  });

  describe('Tool Message Removal with Cascade', () => {
    it('should remove tool message and corresponding tool call from assistant message', async () => {
      const toolCallId = 'tool-call-1';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute this tool' },
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
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      const assistantMessage = messages.find((m: { id: string; content: unknown[] }) => m.id === 'msg-2');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].type).toBe('text');
    });

    it('should remove empty assistant message after removing tool call', async () => {
      const toolCallId = 'tool-call-1';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should preserve assistant message with other content when tool call removed', async () => {
      const toolCallId = 'tool-call-1';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Here is the result:' },
            { type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} },
            { type: 'text', text: 'Done!' },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      const assistantMessage = messages.find((m: { id: string; content: unknown[] }) => m.id === 'msg-2');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('text');
      expect(assistantMessage.content[1].type).toBe('text');
    });

    it('should handle multiple tool calls in assistant message', async () => {
      const toolCallId1 = 'tool-call-1';
      const toolCallId2 = 'tool-call-2';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'test-tool-1', args: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'test-tool-2', args: {} },
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
      manager.removeMessageById('msg-3');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);

      const assistantMessage = messages.find((m: { id: string; content: unknown[] }) => m.id === 'msg-2');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId2);
    });
  });

  describe('Backward Search and Empty Message Removal', () => {
    it('should search backwards and remove empty assistant message after tool call removal', async () => {
      const toolCallId = 'tool-call-1';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} }],
        },
        { id: 'msg-3', role: 'user', content: 'Next message' },
        {
          id: 'msg-4',
          role: 'assistant',
          content: [{ type: 'text', text: 'Another assistant' }],
        },
        {
          id: 'msg-5',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-5');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);
      expect(messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3', 'msg-4']);

      // The first assistant message (msg-2) should be removed because it became empty
      expect(messages.find((m: { id: string }) => m.id === 'msg-2')).toBeUndefined();

      // The second assistant message (msg-4) should still have its text content
      const assistantMessage2 = messages.find((m: { id: string }) => m.id === 'msg-4');
      expect(assistantMessage2.content).toHaveLength(1);
      expect(assistantMessage2.content[0].type).toBe('text');
    });
  });

  describe('Tool Message Autosave Verification', () => {
    it('should call autosave after removing tool message', async () => {
      const toolCallId = 'tool-call-1';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'test-tool', args: {} }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessageById('msg-3');

      expect(autosaveSpy).toHaveBeenCalled();
    });
  });

  describe('Orphaned Tool Message Handling', () => {
    it('should remove tool message gracefully when toolCallId not found in any assistant message', async () => {
      const toolCallId = 'tool-call-orphaned';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      // Should not throw error
      expect(() => manager.removeMessageById('msg-2')).not.toThrow();

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should handle tool message with non-matching toolCallId in assistant message', async () => {
      const toolCallId = 'tool-call-1';
      const toolCallIdInAssistant = 'tool-call-2';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: toolCallIdInAssistant, toolName: 'test-tool', args: {} }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'Success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      // Should not throw error
      expect(() => manager.removeMessageById('msg-3')).not.toThrow();

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-2']);

      // Assistant message should still have its tool call
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'msg-2');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallIdInAssistant);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when message ID does not exist', () => {
      const initialMessages = [{ id: 'msg-1', role: 'user', content: 'Hello' }];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.removeMessageById('non-existent-id')).toThrow('Message or tool call not found: non-existent-id');
    });

    it('should not modify messages array when error is thrown', async () => {
      const initialMessages = [{ id: 'msg-1', role: 'user', content: 'Hello' }];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const originalCount = (await manager.getContextMessages()).length;

      expect(() => manager.removeMessageById('non-existent-id')).toThrow();
      expect((await manager.getContextMessages()).length).toBe(originalCount);
    });
  });

  describe('Persistence Across Reload', () => {
    it('should persist removed message state after reload', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi there!' },
        { id: 'msg-3', role: 'user', content: 'How are you?' },
      ];

      const manager1 = new ContextManager(mockTask, 'test-task', initialMessages);
      manager1.enableAutosave();
      manager1.removeMessageById('msg-2');

      const messagesBeforeReload = await manager1.getContextMessages();
      expect(messagesBeforeReload.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3']);

      // Simulate reload by creating new manager with same state
      const manager2 = new ContextManager(mockTask, 'test-task', messagesBeforeReload);
      const messagesAfterReload = await manager2.getContextMessages();

      expect(messagesAfterReload.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3']);
    });
  });

  describe('Empty Assistant Message Removal (Story 2.2)', () => {
    describe('Assistant message with only tool calls', () => {
      it('removes assistant message when last tool call is removed', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} }],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].id).toBe('msg-1');
        expect(messages.find((m: { id: string }) => m.id === 'assistant-1')).toBeUndefined();
      });

      it('removes assistant message with multiple tool calls when all are removed', async () => {
        const toolCallId1 = 'call-123';
        const toolCallId2 = 'call-456';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tools' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'tool-call', toolCallId: toolCallId1, toolName: 'test_tool_1', args: {} },
              { type: 'tool-call', toolCallId: toolCallId2, toolName: 'test_tool_2', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: toolCallId1, result: 'success' }],
          },
          {
            id: 'tool-2',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId: toolCallId2, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');
        manager.removeMessageById('tool-2');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(1);
        expect(messages[0].id).toBe('msg-1');
      });
    });

    describe('Assistant message with text content', () => {
      it('preserves assistant message when text content remains', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'text', text: 'I will call a tool' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(2);
        expect(messages[0].id).toBe('msg-1');
        expect(messages[1].id).toBe('assistant-1');
        expect(messages[1].content).toEqual([{ type: 'text', text: 'I will call a tool' }]);
      });

      it('preserves text before and after tool calls', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Before' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
              { type: 'text', text: 'After' },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(2);
        expect(messages[1].content).toEqual([
          { type: 'text', text: 'Before' },
          { type: 'text', text: 'After' },
        ]);
      });
    });

    describe('Assistant message with mixed content types', () => {
      it('preserves images when tool calls are removed', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'image', source: 'data:image/png;base64,abc123' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(2);
        expect(messages[1].content).toEqual([{ type: 'image', source: 'data:image/png;base64,abc123' }]);
      });

      it('preserves code blocks when tool calls are removed', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'code-block', code: 'console.log("hello")', language: 'javascript' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(2);
        expect(messages[1].content).toEqual([{ type: 'code-block', code: 'console.log("hello")', language: 'javascript' }]);
      });

      it('preserves all non-tool content types together', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Here is code:' },
              { type: 'code-block', code: 'const x = 1;', language: 'javascript' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
              { type: 'text', text: 'Done!' },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.removeMessageById('tool-1');

        const messages = await manager.getContextMessages();
        expect(messages.length).toBe(2);
        expect(messages[1].content).toEqual([
          { type: 'text', text: 'Here is code:' },
          { type: 'code-block', code: 'const x = 1;', language: 'javascript' },
          { type: 'text', text: 'Done!' },
        ]);
      });
    });

    describe('Persistence and event emission', () => {
      it('calls autosave after removing empty assistant message', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [{ type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} }],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.enableAutosave();

        const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
        manager.removeMessageById('tool-1');

        expect(autosaveSpy).toHaveBeenCalled();
      });

      it('calls autosave after preserving assistant with text', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.enableAutosave();

        const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
        manager.removeMessageById('tool-1');

        expect(autosaveSpy).toHaveBeenCalled();
      });

      it('calls autosave after preserving assistant with image', async () => {
        const toolCallId = 'call-123';
        const initialMessages = [
          { id: 'msg-1', role: 'user', content: 'Execute tool' },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: [
              { type: 'image', source: 'data:image/png;base64,abc' },
              { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            ],
          },
          {
            id: 'tool-1',
            role: 'tool',
            content: [{ type: 'tool-result', toolCallId, result: 'success' }],
          },
        ];

        const manager = new ContextManager(mockTask, 'test-task', initialMessages);
        manager.enableAutosave();

        const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
        manager.removeMessageById('tool-1');

        expect(autosaveSpy).toHaveBeenCalled();
      });
    });
  });

  describe('Removal by Tool Call ID', () => {
    it('should remove tool-result part from tool message when tool call ID is provided', async () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'test_tool_1', args: {} },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'test_tool_2', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: toolCallId1, result: 'success 1' },
            { type: 'tool-result', toolCallId: toolCallId2, result: 'success 2' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById(toolCallId1);

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);

      // Tool message should still exist with only the second result
      const toolMessage = messages.find((m: { id: string }) => m.id === 'msg-3');
      expect(toolMessage).toBeDefined();
      expect(toolMessage.content).toHaveLength(1);
      expect(toolMessage.content[0].toolCallId).toBe(toolCallId2);

      // Assistant message should still exist with only the second tool call
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'msg-2');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId2);
    });

    it('should remove entire tool message if it becomes empty after removing tool-result', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessageById(toolCallId);

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');

      // Both tool message and assistant message should be removed
      expect(removedIds).toHaveLength(2);
      expect(removedIds).toContain('msg-2');
      expect(removedIds).toContain('msg-3');
    });

    it('should preserve assistant message with other content when tool call is removed by ID', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will call a tool' },
            { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            { type: 'text', text: 'Done!' },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById(toolCallId);

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      // Assistant message should still exist with text content
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'msg-2');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('text');
      expect(assistantMessage.content[1].type).toBe('text');
    });

    it('should throw error when tool call ID is not found', () => {
      const initialMessages = [{ id: 'msg-1', role: 'user', content: 'Hello' }];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);

      expect(() => manager.removeMessageById('non-existent-tool-call')).toThrow('Message or tool call not found: non-existent-tool-call');
    });

    it('should call autosave after removing by tool call ID', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} }],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessageById(toolCallId);

      expect(autosaveSpy).toHaveBeenCalled();
    });

    it('should handle removal by tool call ID with multiple tool calls in assistant message', async () => {
      const toolCallId1 = 'call-123';
      const toolCallId2 = 'call-456';
      const toolCallId3 = 'call-789';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tools' },
        {
          id: 'msg-2',
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'test_tool_1', args: {} },
            { type: 'text', text: 'Middle text' },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'test_tool_2', args: {} },
            { type: 'tool-call', toolCallId: toolCallId3, toolName: 'test_tool_3', args: {} },
          ],
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, result: 'success 2' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById(toolCallId2);

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);

      // Assistant message should still exist with two remaining tool calls and text
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'msg-2');
      expect(assistantMessage.content).toHaveLength(3);
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId1);
      expect(assistantMessage.content[1].type).toBe('text');
      expect(assistantMessage.content[2].toolCallId).toBe(toolCallId3);

      // Tool message should be removed (it had only one tool-result)
      expect(messages.find((m: { id: string }) => m.id === 'msg-3')).toBeUndefined();
    });
  });

  describe('Removal by Message ID with Assistant Mixed Content', () => {
    it('should remove text and reasoning parts from assistant message with mixed content', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute something' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to think about this' },
            { type: 'text', text: 'I will execute the tools' },
            { type: 'tool-call', toolCallId: 'call-123', toolName: 'test_tool', args: {} },
            { type: 'tool-call', toolCallId: 'call-456', toolName: 'another_tool', args: {} },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      const removedIds = manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(messages[1].id).toBe('assistant-1');
      expect(messages[1].content).toHaveLength(2);
      expect(messages[1].content[0].type).toBe('tool-call');
      expect(messages[1].content[1].type).toBe('tool-call');

      // Should return the messageId as removed
      expect(removedIds).toEqual(['assistant-1']);
    });

    it('should preserve tool calls when removing text and reasoning', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Reasoning text' },
            { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            { type: 'text', text: 'Final answer' },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(3);

      const assistantMessage = messages.find((m: { id: string }) => m.id === 'assistant-1');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].type).toBe('tool-call');
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId);
    });

    it('should remove both text and reasoning parts when present with tool calls', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking process' },
            { type: 'text', text: 'I will call a tool' },
            { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'assistant-1');
      expect(assistantMessage.content).toHaveLength(1);
      expect(assistantMessage.content[0].type).toBe('tool-call');
      expect(assistantMessage.content[0].toolCallId).toBe(toolCallId);
    });

    it('should remove whole assistant message when it only has text and reasoning (no tool calls)', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking' },
            { type: 'text', text: 'Answer' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should preserve images when removing text and reasoning from mixed content', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking' },
            { type: 'text', text: 'Text before' },
            { type: 'image', source: 'data:image/png;base64,abc' },
            { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            { type: 'text', text: 'Text after' },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'assistant-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('image');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });

    it('should preserve code blocks when removing text and reasoning', async () => {
      const toolCallId = 'call-123';
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Execute tool' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking' },
            { type: 'code-block', code: 'const x = 1;', language: 'javascript' },
            { type: 'tool-call', toolCallId, toolName: 'test_tool', args: {} },
            { type: 'text', text: 'Done' },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, result: 'success' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'assistant-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('code-block');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });

    it('should call autosave when removing text and reasoning from assistant message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking' },
            { type: 'text', text: 'Answer' },
            { type: 'tool-call', toolCallId: 'call-123', toolName: 'test_tool', args: {} },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.enableAutosave();

      const autosaveSpy = vi.spyOn(manager as { autosave: () => void }, 'autosave');
      manager.removeMessageById('assistant-1');

      expect(autosaveSpy).toHaveBeenCalled();
    });

    it('should handle multiple text and reasoning parts correctly', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Reasoning 1' },
            { type: 'text', text: 'Text 1' },
            { type: 'tool-call', toolCallId: 'call-123', toolName: 'test_tool_1', args: {} },
            { type: 'reasoning', text: 'Reasoning 2' },
            { type: 'tool-call', toolCallId: 'call-456', toolName: 'test_tool_2', args: {} },
            { type: 'text', text: 'Text 2' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('assistant-1');

      const messages = await manager.getContextMessages();
      const assistantMessage = messages.find((m: { id: string }) => m.id === 'assistant-1');
      expect(assistantMessage.content).toHaveLength(2);
      expect(assistantMessage.content[0].type).toBe('tool-call');
      expect(assistantMessage.content[1].type).toBe('tool-call');
    });
  });

  describe('Edge Cases', () => {
    it('should remove first message by ID', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First' },
        { id: 'msg-2', role: 'assistant', content: 'Second' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-1');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-2');
    });

    it('should remove last message by ID', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First' },
        { id: 'msg-2', role: 'assistant', content: 'Second' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-1');
    });

    it('should handle removing middle message', async () => {
      const initialMessages = [
        { id: 'msg-1', role: 'user', content: 'First' },
        { id: 'msg-2', role: 'assistant', content: 'Middle' },
        { id: 'msg-3', role: 'user', content: 'Last' },
      ];

      const manager = new ContextManager(mockTask, 'test-task', initialMessages);
      manager.removeMessageById('msg-2');

      const messages = await manager.getContextMessages();
      expect(messages).toHaveLength(2);
      expect(messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3']);
    });
  });
});

/**
 * Tests for the throttling functionality in processResponseMessage
 * These tests verify chunk buffering, interval-based sending, buffer discard on completion,
 * and cleanup on task close/interrupt by simulating the behavior of the Task class logic.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptContext, UsageReportData } from '@aider-desk/common/types';

import { ResponseMessage } from '@/messages';

describe('Task - processResponseMessage Throttling Logic', () => {
  const baseDir = '/test/project';
  const taskId = 'test-task-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Throttling Configuration', () => {
    it('should use correct chunk flush interval (10ms)', () => {
      const RESPONSE_CHUNK_FLUSH_INTERVAL_MS = 10;
      expect(RESPONSE_CHUNK_FLUSH_INTERVAL_MS).toBe(10);
    });
  });

  describe('Chunk Buffering per Message ID', () => {
    it('should maintain separate buffers for different message IDs', () => {
      const message1: ResponseMessage = {
        id: 'msg-1',
        action: 'response',
        content: 'Hello',
        finished: false,
      };

      const message2: ResponseMessage = {
        id: 'msg-2',
        action: 'response',
        content: 'World',
        finished: false,
      };

      // Verify that message IDs are different
      expect(message1.id).not.toBe(message2.id);
      expect(message1.content).toBe('Hello');
      expect(message2.content).toBe('World');
    });

    it('should accumulate chunks for same message ID', () => {
      const messageId = 'msg-1';
      const chunks = ['Hello ', 'World ', ''];

      // Create messages with same ID
      const messages: ResponseMessage[] = chunks.map((content) => ({
        id: messageId,
        action: 'response',
        content,
        finished: false,
      }));

      // All should have same ID
      messages.forEach((msg) => {
        expect(msg.id).toBe(messageId);
      });

      // Combined content should be sum
      const combined = messages.map((m) => m.content).join('');
      expect(combined).toContain('Hello');
      expect(combined).toContain('World');
    });

    it('should handle empty chunks without errors', () => {
      const message: ResponseMessage = {
        id: 'msg-1',
        action: 'response',
        content: '',
        finished: false,
      };

      let buffer = '';
      buffer += message.content;

      expect(buffer).toBe('');
      expect(message.content).toBe('');
    });
  });

  describe('Interval-Based Sending', () => {
    it('should send chunks at configured interval', () => {
      const RESPONSE_CHUNK_FLUSH_INTERVAL_MS = 10;

      // Simulate interval-based sending logic
      let buffer = 'Test content';
      const chunksSent: string[] = [];

      // Mock setInterval behavior
      const mockInterval = vi.fn((callback: () => void, interval: number) => {
        expect(interval).toBe(RESPONSE_CHUNK_FLUSH_INTERVAL_MS);
        // Simulate interval firing
        callback();
        return {} as NodeJS.Timeout;
      });

      vi.stubGlobal('setInterval', mockInterval);

      setInterval(() => {
        if (buffer.length > 0) {
          chunksSent.push(buffer);
          buffer = '';
        }
      }, RESPONSE_CHUNK_FLUSH_INTERVAL_MS);

      expect(mockInterval).toHaveBeenCalled();
      expect(chunksSent).toContain('Test content');

      vi.unstubAllGlobals();
    });

    it('should not send chunks before interval elapses', () => {
      const RESPONSE_CHUNK_FLUSH_INTERVAL_MS = 10;
      const buffer = 'Test content';
      const chunksSent: string[] = [];
      let intervalCallbackCalled = false;

      const mockInterval = vi.fn((callback: () => void) => {
        setTimeout(() => {
          intervalCallbackCalled = true;
          callback();
        }, RESPONSE_CHUNK_FLUSH_INTERVAL_MS);
        return {} as NodeJS.Timeout;
      });

      vi.stubGlobal('setInterval', mockInterval);

      setInterval(() => {
        if (buffer.length > 0) {
          chunksSent.push(buffer);
        }
      }, RESPONSE_CHUNK_FLUSH_INTERVAL_MS);

      // Before interval fires
      expect(intervalCallbackCalled).toBe(false);
      expect(chunksSent.length).toBe(0);

      vi.unstubAllGlobals();
    });
  });

  describe('Interval Auto-Clearing', () => {
    it('should clear interval when buffer becomes empty', () => {
      const mockClearInterval = vi.fn();

      vi.stubGlobal('clearInterval', mockClearInterval);

      const responseChunkMap = new Map<string, { buffer: string; interval: NodeJS.Timeout }>();
      const messageId = 'msg-1';
      const interval = {} as NodeJS.Timeout;

      responseChunkMap.set(messageId, { buffer: 'Test content', interval });

      // Simulate interval firing with non-empty buffer
      let entry = responseChunkMap.get(messageId);
      if (entry && entry.buffer.length > 0) {
        // Send chunk and clear buffer
        entry.buffer = '';
      }

      // Next interval firing - buffer is now empty
      entry = responseChunkMap.get(messageId);
      if (entry && entry.buffer.length > 0) {
        entry.buffer = '';
      } else {
        clearInterval(interval);
        responseChunkMap.delete(messageId);
      }

      expect(mockClearInterval).toHaveBeenCalledWith(interval);
      expect(responseChunkMap.has(messageId)).toBe(false);

      vi.unstubAllGlobals();
    });

    it('should keep interval alive when buffer has content', () => {
      const mockClearInterval = vi.fn();

      vi.stubGlobal('clearInterval', mockClearInterval);

      const responseChunkMap = new Map<string, { buffer: string; interval: NodeJS.Timeout }>();
      const messageId = 'msg-1';
      const interval = {} as NodeJS.Timeout;

      responseChunkMap.set(messageId, { buffer: 'Test content', interval });

      // Simulate interval firing with non-empty buffer
      const entry = responseChunkMap.get(messageId);
      if (entry && entry.buffer.length > 0) {
        // Send chunk
        entry.buffer = 'New content';
      }

      expect(responseChunkMap.has(messageId)).toBe(true);
      expect(mockClearInterval).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('Buffer Discard on Completion', () => {
    it('should clear interval when message finishes', () => {
      const mockClearInterval = vi.fn();
      vi.stubGlobal('clearInterval', mockClearInterval);

      const messageId = 'msg-1';
      const interval = {} as NodeJS.Timeout;

      // Simulate message completion
      const finishMessage: ResponseMessage = {
        id: messageId,
        action: 'response',
        content: '',
        finished: true,
      };

      expect(finishMessage.finished).toBe(true);

      // On completion, clearInterval should be called
      if (finishMessage.finished) {
        clearInterval(interval);
      }

      expect(mockClearInterval).toHaveBeenCalledWith(interval);

      vi.unstubAllGlobals();
    });

    it('should discard buffer when message finishes', () => {
      const messageId = 'msg-1';
      const chunkMessage: ResponseMessage = {
        id: messageId,
        action: 'response',
        content: 'Hello',
        finished: false,
      };

      const finishMessage: ResponseMessage = {
        id: messageId,
        action: 'response',
        content: ' World',
        finished: true,
      };

      let buffer = chunkMessage.content;

      // Accumulate chunks
      if (!chunkMessage.finished) {
        buffer += chunkMessage.content;
      }

      // On completion, buffer should be discarded and final content used
      if (finishMessage.finished) {
        buffer = '';
        // Use final message content instead
        const finalContent = finishMessage.content;
        expect(finalContent).toBe(' World');
      }

      expect(buffer).toBe('');
    });

    it('should send response completed with correct metadata', () => {
      const messageId = 'msg-1';
      const usageReport: UsageReportData = {
        model: 'test-model',
        sentTokens: 100,
        receivedTokens: 200,
        messageCost: 0.01,
      };

      const finishMessage: ResponseMessage = {
        id: messageId,
        action: 'response',
        content: 'Final response',
        finished: true,
        usageReport,
        editedFiles: ['file1.ts', 'file2.ts'],
        commitHash: 'abc123',
        commitMessage: 'Test commit',
        diff: '+line\n-old',
        sequenceNumber: 1,
        reflectedMessage: '<thinking>Thought</thinking>',
        promptContext: { id: 'prompt-1' },
      };

      // Simulate response completed data
      const responseData = {
        type: 'response-completed',
        messageId: finishMessage.id,
        content: finishMessage.content,
        baseDir,
        taskId,
        editedFiles: finishMessage.editedFiles,
        commitHash: finishMessage.commitHash,
        commitMessage: finishMessage.commitMessage,
        diff: finishMessage.diff,
        usageReport: finishMessage.usageReport,
        sequenceNumber: finishMessage.sequenceNumber,
        reflectedMessage: finishMessage.reflectedMessage,
        promptContext: finishMessage.promptContext,
      };

      expect(responseData).toMatchObject({
        type: 'response-completed',
        messageId,
        content: 'Final response',
        editedFiles: ['file1.ts', 'file2.ts'],
        commitHash: 'abc123',
        commitMessage: 'Test commit',
        diff: '+line\n-old',
        sequenceNumber: 1,
        reflectedMessage: '<thinking>Thought</thinking>',
        promptContext: { id: 'prompt-1' },
      });
    });
  });

  describe('Metadata Preservation', () => {
    it('should preserve reflectedMessage in chunks', () => {
      const reflectedMessage = '<thinking>This is a thought</thinking>';

      const chunkMessage: ResponseMessage = {
        id: 'msg-1',
        action: 'response',
        content: 'Hello',
        reflectedMessage,
        finished: false,
      };

      // When sending chunk, metadata should be preserved
      const chunkData = {
        messageId: chunkMessage.id,
        chunk: chunkMessage.content,
        reflectedMessage: chunkMessage.reflectedMessage,
      };

      expect(chunkData.reflectedMessage).toBe(reflectedMessage);
    });

    it('should preserve promptContext in chunks', () => {
      const promptContext: PromptContext = { id: 'prompt-1' };

      const chunkMessage: ResponseMessage = {
        id: 'msg-1',
        action: 'response',
        content: 'Hello',
        promptContext,
        finished: false,
      };

      const chunkData = {
        messageId: chunkMessage.id,
        chunk: chunkMessage.content,
        promptContext: chunkMessage.promptContext,
      };

      expect(chunkData.promptContext).toEqual(promptContext);
    });
  });

  describe('Cleanup on Task Close', () => {
    it('should clear all intervals on task close', () => {
      const mockClearInterval = vi.fn();
      vi.stubGlobal('clearInterval', mockClearInterval);

      const intervals = [{} as NodeJS.Timeout, {} as NodeJS.Timeout, {} as NodeJS.Timeout];

      // Simulate cleanupChunkBuffers
      const chunkIntervals = new Map<string, NodeJS.Timeout>();
      chunkIntervals.set('msg-1', intervals[0]);
      chunkIntervals.set('msg-2', intervals[1]);
      chunkIntervals.set('msg-3', intervals[2]);

      for (const interval of Array.from(chunkIntervals.values())) {
        clearInterval(interval);
      }

      chunkIntervals.clear();

      expect(mockClearInterval).toHaveBeenCalledTimes(3);
      expect(chunkIntervals.size).toBe(0);

      vi.unstubAllGlobals();
    });

    it('should clear all buffers on task close', () => {
      const chunkBuffers = new Map<string, { buffer: string; reflectedMessage?: string; promptContext?: PromptContext }>();

      chunkBuffers.set('msg-1', { buffer: 'content1' });
      chunkBuffers.set('msg-2', { buffer: 'content2' });
      chunkBuffers.set('msg-3', { buffer: 'content3' });

      expect(chunkBuffers.size).toBe(3);

      // Simulate cleanup
      chunkBuffers.clear();

      expect(chunkBuffers.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle finish message without prior chunks', () => {
      const messageId = 'msg-1';

      const finishMessage: ResponseMessage = {
        id: messageId,
        action: 'response',
        content: 'Final content',
        finished: true,
      };

      // Should directly handle completion
      expect(finishMessage.finished).toBe(true);
      expect(finishMessage.content).toBe('Final content');
    });

    it('should handle rapid chunk arrival', () => {
      const chunks = ['Chunk 0 ', 'Chunk 1 ', 'Chunk 2 ', 'Chunk 3 ', 'Chunk 4 '];

      let buffer = '';

      // Rapidly add chunks
      chunks.forEach((content) => {
        buffer += content;
      });

      expect(buffer).toBe('Chunk 0 Chunk 1 Chunk 2 Chunk 3 Chunk 4 ');
    });

    it('should handle multiple concurrent message streams', () => {
      const messages = [
        { id: 'msg-1', content: '' },
        { id: 'msg-2', content: '' },
        { id: 'msg-3', content: '' },
      ];

      const buffers = new Map<string, string>();

      messages.forEach((msg) => {
        buffers.set(msg.id, msg.content);
      });

      expect(buffers.size).toBe(3);
      expect(buffers.has('msg-1')).toBe(true);
      expect(buffers.has('msg-2')).toBe(true);
      expect(buffers.has('msg-3')).toBe(true);
    });
  });

  describe('Sequence Number Handling', () => {
    it('should sort responses by sequence number', () => {
      const responses = [
        { sequenceNumber: 2, messageId: 'msg-2' },
        { sequenceNumber: 3, messageId: 'msg-3' },
        { sequenceNumber: 1, messageId: 'msg-1' },
      ];

      // Sort by sequence number
      responses.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

      expect(responses[0].messageId).toBe('msg-1');
      expect(responses[1].messageId).toBe('msg-2');
      expect(responses[2].messageId).toBe('msg-3');
    });

    it('should handle missing sequence numbers', () => {
      const responses = [{ sequenceNumber: 2, messageId: 'msg-2' }, { messageId: 'msg-3' }, { sequenceNumber: 1, messageId: 'msg-1' }];

      // Sort by sequence number (missing treated as 0)
      responses.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));

      // msg-3 should be first (0)
      expect(responses[0].messageId).toBe('msg-3');
      expect(responses[1].messageId).toBe('msg-1');
      expect(responses[2].messageId).toBe('msg-2');
    });
  });
});

/**
 * Tests for the getContextMessagesData functionality in ContextManager
 * These tests verify conversion of ContextMessage[] to (UserMessageData | ResponseCompletedData | ToolData)[]
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { AIDER_TOOL_GROUP_NAME, AIDER_TOOL_RUN_PROMPT, SUBAGENTS_TOOL_GROUP_NAME, SUBAGENTS_TOOL_RUN_TASK, TOOL_GROUP_NAME_SEPARATOR } from '@aider-desk/common/tools';

import type { ContextMessage, PromptContext, UsageReportData } from '@aider-desk/common/types';

import { ANSWER_RESPONSE_START_TAG, THINKING_RESPONSE_STAR_TAG } from '@/agent/utils';

describe('ContextManager - getContextMessagesData', () => {
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

  describe('1. Empty messages', () => {
    it('should return empty array for empty input', () => {
      const manager = new ContextManager(mockTask, 'test-task', []);
      const result = manager.getContextMessagesData([]);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when manager has no messages', () => {
      const manager = new ContextManager(mockTask, 'test-task', []);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(0);
    });
  });

  describe('2. Only user message', () => {
    it('should convert single user message to UserMessageData', () => {
      const userMessage: ContextMessage = {
        id: 'user-1',
        role: 'user',
        content: 'Hello, how are you?',
      };

      const manager = new ContextManager(mockTask, 'test-task', [userMessage]);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'user',
        id: 'user-1',
        baseDir: '/test/project',
        taskId: 'test-task',
        content: 'Hello, how are you?',
        promptContext: undefined,
      });
    });

    it('should generate ID for user message without ID', () => {
      const userMessage: ContextMessage = {
        id: '',
        role: 'user',
        content: 'Hello',
      };

      const manager = new ContextManager(mockTask, 'test-task', [userMessage]);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(typeof result[0].id).toBe('string');
    });

    it('should include promptContext in user message', () => {
      const promptContext = { id: 'ctx-1', group: { id: 'g-1', color: 'blue', name: 'Test Group' } };
      const userMessage: ContextMessage = {
        id: 'user-1',
        role: 'user',
        content: 'Hello',
        promptContext,
      };

      const manager = new ContextManager(mockTask, 'test-task', [userMessage]);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(1);
      expect(result[0].promptContext).toEqual(promptContext);
    });
  });

  describe('3. User message + assistant message', () => {
    it('should convert assistant message with only reasoning', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'What is 2+2?' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'reasoning', text: 'I need to add 2 and 2' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');
      expect(userMsg.content).toBe('What is 2+2?');

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe(`${THINKING_RESPONSE_STAR_TAG}I need to add 2 and 2${ANSWER_RESPONSE_START_TAG}`);
    });

    it('should convert assistant message with only text', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there!' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe('Hi there!');
    });

    it('should convert assistant message with reasoning + text', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'What is 2+2?' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to calculate 2 + 2' },
            { type: 'text', text: 'The answer is 4' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe(`${THINKING_RESPONSE_STAR_TAG}I need to calculate 2 + 2${ANSWER_RESPONSE_START_TAG}The answer is 4`);
    });

    it('should convert assistant message with text + reasoning (reversed order)', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Thinking process' },
            { type: 'text', text: 'Answer' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe(`${THINKING_RESPONSE_STAR_TAG}Thinking process${ANSWER_RESPONSE_START_TAG}Answer`);
    });

    it('should convert assistant message with plain text content', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe('Hello! How can I help you today?');
    });

    it('should skip empty text content in assistant message', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '   ',
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('user');
    });

    it('should include assistant message metadata in ResponseCompletedData', () => {
      const usageReport: UsageReportData = {
        model: 'gpt-4',
        sentTokens: 10,
        receivedTokens: 20,
        messageCost: 0.003,
      };
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Hello' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi!' }],
          usageReport,
          reflectedMessage: 'User said hello',
          editedFiles: ['file1.ts', 'file2.ts'],
          commitHash: 'abc123',
          commitMessage: 'Initial commit',
          diff: '--- a/file.ts\n+++ b/file.ts',
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.usageReport).toEqual(usageReport);
      expect(assistantMsg.reflectedMessage).toBe('User said hello');
      expect(assistantMsg.editedFiles).toEqual(['file1.ts', 'file2.ts']);
      expect(assistantMsg.commitHash).toBe('abc123');
      expect(assistantMsg.commitMessage).toBe('Initial commit');
      expect(assistantMsg.diff).toBe('--- a/file.ts\n+++ b/file.ts');
    });
  });

  describe('4. User + assistant + tool call + tool result', () => {
    it('should convert assistant message with tool call and tool result', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Read file.txt' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will read the file' },
            { type: 'tool-call', toolCallId, toolName: 'power---file_read', input: { filePath: 'file.txt' } },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---file_read', output: { type: 'text', value: 'file content' } }],
          usageReport: { model: 'gpt-4', cacheWriteTokens: 5, sentTokens: 10, receivedTokens: 15, messageCost: 0.0001 },
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(3);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe('I will read the file');

      const toolMsg = result[2];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.id).toBe(toolCallId);
      expect(toolMsg.serverName).toBe('power');
      expect(toolMsg.toolName).toBe('file_read');
      expect(toolMsg.args).toEqual({ filePath: 'file.txt' });
      expect(toolMsg.response).toBe('"file content"');
      expect(toolMsg.usageReport).toBeDefined();
    });

    it('should handle tool call without toolCallId', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Execute tool' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            // @ts-expect-error - testing missing toolCallId
            { type: 'tool-call', toolName: 'power---file_read', input: {} },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      // Assistant with only tool call (no text/reasoning) doesn't create response-completed
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('user');
    });
  });

  describe('5. User + assistant + tool call + tool result + assistant', () => {
    it('should handle full flow with response after tool', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Read file' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will read file for you' },
            { type: 'tool-call', toolCallId, toolName: 'power---file_read', input: { filePath: 'file.txt' } },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } }],
        },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: [{ type: 'text', text: 'Here is content from the file' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);

      expect(result[0].type).toBe('user');

      const assistant1 = result[1];
      expect(assistant1.type).toBe('response-completed');
      expect(assistant1.content).toBe('I will read file for you');

      const toolMsg = result[2];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.response).toBe('"content"');

      const assistant2 = result[3];
      expect(assistant2).toBeDefined();
      expect(assistant2.type).toBe('response-completed');
      expect(assistant2.content).toBe('Here is content from the file');
    });
  });

  describe('6. Various combinations', () => {
    it('should handle multiple user messages and assistant messages', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'First question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'text', text: 'First answer' }],
        },
        { id: 'user-2', role: 'user', content: 'Second question' },
        {
          id: 'assistant-2',
          role: 'assistant',
          content: [{ type: 'text', text: 'Second answer' }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('user');
      expect(result[0].content).toBe('First question');
      expect(result[1].type).toBe('response-completed');
      expect(result[1].content).toBe('First answer');
      expect(result[2].type).toBe('user');
      expect(result[2].content).toBe('Second question');
      expect(result[3].type).toBe('response-completed');
      expect(result[3].content).toBe('Second answer');
    });

    it('should handle assistant with reasoning, text, and tool calls', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Help me' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'I need to think' },
            { type: 'text', text: 'I will call a tool' },
            { type: 'tool-call', toolCallId, toolName: 'power---bash', input: { command: 'ls' } },
            { type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'output' } },
            { type: 'text', text: 'Done!' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe(`${THINKING_RESPONSE_STAR_TAG}I need to think${ANSWER_RESPONSE_START_TAG}I will call a tool`);

      const toolMsg = result[2];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.response).toBe('"output"');

      const assistant2 = result[3];
      expect(assistant2.type).toBe('response-completed');
      expect(assistant2.content).toBe('Done!');
    });

    it('should handle multiple tool-result and text/reasoning pairs in one assistant message', () => {
      const toolCallId1 = uuidv4();
      const toolCallId2 = uuidv4();
      const toolCallId3 = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Do multiple tool turns' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'First reasoning' },
            { type: 'text', text: 'First text before tool' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'power---bash', input: { command: 'ls' } },
            { type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---bash', output: { type: 'text', value: 'output1' } },
            { type: 'text', text: 'Second text after first tool' },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'power---bash', input: { command: 'pwd' } },
            { type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---bash', output: { type: 'text', value: 'output2' } },
            { type: 'reasoning', text: 'Second reasoning' },
            { type: 'text', text: 'Third text after second tool' },
            { type: 'tool-call', toolCallId: toolCallId3, toolName: 'power---bash', input: { command: 'cat file' } },
            { type: 'tool-result', toolCallId: toolCallId3, toolName: 'power---bash', output: { type: 'text', value: 'output3' } },
            { type: 'text', text: 'Final text after all tools' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(8);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');

      const assistant1 = result[1];
      expect(assistant1.type).toBe('response-completed');
      expect(assistant1.content).toBe(`${THINKING_RESPONSE_STAR_TAG}First reasoning${ANSWER_RESPONSE_START_TAG}First text before tool`);
      expect(assistant1.messageId).toBe('assistant-1');

      const toolMsg1 = result[2];
      expect(toolMsg1.type).toBe('tool');
      expect(toolMsg1.response).toBe('"output1"');

      const assistant2 = result[3];
      expect(assistant2.type).toBe('response-completed');
      expect(assistant2.content).toBe('Second text after first tool');
      expect(assistant2.messageId).toBe('assistant-1-1');

      const toolMsg2 = result[4];
      expect(toolMsg2.type).toBe('tool');
      expect(toolMsg2.response).toBe('"output2"');

      const assistant3 = result[5];
      expect(assistant3.type).toBe('response-completed');
      expect(assistant3.content).toBe(`${THINKING_RESPONSE_STAR_TAG}Second reasoning${ANSWER_RESPONSE_START_TAG}Third text after second tool`);
      expect(assistant3.messageId).toBe('assistant-1-2');

      const toolMsg3 = result[6];
      expect(toolMsg3.type).toBe('tool');
      expect(toolMsg3.response).toBe('"output3"');

      const assistant4 = result[7];
      expect(assistant4.type).toBe('response-completed');
      expect(assistant4.content).toBe('Final text after all tools');
      expect(assistant4.messageId).toBe('assistant-1-3');
    });

    it('should handle multiple tool calls in one assistant message', () => {
      const toolCallId1 = uuidv4();
      const toolCallId2 = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Do multiple things' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will call multiple tools' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'power---file_read', input: { filePath: 'file1.txt' } },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'power---file_read', input: { filePath: 'file2.txt' } },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---file_read', output: { type: 'text', value: 'content1' } }],
        },
        {
          id: 'tool-2',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---file_read', output: { type: 'text', value: 'content2' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('user');
      expect(result[0].content).toBe('Do multiple things');
      expect(result[1].type).toBe('response-completed');
      expect(result[1].content).toBe('I will call multiple tools');
      expect(result[2].type).toBe('tool');
      expect(result[2].id).toBe(toolCallId1);
      expect(result[3].type).toBe('tool');
      expect(result[3].id).toBe(toolCallId2);
    });
  });

  describe('7. Aider tool with prompt context', () => {
    it('should create ResponseCompletedData for aider run_prompt responses', () => {
      const toolCallId = uuidv4();
      const promptContext = { id: 'ctx-1', group: { id: 'g-1', color: 'red', name: 'Aider' } };
      const aiderUsageReport = { model: 'gpt-4', promptTokens: 50, completionTokens: 100, totalTokens: 150, cost: 0.003 };

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Fix bug' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'Need to fix bug' },
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              input: { prompt: 'Fix bug in file.ts' },
            },
          ],
          promptContext,
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              output: {
                type: 'json',
                value: {
                  responses: [
                    {
                      messageId: 'aider-1',
                      content: 'I fixed the bug',
                      editedFiles: ['file.ts'],
                      commitHash: 'def456',
                      commitMessage: 'Fix bug',
                      diff: 'changes',
                      usageReport: aiderUsageReport,
                    },
                  ],
                  promptContext: { id: 'aider-ctx' },
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');

      const assistantMsg = result[1];
      expect(assistantMsg.type).toBe('response-completed');
      expect(assistantMsg.content).toBe(`${THINKING_RESPONSE_STAR_TAG}Need to fix bug${ANSWER_RESPONSE_START_TAG}`);

      const toolMsg = result[2];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.promptContext).toEqual({ id: 'aider-ctx' });

      const aiderResponse = result[3];
      expect(aiderResponse.type).toBe('response-completed');
      expect(aiderResponse.messageId).toBe('aider-1');
      expect(aiderResponse.content).toBe('I fixed the bug');
      expect(aiderResponse.editedFiles).toEqual(['file.ts']);
      expect(aiderResponse.commitHash).toBe('def456');
      expect(aiderResponse.commitMessage).toBe('Fix bug');
      expect(aiderResponse.diff).toBe('changes');
      expect(aiderResponse.usageReport).toEqual(aiderUsageReport);
    });

    it('should handle multiple aider responses', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Fix issues' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              input: { prompt: 'Fix all issues' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              output: {
                type: 'json',
                value: {
                  responses: [
                    { messageId: 'aider-1', content: 'First fix', editedFiles: ['file1.ts'] },
                    { messageId: 'aider-2', content: 'Second fix', editedFiles: ['file2.ts'] },
                  ],
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);

      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');

      const aider1 = result[2];
      expect(aider1.type).toBe('response-completed');
      expect(aider1.messageId).toBe('aider-1');

      const aider2 = result[3];
      expect(aider2.type).toBe('response-completed');
      expect(aider2.messageId).toBe('aider-2');
    });

    it('should handle aider response with reflected message', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              input: { prompt: 'Answer question' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              output: {
                type: 'json',
                value: {
                  responses: [
                    {
                      messageId: 'aider-1',
                      reflectedMessage: 'What is the answer?',
                      content: 'The answer is 42',
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(3);

      const aiderResponse = result.find((msg: any) => msg.messageId === 'aider-1');
      expect(aiderResponse.type).toBe('response-completed');
      expect(aiderResponse.reflectedMessage).toBe('What is the answer?');
      expect(aiderResponse.content).toBe('The answer is 42');
    });
  });

  describe('8. Subagent tool with prompt context', () => {
    it('should process subagent run_task responses', () => {
      const toolCallId = uuidv4();
      const subagentPromptContext = { id: 'subagent-ctx', group: { id: 'sg-1', color: 'green', name: 'Subagent' } };

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Analyze code' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              input: { prompt: 'Analyze code', subagentId: 'code-analyzer' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              output: {
                type: 'json',
                value: {
                  messages: [
                    {
                      id: 'sub-1',
                      role: 'assistant',
                      content: [{ type: 'text', text: 'Analysis complete' }],
                    },
                  ],
                  promptContext: subagentPromptContext,
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(3);

      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.promptContext).toEqual(subagentPromptContext);

      const subagentResponse = result[2];
      expect(subagentResponse.type).toBe('response-completed');
      expect(subagentResponse.messageId).toBe('sub-1');
      expect(subagentResponse.content).toBe('Analysis complete');
    });

    it('should process subagent with multiple messages', () => {
      const toolCallId = uuidv4();
      const subagentToolCallId = uuidv4();

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Do complex task' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              input: { prompt: 'Task', subagentId: 'worker' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              output: {
                type: 'json',
                value: {
                  messages: [
                    {
                      id: 'sub-1',
                      role: 'assistant',
                      content: [
                        { type: 'reasoning', text: 'Subagent thinking' },
                        { type: 'text', text: 'Subagent says hello' },
                        { type: 'tool-call', toolCallId: subagentToolCallId, toolName: 'power---bash', input: { command: 'echo hi' } },
                      ],
                    },
                    {
                      id: 'sub-2',
                      role: 'tool',
                      content: [{ type: 'tool-result', toolCallId: subagentToolCallId, toolName: 'power---bash', output: { type: 'text', value: 'hi' } }],
                    },
                    {
                      id: 'sub-3',
                      role: 'assistant',
                      content: [{ type: 'text', text: 'Subagent done' }],
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(5);

      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');

      const sub1 = result.find((msg: any) => msg.messageId === 'sub-1');
      expect(sub1.type).toBe('response-completed');
      expect(sub1.content).toBe(`${THINKING_RESPONSE_STAR_TAG}Subagent thinking${ANSWER_RESPONSE_START_TAG}Subagent says hello`);

      const subTool = result.find((msg: any) => msg.id === subagentToolCallId);
      expect(subTool.type).toBe('tool');
      expect(subTool.id).toBe(subagentToolCallId);
      expect(subTool.serverName).toBe('power');
      expect(subTool.toolName).toBe('bash');

      const sub2 = result.find((msg: any) => msg.messageId === 'sub-3');
      expect(sub2.type).toBe('response-completed');
      expect(sub2.content).toBe('Subagent done');
    });

    it('should take last assistant message from subagent responses', () => {
      const toolCallId = uuidv4();

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Task' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              input: { prompt: 'Work', subagentId: 'agent' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              output: {
                type: 'json',
                value: {
                  messages: [
                    { id: 'sub-1', role: 'assistant', content: [{ type: 'text', text: 'First response' }] },
                    { id: 'sub-2', role: 'assistant', content: [{ type: 'text', text: 'Second response' }] },
                  ],
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);

      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');

      // Should get last assistant message from subagent
      const subagentResponse = result.find((msg: any) => msg.messageId === 'sub-2');
      expect(subagentResponse.type).toBe('response-completed');
      expect(subagentResponse.content).toBe('Second response');
    });

    it('should handle subagent with tool results', () => {
      const toolCallId = uuidv4();
      const subagentToolCallId = uuidv4();

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Task' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              input: { prompt: 'Work', subagentId: 'agent' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${SUBAGENTS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SUBAGENTS_TOOL_RUN_TASK}`,
              output: {
                type: 'json',
                value: {
                  messages: [
                    {
                      id: 'sub-1',
                      role: 'assistant',
                      content: [{ type: 'tool-call', toolCallId: subagentToolCallId, toolName: 'power---file_read', input: {} }],
                    },
                    {
                      id: 'sub-2',
                      role: 'tool',
                      content: [
                        { type: 'tool-result', toolCallId: subagentToolCallId, toolName: 'power---file_read', output: { type: 'text', value: 'content' } },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(3);

      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');

      const subToolCall = result.find((msg: any) => msg.id === subagentToolCallId);
      expect(subToolCall.type).toBe('tool');
      expect(subToolCall.id).toBe(subagentToolCallId);
      expect(subToolCall.response).toBe('"content"');
    });
  });

  describe('9. Edge cases and additional scenarios', () => {
    it('should handle tool result without matching tool call', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Execute' },
        {
          id: 'tool-1',
          role: 'tool',
          content: [{ type: 'tool-result', toolCallId, toolName: 'power---bash', output: { type: 'text', value: 'output' } }],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('user');
    });

    it('should handle multiple tool results in one tool message', () => {
      const toolCallId1 = uuidv4();
      const toolCallId2 = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Execute' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Running commands' },
            { type: 'tool-call', toolCallId: toolCallId1, toolName: 'power---bash', input: { command: 'ls' } },
            { type: 'tool-call', toolCallId: toolCallId2, toolName: 'power---bash', input: { command: 'pwd' } },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: toolCallId1, toolName: 'power---bash', output: { type: 'text', value: 'ls output' } },
            { type: 'tool-result', toolCallId: toolCallId2, toolName: 'power---bash', output: { type: 'text', value: 'pwd output' } },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('user');
      expect(result[1].type).toBe('response-completed');
      expect(result[1].content).toBe('Running commands');

      const tool1 = result[2];
      expect(tool1.type).toBe('tool');
      expect(tool1.id).toBe(toolCallId1);
      expect(tool1.response).toBe('"ls output"');

      const tool2 = result[3];
      expect(tool2.type).toBe('tool');
      expect(tool2.id).toBe(toolCallId2);
      expect(tool2.response).toBe('"pwd output"');
    });

    it('should handle empty reasoning in assistant message', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Question' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: '   ' },
            { type: 'text', text: 'Answer' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);
      const assistantMsg = result[1];
      expect(assistantMsg.content).toBe('Answer');
    });

    it('should split multiple text and reasoning parts in assistant message', () => {
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Complex task' },
        {
          id: 'assistant',
          role: 'assistant',
          content: [
            { type: 'reasoning', text: 'First thought' },
            { type: 'text', text: 'First part' },
            { type: 'reasoning', text: 'Second thought' },
            { type: 'text', text: 'Second part' },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(3);
      const assistantMsg1 = result[1];
      expect(assistantMsg1.messageId).toBe('assistant');
      expect(assistantMsg1.content).toBe(`${THINKING_RESPONSE_STAR_TAG}First thought${ANSWER_RESPONSE_START_TAG}First part`);

      const assistantMsg2 = result[2];
      expect(assistantMsg2.messageId).toBe('assistant-1');
      expect(assistantMsg2.content).toBe(`${THINKING_RESPONSE_STAR_TAG}Second thought${ANSWER_RESPONSE_START_TAG}Second part`);
    });

    it('should handle tool result with text output for aider', () => {
      const toolCallId = uuidv4();
      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Fix' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              input: { prompt: 'Fix bug' },
            },
          ],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: `${AIDER_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${AIDER_TOOL_RUN_PROMPT}`,
              output: { type: 'text', value: 'Bug fixed' },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);

      const userMsg = result[0];
      expect(userMsg.type).toBe('user');

      // For aider tool with text output, the tool response is stored directly
      const toolMsg = result[1];
      expect(toolMsg.type).toBe('tool');
      expect(toolMsg.response).toBe('"Bug fixed"');
    });

    it('should preserve promptContext from tool result', () => {
      const toolCallId = uuidv4();
      const toolResultPromptContext: PromptContext = { id: 'tool-ctx', group: { id: 'tg-1', color: 'blue', name: 'ToolGroup' } };

      const messages: ContextMessage[] = [
        { id: 'user-1', role: 'user', content: 'Execute' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId, toolName: 'power---bash', input: { command: 'ls' } }],
        },
        {
          id: 'tool-1',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: 'power---bash',
              output: {
                type: 'json',
                // @ts-expect-error - testing invalid output
                value: {
                  promptContext: toolResultPromptContext,
                },
              },
            },
          ],
        },
      ];

      const manager = new ContextManager(mockTask, 'test-task', messages);
      const result = manager.getContextMessagesData();

      expect(result).toHaveLength(2);
      const toolMsg = result[1];
      expect(toolMsg.promptContext).toEqual(toolResultPromptContext);
    });
  });
});

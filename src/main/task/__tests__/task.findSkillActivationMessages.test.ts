/* eslint-disable import/order */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies BEFORE importing
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    stat: vi.fn().mockRejectedValue(new Error('File not found')),
    readdir: vi.fn().mockResolvedValue([]),
    rm: vi.fn().mockResolvedValue(undefined),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{}'),
  stat: vi.fn().mockRejectedValue(new Error('File not found')),
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils', () => ({
  fileExists: vi.fn().mockResolvedValue(false),
  filterIgnoredFiles: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/constants', () => ({
  PROBE_BINARY_PATH: '/probe',
  AIDER_DESK_TASKS_DIR: '.aider-desk/tasks',
  AIDER_DESK_DIR: '.aider-desk',
  AIDER_DESK_TODOS_FILE: 'todos.json',
  AIDER_DESK_RULES_DIR: 'rules',
  AIDER_DESK_PROJECT_RULES_DIR: '.aider-desk/rules',
  AIDER_DESK_GLOBAL_RULES_DIR: '/home/.aider-desk/rules',
  AIDER_DESK_COMMANDS_DIR: '.aider-desk/commands',
  AIDER_DESK_PROMPTS_DIR: '.aider-desk/prompts',
  AIDER_DESK_DEFAULT_PROMPTS_DIR: '/resources/prompts',
  AIDER_DESK_GLOBAL_PROMPTS_DIR: '/home/.aider-desk/prompts',
  AIDER_DESK_AGENTS_DIR: '.aider-desk/agents',
  AIDER_DESK_TMP_DIR: '.aider-desk/tmp',
  AIDER_DESK_WATCH_FILES_LOCK: '.aider-desk/watch-files.lock',
  WORKTREE_BRANCH_PREFIX: 'aider-desk/task/',
  AIDER_DESK_MEMORY_FILE: '/data/memory.db',
  LOGS_DIR: '/logs',
}));

vi.mock('@/agent', () => ({
  Agent: class {
    run = vi.fn();
    dispose = vi.fn();
  },
  McpManager: class {},
  AgentProfileManager: class {},
}));

vi.mock('@/task/aider-manager', () => ({
  AiderManager: class {
    start = vi.fn();
    stop = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('@/prompts', () => ({
  PromptsManager: class {},
}));

vi.mock('@/data-manager', () => ({
  DataManager: class {},
}));

vi.mock('@/telemetry', () => ({
  TelemetryManager: class {},
}));

vi.mock('@/models', () => ({
  ModelManager: class {},
}));

vi.mock('@/events', () => ({
  EventManager: class {
    sendTaskUpdated = vi.fn();
    sendTaskCreated = vi.fn();
    sendTaskDeleted = vi.fn();
  },
}));

vi.mock('@/memory/memory-manager', () => ({
  MemoryManager: class {},
}));

vi.mock('@/worktrees', () => ({
  WorktreeManager: class {},
}));

vi.mock('@/custom-commands', () => ({
  CustomCommandManager: class {},
}));

vi.mock('@/store', () => ({
  Store: class {},
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid'),
}));

import { SKILLS_TOOL_ACTIVATE_SKILL, SKILLS_TOOL_GROUP_NAME, TOOL_GROUP_NAME_SEPARATOR } from '@common/tools';

import { Task } from '../task';

import type { ContextMessage, ToolCallPart, ToolResultPart } from '@common/types';

describe('Task - findSkillActivationMessages', () => {
  let task: Task;
  let mockProject: any;
  let mockStore: any;
  let mockMcpManager: any;
  let mockCustomCommandManager: any;
  let mockAgentProfileManager: any;
  let mockTelemetryManager: any;
  let mockDataManager: any;
  let mockEventManager: any;
  let mockModelManager: any;
  let mockWorktreeManager: any;
  let mockMemoryManager: any;
  let mockPromptsManager: any;
  let mockExtensionManager: any;

  const baseDir = '/test/project';
  const taskId = 'test-task-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Create minimal mock dependencies
    mockProject = {
      baseDir,
      getProjectSettings: vi.fn(() => ({
        mainModel: 'default-model',
        agentProfileId: 'default-profile',
        modelEditFormats: {},
        currentMode: 'agent',
        autoApproveLocked: false,
      })),
    };

    mockStore = {
      getSettings: vi.fn(() => ({
        language: 'en',
        renderMarkdown: true,
        aider: { autoCommits: true, cachingEnabled: true, watchFiles: true },
        promptBehavior: { requireCommandConfirmation: {} },
      })),
    };

    mockMcpManager = {};
    mockCustomCommandManager = {};
    mockAgentProfileManager = {
      getProfile: vi.fn(() => null),
    };
    mockTelemetryManager = {};
    mockDataManager = {};
    mockEventManager = {
      sendTaskUpdated: vi.fn(),
      sendTaskCreated: vi.fn(),
      sendTaskDeleted: vi.fn(),
    };
    mockModelManager = {};
    mockWorktreeManager = {};
    mockMemoryManager = {};
    mockPromptsManager = {};
    mockExtensionManager = {
      isInitialized: vi.fn(() => false),
    };

    // Create Task instance
    task = new Task(
      mockProject,
      taskId,
      mockStore,
      mockMcpManager,
      mockCustomCommandManager,
      mockAgentProfileManager,
      mockTelemetryManager,
      mockDataManager,
      mockEventManager,
      mockModelManager,
      mockWorktreeManager,
      mockMemoryManager,
      mockPromptsManager,
      mockExtensionManager,
      {} as any,
    );
  });

  /**
   * Helper function to create a mock skill activation tool call
   */
  const createSkillToolCall = (skillName: string, toolCallId: string): ToolCallPart => ({
    type: 'tool-call',
    toolCallId,
    toolName: `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`,
    input: { skill: skillName },
  });

  /**
   * Helper function to create a mock skill activation tool result
   */
  const createSkillToolResult = (toolCallId: string, output: string = 'Skill activated'): ToolResultPart => ({
    type: 'tool-result',
    toolCallId,
    toolName: `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`,
    output: { type: 'text', value: output },
  });

  /**
   * Helper function to create a mock assistant message with skill activation
   */
  const createAssistantMessage = (id: string, toolCall: ToolCallPart): ContextMessage => ({
    id,
    role: 'assistant',
    content: [toolCall],
  });

  /**
   * Helper function to create a mock tool message with skill result
   */
  const createToolMessage = (id: string, toolResult: ToolResultPart): ContextMessage => ({
    id,
    role: 'tool',
    content: [toolResult],
  });

  describe('skill activation deduplication', () => {
    it('should keep only the most recent activation when the same skill is activated multiple times', () => {
      const contextMessages: ContextMessage[] = [
        // First activation of skill-a
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
        createToolMessage('msg-2', createSkillToolResult('call-1', 'First activation')),
        // Second activation of skill-a (should be kept)
        createAssistantMessage('msg-3', createSkillToolCall('skill-a', 'call-2')),
        createToolMessage('msg-4', createSkillToolResult('call-2', 'Second activation')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      // Should return only 2 messages (assistant + tool) for the most recent activation
      expect(result).toHaveLength(2);

      // Check that the result contains the second activation (most recent)
      const assistantMsg = result.find((m: ContextMessage) => m.role === 'assistant');
      const toolMsg = result.find((m: ContextMessage) => m.role === 'tool');

      expect(assistantMsg).toBeDefined();
      expect(toolMsg).toBeDefined();
      expect(assistantMsg?.id).toBe('msg-3');
      expect(toolMsg?.id).toBe('msg-4');

      // Verify the tool call has the correct skill name
      const toolCall = (assistantMsg?.content as ToolCallPart[])[0] as ToolCallPart;
      expect(toolCall.toolCallId).toBe('call-2');
      expect(toolCall.input).toEqual({ skill: 'skill-a' });
    });

    it('should preserve all different skills', () => {
      const contextMessages: ContextMessage[] = [
        // Activation of skill-a
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
        createToolMessage('msg-2', createSkillToolResult('call-1', 'Skill A activated')),
        // Activation of skill-b
        createAssistantMessage('msg-3', createSkillToolCall('skill-b', 'call-2')),
        createToolMessage('msg-4', createSkillToolResult('call-2', 'Skill B activated')),
        // Activation of skill-c
        createAssistantMessage('msg-5', createSkillToolCall('skill-c', 'call-3')),
        createToolMessage('msg-6', createSkillToolResult('call-3', 'Skill C activated')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      // Should return 6 messages (3 skills × 2 messages each)
      expect(result).toHaveLength(6);

      // Verify all three skills are present
      const assistantMessages = result.filter((m: ContextMessage) => m.role === 'assistant');
      const toolMessages = result.filter((m: ContextMessage) => m.role === 'tool');

      expect(assistantMessages).toHaveLength(3);
      expect(toolMessages).toHaveLength(3);

      // Extract skill names from assistant messages
      const skillNames = assistantMessages.map((m: ContextMessage) => {
        const toolCall = (m.content as ToolCallPart[])[0] as ToolCallPart;
        return (toolCall.input as { skill: string }).skill;
      });

      expect(skillNames).toContain('skill-a');
      expect(skillNames).toContain('skill-b');
      expect(skillNames).toContain('skill-c');
    });

    it('should keep the most recent activation when multiple skills have duplicate activations', () => {
      const contextMessages: ContextMessage[] = [
        // First activation of skill-a
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
        createToolMessage('msg-2', createSkillToolResult('call-1', 'First A')),
        // Activation of skill-b (only one)
        createAssistantMessage('msg-3', createSkillToolCall('skill-b', 'call-2')),
        createToolMessage('msg-4', createSkillToolResult('call-2', 'Skill B')),
        // Second activation of skill-b (should be kept)
        createAssistantMessage('msg-5', createSkillToolCall('skill-b', 'call-3')),
        createToolMessage('msg-6', createSkillToolResult('call-3', 'Second B')),
        // Second activation of skill-a (should be kept)
        createAssistantMessage('msg-7', createSkillToolCall('skill-a', 'call-4')),
        createToolMessage('msg-8', createSkillToolResult('call-4', 'Second A')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      // Should return 4 messages (2 skills × 2 messages each)
      expect(result).toHaveLength(4);

      const assistantMessages = result.filter((m: ContextMessage) => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(2);

      // Verify that the most recent activations are kept
      const skillNames = assistantMessages.map((m: ContextMessage) => {
        const toolCall = (m.content as ToolCallPart[])[0] as ToolCallPart;
        return (toolCall.input as { skill: string }).skill;
      });

      expect(skillNames).toContain('skill-a');
      expect(skillNames).toContain('skill-b');

      // Check that the correct messages (most recent) are kept for skill-a
      const skillAMessage = assistantMessages.find((m: ContextMessage) => ((m.content as ToolCallPart[])[0] as ToolCallPart).toolCallId === 'call-4');
      expect(skillAMessage?.id).toBe('msg-7');

      // Check that the correct messages (most recent) are kept for skill-b
      const skillBMessage = assistantMessages.find((m: ContextMessage) => ((m.content as ToolCallPart[])[0] as ToolCallPart).toolCallId === 'call-3');
      expect(skillBMessage?.id).toBe('msg-5');
    });
  });

  describe('edge cases', () => {
    it('should return empty array when no skill activation messages exist', () => {
      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello world',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
        },
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      expect(result).toHaveLength(0);
    });

    it('should ignore tool calls that are not skill activations', () => {
      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'other-tool-group---other-tool',
              input: {},
            },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'other-tool-group---other-tool',
              output: {
                type: 'text',
                value: 'Other tool result',
              },
            },
          ],
        },
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      expect(result).toHaveLength(0);
    });

    it('should handle missing skill name in tool call input', () => {
      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`,
              input: {}, // Missing skill property
            },
          ],
        },
        {
          id: 'msg-2',
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: `${SKILLS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${SKILLS_TOOL_ACTIVATE_SKILL}`,
              output: {
                type: 'text',
                value: 'Skill activation result',
              },
            },
          ],
        },
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      expect(result).toHaveLength(0);
    });

    it('should handle missing tool result message', () => {
      const contextMessages: ContextMessage[] = [
        // Assistant message with skill activation but no corresponding tool result
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      expect(result).toHaveLength(0);
    });

    it('should handle assistant messages with non-array content', () => {
      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Just text, not array',
        },
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      expect(result).toHaveLength(0);
    });

    it('should preserve promptContext in filtered messages', () => {
      const promptContext = { id: 'prompt-123' };

      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: [createSkillToolCall('skill-a', 'call-1')],
          promptContext,
        },
        createToolMessage('msg-2', createSkillToolResult('call-1')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      const assistantMsg = result.find((m: ContextMessage) => m.role === 'assistant');
      expect(assistantMsg?.promptContext).toEqual(promptContext);
    });

    it('should handle empty contextMessages array', () => {
      const result = (task as any).findSkillActivationMessages([]);

      expect(result).toHaveLength(0);
    });

    it('should filter assistant message to only contain the skill activation tool-call', () => {
      const contextMessages: ContextMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: [
            createSkillToolCall('skill-a', 'call-1'),
            {
              type: 'tool-call',
              toolCallId: 'call-2',
              toolName: 'other-tool---other-action',
              input: {},
            },
          ],
        },
        createToolMessage('msg-2', createSkillToolResult('call-1')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      const assistantMsg = result.find((m: ContextMessage) => m.role === 'assistant');
      expect(assistantMsg?.content).toHaveLength(1);

      const toolCall = (assistantMsg?.content as ToolCallPart[])[0] as ToolCallPart;
      expect(toolCall.toolCallId).toBe('call-1');
    });

    it('should filter tool message to only contain the skill activation tool-result', () => {
      const contextMessages: ContextMessage[] = [
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
        {
          id: 'msg-2',
          role: 'tool',
          content: [
            createSkillToolResult('call-1'),
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'other-tool---other-action',
              output: {
                type: 'text',
                value: 'Other tool result',
              },
            },
          ],
        },
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      const toolMsg = result.find((m: ContextMessage) => m.role === 'tool');
      expect(toolMsg?.content).toHaveLength(1);

      const toolResult = (toolMsg?.content as ToolResultPart[])[0] as ToolResultPart;
      expect(toolResult.toolCallId).toBe('call-1');
    });
  });

  describe('order of messages', () => {
    it('should maintain assistant-message, tool-message pairs in the result', () => {
      const contextMessages: ContextMessage[] = [
        createAssistantMessage('msg-1', createSkillToolCall('skill-a', 'call-1')),
        createToolMessage('msg-2', createSkillToolResult('call-1')),
        createAssistantMessage('msg-3', createSkillToolCall('skill-b', 'call-2')),
        createToolMessage('msg-4', createSkillToolResult('call-2')),
      ];

      const result = (task as any).findSkillActivationMessages(contextMessages);

      // The result should contain alternating assistant and tool messages
      expect(result[0].role).toBe('assistant');
      expect(result[1].role).toBe('tool');
      expect(result[2].role).toBe('assistant');
      expect(result[3].role).toBe('tool');
    });
  });
});

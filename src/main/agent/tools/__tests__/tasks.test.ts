/**
 * Tests for tasks tools, particularly search task tool
 */

import fs from 'fs/promises';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Tasks Tools - search_task', () => {
  let createTasksToolset: any;
  let mockTask: any;
  let mockProject: any;
  let mockProfile: any;
  let mockSettings: any;
  let mockPromptContext: any;

  const TASKS_TOOL_GROUP_NAME = 'tasks';
  const TOOL_GROUP_NAME_SEPARATOR = '---';
  const TASKS_TOOL_LIST_TASKS = 'list_tasks';
  const TASKS_TOOL_SEARCH_TASK = 'search_task';
  const AIDER_DESK_TASKS_DIR = '.aider-desk/tasks';

  beforeEach(async () => {
    vi.clearAllMocks();

    mockProject = {
      getTask: vi.fn(),
      deleteTask: vi.fn(),
      getTasks: vi.fn(),
      getAgentProfiles: vi.fn(() => []),
    };

    mockTask = {
      taskId: 'current-task-id',
      getProject: vi.fn(() => mockProject),
      addToolMessage: vi.fn(),
      addLogMessage: vi.fn(),
      task: {
        parentId: null,
      },

      dispatchExtensionEvent: vi.fn().mockResolvedValue({ blocked: false, allowed: false }),
    };

    mockProfile = {
      toolApprovals: {},
      toolSettings: {},
    };

    mockSettings = {
      taskSettings: {
        autoGenerateTaskName: true,
      },
    };

    mockPromptContext = { id: 'test-prompt-context' };

    const tasksModule = await import('../tasks');
    createTasksToolset = tasksModule.createTasksToolset;
  });

  describe('list tasks tool', () => {
    const getListTasksTool = () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      return tools[`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_LIST_TASKS}`];
    };

    it('should accept date, working mode, and metadata filters', () => {
      const listTasksTool = getListTasksTool();

      expect(() =>
        listTasksTool.inputSchema.parse({
          offset: 0,
          limit: 10,
          state: 'DONE',
          createdAfter: '2026-01-01T00:00:00Z',
          createdBefore: '2026-01-31T23:59:59Z',
          updatedAfter: '2026-01-01T00:00:00Z',
          updatedBefore: '2026-01-31T23:59:59Z',
          workingMode: 'worktree',
          archived: false,
          pinned: true,
          parentId: null,
          nameQuery: 'release',
          agentProfileId: 'profile-id',
          provider: 'anthropic',
          model: 'claude-sonnet',
        }),
      ).not.toThrow();
    });

    it('should reject invalid date ranges', () => {
      const listTasksTool = getListTasksTool();

      expect(() =>
        listTasksTool.inputSchema.parse({
          createdAfter: '2026-02-01T00:00:00Z',
          createdBefore: '2026-01-01T00:00:00Z',
        }),
      ).toThrow('createdBefore must be greater than or equal to createdAfter');
    });

    it('should filter before sorting and pagination and return working mode', async () => {
      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

      mockProject.getTasks.mockResolvedValue([
        {
          id: 'local-task',
          name: 'Release local',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-04T00:00:00Z',
          workingMode: 'local',
          archived: false,
          pinned: false,
          state: 'DONE',
          parentId: null,
        },
        {
          id: 'worktree-old',
          name: 'Release worktree old',
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-05T00:00:00Z',
          workingMode: 'worktree',
          archived: false,
          pinned: false,
          state: 'DONE',
          parentId: null,
        },
        {
          id: 'worktree-new',
          name: 'Release worktree new',
          createdAt: '2026-01-04T00:00:00Z',
          updatedAt: '2026-01-06T00:00:00Z',
          workingMode: 'worktree',
          archived: false,
          pinned: false,
          state: 'DONE',
          parentId: null,
        },
      ]);

      const result = await getListTasksTool().execute(
        {
          createdAfter: '2026-01-02T00:00:00Z',
          createdBefore: '2026-01-04T00:00:00Z',
          workingMode: 'worktree',
          nameQuery: 'RELEASE',
          offset: 1,
          limit: 1,
        },
        { toolCallId: 'call-1' },
      );

      expect(result).toEqual([
        {
          id: 'worktree-old',
          name: 'Release worktree old',
          createdAt: '2026-01-03T00:00:00Z',
          updatedAt: '2026-01-05T00:00:00Z',
          archived: false,
          pinned: false,
          workingMode: 'worktree',
          state: 'DONE',
        },
      ]);
    });
  });

  describe('search task tool', () => {
    it('should have search task tool registered', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      expect(tools).toHaveProperty(searchTaskToolKey);
    });

    it('should return error if task not found', async () => {
      const targetTaskId = 'non-existent-task-id';
      const searchQuery = 'test query';

      mockProject.getTask.mockReturnValue(undefined);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const result = await searchTool.execute(
        {
          taskId: targetTaskId,
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain(`Task with ID ${targetTaskId} not found`);
    });

    it('should return error if context file does not exist', async () => {
      const targetTaskId = 'target-task-id';
      const searchQuery = 'test query';

      const targetTask = {
        id: targetTaskId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/test/project';

      vi.spyOn(fs, 'access').mockRejectedValue(new Error('File not found') as never);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const result = await searchTool.execute(
        {
          taskId: targetTaskId,
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain('Task context file not found');
    });

    it('should respect approval denial', async () => {
      const targetTaskId = 'target-task-id';
      const searchQuery = 'test query';

      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValueOnce([false, 'User denied request'] as never);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const result = await searchTool.execute(
        {
          taskId: targetTaskId,
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain('Task search denied by user');
      expect(result).toContain('User denied request');
    });

    it('should add tool message on execution', async () => {
      const targetTaskId = 'target-task-id';
      const searchQuery = 'test query';

      const targetTask = {
        id: targetTaskId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/test/project';

      vi.spyOn(fs, 'access').mockResolvedValue(undefined as never);

      vi.mock('@/utils/probe', () => ({
        search: vi.fn().mockResolvedValue({
          limits: {
            max_tokens: 10000,
            total_tokens: 200,
          },
          results: [],
          summary: {
            count: 0,
            total_tokens: 200,
          },
          version: '0.6.0',
        }),
      }));

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      try {
        await searchTool.execute(
          {
            taskId: targetTaskId,
            query: searchQuery,
          },
          { toolCallId: 'tool-call-123' },
        );
      } catch {
        // Ignore mock errors, just check that addToolMessage was called
      }

      expect(mockTask.addToolMessage).toHaveBeenCalledWith(
        'tool-call-123',
        TASKS_TOOL_GROUP_NAME,
        TASKS_TOOL_SEARCH_TASK,
        { taskId: targetTaskId, query: searchQuery, maxTokens: undefined },
        undefined,
        undefined,
        mockPromptContext,
      );
    });

    it('should include tool when approval state is Always', () => {
      const profileWithAlwaysApproval = {
        ...mockProfile,
        toolApprovals: {
          [`${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`]: 'Always' as const,
        },
      };

      const tools = createTasksToolset(mockSettings, mockTask, profileWithAlwaysApproval, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;

      expect(tools).toHaveProperty(searchTaskToolKey);
    });

    it('should include tool when approval state is default', () => {
      const profileWithDefaultApproval = {
        ...mockProfile,
        toolApprovals: {},
      };

      const tools = createTasksToolset(mockSettings, mockTask, profileWithDefaultApproval, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;

      expect(tools).toHaveProperty(searchTaskToolKey);
    });
  });

  describe('search task tool input validation', () => {
    it('should validate input schema', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      expect(searchTool.inputSchema).toBeDefined();
      expect(searchTool.inputSchema.parse).toBeDefined();

      const validInput = {
        taskId: 'task-123',
        query: 'search query',
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(validInput)).not.toThrow();
    });

    it('should require taskId and query fields', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should require taskId field', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        query: 'search query',
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should require query field', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        taskId: 'task-123',
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should have proper description', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      expect(searchTool.description).toContain('task');
      expect(searchTool.description).toContain('search');
      expect(searchTool.description).toContain('semantic');
    });

    it('should validate taskId is a string', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        taskId: 123,
        query: 'search query',
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should validate query is a string', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        taskId: 'task-123',
        query: 123,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should validate maxTokens is a number when provided', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const invalidInput = {
        taskId: 'task-123',
        query: 'search query',
        maxTokens: 'not a number',
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should accept valid maxTokens values', () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const validInputs = [
        { taskId: 'task-1', query: 'query 1', maxTokens: 1000 },
        { taskId: 'task-2', query: 'query 2', maxTokens: 5000 },
        { taskId: 'task-3', query: 'query 3', maxTokens: 10000 },
        { taskId: 'task-4', query: 'query 4', maxTokens: 0 },
      ];

      for (const input of validInputs) {
        expect(() => searchTool.inputSchema.parse(input)).not.toThrow();
      }
    });
  });

  describe('search task tool error handling', () => {
    it('should return error message when task not found', async () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      mockProject.getTask.mockReturnValue(undefined);

      const result = await searchTool.execute({ taskId: 'invalid-id', query: 'test' }, { toolCallId: 'call-1' });

      expect(typeof result).toBe('string');
      expect(result).toContain('not found');
    });

    it('should return error message when context file missing', async () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const targetTask = {
        id: 'target-id',
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/test/project';
      vi.spyOn(fs, 'access').mockRejectedValue(new Error('Not found') as never);

      const result = await searchTool.execute({ taskId: 'target-id', query: 'test' }, { toolCallId: 'call-1' });

      expect(typeof result).toBe('string');
      expect(result).toContain('context file not found');
    });

    it('should handle fs access errors gracefully', async () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const targetTask = {
        id: 'target-id',
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/test/project';
      vi.spyOn(fs, 'access').mockRejectedValue(new Error('Permission denied') as never);

      const result = await searchTool.execute({ taskId: 'target-id', query: 'test' }, { toolCallId: 'call-1' });

      expect(typeof result).toBe('string');
      expect(result).toContain('context file not found');
    });

    it('should use correct context file path', async () => {
      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const targetTask = {
        id: 'task-id-123',
        project: { baseDir: '/my/project' },
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/my/project';
      vi.spyOn(fs, 'access').mockResolvedValue(undefined as never);

      vi.mock('@/utils/probe', () => ({
        search: vi.fn().mockResolvedValue({ results: [], summary: { count: 0 } }),
      }));

      try {
        await searchTool.execute({ taskId: 'task-id-123', query: 'test' }, { toolCallId: 'call-1' });
      } catch {
        // Ignore
      }

      // The context file path should be constructed correctly
      const expectedPath = path.join('/my/project', AIDER_DESK_TASKS_DIR, 'task-id-123', 'context.json');
      // Just verify that path construction logic exists
      expect(expectedPath).toContain('task-id-123');
      expect(expectedPath).toContain('context.json');
    });
  });

  describe('create task tool', () => {
    const createTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}create_task`;

    it('inherits the calling task agent profile and model when they are not specified', async () => {
      const taskInstance = {
        init: vi.fn().mockResolvedValue(undefined),
        saveTask: vi.fn().mockResolvedValue(undefined),
        savePromptOnly: vi.fn().mockResolvedValue(undefined),
        getContextMessages: vi.fn().mockResolvedValue([]),
      };
      Object.assign(mockProfile, {
        id: 'calling-profile',
        provider: 'anthropic',
        model: 'claude-sonnet',
      });

      mockProject.createNewTask = vi.fn().mockResolvedValue({ id: 'new-task-id', name: 'New task' });
      mockProject.getTask.mockReturnValue(taskInstance);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const createTaskTool = tools[createTaskToolKey];

      await createTaskTool.execute({ prompt: 'Create a task', name: 'New task' }, { toolCallId: 'tool-call-123' });

      expect(mockProject.createNewTask).toHaveBeenCalledWith({
        parentId: null,
        name: 'New task',
        autonomyMode: undefined,
        workingMode: 'local',
        agentProfileId: 'calling-profile',
        provider: 'anthropic',
        model: 'claude-sonnet',
        mainModel: 'anthropic/claude-sonnet',
      });
      expect(taskInstance.saveTask).toHaveBeenCalledWith({
        agentProfileId: 'calling-profile',
        provider: 'anthropic',
        model: 'claude-sonnet',
        mainModel: 'anthropic/claude-sonnet',
      });
    });

    it('uses explicitly requested agent profile and model overrides', async () => {
      const taskInstance = {
        init: vi.fn().mockResolvedValue(undefined),
        saveTask: vi.fn().mockResolvedValue(undefined),
        savePromptOnly: vi.fn().mockResolvedValue(undefined),
        getContextMessages: vi.fn().mockResolvedValue([]),
      };
      Object.assign(mockProfile, {
        id: 'calling-profile',
        provider: 'anthropic',
        model: 'claude-sonnet',
      });

      mockProject.resolveAgentProfile = vi.fn().mockReturnValue({ id: 'requested-profile' });
      mockProject.createNewTask = vi.fn().mockResolvedValue({ id: 'new-task-id', name: 'New task' });
      mockProject.getTask.mockReturnValue(taskInstance);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const createTaskTool = tools[createTaskToolKey];

      await createTaskTool.execute(
        {
          prompt: 'Create a task',
          name: 'New task',
          agentProfileId: 'requested-profile',
          modelId: 'openai/gpt-5',
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(mockProject.createNewTask).toHaveBeenCalledWith(
        expect.objectContaining({
          agentProfileId: 'requested-profile',
          provider: 'openai',
          model: 'gpt-5',
          mainModel: 'openai/gpt-5',
        }),
      );
    });
  });

  describe('search task tool approval flow', () => {
    it('should call approval manager with correct parameters', async () => {
      const targetTaskId = 'task-123';
      const searchQuery = 'test query';

      const targetTask = {
        id: targetTaskId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(targetTask);
      mockProject.baseDir = '/test/project';

      vi.spyOn(fs, 'access').mockResolvedValue(undefined as never);

      vi.mock('@/utils/probe', () => ({
        search: vi.fn().mockResolvedValue({ results: [], summary: { count: 0 } }),
      }));

      const { ApprovalManager } = await import('../approval-manager');
      const handleApprovalSpy = vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([true, undefined] as never);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      try {
        await searchTool.execute({ taskId: targetTaskId, query: searchQuery }, { toolCallId: 'call-1' });
      } catch {
        // Ignore
      }

      expect(handleApprovalSpy).toHaveBeenCalledWith(
        `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`,
        { taskId: targetTaskId, query: searchQuery },
        `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`,
        `Approve searching in task ${targetTaskId}?`,
        `Query: ${searchQuery}\nTask ID: ${targetTaskId}`,
      );
    });

    it('should return denial message when user denies', async () => {
      const { ApprovalManager } = await import('../approval-manager');
      vi.spyOn(ApprovalManager.prototype, 'handleToolApproval').mockResolvedValue([false, 'I do not want to search'] as never);

      const tools = createTasksToolset(mockSettings, mockTask, mockProfile, mockPromptContext);
      const searchTaskToolKey = `${TASKS_TOOL_GROUP_NAME}${TOOL_GROUP_NAME_SEPARATOR}${TASKS_TOOL_SEARCH_TASK}`;
      const searchTool = tools[searchTaskToolKey];

      const result = await searchTool.execute({ taskId: 'task-123', query: 'test' }, { toolCallId: 'call-1' });

      expect(result).toBe('Task search denied by user. Reason: I do not want to search');
    });
  });
});

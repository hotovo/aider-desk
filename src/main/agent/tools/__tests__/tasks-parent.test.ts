/**
 * Tests for tasks tools, including search task and search parent task tools
 */

import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @probelabs/probe at the top level
vi.mock('@probelabs/probe', () => ({
  search: vi.fn(),
}));

// Mock fileExists from @common/utils to avoid fs.stat calls
vi.mock('@common/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@common/utils')>();
  return {
    ...actual,
    fileExists: vi.fn().mockResolvedValue(true),
  };
});

describe('Tasks Tools - search_parent_task', () => {
  let createSearchParentTaskTool: any;
  let mockTask: any;
  let mockProject: any;
  let mockPromptContext: any;
  let mockSearch: any;
  let mockFileExists: any;

  const TASKS_TOOL_GROUP_NAME = 'tasks';
  const TASKS_TOOL_SEARCH_PARENT_TASK = 'search_parent_task';
  const AIDER_DESK_TASKS_DIR = '.aider-desk/tasks';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked functions
    const { search } = await import('@probelabs/probe');
    const { fileExists } = await import('@common/utils');
    mockSearch = vi.mocked(search);
    mockFileExists = vi.mocked(fileExists);
    mockSearch.mockReset();
    mockFileExists.mockReset();

    mockProject = {
      getTask: vi.fn(),
      deleteTask: vi.fn(),
      getTasks: vi.fn(),
    };

    mockTask = {
      taskId: 'current-subtask-id',
      getProject: vi.fn(() => mockProject),
      addToolMessage: vi.fn(),
      addLogMessage: vi.fn(),
      task: {
        parentId: 'parent-task-id',
      },
      hookManager: {
        trigger: vi.fn().mockResolvedValue({ result: true, reason: undefined }),
      },
    };

    mockPromptContext = { id: 'test-prompt-context' };

    const tasksModule = await import('../tasks');
    createSearchParentTaskTool = tasksModule.createSearchParentTaskTool;
  });

  describe('search parent task tool - for subtasks', () => {
    it('should return error if parent task not found', async () => {
      const searchQuery = 'test query';

      mockProject.getTask.mockReturnValue(undefined);

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain(`Parent task with ID ${mockTask.task.parentId} not found`);
    });

    it('should return error if parent context file does not exist', async () => {
      const searchQuery = 'test query';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(false);

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain('Parent task context file not found');
    });

    it('should not require approval for parent task search', async () => {
      const searchQuery = 'test query';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
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
      });

      const { ApprovalManager } = await import('../approval-manager');
      const handleApprovalSpy = vi.spyOn(ApprovalManager.prototype, 'handleApproval');

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      try {
        await searchTool.execute(
          {
            query: searchQuery,
          },
          { toolCallId: 'tool-call-123' },
        );
      } catch {
        // Ignore mock errors
      }

      // Approval manager should NOT be called for parent task search
      expect(handleApprovalSpy).not.toHaveBeenCalled();
    });

    it('should always use parent task ID for search', async () => {
      const searchQuery = 'parent function';

      const parentTask = {
        id: 'parent-task-id',
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
        limits: {
          max_tokens: 10000,
          total_tokens: 300,
        },
        results: [
          {
            code: 'function parentFunction() {}',
            file: path.join('/test/project', AIDER_DESK_TASKS_DIR, 'parent-task-id', 'context.json'),
            matched_keywords: ['parent', 'function'],
            score: 0.88,
          },
        ],
        summary: {
          count: 1,
          total_tokens: 300,
        },
        version: '0.6.0',
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          path: path.join('/test/project', AIDER_DESK_TASKS_DIR, 'parent-task-id', 'context.json'),
        }),
      );
      expect(result.results).toHaveLength(1);
      expect(result.results[0].score).toBe(0.88);
    });

    it('should add tool message with parent task ID', async () => {
      const searchQuery = 'test query';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
        limits: { max_tokens: 10000, total_tokens: 200 },
        results: [],
        summary: { count: 0, total_tokens: 200 },
        version: '0.6.0',
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      try {
        await searchTool.execute(
          {
            query: searchQuery,
          },
          { toolCallId: 'tool-call-123' },
        );
      } catch {
        // Ignore mock errors
      }

      expect(mockTask.addToolMessage).toHaveBeenCalledWith(
        'tool-call-123',
        TASKS_TOOL_GROUP_NAME,
        TASKS_TOOL_SEARCH_PARENT_TASK,
        {
          query: searchQuery,
          maxTokens: 10000,
          parentTaskId: 'parent-task-id',
        },
        undefined,
        undefined,
        mockPromptContext,
      );
    });

    it('should use default maxTokens when not provided', async () => {
      const searchQuery = 'test query';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
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
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 10000,
        }),
      );
    });

    it('should respect custom maxTokens when provided', async () => {
      const searchQuery = 'test query';
      const customMaxTokens = 5000;

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
        limits: {
          max_tokens: customMaxTokens,
          total_tokens: 200,
        },
        results: [],
        summary: {
          count: 0,
          total_tokens: 200,
        },
        version: '0.6.0',
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      await searchTool.execute(
        {
          query: searchQuery,
          maxTokens: customMaxTokens,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: customMaxTokens,
        }),
      );
    });

    it('should have proper description', () => {
      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      expect(searchTool.description).toContain('parent task');
      expect(searchTool.description).toContain('search');
      expect(searchTool.description).toContain('semantic');
    });

    it('should not require taskId parameter', () => {
      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      expect(searchTool.inputSchema).toBeDefined();
      expect(searchTool.inputSchema.parse).toBeDefined();

      const validInput = {
        query: 'search query',
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(validInput)).not.toThrow();
    });

    it('should require query field', () => {
      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const invalidInput = {
        maxTokens: 10000,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should validate query is a string', () => {
      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const invalidInput = {
        query: 123,
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should handle multiple search results in parent task', async () => {
      const searchQuery = 'function';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
        limits: {
          max_tokens: 10000,
          total_tokens: 1500,
        },
        results: [
          {
            code: 'function parentFunction1() {}',
            file: path.join('/test/project', AIDER_DESK_TASKS_DIR, 'parent-task-id', 'context.json'),
            matched_keywords: ['function'],
            score: 0.92,
          },
          {
            code: 'function parentFunction2() {}',
            file: path.join('/test/project', AIDER_DESK_TASKS_DIR, 'parent-task-id', 'context.json'),
            matched_keywords: ['function'],
            score: 0.87,
          },
          {
            code: 'function parentFunction3() {}',
            file: path.join('/test/project', AIDER_DESK_TASKS_DIR, 'parent-task-id', 'context.json'),
            matched_keywords: ['function'],
            score: 0.75,
          },
        ],
        summary: {
          count: 3,
          total_tokens: 1500,
        },
        version: '0.6.0',
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result.results).toHaveLength(3);
      expect(result.summary.count).toBe(3);
      expect(result.results[0].score).toBeGreaterThan(result.results[1].score);
    });

    it('should handle empty search results in parent task', async () => {
      const searchQuery = 'nonexistent query';

      const parentTask = {
        id: mockTask.task.parentId,
        project: mockProject,
      };

      mockProject.getTask.mockReturnValue(parentTask);
      mockProject.baseDir = '/test/project';

      mockFileExists.mockResolvedValue(true);

      mockSearch.mockResolvedValue({
        limits: {
          max_tokens: 10000,
          total_tokens: 0,
        },
        results: [],
        summary: {
          count: 0,
          total_tokens: 0,
        },
        version: '0.6.0',
      });

      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: searchQuery,
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result.results).toHaveLength(0);
      expect(result.summary.count).toBe(0);
    });

    it('should validate maxTokens is a number when provided', () => {
      const searchTool = createSearchParentTaskTool(mockTask, mockPromptContext);

      const invalidInput = {
        query: 'search query',
        maxTokens: 'not a number',
      };

      expect(() => searchTool.inputSchema.parse(invalidInput)).toThrow();
    });

    it('should return error when used by top-level task', async () => {
      const topLevelTask = {
        ...mockTask,
        task: {
          parentId: null,
        },
        getProject: vi.fn(() => mockProject),
        addToolMessage: vi.fn(),
        addLogMessage: vi.fn(),
      };

      const searchTool = createSearchParentTaskTool(topLevelTask, mockPromptContext);

      const result = await searchTool.execute(
        {
          query: 'test query',
        },
        { toolCallId: 'tool-call-123' },
      );

      expect(result).toContain('This tool is only available for subtasks. Current task has no parent.');
    });
  });
});

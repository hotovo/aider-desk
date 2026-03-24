// Mock all dependencies BEFORE importing the test file
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/task/aider-manager', () => ({
  AiderManager: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock('@/store');
vi.mock('@/agent');
vi.mock('@/data-manager');
vi.mock('@/models');
vi.mock('@/custom-commands');
vi.mock('@/telemetry');
vi.mock('@/events');
vi.mock('@/project/migrations');
vi.mock('@/worktrees');
vi.mock('@/memory/memory-manager');
vi.mock('@/hooks/hook-manager');
vi.mock('@/prompts');
vi.mock('@/extensions/extension-manager');
vi.mock('@/constants');
vi.mock('@/utils');
vi.mock('fs/promises');
vi.mock('path');
vi.mock('uuid');
vi.mock('@/task/aider-manager');
vi.mock('@/task/context-manager');
vi.mock('@/agent/agent');

import * as fs from 'fs/promises';

import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { CreateTaskParams, SettingsData, ProjectSettings, Mode, ContextCompactionType } from '@common/types';

import { Project } from '../project';

import { McpManager, AgentProfileManager } from '@/agent';
import { DataManager } from '@/data-manager';
import { EventManager } from '@/events';
import { HookManager } from '@/hooks/hook-manager';
import { MemoryManager } from '@/memory/memory-manager';
import { ModelManager } from '@/models';
import { PromptsManager } from '@/prompts';
import { ExtensionManager } from '@/extensions/extension-manager';
import { Store } from '@/store';
import { Task, INTERNAL_TASK_ID } from '@/task';
import { TelemetryManager } from '@/telemetry';
import { determineMainModel, determineWeakModel } from '@/utils';
import { WorktreeManager } from '@/worktrees';
import { migrateSessionsToTasks } from '@/project/migrations';

describe('Project - createNewTask', () => {
  let project: Project;
  let mockStore: Partial<Store>;
  let mockMcpManager: Partial<McpManager>;
  let mockTelemetryManager: Partial<TelemetryManager>;
  let mockDataManager: Partial<DataManager>;
  let mockEventManager: Partial<EventManager>;
  let mockModelManager: Partial<ModelManager>;
  let mockWorktreeManager: Partial<WorktreeManager>;
  let mockAgentProfileManager: Partial<AgentProfileManager>;
  let mockMemoryManager: Partial<MemoryManager>;
  let mockHookManager: Partial<HookManager>;
  let mockPromptsManager: Partial<PromptsManager>;
  let mockExtensionManager: Partial<ExtensionManager>;
  let baseDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();

    baseDir = '/test/project';

    // Mock Task methods to avoid complex initialization
    Task.prototype['init'] = vi.fn().mockResolvedValue(undefined);

    // Mock getContextMessages to return messages for tasks that have been "used"
    // This prevents the duplicate empty subtask prevention from blocking multiple subtask creation in tests
    Task.prototype['getContextMessages'] = vi.fn().mockImplementation(function (this: Task) {
      // Return mock messages if this task has been accessed/created before
      // This simulates a task with content, preventing duplicate prevention
      if (this.task?.id) {
        return Promise.resolve([{ id: 'msg-1', role: 'user' } as any]);
      }
      return Promise.resolve([]);
    });

    // Mock store
    mockStore = {
      getSettings: vi.fn(
        () =>
          ({
            language: 'en',
            renderMarkdown: true,
            virtualizedRendering: true,
            aiderDeskAutoUpdate: true,
            promptBehavior: {
              suggestionMode: 'automatically',
              suggestionDelay: 0,
              requireCommandConfirmation: {
                add: false,
                readOnly: false,
                model: false,
                modeSwitching: false,
              },
              useVimBindings: false,
            },
            server: {
              enabled: false,
              basicAuth: {
                enabled: false,
                username: '',
                password: '',
              },
            },
            memory: {
              enabled: false,
              provider: 'sentence-transformers',
              model: '',
              maxDistance: 0,
            },
            taskSettings: {
              smartTaskState: true,
              autoGenerateTaskName: true,
              showTaskStateActions: true,
              worktreeSymlinkFolders: [],
              contextCompactingThreshold: 0,
              contextCompactionType: ContextCompactionType.Compact,
            },
            aider: {
              options: '',
              environmentVariables: '',
              addRuleFiles: false,
              autoCommits: true,
              cachingEnabled: true,
              watchFiles: true,
              confirmBeforeEdit: false,
            },
            preferredModels: [],
            mcpServers: {},
            llmProviders: {},
            telemetryEnabled: true,
          }) as SettingsData,
      ),
      getProviders: vi.fn(() => []),
      getProjectSettings: vi.fn(
        () =>
          ({
            mainModel: 'default-model',
            agentProfileId: 'default-profile',
            modelEditFormats: {},
            currentMode: 'agent' as Mode,
            autoApproveLocked: false,
          }) as ProjectSettings,
      ),
    };

    // Mock all other dependencies with minimal implementations
    mockMcpManager = {};
    mockTelemetryManager = {};
    mockDataManager = {};
    mockEventManager = {
      sendTaskCreated: vi.fn(),
      sendProjectStarted: vi.fn(),
      sendTaskUpdated: vi.fn(),
      sendContextFilesUpdated: vi.fn(),
      sendInputHistoryUpdated: vi.fn(),
      sendTaskDeleted: vi.fn(),
    };
    mockModelManager = {
      getProviderModels: vi.fn(() => Promise.resolve({ models: [] })),
      getAiderModelMapping: vi.fn(() => ({
        modelName: 'default-model',
        environmentVariables: {},
      })),
    };
    mockWorktreeManager = {
      close: vi.fn(() => Promise.resolve()),
      getTaskWorktree: vi.fn(() => Promise.resolve(null)),
      createWorktree: vi.fn(() => Promise.resolve({ path: '/test/worktree' })),
      removeWorktree: vi.fn(() => Promise.resolve()),
    };
    mockAgentProfileManager = {
      initializeForProject: vi.fn(() => Promise.resolve()),
      removeProject: vi.fn(),
      getDefaultAgentProfileId: vi.fn(() => 'default-profile'),
    };
    mockMemoryManager = {};
    mockHookManager = {
      trigger: vi.fn((_hookName, event) => Promise.resolve({ event, blocked: false })) as any,
      stopWatchingProject: vi.fn(() => Promise.resolve()),
    };
    mockPromptsManager = {
      watchProject: vi.fn(() => Promise.resolve()),
      unwatchProject: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(),
    } as unknown as PromptsManager;
    (mockPromptsManager as any).start = vi.fn(() => Promise.resolve());
    mockExtensionManager = {
      reloadProjectExtensions: vi.fn(() => Promise.resolve()),
      stopProjectWatcher: vi.fn(),
      dispatchEvent: vi.fn(() => Promise.resolve({} as any)),
    };

    // Mock file system operations
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(fs.appendFile).mockResolvedValue(undefined);

    // Mock utils functions
    vi.mocked(determineMainModel).mockReturnValue('default-model');
    vi.mocked(determineWeakModel).mockReturnValue(null as any);

    // Mock migrations
    vi.mocked(migrateSessionsToTasks).mockResolvedValue(undefined);

    // Mock uuid to generate predictable IDs
    let uuidCounter = 0;
    (vi.mocked(uuidv4) as unknown as Mock).mockImplementation(() => {
      return `task-${uuidCounter++}`;
    });

    // Mock Task methods to avoid complex initialization
    Task.prototype['init'] = vi.fn().mockResolvedValue(undefined);
    Task.prototype['getContextFiles'] = vi.fn().mockResolvedValue([]);

    // Create project instance
    project = new Project(
      baseDir,
      mockStore as Store,
      mockMcpManager as McpManager,
      mockTelemetryManager as TelemetryManager,
      mockDataManager as DataManager,
      mockEventManager as EventManager,
      mockModelManager as ModelManager,
      mockWorktreeManager as WorktreeManager,
      mockAgentProfileManager as AgentProfileManager,
      mockMemoryManager as MemoryManager,
      mockHookManager as HookManager,
      mockPromptsManager as PromptsManager,
      mockExtensionManager as ExtensionManager,
    );

    // Wait for tasks to load
    await (project as any).tasksLoadingPromise;
  });

  describe('Test Case 1: Create top-level task (parentId: null) when no params are provided', () => {
    it('should create a top-level task with parentId: null when no params are provided', async () => {
      // Act: Create a task without any params
      const task = await project.createNewTask();

      // Assert: Task should have parentId as null (top-level task)
      expect(task.parentId).toBeNull();
      expect(task.id).toBeTruthy();
      expect(task.baseDir).toBe(baseDir);

      // Assert: Event manager should be called with the created task
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(1);

      // Assert: Task should be added to the tasks Map
      const storedTask = (project as any).tasks.get(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.task.id).toBe(task.id);
    });

    it('should create a top-level task with parentId: null when params is empty object', async () => {
      // Act: Create a task with empty params object
      const params: CreateTaskParams = {};
      const task = await project.createNewTask(params);

      // Assert: Task should have parentId as null
      expect(task.parentId).toBeNull();

      // Assert: Event manager should be called
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);

      // Assert: Task should be in the tasks Map
      expect((project as any).tasks.has(task.id)).toBe(true);
    });
  });

  describe('Test Case 2: Create subtask with correct parentId when valid parentId is provided', () => {
    it('should create a subtask with correct parentId when parent task exists', async () => {
      // Setup: Create a parent task first
      const parentTask = await project.createNewTask();
      const initialTaskCount = (project as any).tasks.size;

      // Act: Create a subtask with parentId
      const params: CreateTaskParams = {
        parentId: parentTask.id,
      };
      const newTask = await project.createNewTask(params);

      // Assert: New task should have the correct parentId
      expect(newTask.parentId).toBe(parentTask.id);
      expect(newTask.id).not.toBe(parentTask.id);
      expect(newTask.baseDir).toBe(baseDir);

      // Assert: Task count should increase by 1
      expect((project as any).tasks.size).toBe(initialTaskCount + 1);

      // Assert: Event manager should be called with the created task
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(newTask, undefined);
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(2); // parent + child

      // Assert: New task should be added to the tasks Map
      const storedTask = (project as any).tasks.get(newTask.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.task.id).toBe(newTask.id);
      expect(storedTask?.task.parentId).toBe(parentTask.id);
    });

    it('should support nested subtasks (subtask of subtask)', async () => {
      // Setup: Create a three-level hierarchy
      const grandparentTask = await project.createNewTask();
      const parentTask = await project.createNewTask({ parentId: grandparentTask.id });

      // Act: Create a subtask of the parent task
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: The subtask should have the correct parentId (parent task's id, not grandparent's)
      expect(subtask.parentId).toBe(parentTask.id);
      expect(subtask.parentId).not.toBe(grandparentTask.id);
      expect(subtask.id).not.toBe(parentTask.id);
      expect(subtask.id).not.toBe(grandparentTask.id);

      // Assert: All three tasks should exist in the tasks Map
      expect((project as any).tasks.has(grandparentTask.id)).toBe(true);
      expect((project as any).tasks.has(parentTask.id)).toBe(true);
      expect((project as any).tasks.has(subtask.id)).toBe(true);

      // Assert: Event manager should be called for each task
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(3);
    });

    it('should allow creating multiple subtasks with the same parent', async () => {
      // Setup: Create a parent task
      const parentTask = await project.createNewTask();
      const initialTaskCount = (project as any).tasks.size;

      // Act: Create multiple subtasks with the same parentId
      const subtask1 = await project.createNewTask({ parentId: parentTask.id });
      const subtask2 = await project.createNewTask({ parentId: parentTask.id });
      const subtask3 = await project.createNewTask({ parentId: parentTask.id });

      // Assert: All subtasks should have the correct parentId
      expect(subtask1.parentId).toBe(parentTask.id);
      expect(subtask2.parentId).toBe(parentTask.id);
      expect(subtask3.parentId).toBe(parentTask.id);

      // Assert: All subtasks should have unique IDs
      expect(subtask1.id).not.toBe(subtask2.id);
      expect(subtask2.id).not.toBe(subtask3.id);
      expect(subtask1.id).not.toBe(subtask3.id);

      // Assert: Task count should increase by 3
      expect((project as any).tasks.size).toBe(initialTaskCount + 3);

      // Assert: All subtasks should be in the tasks Map
      expect((project as any).tasks.has(subtask1.id)).toBe(true);
      expect((project as any).tasks.has(subtask2.id)).toBe(true);
      expect((project as any).tasks.has(subtask3.id)).toBe(true);

      // Assert: Event manager should be called for each task
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(4); // parent + 3 subtasks
    });
  });

  describe('Test Case 3: Throw error when non-existent parentId is provided', () => {
    it('should throw an error when parentId is provided but the parent task does not exist', async () => {
      // Setup: Use a non-existent parentId
      const nonExistentParentId = 'non-existent-task-id';
      const params: CreateTaskParams = {
        parentId: nonExistentParentId,
      };
      const initialTaskCount = (project as any).tasks.size;

      // Act & Assert: Should throw an error for orphan prevention
      await expect(project.createNewTask(params)).rejects.toThrow(`Parent task with id ${nonExistentParentId} not found`);

      // Assert: No new task should be created
      expect((project as any).tasks.size).toBe(initialTaskCount);

      // Assert: Event manager should not be called for the failed task creation
      const taskCreationCalls = (mockEventManager.sendTaskCreated as unknown as Mock).mock.calls;
      // Only check calls after the initial setup (INTERNAL_TASK_ID)
      expect(taskCreationCalls.length).toBe(0); // Should only be 0 since no tasks created in this test
    });

    it('should throw an error when parentId references a deleted task', async () => {
      // Setup: Create a parent task, then delete it
      const parentTask = await project.createNewTask();
      const taskId = parentTask.id;

      // Delete the task (simulating deletion)
      await project.deleteTask(taskId);

      // Act: Try to create a subtask with the deleted parent's id
      const params: CreateTaskParams = {
        parentId: taskId,
      };

      // Assert: Should throw an error
      await expect(project.createNewTask(params)).rejects.toThrow(`Parent task with id ${taskId} not found`);

      // Assert: The deleted task should not be in the tasks Map
      expect((project as any).tasks.has(taskId)).toBe(false);
    });

    it('should throw specific error message format', async () => {
      // Setup: Use a non-existent parentId
      const nonExistentParentId = 'invalid-id-12345';
      const params: CreateTaskParams = {
        parentId: nonExistentParentId,
      };

      // Act & Assert: Should throw error with specific format
      await expect(project.createNewTask(params)).rejects.toThrow(`Parent task with id ${nonExistentParentId} not found`);
    });
  });

  describe('Verify tasks Map is correctly updated', () => {
    it('should add new task to this.tasks Map when creating top-level task', async () => {
      // Setup: Get initial task count
      const initialTaskCount = (project as any).tasks.size;
      expect((project as any).tasks.has(INTERNAL_TASK_ID)).toBe(true);

      // Act: Create a new task
      const task = await project.createNewTask();

      // Assert: Task count should increase by 1
      expect((project as any).tasks.size).toBe(initialTaskCount + 1);

      // Assert: The new task should be in the Map
      expect((project as any).tasks.has(task.id)).toBe(true);

      // Assert: The task object in the Map should have correct properties
      const storedTask = (project as any).tasks.get(task.id);
      expect(storedTask).toBeDefined();
      expect(storedTask?.task.id).toBe(task.id);
      expect(storedTask?.task.baseDir).toBe(baseDir);
    });

    it('should add new task to this.tasks Map when creating subtask', async () => {
      // Setup: Create parent task
      const parentTask = await project.createNewTask();
      const initialTaskCount = (project as any).tasks.size;

      // Act: Create a subtask
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: Task count should increase by 1
      expect((project as any).tasks.size).toBe(initialTaskCount + 1);

      // Assert: The subtask should be in the Map
      expect((project as any).tasks.has(subtask.id)).toBe(true);

      // Assert: Both parent and subtask should be in the Map
      expect((project as any).tasks.has(parentTask.id)).toBe(true);
      expect((project as any).tasks.has(subtask.id)).toBe(true);

      // Assert: Subtask should have correct parentId in the stored task
      const storedSubtask = (project as any).tasks.get(subtask.id);
      expect(storedSubtask?.task.parentId).toBe(parentTask.id);
    });

    it('should NOT add task to this.tasks Map when parentId is invalid', async () => {
      // Setup: Get initial task count
      const initialTaskCount = (project as any).tasks.size;
      const invalidParentId = 'invalid-task-id';

      // Act: Try to create a task with invalid parentId
      await expect(project.createNewTask({ parentId: invalidParentId })).rejects.toThrow();

      // Assert: Task count should NOT increase
      expect((project as any).tasks.size).toBe(initialTaskCount);

      // Assert: No new task should be in the Map
      const taskIds = Array.from((project as any).tasks.keys());
      expect(taskIds).not.toContain(invalidParentId);
    });
  });

  describe('Verify INTERNAL_TASK_ID handling', () => {
    it('should have INTERNAL_TASK_ID prepared in constructor', async () => {
      // Assert: INTERNAL_TASK_ID should be in the tasks Map
      expect((project as any).tasks.has(INTERNAL_TASK_ID)).toBe(true);

      const internalTask = (project as any).tasks.get(INTERNAL_TASK_ID);
      expect(internalTask).toBeDefined();
      expect(internalTask?.task.id).toBe(INTERNAL_TASK_ID);
    });

    it('should keep INTERNAL_TASK_ID when creating new tasks', async () => {
      // Setup: Verify internal task exists
      expect((project as any).tasks.has(INTERNAL_TASK_ID)).toBe(true);

      // Act: Create a new task
      const newTask = await project.createNewTask();

      // Assert: INTERNAL_TASK_ID should still be present
      expect((project as any).tasks.has(INTERNAL_TASK_ID)).toBe(true);

      // Assert: New task should have different ID
      expect(newTask.id).not.toBe(INTERNAL_TASK_ID);

      // Assert: Both tasks should be in the Map
      expect((project as any).tasks.size).toBeGreaterThan(1);
    });
  });

  describe('eventManager.sendTaskCreated verification', () => {
    it('should call eventManager.sendTaskCreated with correct task data for top-level task', async () => {
      // Reset the mock
      mockEventManager.sendTaskCreated = vi.fn();

      // Act: Create a top-level task
      const task = await project.createNewTask();

      // Assert: sendTaskCreated should be called exactly once
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(1);

      // Assert: sendTaskCreated should be called with the task data
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);

      // Assert: The passed task should have correct properties
      const calledWith = (mockEventManager.sendTaskCreated as unknown as Mock).mock.calls[0][0];
      expect(calledWith.id).toBe(task.id);
      expect(calledWith.parentId).toBeNull();
      expect(calledWith.baseDir).toBe(baseDir);
      expect(calledWith.mainModel).toBe(task.mainModel);
    });

    it('should call eventManager.sendTaskCreated with correct task data for subtask', async () => {
      // Setup: Create parent task and reset event manager mock
      const parentTask = await project.createNewTask();
      mockEventManager.sendTaskCreated = vi.fn();

      // Act: Create a subtask
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: sendTaskCreated should be called exactly once
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(1);

      // Assert: sendTaskCreated should be called with the task data
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(subtask, undefined);

      // Assert: The passed task should have correct properties including parentId
      const calledWith = (mockEventManager.sendTaskCreated as unknown as Mock).mock.calls[0][0];
      expect(calledWith.id).toBe(subtask.id);
      expect(calledWith.parentId).toBe(parentTask.id);
      expect(calledWith.baseDir).toBe(baseDir);
    });

    it('should NOT call eventManager.sendTaskCreated when task creation fails', async () => {
      // Setup: Reset the mock
      mockEventManager.sendTaskCreated = vi.fn();
      const invalidParentId = 'non-existent-id';

      // Act: Try to create a task with invalid parentId
      await expect(project.createNewTask({ parentId: invalidParentId })).rejects.toThrow();

      // Assert: sendTaskCreated should NOT be called
      expect(mockEventManager.sendTaskCreated).not.toHaveBeenCalled();
    });

    it('should call sendTaskCreated with the exact task object returned by createNewTask', async () => {
      // Act: Create a task
      const task = await project.createNewTask();

      // Assert: sendTaskCreated should be called with the exact same task data
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);
    });
  });
});

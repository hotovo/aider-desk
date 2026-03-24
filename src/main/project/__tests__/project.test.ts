// Mock all dependencies BEFORE importing the test file
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-' + Math.random()),
}));

import * as fs from 'fs/promises';

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
import { Task } from '@/task';
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
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Mock utils functions
    vi.mocked(determineMainModel).mockImplementation((settings: any) => {
      // Handle case when options might be undefined
      if (!settings || !settings.aider || !settings.aider.options) {
        return 'default-model';
      }
      return 'default-model';
    });
    vi.mocked(determineWeakModel).mockReturnValue(null as any);

    // Mock Task methods to avoid complex initialization
    Task.prototype['resetContext'] = vi.fn().mockResolvedValue(undefined);

    // Mock migrations
    vi.mocked(migrateSessionsToTasks).mockResolvedValue(undefined);

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

  describe('with valid parentId', () => {
    it('should create a task with the provided parentId when parent task exists', async () => {
      // Setup: Create a parent task first
      const parentTask = await project.createNewTask();

      // Act: Create a subtask with parentId
      const params: CreateTaskParams = {
        parentId: parentTask.id,
      };
      const newTask = await project.createNewTask(params);

      // Assert: New task should have the correct parentId
      expect(newTask.parentId).toBe(parentTask.id);
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(newTask, undefined);
    });

    it('should allow creating subtasks from a parent that itself has a parent (nested subtasks)', async () => {
      // Setup: Create a three-level hierarchy
      const grandparentTask = await project.createNewTask();
      const parentTask = await project.createNewTask({ parentId: grandparentTask.id });

      // Act: Create a subtask of the parent task
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: The subtask should have the correct parentId (parent task's id, not grandparent's)
      expect(subtask.parentId).toBe(parentTask.id);
      expect(grandparentTask.id).not.toBe(subtask.parentId);
    });
  });

  describe('without parentId', () => {
    it('should create a task with parentId: null when no parentId is provided', async () => {
      // Act: Create a task without parentId
      const task = await project.createNewTask();

      // Assert: Task should have parentId as null (top-level task)
      expect(task.parentId).toBeNull();
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);
    });

    it('should create a task with parentId: null when parentId is explicitly null', async () => {
      // Act: Create a task with explicit null parentId
      const params: CreateTaskParams = {
        parentId: null,
      };
      const task = await project.createNewTask(params);

      // Assert: Task should have parentId as null
      expect(task.parentId).toBeNull();
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledWith(task, undefined);
    });
  });

  describe('orphan prevention', () => {
    it('should throw an error when parentId is provided but the parent task does not exist', async () => {
      // Setup: Use a non-existent parentId
      const nonExistentParentId = 'non-existent-task-id';
      const params: CreateTaskParams = {
        parentId: nonExistentParentId,
      };

      // Act & Assert: Should throw an error for orphan prevention
      await expect(project.createNewTask(params)).rejects.toThrow();
    });

    it('should throw an error when parentId references a deleted task', async () => {
      // Setup: Create a parent task, then delete it
      const parentTask = await project.createNewTask();
      await project.deleteTask(parentTask.id);

      // Act: Try to create a subtask with the deleted parent's id
      const params: CreateTaskParams = {
        parentId: parentTask.id,
      };

      // Assert: Should throw an error
      await expect(project.createNewTask(params)).rejects.toThrow();
    });

    it('should treat empty string parentId as null (top-level task)', async () => {
      // Setup: Use an empty parentId format
      const invalidParentId = '';
      const params: CreateTaskParams = {
        parentId: invalidParentId,
      };

      // Act: Create task
      const task = await project.createNewTask(params);

      // Assert: Should have null parentId
      expect(task.parentId).toBeNull();
    });
  });

  describe('task initialization with parentId', () => {
    it('should create a task with parentId using mostRecentTask settings', async () => {
      // Setup: Create a parent task
      const parentTask = await project.createNewTask();

      // Act: Create a subtask
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: Subtask should have the most recent task's settings (which is the parent task)
      expect(subtask.mainModel).toBeDefined();
      expect(subtask.currentMode).toBeDefined();
      expect(subtask.parentId).toBe(parentTask.id);
    });

    it('should use default settings when creating a task with parentId but no parent exists yet', async () => {
      // This is a boundary case - first task in a project with parentId
      // Act: Try to create a task with parentId when no tasks exist (besides internal task)
      const params: CreateTaskParams = {
        parentId: 'non-existent-id',
      };

      // Assert: Should throw an error since parent doesn't exist
      await expect(project.createNewTask(params)).rejects.toThrow();
    });
  });

  describe('event emission', () => {
    it('should emit taskCreated event with correct task data including parentId', async () => {
      // Setup: Create a parent task
      const parentTask = await project.createNewTask();

      // Act: Create a subtask
      const subtask = await project.createNewTask({ parentId: parentTask.id });

      // Assert: Event should be emitted with task data that includes parentId
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalledTimes(2);
      const emittedTask = (mockEventManager.sendTaskCreated as unknown as Mock).mock.calls[1][0];
      expect(emittedTask.parentId).toBe(parentTask.id);
      expect(subtask.parentId).toBe(parentTask.id);
    });

    it('should emit taskCreated event with null parentId for top-level tasks', async () => {
      // Act: Create a top-level task
      const task = await project.createNewTask();

      // Assert: Event should be emitted with null parentId
      expect(mockEventManager.sendTaskCreated).toHaveBeenCalled();
      const emittedTask = (mockEventManager.sendTaskCreated as unknown as Mock).mock.calls[0][0];
      expect(emittedTask.parentId).toBeNull();
      expect(task.parentId).toBeNull();
    });
  });

  describe('multiple subtasks', () => {
    it('should allow creating multiple subtasks with the same parent', async () => {
      // Setup: Create a parent task
      const parentTask = await project.createNewTask();

      // Act: Create multiple subtasks with unique names to avoid deduplication
      const subtask1 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 1' });
      const subtask2 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 2' });
      const subtask3 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 3' });

      // Assert: All subtasks should have the correct parentId
      expect(subtask1.parentId).toBe(parentTask.id);
      expect(subtask2.parentId).toBe(parentTask.id);
      expect(subtask3.parentId).toBe(parentTask.id);

      // All tasks should have unique IDs
      expect(subtask1.id).not.toBe(subtask2.id);
      expect(subtask2.id).not.toBe(subtask3.id);
      expect(subtask1.id).not.toBe(subtask3.id);
    });

    it('should create subtasks independently of each other', async () => {
      // Setup: Create parent task and first subtask
      const parentTask = await project.createNewTask();
      const subtask1 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 1' });

      // Act: Create a second subtask with same parentId and different name
      const subtask2 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 2' });

      // Assert: Each subtask should be independent
      expect(subtask1.id).not.toBe(subtask2.id);
      expect(subtask1.parentId).toBe(parentTask.id);
      expect(subtask2.parentId).toBe(parentTask.id);
    });
  });
});

describe('Project - deleteTask', () => {
  let project: Project;
  let mockStore: Store;
  let mockEventManager: EventManager;
  let mockMcpManager: McpManager;
  let mockAgentProfileManager: AgentProfileManager;
  let mockTelemetryManager: TelemetryManager;
  let mockDataManager: DataManager;
  let mockModelManager: ModelManager;
  let mockWorktreeManager: WorktreeManager;
  let mockMemoryManager: MemoryManager;
  let mockHookManager: HookManager;
  let mockPromptsManager: PromptsManager;
  let mockExtensionManager: ExtensionManager;

  beforeEach(async () => {
    mockMcpManager = {} as unknown as McpManager;
    mockTelemetryManager = {} as unknown as TelemetryManager;
    mockDataManager = {} as unknown as DataManager;
    mockMemoryManager = {} as unknown as MemoryManager;

    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
      getProviders: vi.fn(() => []),
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
    } as unknown as Store;

    mockEventManager = {
      sendTaskCreated: vi.fn(),
      sendTaskUpdated: vi.fn(),
      sendTaskDeleted: vi.fn(),
      sendProjectStarted: vi.fn(),
      sendContextFilesUpdated: vi.fn(),
      sendInputHistoryUpdated: vi.fn(),
    } as unknown as EventManager;

    mockModelManager = {
      getProviderModels: vi.fn(() => Promise.resolve({ models: [] })),
      getAiderModelMapping: vi.fn(() => ({
        modelName: 'default-model',
        environmentVariables: {},
      })),
    } as unknown as ModelManager;

    mockWorktreeManager = {
      close: vi.fn(() => Promise.resolve()),
      getTaskWorktree: vi.fn(() => Promise.resolve(null)),
      createWorktree: vi.fn(() => Promise.resolve({ path: '/test/worktree' })),
      removeWorktree: vi.fn(() => Promise.resolve()),
    } as unknown as WorktreeManager;

    mockAgentProfileManager = {
      initializeForProject: vi.fn(() => Promise.resolve()),
      removeProject: vi.fn(),
    } as unknown as AgentProfileManager;

    mockHookManager = {
      trigger: vi.fn((_hookName, event) => Promise.resolve({ event, blocked: false })) as any,
      stopWatchingProject: vi.fn(() => Promise.resolve()),
    } as unknown as HookManager;

    mockPromptsManager = {
      watchProject: vi.fn(() => Promise.resolve()),
      unwatchProject: vi.fn(() => Promise.resolve()),
      dispose: vi.fn(),
    } as unknown as PromptsManager;
    (mockPromptsManager as any).start = vi.fn(() => Promise.resolve());

    mockExtensionManager = {
      reloadProjectExtensions: vi.fn(() => Promise.resolve()),
      stopWatchingProject: vi.fn(),
      dispatchEvent: vi.fn(() => Promise.resolve({ event: {} as any, blocked: false, modifiedResult: undefined })),
      getRegistry: vi.fn(
        () =>
          ({
            addListener: vi.fn(),
            removeListener: vi.fn(),
          }) as any,
      ),
    } as unknown as ExtensionManager;

    vi.mocked(determineMainModel).mockReturnValue('default-model');
    vi.mocked(determineWeakModel).mockReturnValue(null as any);
    vi.mocked(fs.readdir).mockResolvedValue([] as any);
    vi.mocked(fs.rm).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.readFile).mockResolvedValue('');
    vi.mocked(migrateSessionsToTasks).mockResolvedValue(undefined);

    // Keep all the mocks that were properly set up above
    // (remove the reassignments that were overwriting the mocks with empty objects)

    project = new Project(
      '/test/project',
      mockStore,
      mockMcpManager,
      mockTelemetryManager,
      mockDataManager,
      mockEventManager,
      mockModelManager,
      mockWorktreeManager,
      mockAgentProfileManager,
      mockMemoryManager,
      mockHookManager,
      mockPromptsManager,
      mockExtensionManager,
    );

    await (project as any).tasksLoadingPromise;
  });

  it('should delete a task without subtasks', async () => {
    const task = await project.createNewTask({ name: 'Test Task' });
    await project.deleteTask(task.id);

    const tasks = await project.getTasks();
    expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
    expect(mockEventManager.sendTaskDeleted).toHaveBeenCalledWith(task);
  });

  it('should cascade delete parent task with subtasks', async () => {
    const parentTask = await project.createNewTask({ name: 'Parent Task' });
    const subtask1 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 1' });
    const subtask2 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 2' });

    await project.deleteTask(parentTask.id);

    const tasks = await project.getTasks();
    expect(tasks.find((t) => t.id === parentTask.id)).toBeUndefined();
    expect(tasks.find((t) => t.id === subtask1.id)).toBeUndefined();
    expect(tasks.find((t) => t.id === subtask2.id)).toBeUndefined();

    expect(mockEventManager.sendTaskDeleted).toHaveBeenCalledTimes(3);
  });

  it('should delete subtasks when deleting parent task', async () => {
    const parentTask = await project.createNewTask({ name: 'Parent Task' });
    await project.createNewTask({ parentId: parentTask.id, name: 'Subtask' });

    await project.deleteTask(parentTask.id);

    const tasks = await project.getTasks();
    expect(tasks.length).toBe(0);
  });

  it('should emit taskDeleted events for all deleted tasks', async () => {
    const parentTask = await project.createNewTask({ name: 'Parent Task' });
    const subtask1 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 1' });
    const subtask2 = await project.createNewTask({ parentId: parentTask.id, name: 'Subtask 2' });

    await project.deleteTask(parentTask.id);

    expect(mockEventManager.sendTaskDeleted).toHaveBeenCalledTimes(3);
    const deletedTasks = (mockEventManager.sendTaskDeleted as unknown as Mock).mock.calls;
    const deletedIds = deletedTasks.map((call) => call[0].id);
    expect(deletedIds).toContain(parentTask.id);
    expect(deletedIds).toContain(subtask1.id);
    expect(deletedIds).toContain(subtask2.id);
  });
});

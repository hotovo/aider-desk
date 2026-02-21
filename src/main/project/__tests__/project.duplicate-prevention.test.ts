import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskData } from '@common/types';

import { Project } from '../project';

import { INTERNAL_TASK_ID } from '@/task';

// Mock dependencies
vi.mock('@/logger');
vi.mock('@/store');
vi.mock('@/agent');
vi.mock('@/telemetry');
vi.mock('@/data-manager');
vi.mock('@/events');
vi.mock('@/models');
vi.mock('@/worktrees');
vi.mock('@/memory/memory-manager');
vi.mock('@/hooks/hook-manager');
vi.mock('@/prompts');
vi.mock('@/extensions/extension-manager');
vi.mock('@/task/aider-manager');
vi.mock('@/task/context-manager');
vi.mock('@/project/migrations');
vi.mock('fs/promises', () => {
  const mockFs = {
    stat: vi.fn().mockResolvedValue({}),
    readdir: vi.fn().mockResolvedValue([]),
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue('{}'),
    rm: vi.fn().mockResolvedValue(undefined),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

describe('Project Duplicate Subtask Prevention', () => {
  let project: Project;
  let mockStore: any;
  let mockModelManager: any;
  let mockWorktreeManager: any;
  let mockEventManager: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStore = {
      getSettings: vi.fn(() => ({
        taskSettings: {},
        aider: {},
      })),
      getProviders: vi.fn(() => []),
      getProjectSettings: vi.fn(() => ({})),
    };

    mockModelManager = {
      getProviderModels: vi.fn().mockResolvedValue({ models: [] }),
    };

    mockWorktreeManager = {
      getTaskWorktree: vi.fn().mockResolvedValue(null),
    };

    mockEventManager = {
      sendTaskCreated: vi.fn(),
    };

    project = new Project(
      '/test/dir',
      mockStore as any,
      {} as any,
      {} as any,
      {} as any,
      mockEventManager as any,
      mockModelManager as any,
      mockWorktreeManager as any,
      { initializeForProject: vi.fn() } as any,
      {} as any,
      { trigger: vi.fn().mockResolvedValue({ event: {}, blocked: false }) } as any,
      { watchProject: vi.fn() } as any,
      {
        reloadProjectExtensions: vi.fn(),
        stopWatchingProject: vi.fn(),
        dispatchEvent: vi.fn(() => Promise.resolve({ event: {}, blocked: false, modifiedResult: undefined })),
      } as any,
    );

    // Mock INTERNAL_TASK_ID
    const internalTask = {
      getContextFiles: vi.fn().mockResolvedValue([]),
    };
    (project as any).getTask = vi.fn((id) => {
      if (id === INTERNAL_TASK_ID) {
        return internalTask;
      }
      return (project as any).tasks.get(id);
    });
  });

  it('should create a new subtask if existing one has a name', async () => {
    const parentId = 'parent-123';
    const parentTask = {
      task: {
        id: parentId,
        mainModel: 'test-model',
      } as TaskData,
    };

    (project as any).tasks.set(parentId, parentTask);

    const existingSubtaskId = 'existing-subtask-id';
    const existingSubtask = {
      taskId: existingSubtaskId,
      task: {
        id: existingSubtaskId,
        parentId: parentId,
        name: 'Existing Task', // Not default name
        archived: false,
      } as TaskData,
      getContextMessages: vi.fn().mockResolvedValue([]),
    };
    (project as any).tasks.set(existingSubtaskId, existingSubtask);

    // Mock prepareTask to return a new task
    const newSubtaskId = 'new-subtask-id';
    vi.spyOn(project as any, 'prepareTask').mockReturnValue({
      task: { id: newSubtaskId, parentId },
      hookManager: { trigger: vi.fn().mockResolvedValue({}) },
      addFiles: vi.fn(),
    });

    const result = await project.createNewTask({ parentId });

    expect(result.id).toBe(newSubtaskId);
  });

  it('should create a new subtask if existing one has messages', async () => {
    const parentId = 'parent-123';
    const parentTask = {
      task: {
        id: parentId,
        mainModel: 'test-model',
      } as TaskData,
    };

    (project as any).tasks.set(parentId, parentTask);

    const existingSubtaskId = 'existing-subtask-id';
    const existingSubtask = {
      taskId: existingSubtaskId,
      task: {
        id: existingSubtaskId,
        parentId: parentId,
        name: '',
        archived: false,
      } as TaskData,
      getContextMessages: vi.fn().mockResolvedValue([{ role: 'user', content: 'hello' }]), // Not empty
    };
    (project as any).tasks.set(existingSubtaskId, existingSubtask);

    const newSubtaskId = 'new-subtask-id';
    vi.spyOn(project as any, 'prepareTask').mockReturnValue({
      task: { id: newSubtaskId, parentId },
      hookManager: { trigger: vi.fn().mockResolvedValue({}) },
      addFiles: vi.fn(),
    });

    const result = await project.createNewTask({ parentId });

    expect(result.id).toBe(newSubtaskId);
  });

  it('should create a new subtask if existing one is archived', async () => {
    const parentId = 'parent-123';
    const parentTask = {
      task: {
        id: parentId,
        mainModel: 'test-model',
      } as TaskData,
    };

    (project as any).tasks.set(parentId, parentTask);

    const existingSubtaskId = 'existing-subtask-id';
    const existingSubtask = {
      taskId: existingSubtaskId,
      task: {
        id: existingSubtaskId,
        parentId: parentId,
        name: '',
        archived: true, // Archived
      } as TaskData,
      getContextMessages: vi.fn().mockResolvedValue([]),
    };
    (project as any).tasks.set(existingSubtaskId, existingSubtask);

    const newSubtaskId = 'new-subtask-id';
    vi.spyOn(project as any, 'prepareTask').mockReturnValue({
      task: { id: newSubtaskId, parentId },
      hookManager: { trigger: vi.fn().mockResolvedValue({}) },
      addFiles: vi.fn(),
    });

    const result = await project.createNewTask({ parentId });

    expect(result.id).toBe(newSubtaskId);
  });
});

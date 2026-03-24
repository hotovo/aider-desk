import * as fs from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskData, Worktree } from '@common/types';

import { Project } from '../project';

import { INTERNAL_TASK_ID, Task } from '@/task';

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
vi.mock('fs/promises');
vi.mock('@/utils', () => ({
  determineMainModel: vi.fn(() => 'default-model'),
  determineWeakModel: vi.fn(() => null),
}));
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-task-id'),
}));

describe('Project Inheritance', () => {
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
        aider: {
          options: '',
        },
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

    // Mock fs.stat to avoid unhandled rejections in Task.loadTaskData
    vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));
    vi.mocked(fs.readdir).mockResolvedValue([]);
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Mock Task methods to avoid complex initialization
    Task.prototype['resetContext'] = vi.fn().mockResolvedValue(undefined);

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
        getRegistry: vi.fn(() => ({
          addListener: vi.fn(),
          removeListener: vi.fn(),
        })),
      } as any,
    );

    // Mock prepareTask to return a mock Task
    (project as any).prepareTask = vi.fn((id, data) => ({
      task: { id: id || 'test-task-id', ...data },
      hookManager: { trigger: vi.fn().mockResolvedValue({}) },
      addFiles: vi.fn(),
      resetContext: vi.fn().mockResolvedValue(undefined),
    }));

    // Mock INTERNAL_TASK_ID
    const internalTask = {
      getContextFiles: vi.fn().mockResolvedValue([]),
    };
    (project as any).getTask = vi.fn((id) => {
      if (id === INTERNAL_TASK_ID) {
        return internalTask;
      }
      return null;
    });
  });

  it('should inherit worktree and workingMode from parent', async () => {
    const parentWorktree: Worktree = { path: '/path/to/worktree', baseBranch: 'main' };
    const parentTask = {
      task: {
        id: 'parent-id',
        workingMode: 'worktree',
        worktree: parentWorktree,
        mainModel: 'parent-model',
      } as TaskData,
    };

    const internalTask = (project as any).getTask(INTERNAL_TASK_ID);
    (project as any).getTask = vi.fn((id) => {
      if (id === 'parent-id') {
        return parentTask;
      }
      if (id === INTERNAL_TASK_ID) {
        return internalTask;
      }
      return null;
    });

    const subtask = await project.createNewTask({ parentId: 'parent-id' });

    expect(subtask.parentId).toBe('parent-id');
    expect(subtask.workingMode).toBe('worktree');
    expect(subtask.worktree).toEqual(parentWorktree);
    expect(subtask.mainModel).toBe('parent-model');
  });

  it('should handle empty string parentId as null', async () => {
    // This should NOT throw an error if implemented correctly
    const task = await project.createNewTask({ parentId: '' });
    expect(task.parentId).toBeNull();
  });
});

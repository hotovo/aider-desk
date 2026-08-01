import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultTaskState, TaskData } from '@common/types';

import { Project } from '../project';

const createTaskData = (id: string, state?: DefaultTaskState): TaskData => ({
  id,
  baseDir: '/test/project',
  name: id,
  archived: false,
  aiderTotalCost: 0,
  agentTotalCost: 0,
  mainModel: '',
  currentMode: 'agent',
  weakModelLocked: false,
  parentId: null,
  state,
});

describe('Project - reloadTasks', () => {
  let project: Project;
  let tasks: Map<string, { task: TaskData; reloadFromDisk: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }>;
  let eventManager: {
    sendTaskCreated: ReturnType<typeof vi.fn>;
    sendTaskDeleted: ReturnType<typeof vi.fn>;
    sendTaskUpdated: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    tasks = new Map();
    eventManager = {
      sendTaskCreated: vi.fn(),
      sendTaskDeleted: vi.fn(),
      sendTaskUpdated: vi.fn(),
    };
    project = Object.create(Project.prototype) as Project;
    Object.assign(project, {
      tasks,
      tasksLoadingPromise: Promise.resolve(),
      eventManager,
    });
  });

  it('reconciles new, changed, removed, and unchanged tasks', async () => {
    const changedTask = {
      task: createTaskData('changed'),
      reloadFromDisk: vi.fn().mockResolvedValue({ taskDataChanged: true, contextChanged: false }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const unchangedTask = {
      task: createTaskData('unchanged'),
      reloadFromDisk: vi.fn().mockResolvedValue({ taskDataChanged: false, contextChanged: false }),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const removedTask = {
      task: createTaskData('removed'),
      reloadFromDisk: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
    const inProgressTask = {
      task: createTaskData('in-progress', DefaultTaskState.InProgress),
      reloadFromDisk: vi.fn(),
      close: vi.fn(),
    };
    const newTask = {
      task: createTaskData('new'),
      reloadFromDisk: vi.fn(),
      close: vi.fn(),
    };

    tasks.set('changed', changedTask);
    tasks.set('unchanged', unchangedTask);
    tasks.set('removed', removedTask);
    tasks.set('in-progress', inProgressTask);
    const projectInternals = project as unknown as {
      getTaskIdsFromDisk: () => Promise<string[]>;
      prepareTask: () => Promise<typeof newTask>;
    };
    vi.spyOn(projectInternals, 'getTaskIdsFromDisk').mockResolvedValue(['changed', 'unchanged', 'in-progress', 'new']);
    vi.spyOn(projectInternals, 'prepareTask').mockImplementation(async () => {
      tasks.set(newTask.task.id, newTask);
      return newTask;
    });

    const result = await project.reloadTasks();

    expect(result).toEqual([changedTask.task, unchangedTask.task, inProgressTask.task, newTask.task]);
    expect(changedTask.reloadFromDisk).toHaveBeenCalledOnce();
    expect(unchangedTask.reloadFromDisk).toHaveBeenCalledOnce();
    expect(inProgressTask.reloadFromDisk).not.toHaveBeenCalled();
    expect(removedTask.close).toHaveBeenCalledWith(false, false);
    expect(removedTask.task).not.toBeUndefined();
    expect(eventManager.sendTaskUpdated).toHaveBeenCalledWith(changedTask.task);
    expect(eventManager.sendTaskCreated).toHaveBeenCalledWith(newTask.task);
    expect(eventManager.sendTaskDeleted).toHaveBeenCalledWith(removedTask.task);
  });

  it('does not remove an in-progress task whose folder disappeared', async () => {
    const task = {
      task: createTaskData('in-progress', DefaultTaskState.InProgress),
      reloadFromDisk: vi.fn(),
      close: vi.fn(),
    };
    tasks.set('in-progress', task);
    const projectInternals = project as unknown as {
      getTaskIdsFromDisk: () => Promise<string[]>;
    };
    vi.spyOn(projectInternals, 'getTaskIdsFromDisk').mockResolvedValue([]);

    await project.reloadTasks();

    expect(tasks.get('in-progress')).toBe(task);
    expect(task.close).not.toHaveBeenCalled();
    expect(eventManager.sendTaskDeleted).not.toHaveBeenCalled();
  });
});

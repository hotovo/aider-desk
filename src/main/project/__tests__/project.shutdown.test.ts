import fs from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Project } from '../project';
import { ProjectManager } from '../project-manager';

import logger from '@/logger';
import { AIDER_DESK_WATCH_FILES_LOCK } from '@/constants';

vi.mock('@/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } }));
vi.mock('@/project', () => ({ Project: vi.fn() }));
vi.mock('@/task', () => ({ Task: vi.fn(), INTERNAL_TASK_ID: 'internal' }));
vi.mock('@/custom-commands', () => ({ CustomCommandManager: vi.fn() }));
vi.mock('@/file-watcher-manager', () => ({ FileWatcherManager: vi.fn() }));
vi.mock('@/project/migrations', () => ({ migrateSessionsToTasks: vi.fn() }));
vi.mock('@/utils', () => ({ determineMainModel: vi.fn(), determineWeakModel: vi.fn() }));
vi.mock('fs/promises', () => ({ default: { unlink: vi.fn() } }));

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const createTask = (taskId: string) => ({ taskId, close: vi.fn().mockResolvedValue(undefined) });

const createProject = (tasks: ReturnType<typeof createTask>[]) => {
  const dependencies = {
    baseDir: '/test/project',
    startPromise: null,
    tasks: new Map(tasks.map((task) => [task.taskId, task])),
    customCommandManager: { dispose: vi.fn() },
    fileWatcherManager: { dispose: vi.fn().mockResolvedValue(undefined) },
    agentProfileManager: { removeProject: vi.fn() },
    mcpConfigManager: { removeProject: vi.fn() },
    promptsManager: { unwatchProject: vi.fn().mockResolvedValue(undefined) },
    extensionManager: {
      dispatchEvent: vi.fn().mockResolvedValue({}),
      stopProjectWatcher: vi.fn().mockResolvedValue(undefined),
    },
    gitManager: { close: vi.fn().mockResolvedValue(undefined) },
  };
  const project = Object.create(Project.prototype) as Project;
  Object.assign(project, dependencies);
  return { project, dependencies };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fs.unlink).mockResolvedValue(undefined);
});

describe('ProjectManager shutdown', () => {
  it('drains sibling projects before reporting all failures with project context', async () => {
    const deferred = createDeferred();
    const firstError = new Error('First project failed');
    const secondError = new Error('Second project failed');
    const projects = [
      { baseDir: '/first', close: vi.fn().mockRejectedValue(firstError) },
      { baseDir: '/pending', close: vi.fn().mockReturnValue(deferred.promise) },
      {
        baseDir: '/second',
        close: vi.fn(() => {
          throw secondError;
        }),
      },
    ];
    const manager = Object.create(ProjectManager.prototype) as ProjectManager;
    Object.assign(manager, { projects });
    const finished = vi.fn();
    const pending = manager.close().then(finished, (error: unknown) => {
      finished();
      return error;
    });

    await vi.waitFor(() => expect(projects[2].close).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    deferred.resolve();
    const error = await pending;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([firstError, secondError]);
    expect(logger.error).toHaveBeenCalledWith('Failed to close project', {
      baseDir: '/first',
      error: firstError.message,
      stack: firstError.stack,
    });
    expect(logger.error).toHaveBeenCalledWith('Failed to close project', {
      baseDir: '/second',
      error: secondError.message,
      stack: secondError.stack,
    });
  });
});

describe('Project shutdown', () => {
  it('drains sibling tasks before Git and lock-file cleanup and reports all task failures', async () => {
    const deferred = createDeferred();
    const firstError = new Error('First task failed');
    const secondError = new Error('Second task failed');
    const tasks = [createTask('first'), createTask('pending'), createTask('second')];
    tasks[0].close.mockRejectedValue(firstError);
    tasks[1].close.mockReturnValue(deferred.promise);
    tasks[2].close.mockImplementation(() => {
      throw secondError;
    });
    const { project, dependencies } = createProject(tasks);
    const finished = vi.fn();
    const pending = project.close().then(finished, (error: unknown) => {
      finished();
      return error;
    });

    await vi.waitFor(() => expect(tasks[2].close).toHaveBeenCalledOnce());
    expect(finished).not.toHaveBeenCalled();
    expect(dependencies.gitManager.close).not.toHaveBeenCalled();
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();

    deferred.resolve();
    const error = await pending;
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([firstError, secondError]);
    expect(dependencies.gitManager.close).toHaveBeenCalledExactlyOnceWith('/test/project');
    expect(fs.unlink).toHaveBeenCalledExactlyOnceWith(`/test/project/${AIDER_DESK_WATCH_FILES_LOCK}`);
    expect(logger.error).toHaveBeenCalledWith('Failed to close task', {
      baseDir: '/test/project',
      taskId: 'first',
      error: firstError.message,
      stack: firstError.stack,
    });
    expect(logger.error).toHaveBeenCalledWith('Failed to close task', {
      baseDir: '/test/project',
      taskId: 'second',
      error: secondError.message,
      stack: secondError.stack,
    });
  });

  it('awaits the project extension watcher before closing tasks', async () => {
    const watcher = createDeferred();
    const task = createTask('task');
    const { project, dependencies } = createProject([task]);
    dependencies.extensionManager.stopProjectWatcher.mockReturnValue(watcher.promise);

    const pending = project.close();
    await vi.waitFor(() => expect(dependencies.extensionManager.stopProjectWatcher).toHaveBeenCalledOnce());
    expect(task.close).not.toHaveBeenCalled();
    expect(dependencies.gitManager.close).not.toHaveBeenCalled();

    watcher.resolve();
    await pending;
    expect(task.close).toHaveBeenCalledOnce();
    expect(dependencies.gitManager.close).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('still removes the lock file and reports Git failure after a task fails', async () => {
    const taskError = new Error('Task failed');
    const gitError = new Error('Git failed');
    const task = createTask('task');
    task.close.mockRejectedValue(taskError);
    const { project, dependencies } = createProject([task]);
    dependencies.gitManager.close.mockRejectedValue(gitError);

    const error: unknown = await project.close().catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([taskError, gitError]);
    expect(fs.unlink).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith('Failed to close project Git manager', {
      baseDir: '/test/project',
      error: gitError.message,
      stack: gitError.stack,
    });
  });
});

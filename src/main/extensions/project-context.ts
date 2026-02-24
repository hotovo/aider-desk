import { TaskContextImpl } from './task-context';

import type { ProjectContext, TaskContext } from '@common/extensions';
import type { CommandsData, CreateTaskParams, ProjectSettings, TaskData } from '@common/types';
import type { Project } from '@/project';

export class ProjectContextImpl implements ProjectContext {
  constructor(private readonly project: Project) {}

  get baseDir(): string {
    return this.project.baseDir;
  }

  async createTask(params: CreateTaskParams): Promise<TaskData> {
    return this.project.createNewTask(params);
  }

  getTask(taskId: string): TaskContext | null {
    const task = this.project.getTask(taskId);
    return task ? new TaskContextImpl(task) : null;
  }

  async getTasks(): Promise<TaskData[]> {
    return this.project.getTasks();
  }

  getMostRecentTask(): TaskContext | null {
    const task = this.project.getMostRecentTask();
    return task ? new TaskContextImpl(task) : null;
  }

  getCommands(): CommandsData {
    return this.project.getCommands();
  }

  getProjectSettings(): ProjectSettings {
    return this.project.getProjectSettings();
  }

  async loadInputHistory(): Promise<string[]> {
    return this.project.loadInputHistory();
  }
}

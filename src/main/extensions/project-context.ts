import { TaskContextImpl } from './task-context';

import type { ProjectContext, TaskContext } from '@common/extensions';
import type { AgentProfile, CommandsData, CreateTaskParams, ProjectSettings, TaskData } from '@common/types';
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

  async forkTask(taskId: string, messageId: string): Promise<TaskData> {
    return this.project.forkTask(taskId, messageId);
  }

  async duplicateTask(taskId: string): Promise<TaskData> {
    return this.project.duplicateTask(taskId);
  }

  async deleteTask(taskId: string): Promise<void> {
    await this.project.deleteTask(taskId);
  }

  getAgentProfiles(): AgentProfile[] {
    return this.project.getAgentProfiles();
  }

  getCommands(): CommandsData {
    return this.project.getCustomCommandManager().getAllCommands();
  }

  getProjectSettings(): ProjectSettings {
    return this.project.getProjectSettings();
  }

  async getInputHistory(): Promise<string[]> {
    return this.project.loadInputHistory();
  }
}

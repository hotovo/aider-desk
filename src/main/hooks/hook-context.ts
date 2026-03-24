import { MessageRole, TaskData } from '@common/types';

import { Task } from '@/task/task';
import { Project } from '@/project/project';

export interface HookContext {
  addInfoMessage: (message: string) => void;
  addWarningMessage: (message: string) => void;
  addErrorMessage: (message: string) => void;
  addLoadingMessage: (message: string, finished?: boolean) => void;
  setTaskName: (name: string) => Promise<void>;
  addContextMessage: (role: 'user' | 'assistant', content: string) => Promise<void>;
  task: Task;
  project: Project;
  taskData: TaskData;
  projectDir: string;
}

export class HookContextImpl implements HookContext {
  constructor(
    public readonly task: Task,
    public readonly project: Project,
  ) {}

  addInfoMessage(message: string) {
    this.task.addLogMessage('info', message);
  }

  addWarningMessage(message: string) {
    this.task.addLogMessage('warning', message);
  }

  addErrorMessage(message: string) {
    this.task.addLogMessage('error', message);
  }

  addLoadingMessage(message: string, finished = false) {
    this.task.addLogMessage('loading', message, finished);
  }

  async setTaskName(name: string) {
    await this.task.saveTask({ name });
  }

  async addContextMessage(role: 'user' | 'assistant', content: string) {
    await this.task.addRoleContextMessage(role === 'user' ? MessageRole.User : MessageRole.Assistant, content);
  }

  get taskData() {
    return this.task.task;
  }

  get projectDir() {
    return this.task.getProjectDir();
  }
}

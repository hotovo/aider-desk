import type { TaskContext } from '@common/extensions';
import type { ContextFile, ContextMessage, DefaultTaskState, TodoItem } from '@common/types';
import type { Task } from '@/task';

export class TaskContextImpl implements TaskContext {
  constructor(private readonly task: Task) {}

  get id(): string {
    return this.task.task.id;
  }

  get name(): string {
    return this.task.task.name;
  }

  get state(): DefaultTaskState | undefined {
    return this.task.task.state as DefaultTaskState | undefined;
  }

  get baseDir(): string {
    return this.task.task.baseDir;
  }

  get parentId(): string | null {
    return this.task.task.parentId ?? null;
  }

  async getContextFiles(): Promise<ContextFile[]> {
    return this.task.getContextFiles();
  }

  async addFile(path: string, readOnly = false): Promise<void> {
    await this.task.addFiles({ path, readOnly });
  }

  async addFiles(...files: ContextFile[]): Promise<void> {
    await this.task.addFiles(...files);
  }

  async dropFile(path: string): Promise<void> {
    await this.task.dropFile(path);
  }

  async getContextMessages(): Promise<ContextMessage[]> {
    return this.task.getContextMessages();
  }

  async addMessage(content: string, role: 'user' | 'assistant' = 'user'): Promise<void> {
    const { MessageRole } = await import('@common/types');
    const messageRole = role === 'user' ? MessageRole.User : MessageRole.Assistant;
    await this.task.addRoleContextMessage(messageRole, content);
  }

  async getAddableFiles(searchRegex?: string): Promise<string[]> {
    return this.task.getAddableFiles(searchRegex);
  }

  getRepoMap(): string {
    return this.task.getRepoMap();
  }

  async getTodos(): Promise<TodoItem[]> {
    return this.task.getTodos();
  }

  async addTodo(name: string): Promise<TodoItem[]> {
    return this.task.addTodo(name);
  }

  async updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    return this.task.updateTodo(name, updates);
  }

  async deleteTodo(name: string): Promise<TodoItem[]> {
    return this.task.deleteTodo(name);
  }

  async generateContextMarkdown(): Promise<string | null> {
    return this.task.generateContextMarkdown();
  }

  isInitialized(): boolean {
    return this.task.isInitialized();
  }
}

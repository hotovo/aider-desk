import { v4 as uuidv4 } from 'uuid';
import { Task } from '@common/types';

export class TaskManager {
  private tasks: Map<string, Task> = new Map();

  async prepareTasks(titles: string[]): Promise<Task[]> {
    this.tasks.clear();
    const newTasks: Task[] = [];
    for (const title of titles) {
      const taskId = uuidv4();
      const newTask: Task = {
        id: taskId,
        title,
        completed: false,
      };
      this.tasks.set(taskId, newTask);
      newTasks.push(newTask);
    }
    return newTasks;
  }

  async getTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values());
  }

  async updateTask(taskId: string, updates: { title?: string; completed?: boolean }): Promise<Task | undefined> {
    const task = this.tasks.get(taskId);
    if (task) {
      if (updates.title !== undefined) {
        task.title = updates.title;
      }
      if (updates.completed !== undefined) {
        task.completed = updates.completed;
      }
      // No need to re-set task in map as it's a reference type and modified in place.
      return task;
    }
    return undefined;
  }
}

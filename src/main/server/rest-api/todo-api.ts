import { Router } from 'express';
import { z } from 'zod';

import { BaseApi } from './base-api';

import { EventsHandler } from '@/events-handler';

const GetTodosSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
});

const AddTodoSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Todo name is required'),
});

const UpdateTodoSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Todo name is required'),
  updates: z.object({
    name: z.string().optional(),
    completed: z.boolean().optional(),
  }),
});

const DeleteTodoSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  name: z.string().min(1, 'Todo name is required'),
});

const ClearAllTodosSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  taskId: z.string().min(1, 'Task ID is required'),
});

export class TodoApi extends BaseApi {
  constructor(private readonly eventsHandler: EventsHandler) {
    super();
  }

  registerRoutes(router: Router): void {
    // Get todos
    router.get(
      '/project/todos',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(GetTodosSchema, req.query, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const todos = await this.eventsHandler.getTodos(projectDir, taskId);
        res.status(200).json(todos);
      }),
    );

    // Add todo
    router.post(
      '/project/todo/add',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(AddTodoSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, name } = parsed;
        const todos = await this.eventsHandler.addTodo(projectDir, taskId, name);
        res.status(200).json(todos);
      }),
    );

    // Update todo
    router.patch(
      '/project/todo/update',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(UpdateTodoSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, name, updates } = parsed;
        const todos = await this.eventsHandler.updateTodo(projectDir, taskId, name, updates);
        res.status(200).json(todos);
      }),
    );

    // Delete todo
    router.post(
      '/project/todo/delete',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(DeleteTodoSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId, name } = parsed;
        const todos = await this.eventsHandler.deleteTodo(projectDir, taskId, name);
        res.status(200).json(todos);
      }),
    );

    // Clear all todos
    router.post(
      '/project/todo/clear',
      this.handleRequest(async (req, res) => {
        const parsed = this.validateRequest(ClearAllTodosSchema, req.body, res);
        if (!parsed) {
          return;
        }

        const { projectDir, taskId } = parsed;
        const todos = await this.eventsHandler.clearAllTodos(projectDir, taskId);
        res.status(200).json(todos);
      }),
    );
  }
}

import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadonlyApi } from '@/server/rest-api/readonly-api';
import { READONLY_MODE } from '@/constants';
import { EventsHandler } from '@/events-handler';
import { ProjectManager } from '@/project';
import { Store } from '@/store';

const projectDir = '/configured/project';
const task = { id: 'task-1', baseDir: projectDir, name: 'Task', active: true, settings: {} };
const state = { messages: [], files: [], todoItems: [], question: null, queuedPrompts: [], workingMode: 'local' };

describe('ReadonlyApi', () => {
  let server: Server;
  let baseUrl: string;
  const load = vi.fn(async () => state);
  const project = {
    baseDir: projectDir,
    getTasks: vi.fn(async () => [task]),
    getTask: vi.fn((taskId: string) => (taskId === task.id ? { load } : undefined)),
  };
  const projectManager = { getOpenProject: vi.fn((requested: string) => (requested === projectDir ? project : undefined)) };
  const eventsHandler = {
    getUIComponents: vi.fn(() => [{ extensionId: 'ext', componentId: 'component', placement: 'header-left', jsx: 'null' }]),
    getUIExtensionData: vi.fn(async () => ({ visible: true })),
    executeUIExtensionAction: vi.fn(async () => ({ success: true })),
    loadExtensionLibrary: vi.fn(async () => 'export default {};'),
  };
  const store = {
    getSettings: vi.fn(() => ({
      language: 'en',
      theme: 'dark',
      font: 'Sono',
      fontSize: 16,
      renderMarkdown: true,
      fullMessageRendering: true,
      server: { readonly: true, readonlyExtensionUi: true },
    })),
    getOpenProjects: vi.fn(() => [{ baseDir: projectDir, active: true }]),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const app = express();
    app.use(express.json());
    const router = express.Router();
    new ReadonlyApi(
      projectManager as unknown as ProjectManager,
      eventsHandler as unknown as EventsHandler,
      store as unknown as Store,
      () => true,
    ).registerRoutes(router);
    app.use('/api/readonly', router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('returns complete task data and task state for a configured project', async () => {
    const tasksResponse = await fetch(`${baseUrl}/api/readonly/tasks?projectDir=${encodeURIComponent(projectDir)}`);
    const taskResponse = await fetch(`${baseUrl}/api/readonly/tasks/task-1?projectDir=${encodeURIComponent(projectDir)}`);

    expect(tasksResponse.status).toBe(200);
    expect(await tasksResponse.json()).toEqual([task]);
    expect(taskResponse.status).toBe(200);
    expect(await taskResponse.json()).toEqual(state);
    expect(load).toHaveBeenCalledWith(READONLY_MODE);
  });

  it('rejects unknown projects and tasks', async () => {
    const projectResponse = await fetch(`${baseUrl}/api/readonly/tasks?projectDir=${encodeURIComponent('/other')}`);
    const taskResponse = await fetch(`${baseUrl}/api/readonly/tasks/missing?projectDir=${encodeURIComponent(projectDir)}`);

    expect(projectResponse.status).toBe(404);
    expect(taskResponse.status).toBe(404);
  });

  it('executes an action only for a validated extension component', async () => {
    const response = await fetch(`${baseUrl}/api/readonly/extensions/ui-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectDir, taskId: task.id, extensionId: 'ext', componentId: 'component', action: 'refresh', args: [] }),
    });

    expect(response.status).toBe(200);
    expect(eventsHandler.executeUIExtensionAction).toHaveBeenCalledWith('ext', 'component', 'refresh', [], projectDir, task.id);
  });

  it('reports extension UI as enabled in bootstrap', async () => {
    const response = await fetch(`${baseUrl}/api/readonly/bootstrap`);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.display.enableExtensionUi).toBe(true);
  });

  describe('when extension UI is disabled', () => {
    let disabledServer: Server;
    let disabledBaseUrl: string;
    const disabledStore = {
      ...store,
      getSettings: vi.fn(() => ({
        language: 'en',
        theme: 'dark',
        font: 'Sono',
        fontSize: 16,
        renderMarkdown: true,
        fullMessageRendering: true,
        server: { readonly: true, readonlyExtensionUi: false },
      })),
    };

    beforeEach(async () => {
      const app = express();
      app.use(express.json());
      const router = express.Router();
      new ReadonlyApi(
        projectManager as unknown as ProjectManager,
        eventsHandler as unknown as EventsHandler,
        disabledStore as unknown as Store,
        () => true,
      ).registerRoutes(router);
      app.use('/api/readonly', router);
      disabledServer = createServer(app);
      await new Promise<void>((resolve) => disabledServer.listen(0, '127.0.0.1', resolve));
      const address = disabledServer.address() as AddressInfo;
      disabledBaseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterEach(async () => {
      await new Promise<void>((resolve, reject) => disabledServer.close((error) => (error ? reject(error) : resolve())));
    });

    it('reports extension UI as disabled in bootstrap', async () => {
      const response = await fetch(`${disabledBaseUrl}/api/readonly/bootstrap`);

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.display.enableExtensionUi).toBe(false);
    });

    it('blocks all extension endpoints server-side', async () => {
      const componentsResponse = await fetch(
        `${disabledBaseUrl}/api/readonly/extensions/ui-components?projectDir=${encodeURIComponent(projectDir)}&placement=header-left&taskId=${task.id}`,
      );
      const dataResponse = await fetch(
        `${disabledBaseUrl}/api/readonly/extensions/ui-data?projectDir=${encodeURIComponent(projectDir)}&extensionId=ext&componentId=component&taskId=${task.id}`,
      );
      const libraryResponse = await fetch(
        `${disabledBaseUrl}/api/readonly/extensions/library?projectDir=${encodeURIComponent(projectDir)}&spec=lib&taskId=${task.id}`,
      );
      const actionResponse = await fetch(`${disabledBaseUrl}/api/readonly/extensions/ui-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDir, taskId: task.id, extensionId: 'ext', componentId: 'component', action: 'refresh', args: [] }),
      });

      expect(componentsResponse.status).toBe(403);
      expect(dataResponse.status).toBe(403);
      expect(libraryResponse.status).toBe(403);
      expect(actionResponse.status).toBe(403);
      expect(eventsHandler.getUIComponents).not.toHaveBeenCalled();
      expect(eventsHandler.getUIExtensionData).not.toHaveBeenCalled();
      expect(eventsHandler.loadExtensionLibrary).not.toHaveBeenCalled();
      expect(eventsHandler.executeUIExtensionAction).not.toHaveBeenCalled();
    });
  });
});

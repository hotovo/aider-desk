import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { TaskExecutionMode } from '@common/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandsApi } from '../commands-api';
import { ProjectApi } from '../project-api';

import type { EventsHandler } from '@/events-handler';

vi.mock('@/logger', () => ({ default: { error: vi.fn() } }));

const cases = [
  {
    path: '/project/custom-commands',
    method: 'runCustomCommand',
    extra: { commandName: 'review', args: ['file'], mode: 'agent', images: ['image'] },
    args: ['review', ['file'], 'agent', ['image']],
    message: 'Custom command executed',
  },
  {
    path: '/project/compact-conversation',
    method: 'compactConversation',
    extra: { mode: 'agent', customInstructions: 'Keep details' },
    args: ['agent', 'Keep details'],
    message: 'Conversation compacted',
  },
  { path: '/project/handoff-conversation', method: 'handoffConversation', extra: { focus: 'Tests' }, args: ['Tests'], message: 'Conversation handed off' },
  {
    path: '/project/init-rules',
    method: 'initProjectRulesFile',
    extra: { args: 'Focus on tests' },
    args: ['Focus on tests'],
    message: 'Project rules file initialized',
  },
  { path: '/project/git/resolve-error-with-agent', method: 'resolveGitErrorWithAgent', extra: {}, args: [], message: 'Git error resolution started' },
] as const;

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe.each(cases)('$path background execution', ({ path, method, extra, args, message }) => {
  let server: Server;
  let url: string;
  const operation = vi.fn<() => Promise<void>>();
  const sendLog = vi.fn();
  const body = { projectDir: '/project', taskId: 'task-1', ...extra };
  const submit = (options: object = {}) =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, ...options }),
    });

  beforeEach(async () => {
    operation.mockReset().mockResolvedValue(undefined);
    sendLog.mockReset();
    const eventsHandler = { [method]: operation, getEventManager: () => ({ sendLog }) } as unknown as EventsHandler;
    const app = express();
    app.use(express.json());
    const router = express.Router();
    new CommandsApi(eventsHandler).registerRoutes(router);
    new ProjectApi(eventsHandler).registerRoutes(router);
    app.use('/api', router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api${path}`;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('acknowledges before completion and rejects in-flight and completed replays', async () => {
    const completed = deferred();
    operation.mockReturnValueOnce(completed.promise);
    const options = { executionMode: TaskExecutionMode.RunInBackground, requestId: uuidv4() };
    try {
      const response = await submit(options);
      expect(response.status).toBe(202);
      expect(response.headers.get('X-Task-Id')).toBe('task-1');
      expect(await response.json()).toEqual({ taskId: 'task-1', requestId: options.requestId });
      expect(operation).toHaveBeenCalledWith('/project', 'task-1', ...args);
      expect((await submit(options)).status).toBe(409);
      completed.resolve();
      await completed.promise;
      expect((await submit(options)).status).toBe(409);
      expect(operation).toHaveBeenCalledOnce();
      expect(sendLog).not.toHaveBeenCalled();
    } finally {
      completed.resolve();
    }
  });

  it.each([undefined, TaskExecutionMode.WaitForFinish])('preserves blocking behavior for mode %s', async (executionMode) => {
    const completed = deferred();
    operation.mockReturnValueOnce(completed.promise);
    let responded = false;
    const pending = submit({ executionMode }).then((response) => {
      responded = true;
      return response;
    });
    try {
      await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
      expect(responded).toBe(false);
      completed.resolve();
      const response = await pending;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ message });
    } finally {
      completed.resolve();
      await pending;
    }
  });

  it('reports background errors through the task log and retains retry protection', async () => {
    operation.mockRejectedValueOnce(new Error('Operation failed'));
    const options = { executionMode: TaskExecutionMode.RunInBackground, requestId: uuidv4() };
    expect((await submit(options)).status).toBe(202);
    await vi.waitFor(() =>
      expect(sendLog).toHaveBeenCalledWith({
        baseDir: '/project',
        taskId: 'task-1',
        level: 'error',
        message: 'Operation failed',
        finished: true,
      }),
    );
    expect((await submit(options)).status).toBe(409);
    expect(operation).toHaveBeenCalledOnce();
  });

  it('preserves HTTP error responses in blocking mode', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    operation.mockRejectedValueOnce(new Error('Operation failed'));
    const response = await submit();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ details: 'Operation failed' });
    expect(sendLog).not.toHaveBeenCalled();
  });

  it.each([{ executionMode: TaskExecutionMode.CreateOnly }, { requestId: 'invalid' }, { taskId: '' }])('validates submission fields: %j', async (options) => {
    expect((await submit(options)).status).toBe(400);
    expect(operation).not.toHaveBeenCalled();
  });
});

import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

import { v4 as uuidv4 } from 'uuid';
import { TaskExecutionMode } from '@common/types';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PromptApi } from '@/server/rest-api/prompt-api';
import { requestTimeoutMiddleware } from '@/server/request-timeout';
import { EventsHandler } from '@/events-handler';

vi.mock('@/logger', () => ({
  default: { debug: vi.fn(), error: vi.fn() },
}));

const RETENTION_MS = 24 * 60 * 60 * 1000;
const promptBody = { projectDir: '/test/project', taskId: 'task-1', prompt: 'Test prompt', mode: 'agent' };

const createDeferred = () => {
  let resolve = () => {};
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('PromptApi request deduplication', () => {
  let server: Server;
  let baseUrl: string;
  let api: PromptApi;
  const sendLog = vi.fn();
  const eventsHandler = {
    runPrompt: vi.fn(async () => []),
    ensureProjectAndCreateTask: vi.fn(async () => ({ projectDir: '/test/project', taskId: 'new-task' })),
    waitForTaskIdle: vi.fn(async () => {}),
    getEventManager: vi.fn(() => ({ subscribeSSE: vi.fn(), unsubscribeSSE: vi.fn(), sendLog })),
  };

  const submit = (body: object, accept = 'application/json', signal?: AbortSignal) =>
    fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: accept },
      body: JSON.stringify(body),
      signal,
    });

  beforeEach(async () => {
    vi.resetAllMocks();
    eventsHandler.runPrompt.mockResolvedValue([]);
    eventsHandler.ensureProjectAndCreateTask.mockResolvedValue({ projectDir: '/test/project', taskId: 'new-task' });
    eventsHandler.getEventManager.mockReturnValue({ subscribeSSE: vi.fn(), unsubscribeSSE: vi.fn(), sendLog });
    const app = express();
    app.use(express.json());
    app.use(requestTimeoutMiddleware);
    const router = express.Router();
    api = new PromptApi(eventsHandler as unknown as EventsHandler);
    api.registerRoutes(router);
    app.use('/api', router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = 'http://127.0.0.1:' + (server.address() as AddressInfo).port + '/api/run-prompt';
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });

  it('acknowledges background execution before it finishes and protects the request ID', async () => {
    const completed = createDeferred();
    eventsHandler.runPrompt.mockImplementationOnce(async () => {
      await completed.promise;
      return [];
    });
    const body = { ...promptBody, requestId: uuidv4(), executionMode: TaskExecutionMode.RunInBackground };
    try {
      const response = await submit(body);
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ taskId: 'task-1', requestId: body.requestId });
      expect(response.headers.get('X-Task-Id')).toBe('task-1');
      expect(eventsHandler.runPrompt).toHaveBeenCalledWith('/test/project', 'task-1', 'Test prompt', 'agent', undefined);
      expect((await submit(body)).status).toBe(409);
      const tracked = Reflect.get(api, 'requestIds') as Map<string, number>;
      expect(tracked.get(body.requestId)).toBe(Infinity);
      completed.resolve();
      await vi.waitFor(() => expect(tracked.get(body.requestId)).not.toBe(Infinity));
      expect((await submit(body)).status).toBe(409);
      expect(sendLog).not.toHaveBeenCalled();
    } finally {
      completed.resolve();
    }
  });

  it('reports background failures through task log events and retains deduplication', async () => {
    eventsHandler.runPrompt.mockRejectedValueOnce(new Error('Execution failed'));
    const body = { ...promptBody, requestId: uuidv4(), executionMode: TaskExecutionMode.RunInBackground };
    expect((await submit(body)).status).toBe(202);
    await vi.waitFor(() =>
      expect(sendLog).toHaveBeenCalledWith({
        baseDir: '/test/project',
        taskId: 'task-1',
        level: 'error',
        message: 'Execution failed',
        finished: true,
      }),
    );
    expect((await submit(body)).status).toBe(409);
  });

  it('creates a task before acknowledging background submission', async () => {
    const response = await submit({ ...promptBody, taskId: undefined, executionMode: TaskExecutionMode.RunInBackground });
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ taskId: 'new-task' });
    expect(eventsHandler.runPrompt).toHaveBeenCalledWith('/test/project', 'new-task', 'Test prompt', 'agent', undefined);
  });

  it('returns task creation failures as submission errors', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    eventsHandler.ensureProjectAndCreateTask.mockRejectedValueOnce(new Error('Cannot create task'));
    const response = await submit({ ...promptBody, taskId: undefined, executionMode: TaskExecutionMode.RunInBackground });
    expect(response.status).toBe(500);
    expect(eventsHandler.runPrompt).not.toHaveBeenCalled();
  });

  it('rejects background SSE and unsupported execution modes', async () => {
    expect((await submit({ ...promptBody, executionMode: TaskExecutionMode.RunInBackground }, 'text/event-stream')).status).toBe(400);
    expect((await submit({ ...promptBody, executionMode: TaskExecutionMode.CreateOnly })).status).toBe(400);
    expect(eventsHandler.runPrompt).not.toHaveBeenCalled();
  });

  it('rejects a replay after completion', async () => {
    const body = { ...promptBody, requestId: uuidv4() };
    expect((await submit(body)).status).toBe(200);
    const replay = await submit(body);
    expect(replay.status).toBe(409);
    expect(await replay.json()).toEqual({ error: 'Request ID has already been submitted', requestId: body.requestId });
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
  });

  it('rejects a replay while the original is still running', async () => {
    const started = createDeferred();
    const completed = createDeferred();
    eventsHandler.runPrompt.mockImplementationOnce(async () => {
      started.resolve();
      await completed.promise;
      return [];
    });
    const body = { ...promptBody, requestId: uuidv4() };
    const original = submit(body);
    await started.promise;
    try {
      expect((await submit(body)).status).toBe(409);
      expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
    } finally {
      completed.resolve();
      await original;
    }
  });

  it('keeps tracking an execution after its client disconnects', async () => {
    const started = createDeferred();
    const completed = createDeferred();
    eventsHandler.runPrompt.mockImplementationOnce(async () => {
      started.resolve();
      await completed.promise;
      return [];
    });
    const body = { ...promptBody, requestId: uuidv4() };
    const controller = new AbortController();
    const original = submit(body, 'application/json', controller.signal).catch(() => undefined);
    await started.promise;
    controller.abort();
    await original;
    try {
      expect((await submit(body)).status).toBe(409);
      expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
    } finally {
      completed.resolve();
    }
  });

  it('allows identical prompts with different IDs and requests without IDs', async () => {
    for (const body of [{ ...promptBody, requestId: uuidv4() }, { ...promptBody, requestId: uuidv4() }, promptBody, promptBody]) {
      expect((await submit(body)).status).toBe(200);
    }
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(4);
  });

  it('retains failed requests to avoid replaying partial side effects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    eventsHandler.runPrompt.mockRejectedValueOnce(new Error('Execution failed'));
    const body = { ...promptBody, requestId: uuidv4() };
    expect((await submit(body)).status).toBe(500);
    expect((await submit(body)).status).toBe(409);
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
  });

  it('prevents a replay from creating another task', async () => {
    const body = { ...promptBody, taskId: undefined, requestId: uuidv4() };
    const original = await submit(body);
    expect(original.status).toBe(200);
    expect(original.headers.get('X-Task-Id')).toBe('new-task');
    expect((await submit(body)).status).toBe(409);
    expect(eventsHandler.ensureProjectAndCreateTask).toHaveBeenCalledTimes(1);
  });

  it('deduplicates SSE requests and replays that change response format', async () => {
    const body = { ...promptBody, requestId: uuidv4() };
    const original = await submit(body, 'text/event-stream');
    expect(original.status).toBe(200);
    expect(await original.text()).toContain('event: stream-end');
    expect((await submit(body, 'text/event-stream')).status).toBe(409);
    expect((await submit(body)).status).toBe(409);
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
  });

  it('expires completed IDs after 24 hours', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const body = { ...promptBody, requestId: uuidv4() };
    expect((await submit(body)).status).toBe(200);
    clock.mockReturnValue(1000 + RETENTION_MS - 1);
    expect((await submit(body)).status).toBe(409);
    clock.mockReturnValue(1000 + RETENTION_MS);
    expect((await submit(body)).status).toBe(200);
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(2);
  });

  it('does not expire running IDs even after 24 hours', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const started = createDeferred();
    const completed = createDeferred();
    eventsHandler.runPrompt.mockImplementationOnce(async () => {
      started.resolve();
      await completed.promise;
      return [];
    });
    const body = { ...promptBody, requestId: uuidv4() };
    const original = submit(body);
    await started.promise;
    clock.mockReturnValue(1000 + RETENTION_MS + 1);
    try {
      expect((await submit(body)).status).toBe(409);
    } finally {
      completed.resolve();
      await original;
    }
  });

  it('rejects new tracked requests at capacity without evicting protected IDs', async () => {
    const tracked = Reflect.get(api, 'requestIds') as Map<string, number>;
    const requestId = uuidv4();
    tracked.set(requestId, Infinity);
    for (let index = 1; index < 10_000; index++) {
      tracked.set(uuidv4(), Infinity);
    }
    expect((await submit({ ...promptBody, requestId: uuidv4() })).status).toBe(503);
    expect((await submit({ ...promptBody, requestId })).status).toBe(409);
    expect((await submit(promptBody)).status).toBe(200);
    expect(tracked.size).toBe(10_000);
    expect(eventsHandler.runPrompt).toHaveBeenCalledTimes(1);
  });
});

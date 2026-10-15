import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CursorSdkExtension from '../index';

import type { AgentStartedEvent, ExtensionContext, InterruptedEvent } from '@aiderdesk/extensions';

const sdk = vi.hoisted(() => ({ create: vi.fn(), resume: vi.fn(), list: vi.fn() }));
vi.mock('@cursor/sdk', () => ({ Agent: { create: sdk.create, resume: sdk.resume }, Cursor: { models: { list: sdk.list } } }));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const setup = (signal?: AbortSignal, resume = false) => {
  const run = {
    id: 'run',
    supports: () => true,
    cancel: vi.fn(async () => {}),
    wait: vi.fn(async () => ({ status: 'finished' })),
  };
  const agent = {
    agentId: 'agent',
    reload: vi.fn(async () => {}),
    send: vi.fn(async () => run),
    [Symbol.asyncDispose]: vi.fn(async () => {}),
  };
  sdk.create.mockResolvedValue(agent);
  sdk.resume.mockResolvedValue(agent);
  const task = {
    data: { id: 'task', metadata: resume ? { cursorAgentId: 'existing' } : {} },
    getTaskDir: () => '/task/workspace',
    updateTask: vi.fn(async () => {}),
    addContextMessage: vi.fn(async () => {}),
    addLogMessage: vi.fn(),
    addLoadingMessage: vi.fn(),
    addResponseMessage: vi.fn(),
  };
  const context = { getTaskContext: () => task, getModelConfigs: async () => [], log: vi.fn() };
  const event = {
    providerProfile: { id: 'cursor-sdk' },
    model: 'auto',
    prompt: 'Hello',
    agentProfile: { enabledServers: [] },
    modelCallSettings: { abortSignal: signal },
  } as unknown as AgentStartedEvent;
  const extension = new CursorSdkExtension();
  return { extension, event, context: context as unknown as ExtensionContext, task, agent, run };
};

beforeEach(() => {
  vi.resetAllMocks();
  sdk.list.mockResolvedValue([]);
  vi.stubEnv('CURSOR_API_KEY', 'test-private-key');
});
afterEach(() => vi.unstubAllEnvs());

describe('Cursor extension lifecycle integration', () => {
  it('does not create an agent for an already-aborted prompt', async () => {
    const controller = new AbortController();
    controller.abort();
    const { extension, event, context } = setup(controller.signal);
    await expect(extension.onAgentStarted(event, context)).resolves.toEqual({ blocked: true });
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it.each([false, true])('disposes late acquisition without sending after interruption (resume=%s)', async (resume) => {
    const { extension, event, context, agent, task } = setup(undefined, resume);
    const acquisition = deferred<typeof agent>();
    (resume ? sdk.resume : sdk.create).mockReturnValue(acquisition.promise);
    const pending = extension.onAgentStarted(event, context);
    await vi.waitFor(() => expect(resume ? sdk.resume : sdk.create).toHaveBeenCalled());
    await extension.onInterrupted({} as InterruptedEvent, context);
    acquisition.resolve(agent);
    await pending;
    expect(agent.send).not.toHaveBeenCalled();
    expect(agent[Symbol.asyncDispose]).toHaveBeenCalledTimes(1);
    expect(task.addLogMessage).not.toHaveBeenCalledWith('error', expect.anything());
    expect(task.updateTask).not.toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
  });

  it('cancels a run arriving after send was interrupted', async () => {
    const controller = new AbortController();
    const { extension, event, context, agent, run } = setup(controller.signal);
    const sending = deferred<typeof run>();
    agent.send.mockReturnValue(sending.promise);
    const pending = extension.onAgentStarted(event, context);
    await vi.waitFor(() => expect(agent.send).toHaveBeenCalled());
    controller.abort();
    sending.resolve(run);
    await pending;
    expect(run.cancel).toHaveBeenCalledTimes(1);
    expect(run.wait).not.toHaveBeenCalled();
    expect(agent[Symbol.asyncDispose]).toHaveBeenCalledTimes(1);
  });

  it('rejects overlapping task runs and releases the reservation on completion', async () => {
    const { extension, event, context, agent } = setup();
    const acquisition = deferred<typeof agent>();
    sdk.create.mockReturnValueOnce(acquisition.promise);
    const pending = extension.onAgentStarted(event, context);
    await vi.waitFor(() => expect(sdk.create).toHaveBeenCalledTimes(1));
    await expect(extension.onAgentStarted(event, context)).resolves.toEqual({ blocked: true });
    expect(sdk.create).toHaveBeenCalledTimes(1);
    acquisition.resolve(agent);
    await pending;
    await extension.onAgentStarted(event, context);
    expect(sdk.create).toHaveBeenCalledTimes(2);
  });

  it('reports terminal run errors with code and redacted key, without retrying', async () => {
    const { extension, event, context, run, task } = setup();
    run.wait.mockResolvedValue({ status: 'error', error: { message: 'Failed test-private-key', code: 'AUTH' } } as never);
    await extension.onAgentStarted(event, context);
    expect(task.addLogMessage).toHaveBeenCalledWith('error', expect.stringContaining('code=AUTH'));
    expect(JSON.stringify(task.addLogMessage.mock.calls)).not.toContain('test-private-key');
    expect(sdk.create).toHaveBeenCalledTimes(1);
  });

  it('marks setup sessions cancelled on unload', async () => {
    const { extension, event, context, agent } = setup();
    const acquisition = deferred<typeof agent>();
    sdk.create.mockReturnValue(acquisition.promise);
    const pending = extension.onAgentStarted(event, context);
    await vi.waitFor(() => expect(sdk.create).toHaveBeenCalled());
    await extension.onUnload();
    acquisition.resolve(agent);
    await pending;
    expect(agent.send).not.toHaveBeenCalled();
  });
});

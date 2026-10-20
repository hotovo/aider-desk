import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OpenCodeFreeExtension from '../index';

import type { AgentStartedEvent, AgentFinishedEvent, ContextMessage, ExtensionContext, Model, ProviderProfile, SettingsData } from '@aiderdesk/extensions';

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  close: vi.fn(),
  list: vi.fn(),
  provider: vi.fn(() => ({})),
  get: vi.fn(),
}));

vi.mock('../runtime', () => ({
  OpenCodeRuntime: class {
    start = mocks.start;
    close = mocks.close;
  },
}));

vi.mock('../model', () => ({
  OpenCodeFreeModel: class {
    constructor(
      private _model: unknown,
      private _delegate: unknown,
      private _tools: unknown,
      private _bridge: unknown,
      private dispose: () => Promise<void>,
      private _approve: unknown,
      private completed?: (metadata: Record<string, unknown>) => Promise<void>,
    ) {}
    async complete(metadata: Record<string, unknown>) {
      await this.completed?.(metadata);
      await this.dispose();
    }
  },
}));

let storageRoot: string;
afterEach(async () => {
  await rm(storageRoot, { recursive: true, force: true });
});

const profile = {
  id: 'test',
  provider: { name: 'opencode-free' },
} as ProviderProfile;

beforeEach(async () => {
  storageRoot = await mkdtemp(join(tmpdir(), 'opencode-free-index-test-'));
  vi.resetAllMocks();
  mocks.close.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue({ client: { model: { list: mocks.list } } });
});

describe('extension registration and catalog lifecycle', () => {
  it('registers only OpenCode Free', () => {
    const providers = new OpenCodeFreeExtension(storageRoot).getProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: 'opencode-free',
      provider: { name: 'opencode-free' },
    });
  });

  it('reports an empty catalog without suggesting a paid fallback', async () => {
    const extension = new OpenCodeFreeExtension(storageRoot);
    mocks.list.mockResolvedValue({ data: [] });
    const result = await extension.getProviders()[0].strategy.loadModels(profile, {} as SettingsData);
    expect(result).toMatchObject({ success: false, models: [] });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('closes catalog runtimes on failure', async () => {
    mocks.list.mockRejectedValue(new Error('catalog unavailable'));
    const result = await new OpenCodeFreeExtension(storageRoot).getProviders()[0].strategy.loadModels(profile, {} as SettingsData);
    expect(result).toMatchObject({
      success: false,
      error: 'catalog unavailable',
      models: [],
    });
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it('refuses construction outside an active agent task', async () => {
    const strategy = new OpenCodeFreeExtension(storageRoot).getProviders()[0].strategy;
    await expect(strategy.createLlm(profile, { id: 'opencode/big-pickle' } as Model, {} as SettingsData, '/workspace')).rejects.toThrow('Agent-mode');
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('cleans up catalog discovery during unload', async () => {
    let resolveList: (value: { data: [] }) => void = () => undefined;
    mocks.list.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    const extension = new OpenCodeFreeExtension(storageRoot);
    const loading = extension.getProviders()[0].strategy.loadModels(profile, {} as SettingsData);
    await vi.waitFor(() => expect(mocks.list).toHaveBeenCalledOnce());
    await extension.onUnload();
    expect(mocks.close).toHaveBeenCalled();
    resolveList({ data: [] });
    await loading;
  });
});

describe('nested agent isolation', () => {
  it('does not stop the parent when creating or finishing a subagent on the same task', async () => {
    const context = { getTaskContext: () => ({ data: { id: 'shared-task' }, getTaskDir: () => '/workspace' }) } as unknown as ExtensionContext;
    const event = { providerProfile: profile, mode: 'agent', contextMessages: [] } as unknown as AgentStartedEvent;
    const extension = new OpenCodeFreeExtension(storageRoot);
    const model = { id: 'opencode/big-pickle' } as Model;
    mocks.list.mockResolvedValue({
      data: [
        {
          providerID: 'opencode',
          modelID: 'big-pickle',
          enabled: true,
          capabilities: { tools: true, output: ['text'] },
          cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
        },
      ],
    });
    mocks.start.mockResolvedValue({
      client: { model: { list: mocks.list }, session: { create: async () => ({ id: 'session' }) } },
      provider: vi.fn(() => ({})),
      workspace: '/workspace',
      permissions: [],
    });
    await extension.onAgentStarted(event, context);
    const strategy = extension.getProviders()[0].strategy;
    await strategy.createLlm(profile, model, {} as SettingsData, '/workspace', {}, undefined, undefined, undefined, 'shared-task');
    const subagent = await extension.onAgentStarted({ ...event, mode: 'subagent' }, context);
    await strategy.createLlm(subagent?.providerProfile ?? profile, model, {} as SettingsData, '/workspace', {}, undefined, undefined, undefined, 'shared-task');
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.start.mock.calls[0][2]).not.toBe(mocks.start.mock.calls[1][2]);
    await extension.onAgentFinished({ mode: 'subagent', contextMessages: [], resultMessages: [], aborted: false }, context);
    expect(mocks.close).not.toHaveBeenCalled();
    await extension.onInterrupted({ interruptId: 'subagent-only' }, context);
    expect(mocks.close).not.toHaveBeenCalled();
    await extension.onInterrupted({}, context);
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
});

describe('session reuse across runs', () => {
  it('imports history on first use, saves its pointer, and resumes after extension reload', async () => {
    const data = { id: 'conversation', metadata: {} as Record<string, unknown> };
    const updateTask = vi.fn(async (updates: { metadata?: Record<string, unknown> }) => {
      Object.assign(data, updates);
    });
    const context = { getTaskContext: () => ({ data, getTaskDir: () => '/workspace', updateTask }) } as unknown as ExtensionContext;
    mocks.list.mockResolvedValue({
      data: [
        {
          providerID: 'opencode',
          modelID: 'big-pickle',
          enabled: true,
          capabilities: { tools: true, output: ['text'] },
          cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }],
        },
      ],
    });
    mocks.get.mockResolvedValue({ id: 'ses_remember' });
    mocks.start.mockResolvedValue({ client: { model: { list: mocks.list }, session: { get: mocks.get } }, provider: mocks.provider, workspace: '/workspace' });
    const history = [
      { id: 'old-user', role: 'user', content: 'Earlier context' },
      { id: 'old-assistant', role: 'assistant', content: 'Acknowledged' },
    ] as ContextMessage[];
    const resultMessages = [
      { id: 'user', role: 'user', content: 'Remember this' },
      { id: 'assistant', role: 'assistant', content: 'I will remember' },
    ] as ContextMessage[];
    const event = { providerProfile: profile, mode: 'agent', contextMessages: history } as AgentStartedEvent;
    const first = new OpenCodeFreeExtension(storageRoot);
    const started = await first.onAgentStarted(event, context);
    const model = (await first
      .getProviders()[0]
      .strategy.createLlm(
        started?.providerProfile ?? profile,
        { id: 'opencode/big-pickle' } as Model,
        {} as SettingsData,
        '/workspace',
        {},
        undefined,
        undefined,
        undefined,
        data.id,
      )) as { complete: (metadata: Record<string, unknown>) => Promise<void> };
    expect(mocks.provider.mock.calls[0][1]).not.toHaveProperty('sessionId');
    await model.complete({ opencode: { sessionId: 'ses_remember' } });
    await first.onAgentFinished({ mode: 'agent', contextMessages: history, resultMessages, aborted: false } as AgentFinishedEvent, context);
    expect(data.metadata.opencodeFreeSession).toMatchObject({ sessionId: 'ses_remember' });
    await first.onUnload();
    const second = new OpenCodeFreeExtension(storageRoot);
    const resumed = await second.onAgentStarted({ ...event, contextMessages: [...history, ...resultMessages] }, context);
    await second
      .getProviders()[0]
      .strategy.createLlm(
        resumed?.providerProfile ?? profile,
        { id: 'opencode/big-pickle' } as Model,
        {} as SettingsData,
        '/workspace',
        {},
        undefined,
        undefined,
        undefined,
        data.id,
      );
    expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ sessionID: 'ses_remember' });
    expect(mocks.provider.mock.calls[1][1]).toMatchObject({ sessionId: 'ses_remember', sessionMode: 'existing' });
    expect(mocks.start.mock.calls[0][2]).toBe(mocks.start.mock.calls[1][2]);
    await second.onUnload();
  });
});

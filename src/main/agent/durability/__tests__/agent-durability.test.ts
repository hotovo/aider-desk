import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { generateText, type ToolSet } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { ToolRecoveryMode, ContextCompactionType, type ContextMessage, type TaskSettings } from '@common/types';

import { DurabilityManager } from '../durability-manager';

import { Agent } from '@/agent/agent';
import * as compaction from '@/agent/compaction';
import { createMockAgentProfile, createMockTask, createMockSettings } from '@/__tests__/mocks';

vi.mock('@/logger');

const createFixture = () => {
  let json: string | undefined;
  const storage = {
    getAgentExecutions: vi.fn(() => (json ? [json] : [])),
    saveAgentExecution: vi.fn((_project: string, _task: string, _id: string, value: string) => {
      json = value;
    }),
    deleteAgentExecution: vi.fn(() => {
      json = undefined;
    }),
  };
  const durability = new DurabilityManager(storage, '/project', 'task');
  const profile = createMockAgentProfile();
  durability.begin({ promptContext: { id: 'execution' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
  durability.beginStep('execution', 'step');
  const task = createMockTask();
  Object.assign(task, { durabilityManager: durability, addToolMessage: vi.fn() });
  const dispatchEvent = vi.fn(async (_name: string, event: Record<string, unknown>) => ({ ...event }));
  const agent = new Agent(...([{}, {}, {}, {}, {}, {}, {}, {}, { dispatchEvent }] as unknown as ConstructorParameters<typeof Agent>));
  const wrap = (tools: ToolSet) => agent['wrapToolsWithHooks'](task, profile, tools, undefined, { id: 'execution' });
  return { durability, profile, task, dispatchEvent, storage, wrap };
};

const options = (id: string) => ({ toolCallId: id, messages: [], context: undefined as never });

const createModel = () =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [
        { type: 'reasoning', text: 'Inspect both files', providerMetadata: { test: { signature: 'signed' } } },
        { type: 'tool-call', toolCallId: 'a', toolName: 'read_a', input: '{}' },
        { type: 'tool-call', toolCallId: 'b', toolName: 'read_b', input: '{}' },
      ],
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 0, reasoning: 1 } },
      warnings: [],
    },
  });

describe('Agent durable tool integration', () => {
  it('journals the complete SDK response before tools and checkpoints parallel results independently', async () => {
    const fixture = createFixture();
    const { promise: done, resolve: finish } = Promise.withResolvers<string>();
    const readA = vi.fn(async () => {
      const stored = new DurabilityManager(fixture.storage, '/project', 'task');
      expect(stored.get('execution')?.step?.assistant.content).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'reasoning', providerOptions: { test: { signature: 'signed' } } })]),
      );
      return 'A finished';
    });
    const tools = fixture.wrap({
      read_a: { inputSchema: z.object({}), execute: readA },
      read_b: { inputSchema: z.object({}), execute: vi.fn(async () => await done) },
    });
    const run = generateText({
      model: createModel(),
      messages: [{ role: 'user', content: 'Read files' }],
      tools,
      onLanguageModelCallEnd: (event) => fixture.durability.captureModelResponse('execution', event.content, () => ToolRecoveryMode.Safe),
    });
    await vi.waitFor(() => expect(fixture.durability.isToolCompleted('execution', 'a')).toBe(true));
    expect(fixture.durability.isToolCompleted('execution', 'b')).toBe(false);
    const restored = new DurabilityManager(fixture.storage, '/project', 'task');
    expect(restored.isToolCompleted('execution', 'a')).toBe(true);
    finish('B finished');
    await run;
    expect(readA).toHaveBeenCalledOnce();
  });

  it('persists onToolCalled argument and policy overrides before executing', async () => {
    const fixture = createFixture();
    fixture.dispatchEvent.mockImplementation(async (name, event) =>
      name === 'onToolCalled' ? { ...event, input: { effective: true }, recoveryMode: ToolRecoveryMode.Notify } : event,
    );
    const execute = vi.fn(async () => {
      const stored = new DurabilityManager(fixture.storage, '/project', 'task');
      expect(stored.get('execution')?.step?.calls[0]).toMatchObject({ input: { effective: true }, recoveryMode: ToolRecoveryMode.Notify });
      return 'done';
    });
    await fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({}, options('call'));
    expect(execute).toHaveBeenCalledWith({ effective: true }, expect.anything());
  });

  it('does not execute a committed call again', async () => {
    const fixture = createFixture();
    fixture.durability.beginTool('execution', { id: 'call', name: 'service', input: {}, attempt: 1 }, ToolRecoveryMode.Safe);
    fixture.durability.completeTool('execution', 'call', 'saved');
    const execute = vi.fn(async () => 'duplicated');
    const result = await fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({}, options('call'));
    expect(result).toBe('saved');
    expect(execute).not.toHaveBeenCalled();
  });

  it('fails before tool execution if intent persistence fails', async () => {
    const fixture = createFixture();
    fixture.storage.saveAgentExecution.mockImplementation(() => {
      throw new Error('Database unavailable');
    });
    const execute = vi.fn(async () => 'done');
    await expect(fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({}, options('call'))).rejects.toThrow(
      'Database unavailable',
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it('journals nested tool outcomes under the orchestration call instead of adding fake model calls', async () => {
    const fixture = createFixture();
    const inner = fixture.wrap({ read: { inputSchema: z.object({}), execute: vi.fn(async () => 'nested result') } });
    const outer = fixture.wrap({
      orchestrate: {
        inputSchema: z.object({}),
        execute: async () => {
          await inner.read.execute!({}, options('nested'));
          return 'orchestrated';
        },
      },
    });
    await outer.orchestrate.execute!({}, options('outer'));
    const step = fixture.durability.get('execution')?.step;
    expect(step?.calls.find((call) => call.id === 'nested')).toMatchObject({ parentToolCallId: 'outer', output: 'nested result' });
    expect(JSON.stringify(step?.assistant.content)).not.toContain('nested');
  });

  it('does not duplicate hooks when wrapping an existing wrapped definition', async () => {
    const fixture = createFixture();
    const execute = vi.fn(async () => 'done');
    const wrapped = fixture.wrap({ service: { inputSchema: z.object({}), execute } });
    await fixture.wrap(wrapped).service.execute!({}, options('call'));
    expect(fixture.dispatchEvent.mock.calls.filter(([name]) => name === 'onToolCalled')).toHaveLength(1);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('does not add a client executor to provider-executed tools', () => {
    const fixture = createFixture();
    const providerTool = { inputSchema: z.object({}) };
    expect(fixture.wrap({ provider_tool: providerTool }).provider_tool.execute).toBeUndefined();
  });
});

describe('Agent execution recovery', () => {
  const createRecoveryFixture = async (alreadyPersisted = false) => {
    const fixture = createFixture();
    const profile = createMockAgentProfile({
      toolRecoveryModes: { service: ToolRecoveryMode.Safe },
      useTodoTools: false,
      useSubagents: false,
      useMemoryTools: false,
    });
    const execute = vi.fn(async () => 'recovered tool result');
    fixture.durability.beginTool('execution', { id: 'pending', name: 'service', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
    const persisted = [] as import('@common/types').ContextMessage[];
    if (alreadyPersisted) {
      fixture.durability.completeTool('execution', 'pending', 'existing result');
      persisted.push(...(await fixture.durability.recoverStep('execution', vi.fn())));
    }
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: 'Continued normally' }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
        warnings: [],
      },
    });
    const modelManager = {
      getProviders: vi.fn(() => [{ id: 'test-provider', provider: { name: 'test' } }]),
      getCacheControl: vi.fn(),
      getProviderParameters: vi.fn(() => ({})),
      getProviderOptions: vi.fn(() => ({})),
      normalizeMessages: vi.fn((_provider, _model, messages) => messages),
      createLlm: vi.fn(async () => model),
      getModelSettings: vi.fn(() => ({})),
      isStreamingDisabled: vi.fn(() => true),
      getUsageReport: vi.fn(() => undefined),
    };
    const agent = new Agent(
      ...([
        { getSettings: vi.fn(() => ({})), getUserId: vi.fn(() => 'test') },
        { getProjectProfiles: vi.fn(() => []) },
        {},
        { getMergedServers: vi.fn(() => ({})) },
        modelManager,
        { captureAgentRun: vi.fn() },
        {},
        { getSystemPrompt: vi.fn(async () => 'system') },
        { dispatchEvent: fixture.dispatchEvent },
      ] as unknown as ConstructorParameters<typeof Agent>),
    );
    vi.spyOn(
      agent as unknown as { prepareMessages: (task: unknown, profile: unknown, messages: unknown[]) => Promise<unknown[]> },
      'prepareMessages',
    ).mockImplementation(async (_task, _profile, messages) => [...messages]);
    vi.spyOn(agent as unknown as { compactMessagesIfNeeded: () => Promise<boolean> }, 'compactMessagesIfNeeded').mockResolvedValue(true);
    vi.spyOn(agent as unknown as { getAvailableTools: () => Promise<ToolSet> }, 'getAvailableTools').mockImplementation(async () => {
      const tools = agent['wrapToolsWithHooks'](fixture.task, profile, { service: { inputSchema: z.object({}), execute } }, undefined, { id: 'execution' });
      fixture.durability.registerTools('execution', tools);
      return tools;
    });
    Object.assign(fixture.task, {
      getContextMessages: vi.fn(async () => [...persisted]),
      getContextFiles: vi.fn(async () => []),
      persistDurableMessages: vi.fn(async (messages: import('@common/types').ContextMessage[]) => {
        const ids = new Set(persisted.map((message) => message.id));
        persisted.push(...messages.filter((message) => !ids.has(message.id)));
      }),
      publishDurableMessages: vi.fn(),
      processResponseMessage: vi.fn(async () => undefined),
      addLogMessage: vi.fn(),
      updateTask: vi.fn(async () => undefined),
      sendTaskMessageRemoved: vi.fn(),
    });
    return { fixture, agent, profile, execute, model, persisted };
  };

  it.each([ContextCompactionType.Smart, ContextCompactionType.Compact])('checkpoints the actual child compaction path (%s)', async (compactionType) => {
    const { fixture, agent, profile } = await createRecoveryFixture();
    vi.mocked(agent['compactMessagesIfNeeded']).mockRestore();
    vi.mocked(agent['store'].getSettings).mockReturnValue(
      createMockSettings({
        taskSettings: {
          contextCompactingThreshold: { percentage: 100, tokens: 1 },
          contextCompactionType: compactionType,
        } as TaskSettings,
      }),
    );
    Object.assign(fixture.task.task, { contextCompactingThresholdTokens: 1 });
    Object.assign(fixture.task, { reloadGroupMessages: vi.fn() });
    const user = { id: 'child-user', role: 'user' as const, content: 'Child request' };
    const old: ContextMessage = {
      id: 'old',
      role: 'assistant',
      content: 'PRECOMPACTION_HISTORY',
      usageReport: { model: 'test', sentTokens: 20, receivedTokens: 20, messageCost: 0 },
    };
    const compacted: ContextMessage[] = [user, { id: 'summary', role: 'assistant', content: 'COMPACTED_CHILD_SUMMARY' }];
    await fixture.durability.finishStep('execution', [user, old]);
    const method = compactionType === ContextCompactionType.Smart ? 'smartCompactMessages' : 'generateCompactedSummary';
    const summary = vi.spyOn(compaction, method).mockResolvedValue(compacted);
    try {
      await agent['compactMessagesIfNeeded'](
        fixture.task,
        { ...profile, isSubagent: true },
        agent['modelManager'].getProviders()[0],
        profile.model,
        user,
        [user],
        [],
        [],
        [old],
        { id: 'execution' },
      );
      expect(summary).toHaveBeenCalledOnce();
      const restored = new DurabilityManager(fixture.storage, '/project', 'task').get('execution');
      expect(restored?.history).toEqual(compacted);
      expect(restored?.contextMessages).toEqual([]);
      expect(JSON.stringify(restored)).not.toContain('PRECOMPACTION_HISTORY');
    } finally {
      summary.mockRestore();
    }
  });

  it('compacts a recovered child using the request stored only in its execution history', async () => {
    const { fixture, agent, profile, model } = await createRecoveryFixture();
    const childProfile = { ...profile, isSubagent: true };
    const user: ContextMessage = { id: 'original-child-user', role: 'user', content: 'ORIGINAL_CHILD_REQUEST' };
    const old: ContextMessage = {
      id: 'old-history',
      role: 'assistant',
      content: 'OLD_CHILD_HISTORY',
      usageReport: { model: 'test', sentTokens: 20, receivedTokens: 20, messageCost: 0 },
    };
    await fixture.durability.finishStep('execution', [user, old]);
    vi.mocked(agent['compactMessagesIfNeeded']).mockRestore();
    vi.mocked(agent['store'].getSettings).mockReturnValue(
      createMockSettings({
        taskSettings: { contextCompactingThreshold: { percentage: 100, tokens: 1 }, contextCompactionType: ContextCompactionType.Compact } as TaskSettings,
      }),
    );
    Object.assign(fixture.task.task, { contextCompactingThresholdTokens: 1 });
    Object.assign(fixture.task, { reloadGroupMessages: vi.fn() });
    const summary = vi
      .spyOn(compaction, 'generateCompactedSummary')
      .mockResolvedValue([user, { id: 'summary', role: 'assistant', content: 'RECOVERED_CHILD_SUMMARY' }]);
    try {
      await agent.runAgent(fixture.task, childProfile, null, 'agent', { id: 'execution' }, undefined, undefined, undefined, false);
      expect(summary).toHaveBeenCalledOnce();
      expect(summary.mock.calls[0][0]).toMatchObject(user);
      expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('RECOVERED_CHILD_SUMMARY');
      expect(JSON.stringify(model.doGenerateCalls[0].prompt)).not.toContain('OLD_CHILD_HISTORY');
      expect(vi.mocked(fixture.task.addLogMessage).mock.calls.filter(([level]) => level === 'error')).toEqual([]);
    } finally {
      summary.mockRestore();
    }
  });

  it('keeps a retained user-message ID separate from a fresh execution identity', async () => {
    const { fixture, agent, profile, persisted } = await createRecoveryFixture();
    fixture.durability.clear('execution');
    Object.assign(fixture.task, {
      addContextMessage: vi.fn(async (message: ContextMessage) => {
        persisted.push(message);
      }),
    });
    await agent.runAgent(fixture.task, profile, 'Updated request', 'agent', { id: 'fresh-attempt', userMessageId: 'retained-user-message' });
    expect(persisted.find((message) => message.role === 'user')).toMatchObject({ id: 'retained-user-message', promptContext: { id: 'fresh-attempt' } });
  });

  it('does not attach non-durable summary requests to the main checkpoint even when supplied its identity', async () => {
    const { fixture, agent, profile, execute, model } = await createRecoveryFixture();
    const before = fixture.storage.getAgentExecutions()[0];
    await agent.runAgent(
      fixture.task,
      profile,
      'SUMMARIZE_THIS_CONTEXT',
      'compact-conversation',
      { id: 'execution' },
      [{ id: 'summary-input', role: 'user', content: 'ONLY_SUMMARY_CONTEXT' }],
      [],
      undefined,
      false,
    );
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('SUMMARIZE_THIS_CONTEXT');
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('ONLY_SUMMARY_CONTEXT');
    expect(fixture.storage.getAgentExecutions()[0]).toBe(before);
  });

  it('restores the authoritative compacted main conversation before resuming', async () => {
    const { fixture, agent, profile, model } = await createRecoveryFixture();
    const summary = { id: 'summary', role: 'assistant' as const, content: 'COMPACTED_CONVERSATION' };
    fixture.durability.replaceConversation('execution', [summary], []);
    const restoreDurableConversation = vi.fn(async () => undefined);
    Object.assign(fixture.task, { restoreDurableConversation });
    await agent.runAgent(fixture.task, profile, null, 'agent', { id: 'execution' });
    expect(restoreDurableConversation).toHaveBeenCalledExactlyOnceWith([summary]);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('COMPACTED_CONVERSATION');
  });

  it('recovers a safe call and then continues the normal agent loop', async () => {
    const { fixture, agent, profile, execute, model, persisted } = await createRecoveryFixture();
    const result = await agent.runAgent(fixture.task, profile, null, 'agent', { id: 'execution' });
    expect(execute).toHaveBeenCalledOnce();
    expect(vi.mocked(fixture.task.addLogMessage).mock.calls.filter(([level]) => level === 'error')).toEqual([]);
    expect(model.doGenerateCalls).toHaveLength(1);
    expect(JSON.stringify(model.doGenerateCalls[0].prompt)).toContain('recovered tool result');
    expect(JSON.stringify(result)).toContain('Continued normally');
    expect(JSON.stringify(persisted)).toContain('Continued normally');
    expect(fixture.durability.getRecoverableRoots()).toEqual([]);
  });

  it('does not duplicate calls in the model context after a crash during the context handoff', async () => {
    const { fixture, agent, profile, execute, model } = await createRecoveryFixture(true);
    await agent.runAgent(fixture.task, profile, null, 'agent', { id: 'execution' });
    expect(execute).not.toHaveBeenCalled();
    const calls = model.doGenerateCalls[0].prompt
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => message.content.filter((part) => part.type === 'tool-call'));
    expect(calls).toHaveLength(1);
  });
});

describe('Durability review regressions', () => {
  it('assigns separate stable identities to unnamed nested tools and reuses only matching results', async () => {
    const fixture = createFixture();
    const read = vi.fn(async (input: Record<string, unknown> | undefined) => input?.path);
    const search = vi.fn(async () => 'searched');
    const inner = fixture.wrap({ read: { inputSchema: z.object({}), execute: read }, search: { inputSchema: z.object({}), execute: search } });
    const invoke = async () =>
      await fixture.durability.withToolCall('execution', 'parent', async () => [
        await inner.read.execute!({ path: 'one' }, options('')),
        await inner.search.execute!({}, options('')),
        await inner.read.execute!({ path: 'two' }, options('')),
      ]);
    fixture.durability.beginTool('execution', { id: 'parent', name: 'extension', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
    expect(await invoke()).toEqual(['one', 'searched', 'two']);
    expect(await invoke()).toEqual(['one', 'searched', 'two']);
    expect(read).toHaveBeenCalledTimes(2);
    expect(search).toHaveBeenCalledOnce();
    expect(fixture.durability.get('execution')?.step?.calls.map((call) => call.id)).toEqual([
      'parent',
      'parent/nested/0',
      'parent/nested/1',
      'parent/nested/2',
    ]);
  });

  it('refuses a completed identity reused for different arguments', async () => {
    const fixture = createFixture();
    const execute = vi.fn(async () => 'first result');
    const tool = fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service;
    await tool.execute!({ operation: 'first' }, options('same'));
    expect(await tool.execute!({ operation: 'different' }, options('same'))).toMatchObject({ aiderDeskRecovery: 'identityConflict' });
    expect(execute).toHaveBeenCalledOnce();
  });

  it('refuses replay by a different extension owning the same exposed name', async () => {
    const fixture = createFixture();
    fixture.durability.beginTool('execution', { id: 'call', name: 'lookup', owner: 'extension:first---lookup', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
    const execute = vi.fn(async () => 'wrong owner');
    const definition = { inputSchema: z.object({}), execute, replayOwner: 'extension:second---lookup' };
    expect(await fixture.wrap({ lookup: definition }).lookup.execute!({}, options('call'))).toMatchObject({ aiderDeskRecovery: 'ownerChanged' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('never checkpoints or recovers raw output while the redaction hook is unfinished', async () => {
    const fixture = createFixture();
    const finalization = Promise.withResolvers<string>();
    fixture.dispatchEvent.mockImplementation(async (name, event) => (name === 'onToolFinished' ? { ...event, output: await finalization.promise } : event));
    const execute = vi.fn(async () => 'PRIVATE_RAW_OUTPUT');
    const run = fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({}, options('call'));
    await vi.waitFor(() => expect(fixture.durability.isToolExecuted('execution', 'call')).toBe(true));
    expect(fixture.durability.isToolCompleted('execution', 'call')).toBe(false);
    expect(fixture.storage.saveAgentExecution.mock.calls.map((call) => call[3]).join()).not.toContain('PRIVATE_RAW_OUTPUT');
    const restored = new DurabilityManager(fixture.storage, '/project', 'task');
    const replay = vi.fn();
    const messages = await restored.recoverStep('execution', replay);
    expect(replay).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).not.toContain('PRIVATE_RAW_OUTPUT');
    expect(JSON.stringify(messages)).toContain('finalizationInterrupted');
    finalization.resolve('REDACTED');
    expect(await run).toBe('REDACTED');
    expect(fixture.durability.get('execution')?.step?.calls[0].output).toBe('REDACTED');
  });

  it('does not publish a sensitive finalizer exception or repeat the underlying operation', async () => {
    const fixture = createFixture();
    fixture.dispatchEvent.mockImplementation(async (name, event) => {
      if (name === 'onToolFinished') {
        throw new Error('PRIVATE_RAW_OUTPUT');
      }
      return event;
    });
    const execute = vi.fn(async () => 'PRIVATE_RAW_OUTPUT');
    const result = await fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({}, options('call'));
    expect(result).toMatchObject({ aiderDeskRecovery: 'finalizationInterrupted' });
    expect(fixture.storage.saveAgentExecution.mock.calls.map((call) => call[3]).join()).not.toContain('PRIVATE_RAW_OUTPUT');
    await new DurabilityManager(fixture.storage, '/project', 'task').recoverStep('execution', execute);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('rejects conflicting input rewrites on replay instead of ignoring the hook', async () => {
    const fixture = createFixture();
    fixture.durability.beginTool('execution', { id: 'call', name: 'service', input: { target: 'original' }, attempt: 0 }, ToolRecoveryMode.Safe);
    fixture.dispatchEvent.mockImplementation(async (name, event) => (name === 'onToolCalled' ? { ...event, input: { target: 'changed' } } : event));
    const execute = vi.fn(async () => 'wrong operation');
    const result = await fixture.wrap({ service: { inputSchema: z.object({}), execute } }).service.execute!({ target: 'original' }, options('call'));
    expect(result).toMatchObject({ aiderDeskRecovery: 'argumentsChanged' });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('finalized model output', () => {
  it('reuses the checkpointed conversion rather than running the converter again in the SDK', async () => {
    const fixture = createFixture();
    const toModelOutput = vi.fn(async () => ({ type: 'text' as const, value: 'Converted safely' }));
    const tool = fixture.wrap({ service: { inputSchema: z.object({}), execute: async () => 'Public output', toModelOutput } }).service;
    const output = await tool.execute!({}, options('call'));
    expect(await tool.toModelOutput!({ toolCallId: 'call', input: {}, output })).toEqual({ type: 'text', value: 'Converted safely' });
    expect(toModelOutput).toHaveBeenCalledOnce();
  });

  it('keeps recovery instructions intact without invoking an operation-specific converter', async () => {
    const fixture = createFixture();
    fixture.dispatchEvent.mockImplementation(async (name, event) => {
      if (name === 'onToolFinished') {
        throw new Error('PRIVATE_FINALIZATION_ERROR');
      }
      return event;
    });
    const toModelOutput = vi.fn(async () => ({ type: 'text' as const, value: 'Must not be used for recovery notices' }));
    const tool = fixture.wrap({ service: { inputSchema: z.object({}), execute: async () => 'PRIVATE_OUTPUT', toModelOutput } }).service;
    const output = await tool.execute!({}, options('call'));
    expect(await tool.toModelOutput!({ toolCallId: 'call', input: {}, output })).toMatchObject({
      type: 'json',
      value: { aiderDeskRecovery: 'finalizationInterrupted' },
    });
    expect(toModelOutput).not.toHaveBeenCalled();
  });
});

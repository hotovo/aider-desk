import { describe, expect, it, vi } from 'vitest';
import { MockLanguageModelV4 } from 'ai/test';
import { z } from 'zod';
import { AutonomyMode } from '@common/types';

import type { LanguageModelV4GenerateResult, LanguageModelV4StreamPart } from '@ai-sdk/provider';
import type { ContextMessage } from '@common/types';
import type { Task } from '@/task';

import { Agent } from '@/agent/agent';
import { createMockAgentProfile } from '@/__tests__/mocks';

vi.mock('@/logger');

const response = (text = '{"verdict":"ok"}'): LanguageModelV4GenerateResult => ({
  content: [{ type: 'text', text }],
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 100, noCache: 20, cacheRead: 80, cacheWrite: undefined },
    outputTokens: { total: 8, text: 8, reasoning: undefined },
  },
  providerMetadata: { test: { cached: true } },
  warnings: [],
});

const createFixture = (modelResponse = response(), requireStreaming = false) => {
  const model = new MockLanguageModelV4({
    doGenerate: modelResponse,
    doStream: async () => ({
      stream: new ReadableStream<LanguageModelV4StreamPart>({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 'text' });
          controller.enqueue({ type: 'text-delta', id: 'text', delta: '{"verdict":"ok"}' });
          controller.enqueue({ type: 'text-end', id: 'text' });
          controller.enqueue({
            type: 'finish',
            finishReason: modelResponse.finishReason,
            usage: modelResponse.usage,
            providerMetadata: modelResponse.providerMetadata,
          });
          controller.close();
        },
      }),
    }),
  });
  const profile = createMockAgentProfile({
    provider: 'provider',
    model: 'model',
    isSubagent: true,
    useTodoTools: false,
    useSubagents: false,
    useMemoryTools: false,
  });
  const history: ContextMessage[] = [{ id: 'user-1', role: 'user', content: 'Existing evidence' }];
  const task = {
    task: { id: 'task-1', currentMode: 'agent', autonomyMode: AutonomyMode.Autonomous },
    project: { baseDir: '/project' },
    getTaskAgentProfile: vi.fn(async () => profile),
    getContextMessages: vi.fn(async () => history),
    getContextFiles: vi.fn(async () => []),
    getProjectDir: vi.fn(() => '/project'),
    getTaskDir: vi.fn(() => '/project'),
    addContextMessage: vi.fn(),
    addResponseMessage: vi.fn(),
  };
  const modelManager = {
    getProviders: vi.fn(() => [{ id: 'provider', provider: { name: 'openai' } }]),
    isStreamingRequired: vi.fn(() => requireStreaming),
    createLlm: vi.fn(async () => model),
    getModelSettings: vi.fn(() => ({ temperature: 0.2, maxOutputTokens: 256 })),
    getProviderOptions: vi.fn(() => ({ test: { option: true } })),
    getProviderParameters: vi.fn(() => ({})),
    getCacheControl: vi.fn(() => ({ providerOptions: { test: { cacheControl: 'enabled' } } })),
  };
  const extensionManager = { dispatchEvent: vi.fn(async (_name: string, event: Record<string, unknown>) => event) };
  const agent = new Agent(
    ...([
      { getSettings: vi.fn(() => ({})), getUserId: vi.fn(() => 'test') },
      { getProjectProfiles: vi.fn(() => []) },
      {},
      {},
      modelManager,
      {},
      {},
      { getSystemPrompt: vi.fn(async () => 'Normal agent system prompt') },
      extensionManager,
    ] as unknown as ConstructorParameters<typeof Agent>),
  );
  const execute = vi.fn(async () => 'must not run');
  const tools = { read_file: { description: 'Read a file', inputSchema: z.object({ path: z.string() }), execute } };
  agent['getAvailableTools'] = vi.fn(async () => tools);
  agent['prepareMessages'] = vi.fn(async (_task, _profile, messages) => structuredClone(messages));
  return { agent, task: task as unknown as Task, taskMock: task, profile, history, model, modelManager, tools, execute, extensionManager };
};

describe('context side generation', () => {
  it('sends the normal system prompt, history and tool schemas with toolChoice none', async () => {
    const fixture = createFixture();
    const result = await fixture.agent.generateTextFromContext(fixture.task, 'Review the goal');
    const request = fixture.model.doGenerateCalls[0];
    expect(request.toolChoice).toEqual({ type: 'none' });
    expect(request.tools).toEqual([expect.objectContaining({ type: 'function', name: 'read_file', description: 'Read a file' })]);
    expect(request.prompt[0]).toMatchObject({ role: 'system', content: 'Normal agent system prompt' });
    expect(request.prompt.at(-1)).toMatchObject({ role: 'user', content: [{ type: 'text', text: 'Review the goal' }] });
    expect(request.prompt.some((message) => JSON.stringify(message).includes('Existing evidence'))).toBe(true);
    expect(result.output).toBe('{"verdict":"ok"}');
    expect(result.usage.inputTokenDetails).toEqual({ noCacheTokens: 20, cacheReadTokens: 80, cacheWriteTokens: undefined });
    expect(result.providerMetadata).toEqual({ test: { cached: true } });
    expect(fixture.execute).not.toHaveBeenCalled();
    expect(fixture.model.doGenerateCalls).toHaveLength(1);
  });

  it('keeps identical prefixes and tools for text and structured output', async () => {
    const fixture = createFixture();
    const schema = z.object({ verdict: z.literal('ok') });
    await fixture.agent.generateTextFromContext(fixture.task, 'Review');
    await fixture.agent.generateTextFromContext(fixture.task, 'Review');
    const result = await fixture.agent.generateObjectFromContext(fixture.task, 'Review', schema);
    const calls = fixture.model.doGenerateCalls;
    expect(calls).toHaveLength(3);
    expect(calls[0].prompt).toEqual(calls[1].prompt);
    expect(calls[1].prompt).toEqual(calls[2].prompt);
    expect(calls[0].tools).toEqual(calls[2].tools);
    expect(calls[2].toolChoice).toEqual({ type: 'none' });
    expect(calls[2].responseFormat).toMatchObject({ type: 'json', schema: expect.objectContaining({ type: 'object' }) });
    expect(result.output).toEqual({ verdict: 'ok' });
    expect(fixture.history).toEqual([{ id: 'user-1', role: 'user', content: 'Existing evidence' }]);
    expect(fixture.taskMock.addContextMessage).not.toHaveBeenCalled();
    expect(fixture.taskMock.addResponseMessage).not.toHaveBeenCalled();
    expect(fixture.tools.read_file.execute).toBe(fixture.execute);
    expect(fixture.extensionManager.dispatchEvent).toHaveBeenCalledWith('onApplyCacheControl', expect.anything(), fixture.task.project, fixture.task);
  });

  it('passes cancellation and output limits without registering a main-agent run', async () => {
    const fixture = createFixture();
    const controller = new AbortController();
    await fixture.agent.generateTextFromContext(fixture.task, 'Review', { abortSignal: controller.signal, maxOutputTokens: 42 });
    expect(fixture.model.doGenerateCalls[0].maxOutputTokens).toBe(42);
    expect(fixture.agent.isRunning()).toBe(false);
    controller.abort();
    await expect(fixture.agent.generateTextFromContext(fixture.task, 'Review', { abortSignal: controller.signal })).rejects.toThrow();
    expect(fixture.model.doGenerateCalls).toHaveLength(1);
  });

  it('rejects tool-call output without executing tools', async () => {
    const modelResponse = response();
    modelResponse.content = [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'read_file', input: '{"path":"secret"}' }];
    modelResponse.finishReason = { unified: 'tool-calls', raw: 'tool_calls' };
    const fixture = createFixture(modelResponse);
    await expect(fixture.agent.generateTextFromContext(fixture.task, 'Review')).rejects.toThrow();
    expect(fixture.execute).not.toHaveBeenCalled();
    expect(fixture.model.doGenerateCalls).toHaveLength(1);
  });

  it('isolates provider sessions and rejects provider-native execution', async () => {
    const fixture = createFixture();
    await fixture.agent.generateTextFromContext(fixture.task, 'Review');
    const args = fixture.modelManager.createLlm.mock.calls[0] as unknown as Parameters<Agent['modelManager']['createLlm']>;
    expect(args[7]).not.toBe(fixture.task.task.id);
    expect(args[7]).toEqual(expect.any(String));
    expect(args[4]?.read_file.execute).toBeUndefined();
    await expect(args[8]?.('read_file', {}, 'Read a file')).resolves.toEqual([false, 'Tools cannot execute during context generation']);
  });

  it('rejects invalid structured output', async () => {
    const fixture = createFixture(response('{"verdict":"wrong"}'));
    await expect(fixture.agent.generateObjectFromContext(fixture.task, 'Review', z.object({ verdict: z.literal('ok') }))).rejects.toThrow();
    expect(fixture.history).toHaveLength(1);
  });

  it.each(['context-text', 'context-object', 'text', 'object'])('uses required streaming for %s without publishing responses', async (kind) => {
    const fixture = createFixture(response(), true);
    const schema = z.object({ verdict: z.literal('ok') });
    let output: unknown;
    if (kind === 'context-text') {
      output = (await fixture.agent.generateTextFromContext(fixture.task, 'Review')).output;
    } else if (kind === 'context-object') {
      output = (await fixture.agent.generateObjectFromContext(fixture.task, 'Review', schema)).output;
    } else if (kind === 'text') {
      output = await fixture.agent.generateText('provider/model', 'System', 'Review', '/project');
    } else {
      output = await fixture.agent.generateObject('provider/model', 'System', 'Review', schema, '/project');
    }
    expect(output).toEqual(kind.endsWith('object') ? { verdict: 'ok' } : '{"verdict":"ok"}');
    expect(fixture.model.doGenerateCalls).toHaveLength(0);
    expect(fixture.model.doStreamCalls).toHaveLength(1);
    if (kind.startsWith('context')) {
      expect(fixture.model.doStreamCalls[0].tools).toEqual([expect.objectContaining({ name: 'read_file' })]);
      expect(fixture.model.doStreamCalls[0].toolChoice).toEqual({ type: 'none' });
    }
    expect(fixture.execute).not.toHaveBeenCalled();
    expect(fixture.taskMock.addContextMessage).not.toHaveBeenCalled();
    expect(fixture.taskMock.addResponseMessage).not.toHaveBeenCalled();
  });

  it('fails before making a model call if the selected profile or provider is missing', async () => {
    const fixture = createFixture();
    fixture.modelManager.getProviders.mockReturnValue([]);
    await expect(fixture.agent.generateTextFromContext(fixture.task, 'Review')).rejects.toThrow('Provider provider not found');
    expect(fixture.model.doGenerateCalls).toHaveLength(0);
  });
});

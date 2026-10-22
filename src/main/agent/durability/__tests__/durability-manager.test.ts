import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContextMessage, ToolRecoveryMode } from '@common/types';

import { DurabilityManager } from '../durability-manager';

import { createMockAgentProfile } from '@/__tests__/mocks';

const createStorage = () => {
  const rows = new Map<string, string>();
  return {
    rows,
    getAgentExecutions: vi.fn((project: string, task: string) =>
      [...rows.entries()].filter(([key]) => key.startsWith(project + ':' + task + ':')).map(([, value]) => value),
    ),
    saveAgentExecution: vi.fn((project: string, task: string, id: string, json: string) => {
      rows.set(project + ':' + task + ':' + id, json);
    }),
    deleteAgentExecution: vi.fn((project: string, task: string, id: string) => {
      rows.delete(project + ':' + task + ':' + id);
    }),
  };
};

describe('DurabilityManager', () => {
  let storage: ReturnType<typeof createStorage>;
  let manager: DurabilityManager;
  const profile = createMockAgentProfile();
  const start = (id = 'root', parentPromptContextId?: string, parentToolCallId?: string) => {
    manager.begin({ promptContext: { id }, profile, mode: 'agent', contextMessages: [], contextFiles: [], parentPromptContextId, parentToolCallId });
    manager.beginStep(id, id + '-step');
  };
  const tool = (id: string, mode: ToolRecoveryMode, executionId = 'root') => {
    manager.beginTool(executionId, { id, name: 'service_' + id, input: { id }, attempt: 0 }, mode);
  };

  beforeEach(() => {
    storage = createStorage();
    manager = new DurabilityManager(storage, '/project', 'task');
  });

  it.each([false, true])('retains completed descendants of an unfinished Forget parent (cancelled=%s)', async (cancelled) => {
    start();
    tool('outer', ToolRecoveryMode.Forget);
    await manager.withToolCall('root', 'outer', async () => {
      tool('middle', ToolRecoveryMode.Forget);
      await manager.withToolCall('root', 'middle', async () => {
        tool('inner', ToolRecoveryMode.Forget);
        manager.completeTool('root', 'inner', 'Completed nested work', { type: 'text', value: 'Completed nested work' });
      });
    });
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn();
    const messages = await manager.recoverStep('root', execute, cancelled);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).toContain('Completed nested work');
    const assistant = messages.find((message) => message.role === 'assistant');
    expect(assistant?.content).toEqual([expect.objectContaining({ type: 'tool-call', toolCallId: 'outer' })]);
  });

  it('does not publish legacy Completed results without proof of finalization or repeat their operations', async () => {
    start();
    tool('legacy', ToolRecoveryMode.Safe);
    manager.completeTool('root', 'legacy', 'PRIVATE_LEGACY_OUTPUT');
    await manager.recoverStep('root', vi.fn());
    const legacy = structuredClone(manager.get('root')!);
    delete legacy.step!.calls[0].resultFinalized;
    storage.rows.set('/project:task:root', JSON.stringify(legacy));
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn();
    const messages = await manager.recoverStep('root', execute);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).not.toContain('PRIVATE_LEGACY_OUTPUT');
    expect(JSON.stringify(messages)).toContain('finalizationInterrupted');
    expect([...storage.rows.values()].join()).not.toContain('PRIVATE_LEGACY_OUTPUT');
    expect(manager.get('root')?.conversationReplaced).toBe(true);
  });

  it('preserves empty-text Anthropic redacted reasoning', async () => {
    start();
    manager.captureModelResponse(
      'root',
      [{ type: 'reasoning', text: '', providerMetadata: { anthropic: { redactedData: 'opaque-data' } } }],
      () => ToolRecoveryMode.Forget,
    );
    manager = new DurabilityManager(storage, '/project', 'task');
    const messages = await manager.recoverStep('root', vi.fn());
    expect(messages[0].content).toEqual([{ type: 'reasoning', text: '', providerOptions: { anthropic: { redactedData: 'opaque-data' } } }]);
  });

  it('restores the compacted child conversation rather than append-only precompaction history', async () => {
    start();
    start('child', 'root', 'parent-call');
    await manager.finishStep('child', [{ id: 'old', role: 'assistant', content: 'Large precompaction history' }]);
    const compacted: ContextMessage[] = [{ id: 'summary', role: 'assistant', content: 'Compacted summary' }];
    manager.replaceConversation('child', [], compacted);
    manager.beginStep('child', 'after-compaction');
    manager.appendText('child', 'text', 'New response');
    manager = new DurabilityManager(storage, '/project', 'task');
    expect(manager.get('child')?.history).toEqual(compacted);
    expect(JSON.stringify(manager.get('child'))).not.toContain('Large precompaction history');
    expect(manager.get('child')?.step?.id).toBe('after-compaction');
  });

  it('retains completed parallel calls in all modes and recovers only unfinished safe calls', async () => {
    start();
    manager.appendText('root', 'reasoning', 'Working');
    tool('completed', ToolRecoveryMode.Forget);
    manager.completeTool('root', 'completed', 'already done');
    tool('safe', ToolRecoveryMode.Safe);
    tool('notify', ToolRecoveryMode.Notify);
    tool('forget', ToolRecoveryMode.Forget);
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn(async () => 'replayed');
    const messages = await manager.recoverStep('root', execute);
    expect(execute).toHaveBeenCalledExactlyOnceWith({ id: 'safe', name: 'service_safe', input: { id: 'safe' }, attempt: 1 });
    const assistant = messages[0];
    expect(assistant.role).toBe('assistant');
    expect(assistant.content).toEqual(expect.arrayContaining([{ type: 'reasoning', text: 'Working' }]));
    expect(JSON.stringify(messages)).not.toContain('service_forget');
    expect(JSON.stringify(messages)).toContain('already done');
    expect(JSON.stringify(messages)).toContain('replayed');
    expect(JSON.stringify(messages)).toContain('final outcome is unknown');
    expect(messages[1].content as unknown[]).toHaveLength(3);
  });

  it('does not replay a safe call whose result was committed before the crash', async () => {
    start();
    tool('safe', ToolRecoveryMode.Safe);
    manager.completeTool('root', 'safe', { success: true });
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn();
    await manager.recoverStep('root', execute);
    expect(execute).not.toHaveBeenCalled();
  });

  it('stops replaying a safe call once the maximum recovery attempts are exhausted', async () => {
    start();
    tool('safe', ToolRecoveryMode.Safe);
    manager.beginTool('root', { id: 'safe', name: 'service_safe', input: { id: 'safe' }, attempt: 0 }, ToolRecoveryMode.Safe);
    expect(manager.get('root')?.step?.calls[0].attempt).toBe(1);
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn(async () => 'replayed');
    const messages = await manager.recoverStep('root', execute);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).not.toContain('replayed');
    expect(JSON.stringify(messages)).toContain('final outcome is unknown');
  });

  it('preserves provider metadata and tool ordering from the model response', async () => {
    start();
    const content = [
      { type: 'reasoning' as const, text: 'Reasoning', providerOptions: { anthropic: { signature: 'signed' } } },
      { type: 'text' as const, text: 'Read files' },
      { type: 'tool-call' as const, toolCallId: 'read', toolName: 'service_read', input: { id: 'read' } },
    ];
    manager.captureAssistant('root', content);
    manager.appendText('root', 'text', 'Must not duplicate');
    tool('read', ToolRecoveryMode.Safe);
    manager.completeTool('root', 'read', 'content');
    const messages = await manager.recoverStep('root', vi.fn());
    expect(messages[0].content).toEqual(content);
  });

  it('checkpoints effective arguments and hook overrides before execution', async () => {
    start();
    manager.beginTool('root', { id: 'call', name: 'service_call', input: { id: 'call' }, attempt: 0 }, ToolRecoveryMode.Safe, true);
    manager.beginTool('root', { id: 'call', name: 'service_call', input: { changed: true }, attempt: 0 }, ToolRecoveryMode.Notify);
    manager = new DurabilityManager(storage, '/project', 'task');
    const execute = vi.fn();
    await manager.recoverStep('root', execute);
    expect(execute).not.toHaveBeenCalled();
    expect(manager.get('root')?.step?.calls[0].input).toEqual({ changed: true });
  });

  it('resolves definition defaults, profile overrides and new-tool fallback', () => {
    expect(manager.resolveMode(profile, 'new')).toBe(ToolRecoveryMode.Forget);
    expect(manager.resolveMode(profile, 'read', ToolRecoveryMode.Safe)).toBe(ToolRecoveryMode.Safe);
    expect(manager.resolveMode({ ...profile, toolRecoveryModes: { read: ToolRecoveryMode.Notify } }, 'read', ToolRecoveryMode.Safe)).toBe(
      ToolRecoveryMode.Notify,
    );
    expect(manager.resolveMode({ ...profile, toolRecoveryModes: { 'ext.read': ToolRecoveryMode.Notify } }, 'ext_read', ToolRecoveryMode.Safe, 'ext.read')).toBe(
      ToolRecoveryMode.Notify,
    );
  });

  it('never replays cancelled tools and clears their journal after saving retained results', async () => {
    start();
    tool('done', ToolRecoveryMode.Forget);
    manager.completeTool('root', 'done', 'kept');
    tool('safe', ToolRecoveryMode.Safe);
    manager.markCancelled();
    manager = new DurabilityManager(storage, '/project', 'task');
    expect(manager.getRecoverableRoots()).toEqual([]);
    const persist = vi.fn(async (messages: ContextMessage[]) => {
      expect(storage.rows.size).toBe(1);
      expect(JSON.stringify(messages)).toContain('kept');
      expect(JSON.stringify(messages)).toContain('final outcome is unknown');
    });
    await manager.flushCancelled(persist);
    expect(persist).toHaveBeenCalledOnce();
    expect(storage.rows.size).toBe(0);
  });

  it('keeps the journal when the context handoff fails and retries using the same message IDs', async () => {
    start();
    tool('read', ToolRecoveryMode.Safe);
    manager.completeTool('root', 'read', 'result');
    const messages = await manager.recoverStep('root', vi.fn());
    await expect(
      manager.finishStep('root', messages, async () => {
        throw new Error('Disk full');
      }),
    ).rejects.toThrow('Disk full');
    manager = new DurabilityManager(storage, '/project', 'task');
    const recovered = await manager.recoverStep('root', vi.fn());
    expect(recovered).toEqual(messages);
    const persist = vi.fn(async () => undefined);
    await manager.finishStep('root', recovered, persist);
    expect(persist).toHaveBeenCalledWith(messages);
    manager.complete('root');
    expect(storage.rows.size).toBe(0);
  });

  it('retains child history and outcome until the parent finishes its handoff', async () => {
    start();
    tool('child-call', ToolRecoveryMode.Safe);
    start('child', 'root', 'child-call');
    const childMessages: ContextMessage[] = [{ id: 'child-response', role: 'assistant', content: 'Child finished' }];
    await manager.finishStep('child', childMessages);
    manager.complete('child');
    manager.setOutcome('child', { status: 'success', messages: childMessages });
    manager = new DurabilityManager(storage, '/project', 'task');
    expect(manager.findChild('child-call')?.history).toEqual(childMessages);
    expect(manager.findChild('child-call')?.outcome).toEqual({ status: 'success', messages: childMessages });
    manager.completeTool('root', 'child-call', manager.findChild('child-call')?.outcome);
    const recovered = await manager.recoverStep('root', vi.fn());
    await manager.finishStep('root', recovered, async () => {
      expect(manager.findChild('child-call')).toBeDefined();
    });
    expect(manager.findChild('child-call')).toBeUndefined();
  });

  it('preserves completed child steps when cancelling a parent and clears all owned executions', async () => {
    start();
    tool('child-call', ToolRecoveryMode.Safe);
    start('child', 'root', 'child-call');
    await manager.finishStep('child', [{ id: 'done', role: 'assistant', content: 'Completed child step' }]);
    manager.beginStep('child', 'pending');
    tool('pending', ToolRecoveryMode.Safe, 'child');
    manager.markCancelled();
    const persist = vi.fn(async (messages: ContextMessage[]) => {
      expect(JSON.stringify(messages)).toContain('Completed child step');
      expect(JSON.stringify(messages)).toContain('final outcome is unknown');
    });
    await manager.flushCancelled(persist);
    expect(storage.rows.size).toBe(0);
  });

  it('preserves custom model-output conversion across recovery', async () => {
    start();
    tool('read', ToolRecoveryMode.Safe);
    manager.completeTool('root', 'read', { raw: true }, { type: 'text', value: 'converted' });
    manager = new DurabilityManager(storage, '/project', 'task');
    const messages = await manager.recoverStep('root', vi.fn());
    expect(messages[1].content).toEqual([expect.objectContaining({ output: { type: 'text', value: 'converted' } })]);
  });

  it('keeps completed child work when the parent call uses Notify', async () => {
    start();
    tool('child-call', ToolRecoveryMode.Notify);
    start('child', 'root', 'child-call');
    await manager.finishStep('child', [{ id: 'child-result', role: 'assistant', content: 'Completed child work' }]);
    manager.beginStep('child', 'pending');
    tool('pending', ToolRecoveryMode.Safe, 'child');
    const execute = vi.fn();
    const messages = await manager.recoverStep('root', execute);
    expect(execute).not.toHaveBeenCalled();
    expect(JSON.stringify(messages)).toContain('Completed child work');
    expect(JSON.stringify(messages)).toContain('final outcome is unknown');
  });

  it('retains child progress if its tool is no longer available on recovery', async () => {
    start();
    tool('child-call', ToolRecoveryMode.Safe);
    start('child', 'root', 'child-call');
    await manager.finishStep('child', [{ id: 'child-result', role: 'assistant', content: 'Completed child work' }]);
    const messages = await manager.recoverStep('root', async () => ({ error: 'Tool no longer available' }));
    expect(JSON.stringify(messages)).toContain('Completed child work');
    expect(JSON.stringify(messages)).toContain('Tool no longer available');
  });

  it('reattaches multiple extension-started children by their original invocation order', async () => {
    start();
    tool('custom', ToolRecoveryMode.Safe);
    const attach = async (prefix: string) => {
      const ids: string[] = [];
      await manager.withToolCall('root', 'custom', async () => {
        for (const index of [0, 1]) {
          const context = manager.attachChildContext({ id: prefix + index });
          manager.begin({
            promptContext: context,
            parentPromptContextId: context.parentPromptContextId,
            parentToolCallId: context.parentToolCallId,
            profile,
            mode: 'subagent',
            contextMessages: [],
            contextFiles: [],
          });
          ids.push(context.id);
        }
      });
      return ids;
    };
    expect(await attach('original-')).toEqual(['original-0', 'original-1']);
    manager = new DurabilityManager(storage, '/project', 'task');
    expect(await attach('new-')).toEqual(['original-0', 'original-1']);
  });

  it('supersedes an abandoned execution without replaying it or deleting the new run', async () => {
    start();
    tool('pending', ToolRecoveryMode.Safe);
    manager.begin({ promptContext: { id: 'new-root' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
    const persist = vi.fn(async () => undefined);
    await manager.discardPendingRoots(persist, 'new-root');
    expect(persist).toHaveBeenCalledOnce();
    expect(manager.get('root')).toBeUndefined();
    expect(manager.getRecoverableRoots().map((execution) => execution.promptContext.id)).toEqual(['new-root']);
  });

  it('keeps outcomes received after cancellation but before journal finalization', async () => {
    start();
    tool('late', ToolRecoveryMode.Forget);
    manager.markCancelled();
    manager.completeTool('root', 'late', 'Finished just after cancellation');
    const messages = await manager.recoverStep('root', vi.fn(), true);
    expect(JSON.stringify(messages)).toContain('Finished just after cancellation');
  });

  it('keeps finished tool outcomes during shutdown but leaves interrupted child calls pending', () => {
    start();
    tool('read', ToolRecoveryMode.Safe);
    tool('child-call', ToolRecoveryMode.Safe);
    start('child', 'root', 'child-call');
    manager.suspend();
    manager.completeTool('root', 'read', 'Read finished');
    manager.completeTool('root', 'child-call', { status: 'cancelled' });
    expect(manager.isToolCompleted('root', 'read')).toBe(true);
    expect(manager.isToolCompleted('root', 'child-call')).toBe(false);
  });

  it('isolates executions by project, task and prompt context', () => {
    start('one');
    start('two');
    expect(manager.getRecoverableRoots()).toHaveLength(2);
    expect(new DurabilityManager(storage, '/other', 'task').getRecoverableRoots()).toEqual([]);
    expect(new DurabilityManager(storage, '/project', 'other').getRecoverableRoots()).toEqual([]);
  });

  it('fails closed if the tool intent cannot be saved', () => {
    start();
    storage.saveAgentExecution.mockImplementation(() => {
      throw new Error('Storage failed');
    });
    expect(() => tool('write', ToolRecoveryMode.Notify)).toThrow('Storage failed');
  });
});

describe('task conversation ownership', () => {
  it('updates an interrupted main execution but not its private child or a standalone private execution', () => {
    const storage = createStorage();
    const manager = new DurabilityManager(storage, '/project', 'task');
    const profile = createMockAgentProfile();
    manager.begin({ promptContext: { id: 'main' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
    manager.begin({
      promptContext: { id: 'child' },
      profile: { ...profile, isSubagent: true },
      mode: 'agent',
      contextMessages: [],
      contextFiles: [],
      parentPromptContextId: 'main',
    });
    manager.begin({ promptContext: { id: 'auxiliary' }, profile: { ...profile, isSubagent: true }, mode: 'agent', contextMessages: [], contextFiles: [] });
    const replacement: ContextMessage[] = [{ id: 'summary', role: 'assistant', content: 'Compacted conversation' }];
    manager.checkpointTaskConversation(replacement);
    const restored = new DurabilityManager(storage, '/project', 'task');
    expect(restored.get('main')?.contextMessages).toEqual(replacement);
    expect(restored.get('main')?.conversationReplaced).toBe(true);
    expect(restored.get('child')?.contextMessages).toEqual([]);
    expect(restored.get('auxiliary')?.contextMessages).toEqual([]);
  });
});

it.each([
  [ToolRecoveryMode.Forget, false],
  [ToolRecoveryMode.Notify, false],
  [ToolRecoveryMode.Forget, true],
  [ToolRecoveryMode.Notify, true],
] as const)('preserves only the finalized model representation of nested progress (%s, cancelled=%s)', async (mode, cancelled) => {
  const storage = createStorage();
  const manager = new DurabilityManager(storage, '/project', 'task');
  manager.begin({ promptContext: { id: 'root' }, profile: createMockAgentProfile(), mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.beginStep('root', 'step');
  manager.beginTool('root', { id: 'parent', name: 'orchestrate', input: {}, attempt: 1 }, mode);
  await manager.withToolCall('root', 'parent', async () => {
    manager.beginTool('root', { id: 'nested', name: 'sensitive', input: {}, attempt: 1 }, ToolRecoveryMode.Safe);
  });
  expect(manager.get('root')?.step?.calls.find((call) => call.id === 'nested')?.parentToolCallId).toBe('parent');
  const modelOutput = { type: 'content' as const, value: [{ type: 'text' as const, text: 'PUBLIC_RESULT' }] };
  manager.completeTool('root', 'nested', { token: 'PRIVATE_RAW_TOKEN' }, modelOutput);
  const restored = new DurabilityManager(storage, '/project', 'task');
  const messages = await restored.recoverStep('root', vi.fn(), cancelled);
  expect(JSON.stringify(messages)).toContain('PUBLIC_RESULT');
  expect(JSON.stringify(messages)).not.toContain('PRIVATE_RAW_TOKEN');
  expect(JSON.stringify(messages)).toContain(JSON.stringify(modelOutput));
});

it('does not substitute raw nested output when its finalized model representation is unavailable', async () => {
  const manager = new DurabilityManager(createStorage(), '/project', 'task');
  manager.begin({ promptContext: { id: 'root' }, profile: createMockAgentProfile(), mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.beginStep('root', 'step');
  manager.beginTool('root', { id: 'parent', name: 'orchestrate', input: {}, attempt: 1 }, ToolRecoveryMode.Notify);
  await manager.withToolCall('root', 'parent', async () => {
    manager.beginTool('root', { id: 'nested', name: 'sensitive', input: {}, attempt: 1 }, ToolRecoveryMode.Safe);
    manager.completeTool('root', 'nested', 'PRIVATE_WITHOUT_MODEL_REPRESENTATION');
  });
  const messages = await manager.recoverStep('root', vi.fn());
  expect(JSON.stringify(messages)).not.toContain('PRIVATE_WITHOUT_MODEL_REPRESENTATION');
  expect(JSON.stringify(messages)).toContain('finalizationInterrupted');
});

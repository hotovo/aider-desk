import { describe, expect, it, vi } from 'vitest';
import { ContextMessage, ToolRecoveryMode } from '@common/types';

import { DurabilityManager } from '../durability-manager';

import { runSubagentTask } from '@/agent/subagent';
import { createMockAgentProfile, createMockTask } from '@/__tests__/mocks';

vi.mock('@/logger');

const createFixture = async () => {
  const rows = new Map<string, string>();
  const storage = {
    getAgentExecutions: vi.fn(() => [...rows.values()]),
    saveAgentExecution: vi.fn((_project: string, _task: string, id: string, json: string) => {
      rows.set(id, json);
    }),
    deleteAgentExecution: vi.fn((_project: string, _task: string, id: string) => {
      rows.delete(id);
    }),
  };
  const manager = new DurabilityManager(storage, '/project', 'task');
  const profile = createMockAgentProfile();
  manager.begin({ promptContext: { id: 'parent' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.beginStep('parent', 'parent-step');
  manager.beginTool('parent', { id: 'child-call', name: 'subagents---run_task', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
  const promptContext = { id: 'child', group: { id: 'group', interruptId: 'interrupt' } };
  manager.begin({
    promptContext,
    profile: { ...profile, isSubagent: true },
    mode: 'subagent',
    contextMessages: [],
    contextFiles: [],
    parentPromptContextId: 'parent',
    parentToolCallId: 'child-call',
  });
  const history: ContextMessage[] = [{ id: 'completed', role: 'assistant', content: 'Completed child work' }];
  await manager.finishStep('child', history);
  const task = createMockTask();
  Object.assign(task, { durabilityManager: manager, runSubagent: vi.fn(async () => [...history]) });
  return { manager, task, profile, promptContext, history, storage };
};

describe('Subagent durable identity and ownership', () => {
  it('reattaches the original child context and group after restart', async () => {
    const { manager, task, profile, promptContext } = await createFixture();
    const onStarted = vi.fn();
    const result = await runSubagentTask({ task, targetSubagent: profile, prompt: 'Original request', parentToolCallId: 'child-call', onStarted });
    expect(onStarted).toHaveBeenCalledWith(expect.objectContaining({ id: 'child', group: expect.objectContaining({ id: 'group', interruptId: 'interrupt' }) }));
    expect(task.runSubagent).toHaveBeenCalledExactlyOnceWith(
      expect.anything(),
      'Original request',
      [],
      undefined,
      undefined,
      expect.any(AbortController),
      promptContext,
    );
    expect(result.promptContext.id).toBe('child');
    expect(manager.findChild('child-call')?.outcome).toEqual(result);
  });

  it('returns a completed child outcome without invoking the child again', async () => {
    const { manager, task, profile, history, promptContext, storage } = await createFixture();
    const outcome = { status: 'success', messages: history, promptContext };
    manager.complete('child');
    manager.setOutcome('child', outcome);
    Object.assign(task, { durabilityManager: new DurabilityManager(storage, '/project', 'task') });
    const result = await runSubagentTask({ task, targetSubagent: profile, prompt: 'Original request', parentToolCallId: 'child-call' });
    expect(result).toEqual(outcome);
    expect(task.runSubagent).not.toHaveBeenCalled();
  });

  it('never restarts an explicitly cancelled child and retains its completed work', async () => {
    const { manager, task, profile, history } = await createFixture();
    manager.markCancelled('child');
    const result = await runSubagentTask({ task, targetSubagent: profile, prompt: 'Original request', parentToolCallId: 'child-call' });
    expect(result).toMatchObject({ status: 'cancelled', messages: history });
    expect(task.runSubagent).not.toHaveBeenCalled();
    expect(manager.getRecoverableRoots().map((execution) => execution.promptContext.id)).toEqual(['parent']);
  });

  it('preserves child journals when shutdown interrupts them without user cancellation', async () => {
    const { manager, task, profile } = await createFixture();
    manager.beginStep('child', 'interrupted-step');
    manager.suspend();
    const controller = new AbortController();
    controller.abort();
    await runSubagentTask({ task, targetSubagent: profile, prompt: 'Original request', parentToolCallId: 'child-call', abortSignal: controller.signal });
    expect(manager.isCancelled('child')).toBe(false);
    expect(manager.findChild('child-call')?.step?.id).toBe('interrupted-step');
    expect(manager.findChild('child-call')?.outcome).toBeUndefined();
  });
});

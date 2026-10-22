import { describe, expect, it, vi } from 'vitest';
import { ToolRecoveryMode } from '@common/types';

import { Task } from '../task';

import { DurabilityManager } from '@/agent/durability/durability-manager';
import { createMockAgentProfile } from '@/__tests__/mocks';

vi.mock('@/logger');

const createFixture = () => {
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
  manager.begin({ promptContext: { id: 'root' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.beginStep('root', 'root-step');
  for (const id of ['one', 'two']) {
    manager.beginTool('root', { id: id + '-call', name: 'subagents---run_task', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
    manager.begin({
      promptContext: { id, group: { id: id + '-group', interruptId: id } },
      profile: { ...profile, isSubagent: true },
      mode: 'subagent',
      contextMessages: [],
      contextFiles: [],
      parentPromptContextId: 'root',
      parentToolCallId: id + '-call',
    });
  }
  const one = new AbortController();
  const two = new AbortController();
  const fake = {
    durabilityManager: manager,
    extensionManager: { dispatchEvent: vi.fn(async (_name: string, event: Record<string, unknown>) => event) },
    project: { baseDir: '/project' },
    taskId: 'task',
    subagentAbortControllers: { one, two },
    resolutionAbortControllers: {},
    currentQuestion: undefined,
    findMessageConnectors: vi.fn(() => []),
    agent: { interrupt: vi.fn() },
    promptFinished: vi.fn(),
    cleanupChunkBuffers: vi.fn(),
    initialized: false,
    init: vi.fn(async () => undefined),
    getTaskAgentProfile: vi.fn(async () => profile),
    runPromptInAgent: vi.fn(async () => undefined),
    persistDurableMessages: vi.fn(async () => undefined),
    store: { getSettings: () => ({ language: 'en', resumeAgentAfterRestart: true }) },
  };
  return { manager, fake, task: fake as unknown as Task, one, two, profile, storage };
};

describe('Task durability lifecycle', () => {
  it('localizes missing-profile recovery errors without executing the task', async () => {
    const { task, fake, manager } = createFixture();
    Object.assign(fake, { getTaskAgentProfile: vi.fn(async () => null), store: { getSettings: () => ({ language: 'zh' }) }, addLogMessage: vi.fn() });
    await Task.prototype.recoverDurableExecutions.call(task);
    expect(fake.runPromptInAgent).not.toHaveBeenCalled();
    expect((fake as typeof fake & { addLogMessage: ReturnType<typeof vi.fn> }).addLogMessage).toHaveBeenCalledWith('error', '无法恢复任务：智能体配置不可用。');
    expect(manager.get('root')).toBeDefined();
  });

  it('cancels the whole task and all children when no group is specified', async () => {
    const { task, fake, manager, one, two } = createFixture();
    await Task.prototype.interruptResponse.call(task);
    expect(one.signal.aborted).toBe(true);
    expect(two.signal.aborted).toBe(true);
    expect(fake.agent.interrupt).toHaveBeenCalledOnce();
    expect(manager.isCancelled('root')).toBe(true);
    expect(manager.isCancelled('one')).toBe(true);
    expect(manager.isCancelled('two')).toBe(true);
    expect(manager.getRecoverableRoots()).toEqual([]);
  });

  it('cancels only the specifically selected subagent', async () => {
    const { task, fake, manager, one, two } = createFixture();
    await Task.prototype.interruptResponse.call(task, 'one');
    expect(one.signal.aborted).toBe(true);
    expect(two.signal.aborted).toBe(false);
    expect(fake.agent.interrupt).not.toHaveBeenCalled();
    expect(manager.isCancelled('one')).toBe(true);
    expect(manager.isCancelled('two')).toBe(false);
    expect(manager.isCancelled('root')).toBe(false);
  });

  it('keeps running executions recoverable across normal shutdown', async () => {
    const { task, manager, one, two, storage } = createFixture();
    await Task.prototype.interruptResponse.call(task, undefined, true);
    expect(one.signal.aborted).toBe(true);
    expect(two.signal.aborted).toBe(true);
    expect(manager.isSuspended('root')).toBe(true);
    expect(manager.isCancelled('root')).toBe(false);
    expect(new DurabilityManager(storage, '/project', 'task').getRecoverableRoots().map((execution) => execution.promptContext.id)).toEqual(['root']);
  });

  it('automatically resumes the root with its original prompt context, not its children independently', async () => {
    const { task, fake, profile } = createFixture();
    await Task.prototype.recoverDurableExecutions.call(task);
    expect(fake.init).toHaveBeenCalledOnce();
    expect(fake.runPromptInAgent).toHaveBeenCalledExactlyOnceWith(profile, 'agent', null, { id: 'root' });
  });

  it('does not auto-resume executions when resume-after-restart is disabled, but still finalizes cancelled ones', async () => {
    const { task, fake, manager } = createFixture();
    Object.assign(fake, { store: { getSettings: () => ({ language: 'en', resumeAgentAfterRestart: false }) } });
    await Task.prototype.recoverDurableExecutions.call(task);
    expect(fake.init).not.toHaveBeenCalled();
    expect(fake.runPromptInAgent).not.toHaveBeenCalled();
    expect(manager.get('root')).toBeDefined();
  });

  it('resumes standalone extension-started executions as subagents', async () => {
    const { task, fake, manager, profile } = createFixture();
    const subagentProfile = { ...profile, isSubagent: true };
    manager.begin({ promptContext: { id: 'standalone' }, profile: subagentProfile, mode: 'subagent', contextMessages: [], contextFiles: [] });
    const runSubagent = vi.fn(async () => []);
    Object.assign(fake, { runSubagent });
    await Task.prototype.recoverDurableExecutions.call(task);
    expect(runSubagent).toHaveBeenCalledExactlyOnceWith(subagentProfile, '', [], [], undefined, undefined, { id: 'standalone' });
    expect(fake.runPromptInAgent).toHaveBeenCalledOnce();
  });

  it('finalizes and clears cancelled journals without restarting tasks', async () => {
    const { task, fake, manager } = createFixture();
    manager.markCancelled();
    await Task.prototype.recoverDurableExecutions.call(task);
    expect(fake.runPromptInAgent).not.toHaveBeenCalled();
    expect(manager.get('root')).toBeUndefined();
    expect(manager.get('one')).toBeUndefined();
    expect(manager.get('two')).toBeUndefined();
  });
});

it('uses fresh execution attempts when rerunning the same user message and rejects stale callbacks', async () => {
  const { fake, manager, profile } = createFixture();
  manager.clear();
  const attempts: import('@common/types').PromptContext[] = [];
  Object.assign(fake, {
    task: { name: 'Existing task', agentProfileId: profile.id },
    queuedPrompts: [],
    isPromptRunning: vi.fn(() => false),
    getTaskAgentProfile: vi.fn(async () => profile),
    addUserMessage: vi.fn(),
    addLogMessage: vi.fn(),
    telemetryManager: { captureRunPrompt: vi.fn() },
    extensionManager: { dispatchEvent: vi.fn(async (_name: string, event: Record<string, unknown>) => event) },
    runPromptInAgent: vi.fn(async (_profile: unknown, _mode: unknown, _prompt: unknown, context: import('@common/types').PromptContext) => {
      attempts.push(context);
      manager.begin({ promptContext: context, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
      manager.beginStep(context.id, context.id + '-step');
      manager.beginTool(context.id, { id: 'read', name: 'read', input: {}, attempt: 1 }, ToolRecoveryMode.Safe);
      manager.completeTool(context.id, 'read', 'Attempt ' + attempts.length);
      if (attempts.length === 1) {
        manager.clear(context.id);
      }
      return [];
    }),
  });
  await Task.prototype.runPrompt.call(fake as unknown as Task, 'Original request', 'agent', false, 'retained-user-message', false);
  await Task.prototype.runPrompt.call(fake as unknown as Task, 'Revised request', 'agent', false, 'retained-user-message', false);
  expect(attempts).toHaveLength(2);
  expect(attempts[0].id).not.toBe(attempts[1].id);
  expect(attempts.map((attempt) => attempt.userMessageId)).toEqual(['retained-user-message', 'retained-user-message']);
  manager.completeTool(attempts[0].id, 'read', 'Stale result');
  expect(manager.get(attempts[1].id)?.step?.calls[0].output).toBe('Attempt 2');
  expect(manager.get(attempts[0].id)).toBeUndefined();
});

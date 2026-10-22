import { describe, expect, it, vi } from 'vitest';
import { ToolRecoveryMode } from '@common/types';

import { Task } from '../task';
import { ContextManager } from '../context-manager';

import type { Agent } from '@/agent/agent';

import * as compaction from '@/agent/compaction';
import { DurabilityManager } from '@/agent/durability/durability-manager';
import { createMockAgentProfile } from '@/__tests__/mocks';

vi.mock('@/logger');

it('replaces and persists context without cancelling the active execution, but explicit clear still deletes it', async () => {
  const rows = new Map<string, string>();
  const storage = {
    getAgentExecutions: () => [...rows.values()],
    saveAgentExecution: (_project: string, _task: string, id: string, json: string) => {
      rows.set(id, json);
    },
    deleteAgentExecution: (_project: string, _task: string, id: string) => {
      rows.delete(id);
    },
  };
  const manager = new DurabilityManager(storage, '/project', 'task');
  manager.begin({ promptContext: { id: 'main' }, profile: createMockAgentProfile(), mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.beginStep('main', 'step');
  const task = {
    project: { baseDir: '/project' },
    taskId: 'task',
    durabilityManager: manager,
    runCommand: vi.fn(async () => undefined),
    eventManager: { sendClearTask: vi.fn() },
    clearContext: vi.fn(async (...args: Parameters<Task['clearContext']>) => await Task.prototype.clearContext.call(task as unknown as Task, ...args)),
    contextManager: { clearMessages: vi.fn() },
  };
  const context = {
    task,
    messages: [],
    save: vi.fn(async () => undefined),
    getContextMessagesData: vi.fn(() => []),
    toConnectorMessages: vi.fn(() => []),
  };
  const summary = [{ id: 'summary', role: 'assistant' as const, content: 'Compacted context' }];
  await ContextManager.prototype.loadMessages.call(context as unknown as ContextManager, summary, false, 'main');
  expect(task.clearContext).toHaveBeenCalledExactlyOnceWith(false, false, false, false, true);
  expect(context.save).toHaveBeenCalledOnce();
  expect(manager.get('main')?.contextMessages).toEqual(summary);
  expect(manager.get('main')?.step?.id).toBe('step');
  expect(manager.isCancelled('main')).toBe(false);
  manager.beginTool('main', { id: 'after', name: 'read', input: {}, attempt: 0 }, ToolRecoveryMode.Safe);
  manager.completeTool('main', 'after', 'Tool still works');
  manager.appendText('main', 'text', 'Text is still durable');
  const messages = await manager.recoverStep('main', vi.fn());
  expect(JSON.stringify(messages)).toContain('Text is still durable');
  expect(JSON.stringify(messages)).toContain('Tool still works');
  await Task.prototype.clearContext.call(task as unknown as Task, false, false, false, false);
  expect(rows.size).toBe(0);
});

describe('summary execution identity', () => {
  it('uses an independent identity while retaining the main journal for context replacement', async () => {
    const profile = createMockAgentProfile();
    const user = { id: 'user', role: 'user' as const, content: 'Original request' };
    const runAgent = vi.fn<Agent['runAgent']>(async () => [{ id: 'summary', role: 'assistant' as const, content: 'Summary' }]);
    const loadMessages = vi.fn(async () => undefined);
    const fake = {
      task: { state: 'in-progress' },
      project: { baseDir: '/project' },
      updateContextInfo: vi.fn(async () => undefined),
      saveTask: vi.fn(async () => undefined),
      findSkillActivationMessages: vi.fn(() => []),
      addLogMessage: vi.fn(),
      agent: { runAgent },
      promptsManager: { getCompactConversationPrompt: vi.fn(async () => 'Summarize') },
      contextManager: { setContextMessages: vi.fn(), loadMessages, backupContext: vi.fn(async () => undefined) },
      runNextQueuedPrompt: vi.fn(async () => undefined),
    };
    await Task.prototype.compactConversation.call(fake as unknown as Task, 'agent', undefined, profile, [user], { id: 'main' }, undefined, false);
    expect(runAgent).toHaveBeenCalledOnce();
    expect(runAgent.mock.calls[0][4]?.id).not.toBe('main');
    expect(loadMessages).toHaveBeenCalledWith(expect.any(Array), true, 'main', true);
  });
});

it.each(['smart', 'summary'])('keeps manual %s compaction durable and undoable without an explicit execution ID', async (kind) => {
  const rows = new Map<string, string>();
  const storage = {
    getAgentExecutions: () => [...rows.values()],
    saveAgentExecution: (_project: string, _task: string, id: string, json: string) => {
      rows.set(id, json);
    },
    deleteAgentExecution: (_project: string, _task: string, id: string) => {
      rows.delete(id);
    },
  };
  const profile = createMockAgentProfile();
  const manager = new DurabilityManager(storage, '/project', 'task');
  const original: import('@common/types').ContextMessage[] = [
    { id: 'user', role: 'user', content: 'Original request' },
    { id: 'old', role: 'assistant', content: 'OLD_CONVERSATION' },
  ];
  manager.begin({ promptContext: { id: 'main' }, profile, mode: 'agent', contextMessages: [], contextFiles: [] });
  manager.replaceConversation('main', [{ id: 'earlier-summary', role: 'assistant', content: 'EARLIER_SUMMARY' }], original);
  const task = {
    taskId: 'task',
    task: { state: 'interrupted' },
    project: { baseDir: '/project' },
    getProjectDir: () => '/project',
    durabilityManager: manager,
    contextManager: undefined as unknown as ContextManager,
    clearContext: vi.fn(async (...args: Parameters<Task['clearContext']>) => Task.prototype.clearContext.call(task as unknown as Task, ...args)),
    runCommand: vi.fn(async () => undefined),
    sendContextInfoUpdated: vi.fn(),
    eventManager: { sendClearTask: vi.fn() },
    updateTask: vi.fn(async () => undefined),
    updateContextInfo: vi.fn(async () => undefined),
    saveTask: vi.fn(async () => undefined),
    findSkillActivationMessages: vi.fn(() => []),
    addLogMessage: vi.fn(),
    runNextQueuedPrompt: vi.fn(async () => undefined),
    agent: { runAgent: vi.fn(async () => [{ id: 'summary', role: 'assistant' as const, content: 'NEW_SUMMARY' }]) },
    promptsManager: { getCompactConversationPrompt: vi.fn(async () => 'Summarize') },
    smartCompactionLevel: 1,
    lastSmartCompactionMessageCount: 0,
  };
  const context = new ContextManager(task as unknown as Task, 'task', original);
  task.contextManager = context;
  vi.spyOn(context, 'getContextMessages').mockImplementation(async () => context['messages']);
  vi.spyOn(context, 'save').mockResolvedValue(undefined);
  vi.spyOn(context, 'backupContext').mockResolvedValue(undefined);
  vi.spyOn(context, 'getContextMessagesData').mockReturnValue([]);
  vi.spyOn(context, 'toConnectorMessages').mockReturnValue([]);
  const compact = vi.spyOn(compaction, 'smartCompactMessages').mockResolvedValue([{ id: 'smart-summary', role: 'assistant', content: 'NEW_SUMMARY' }]);
  try {
    if (kind === 'smart') {
      await Task.prototype.smartCompactConversation.call(task as unknown as Task, undefined, undefined, { compactionLevel: 1 });
    } else {
      await Task.prototype.compactConversation.call(task as unknown as Task, 'agent', undefined, profile, undefined, undefined, undefined, false);
    }
    expect(context.hasUndoSnapshot()).toBe(true);
    expect(context['messages']).not.toEqual(original);
    expect(new DurabilityManager(storage, '/project', 'task').get('main')).toMatchObject({
      contextMessages: context['messages'],
      history: [],
      conversationReplaced: true,
    });
    expect(await Task.prototype.undoContextChange.call(task as unknown as Task)).toBe(true);
    expect(context['messages']).toEqual(original);
    expect(new DurabilityManager(storage, '/project', 'task').get('main')?.contextMessages).toEqual(original);
    expect(manager.isCancelled('main')).toBe(false);
    expect(context.hasUndoSnapshot()).toBe(false);
  } finally {
    compact.mockRestore();
  }
});

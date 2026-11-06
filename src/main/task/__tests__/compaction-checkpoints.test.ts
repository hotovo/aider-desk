import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';
import { DefaultTaskState } from '@common/types';

import { ContextManager } from '../context-manager';
import { Task } from '../task';

import type { ContextMessage, Mode } from '@common/types';

import * as compaction from '@/agent/compaction';

vi.mock('@/logger');

let projectDir: string;

const original: ContextMessage[] = [
  { id: 'user', role: 'user', content: 'Original request' },
  { id: 'assistant', role: 'assistant', content: 'Original response' },
];

const createTask = () => {
  const fixture = {
    taskId: 'task',
    project: { baseDir: projectDir },
    task: { state: DefaultTaskState.Interrupted },
    store: { getSettings: () => ({ taskSettings: {} }) },
    getProjectDir: () => projectDir,
    getTaskDir: () => projectDir,
    isPromptRunning: vi.fn(() => false),
    durabilityManager: { checkpointTaskConversation: vi.fn(), clear: vi.fn() },
    eventManager: { sendLog: vi.fn(), sendClearTask: vi.fn() },
    contextManager: undefined as unknown as ContextManager,
    clearContext: vi.fn(async (...args: Parameters<Task['clearContext']>) => Task.prototype.clearContext.call(fixture as unknown as Task, ...args)),
    runCommand: vi.fn(),
    updateTask: vi.fn(),
    updateContextInfo: vi.fn(),
    sendContextInfoUpdated: vi.fn(),
    sendUserMessage: vi.fn(),
    sendResponseCompleted: vi.fn(),
    sendToolMessage: vi.fn(),
    sendAddMessage: vi.fn(),
    saveTask: vi.fn(),
    findSkillActivationMessages: vi.fn(() => []),
    runNextQueuedPrompt: vi.fn(),
    promptsManager: { getCompactConversationPrompt: vi.fn(async () => 'Summarize') },
    agent: { runAgent: vi.fn(async () => [{ id: 'summary', role: 'assistant', content: 'Summary' }]) },
    sendPromptToAider: vi.fn(async () => [{ messageId: 'summary', content: 'Summary' }]),
    smartCompactionLevel: 1,
    lastSmartCompactionMessageCount: 0,
  };
  Object.setPrototypeOf(fixture, Task.prototype);
  const task = fixture as unknown as Task;
  fixture.contextManager = new ContextManager(task, 'task');
  return { task, context: fixture.contextManager, fixture };
};

beforeEach(async () => {
  projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiderdesk-checkpoints-'));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(projectDir, { recursive: true, force: true });
});

describe('durable compaction restore points', () => {
  it.each(['agent', 'ask', 'smart'] as const)('restores B then A after restart for %s compaction', async (mode) => {
    const { task, context, fixture } = createTask();
    await context.getContextMessages();
    context.disableAutosave();
    original.forEach((message) => context.addContextMessage(message));
    vi.spyOn(compaction, 'smartCompactMessages').mockImplementation(async (messages) => messages.map((message) => ({ ...message })));

    const compact = async () => {
      if (mode === 'smart') {
        await task.smartCompactConversation(undefined, undefined, { compactionLevel: 1 });
      } else {
        await task.compactConversation(mode satisfies Mode, undefined, DEFAULT_AGENT_PROFILE, undefined, undefined, undefined, false);
      }
    };

    await compact();
    const pointA = (await context.getContextMessages()).find((message) => message.role === 'log');
    expect(pointA?.role).toBe('log');
    if (pointA?.role !== 'log') {
      throw new Error('Missing compaction point A');
    }
    const checkpointA = pointA.actions?.[0].data;
    expect(fixture.eventManager.sendLog).toHaveBeenCalledWith(expect.objectContaining({ id: pointA.id, actions: pointA.actions }));
    expect(context.hasUndoSnapshot()).toBe(true);
    context.addContextMessage({ id: 'next', role: 'user', content: 'Continue after A' });
    const beforeB = structuredClone(await context.getContextMessages());
    await compact();
    const logs = (await context.getContextMessages()).filter((message) => message.role === 'log');
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(pointA);
    const checkpointB = logs[1].actions?.[0].data;

    const restarted = createTask();
    await restarted.context.getContextMessages();
    restarted.context.disableAutosave();
    const restoredLogs = restarted.context.getContextMessagesData().filter((message) => 'level' in message);
    expect(restoredLogs.map((message) => message.id)).toEqual(logs.map((message) => message.id));
    expect(await restarted.task.undoContextChange((checkpointB as { checkpointId: string }).checkpointId)).toBe(true);
    expect(await restarted.context.getContextMessages()).toEqual(beforeB);
    expect(await restarted.task.undoContextChange((checkpointA as { checkpointId: string }).checkpointId)).toBe(true);
    expect(await restarted.context.getContextMessages()).toEqual(original);
  });

  it.each(['../context.json', 'context.pre-compaction.999.json', 'context.pre-compaction.001.json'])(
    'does not replace history for unavailable checkpoint %s',
    async (checkpointId) => {
      const { task, context, fixture } = createTask();
      await context.getContextMessages();
      context.disableAutosave();
      original.forEach((message) => context.addContextMessage(message));
      await fs.mkdir(context.getSnapshotDir(), { recursive: true });
      await fs.writeFile(path.join(context.getSnapshotDir(), 'context.pre-compaction.001.json'), '{"contextMessages":[null]}');
      expect(await task.undoContextChange(checkpointId)).toBe(false);
      expect(await context.getContextMessages()).toEqual(original);
      expect(fixture.eventManager.sendClearTask).not.toHaveBeenCalled();
    },
  );

  it('backs up current messages even before autosave has run and allocates distinct checkpoints concurrently', async () => {
    const { context } = createTask();
    await context.getContextMessages();
    context.disableAutosave();
    original.forEach((message) => context.addContextMessage(message));
    const [first, second] = await Promise.all([context.backupContext(), context.backupContext()]);
    expect(first).not.toBe(second);
    expect(await context.readCompactionCheckpoint(first)).toEqual(original);
    expect(await context.readCompactionCheckpoint(second)).toEqual(original);
  });
});

it('rejects checkpoint restores during a running prompt and clears stale undo state after a successful restore', async () => {
  const { task, context, fixture } = createTask();
  await context.getContextMessages();
  context.disableAutosave();
  original.forEach((message) => context.addContextMessage(message));
  const checkpointId = await context.backupContext();
  context.setContextMessages([{ id: 'summary', role: 'assistant', content: 'Summary' }], false);
  expect(context.hasUndoSnapshot()).toBe(true);
  fixture.isPromptRunning.mockReturnValue(true);
  expect(await task.undoContextChange(checkpointId)).toBe(false);
  expect(context.hasUndoSnapshot()).toBe(true);
  expect(fixture.eventManager.sendClearTask).not.toHaveBeenCalled();
  fixture.isPromptRunning.mockReturnValue(false);
  expect(await task.undoContextChange(checkpointId)).toBe(true);
  expect(context.hasUndoSnapshot()).toBe(false);
  expect(await context.getContextMessages()).toEqual(original);
});

it('retains persisted restore-point logs when a durable execution restores model-only history', async () => {
  const { task, context } = createTask();
  await context.getContextMessages();
  context.disableAutosave();
  original.forEach((message) => context.addContextMessage(message));
  const checkpointId = await context.backupContext();
  const point = context.addPersistentLogMessage('info', 'Compacted', undefined, [{ id: 'undoContextChange', data: { checkpointId } }]);
  await task.restoreDurableConversation(original);
  expect(await context.getContextMessages()).toEqual([...original, point]);
  await task.restoreDurableConversation([...original, point]);
  expect(await context.getContextMessages()).toEqual([...original, point]);
});

import { describe, expect, it, vi } from 'vitest';
import { ContextCompactionType, ContextMessage, DefaultTaskState, MessageRole, TaskSettings } from '@common/types';
import { DEFAULT_AGENT_PROFILE } from '@common/agent';

import { Task } from '../task';

import type { Agent } from '@/agent';

vi.mock('@/logger');

const createFixture = (overrides: Partial<TaskSettings> = {}) => {
  const profile = { ...DEFAULT_AGENT_PROFILE, provider: 'profile-provider', model: 'profile-model' };
  const messages: ContextMessage[] = [{ id: 'user', role: MessageRole.User, content: 'Implement feature' }];
  const fake = {
    task: {
      id: 'task',
      agentProfileId: 'coder',
      provider: 'task-provider',
      model: 'task-model',
      state: DefaultTaskState.ReadyForImplementation,
    },
    taskId: 'task',
    project: {
      baseDir: '/project',
      getProjectSettings: vi.fn(() => ({ agentProfileId: 'coder' })),
      createNewTask: vi.fn(),
    },
    agentProfileManager: { getProfile: vi.fn(() => profile) },
    store: { getSettings: vi.fn(() => ({ taskSettings: { contextCompactionType: ContextCompactionType.Smart, ...overrides } })) },
    contextManager: {
      getContextMessages: vi.fn(async () => messages),
      backupContext: vi.fn(async () => undefined),
      loadMessages: vi.fn(async () => undefined),
      setContextMessages: vi.fn(),
    },
    agent: {
      runAgent: vi.fn<Agent['runAgent']>().mockResolvedValue([{ id: 'summary', role: MessageRole.Assistant, content: 'Summary' }]),
      generateText: vi.fn<Agent['generateText']>().mockResolvedValue(undefined),
    },
    promptsManager: {
      getCompactConversationPrompt: vi.fn(async () => 'Compact prompt'),
      getHandoffPrompt: vi.fn(async () => 'Handoff prompt'),
    },
    addLogMessage: vi.fn(),
    getContextFiles: vi.fn(async () => []),
    getProjectDir: vi.fn(() => '/project'),
    saveTask: vi.fn(async () => undefined),
    findSkillActivationMessages: vi.fn(() => []),
    waitForCurrentAgentToFinish: vi.fn(async () => undefined),
    resolveAgentRunPromises: vi.fn(),
    updateContextInfo: vi.fn(async () => undefined),
    runNextQueuedPrompt: vi.fn(async () => undefined),
    sendPromptToAider: vi.fn(async () => []),
  };
  Object.setPrototypeOf(fake, Task.prototype);
  return { task: fake as unknown as Task, fake, profile, messages };
};

describe('Task context model overrides', () => {
  it.each([undefined, null, 'auxiliary/org/compact-model'])('resolves the compaction model %s without changing the task model', async (compactionModel) => {
    const { task, fake, profile } = createFixture({ compactionModel, handoffModel: 'other/handoff' });
    await task.compactConversation('agent');

    expect(fake.agent.runAgent).toHaveBeenCalledOnce();
    expect(fake.agent.runAgent.mock.calls[0][1]).toMatchObject(
      compactionModel ? { provider: 'auxiliary', model: 'org/compact-model' } : { provider: 'task-provider', model: 'task-model' },
    );
    expect(fake.task.provider).toBe('task-provider');
    expect(fake.task.model).toBe('task-model');
    expect(profile.model).toBe('profile-model');
    expect(fake.contextManager.loadMessages).toHaveBeenCalledOnce();
  });

  it.each([undefined, null, 'auxiliary/org/handoff-model'])(
    'resolves the handoff model %s independently of automatic compaction type',
    async (handoffModel) => {
      const { task, fake } = createFixture({ handoffModel, compactionModel: 'other/compact' });
      await task.handoffConversation('agent');

      expect(fake.agent.generateText).toHaveBeenCalledExactlyOnceWith(
        handoffModel || 'task-provider/task-model',
        '',
        'Handoff prompt',
        '/project',
        expect.any(Array),
        true,
        undefined,
        'task',
      );
      expect(fake.task.model).toBe('task-model');
    },
  );

  it('uses the supplied running profile for automatic compaction when no override exists', async () => {
    const { task, fake, profile, messages } = createFixture();
    await task.compactConversation('agent', undefined, { ...profile, provider: 'running', model: 'subagent-model' }, messages, undefined, undefined, false);
    expect(fake.agent.runAgent.mock.calls[0][1]).toMatchObject({ provider: 'running', model: 'subagent-model' });
    expect(fake.waitForCurrentAgentToFinish).not.toHaveBeenCalled();
  });

  it('applies the override to automatic compaction with a supplied profile', async () => {
    const { task, fake, profile, messages } = createFixture({ compactionModel: 'auxiliary/compact' });
    await task.compactConversation('agent', undefined, profile, messages, undefined, undefined, false);
    expect(fake.agent.runAgent.mock.calls[0][1]).toMatchObject({ provider: 'auxiliary', model: 'compact' });
  });

  it('uses the handoff override for automatic handoff without waiting for the running agent', async () => {
    const { task, fake, messages } = createFixture({ handoffModel: 'auxiliary/handoff' });
    await task.handoffConversation('agent', '', true, messages, false);
    expect(fake.agent.generateText.mock.calls[0][0]).toBe('auxiliary/handoff');
    expect(fake.waitForCurrentAgentToFinish).not.toHaveBeenCalled();
  });

  it('leaves Aider compaction and handoff on the Aider path', async () => {
    const { task, fake } = createFixture({ compactionModel: 'auxiliary/compact', handoffModel: 'auxiliary/handoff' });
    await task.compactConversation('code');
    await task.handoffConversation('code');
    expect(fake.sendPromptToAider).toHaveBeenCalledTimes(2);
    expect(fake.agent.runAgent).not.toHaveBeenCalled();
    expect(fake.agent.generateText).not.toHaveBeenCalled();
  });
});

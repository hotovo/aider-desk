/**
 * Regression tests for Agent.runAgent abort controller registration.
 *
 * Agent.isRunning() reports registered controllers, Task.isPromptRunning() relies
 * on it, and it decides whether incoming prompts are queued or started concurrently.
 *
 * The dispatch-phase controller is constructed unconditionally (agent.ts), while the
 * run controller is only constructed when neither caller nor extension provided a
 * signal. Runs are stopped early right after registration and assertions are made on
 * how many controllers were constructed by agent code.
 */
import { describe, expect, it, vi } from 'vitest';

import type { AgentProfile } from '@common/types';
import type { Task } from '@/task';

vi.mock('@/logger');

const { Agent: AgentClass } = await import('../agent');
type Agent = InstanceType<typeof AgentClass>;

const createAgent = () => {
  const modelManager = {
    getProviders: vi.fn(() => [{ id: 'test-provider', name: 'Test Provider' }]),
    getCacheControl: vi.fn(() => null),
    getProviderParameters: vi.fn(() => ({})),
    getProviderOptions: vi.fn(() => ({})),
    // Escape hatch: stops the run right after controller registration
    normalizeMessages: vi.fn(() => {
      throw new Error('stop');
    }),
  };

  const extensionManager = {
    dispatchEvent: vi.fn(async (_eventName: string, event: Record<string, unknown>) => ({ ...event })),
  };

  const agent = new AgentClass(
    ...([
      { getSettings: vi.fn(() => ({})) },
      { getProjectProfiles: vi.fn(() => ({})) },
      {},
      { getMergedServers: vi.fn(() => ({})) },
      modelManager,
      { captureAgentRun: vi.fn() },
      {},
      { getSystemPrompt: vi.fn(async () => 'system prompt') },
      extensionManager,
    ] as unknown as ConstructorParameters<typeof AgentClass>),
  ) as unknown as Agent;

  return { agent, extensionManager };
};

const createTask = () =>
  ({
    taskId: 'test-task',
    getProjectDir: vi.fn(() => '/test/project'),
    getProject: vi.fn(() => ({ baseDir: '/test/project' })),
    project: { baseDir: '/test/project' },
    task: {},
    getContextMessages: vi.fn(async () => []),
    getContextFiles: vi.fn(async () => []),
    addContextMessage: vi.fn(async () => {}),
    addLogMessage: vi.fn(),
    updateTask: vi.fn(async () => {}),
  }) as unknown as Task;

const profile = {
  id: 'test-profile',
  name: 'Test Profile',
  provider: 'test-provider',
  model: 'test-model',
  isSubagent: false,
} as AgentProfile;

type RunAgentArgs = Parameters<Agent['runAgent']>;

// Counts AbortController constructions performed by agent code, ignoring ones from the test itself
const withAgentAbortControllerCounting = async <T>(fn: () => Promise<T>): Promise<{ result: T; agentControllerCount: number }> => {
  const Original = global.AbortController;
  let count = 0;
  class Counting extends AbortController {
    constructor(...args: ConstructorParameters<typeof AbortController>) {
      super(...args);
      if ((new Error().stack ?? '').includes('/src/main/agent/')) {
        count++;
      }
    }
  }
  global.AbortController = Counting as typeof AbortController;
  try {
    const result = await fn();
    return { result, agentControllerCount: count };
  } finally {
    global.AbortController = Original;
  }
};

const stopExpected = async (promise: Promise<unknown>) =>
  promise.catch((error: unknown) => {
    if (!(error instanceof Error) || error.message !== 'stop') {
      throw error;
    }
  });

describe('Agent.runAgent abort controller registration', () => {
  it('creates its own controller after the onAgentStarted dispatch so the run reports as running', async () => {
    const { agent } = createAgent();

    const { agentControllerCount } = await withAgentAbortControllerCounting(async () => stopExpected(agent.runAgent(createTask(), profile, 'prompt')));

    // one for the temporary onAgentStarted dispatch, one for the actual run
    expect(agentControllerCount).toBe(2);
  });

  it('does not create its own controller when the extension provides one', async () => {
    const extensionSignal = new AbortController().signal;
    const { agent, extensionManager } = createAgent();
    extensionManager.dispatchEvent.mockImplementation(async (_eventName: string, event: Record<string, unknown>) => ({
      ...event,
      modelCallSettings: { ...(event.modelCallSettings as object), abortSignal: extensionSignal },
    }));

    const { agentControllerCount } = await withAgentAbortControllerCounting(async () => stopExpected(agent.runAgent(createTask(), profile, 'prompt')));

    // one for the temporary onAgentStarted dispatch only - the extension signal is kept for the run
    expect(agentControllerCount).toBe(1);
  });

  it('does not create its own controller when the caller provides one', async () => {
    const callerSignal = new AbortController().signal;
    const args: RunAgentArgs = [createTask(), profile, 'prompt', 'agent', undefined, undefined, undefined, undefined, true, callerSignal];
    const { agent } = createAgent();

    const { agentControllerCount } = await withAgentAbortControllerCounting(async () => stopExpected(agent.runAgent(...args)));

    // one for the temporary onAgentStarted dispatch only - it stays unregistered
    expect(agentControllerCount).toBe(1);
  });
});

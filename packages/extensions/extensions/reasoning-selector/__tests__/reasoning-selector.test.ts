import type { ExtensionContext, TaskCreatedEvent } from '@aiderdesk/extensions';

import ReasoningSelectorExtension from '../index';

type Task = {
  provider: string;
  model: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
};

const createContext = (tasks: Task[]): ExtensionContext => {
  return {
    getProjectContext: () => ({
      getAgentProfiles: () => [
        {
          id: 'default',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
        },
      ],
      getProjectSettings: () => ({ agentProfileId: 'default' }),
      getTasks: async () => tasks,
    }),
  } as unknown as ExtensionContext;
};

const createEvent = (metadata?: Record<string, unknown>): TaskCreatedEvent => {
  return {
    task: {
      metadata,
    },
  } as TaskCreatedEvent;
};

describe('ReasoningSelectorExtension onTaskCreated', () => {
  it('resolves the new task model from its agent profile and inherits matching reasoning effort', async () => {
    const extension = new ReasoningSelectorExtension();
    const result = await extension.onTaskCreated(
      createEvent(),
      createContext([
        {
          provider: 'openai',
          model: 'gpt-5',
          updatedAt: '2026-07-27T12:00:00.000Z',
          metadata: { reasoningEffort: 'low' },
        },
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          updatedAt: '2026-07-27T10:00:00.000Z',
          metadata: { reasoningEffort: 'high' },
        },
      ]),
    );

    expect(result).toEqual({
      task: {
        metadata: {
          reasoningEffort: 'high',
        },
      },
    });
  });

  it('checks no more than the ten newest tasks', async () => {
    const extension = new ReasoningSelectorExtension();
    const tasks = Array.from({ length: 11 }, (_, index) => ({
      provider: index === 10 ? 'anthropic' : 'openai',
      model: index === 10 ? 'claude-sonnet-4-5' : 'gpt-5',
      updatedAt: `2026-07-${String(27 - index).padStart(2, '0')}T12:00:00.000Z`,
      metadata: { reasoningEffort: 'high' },
    }));

    const result = await extension.onTaskCreated(createEvent(), createContext(tasks));

    expect(result).toBeUndefined();
  });

  it('preserves an explicitly supplied reasoning effort', async () => {
    const extension = new ReasoningSelectorExtension();
    const result = await extension.onTaskCreated(
      createEvent({ reasoningEffort: 'low' }),
      createContext([
        {
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          updatedAt: '2026-07-27T12:00:00.000Z',
          metadata: { reasoningEffort: 'high' },
        },
      ]),
    );

    expect(result).toBeUndefined();
  });
});

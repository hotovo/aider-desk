import type { ExtensionContext, TaskCreatedEvent } from '@aiderdesk/extensions';

import ReasoningSelectorExtension from '../index';

const createContext = (reasoningEffort?: unknown): ExtensionContext => {
  return {
    getProjectContext: () => ({
      getMostRecentTask: () =>
        reasoningEffort === undefined
          ? null
          : {
              data: {
                metadata: {
                  reasoningEffort,
                },
              },
            },
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
  it('inherits reasoning effort from the most recently updated task', async () => {
    const extension = new ReasoningSelectorExtension();

    const result = await extension.onTaskCreated(createEvent(), createContext('high'));

    expect(result).toEqual({
      task: {
        metadata: {
          reasoningEffort: 'high',
        },
      },
    });
  });

  it('preserves an explicitly supplied reasoning effort', async () => {
    const extension = new ReasoningSelectorExtension();

    const result = await extension.onTaskCreated(createEvent({ reasoningEffort: 'low' }), createContext('high'));

    expect(result).toBeUndefined();
  });
});

import { act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { useTaskLogHandlers } from '../useTaskLogHandlers';

import type { LogAction, LogData } from '@common/types';

import { render } from '@/__tests__/render';
import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { setMessages, useTaskStore } from '@/stores/taskStore';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

const TestComponent = () => {
  useTaskLogHandlers('/project', 'task-123');
  return null;
};

describe('useTaskLogHandlers', () => {
  const mockApi = createMockApi();
  let logHandler: ((data: LogData) => void) | undefined;

  const createLogData = (overrides: Partial<LogData> = {}): LogData => ({
    baseDir: '/project',
    taskId: 'task-123',
    level: 'error',
    message: 'error',
    timestamp: 1,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    logHandler = undefined;
    vi.mocked(useApi).mockReturnValue(mockApi);
    vi.mocked(mockApi.addLogListener).mockImplementation((_baseDir: string, _taskId: string, handler: (data: LogData) => void) => {
      logHandler = handler;
      return () => {};
    });
    useTaskStore.getState().unloadTask('task-123');
    setMessages('task-123', () => []);
  });

  it('adds log messages to the store', async () => {
    render(<TestComponent />);

    act(() => {
      logHandler?.(createLogData({ message: 'first error', timestamp: 1 }));
    });

    await waitFor(() => {
      const messages = useTaskStore.getState().taskMessagesMap.get('task-123');
      expect(messages).toHaveLength(1);
      expect(messages?.[0]?.type).toBe('log');
      expect(messages?.[0]?.content).toBe('first error');
    });
  });

  it('strips resolve-git-error-with-agent action id from older messages when a new one arrives', async () => {
    render(<TestComponent />);

    act(() => {
      logHandler?.(createLogData({ message: 'first error', actions: [{ id: 'resolve-git-error-with-agent' }], timestamp: 1 }));
    });

    await waitFor(() => {
      const messages = useTaskStore.getState().taskMessagesMap.get('task-123');
      expect(messages).toHaveLength(1);
    });

    act(() => {
      logHandler?.(createLogData({ message: 'second error', actions: [{ id: 'resolve-git-error-with-agent' }], timestamp: 2 }));
    });

    await waitFor(() => {
      const messages = useTaskStore.getState().taskMessagesMap.get('task-123') as Array<{ content: string; actions?: LogAction[] }>;
      expect(messages).toHaveLength(2);
      expect(messages[0].content).toBe('first error');
      expect(messages[0].actions ?? []).not.toContainEqual({ id: 'resolve-git-error-with-agent' });
      expect(messages[1].content).toBe('second error');
      expect(messages[1].actions).toContainEqual({ id: 'resolve-git-error-with-agent' });
    });
  });

  it('keeps other action ids on older messages', async () => {
    render(<TestComponent />);

    act(() => {
      logHandler?.(
        createLogData({
          message: 'rebase failed',
          actions: [{ id: 'continue-rebase', data: { branch: 'main' } }, { id: 'resolve-git-error-with-agent' }],
          timestamp: 1,
        }),
      );
    });

    act(() => {
      logHandler?.(createLogData({ message: 'merge failed', actions: [{ id: 'resolve-git-error-with-agent' }], timestamp: 2 }));
    });

    await waitFor(() => {
      const messages = useTaskStore.getState().taskMessagesMap.get('task-123') as Array<{ content: string; actions?: LogAction[] }>;
      expect(messages[0].actions).toEqual([{ id: 'continue-rebase', data: { branch: 'main' } }]);
      expect(messages[1].actions).toEqual([{ id: 'resolve-git-error-with-agent' }]);
    });
  });
  it.each(['info', 'loading'] as const)('preserves action data in %s messages', async (level) => {
    render(<TestComponent />);
    const actions = [{ id: 'interrupt' }, { id: 'custom', data: { nested: [true, null, 'value'] } }];

    act(() => logHandler?.(createLogData({ level, actions })));

    await waitFor(() => expect(useTaskStore.getState().taskMessagesMap.get('task-123')?.[0]).toMatchObject({ actions }));
  });

  it.each(['info', 'loading'] as const)('normalizes legacy IDs in %s events', async (level) => {
    render(<TestComponent />);
    const legacyEvent = { ...createLogData({ level }), actionIds: ['interrupt'] };

    act(() => logHandler?.(legacyEvent));

    await waitFor(() => expect(useTaskStore.getState().taskMessagesMap.get('task-123')?.[0]).toMatchObject({ actions: [{ id: 'interrupt' }] }));
  });

  it('replaces loading action payloads when updating a loading message', async () => {
    render(<TestComponent />);
    act(() => logHandler?.(createLogData({ level: 'loading', actions: [{ id: 'interrupt', data: 'first' }] })));
    await waitFor(() => expect(useTaskStore.getState().taskMessagesMap.get('task-123')).toHaveLength(1));
    const id = useTaskStore.getState().taskMessagesMap.get('task-123')?.[0].id;

    act(() => logHandler?.(createLogData({ level: 'loading', actions: [{ id: 'interrupt', data: 'second' }] })));

    await waitFor(() =>
      expect(useTaskStore.getState().taskMessagesMap.get('task-123')).toEqual([
        expect.objectContaining({ id, actions: [{ id: 'interrupt', data: 'second' }] }),
      ]),
    );
  });
});

it('deduplicates live and replayed logs by backend identity', async () => {
  const api = createMockApi();
  let listener: ((data: LogData) => void) | undefined;
  vi.mocked(useApi).mockReturnValue(api);
  vi.mocked(api.addLogListener).mockImplementation((_baseDir, _taskId, handler) => {
    listener = handler;
    return () => {};
  });
  setMessages('task-123', () => []);
  render(<TestComponent />);
  const log: LogData = { id: 'backend-log', baseDir: '/project', taskId: 'task-123', level: 'info', message: 'Compacted' };
  act(() => {
    listener?.(log);
    listener?.(log);
  });
  await waitFor(() =>
    expect(
      useTaskStore
        .getState()
        .taskMessagesMap.get('task-123')
        ?.map((message) => message.id),
    ).toEqual(['backend-log']),
  );
});

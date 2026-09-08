import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserApi } from '../browser-api';

import type { NotificationData } from '@common/types';

// Capture the socket 'event' handler so tests can simulate wire deliveries.
const { socketHandlers, emitMock } = vi.hoisted(() => {
  const socketHandlers = new Map<string, (...args: unknown[]) => void>();
  return {
    socketHandlers,
    emitMock: vi.fn(),
  };
});

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: true,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers.set(event, handler);
    }),
    once: vi.fn(),
    off: vi.fn(),
    emit: emitMock,
    connect: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

const emitEvent = (type: string, data: unknown) => {
  const handler = socketHandlers.get('event');
  if (!handler) {
    throw new Error('socket event handler was never registered');
  }
  handler({ type, data });
};

const makeNotification = (id: string, baseDir = '/test/project'): NotificationData => ({
  baseDir,
  title: 'Task finished',
  body: 'all done',
  id,
  timestamp: 1,
  kind: 'task-finished',
});

describe('BrowserApi - notification deduplication wiring', () => {
  let browserApi: BrowserApi;

  beforeEach(() => {
    vi.clearAllMocks();
    socketHandlers.clear();
    browserApi = new BrowserApi();
  });

  it('suppresses a duplicate notification id while a listener is registered', () => {
    const callback = vi.fn();
    browserApi.addNotificationListener('/test/project', callback);

    emitEvent('notification', makeNotification('n-1'));
    emitEvent('notification', makeNotification('n-1'));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('records the notification id even when no listener exists yet, so a later redelivery is suppressed', () => {
    // First delivery arrives before any notification listener has registered
    emitEvent('notification', makeNotification('n-1'));

    // Listener attaches afterwards; the redelivery must hit the deduplicator
    const callback = vi.fn();
    browserApi.addNotificationListener('/test/project', callback);
    emitEvent('notification', makeNotification('n-1'));

    expect(callback).not.toHaveBeenCalled();
  });

  it('delivers a fresh notification after listener registration following a listener-less delivery', () => {
    emitEvent('notification', makeNotification('n-1'));

    const callback = vi.fn();
    browserApi.addNotificationListener('/test/project', callback);
    emitEvent('notification', makeNotification('n-2'));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0]).toMatchObject({ id: 'n-2', title: 'Task finished' });
  });

  it('never deduplicates notifications without a stable id (back-compat with older servers)', () => {
    const callback = vi.fn();
    browserApi.addNotificationListener('/test/project', callback);

    const idlePayload = { baseDir: '/test/project', title: 'T', body: 'B' };
    emitEvent('notification', idlePayload);
    emitEvent('notification', idlePayload);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('delivers identical ids from different projects independently (no cross-project suppression)', () => {
    const callbackA = vi.fn();
    const callbackB = vi.fn();
    browserApi.addNotificationListener('/test/project', callbackA);
    browserApi.addNotificationListener('/test/other-project', callbackB);

    // Same id delivered to two different projects
    emitEvent('notification', makeNotification('shared-id', '/test/project'));
    emitEvent('notification', makeNotification('shared-id', '/test/other-project'));

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);

    // Redelivery within each project is still suppressed by (baseDir, id)
    emitEvent('notification', makeNotification('shared-id', '/test/project'));
    emitEvent('notification', makeNotification('shared-id', '/test/other-project'));

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);
  });

  it('never suppresses malformed wire payloads (no throw aborts dispatch)', () => {
    const callback = vi.fn();
    browserApi.addNotificationListener('/test/project', callback);

    emitEvent('notification', null);
    emitEvent('notification', 'garbage');

    expect(callback).not.toHaveBeenCalled();
    // Must not have thrown: reaching this assertion means dispatch survived
    expect(true).toBe(true);
  });
});

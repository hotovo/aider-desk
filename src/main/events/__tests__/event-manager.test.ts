import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { MessageRemovedData, NotificationData, NotificationKind } from '@common/types';

import { EventManager } from '../event-manager';

import type { WindowManager } from '@/window-manager';

vi.mock('@/logger');

describe('EventManager - sendTaskMessageRemoved', () => {
  let eventManager: EventManager;
  let mockMainWindow: Partial<BrowserWindow>;
  let mockWindowManager: WindowManager;
  let mockWebContents: {
    send: ReturnType<typeof vi.fn>;
    isDestroyed: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockWebContents = {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };

    mockMainWindow = {
      webContents: mockWebContents as any,
      isDestroyed: vi.fn(() => false),
    };

    // Create a mock WindowManager
    mockWindowManager = {
      getAllWindows: vi.fn(() => [mockMainWindow as BrowserWindow]),
      getMainWindow: vi.fn(() => mockMainWindow as BrowserWindow),
      addWindow: vi.fn(),
      removeWindow: vi.fn(),
      isMainWindow: vi.fn(() => true),
      getWindowCount: vi.fn(() => 1),
    } as any;

    eventManager = new EventManager(mockWindowManager);
  });

  it('should send message-removed event to main window', () => {
    const baseDir = '/test/project';
    const taskId = 'task-123';
    const messageIds = ['msg-456'];

    eventManager.sendTaskMessageRemoved(baseDir, taskId, messageIds);

    expect(mockWebContents.send).toHaveBeenCalledWith('message-removed', {
      baseDir,
      taskId,
      messageIds,
    } as MessageRemovedData);
  });

  it('should not send to destroyed window', () => {
    mockMainWindow.isDestroyed = vi.fn(() => true);

    eventManager.sendTaskMessageRemoved('/test/project', 'task-123', ['msg-456']);

    expect(mockWebContents.send).not.toHaveBeenCalled();
  });

  it('should handle no windows', () => {
    const emptyWindowManager = {
      getAllWindows: vi.fn(() => []),
      getMainWindow: vi.fn(() => null),
      addWindow: vi.fn(),
      removeWindow: vi.fn(),
      isMainWindow: vi.fn(() => false),
      getWindowCount: vi.fn(() => 0),
    } as any;

    const noWindowEventManager = new EventManager(emptyWindowManager);

    noWindowEventManager.sendTaskMessageRemoved('/test/project', 'task-123', ['msg-456']);

    // Should not throw
    expect(true).toBe(true);
  });
});

describe('EventManager - sendNotification', () => {
  let eventManager: EventManager;
  let mockWebContents: { send: ReturnType<typeof vi.fn>; isDestroyed: ReturnType<typeof vi.fn> };
  let mockWindowManager: WindowManager;

  beforeEach(() => {
    mockWebContents = {
      send: vi.fn(),
      isDestroyed: vi.fn(() => false),
    };
    mockWindowManager = {
      getAllWindows: vi.fn(() => [{ webContents: mockWebContents, isDestroyed: () => false } as unknown as BrowserWindow]),
      getMainWindow: vi.fn(() => null),
      addWindow: vi.fn(),
      removeWindow: vi.fn(),
      isMainWindow: vi.fn(() => true),
      getWindowCount: vi.fn(() => 1),
    } as any;

    eventManager = new EventManager(mockWindowManager);
  });

  it('enriches the notification with a stable id, timestamp, and kind', () => {
    const returned = eventManager.sendNotification('/test/project', 'Task finished', 'all done');

    const sent = mockWebContents.send.mock.calls.find(([type]) => type === 'notification')?.[1] as NotificationData;

    expect(sent).toMatchObject({
      baseDir: '/test/project',
      title: 'Task finished',
      body: 'all done',
      kind: 'generic',
    });
    expect(returned.id).toBe(sent.id);
    expect(sent.id).toBeTruthy();
    expect(returned.timestamp).toBe(sent.timestamp);
    expect(sent.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('propagates the provided notification kind', () => {
    eventManager.sendNotification('/test/project', 'Waiting for your input', 'question?', 'input-needed');

    const sent = mockWebContents.send.mock.calls.find(([type]) => type === 'notification')?.[1] as NotificationData;

    expect(sent.kind).toBe('input-needed');
  });

  it('generates a unique id per notification', () => {
    const first = eventManager.sendNotification('/test/project', 'a', 'b');
    const second = eventManager.sendNotification('/test/project', 'a', 'b');

    expect(first.id).not.toBe(second.id);
    expect(mockWebContents.send).toHaveBeenCalledTimes(2);
  });

  it('sendNotificationData forwards the exact payload without regenerating metadata', () => {
    const data: NotificationData = {
      baseDir: '/test/project',
      title: 'Custom',
      body: 'from extension flow',
      kind: 'task-finished',
      id: 'fixed-id',
      timestamp: 1234567890,
    };

    eventManager.sendNotificationData(data);

    expect(mockWebContents.send).toHaveBeenCalledWith('notification', data);
  });

  it('sendNotificationData normalizes partial payloads: fills missing id/timestamp/kind (back-compat with id-less older-server payloads)', () => {
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'Partial', body: 'no metadata' });

    const sent = mockWebContents.send.mock.calls.find(([type]) => type === 'notification')?.[1] as NotificationData;

    // Delivery-boundary normalization: the wire contract (and browser dedup keyed by id) needs metadata
    expect(sent.id).toBeTruthy();
    expect(sent.timestamp).toBeLessThanOrEqual(Date.now());
    expect(sent.kind).toBe('generic');
  });

  it('sendNotificationData treats empty-string id and kind as absent (normalizes like missing metadata)', () => {
    // '' is not a valid NotificationKind at the type level, but third-party/older payloads
    // can carry it at runtime — the delivery boundary must normalize it anyway
    const blankKind = '' as unknown as NotificationKind;
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'Blank metadata', body: 'b', id: '', kind: blankKind });

    const sent = mockWebContents.send.mock.calls.find(([type]) => type === 'notification')?.[1] as NotificationData;

    // A blank id cannot serve as the dedup key and a blank kind is not a valid kind
    expect(sent.id).toBeTruthy();
    expect(sent.id).not.toBe('');
    expect(sent.kind).toBe('generic');
  });

  it('sendNotificationData assigns distinct normalized ids to empty-string-id payloads (dedup-safe)', () => {
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'a', body: 'b', id: '' });
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'a', body: 'b', id: '' });

    const ids = mockWebContents.send.mock.calls.filter(([type]) => type === 'notification').map(([, data]) => (data as NotificationData).id);

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('sendNotificationData assigns distinct normalized ids to distinct partial payloads (dedup-safe)', () => {
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'a', body: 'b' });
    eventManager.sendNotificationData({ baseDir: '/test/project', title: 'a', body: 'b' });

    const ids = mockWebContents.send.mock.calls.filter(([type]) => type === 'notification').map(([, data]) => (data as NotificationData).id);

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('is a transport-only convenience: delivery is synchronous and equivalent to sendNotificationData (onNotification hook is dispatched by Task.notifyIfEnabled, not here)', () => {
    // Documented contract (see EventManager.sendNotification JSDoc and
    // resources/skills/extension-creator/references/event-types.md): the EventManager is a
    // pure transport layer. It must deliver synchronously with the same wire payload as the
    // low-level sendNotificationData primitive, so hooks can never double-fire or block
    // only one of the two paths.
    const returned = eventManager.sendNotification('/test/project', 'title', 'body');

    const manual: NotificationData = {
      baseDir: '/test/project',
      title: 'title',
      body: 'body',
      kind: 'generic',
      id: returned.id,
      timestamp: returned.timestamp,
    };
    eventManager.sendNotificationData(manual);

    const notificationCalls = mockWebContents.send.mock.calls.filter(([type]) => type === 'notification');
    expect(notificationCalls).toHaveLength(2);
    // Same wire payload shape as the low-level primitive, delivered in the same synchronous turn
    expect(notificationCalls[1][1]).toEqual(manual);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow } from 'electron';
import { MessageRemovedData } from '@common/types';

import { EventManager } from '../event-manager';

vi.mock('@/logger');

describe('EventManager - sendTaskMessageRemoved', () => {
  let eventManager: EventManager;
  let mockMainWindow: Partial<BrowserWindow>;
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

    eventManager = new EventManager(mockMainWindow as BrowserWindow);
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

  it('should handle missing mainWindow', () => {
    const noWindowManager = new EventManager(null);

    noWindowManager.sendTaskMessageRemoved('/test/project', 'task-123', ['msg-456']);

    // Should not throw
    expect(true).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { Socket } from 'socket.io';

import { EventManager } from '@/events';

vi.mock('@/logger');

describe('readonly event subscriptions', () => {
  it('only emits selected events for the subscribed project', () => {
    const eventManager = new EventManager();
    const emit = vi.fn();
    const socket = { id: 'readonly-client', emit } as unknown as Socket;

    eventManager.subscribe(socket, {
      readonly: true,
      eventTypes: ['user-message'],
      baseDirs: ['/projects/public'],
    });

    eventManager.sendUserMessage({
      type: 'user',
      id: 'message-1',
      baseDir: '/projects/private',
      taskId: 'task-1',
      content: 'private',
    });
    eventManager.sendUserMessage({
      type: 'user',
      id: 'message-2',
      baseDir: '/projects/public',
      taskId: 'task-1',
      content: 'public',
    });
    eventManager.sendContextFilesUpdated('/projects/public', 'task-1', []);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('event', {
      type: 'user-message',
      data: expect.objectContaining({ id: 'message-2', baseDir: '/projects/public' }),
    });
  });
});

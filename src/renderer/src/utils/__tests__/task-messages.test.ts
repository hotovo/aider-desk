import { describe, expect, it } from 'vitest';
import { TODO_TOOL_GROUP_NAME } from '@common/tools';
import { TaskStateData } from '@common/types';

import { convertTaskStateMessages, mergeTaskMessages } from '@/utils/task-messages';

describe('convertTaskStateMessages', () => {
  it('converts the complete persisted trace into renderer messages', () => {
    const messages: TaskStateData['messages'] = [
      { type: 'user', id: 'user-1', baseDir: '/project', taskId: 'task-1', content: 'Implement it' },
      {
        type: 'response-completed',
        messageId: 'response-1',
        baseDir: '/project',
        taskId: 'task-1',
        content: 'Done',
        reasoning: 'Reasoning',
        reflectedMessage: 'Retrying',
      },
      {
        type: 'tool',
        id: 'tool-1',
        baseDir: '/project',
        taskId: 'task-1',
        serverName: 'built-in',
        toolName: 'shell',
        args: { command: 'pwd' },
        response: '/project',
        finished: true,
      },
    ];

    const result = convertTaskStateMessages(messages);

    expect(result.map((message) => message.type)).toEqual(['user', 'reflected-message', 'response', 'tool']);
    expect(result[2]).toEqual(expect.objectContaining({ id: 'response-1', content: 'Done', reasoning: 'Reasoning' }));
    expect(result[3]).toEqual(expect.objectContaining({ id: 'tool-1', content: '/project', args: { command: 'pwd' } }));
  });

  it('excludes persisted todo tools handled by task state', () => {
    const messages: TaskStateData['messages'] = [
      {
        type: 'tool',
        id: 'todo-1',
        baseDir: '/project',
        taskId: 'task-1',
        serverName: TODO_TOOL_GROUP_NAME,
        toolName: 'get_items',
        finished: true,
      },
    ];

    expect(convertTaskStateMessages(messages)).toEqual([]);
  });
});

describe('persistent log hydration and reconciliation', () => {
  it('preserves backend IDs and structured actions across repeated reconnects', () => {
    const actions = [{ id: 'undoContextChange', data: { checkpointId: 'context.pre-compaction.001.json' } }];
    const snapshot: TaskStateData['messages'] = [
      { id: 'log-1', baseDir: '/project', taskId: 'task-1', level: 'info', message: 'Compacted', actions, timestamp: 10 },
    ];
    const first = convertTaskStateMessages(snapshot);
    expect(first[0]).toMatchObject({ id: 'log-1', actions, content: 'Compacted', timestamp: 10 });
    const live = [...first, { id: 'transient', type: 'log' as const, level: 'warning' as const, content: 'Transient warning' }];
    let messages = live;
    for (let index = 0; index < 3; index++) {
      messages = mergeTaskMessages(convertTaskStateMessages(snapshot), messages);
    }
    expect(messages.map((message) => message.id)).toEqual(['log-1', 'transient']);
  });
});

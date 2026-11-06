import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextManager } from '../context-manager';

import type { Task } from '../task';

vi.mock('@/logger');

describe('ContextManager - addPersistentLogMessage', () => {
  let mockTask: Task;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(ContextManager.prototype, 'load').mockResolvedValue(undefined);
    mockTask = {
      taskId: 'test-task-id',
      getProjectDir: vi.fn(() => '/test/project'),
      sendContextInfoUpdated: vi.fn(),
    } as unknown as Task;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should add a persistent log message to messages array', async () => {
    const manager = new ContextManager(mockTask, 'test-task', []);
    manager.enableAutosave();

    const msg = manager.addPersistentLogMessage('info', 'Test log message');

    expect(msg.role).toBe('log');
    expect(msg.level).toBe('info');
    expect(msg.content).toBe('Test log message');
    expect(msg.id).toBeDefined();
    expect(msg.timestamp).toBeDefined();

    const messages = await manager.getContextMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('log');
  });

  it('should store promptContext and actions', () => {
    const manager = new ContextManager(mockTask, 'test-task', []);
    const promptContext = { id: 'prompt-1' };

    const msg = manager.addPersistentLogMessage('warning', 'Warning text', promptContext, [
      { id: 'undoContextChange', data: { checkpointId: 'context.pre-compaction.001.json' } },
    ]);

    expect(msg.promptContext).toEqual(promptContext);
    expect(msg.actions).toEqual([{ id: 'undoContextChange', data: { checkpointId: 'context.pre-compaction.001.json' } }]);
  });

  it('should trigger autosave', () => {
    const manager = new ContextManager(mockTask, 'test-task', []);
    manager.enableAutosave();

    const autosaveSpy = vi.spyOn(manager as unknown as { autosave: () => void }, 'autosave');
    manager.addPersistentLogMessage('info', 'Test');

    expect(autosaveSpy).toHaveBeenCalled();
  });

  it('should preserve undo snapshot when adding a log message', () => {
    const manager = new ContextManager(mockTask, 'test-task', [{ id: 'msg-1', role: 'user', content: 'Hello' }]);

    manager.clearMessages(false, true);
    expect(manager.hasUndoSnapshot()).toBe(true);

    manager.addPersistentLogMessage('info', 'Test');

    expect(manager.hasUndoSnapshot()).toBe(true);
  });

  it('should be included in getContextMessagesData as LogData', () => {
    const manager = new ContextManager(mockTask, 'test-task', []);
    manager.addPersistentLogMessage('info', 'Persistent log', { id: 'p1' }, [{ id: 'action1' }]);

    const data = manager.getContextMessagesData();

    expect(data).toHaveLength(1);
    expect('level' in data[0]).toBe(true);
    if ('level' in data[0]) {
      expect(data[0].id).toBeDefined();
      expect(data[0].level).toBe('info');
      expect(data[0].message).toBe('Persistent log');
      expect(data[0].taskId).toBe('test-task');
      expect(data[0].baseDir).toBe('/test/project');
      expect(data[0].actions).toEqual([{ id: 'action1' }]);
    }
  });

  it('should be excluded from toConnectorMessages', () => {
    const manager = new ContextManager(mockTask, 'test-task', [
      { id: 'u1', role: 'user', content: 'Hello' },
      { id: 'log-1', role: 'log', level: 'info', content: 'Compacted', timestamp: 1 },
      { id: 'a1', role: 'assistant', content: 'Hi' },
    ]);

    const connectorMessages = manager.toConnectorMessages();

    expect(connectorMessages).toHaveLength(2);
    expect(connectorMessages[0].role).toBe('user');
    expect(connectorMessages[0].content).toBe('Hello');
    expect(connectorMessages[1].role).toBe('assistant');
    expect(connectorMessages[1].content).toBe('Hi');
  });

  it('should be included in generateContextMarkdown', async () => {
    const manager = new ContextManager(mockTask, 'test-task', [
      { id: 'u1', role: 'user', content: 'Hello' },
      { id: 'log-1', role: 'log', level: 'info', content: 'Compacted', timestamp: 1 },
    ]);

    const markdown = await manager.generateContextMarkdown();

    expect(markdown).toContain('Hello');
    expect(markdown).toContain('Compacted');
    expect(markdown).toContain('(info)');
  });
});

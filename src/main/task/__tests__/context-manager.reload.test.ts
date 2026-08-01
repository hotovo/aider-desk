import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextManager } from '../context-manager';

import type { ContextMessage } from '@common/types';

const createMessage = (id: string, content: string): ContextMessage => ({
  id,
  role: 'user',
  content,
  timestamp: Date.now(),
});

describe('ContextManager - reloadFromDisk', () => {
  let projectDir: string;
  let task: {
    getProjectDir: () => string;
    getTaskDir: () => string;
    sendContextInfoUpdated: ReturnType<typeof vi.fn>;
  };
  let manager: ContextManager;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-desk-context-'));
    task = {
      getProjectDir: () => projectDir,
      getTaskDir: () => projectDir,
      sendContextInfoUpdated: vi.fn(),
    };
    manager = new ContextManager(task as never, 'task-1');
    await manager.getContextMessages();
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('reloads externally changed messages without saving over the file', async () => {
    const contextPath = path.join(projectDir, '.aider-desk', 'tasks', 'task-1', 'context.json');
    const messages = [createMessage('message-1', 'External message')];
    await fs.mkdir(path.dirname(contextPath), { recursive: true });
    await fs.writeFile(contextPath, JSON.stringify({ version: 2, contextMessages: messages, contextFiles: [] }), 'utf8');

    await expect(manager.reloadFromDisk()).resolves.toBe(true);
    await expect(manager.getContextMessages()).resolves.toEqual(messages);
    await expect(fs.readFile(contextPath, 'utf8')).resolves.toContain('External message');
    await expect(manager.reloadFromDisk()).resolves.toBe(false);
  });

  it('clears messages when context.json is deleted', async () => {
    const contextPath = path.join(projectDir, '.aider-desk', 'tasks', 'task-1', 'context.json');
    const messages = [createMessage('message-1', 'Message')];
    await fs.mkdir(path.dirname(contextPath), { recursive: true });
    await fs.writeFile(contextPath, JSON.stringify({ version: 2, contextMessages: messages, contextFiles: [] }), 'utf8');
    await manager.reloadFromDisk();
    await fs.unlink(contextPath);

    await expect(manager.reloadFromDisk()).resolves.toBe(true);
    await expect(manager.getContextMessages()).resolves.toEqual([]);
  });
});

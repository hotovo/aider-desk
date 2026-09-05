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

const getContextPath = (projectDir: string, taskId = 'task-1') => path.join(projectDir, '.aider-desk', 'tasks', taskId, 'context.json');

const createTask = (projectDir: string) => ({
  getProjectDir: () => projectDir,
  getTaskDir: () => projectDir,
  sendContextInfoUpdated: vi.fn(),
});

describe('ContextManager - atomic save and corrupt recovery', () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aider-desk-context-save-'));
  });

  afterEach(async () => {
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('writes a valid context.json and leaves no temp file behind', async () => {
      const manager = new ContextManager(createTask(projectDir) as never, 'task-1');
      await manager.getContextMessages();

      const messages = [createMessage('message-1', 'Save me')];
      manager.addContextMessage(messages[0]);
      await manager.save();

      const contextPath = getContextPath(projectDir);
      const parsed = JSON.parse(await fs.readFile(contextPath, 'utf8'));
      expect(parsed.version).toBe(2);
      expect(parsed.contextMessages).toEqual(messages);
      expect(parsed.contextFiles).toEqual([]);

      const dirFiles = await fs.readdir(path.dirname(contextPath));
      expect(dirFiles.some((file) => file.endsWith('.tmp'))).toBe(false);
    });

    it('keeps context.json valid across concurrent save calls', async () => {
      const manager = new ContextManager(createTask(projectDir) as never, 'task-1');
      await manager.getContextMessages();

      const messages = [createMessage('message-1', 'First message'), createMessage('message-2', 'Second message')];
      manager.addContextMessage(messages[0]);
      manager.addContextMessage(messages[1]);

      await Promise.all([manager.save(), manager.save(), manager.save(), manager.save()]);

      const contextPath = getContextPath(projectDir);
      const content = await fs.readFile(contextPath, 'utf8');
      expect(() => JSON.parse(content)).not.toThrow();
      const parsed = JSON.parse(content);
      expect(parsed.contextMessages).toHaveLength(2);
    });
  });

  describe('corrupt context recovery', () => {
    it('moves a corrupt context.json aside and loads an empty context instead of throwing', async () => {
      const contextPath = getContextPath(projectDir);
      await fs.mkdir(path.dirname(contextPath), { recursive: true });
      // Truncated JSON - unterminated string
      await fs.writeFile(contextPath, '{"version":2,"contextMessages":[{"id":"broken","role":"user","content":"unterminated', 'utf8');

      const manager = new ContextManager(createTask(projectDir) as never, 'task-1');

      await expect(manager.load()).resolves.toBeUndefined();
      await expect(manager.getContextMessages()).resolves.toEqual([]);

      const dirFiles = await fs.readdir(path.dirname(contextPath));
      const movedAside = dirFiles.find((file) => file.startsWith('context.json.corrupt-'));
      expect(movedAside).toBeDefined();
      await expect(fs.access(contextPath)).rejects.toThrow();
    });

    it('recovers from the newest backup when context.json is corrupt', async () => {
      const dir = path.dirname(getContextPath(projectDir));
      await fs.mkdir(dir, { recursive: true });

      const backupMessages = [createMessage('backup-1', 'From backup')];
      await fs.writeFile(path.join(dir, 'context.backup.001.json'), JSON.stringify({ version: 2, contextMessages: [], contextFiles: [] }), 'utf8');
      await fs.writeFile(
        path.join(dir, 'context.backup.002.json'),
        JSON.stringify({
          version: 2,
          contextMessages: backupMessages,
          contextFiles: [],
        }),
        'utf8',
      );
      await fs.writeFile(getContextPath(projectDir), '{"version":2,"contextMessages":["truncated', 'utf8');

      const manager = new ContextManager(createTask(projectDir) as never, 'task-1');

      await expect(manager.load()).resolves.toBeUndefined();
      await expect(manager.getContextMessages()).resolves.toEqual(backupMessages);
    });
  });
});

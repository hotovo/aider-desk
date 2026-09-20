import { DatabaseSync } from 'node:sqlite';

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UsageReportData } from '@common/types';

import { DataManager } from '../data-manager';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/constants', () => ({
  DB_FILE_PATH: ':memory:',
}));

const getDb = (manager: DataManager): DatabaseSync => (manager as unknown as { db: DatabaseSync }).db;

describe('DataManager - Extension State', () => {
  let dataManager: DataManager;

  beforeEach(() => {
    vi.clearAllMocks();
    dataManager = new DataManager();
    dataManager.init();
  });

  afterEach(() => {
    dataManager.close();
  });

  describe('extension_state table', () => {
    it('should be created during init', () => {
      expect(() => dataManager.init()).not.toThrow();
    });

    it('should allow storing and retrieving state', () => {
      dataManager.setExtensionState('test-ext', 'test-key', { data: 'test' });
      const result = dataManager.getExtensionState('test-ext', 'test-key');
      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('getExtensionState', () => {
    it('should return undefined when no state exists', () => {
      const result = dataManager.getExtensionState('ext-1', 'key-1');
      expect(result).toBeUndefined();
    });

    it('should return parsed JSON value when state exists', () => {
      const testValue = { name: 'test', count: 42 };
      dataManager.setExtensionState('ext-1', 'key-1', testValue);

      const result = dataManager.getExtensionState('ext-1', 'key-1');
      expect(result).toEqual(testValue);
    });

    it('should return different values for different extensions', () => {
      dataManager.setExtensionState('ext-1', 'shared-key', { owner: 'ext-1' });
      dataManager.setExtensionState('ext-2', 'shared-key', { owner: 'ext-2' });

      expect(dataManager.getExtensionState('ext-1', 'shared-key')).toEqual({ owner: 'ext-1' });
      expect(dataManager.getExtensionState('ext-2', 'shared-key')).toEqual({ owner: 'ext-2' });
    });

    it('should return different values for different keys in same extension', () => {
      dataManager.setExtensionState('ext-1', 'key-1', { value: 1 });
      dataManager.setExtensionState('ext-1', 'key-2', { value: 2 });

      expect(dataManager.getExtensionState('ext-1', 'key-1')).toEqual({ value: 1 });
      expect(dataManager.getExtensionState('ext-1', 'key-2')).toEqual({ value: 2 });
    });

    it('should handle primitive values', () => {
      dataManager.setExtensionState('ext-1', 'string-key', 'hello');
      dataManager.setExtensionState('ext-1', 'number-key', 123);
      dataManager.setExtensionState('ext-1', 'boolean-key', true);

      expect(dataManager.getExtensionState('ext-1', 'string-key')).toBe('hello');
      expect(dataManager.getExtensionState('ext-1', 'number-key')).toBe(123);
      expect(dataManager.getExtensionState('ext-1', 'boolean-key')).toBe(true);
    });

    it('should handle null values', () => {
      dataManager.setExtensionState('ext-1', 'null-key', null);
      expect(dataManager.getExtensionState('ext-1', 'null-key')).toBeNull();
    });

    it('should handle arrays', () => {
      const testArray = [1, 2, 3, 'four', { five: 5 }];
      dataManager.setExtensionState('ext-1', 'array-key', testArray);
      expect(dataManager.getExtensionState('ext-1', 'array-key')).toEqual(testArray);
    });
  });

  describe('setExtensionState', () => {
    it('should insert new state', () => {
      const testValue = { data: 'new' };
      dataManager.setExtensionState('ext-1', 'new-key', testValue);

      expect(dataManager.getExtensionState('ext-1', 'new-key')).toEqual(testValue);
    });

    it('should update existing state (upsert)', () => {
      dataManager.setExtensionState('ext-1', 'upsert-key', { version: 1 });
      dataManager.setExtensionState('ext-1', 'upsert-key', { version: 2, extra: 'data' });

      expect(dataManager.getExtensionState('ext-1', 'upsert-key')).toEqual({ version: 2, extra: 'data' });
    });

    it('should update updated_at timestamp on upsert', async () => {
      const db = getDb(dataManager);

      dataManager.setExtensionState('ext-1', 'timestamp-key', { v: 1 });
      const sql = 'SELECT updated_at FROM extension_state WHERE extension_id = ? AND key = ?';
      const firstTimestamp = (db.prepare(sql).get('ext-1', 'timestamp-key') as { updated_at: string } | undefined)?.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));

      dataManager.setExtensionState('ext-1', 'timestamp-key', { v: 2 });
      const secondTimestamp = (db.prepare(sql).get('ext-1', 'timestamp-key') as { updated_at: string } | undefined)?.updated_at;

      expect(secondTimestamp).toBeDefined();
      expect(firstTimestamp).toBeDefined();
    });
  });
});

describe('DataManager - Messages', () => {
  let dataManager: DataManager;

  beforeEach(() => {
    vi.clearAllMocks();
    dataManager = new DataManager();
  });

  afterEach(() => {
    dataManager.close();
  });

  it('should create the messages table with task_id column on fresh init', () => {
    dataManager.init();

    const columns = getDb(dataManager).prepare('PRAGMA table_info(messages)').all() as { name: string }[];
    expect(columns.map((column) => column.name)).toContain('task_id');
  });

  it('should add task_id to a pre-migration schema and keep legacy rows readable', () => {
    const db = getDb(dataManager);
    db.exec(`
      CREATE TABLE messages
      (
        id                   TEXT PRIMARY KEY,
        timestamp            DATETIME DEFAULT CURRENT_TIMESTAMP,
        type                 TEXT NOT NULL,
        project              TEXT NOT NULL,
        model                TEXT NOT NULL,
        input_tokens         INTEGER,
        output_tokens        INTEGER,
        cache_write_tokens   INTEGER,
        cache_read_tokens    INTEGER,
        cost                 REAL,
        message_content_json TEXT
      );
    `);
    db.prepare('INSERT INTO messages (id, type, project, model, cost, message_content_json) VALUES (?, ?, ?, ?, ?, ?)').run(
      'legacy-1',
      'assistant',
      '/project',
      'gpt-x',
      0.5,
      '{}',
    );

    dataManager.init();

    const columns = db.prepare('PRAGMA table_info(messages)').all() as { name: string }[];
    expect(columns.map((column) => column.name)).toContain('task_id');

    const legacyRow = db.prepare('SELECT task_id, cost FROM messages WHERE id = ?').get('legacy-1') as {
      task_id: string | null;
      cost: number;
    };
    expect(legacyRow.task_id).toBeNull();
    expect(legacyRow.cost).toBe(0.5);

    const usageRows = dataManager.queryUsageData(new Date(Date.now() - 48 * 60 * 60 * 1000), new Date(Date.now() + 48 * 60 * 60 * 1000));
    expect(usageRows).toHaveLength(1);
    expect(usageRows[0].project).toBe('/project');
    expect(usageRows[0].model).toBe('gpt-x');
    expect(usageRows[0].cost).toBe(0.5);
  });

  it('should be idempotent when init is called multiple times', () => {
    dataManager.init();
    expect(() => dataManager.init()).not.toThrow();

    const columns = getDb(dataManager).prepare('PRAGMA table_info(messages)').all() as { name: string }[];
    expect(columns.filter((column) => column.name === 'task_id')).toHaveLength(1);

    expect(() => dataManager.saveMessage('msg-1', 'assistant', '/project', 'task-1', 'gpt-x', undefined, {})).not.toThrow();
  });

  it('should persist task_id and usage data when saving a message', () => {
    dataManager.init();

    const usageReport: UsageReportData = {
      model: 'gpt-x',
      sentTokens: 10,
      receivedTokens: 20,
      messageCost: 0.25,
      cacheWriteTokens: 5,
      cacheReadTokens: 7,
    };
    dataManager.saveMessage('msg-1', 'assistant', '/project', 'task-123', 'gpt-x', usageReport, { content: 'hello' });

    const row = getDb(dataManager).prepare('SELECT * FROM messages WHERE id = ?').get('msg-1') as
      | {
          type: string;
          project: string;
          task_id: string | null;
          model: string;
          input_tokens: number | null;
          output_tokens: number | null;
          cache_write_tokens: number | null;
          cache_read_tokens: number | null;
          cost: number | null;
          message_content_json: string;
        }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.type).toBe('assistant');
    expect(row!.project).toBe('/project');
    expect(row!.task_id).toBe('task-123');
    expect(row!.model).toBe('gpt-x');
    expect(row!.input_tokens).toBe(10);
    expect(row!.output_tokens).toBe(20);
    expect(row!.cache_write_tokens).toBe(5);
    expect(row!.cache_read_tokens).toBe(7);
    expect(row!.cost).toBe(0.25);
    expect(JSON.parse(row!.message_content_json)).toEqual({ content: 'hello' });
  });

  it('should store null usage fields when no usage report is provided', () => {
    dataManager.init();

    dataManager.saveMessage('msg-2', 'tool', '/project', 'task-123', 'gpt-x', undefined, { foo: 1 });

    const row = getDb(dataManager).prepare('SELECT task_id, input_tokens, output_tokens, cost FROM messages WHERE id = ?').get('msg-2') as
      | {
          task_id: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          cost: number | null;
        }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.task_id).toBe('task-123');
    expect(row!.input_tokens).toBeNull();
    expect(row!.output_tokens).toBeNull();
    expect(row!.cost).toBeNull();
  });
});

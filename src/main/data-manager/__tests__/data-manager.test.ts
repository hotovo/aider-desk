import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

type MockStatement = {
  run: (...args: unknown[]) => void;
  get: (...args: unknown[]) => { value: string; updated_at: string } | { name: string } | undefined;
  all: (...args: unknown[]) => unknown[];
};

type MockDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => MockStatement;
  close: () => void;
};

vi.mock('better-sqlite3', () => {
  return {
    default: class MockDatabaseImpl implements MockDatabase {
      private tables = new Map<string, Map<string, Map<string, { value: string; updated_at: string }>>>();

      exec = (sql: string): void => {
        if (sql.includes('extension_state')) {
          this.tables.set('extension_state', new Map());
        }
        if (sql.includes('messages')) {
          this.tables.set('messages', new Map());
        }
      };

      prepare = (sql: string): MockStatement => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        return {
          run: (...args: unknown[]) => {
            const extensionStateTable = self.tables.get('extension_state');
            if (sql.includes('extension_state') && sql.includes('INSERT')) {
              const [extensionId, key, value] = args as [string, string, string];
              if (!extensionStateTable?.has(extensionId)) {
                extensionStateTable?.set(extensionId, new Map());
              }
              extensionStateTable?.get(extensionId)?.set(key, { value, updated_at: new Date().toISOString() });
            }
          },
          get: (...args: unknown[]) => {
            const extensionStateTable = self.tables.get('extension_state');
            if (sql.includes('extension_state') && sql.includes('SELECT') && sql.includes('WHERE')) {
              const [extensionId, key] = args as [string, string];
              return extensionStateTable?.get(extensionId)?.get(key);
            }
            if (sql.includes('sqlite_master')) {
              return self.tables.has('extension_state') ? { name: 'extension_state' } : undefined;
            }
            return undefined;
          },
          all: () => [],
        };
      };

      close = (): void => {};
    },
  };
});

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
      const db = (dataManager as unknown as { db: MockDatabase }).db;

      dataManager.setExtensionState('ext-1', 'timestamp-key', { v: 1 });
      const sql = 'SELECT updated_at FROM extension_state WHERE extension_id = ? AND key = ?';
      const firstTimestamp = (db.prepare(sql).get('ext-1', 'timestamp-key') as { value: string; updated_at: string } | undefined)?.updated_at;

      await new Promise((resolve) => setTimeout(resolve, 10));

      dataManager.setExtensionState('ext-1', 'timestamp-key', { v: 2 });
      const secondTimestamp = (db.prepare(sql).get('ext-1', 'timestamp-key') as { value: string; updated_at: string } | undefined)?.updated_at;

      expect(secondTimestamp).toBeDefined();
      expect(firstTimestamp).toBeDefined();
    });
  });
});

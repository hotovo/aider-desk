interface DBEntry<T> {
  id: string;
  data: T;
  createdAt: number;
  updatedAt: number;
}

interface IndexedDBConfig {
  dbName: string;
  version: number;
  stores: Record<string, string>;
}

const STORES = {
  'sidebar-widths': 'id',
  'prompt-field-texts': 'id',
};

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(private config: IndexedDBConfig) {}

  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        Object.entries(this.config.stores).forEach(([storeName, keyPath]) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath });
            // Create indexes for common queries
            store.createIndex('createdAt', 'createdAt', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        });
      };
    });

    return this.initPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  async get<T>(storeName: string, id: string): Promise<T | null> {
    try {
      const store = await this.getStore(storeName);
      return new Promise((resolve, reject) => {
        const request = store.get(id);

        request.onerror = () => {
          reject(new Error(`Failed to get entry: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          const result = request.result as DBEntry<T> | undefined;
          if (result) {
            resolve(result.data);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set<T>(storeName: string, id: string, data: T): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      const now = Date.now();

      const entry: DBEntry<T> = {
        id,
        data,
        createdAt: now,
        updatedAt: now,
      };

      return new Promise((resolve, reject) => {
        const request = store.put(entry);

        request.onerror = () => {
          reject(new Error(`Failed to set entry: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IndexedDB set error:', error);
      throw error;
    }
  }

  async remove(storeName: string, id: string): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');

      return new Promise((resolve, reject) => {
        const request = store.delete(id);

        request.onerror = () => {
          reject(new Error(`Failed to remove entry: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          resolve();
        };
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IndexedDB remove error:', error);
      throw error;
    }
  }

  async clearExpired(storeName: string, ttlMs: number): Promise<void> {
    try {
      const store = await this.getStore(storeName, 'readwrite');
      const cutoffTime = Date.now() - ttlMs;

      return new Promise((resolve, reject) => {
        const request = store.index('updatedAt').openCursor(IDBKeyRange.upperBound(cutoffTime));

        request.onerror = () => {
          reject(new Error(`Failed to clear expired entries: ${request.error?.message}`));
        };

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IndexedDB clearExpired error:', error);
      throw error;
    }
  }

  async getAll<T>(storeName: string): Promise<Array<{ id: string; data: T; updatedAt: number }>> {
    try {
      const store = await this.getStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onerror = () => {
          reject(new Error(`Failed to get all entries: ${request.error?.message}`));
        };

        request.onsuccess = () => {
          const results = request.result as DBEntry<T>[];
          resolve(
            results.map((entry) => ({
              id: entry.id,
              data: entry.data,
              updatedAt: entry.updatedAt,
            })),
          );
        };
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('IndexedDB getAll error:', error);
      return [];
    }
  }
}

// Create a singleton instance for UI preferences
const uiPreferencesDB = new IndexedDBManager({
  dbName: 'aider-desk-ui-preferences',
  version: 1,
  stores: STORES,
});

export { uiPreferencesDB };
export type { DBEntry, IndexedDBConfig };

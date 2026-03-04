import { DatabaseSync } from 'node:sqlite';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { Tag } from './types';
import logger from './logger';

function getCacheDbPath(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  let cacheDir: string;
  if (platform === 'darwin') {
    cacheDir = path.join(homeDir, 'Library', 'Caches', 'aiderdesk', 'tree-sitter');
  } else if (platform === 'win32') {
    cacheDir = path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'aiderdesk', 'tree-sitter');
  } else {
    cacheDir = path.join(homeDir, '.cache', 'aiderdesk', 'tree-sitter');
  }

  return path.join(cacheDir, 'cache.db');
}

export class CacheManager {
  private db: DatabaseSync | null = null;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || getCacheDbPath();
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.dbPath), { recursive: true });
      this.db = new DatabaseSync(this.dbPath);

      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS file_cache (
          file_path TEXT PRIMARY KEY,
          mtime INTEGER NOT NULL,
          tags TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      this.db.exec(createTableSQL);
      logger.info(`[CacheManager] Cache database initialized at ${this.dbPath}`);
    } catch (error) {
      logger.error('[CacheManager] Failed to initialize cache database:', error);
      this.db = null;
    }
  }

  async getFileCache(filePath: string): Promise<{ tags: Tag[]; mtime: number } | null> {
    if (!this.db) {
      return null;
    }

    try {
      const sql = 'SELECT mtime, tags FROM file_cache WHERE file_path = ?';
      const stmt = this.db.prepare(sql);
      const result = stmt.get(filePath) as { mtime: number; tags: string } | undefined;

      if (result) {
        const tags = JSON.parse(result.tags) as Tag[];
        return { tags, mtime: result.mtime };
      }

      return null;
    } catch (error) {
      logger.error(`[CacheManager] Failed to get cache for ${filePath}:`, error);
      return null;
    }
  }

  async setFileCache(filePath: string, mtime: number, tags: Tag[]): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const sql = `
        INSERT INTO file_cache (file_path, mtime, tags, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(file_path) DO UPDATE SET
          mtime = excluded.mtime,
          tags = excluded.tags,
          updated_at = CURRENT_TIMESTAMP
      `;

      const stmt = this.db.prepare(sql);
      stmt.run(filePath, mtime, JSON.stringify(tags));
      logger.debug(`[CacheManager] Cached ${tags.length} tags for ${filePath}`);
    } catch (error) {
      logger.error(`[CacheManager] Failed to set cache for ${filePath}:`, error);
    }
  }

  async getFileMtime(filePath: string): Promise<number | null> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtimeMs;
    } catch (error) {
      logger.error(`[CacheManager] Failed to get mtime for ${filePath}:`, error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const sql = 'DELETE FROM file_cache';
      this.db.exec(sql);
      logger.info('[CacheManager] Cache cleared');
    } catch (error) {
      logger.error('[CacheManager] Failed to clear cache:', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('[CacheManager] Cache database closed');
    }
  }
}

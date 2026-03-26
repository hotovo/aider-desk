import { DatabaseSync } from 'node:sqlite';

import { SystemLogEntry, SystemLogsResponse, SystemLogLevel } from '@common/types';

const DEFAULT_PAGE_SIZE = 100;

/**
 * SQLite-backed storage for system logs.
 * This is session-only storage that clears on app startup.
 */
export class LogBuffer {
  private db: DatabaseSync | null = null;

  /**
   * Initialize the database connection and clear existing logs.
   * Should be called once at app startup.
   */
  async init(): Promise<void> {
    this.db = new DatabaseSync(':memory:');

    // Drop existing table to clear session logs
    this.db.exec('DROP TABLE IF EXISTS system_logs');

    // Create fresh table for this session
    const createTableSQL = `
      CREATE TABLE system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        extension TEXT,
        metadata TEXT
      )
    `;
    this.db.exec(createTableSQL);
  }

  /**
   * Add a log entry to the database
   * @returns The ID of the inserted log entry
   */
  add(entry: SystemLogEntry): number | undefined {
    if (!this.db) {
      return undefined;
    }

    const sql = `
      INSERT INTO system_logs (timestamp, level, message, extension, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;

    const stmt = this.db.prepare(sql);
    const result = stmt.run(entry.timestamp, entry.level, entry.message, entry.extension || null, entry.metadata ? JSON.stringify(entry.metadata) : null);
    return result.lastInsertRowid as number;
  }

  /**
   * Get logs with pagination.
   * @param fromId - If provided, fetch logs with id < fromId (for loading older logs)
   * @param limit - Maximum number of logs to return
   * @param levels - If provided, only fetch logs with these levels
   * @returns Object with logs array (oldest to newest) and hasMore boolean
   */
  getPaged(fromId?: number, limit: number = DEFAULT_PAGE_SIZE, levels?: SystemLogLevel[]): SystemLogsResponse {
    if (!this.db) {
      return { logs: [], hasMore: false };
    }

    const conditions: string[] = [];
    const params: (number | string)[] = [];

    if (fromId !== undefined) {
      conditions.push('id < ?');
      params.push(fromId);
    }

    if (levels && levels.length > 0) {
      const placeholders = levels.map(() => '?').join(', ');
      conditions.push(`level IN (${placeholders})`);
      params.push(...levels);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT id, timestamp, level, message, extension, metadata
      FROM system_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ?
    `;
    params.push(limit + 1);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      id: number;
      timestamp: string;
      level: string;
      message: string;
      extension: string | null;
      metadata: string | null;
    }>;

    const hasMore = rows.length > limit;
    const logs = rows
      .slice(0, limit)
      .reverse()
      .map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        level: row.level as SystemLogEntry['level'],
        message: row.message,
        extension: row.extension || undefined,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));

    return { logs, hasMore };
  }

  /**
   * Clear all logs from the database
   */
  clear(): void {
    if (!this.db) {
      return;
    }

    this.db.exec('DELETE FROM system_logs');
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Extract extension name from log message
   * Extensions log with format: "[Extension:name] message"
   */
  static extractExtensionName(message: string): string | undefined {
    const match = message.match(/^\[Extension:([^\]]+)\]/);
    return match ? match[1] : undefined;
  }
}

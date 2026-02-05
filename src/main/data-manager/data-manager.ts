import { UsageReportData, UsageDataRow } from '@common/types';

import logger from '@/logger';
import { DB_FILE_PATH } from '@/constants';
import { isBunRuntime } from '@/bun-resources';

/**
 * Unified interface for SQLite database operations
 * Abstraction layer that works with both bun:sqlite and better-sqlite3
 */
interface ISqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): ISqliteStatement;
  close(): void;
}

/**
 * Unified interface for SQLite prepared statements
 */
interface ISqliteStatement {
  run(...params: unknown[]): void;
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown | undefined;
}

/**
 * Generic adapter for SQLite database implementations
 * Works with any database that has exec, prepare, and close methods
 */
class DatabaseAdapter<T extends { exec(sql: string): void; prepare(sql: string): unknown; close(): void }> implements ISqliteDatabase {
  constructor(private db: T) {}

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): ISqliteStatement {
    const stmt = this.db.prepare(sql) as ISqliteStatement;
    return new StatementAdapter(stmt);
  }

  close(): void {
    this.db.close();
  }
}

/**
 * Generic adapter for SQLite statement implementations
 * Works with any statement that has run, all, and get methods
 */
class StatementAdapter<T extends ISqliteStatement> implements ISqliteStatement {
  constructor(private stmt: T) {}

  run(...params: unknown[]): void {
    this.stmt.run(...params);
  }

  all(...params: unknown[]): unknown[] {
    return this.stmt.all(...params);
  }

  get(...params: unknown[]): unknown | undefined {
    return this.stmt.get(...params);
  }
}

/**
 * Factory function to create a Bun database adapter
 */
const createBunDatabase = async (): Promise<ISqliteDatabase> => {
  logger.debug('Using bun:sqlite for database');
  const { Database: BunDatabase } = await import('bun:sqlite');
  return new DatabaseAdapter(new BunDatabase(DB_FILE_PATH));
};

/**
 * Factory function to create a better-sqlite3 database adapter
 */
const createBetterSqliteDatabase = async (): Promise<ISqliteDatabase> => {
  logger.debug('Using better-sqlite3 for database');
  const BetterSqlite3 = await import('better-sqlite3');
  return new DatabaseAdapter(new BetterSqlite3.default(DB_FILE_PATH));
};

/**
 * Manages the application's database connection and structure.
 * This class is responsible for initializing the database, creating necessary tables,
 * and providing a method to close the connection.
 *
 * Lazily loads the appropriate SQLite implementation (bun:sqlite or better-sqlite3)
 * based on the runtime environment.
 */
export class DataManager {
  private _db: ISqliteDatabase | null = null;
  private _dbLoadPromise: Promise<ISqliteDatabase> | null = null;

  /**
   * Lazily loads and returns the database instance.
   * This allows us to use bun:sqlite which is only available in the Bun runtime.
   */
  private async getDbAsync(): Promise<ISqliteDatabase> {
    if (this._db) {
      return this._db;
    }

    if (this._dbLoadPromise) {
      return this._dbLoadPromise;
    }

    this._dbLoadPromise = (async () => {
      try {
        const db = isBunRuntime() ? await createBunDatabase() : await createBetterSqliteDatabase();
        this._db = db;
        return db;
      } catch (error) {
        logger.error('Failed to load database module:', error);
        throw error;
      }
    })();

    return this._dbLoadPromise;
  }

  /**
   * Constructs a new DataManager instance.
   * The database connection is initialized lazily on first access.
   */
  constructor() {
    // Database is initialized lazily on first access
  }

  /**
   * Initialize the database connection and create tables.
   */
  public async init(): Promise<void> {
    try {
      logger.info('Initializing database...');
      const db = await this.getDbAsync();

      const initSql = `
        CREATE TABLE IF NOT EXISTS messages
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
      `;

      db.exec(initSql);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Saves a message to the database.
   * @param id The unique identifier for the message.
   * @param type The type of the message ('tool' or 'assistant').
   * @param project The project's base directory.
   * @param model The model used for the message.
   * @param usageReport The usage report data.
   * @param content The content of the message.
   */
  public async saveMessage(
    id: string,
    type: 'tool' | 'assistant',
    project: string,
    model: string,
    usageReport: UsageReportData | undefined,
    content: unknown,
  ): Promise<void> {
    try {
      const db = await this.getDbAsync();
      const sql = `
        INSERT INTO messages (id, type, project, model, input_tokens, output_tokens, cache_write_tokens, cache_read_tokens, cost, message_content_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      `;

      logger.debug('Saving message to database:', {
        id,
        type,
        project,
        model,
        input_tokens: usageReport?.sentTokens,
        output_tokens: usageReport?.receivedTokens,
        cache_write_tokens: usageReport?.cacheWriteTokens,
        cache_read_tokens: usageReport?.cacheReadTokens,
        cost: usageReport?.messageCost,
        message_content_json: content,
      });

      const stmt = db.prepare(sql);
      stmt.run(
        id,
        type,
        project,
        model,
        usageReport?.sentTokens,
        usageReport?.receivedTokens,
        usageReport?.cacheWriteTokens,
        usageReport?.cacheReadTokens,
        usageReport?.messageCost,
        JSON.stringify(content),
      );
    } catch (error) {
      logger.error('Failed to save message:', error);
      throw error;
    }
  }

  /**
   * Closes the database connection.
   * It's important to call this method when the application is shutting down
   * to ensure that all data is saved correctly and resources are released.
   */
  public close(): void {
    if (this._db) {
      this._db.close();
      this._db = null;
    }
    this._dbLoadPromise = null;
  }

  /**
   * Query usage data between two dates.
   * @param from Start date
   * @param to End date
   * @returns Array of usage data rows
   */
  public async queryUsageData(from: Date, to: Date): Promise<UsageDataRow[]> {
    logger.info(`Querying usage data from ${from.toISOString()} to ${to.toISOString()}`);
    try {
      const db = await this.getDbAsync();
      const sql = `
        SELECT
          timestamp,
          project,
          model,
          input_tokens,
          output_tokens,
          cache_read_tokens,
          cache_write_tokens,
          cost
        FROM messages
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp DESC;
      `;

      const stmt = db.prepare(sql);
      const rows = stmt.all(from.toISOString(), to.toISOString());
      return rows as UsageDataRow[];
    } catch (error) {
      logger.error('Failed to query usage data:', error);
      return [];
    }
  }
}

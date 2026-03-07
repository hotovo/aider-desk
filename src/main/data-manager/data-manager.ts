import { UsageReportData, UsageDataRow } from '@common/types';
import Database from 'better-sqlite3';

import logger from '@/logger';
import { DB_FILE_PATH } from '@/constants';

/**
 * Manages the application's database connection and structure.
 * This class is responsible for initializing the database, creating necessary tables,
 * and providing a method to close the connection.
 */
export class DataManager {
  private readonly db: Database.Database;

  /**
   * Constructs a new DataManager instance, opening a database connection
   * and ensuring the necessary 'messages' table exists.
   */
  constructor() {
    // Initialize the database connection.
    // The verbose option logs all SQL statements to the console, which is useful for debugging.
    this.db = new Database(DB_FILE_PATH);
  }

  public init() {
    try {
      logger.info('Initializing database...');
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

        CREATE TABLE IF NOT EXISTS extension_state
        (
          extension_id TEXT NOT NULL,
          key          TEXT NOT NULL,
          value        TEXT NOT NULL,
          updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (extension_id, key)
        );
      `;

      this.db.exec(initSql);
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
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
  public saveMessage(id: string, type: 'tool' | 'assistant', project: string, model: string, usageReport: UsageReportData | undefined, content: unknown): void {
    try {
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

      this.db
        .prepare(sql)
        .run(
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
    }
  }

  /**
   * Closes the database connection.
   * It's important to call this method when the application is shutting down
   * to ensure that all data is saved correctly and resources are released.
   */
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  public queryUsageData(from: Date, to: Date): UsageDataRow[] {
    logger.info(`Querying usage data from ${from.toISOString()} to ${to.toISOString()}`);
    try {
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

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(from.toISOString(), to.toISOString());
      return rows as UsageDataRow[];
    } catch (error) {
      logger.error('Failed to query usage data:', error);
      return [];
    }
  }

  public getExtensionState(extensionId: string, key: string): unknown {
    try {
      const sql = 'SELECT value FROM extension_state WHERE extension_id = ? AND key = ?';
      const row = this.db.prepare(sql).get(extensionId, key) as { value: string } | undefined;
      return row ? JSON.parse(row.value) : undefined;
    } catch (error) {
      logger.error(`Failed to get extension state for ${extensionId}/${key}:`, error);
      return undefined;
    }
  }

  public setExtensionState(extensionId: string, key: string, value: unknown): void {
    try {
      const sql = `
        INSERT INTO extension_state (extension_id, key, value, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(extension_id, key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `;
      this.db.prepare(sql).run(extensionId, key, JSON.stringify(value));
    } catch (error) {
      logger.error(`Failed to set extension state for ${extensionId}/${key}:`, error);
      throw error;
    }
  }
}

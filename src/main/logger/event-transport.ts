import Transport from 'winston-transport';
import { SystemLogEntry, SystemLogLevel, SystemLogData, SystemLogsResponse } from '@common/types';

import { LogBuffer } from './log-buffer';

import { EventManager } from '@/events';

/**
 * Custom Winston transport that:
 * 1. Stores logs in sql db
 * 2. Emits logs to renderer via EventManager
 */
export class EventTransport extends Transport {
  private logBuffer: LogBuffer;
  private eventManager: EventManager | null = null;

  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts);
    this.logBuffer = new LogBuffer();
    void this.logBuffer.init();
  }

  setEventManager(eventManager: EventManager): void {
    this.eventManager = eventManager;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log(info: any, callback: () => void): void {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Extract log data from winston info object
    const entry: SystemLogEntry = {
      timestamp: info.timestamp || new Date().toISOString(),
      level: info.level as SystemLogLevel,
      message: info.message || '',
      extension: LogBuffer.extractExtensionName(info.message || ''),
      metadata: {
        ...info,
        // Remove standard winston fields to avoid duplication
        level: undefined,
        message: undefined,
        timestamp: undefined,
      },
    };

    // Add to buffer and get the assigned ID
    const logId = this.logBuffer.add(entry);
    if (logId !== undefined) {
      entry.id = logId;
    }

    // Emit to renderer (only if eventManager is available)
    if (this.eventManager) {
      const data: SystemLogData = { entry };
      this.eventManager.sendSystemLog(data);
    }

    callback();
  }

  /**
   * Get logs with pagination.
   * @param fromId - If provided, fetch logs with id < fromId (for loading older logs)
   * @param limit - Maximum number of logs to return
   * @param levels - If provided, only fetch logs with these levels
   * @returns Object with logs array (oldest to newest) and hasMore boolean
   */
  getPaged(fromId?: number, limit?: number, levels?: SystemLogLevel[]): SystemLogsResponse {
    return this.logBuffer.getPaged(fromId, limit, levels);
  }

  /**
   * Clear all logs from the database
   */
  clear(): void {
    this.logBuffer.clear();
  }
}

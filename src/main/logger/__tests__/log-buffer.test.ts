import { describe, expect, it } from 'vitest';
import { SystemLogEntry } from '@common/types';

import { LogBuffer } from '../log-buffer';

describe('LogBuffer', () => {
  it('sanitizes circular metadata before persisting and returning the log entry', async () => {
    const logBuffer = new LogBuffer();
    await logBuffer.init();

    const metadata: Record<string, unknown> = { source: 'test' };
    metadata.self = metadata;
    const entry: SystemLogEntry = {
      timestamp: '2026-07-24T00:00:00.000Z',
      level: 'error',
      message: 'Circular metadata',
      metadata,
    };

    try {
      expect(() => logBuffer.add(entry)).not.toThrow();
      expect(entry.metadata).toEqual({ source: 'test', self: '[Circular]' });
      expect(() => JSON.stringify(entry.metadata)).not.toThrow();
      expect(logBuffer.getPaged().logs[0].metadata).toEqual({ source: 'test', self: '[Circular]' });
    } finally {
      logBuffer.close();
    }
  });
});

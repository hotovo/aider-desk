import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { existsSync } from 'fs';

import { ensureProbeBinary, isProbeBinaryPresent } from '../probe';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

const mockedSpawnSync = vi.mocked(spawnSync);
const mockedExistsSync = vi.mocked(existsSync);

function makeSuccessResult(stdout = '', stderr = ''): SpawnSyncReturns<string> {
  return {
    pid: 1234,
    output: [stdout, stderr],
    stdout,
    stderr,
    status: 0,
    signal: null,
  };
}

function makeFailureResult(status: number, stderr = ''): SpawnSyncReturns<string> {
  return {
    pid: 1234,
    output: ['', stderr],
    stdout: '',
    stderr,
    status,
    signal: null,
  };
}

describe('probe.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isProbeBinaryPresent', () => {
    it('returns true when the binary exists', () => {
      mockedExistsSync.mockReturnValue(true);
      expect(isProbeBinaryPresent()).toBe(true);
    });

    it('returns false when the binary does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(isProbeBinaryPresent()).toBe(false);
    });
  });

  describe('ensureProbeBinary', () => {
    it('is a no-op when the probe binary is already present', () => {
      mockedExistsSync.mockReturnValue(true);
      expect(ensureProbeBinary()).toBe(true);
      expect(mockedSpawnSync).not.toHaveBeenCalled();
    });

    it('downloads the binary when missing and returns true on success', () => {
      mockedExistsSync
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockedSpawnSync.mockReturnValue(makeSuccessResult('downloaded\n', ''));

      const result = ensureProbeBinary();

      expect(result).toBe(true);
      expect(mockedSpawnSync).toHaveBeenCalledTimes(1);
      const args = mockedSpawnSync.mock.calls[0];
      expect(args?.[1]).toEqual(expect.arrayContaining(['--current-platform-only']));
    });

    it('returns false when the download script exits with non-zero status', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawnSync.mockReturnValue(makeFailureResult(1, 'network error\n'));

      const result = ensureProbeBinary();

      expect(result).toBe(false);
    });

    it('returns false when the download script succeeds but the binary is still missing', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawnSync.mockReturnValue(makeSuccessResult('', ''));

      const result = ensureProbeBinary();

      expect(result).toBe(false);
    });

    it('returns false when spawnSync throws', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawnSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = ensureProbeBinary();

      expect(result).toBe(false);
    });

    it('returns false when spawnSync reports an error object', () => {
      mockedExistsSync.mockReturnValue(false);
      mockedSpawnSync.mockReturnValue({
        pid: 0,
        output: [],
        stdout: '',
        stderr: '',
        status: null,
        signal: null,
        error: new Error('spawn ENOENT'),
      });

      const result = ensureProbeBinary();

      expect(result).toBe(false);
    });

    it('forwards download script output to the onOutput callback', () => {
      mockedExistsSync
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockedSpawnSync.mockReturnValue(
        makeSuccessResult('downloading...\ndone\n', 'warning: rate limit\n'),
      );

      const lines: { text: string; isError: boolean }[] = [];
      ensureProbeBinary((text, isError = false) => {
        lines.push({ text, isError });
      });

      const allText = lines.map((l) => l.text).join('\n');
      expect(allText).toContain('Probe binary not found');
      expect(allText).toContain('downloading...');
      expect(allText).toContain('warning: rate limit');
      expect(allText).toContain('Probe binary downloaded successfully.');

      const errorLines = lines.filter((l) => l.isError).map((l) => l.text);
      expect(errorLines).toContain('warning: rate limit');
    });

    it('writes to process.stderr when no onOutput callback is provided', () => {
      const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      mockedExistsSync.mockReturnValue(false);
      mockedSpawnSync.mockReturnValue(makeFailureResult(2, ''));

      ensureProbeBinary();

      const written = writeSpy.mock.calls.map((c) => String(c[0])).join('');
      expect(written).toContain('Probe binary not found');
      expect(written).toContain('exited with code 2');
    });
  });
});

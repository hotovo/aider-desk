/**
 * Tests for lib/update-checker.ts
 *
 * Pure-function tests for version parsing, comparison, and latest-patch
 * detection, plus orchestration tests for checkForUpdate with the npm
 * registry call mocked via child_process.exec (previously the cache test
 * executed a REAL `npm view` network request and timed out whenever npm
 * was available but slow - v1.13.1).
 *
 * @module lib/update-checker.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSemver,
  compareSemver,
  findLatestPatch,
  getCheckInterval,
  getUpdateNotes,
  _resetCache,
  checkForUpdate,
  DEFAULT_UPDATE_CHECK_INTERVAL_MS,
  ENV_INTERVAL_KEY,
} from './update-checker';

// Mock exec BEFORE the module under test is imported: update-checker wraps
// it with promisify(exec) at load time.
const npmMock = vi.hoisted(() => ({
  impl: undefined as
    | ((cmd: string, opts: unknown, cb: (err: Error | null, out: { stdout: string }) => void) => void)
    | undefined,
  calls: 0,
}));

vi.mock('child_process', () => ({
  exec: (cmd: string, opts: unknown, cb: (err: Error | null, out: { stdout: string }) => void): void => {
    if (!npmMock.impl) {
      throw new Error(`npm mock not configured for this test (got: ${cmd})`);
    }
    npmMock.calls += 1;
    npmMock.impl(cmd, opts, cb);
  },
}));

// ---------------------------------------------------------------------------
// parseSemver
// ---------------------------------------------------------------------------

describe('parseSemver', () => {
  it('parses a full semver string', () => {
    expect(parseSemver('6.10.0')).toEqual({ major: 6, minor: 10, patch: 0 });
  });

  it('parses single-digit components', () => {
    expect(parseSemver('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1 });
  });

  it('parses multi-digit components', () => {
    expect(parseSemver('12.34.567')).toEqual({ major: 12, minor: 34, patch: 567 });
  });

  it('returns null for pre-release version', () => {
    expect(parseSemver('6.10.0-alpha')).toBeNull();
  });

  it('returns null for version with build metadata', () => {
    expect(parseSemver('6.10.0+build123')).toBeNull();
  });

  it('returns null for partial version', () => {
    expect(parseSemver('6.10')).toBeNull();
  });

  it('returns null for non-numeric version', () => {
    expect(parseSemver('latest')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseSemver('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// compareSemver
// ---------------------------------------------------------------------------

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver({ major: 6, minor: 10, patch: 0 }, { major: 6, minor: 10, patch: 0 })).toBe(0);
  });

  it('returns negative when a < b (patch)', () => {
    expect(compareSemver({ major: 6, minor: 10, patch: 0 }, { major: 6, minor: 10, patch: 2 })).toBeLessThan(0);
  });

  it('returns positive when a > b (patch)', () => {
    expect(compareSemver({ major: 6, minor: 10, patch: 3 }, { major: 6, minor: 10, patch: 1 })).toBeGreaterThan(0);
  });

  it('returns negative when a < b (minor)', () => {
    expect(compareSemver({ major: 6, minor: 9, patch: 0 }, { major: 6, minor: 10, patch: 0 })).toBeLessThan(0);
  });

  it('returns positive when a > b (major)', () => {
    expect(compareSemver({ major: 7, minor: 0, patch: 0 }, { major: 6, minor: 10, patch: 0 })).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// findLatestPatch
// ---------------------------------------------------------------------------

describe('findLatestPatch', () => {
  const versions = [
    '6.9.0',
    '6.9.1',
    '6.10.0',
    '6.10.1',
    '6.10.2',
    '6.10.3-alpha', // pre-release — should be ignored
    '6.10.3',
    '7.0.0',
    '7.1.0',
  ];

  it('finds the latest patch in the same minor line', () => {
    expect(findLatestPatch(versions, { major: 6, minor: 10, patch: 0 })).toBe('6.10.3');
  });

  it('returns the same version when it is the latest patch', () => {
    expect(findLatestPatch(versions, { major: 6, minor: 10, patch: 3 })).toBe('6.10.3');
  });

  it('returns undefined when no versions match the minor line', () => {
    expect(findLatestPatch(versions, { major: 5, minor: 0, patch: 0 })).toBeUndefined();
  });

  it('ignores pre-release versions', () => {
    const withPrerelease = ['6.10.0', '6.10.1-rc1', '6.10.2'];
    expect(findLatestPatch(withPrerelease, { major: 6, minor: 10, patch: 0 })).toBe('6.10.2');
  });

  it('handles empty version list', () => {
    expect(findLatestPatch([], { major: 6, minor: 10, patch: 0 })).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getCheckInterval
// ---------------------------------------------------------------------------

describe('getCheckInterval', () => {
  afterEach(() => {
    delete process.env[ENV_INTERVAL_KEY];
  });

  it('returns default interval when env var is not set', () => {
    delete process.env[ENV_INTERVAL_KEY];
    expect(getCheckInterval()).toBe(DEFAULT_UPDATE_CHECK_INTERVAL_MS);
  });

  it('reads interval from env var', () => {
    process.env[ENV_INTERVAL_KEY] = '5000';
    expect(getCheckInterval()).toBe(5000);
  });

  it('returns default for invalid env var value', () => {
    process.env[ENV_INTERVAL_KEY] = 'not-a-number';
    expect(getCheckInterval()).toBe(DEFAULT_UPDATE_CHECK_INTERVAL_MS);
  });

  it('returns default for negative env var value', () => {
    process.env[ENV_INTERVAL_KEY] = '-1';
    expect(getCheckInterval()).toBe(DEFAULT_UPDATE_CHECK_INTERVAL_MS);
  });

  it('allows zero interval (always check)', () => {
    process.env[ENV_INTERVAL_KEY] = '0';
    expect(getCheckInterval()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkForUpdate — pure orchestration tests (npm call is mocked)
// ---------------------------------------------------------------------------

describe('checkForUpdate', () => {
  beforeEach(() => {
    _resetCache();
    delete process.env[ENV_INTERVAL_KEY];
    npmMock.impl = undefined;
    npmMock.calls = 0;
  });

  it('returns null when version cannot be parsed', async () => {
    const result = await checkForUpdate('');
    expect(result).not.toBeNull();
    expect(result!.error).toContain('Cannot parse');
    expect(result!.updateAvailable).toBe(false);
  });

  it('returns null for unknown version format', async () => {
    const result = await checkForUpdate('latest');
    expect(result!.error).toContain('Cannot parse');
    expect(result!.updateAvailable).toBe(false);
  });

  it('caches result and returns same object on second call within interval', async () => {
    npmMock.impl = (_cmd, _opts, cb) => cb(null, { stdout: JSON.stringify(['6.10.0', '6.10.1', '6.11.0']) });

    // First call queries the mocked registry
    const result1 = await checkForUpdate('6.10.0');
    expect(result1!.updateAvailable).toBe(true);
    expect(result1!.latestPatchVersion).toBe('6.10.1');

    // Second call should return cached result without executing npm again
    const result2 = await checkForUpdate('6.10.0');
    expect(result2).toBe(result1); // same reference
    expect(npmMock.calls).toBe(1);
  });

  it('caches a non-blocking error result when the npm query fails', async () => {
    npmMock.impl = (_cmd, _opts, cb) => cb(new Error('network down'), { stdout: '' });

    const result1 = await checkForUpdate('6.10.0');
    expect(result1!.updateAvailable).toBe(false);
    expect(result1!.error).toContain('network down');

    const result2 = await checkForUpdate('6.10.0');
    expect(result2).toBe(result1);
    expect(npmMock.calls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getUpdateNotes
// ---------------------------------------------------------------------------

describe('getUpdateNotes', () => {
  it('returns 6.10.1 notes including the readiness-gate removal', () => {
    const notes = getUpdateNotes('6.10.1');
    expect(notes).toBeDefined();
    expect(notes!.some((n) => n.includes('Check Implementation Readiness'))).toBe(true);
    expect(notes!.some((n) => n.includes('QA Generate E2E Tests'))).toBe(true);
  });

  it('does not apply 6.10.1 notes to 6.10.0', () => {
    const notes = getUpdateNotes('6.10.0') ?? [];
    expect(notes.some((n) => n.includes('Check Implementation Readiness'))).toBe(false);
  });

  it('returns undefined for versions outside all known ranges', () => {
    expect(getUpdateNotes('9.9.9')).toBeUndefined();
  });

  it('returns 6.12 notes including the walkthrough rename', () => {
    const notes = getUpdateNotes('6.12.0');
    expect(notes).toBeDefined();
    expect(notes!.some((n) => n.includes('bmad-walkthrough'))).toBe(true);
    expect(notes!.some((n) => n.includes('gerendert'))).toBe(false);
  });

  it('still returns 6.11 notes for a 6.11 target', () => {
    const notes = getUpdateNotes('6.11.0');
    expect(notes).toBeDefined();
    expect(notes!.some((n) => n.includes('bmad-deep-recon'))).toBe(true);
  });
});

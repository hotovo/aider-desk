/**
 * Focused test for audit-687c3c3c LOW: ExtensionContextImpl.openUrl logged the
 * URL verbatim, including credential query parameters such as the
 * `?token=...` auth token of an extension-provided review server. The logged
 * line must redact the token
 * while the URL itself is dispatched unchanged.
 */
import { execFileSync } from 'child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// open-url's delegated paths branch on Electron; pin the headless branch so
// the dispatch goes through the child_process-driven external browser opener.
vi.mock('child_process', () => ({ execFileSync: vi.fn(), spawnSync: vi.fn() }));
vi.mock('@/app', () => ({ isElectron: () => false }));

import { DisposableStore } from '../disposable-store';
import { ExtensionContextImpl } from '../extension-context';

import logger from '@/logger';
import { openUrl as openUrlUtil } from '@/utils/open-url';

describe('ExtensionContextImpl.openUrl token redaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts the token query parameter in the logged URL without altering dispatch', async () => {
    const context = new ExtensionContextImpl('review-extension', 'Review Extension', new DisposableStore('Review Extension'));

    // modal-overlay without an eventManager logs the URL and then warns — enough
    // to assert the logged line; openUrlUtil (external/window) is untouched.
    await context.openUrl('http://localhost:4173/?token=super-secret&port=4173', 'modal-overlay');

    expect(logger.info).toHaveBeenCalledWith(
      '[Extension:Review Extension] Opening URL: http://localhost:4173/?token=<hidden>&port=4173 (target: modal-overlay)',
    );
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining('super-secret'));
  });

  it('leaves URLs without a token parameter unchanged in the log', async () => {
    const context = new ExtensionContextImpl('ext', 'Ext', new DisposableStore('Ext'));

    await context.openUrl('https://example.com/page?ref=docs', 'modal-overlay');

    expect(logger.info).toHaveBeenCalledWith('[Extension:Ext] Opening URL: https://example.com/page?ref=docs (target: modal-overlay)');
  });
});

describe('delegated openUrl token redaction (audit 8d04f2a2 LOW)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts the token in the delegated openUrl debug log for external target', async () => {
    await openUrlUtil('http://localhost:4173/?token=super-secret&port=4173', 'external');

    expect(logger.debug).toHaveBeenCalledWith('[openUrl] Opening URL: http://localhost:4173/?token=<hidden>&port=4173 (position: external)');
    expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('super-secret'));
  });

  it('redacts the token in the delegated openUrl debug log for window target', async () => {
    await openUrlUtil('http://localhost:4173/?token=super-secret', 'window');

    expect(logger.warn).toHaveBeenCalledWith(expect.not.stringContaining('super-secret'));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('token=<hidden>'));
    expect(logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('super-secret'));
  });

  it('passes the raw, un-redacted URL to the actual dispatch', async () => {
    await openUrlUtil('http://localhost:4173/?token=super-secret', 'external');

    expect(execFileSync).toHaveBeenCalledWith('xdg-open', [expect.stringContaining('token=super-secret')], expect.objectContaining({ stdio: 'ignore' }));
  });
});

describe('external-open failure path token redaction (audit 811fa488 MEDIUM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // execFileSync errors embed the whole command — including the raw token-bearing
  // URL — in their message; the failure-path log must redact it.
  const failureMessage = 'Command failed: "/bin/browser" "http://localhost:4173/#token=super-secret"';

  const assertNoSecretInLogs = (): void => {
    for (const logFn of [logger.info, logger.warn, logger.error, logger.debug]) {
      for (const call of vi.mocked(logFn).mock.calls) {
        expect(JSON.stringify(call), JSON.stringify(call)).not.toContain('super-secret');
      }
    }
  };

  it('redacts the token in the failed external-open error log and rethrows the original error', async () => {
    const failure = Object.assign(new Error(failureMessage), { status: 1 });
    vi.mocked(execFileSync).mockImplementation(() => {
      throw failure;
    });

    await expect(openUrlUtil('http://localhost:4173/#token=super-secret', 'external')).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith(
      '[openUrl] Failed to open URL in external browser:',
      // the redactor consumes up to the next ?& or # — including the trailing
      // quote of the embedded command — which is fine for a log line
      'Command failed: "/bin/browser" "http://localhost:4173/#token=<hidden>',
    );
    assertNoSecretInLogs();
    vi.mocked(execFileSync).mockReset();
  });

  it('redacts the token when ExtensionContextImpl logs a failed delegated openUrl', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error(failureMessage);
    });
    const context = new ExtensionContextImpl('review-extension', 'Review Extension', new DisposableStore('Review Extension'));

    // The rethrown error keeps its raw message (not a log sink), but nothing
    // the context logs may carry the secret.
    await expect(context.openUrl('http://localhost:4173/#token=super-secret', 'external')).rejects.toThrow(/super-secret/);

    assertNoSecretInLogs();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to open URL'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('token=<hidden>'));
    vi.mocked(execFileSync).mockReset();
  });

  it('keeps URLs without token parameters verbatim in the failure log', async () => {
    const failure = new Error('Command failed: "/bin/browser" "https://example.com/page?ref=docs"');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw failure;
    });

    await expect(openUrlUtil('https://example.com/page?ref=docs', 'external')).rejects.toBe(failure);

    expect(logger.error).toHaveBeenCalledWith(
      '[openUrl] Failed to open URL in external browser:',
      'Command failed: "/bin/browser" "https://example.com/page?ref=docs"',
    );
    vi.mocked(execFileSync).mockReset();
  });
});

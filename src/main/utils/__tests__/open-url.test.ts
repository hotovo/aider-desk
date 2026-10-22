import { execSync } from 'child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/app', () => ({
  isElectron: vi.fn(() => false),
  getElectronApp: vi.fn(() => null),
}));

// The Electron-Vite `?asset` import does not resolve under Vitest.
vi.mock('../../../resources/icon.png?asset', () => ({
  default: 'mock-icon.png',
}));

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn(),
  };
});

// loadURL failure the BrowserWindow branch should hit when set (null = success).
const loadUrlFailure = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('electron', () => ({
  shell: { openExternal: vi.fn() },
  // `BrowserWindow` is constructed with `new` in open-url.ts, so the mock must
  // be a real (non-arrow) function.
  BrowserWindow: vi.fn(function (this: unknown) {
    return {
      removeMenu: vi.fn(),
      maximize: vi.fn(),
      loadURL: vi.fn(() => (loadUrlFailure.current ? Promise.reject(loadUrlFailure.current) : Promise.resolve())),
    };
  }),
}));

import { openUrl, redactUrlToken } from '../open-url';

import logger from '@/logger';
import { isElectron } from '@/app';

const SECRET_URL = 'http://localhost:41475/#token=0123456789abcdefdeadbeef';
const TOKEN_VALUE = '0123456789abcdefdeadbeef';

describe('openUrl', () => {
  beforeEach(() => {
    loadUrlFailure.current = null;
    vi.mocked(isElectron).mockReturnValue(false);
  });

  describe('BrowserWindow loadURL failure', () => {
    it('redacts the token from the failure log and rethrows', async () => {
      // Electron BrowserWindow.loadURL failure messages embed the requested
      // URL — including the secret-bearing #token fragment.
      vi.mocked(isElectron).mockReturnValue(true);
      loadUrlFailure.current = new Error(`Error: ERR_FAILED (${SECRET_URL})`);

      await expect(openUrl(SECRET_URL, 'window')).rejects.toThrow();

      const errorCalls = vi.mocked(logger.error).mock.calls.flat().join('\n');
      expect(errorCalls).toContain('[openUrl] Failed to create BrowserWindow');
      // The secret must never reach the logger ...
      expect(errorCalls).not.toContain(TOKEN_VALUE);
      // ... but the failure remains diagnosable with the redacted URL.
      expect(errorCalls).toContain('http://localhost:41475/#token=<redacted>');
    });

    it('redacts non-Error failure values from the loadURL log too', async () => {
      vi.mocked(isElectron).mockReturnValue(true);
      loadUrlFailure.current = `crash while loading ${SECRET_URL}`;

      await expect(openUrl(SECRET_URL, 'window')).rejects.toThrow();

      const errorCalls = vi.mocked(logger.error).mock.calls.flat().join('\n');
      expect(errorCalls).not.toContain(TOKEN_VALUE);
      expect(errorCalls).toContain('#token=<redacted>');
    });
  });

  describe('external browser launch failure', () => {
    it('redacts the token from the failure log and rethrows', async () => {
      // Node's execSync failure message embeds the full command — including
      // the raw secret-bearing URL — exactly as shown below.
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error(`Command failed: "xdg-open" "${SECRET_URL}"`);
      });

      await expect(openUrl(SECRET_URL, 'external')).rejects.toThrow();

      const errorCalls = vi.mocked(logger.error).mock.calls.flat().join('\n');
      expect(errorCalls).toContain('[openUrl] Failed to open URL in external browser');
      // The secret must never reach the logger ...
      expect(errorCalls).not.toContain(TOKEN_VALUE);
      // ... but the failure remains diagnosable with the redacted URL.
      expect(errorCalls).toContain('http://localhost:41475/#token=<redacted>');
    });

    it('redacts token-like subprocess output from the failure log', async () => {
      // Same guarantee even for non-Error rejects (String(error) path).
      vi.mocked(execSync).mockImplementation(() => {
        throw `spawn xdg-open ENOENT ${SECRET_URL}`;
      });

      await expect(openUrl(SECRET_URL, 'external')).rejects.toThrow();

      const errorCalls = vi.mocked(logger.error).mock.calls.flat().join('\n');
      expect(errorCalls).not.toContain(TOKEN_VALUE);
      expect(errorCalls).toContain('#token=<redacted>');
    });

    it('still invokes the platform open command with the original URL on success', async () => {
      vi.mocked(execSync).mockReturnValue(Buffer.from(''));

      await openUrl(SECRET_URL, 'external');

      // The URL itself still navigates VERBATIM — redaction is log-only.
      expect(vi.mocked(execSync)).toHaveBeenCalledWith(`xdg-open "${SECRET_URL}"`, { stdio: 'ignore' });
    });
  });

  describe('redactUrlToken', () => {
    it('masks only the token value, preserving the rest of the URL', () => {
      expect(redactUrlToken(SECRET_URL)).toBe('http://localhost:41475/#token=<redacted>');
      expect(redactUrlToken('http://x/?a=1&token=sekret&b=2')).toBe('http://x/?a=1&token=<redacted>&b=2');
      expect(redactUrlToken('http://x/?TOKEN=UPPER')).toBe('http://x/?TOKEN=<redacted>');
      // Only a parameter literally named `token` is masked.
      expect(redactUrlToken('http://x/?xtoken=abc')).toBe('http://x/?xtoken=abc');
      expect(redactUrlToken('https://example.com/no/query')).toBe('https://example.com/no/query');
    });
  });
});

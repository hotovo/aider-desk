/**
 * Generic URL redaction (audit 179b6197 LOW): redactTokenQueryParam only
 * masked the literal `token=` query parameter, so generic
 * ExtensionContext.openUrl callers could log URLs carrying userinfo or other
 * credential-like query parameters (`key=`, `auth=`, `secret=`, ...). The
 * redactor applies to log strings only — dispatched URLs and rethrown errors
 * never pass through it.
 */
import { execFileSync, spawnSync } from 'child_process';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/app', () => ({ isElectron: () => false }));

// Pin the headless dispatch path: execFileSync would otherwise really invoke
// the system browser opener in the test environment.
vi.mock('child_process', () => ({ execFileSync: vi.fn(), spawnSync: vi.fn() }));

import logger from '@/logger';
import { openUrl, redactErrorForLog, redactTokenQueryParam } from '@/utils/open-url';

describe('redactTokenQueryParam', () => {
  it('redacts the extension review-server token query parameter', () => {
    expect(redactTokenQueryParam('http://localhost:4173/?token=super-secret&port=4173')).toBe('http://localhost:4173/?token=<hidden>&port=4173');
    // repeated occurrences and # fragment positions stay covered
    expect(redactTokenQueryParam('http://h/?token=a&x=1#p?token=b')).toBe('http://h/?token=<hidden>&x=1#p?token=<hidden>');
  });

  it('redacts credential-like query parameters across common spellings', () => {
    expect(redactTokenQueryParam('https://api.example.com/v1?key=K&auth=A&secret=S&password=P&api_key=AK&access_token=AT&id_token=IT')).toBe(
      'https://api.example.com/v1?key=<hidden>&auth=<hidden>&secret=<hidden>&password=<hidden>&api_key=<hidden>&access_token=<hidden>&id_token=<hidden>',
    );
    expect(redactTokenQueryParam('https://a.example/?Token=T')).toBe('https://a.example/?Token=<hidden>');
  });

  it('redacts URL userinfo (including the token-as-username basic-auth idiom)', () => {
    expect(redactTokenQueryParam('https://user:pass@example.com/path')).toBe('https://<hidden>@example.com/path');
    expect(redactTokenQueryParam('https://apikey@api.example.com/v1')).toBe('https://<hidden>@api.example.com/v1');
  });

  it('does not over-redact ordinary URLs', () => {
    const ordinary = 'https://example.com/docs/page?a=1&b=2#section';
    expect(redactTokenQueryParam(ordinary)).toBe(ordinary);
    // names that merely CONTAIN a credential word are not matches; values
    // that mention such words stay visible in ordinary parameters
    const neighbours = 'https://example.com/?monkey=1&sort=key&q=auth&id=7';
    expect(redactTokenQueryParam(neighbours)).toBe(neighbours);
  });

  it('redacts through the error-log helper', () => {
    const error = new Error('spawn failed: xdg-open "http://localhost:4173/?token=leak&k=v"');
    const redacted = redactErrorForLog(error);
    expect(redacted).not.toContain('leak');
    expect(redacted).toBe('spawn failed: xdg-open "http://localhost:4173/?token=<hidden>&k=v"');
    // non-Error throws are stringified, then redacted too
    expect(redactErrorForLog('http://u:p@h/?secret=s')).toBe('http://<hidden>@h/?secret=<hidden>');
  });
});

describe('openUrl logging keeps redaction on every path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AIDER_DESK_BROWSER;
    delete process.env.BROWSER;
  });

  const dispatches = (): unknown[][] => vi.mocked(execFileSync).mock.calls.map((call) => call as unknown[]);

  it('logs the redacted URL in headless external dispatch and never logs the secret', async () => {
    await openUrl('http://localhost:4173/?token=super-secret&key=value', 'external');

    const debugArgs = vi.mocked(logger.debug).mock.calls.flat().join('\n');
    const errorArgs = vi.mocked(logger.error).mock.calls.flat().join('\n');
    expect(debugArgs).not.toContain('super-secret');
    expect(errorArgs).not.toContain('super-secret');
    expect(debugArgs).toContain('token=<hidden>');
    expect(debugArgs).toContain('key=<hidden>');
    // the dispatched URL must remain the raw, unredacted one
    expect(dispatches()[0]?.[1]).toContain('http://localhost:4173/?token=super-secret&key=value');
  });

  it('dispatches a URL containing shell command substitution as a raw argv element without a shell (audit: shell injection)', async () => {
    const evil = 'http://localhost:4173/?token=t&x=$(touch /tmp/pwned)&y=`id`';
    await openUrl(evil, 'external');

    expect(execFileSync).toHaveBeenCalledTimes(1);
    const [program, args] = dispatches()[0] as [string, string[]];
    // xdg-open receives the URL unmodified as a single argument; no shell
    // string is ever constructed, so $(...) and backticks stay literal data.
    expect(program).toBe('xdg-open');
    expect(args).toEqual([evil]);
  });

  it('prefers a configured browser binary and still passes the URL raw', async () => {
    process.env.AIDER_DESK_BROWSER = 'chromium-browser';
    const url = 'http://localhost:4173/?token=s';
    await openUrl(url, 'external');

    const [program, args] = dispatches()[0] as [string, string[]];
    expect(program).toBe('chromium-browser');
    expect(args).toEqual([url]);
  });

  it('uses `open -a <browser> <url>` argument arrays on macOS with AIDER_DESK_BROWSER', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    process.env.AIDER_DESK_BROWSER = 'Firefox Developer Edition';
    try {
      const url = 'http://h/?token=s';
      await openUrl(url, 'external');
      const [program, args] = dispatches()[0] as [string, string[]];
      expect(program).toBe('open');
      expect(args).toEqual(['-a', 'Firefox Developer Edition', url]);
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor);
      }
    }
  });

  it('dispatches via cmd.exe start with quoted arguments on Windows', async () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32' });
    process.env.AIDER_DESK_BROWSER = 'C:\\Tools\\browser.exe';
    try {
      const url = 'http://h/?a=1&b=2';
      await openUrl(url, 'external');
      expect(execFileSync).not.toHaveBeenCalled();
      const [program, args] = vi.mocked(spawnSync).mock.calls[0] as unknown as [string, string[]];
      expect(program).toBe('cmd.exe');
      expect(args).toEqual(['/d', '/s', '/c', 'start', '', '"C:\\Tools\\browser.exe"', '"http://h/?a=1&b=2"']);
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(process, 'platform', platformDescriptor);
      }
    }
  });

  it('logs a redacted failure and rethrows the unchanged error when dispatch fails', async () => {
    const failure = new Error('Command failed: xdg-open http://localhost:4173/?token=leak-me');
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw failure;
    });

    await expect(openUrl('http://localhost:4173/?token=leak-me', 'external')).rejects.toBe(failure);

    const errorArgs = vi.mocked(logger.error).mock.calls.flat().join('\n');
    expect(errorArgs).not.toContain('leak-me');
    expect(errorArgs).toContain('token=<hidden>');
    expect(errorArgs).toContain('xdg-open');
  });
});

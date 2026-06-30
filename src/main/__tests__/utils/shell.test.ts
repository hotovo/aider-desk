import { describe, it, expect, vi } from 'vitest';

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/app', () => ({
  getElectronApp: vi.fn(() => null),
}));

import { extractPathFromOutput } from '@/utils/shell';

describe('extractPathFromOutput', () => {
  it('returns the last non-empty line from multi-line output', () => {
    const output = 'Vous avez un nombre important de fichiers.\nMerci de veiller.\n/usr/bin:/bin:/usr/local/bin\n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin:/usr/local/bin');
  });

  it('handles output with ANSI escape codes in messages', () => {
    const output = '\x1b[38;5;214mWarning message\x1b[0m\n/usr/bin:/bin\n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin');
  });

  it('returns single-line output as-is', () => {
    const output = '/usr/bin:/bin:/usr/local/bin\n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin:/usr/local/bin');
  });

  it('trims whitespace from the result', () => {
    const output = '  /usr/bin:/bin  \n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin');
  });

  it('skips empty lines between messages and PATH', () => {
    const output = 'Message line 1\n\n\n/usr/bin:/bin\n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin');
  });

  it('returns empty string for empty output', () => {
    expect(extractPathFromOutput('')).toBe('');
  });

  it('returns empty string for whitespace-only output', () => {
    expect(extractPathFromOutput('   \n  \n')).toBe('');
  });

  it('handles output without trailing newline', () => {
    const output = 'Warning message\n/usr/bin:/bin';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin');
  });

  it('handles multiple warning messages before PATH', () => {
    const output = 'Warning 1\nWarning 2\nWarning 3\n/usr/bin:/bin:/usr/local/bin\n';
    expect(extractPathFromOutput(output)).toBe('/usr/bin:/bin:/usr/local/bin');
  });
});

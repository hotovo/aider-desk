/**
 * Tests for getShellInitCommand in src/main/utils/shell.ts.
 *
 * Verifies that the function returns the correct shell init prefix for
 * bash, zsh, fish and an empty string for unsupported shells (e.g. cmd,
 * pwsh, powershell). The expected outputs were observed by running the
 * function directly with each shell name.
 *
 * Since ShellDetector is a private (non-exported) class inside the module
 * and caches its result, the test isolates each case by:
 *   1. Setting process.env.SHELL to a known shell path
 *   2. Mocking fs.existsSync to return true for that path
 *   3. Resetting the module cache so the static cache is cleared
 *   4. Setting process.platform to a non-win32 value
 */

import * as os from 'os';
import * as path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(),
    accessSync: vi.fn(),
  };
});

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/app', () => ({
  getElectronApp: vi.fn(() => ({ isPackaged: false })),
}));

const importShellModule = async () => {
  vi.resetModules();
  return await import('@/utils/shell');
};

const setupShell = async (shellName: 'bash' | 'zsh' | 'fish' | 'cmd' | 'pwsh' | 'powershell') => {
  // Use platform-specific shell paths
  const isWindows = process.platform === 'win32';
  let shellPath: string;
  if (shellName === 'cmd') {
    shellPath = isWindows ? path.join(process.env.SYSTEMROOT || 'C:\\Windows', 'System32', 'cmd.exe') : '/usr/bin/cmd';
  } else if (shellName === 'pwsh') {
    shellPath = isWindows ? 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' : '/usr/local/bin/pwsh';
  } else if (shellName === 'powershell') {
    shellPath = isWindows ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' : '/usr/local/bin/powershell';
  } else {
    const dir = isWindows ? 'C:\\Program Files\\Git\\bin' : '/usr/local/bin';
    shellPath = path.join(dir, shellName);
  }

  process.env.SHELL = shellPath;

  // Mock existsSync to return true for the configured shell path so the
  // ShellDetector accepts it. Return false for everything else to avoid
  // accidentally matching other paths.
  vi.mocked((await import('fs')).existsSync).mockImplementation(((p: string) => {
    return String(p) === shellPath;
  }) as any);
};

describe('getShellInitCommand', () => {
  const originalShell = process.env.SHELL;
  const homeDir = os.homedir();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalShell === undefined) {
      delete process.env.SHELL;
    } else {
      process.env.SHELL = originalShell;
    }
    vi.resetModules();
  });

  describe('bash shell', () => {
    beforeEach(async () => {
      await setupShell('bash');
    });

    it('returns prefix containing /etc/profile', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('source /etc/profile');
    });

    it('returns prefix containing $HOME/.bash_profile', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain(`source ${homeDir}/.bash_profile`);
    });

    it('returns prefix containing $HOME/.bashrc', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain(`source ${homeDir}/.bashrc`);
    });

    it('returns prefix containing direnv export for bash', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('direnv export bash');
    });

    it('returns prefix that is non-empty and ends with semicolon+space', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result.length).toBeGreaterThan(0);
      expect(result.endsWith('; ')).toBe(true);
    });
  });

  describe('zsh shell', () => {
    beforeEach(async () => {
      await setupShell('zsh');
    });

    it('returns prefix containing /etc/zprofile', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('source /etc/zprofile');
    });

    it('returns prefix containing $HOME/.zprofile', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain(`source ${homeDir}/.zprofile`);
    });

    it('returns prefix containing /etc/zshrc', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('source /etc/zshrc');
    });

    it('returns prefix containing $HOME/.zshrc', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain(`source ${homeDir}/.zshrc`);
    });

    it('returns prefix containing direnv export for zsh', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('direnv export zsh');
    });

    it('returns prefix that is non-empty and ends with semicolon+space', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result.length).toBeGreaterThan(0);
      expect(result.endsWith('; ')).toBe(true);
    });
  });

  describe('fish shell', () => {
    beforeEach(async () => {
      await setupShell('fish');
    });

    it('returns prefix containing $HOME/.config/fish/config.fish', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain(`source ${homeDir}/.config/fish/config.fish`);
    });

    it('returns prefix containing direnv export for fish', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result).toContain('direnv export fish');
    });

    it('returns prefix that is non-empty and ends with semicolon+space', async () => {
      const { getShellInitCommand } = await importShellModule();
      const result = getShellInitCommand();
      expect(result.length).toBeGreaterThan(0);
      expect(result.endsWith('; ')).toBe(true);
    });
  });

  describe('unsupported shells (cmd, pwsh, powershell)', () => {
    it('returns empty string for cmd shell', async () => {
      await setupShell('cmd');
      const { getShellInitCommand } = await importShellModule();
      expect(getShellInitCommand()).toBe('');
    });

    it('returns empty string for pwsh shell', async () => {
      await setupShell('pwsh');
      const { getShellInitCommand } = await importShellModule();
      expect(getShellInitCommand()).toBe('');
    });

    it('returns empty string for powershell shell', async () => {
      await setupShell('powershell');
      const { getShellInitCommand } = await importShellModule();
      expect(getShellInitCommand()).toBe('');
    });
  });
});

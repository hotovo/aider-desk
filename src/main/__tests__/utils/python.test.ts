import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execAsync } = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock('child_process', () => ({
  exec: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: execAsync }),
}));
vi.mock('@/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/constants', () => ({
  AIDER_DESK_BIN_DIR: '/data/bin',
  PYTHON_COMMAND: '/data/python-venv/bin/python',
  PYTHON_VENV_DIR: '/data/python-venv',
  UV_EXECUTABLE: '/data/bin/uv',
}));
vi.mock('fs', () => ({ existsSync: vi.fn(() => true), unlinkSync: vi.fn() }));

describe('uv security minimum version', () => {
  beforeEach(() => {
    vi.resetModules();
    execAsync.mockReset();
    vi.stubEnv('AIDER_DESK_DISABLE_SYSTEM_UV', '');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('download unavailable')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(['0.13.4', '0.13.10', '0.14.0', '1.0.0'])('accepts patched uv %s', async (version) => {
    execAsync.mockResolvedValue({ stdout: `uv ${version}\n`, stderr: '' });
    const { getResolvedUvPath } = await import('@/utils/python');

    await expect(getResolvedUvPath()).resolves.toBe('/data/bin/uv');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses a patched system uv instead of an old local binary', async () => {
    execAsync.mockImplementation(async (command: string) => {
      if (command === '"/data/bin/uv" --version') {
        return { stdout: 'uv 0.7.13\n', stderr: '' };
      }
      if (command === 'which uv' || command === 'where uv') {
        return { stdout: '/usr/bin/uv\n', stderr: '' };
      }
      return { stdout: 'uv 0.13.4\n', stderr: '' };
    });
    const { getResolvedUvPath } = await import('@/utils/python');

    await expect(getResolvedUvPath()).resolves.toBe('/usr/bin/uv');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['0.7.13', '0.13.3', '0.13.4rc1', 'not uv'])('does not reuse unsafe or unrecognized uv %s', async (version) => {
    vi.stubEnv('AIDER_DESK_DISABLE_SYSTEM_UV', 'true');
    execAsync.mockResolvedValue({ stdout: `uv ${version}\n`, stderr: '' });
    const { getResolvedUvPath } = await import('@/utils/python');

    await expect(getResolvedUvPath()).rejects.toThrow('download unavailable');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/releases/download/0.13.4/'));
  });
});

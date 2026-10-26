import * as fs from 'fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PythonDependenciesInstaller } from '../python-dependencies-installer';

import type { EventManager } from '@/events';

import { getCurrentPythonLibVersion, getResolvedUvPath } from '@/utils';

const { execAsync } = vi.hoisted(() => ({ execAsync: vi.fn() }));

vi.mock('child_process', () => ({
  exec: Object.assign(vi.fn(), { [Symbol.for('nodejs.util.promisify.custom')]: execAsync }),
}));

vi.mock('@/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('@/events', () => ({}));
vi.mock('@/constants', () => ({
  AIDER_DESK_CONNECTOR_DIR: '/data/connector',
  AIDER_DESK_DATA_DIR: '/data',
  PYTHON_VENV_DIR: '/data/python-venv',
  RESOURCES_DIR: '/resources',
  SETUP_COMPLETE_FILENAME: '/data/setup-complete',
}));
vi.mock('@/utils', () => ({
  getCurrentPythonLibVersion: vi.fn(),
  getLatestPythonLibVersion: vi.fn().mockResolvedValue(null),
  getPythonVenvBinPath: vi.fn(() => '/data/python-venv/bin'),
  getResolvedUvPath: vi.fn().mockResolvedValue('/data/bin/uv'),
}));
vi.mock('fs', () => ({ existsSync: vi.fn(), mkdirSync: vi.fn(), copyFileSync: vi.fn(), writeFileSync: vi.fn() }));

const createInstaller = () => {
  const sendAiderConnectorStatus = vi.fn();
  const eventManager = { sendAiderConnectorStatus } as unknown as EventManager;
  return { installer: new PythonDependenciesInstaller(eventManager), sendAiderConnectorStatus };
};

describe('PythonDependenciesInstaller certificate bundle security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AIDER_DESK_NO_UPDATES', '');
    vi.stubEnv('AIDER_DESK_AIDER_VERSION', '');
    vi.stubEnv('AIDER_DESK_EXTRA_PYTHON_PACKAGES', '');
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(getCurrentPythonLibVersion).mockReset();
    vi.mocked(getResolvedUvPath).mockResolvedValue('/data/bin/uv');
    execAsync.mockReset().mockResolvedValue({ stdout: '', stderr: '' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it.each(['2026.10.19', '2026.11.1', '2027.1.1'])('allows patched certifi %s offline without reinstalling', async (version) => {
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) => (name === 'pip' ? '26.2.2' : version));
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(installer.isReady()).toBe(true);
    expect(execAsync).not.toHaveBeenCalled();
  });

  it.each(['2026.1.4', null, '2026.10.19rc1'])('repairs unsafe or unknown certifi %s before becoming ready', async (version) => {
    vi.mocked(getCurrentPythonLibVersion)
      .mockResolvedValueOnce(version)
      .mockImplementation(async (name) => (name === 'pip' ? '26.2.2' : '2026.10.19'));
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(execAsync).toHaveBeenCalledWith(
      expect.stringContaining('"certifi==2026.10.19"'),
      expect.objectContaining({
        env: expect.objectContaining({ VIRTUAL_ENV: '/data/python-venv' }),
      }),
    );
    expect(installer.isReady()).toBe(true);
  });

  it('does not silently continue when the security update fails', async () => {
    vi.mocked(getCurrentPythonLibVersion).mockResolvedValue('2026.1.4');
    execAsync.mockRejectedValue(new Error('offline'));
    const { installer, sendAiderConnectorStatus } = createInstaller();

    await expect(installer.waitForReady()).rejects.toThrow('refusing to start Aider');

    expect(installer.isReady()).toBe(false);
    expect(sendAiderConnectorStatus).toHaveBeenLastCalledWith({ state: 'failed', error: expect.stringContaining('unsafe certificate bundle') });
  });

  it('verifies the installed version instead of trusting a successful install command', async () => {
    vi.mocked(getCurrentPythonLibVersion).mockResolvedValue('2026.1.4');
    const { installer } = createInstaller();

    await expect(installer.waitForReady()).rejects.toThrow('certificate bundle verification failed');
    expect(installer.isReady()).toBe(false);
  });

  it('rejects vulnerable environments when updates are disabled without installing packages', async () => {
    vi.stubEnv('AIDER_DESK_NO_UPDATES', 'true');
    vi.mocked(getCurrentPythonLibVersion).mockResolvedValue('2026.1.4');
    const { installer } = createInstaller();

    await expect(installer.waitForReady()).rejects.toThrow('unset AIDER_DESK_NO_UPDATES');
    expect(execAsync).not.toHaveBeenCalled();
    expect(installer.isReady()).toBe(false);
  });

  it('allows patched environments when updates are disabled', async () => {
    vi.stubEnv('AIDER_DESK_NO_UPDATES', 'true');
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) => (name === 'pip' ? '26.2.2' : '2026.10.19'));
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(execAsync).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(installer.isReady()).toBe(true);
  });

  it('upgrades pip independently of certifi because pip has its own certificate bundle', async () => {
    const pipVersions = ['26.1.0', '26.2.2'];
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) => (name === 'pip' ? pipVersions.shift() || null : '2026.10.19'));
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(execAsync).toHaveBeenCalledWith(expect.stringContaining('"pip==26.2.2"'), expect.any(Object));
    expect(installer.isReady()).toBe(true);
  });

  it('rejects unpatched pip when updates are disabled even with patched certifi', async () => {
    vi.stubEnv('AIDER_DESK_NO_UPDATES', 'true');
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) => (name === 'pip' ? '26.1.0' : '2026.10.19'));
    const { installer } = createInstaller();

    await expect(installer.waitForReady()).rejects.toThrow('Aider requires pip 26.2.2 or later');
    expect(execAsync).not.toHaveBeenCalled();
    expect(installer.isReady()).toBe(false);
  });

  it('completes first-time setup with patched TLS dependencies', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) => (name === 'pip' ? '26.2.2' : '2026.10.19'));
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(fs.writeFileSync).toHaveBeenCalledWith('/data/setup-complete', expect.any(String));
    expect(installer.isReady()).toBe(true);
  });

  it('checks the certificate bundle during first-time setup before writing the completion marker', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(getCurrentPythonLibVersion).mockResolvedValue('2026.1.4');
    const { installer } = createInstaller();

    await expect(installer.waitForReady()).rejects.toThrow('certificate bundle verification failed');

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(installer.isReady()).toBe(false);
  });

  it('repairs a downgrade introduced by a dependency update', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    const certifiVersions = ['2026.10.19', '2026.1.4', '2026.10.19'];
    vi.mocked(getCurrentPythonLibVersion).mockImplementation(async (name) =>
      name === 'certifi' ? certifiVersions.shift() || null : name === 'pip' ? '26.2.2' : null,
    );
    const { installer } = createInstaller();

    await installer.waitForReady();

    expect(execAsync).toHaveBeenLastCalledWith(expect.stringContaining('"certifi==2026.10.19"'), expect.any(Object));
    expect(installer.isReady()).toBe(true);
  });
});

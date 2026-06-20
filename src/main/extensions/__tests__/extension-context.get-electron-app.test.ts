import { describe, it, expect, beforeEach, vi } from 'vitest';

import { ExtensionContextImpl } from '../extension-context';

import type { SettingsData } from '@common/types';
import type { Store } from '@/store';

const { mockElectronApp, mockGetAppMetrics } = vi.hoisted(() => {
  const mockGetAppMetrics = vi.fn();
  const mockElectronApp = {
    getAppMetrics: mockGetAppMetrics,
    getVersion: vi.fn(() => '1.0.0'),
    getName: vi.fn(() => 'AiderDesk'),
    isReady: vi.fn(() => true),
  };
  return { mockElectronApp, mockGetAppMetrics };
});

vi.mock('electron', () => ({
  app: mockElectronApp,
}));

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import logger from '@/logger';

const createMockStore = (): Store => {
  const fullSettings: SettingsData = {
    language: 'en',
    theme: 'dark',
  } as SettingsData;

  return {
    getSettings: vi.fn(() => fullSettings),
    saveSettings: vi.fn(),
    getProviders: vi.fn(() => []),
  } as unknown as Store;
};

describe('ExtensionContextImpl.getElectronApp', () => {
  let context: ExtensionContextImpl;
  const extensionId = 'test-extension';
  const extensionName = 'Test Extension';

  beforeEach(() => {
    vi.clearAllMocks();
    context = new ExtensionContextImpl(extensionId, extensionName, createMockStore());
  });

  it('should return the Electron app when electron module is available', async () => {
    mockGetAppMetrics.mockReturnValue([
      { pid: 1, type: 'Browser', cpu: { percentCPUUsage: 2.5 }, memory: { workingSetSize: 256000 } },
      { pid: 2, type: 'Renderer', cpu: { percentCPUUsage: 1.2 }, memory: { workingSetSize: 128000 } },
    ]);

    const result = await context.getElectronApp();

    expect(result).not.toBeNull();
    expect(result?.getAppMetrics()).toHaveLength(2);
    expect(result?.getVersion()).toBe('1.0.0');
    expect(result?.getName()).toBe('AiderDesk');
    expect(result?.isReady()).toBe(true);
  });

  it('should return null when app.getAppMetrics is missing', async () => {
    const originalApp = mockElectronApp.getAppMetrics;
    mockElectronApp.getAppMetrics = undefined as never;

    const result = await context.getElectronApp();

    expect(result).toBeNull();
    mockElectronApp.getAppMetrics = originalApp;
  });

  it('should return null when app.getAppMetrics is not a function', async () => {
    const originalApp = mockElectronApp.getAppMetrics;
    mockElectronApp.getAppMetrics = 'not a function' as never;

    const result = await context.getElectronApp();

    expect(result).toBeNull();
    mockElectronApp.getAppMetrics = originalApp;
  });

  it('should return null when electron import throws', async () => {
    vi.doMock('electron', () => {
      throw new Error('Module not found');
    });
    vi.resetModules();
    const { ExtensionContextImpl: FreshImpl } = await import('../extension-context');
    const freshContext = new FreshImpl(extensionId, extensionName, createMockStore());

    const result = await freshContext.getElectronApp();

    expect(result).toBeNull();
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Failed to get Electron app'));
  });
});

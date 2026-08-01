import { afterEach, describe, expect, it, vi } from 'vitest';

import { Store } from '@/store';

const importHelper = async (envValue: string | undefined) => {
  vi.resetModules();
  vi.doMock('@/constants', () => ({ READONLY_EXTENSION_UI: envValue }));
  return await import('@/server/readonly');
};

const createStore = (readonlyExtensionUi?: boolean): Store =>
  ({
    getSettings: () => ({ server: { readonlyExtensionUi } }),
  }) as unknown as Store;

describe('isReadonlyExtensionUiEnabled', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns true when env var forces enable even if setting disables it', async () => {
    const { isReadonlyExtensionUiEnabled } = await importHelper('true');

    expect(isReadonlyExtensionUiEnabled(createStore(false))).toBe(true);
    expect(isReadonlyExtensionUiEnabled(createStore(undefined))).toBe(true);
  });

  it('returns false when env var forces disable even if setting enables it', async () => {
    const { isReadonlyExtensionUiEnabled } = await importHelper('false');

    expect(isReadonlyExtensionUiEnabled(createStore(true))).toBe(false);
    expect(isReadonlyExtensionUiEnabled(createStore(undefined))).toBe(false);
  });

  it('falls back to the server setting when env var is not set', async () => {
    const { isReadonlyExtensionUiEnabled } = await importHelper(undefined);

    expect(isReadonlyExtensionUiEnabled(createStore(true))).toBe(true);
    expect(isReadonlyExtensionUiEnabled(createStore(false))).toBe(false);
    expect(isReadonlyExtensionUiEnabled(createStore(undefined))).toBe(true);
  });
});

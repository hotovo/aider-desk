import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsData } from '@common/types';

const confData = vi.hoisted(() => new Map<string, unknown>());
const confGet = vi.hoisted(() => vi.fn((key: string) => confData.get(key)));
const confSet = vi.hoisted(() =>
  vi.fn((key: string, value: unknown) => {
    confData.set(key, value);
  }),
);

vi.mock('conf', () => ({
  default: class {
    get = confGet;
    set = confSet;
  },
}));

vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { Store } from '../store';

const getSettingsReads = () => confGet.mock.calls.filter(([key]) => key === 'settings').length;

describe('Store settings cache', () => {
  let store: Store;

  beforeEach(async () => {
    confData.clear();
    store = new Store();
    await store.init();
    confData.set('settings', { language: 'en', extensions: { disabled: ['a.ts'] } });
    confGet.mockClear();
    confSet.mockClear();
  });

  it('reads the settings from conf only once for repeated calls', () => {
    store.getSettings();
    store.getSettings();
    store.getSettings();

    expect(getSettingsReads()).toBe(1);
  });

  it('returns a copy so callers cannot mutate the cached settings', () => {
    const settings = store.getSettings();
    settings.language = 'zh';
    settings.extensions!.disabled!.push('b.ts');

    const reloaded = store.getSettings();
    expect(reloaded.language).toBe('en');
    expect(reloaded.extensions?.disabled).toEqual(['a.ts']);
  });

  it('returns the saved settings after saveSettings', () => {
    const settings = store.getSettings();

    store.saveSettings({ ...settings, language: 'ru' } as SettingsData);

    expect(store.getSettings().language).toBe('ru');
    expect(confSet).toHaveBeenCalledWith('settings', expect.objectContaining({ language: 'ru' }));
  });
});

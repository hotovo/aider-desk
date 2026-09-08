import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ExtensionContext } from '@aiderdesk/extensions';

import SoundNotificationExtension from '../index';

// refreshPacks writes the refreshed pack list next to the extension source
// (packs.json); mock the write so tests never touch repository files.
vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  writeFileSync: vi.fn(),
}));

const CONTENTS_URL = 'https://api.github.com/repos/PeonPing/og-packs/contents';
const PACKS_URL = 'https://raw.githubusercontent.com/PeonPing/og-packs/main';

const createContext = (): ExtensionContext => {
  return {
    log: vi.fn(),
  } as unknown as ExtensionContext;
};

const createExtensionWithManifests = (manifests: Record<string, unknown>): SoundNotificationExtension => {
  const ext = new SoundNotificationExtension();
  (ext as unknown as { fetchJson: (url: string) => Promise<unknown> }).fetchJson = vi.fn(async (url: string) => {
    if (url === CONTENTS_URL) {
      return Object.keys(manifests)
        .filter((name) => name !== 'manifest-error')
        .map((name) => ({ name, type: 'dir' }));
    }
    const packName = url.slice(PACKS_URL.length + 1, -('/openpeon.json'.length));
    const manifest = manifests[packName];
    if (manifest === 'manifest-error') {
      throw new Error('malformed JSON');
    }
    return manifest;
  });
  return ext;
};

const validSound = { file: 'sounds/tada.ogg', label: 'Tada', sha256: 'abc123' };

describe('SoundNotificationExtension refreshPacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects malformed sound entries while keeping valid ones in the same pack', async () => {
    const ext = createExtensionWithManifests({
      goodpack: {
        display_name: 'Good Pack',
        categories: {
          misc: {
            sounds: [
              validSound,
              { file: 'x.ogg', label: 'missing-sha' }, // malformed: no sha256
              { file: 'y.ogg', sha256: 'deadbeef' }, // malformed: no label
              { label: 'no-file', sha256: 'abc' }, // malformed: no file
              { file: '', label: 'empty-file', sha256: 'abc' }, // malformed: empty file
              'not-an-object', // malformed: not an object
              null, // malformed: null entry
            ],
          },
        },
      },
    });
    const ctx = createContext();

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string; displayName: string; sounds: Array<{ file: string; label: string; sha256: string }> }>> }).refreshPacks(ctx);

    expect(packs).toHaveLength(1);
    expect(packs[0]).toEqual({
      name: 'goodpack',
      displayName: 'Good Pack',
      sounds: [validSound],
    });
    expect(ctx.log).toHaveBeenCalledWith('Skipping malformed sound entry in pack: goodpack', 'warn');
  });

  it('skips a pack whose manifest cannot be fetched, but still refreshes valid packs', async () => {
    const ext = createExtensionWithManifests({
      brokenpack: 'manifest-error',
      'other-pack': {
        categories: { general: { sounds: [validSound] } },
      },
    });
    const ctx = createContext();

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string; sounds: unknown[] }>> }).refreshPacks(ctx);

    expect(packs).toHaveLength(1);
    expect(packs[0]).toEqual({ name: 'other-pack', displayName: 'other-pack', sounds: [validSound] });
    expect(ctx.log).toHaveBeenCalledWith('Failed to fetch pack: brokenpack', 'warn');
  });

  it.each([['array', []], ['string', 'just-a-string'], ['number', 42]])(
    'skips a pack whose manifest root is a non-object %s instead of persisting an empty pack',
    async (name, root) => {
      const ext = createExtensionWithManifests({
        [name]: root,
        'other-pack': {
          categories: { general: { sounds: [validSound] } },
        },
      } as Record<string, unknown>);
      const ctx = createContext();

      const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string; sounds: unknown[] }>> }).refreshPacks(ctx);

      // The malformed pack is skipped (fallback catalog preserved); valid packs still refresh.
      expect(packs).toHaveLength(1);
      expect(packs[0]).toEqual({ name: 'other-pack', displayName: 'other-pack', sounds: [validSound] });
      expect(ctx.log).toHaveBeenCalledWith(`Failed to fetch pack: ${name}`, 'warn');
      // The skipped pack must not be persisted as an empty pack.
      const writeFileSync = vi.mocked(await import('fs')).writeFileSync as ReturnType<typeof vi.fn>;
      const written = writeFileSync.mock.calls[0][1] as string;
      expect(JSON.parse(written)).toEqual(packs);
    },
  );

  it('skips non-object entries in the GitHub contents listing without crashing', async () => {
    const ext = new SoundNotificationExtension();
    (ext as unknown as { fetchJson: (url: string) => Promise<unknown> }).fetchJson = vi.fn(async (url: string) => {
      if (url === CONTENTS_URL) {
        return [
          null, // malformed: null entry
          42, // malformed: number entry
          'a-string', // malformed: string entry
          ['look', 'like', 'an', 'array'], // malformed: array entry
          { name: 'goodpack', type: 'dir' },
        ];
      }
      return {
        categories: { general: { sounds: [validSound] } },
      };
    });
    const ctx = createContext();

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string; sounds: unknown[] }>> }).refreshPacks(ctx);

    expect(packs).toHaveLength(1);
    expect(packs[0]).toEqual({ name: 'goodpack', displayName: 'goodpack', sounds: [validSound] });

    const writeFileSync = vi.mocked(await import('fs')).writeFileSync as ReturnType<typeof vi.fn>;
    const written = writeFileSync.mock.calls[0][1] as string;
    expect(JSON.parse(written)).toEqual(packs);
  });

  it('keeps the previous catalog and does NOT persist when the refresh yields an empty contents listing', async () => {
    const ext = new SoundNotificationExtension();
    (ext as unknown as { fetchJson: (url: string) => Promise<unknown> }).fetchJson = vi.fn(async (url: string) =>
      url === CONTENTS_URL ? [] : { categories: { general: { sounds: [validSound] } } },
    );
    const ctx = createContext();

    const writeFileSync = vi.mocked(await import('fs')).writeFileSync as ReturnType<typeof vi.fn>;
    const before = ((await ext.getConfigData()) as { packs: Array<{ name: string }> }).packs;
    expect(before.length).toBeGreaterThan(0);

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string }>> }).refreshPacks(ctx);

    // The previous (non-empty) catalog must be retained, not replaced by []
    expect(packs).toEqual(before);
    expect(((await ext.getConfigData()) as { packs: Array<{ name: string }> }).packs).toEqual(before);

    // An empty refresh must never be persisted to packs.json
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(ctx.log).toHaveBeenCalledWith('Pack refresh produced an empty catalog; keeping the previous pack catalog', 'error');
  });

  it('keeps the previous catalog and does NOT persist when every per-pack fetch fails', async () => {
    const ext = createExtensionWithManifests({
      'broken-one': 'manifest-error',
      'broken-two': 'manifest-error',
    });
    const ctx = createContext();

    const writeFileSync = vi.mocked(await import('fs')).writeFileSync as ReturnType<typeof vi.fn>;
    const before = ((await ext.getConfigData()) as { packs: Array<{ name: string }> }).packs;
    expect(before.length).toBeGreaterThan(0);

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string }>> }).refreshPacks(ctx);

    // All packs failed -> empty result -> previous catalog kept, nothing written
    expect(packs).toEqual(before);
    expect(writeFileSync).not.toHaveBeenCalled();
    expect(ctx.log).toHaveBeenCalledWith('Pack refresh produced an empty catalog; keeping the previous pack catalog', 'error');
  });

  it('ignores a manifest whose categories field is not an object and records an empty sound list', async () => {
    const ext = createExtensionWithManifests({
      weirdpack: {
        display_name: 'Weird',
        categories: 'not-an-object',
      },
    });
    const ctx = createContext();

    const packs = await (ext as unknown as { refreshPacks: (ctx: ExtensionContext) => Promise<Array<{ name: string; sounds: unknown[] }>> }).refreshPacks(ctx);

    expect(packs).toEqual([{ name: 'weirdpack', displayName: 'Weird', sounds: [] }]);
  });
});

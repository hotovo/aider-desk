import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionDisplayAPI } from '@common/api';
import type { ExtensionUIComponent } from '@common/types';

import { getDataCacheKey, handleExtensionUIRefreshEvent, loadExtensionComponentData, useExtensionUIStore } from '@/stores/extensionUIStore';

// Regression tests for the sound-notification phase-2 follow-up:
// 1. (HIGH-1) the extension UI store caches fetched data by JSON equality —
//    an identical refresh snapshot must still update the store when the
//    payload carries a fresh nonce (the sound panel's playback effect keys off
//    the data object identity), and
// 2. (project-independent refresh routing) globally mounted placements
//    (projectDir undefined, e.g. 'app-floating') must not drop refreshes
//    stamped with a projectDir.

const apiMock = {
  getExtensionUIComponents: vi.fn(async () => [] as ExtensionUIComponent[]),
  getUIExtensionData: vi.fn(async () => undefined),
} as unknown as ExtensionDisplayAPI;

const EXTENSION_ID = 'sound-notification';
const COMPONENT_ID = 'sound-remote-panel';
const CACHE_KEY = getDataCacheKey(EXTENSION_ID, COMPONENT_ID, undefined, undefined);

const snapshot = (nonce: number) => ({
  pending: [{ id: 'n-1', deliveryId: 'd-1', kind: 'task-finished', title: 't', body: 'b', baseDir: '/projects/demo' }],
  sounds: { volume: 0.5, presets: { 'task-finished': 'bell', 'input-needed': 'ding', generic: 'chime' } },
  refreshNonce: nonce,
});

describe('extensionUIStore sound-notification phase-2 follow-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useExtensionUIStore.getState().invalidateData();
    useExtensionUIStore.getState().invalidateComponents();
  });

  describe('loadComponentData nonce replay (HIGH-1)', () => {
    it('updates the store (and observers) even when a refresh returns an identical snapshot apart from the nonce', async () => {
      // First refresh: initial snapshot lands in the store
      apiMock.getUIExtensionData = vi.fn(async () => snapshot(1)) as unknown as ExtensionDisplayAPI['getUIExtensionData'];
      await useExtensionUIStore.getState().loadComponentData(apiMock, EXTENSION_ID, COMPONENT_ID, undefined, undefined);
      const firstDataMap = useExtensionUIStore.getState().dataMap;
      expect(useExtensionUIStore.getState().dataMap.get(CACHE_KEY)).toEqual(snapshot(1));

      // Second refresh: same pending/sounds (identical JSON apart from the
      // nonce) — e.g. the user armed sounds and the panel requested a re-offer.
      // The JSON-equality cache must NOT swallow this: the dataMap reference
      // changes so subscribers (the mounted panel) re-render and the playback
      // effect re-runs against the still-queued snapshot.
      apiMock.getUIExtensionData = vi.fn(async () => snapshot(2)) as unknown as ExtensionDisplayAPI['getUIExtensionData'];
      await useExtensionUIStore.getState().loadComponentData(apiMock, EXTENSION_ID, COMPONENT_ID, undefined, undefined, true);

      expect(useExtensionUIStore.getState().dataMap).not.toBe(firstDataMap);
      expect(useExtensionUIStore.getState().dataMap.get(CACHE_KEY)).toEqual(snapshot(2));
    });

    it('without a nonce change an identical snapshot is (still) deduplicated by JSON equality', async () => {
      // Documents the store behavior that makes the nonce necessary: payloads
      // without any per-refresh difference keep the old dataMap reference, so
      // identical snapshots would never re-trigger a mounted panel.
      apiMock.getUIExtensionData = vi.fn(async () => ({ pending: ['x'], sounds: { volume: 0.5 } })) as unknown as ExtensionDisplayAPI['getUIExtensionData'];
      await useExtensionUIStore.getState().loadComponentData(apiMock, EXTENSION_ID, COMPONENT_ID, undefined, undefined);
      const firstDataMap = useExtensionUIStore.getState().dataMap;

      await useExtensionUIStore.getState().loadComponentData(apiMock, EXTENSION_ID, COMPONENT_ID, undefined, undefined, true);

      expect(useExtensionUIStore.getState().dataMap).toBe(firstDataMap);
    });

    it('loadExtensionComponentData action helper passes forceRefresh through', async () => {
      apiMock.getUIExtensionData = vi.fn(async () => snapshot(1)) as unknown as ExtensionDisplayAPI['getUIExtensionData'];
      const spy = apiMock.getUIExtensionData as ReturnType<typeof vi.fn>;

      await loadExtensionComponentData(apiMock as never, EXTENSION_ID, COMPONENT_ID, undefined, undefined);
      await loadExtensionComponentData(apiMock as never, EXTENSION_ID, COMPONENT_ID, undefined, undefined, true);

      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleRefreshEvent routing (app-floating)', () => {
    it('invalidates the global components cache for a project-stamped reloadComponents refresh', () => {
      // Seed a global cache entry (the 'app-floating' panels mount without a
      // projectDir, producing the ':global:' cache key).
      useExtensionUIStore.setState((state) => {
        const map = new Map(state.componentsMap);
        map.set('app-floating:global:', [{ extensionId: EXTENSION_ID, componentId: COMPONENT_ID } as ExtensionUIComponent]);
        return { componentsMap: map };
      });

      handleExtensionUIRefreshEvent(apiMock, { projectDir: '/projects/demo', reloadComponents: true }, undefined, undefined);

      expect(useExtensionUIStore.getState().componentsMap.has('app-floating:global:')).toBe(false);
    });

    it('does not invalidate a project-scoped components cache for a mismatching projectDir', () => {
      useExtensionUIStore.setState((state) => {
        const map = new Map(state.componentsMap);
        map.set('app-floating:/projects/other:', [{ extensionId: EXTENSION_ID, componentId: COMPONENT_ID } as ExtensionUIComponent]);
        return { componentsMap: map };
      });

      handleExtensionUIRefreshEvent(apiMock, { projectDir: '/projects/demo', reloadComponents: true }, '/projects/other', undefined);

      expect(useExtensionUIStore.getState().componentsMap.has('app-floating:/projects/other:')).toBe(true);
    });
  });
});

import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExtensionContext, NotificationEvent } from '@aiderdesk/extensions';

import SoundNotificationExtension from '../index';

const BROWSER_COMPONENT_ID = 'sound-remote-panel';

const createContext = (): ExtensionContext => {
  return {
    log: vi.fn(),
    triggerUIDataRefresh: vi.fn(),
    triggerUIComponentsReload: vi.fn(),
    getElectronApp: vi.fn().mockResolvedValue(null),
  } as unknown as ExtensionContext;
};

const makeEvent = (id = 'n-1', kind = 'task-finished', baseDir = '/projects/demo'): NotificationEvent => ({
  notification: {
    baseDir,
    title: 'Task finished',
    body: 'Something happened',
    id,
    kind,
    timestamp: 1_700_000_000_000,
  },
});

type Harness = {
  ext: SoundNotificationExtension;
  ctx: ExtensionContext;
  configPath: string;
  dir: string;
};

const createExtensionWithConfig = (config: unknown): Harness => {
  const ext = new SoundNotificationExtension();
  const dir = mkdtempSync(join(tmpdir(), 'sound-notification-test-'));
  const configPath = join(dir, 'config.json');
  writeFileSync(configPath, JSON.stringify(config), 'utf-8');
  (ext as unknown as { configPath: string }).configPath = configPath;
  return { ext, ctx: createContext(), configPath, dir };
};

let harnesses: Harness[] = [];

const withConfig = (config: unknown): Harness => {
  const harness = createExtensionWithConfig(config);
  harnesses.push(harness);
  return harness;
};

describe('SoundNotificationExtension browser delivery', () => {
  beforeEach(() => {
    harnesses = [];
  });

  afterEach(() => {
    harnesses = [];
  });

  describe('onNotification', () => {
    it('queues the notification and triggers a UI data refresh when delivery mode is browser', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      await ext.onNotification(makeEvent('n-1', 'task-finished'), ctx);

      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);

      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ id: string; kind: string; title: string; baseDir: string; deliveryId: string }> };
      expect(data.pending).toHaveLength(1);
      expect(data.pending[0]).toMatchObject({ id: 'n-1', kind: 'task-finished', baseDir: '/projects/demo' });
      expect(data.pending[0].deliveryId).toBeTruthy();
    });

    it('queues in "both" delivery mode as well', async () => {
      const { ext, ctx } = withConfig({ delivery: 'both' });

      await ext.onNotification(makeEvent('n-1'), ctx);

      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);
    });

    it('dedupes redelivered notifications by baseDir:id', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      await ext.onNotification(makeEvent('n-1'), ctx);
      await ext.onNotification(makeEvent('n-1'), ctx);

      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledTimes(1);

      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(data.pending).toHaveLength(1);
    });

    it('allows the same id from different projects', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      await ext.onNotification(makeEvent('n-1', 'task-finished', '/a'), ctx);
      await ext.onNotification(makeEvent('n-1', 'task-finished', '/b'), ctx);

      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ baseDir: string }> };
      expect(data.pending).toHaveLength(2);
      expect(data.pending.map((p) => p.baseDir).sort()).toEqual(['/a', '/b']);
    });

    it('does nothing when delivery mode is local', async () => {
      const { ext, ctx } = withConfig({ delivery: 'local' });

      await ext.onNotification(makeEvent('n-1'), ctx);

      expect(ctx.triggerUIDataRefresh).not.toHaveBeenCalled();
      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(data.pending).toHaveLength(0);
    });

    it('skips remote playback when the event is blocked by another extension', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      await ext.onNotification({ ...makeEvent('n-1'), blocked: true }, ctx);

      expect(ctx.triggerUIDataRefresh).not.toHaveBeenCalled();
      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(data.pending).toHaveLength(0);
    });

    it('skips kinds disabled in config', async () => {
      const {
        ext, ctx,
      } = withConfig({
        delivery: 'browser',
        browser: { kinds: { 'task-finished': true, 'input-needed': false, generic: false } },
      });

      await ext.onNotification(makeEvent('n-1', 'input-needed'), ctx);

      expect(ctx.triggerUIDataRefresh).not.toHaveBeenCalled();
      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(data.pending).toHaveLength(0);
    });

    it('routes missing kind to the generic kind toggle', async () => {
      const { ext, ctx } = withConfig({
        delivery: 'browser',
        browser: { kinds: { 'task-finished': true, 'input-needed': true, generic: true } },
      });

      await ext.onNotification({ notification: { baseDir: '/a', title: 't', body: 'b', id: 'n-9' } }, ctx);

      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);
    });

    it('delivers an unknown kind (generic:false) and respects the generic toggle for it', async () => {
      // An UNKNOWN non-empty kind (e.g. 'deploy-done') has no config entry: it
      // must follow the 'generic' toggle instead of being silently dropped.
      const { ext, ctx } = withConfig({
        delivery: 'browser',
        browser: { kinds: { 'task-finished': true, 'input-needed': true, generic: true } },
      });

      await ext.onNotification(makeEvent('n-7', 'deploy-done'), ctx);

      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);
      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ id: string; kind: string }> };
      expect(data.pending).toHaveLength(1);
      // The normalized kind is preserved for downstream queue/preset lookup
      expect(data.pending[0]).toMatchObject({ id: 'n-7', kind: 'deploy-done' });

      // And with the generic toggle disabled, the unknown kind is skipped
      const { ext: extOff, ctx: ctxOff } = withConfig({
        delivery: 'browser',
        browser: { kinds: { 'task-finished': true, 'input-needed': true, generic: false } },
      });
      await extOff.onNotification(makeEvent('n-8', 'deploy-done'), ctxOff);
      expect(ctxOff.triggerUIDataRefresh).not.toHaveBeenCalled();
      const dataOff = (await extOff.getUIExtensionData(BROWSER_COMPONENT_ID, ctxOff)) as { pending: unknown[] };
      expect(dataOff.pending).toHaveLength(0);
    });

    it('a known kind still gates on its own toggle, not the generic one', async () => {
      const { ext, ctx } = withConfig({
        delivery: 'browser',
        browser: { kinds: { 'task-finished': false, 'input-needed': true, generic: true } },
      });

      await ext.onNotification(makeEvent('n-6', 'task-finished'), ctx);

      expect(ctx.triggerUIDataRefresh).not.toHaveBeenCalled();
      const data = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(data.pending).toHaveLength(0);
    });
  });

  describe('getUIExtensionData', () => {
    it('returns a non-destructive snapshot including sound settings; entries stay queued until acknowledged', async () => {
      const { ext, ctx } = withConfig({
        delivery: 'browser',
        browser: { volume: 0.75, presets: { 'task-finished': 'soft', 'input-needed': 'ding', generic: 'chime' } },
      });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const snapshot = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as {
        pending: Array<{ id: string; deliveryId: string }>;
        sounds: { volume: number; presets: Record<string, string> };
      };

      expect(snapshot.pending).toHaveLength(1);
      expect(snapshot.sounds).toEqual({
        volume: 0.75,
        presets: { 'task-finished': 'soft', 'input-needed': 'ding', generic: 'chime' },
      });

      // Non-destructive: a subsequent fetch (another tab/window) sees the entry too
      const second = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ deliveryId: string }> };
      expect(second.pending).toHaveLength(1);

      // Acknowledgement via the panel UI action removes it
      const ack = await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acknowledge-played', [[snapshot.pending[0].deliveryId]], ctx);
      expect(ack).toEqual({ acknowledged: true });

      const afterAck = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] };
      expect(afterAck.pending).toHaveLength(0);
    });

    it('a consumer that does not acknowledge (cannot play) cannot steal a notification (HIGH-2)', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const first = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ id: string }> };
      expect(first.pending.map((n) => n.id)).toEqual(['n-1']);

      // First consumer fetched but never acknowledged — the second consumer (primary tab) still receives it
      const second = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ id: string }> };
      expect(second.pending.map((n) => n.id)).toEqual(['n-1']);
    });

    it('returns undefined for other component ids', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      expect(await ext.getUIExtensionData('unrelated', ctx)).toBeUndefined();
    });

    it('stamps every refresh payload with a fresh nonce so identical snapshots still trigger consumers (HIGH-1)', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const first = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { refreshNonce: number; pending: unknown[] };
      const second = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { refreshNonce: number; pending: unknown[] };

      // The snapshot content (pending/sounds) is identical across both fetches
      // — without the nonce the renderer's JSON-equality cache would treat the
      // second refresh as unchanged and the panel's playback effect would
      // never re-run (queued notifications not replayed after enabling sounds
      // / returning to the tab).
      expect(second.pending).toEqual(first.pending);
      expect(second.refreshNonce).toBeTypeOf('number');
      expect(second.refreshNonce).not.toBe(first.refreshNonce);
    });

    it('offers a background-project notification to the globally mounted panel (app-floating fix)', async () => {
      // The panel is registered in 'app-floating', which is mounted without a
      // projectDir: the data fetch reaches the extension with NO project
      // context, while the notification was queued from a background project's
      // onNotification context (baseDir stamped by the notification itself).
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      // Background project context: the queue is shared across all projects.
      await ext.onNotification({ notification: { baseDir: '/projects/background', title: 'bg', body: 'queued while another project is active', id: 'bg-1', kind: 'task-finished' } }, ctx);
      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);

      // The global panel (no projectDir) fetches the data slot and must see
      // the background project's queued notification.
      const globalData = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, createContext())) as { pending: Array<{ id: string; baseDir: string }> };
      expect(globalData.pending.map((p) => ({ id: p.id, baseDir: p.baseDir }))).toEqual([{ id: 'bg-1', baseDir: '/projects/background' }]);
    });
  });

  describe('playback claims and refresh actions', () => {
    it('acquire-claims is won by exactly one concurrent consumer; only the winner acks (MED-2)', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const snapshot = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ deliveryId: string }> };
      const ids = snapshot.pending.map((n) => n.deliveryId);

      // Two concurrent consumers race for the same snapshot's deliveries
      const first = (await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', ['tab-a', ids], ctx)) as { claimed: string[] };
      const second = (await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', ['tab-b', ids], ctx)) as { claimed: string[] };

      expect(first.claimed).toEqual(ids);
      expect(second.claimed).toEqual([]);

      // The loser does not play or ack — the entry must remain queued
      expect(((await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] }).pending).toHaveLength(1);

      // The winner plays and acks — the queue empties
      const ack = await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acknowledge-played', [ids], ctx);
      expect(ack).toEqual({ acknowledged: true });
      expect(((await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] }).pending).toHaveLength(0);
    });

    it('acquire-claims ignores malformed args', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      expect(await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', ['', ['x']], ctx)).toEqual({ claimed: [] });
      expect(await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', ['tab-a'], ctx)).toEqual({ claimed: [] });
    });

    it("the panel's real acquire-claims call reaches the extension's argument parser as [consumerId, deliveryIds] and claims the delivery (HIGH wire shape)", async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const snapshot = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ deliveryId: string }> };
      const candidateIds = snapshot.pending.map((n) => n.deliveryId);
      expect(candidateIds.length).toBeGreaterThan(0);

      // Wire shape under test: the production wrapper (ExtensionComponentRenderer.tsx)
      // is (action, ...args) => executeUIExtensionAction(..., action, args, ...),
      // and the extension parses (args ?? []) as [consumerId, deliveryIds].
      // Extract the panel's REAL 'acquire-claims' argument expression from the
      // JSX source so the test fails if the panel's call drifts from the wire
      // shape, then evaluate it against the panel's runtime values to build the
      // wrapper's rest-arg array exactly as production does.
      const panelSource = readFileSync(new URL('../SoundRemotePanel.jsx', import.meta.url), 'utf-8');
      const call = panelSource.match(/executeExtensionAction\(\s*'acquire-claims',\s*([\s\S]*?)\)\s*;/);
      expect(call).not.toBeNull();

      const ensureTabId = () => 'tab-under-test';
      // Mirrors the wrapper: separate call-site arguments -> single args array
      const restArgs = new Function('ensureTabId', 'candidateIds', `return [${call![1]}];`)(ensureTabId, candidateIds) as unknown[];
      expect(Array.isArray(restArgs)).toBe(true);
      // Exactly two top-level args must arrive at the extension: consumerId + deliveryIds
      expect(restArgs).toHaveLength(2);
      expect(restArgs[0]).toBe('tab-under-test');
      expect(restArgs[1]).toEqual(candidateIds);

      const result = (await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', restArgs, ctx)) as { claimed: string[] };

      // The extension's parser must actually claim the snapshot's deliveries —
      // the pre-fix call passed one nested array so consumerId was an array,
      // validation failed and the panel never received any claims.
      expect(result.claimed).toEqual(candidateIds);

      // The winner can acknowledge; the queue then empties (end-to-end through
      // the real extension dispatch).
      const ack = await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acknowledge-played', [candidateIds], ctx);
      expect(ack).toEqual({ acknowledged: true });
      expect(((await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] }).pending).toHaveLength(0);
    });

    it("the panel's acknowledge-played call carries its consumer id; a non-claimant cannot drop another tab's claimed delivery (claim-ownership wire shape)", async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      await ext.onNotification(makeEvent('n-1'), ctx);

      const snapshot = (await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: Array<{ deliveryId: string }> };
      const deliveryIds = snapshot.pending.map((n) => n.deliveryId);

      // Wire shape under test: the panel's real 'acknowledge-played' argument
      // expression must be (ackIds, ensureTabId()) — the consumer id travels
      // as a separate second argument so the extension can bind the removal to
      // the claim owner. Extract and evaluate the expression exactly as
      // production builds the wrapper's rest-arg array.
      const panelSource = readFileSync(new URL('../SoundRemotePanel.jsx', import.meta.url), 'utf-8');
      const call = panelSource.match(/executeExtensionAction\(\s*'acknowledge-played',\s*([\s\S]*?)\)\s*\.catch/);
      expect(call).not.toBeNull();

      const ackedIds = [...deliveryIds];
      const ensureTabId = () => 'tab-under-test';
      const restArgs = new Function('ackIds', 'ensureTabId', `return [${call![1]}];`)(ackedIds, ensureTabId) as unknown[];
      // Exactly two top-level args must arrive at the extension: deliveryIds + consumerId
      expect(restArgs).toHaveLength(2);
      expect(restArgs[0]).toEqual(deliveryIds);
      expect(restArgs[1]).toBe('tab-under-test');

      // tab-a claims the delivery, then tab-b (whose ids the panel source was
      // evaluated with above) acks it: the removal must be refused.
      await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acquire-claims', ['tab-a', deliveryIds], ctx);
      const ack = await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acknowledge-played', restArgs, ctx);
      expect(ack).toEqual({ acknowledged: true });
      expect(((await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] }).pending).toHaveLength(1);

      // The legitimate claimant acking its own played delivery removes it.
      const ackOwner = await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'acknowledge-played', [deliveryIds, 'tab-a'], ctx);
      expect(ackOwner).toEqual({ acknowledged: true });
      expect(((await ext.getUIExtensionData(BROWSER_COMPONENT_ID, ctx)) as { pending: unknown[] }).pending).toHaveLength(0);
    });

    it('request-refresh re-triggers a UI data refresh so queued items are re-offered (MED-1)', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });

      expect(ctx.triggerUIDataRefresh).not.toHaveBeenCalled();

      const result = (await ext.executeUIExtensionAction(BROWSER_COMPONENT_ID, 'request-refresh', [], ctx)) as { refreshed: boolean };
      expect(result).toEqual({ refreshed: true });
      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);
    });
  });

  describe('executeUIExtensionAction routing', () => {
    it('dispatches actions whose componentId is the extension id "sound-notification" (LOW-2 regression)', async () => {
      const { ext, ctx } = withConfig({});
      const playSound = vi
        .spyOn(ext as unknown as { playSound: (...args: unknown[]) => Promise<void> }, 'playSound')
        .mockResolvedValue(undefined);

      await expect(ext.executeUIExtensionAction('sound-notification', 'play-sound', ['peasant', 'PeasantJobDone'], ctx)).resolves.toEqual({ success: true });
      expect(playSound).toHaveBeenCalledTimes(1);
    });

    it('ignores unknown component ids', async () => {
      const { ext, ctx } = withConfig({});
      const playSound = vi
        .spyOn(ext as unknown as { playSound: (...args: unknown[]) => Promise<void> }, 'playSound')
        .mockResolvedValue(undefined);

      await expect(ext.executeUIExtensionAction('some-other-component', 'play-sound', ['peasant', 'PeasantJobDone'], ctx)).resolves.toBeUndefined();
      expect(playSound).not.toHaveBeenCalled();
    });
  });

  describe('local playback delivery-mode gating', () => {
    it('skips local playback (playEventSound) when delivery mode is browser', async () => {
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      const playEventSound = vi.spyOn(ext as unknown as { playEventSound: (...args: unknown[]) => Promise<void> }, 'playEventSound');

      await ext.onPromptFinished({ prompt: 'x' } as never, ctx);

      expect(playEventSound).not.toHaveBeenCalled();
    });

    it('still plays locally when delivery mode is both', async () => {
      const { ext, ctx } = withConfig({ delivery: 'both' });
      const playEventSound = vi.spyOn(ext as unknown as { playEventSound: (...args: unknown[]) => Promise<void> }, 'playEventSound').mockResolvedValue(undefined);

      await ext.onPromptFinished({ prompt: 'x' } as never, ctx);

      expect(playEventSound).toHaveBeenCalledTimes(1);
    });

    it('still plays locally by default (legacy configs without the new keys)', async () => {
      const { ext, ctx } = withConfig({});
      const playEventSound = vi.spyOn(ext as unknown as { playEventSound: (...args: unknown[]) => Promise<void> }, 'playEventSound').mockResolvedValue(undefined);

      await ext.onPromptFinished({ prompt: 'x' } as never, ctx);

      expect(playEventSound).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveConfigData', () => {
    it('normalizes partial config (nested defaults) and triggers a panel data refresh', async () => {
      const { ext, ctx, configPath } = withConfig({});
      vi.spyOn(ext as unknown as { downloadSoundIfNeeded: (...args: unknown[]) => Promise<void> }, 'downloadSoundIfNeeded').mockResolvedValue(undefined);

      const saved = (await ext.saveConfigData({ delivery: 'both', browser: { volume: 0.8 } }, ctx)) as { delivery: string; browser: { volume: number; kinds?: Record<string, unknown> } };

      expect(saved.delivery).toBe('both');
      expect(saved.browser.volume).toBe(0.8);
      expect(saved.browser.kinds).toMatchObject({ 'task-finished': true, 'input-needed': true, generic: false });

      const stored = JSON.parse(readFileSync(configPath, 'utf-8'));
      expect(stored.delivery).toBe('both');
      expect(stored.browser.presets['task-finished']).toBe('bell');
      expect(ctx.triggerUIDataRefresh).toHaveBeenCalledWith(BROWSER_COMPONENT_ID);
      expect(ctx.triggerUIComponentsReload).toHaveBeenCalled();
    });
  });

  describe('getUIComponents', () => {
    it('registers no browser panel when delivery mode is local (default) (LOW-2)', () => {
      const { ext } = withConfig({});

      expect(ext.getUIComponents(createContext())).toEqual([]);
    });

    it('registers the globally-scoped app-floating remote sounds panel in browser delivery mode', () => {
      const { ext } = withConfig({ delivery: 'browser' });

      expect(ext.getUIComponents(createContext())).toMatchObject([
        {
          id: BROWSER_COMPONENT_ID,
          // 'app-floating' (not 'project-floating'): the main window mounts
          // this placement always, so refreshes triggered from a background
          // project's onNotification reach the panel (renderer-side routing).
          placement: 'app-floating',
          loadData: true,
        },
      ]);
    });

    it('registers the app-floating panel in "both" delivery mode as well', () => {
      const { ext } = withConfig({ delivery: 'both' });

      expect(ext.getUIComponents(createContext())).toHaveLength(1);
      expect(ext.getUIComponents(createContext())[0]?.placement).toBe('app-floating');
    });

    it('registers the panel even when the running host is the Electron desktop app (LOW-1 fix)', async () => {
      // The main process Electron flag must NOT disable the panel: remote
      // browser tabs of a desktop install still use browser playback. The
      // desktop renderer suppresses the panel itself via its isElectron guard.
      const { ext, ctx } = withConfig({ delivery: 'browser' });
      const electronApp = { getAppMetrics: () => [] };
      (ctx.getElectronApp as ReturnType<typeof vi.fn>).mockResolvedValue(electronApp);

      await ext.onLoad(ctx);

      expect(ext.getUIComponents(ctx)).toHaveLength(1);
      expect(ext.getUIComponents(ctx)[0]?.placement).toBe('app-floating');
    });

    it('registers the panel in both modes in "both" delivery regardless of the Electron host', async () => {
      const { ext, ctx } = withConfig({ delivery: 'both' });
      (ctx.getElectronApp as ReturnType<typeof vi.fn>).mockResolvedValue({ getAppMetrics: () => [] });

      await ext.onLoad(ctx);

      expect(ext.getUIComponents(ctx)).toHaveLength(1);
    });
  });
});

import { exec } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import https from 'https';

import type { Extension, ExtensionContext, NotificationEvent, NotificationKind, PromptFinishedEvent, QuestionAskedEvent, UIComponentDefinition } from '@aiderdesk/extensions';

import { BrowserNotificationQueue } from './browser-delivery';

const execAsync = promisify(exec);

const PACKS_URL = 'https://raw.githubusercontent.com/PeonPing/og-packs/main';
const CACHE_DIR = join(tmpdir(), 'aider-desk-sound-notification');
const CONFIG_COMPONENT_ID = 'sound-config';
const BROWSER_COMPONENT_ID = 'sound-remote-panel';

interface PackSound {
  file: string;
  label: string;
  sha256: string;
}

interface SoundPack {
  name: string;
  displayName: string;
  sounds: PackSound[];
}

/** Entry from the GitHub contents API listing the packs repository root. */
interface GitHubContentsEntry {
  name: string;
  type: string;
}

/** Sound entry inside an openpeon.json pack manifest. */
interface OpenPeonSound {
  file: string;
  label: string;
  sha256: string;
}

/** Category inside an openpeon.json pack manifest. */
interface OpenPeonCategory {
  sounds?: OpenPeonSound[];
}

/** openpeon.json pack manifest of a sound pack. */
interface OpenPeonManifest {
  display_name?: string;
  categories?: Record<string, OpenPeonCategory>;
}

/**
 * Runtime guard for upstream manifest sound entries: fetchJson only decodes JSON,
 * so a malformed or upstream-changed openpeon.json entry must be rejected before
 * it ends up as an unusable pack sound (missing file/label/sha256 breaks playback).
 */
function isValidPackSound(value: unknown): value is PackSound {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const s = value as Record<string, unknown>;
  return (
    typeof s.file === 'string' && s.file.length > 0 &&
    typeof s.label === 'string' && s.label.length > 0 &&
    typeof s.sha256 === 'string' && s.sha256.length > 0
  );
}

interface SoundConfig {
  pack: string;
  sound: string;
}

/**
 * Where notification sounds are delivered:
 * - 'local': OS player on the AiderDesk host (desktop app users) — original behavior
 * - 'browser': synthesized Web Audio chimes in open remote browser tabs
 * - 'both': local playback plus browser-tab playback
 */
type DeliveryMode = 'local' | 'browser' | 'both';

/** Sound presets synthesized in the browser via Web Audio oscillators ('none' = silent). */
type BrowserSoundPreset = 'bell' | 'ding' | 'chime' | 'soft' | 'none';

interface BrowserSoundsConfig {
  /** Master browser chime volume, 0.0 - 1.0 */
  volume: number;
  /** Per-notification-kind enable toggles for browser playback */
  kinds: Record<NotificationKind, boolean>;
  /** Per-notification-kind synthesized sound mapping */
  presets: Record<NotificationKind, BrowserSoundPreset>;
}

interface ExtensionConfig {
  agentFinished: SoundConfig;
  questionAsked: SoundConfig;
  delivery: DeliveryMode;
  browser: BrowserSoundsConfig;
}

const DEFAULT_BROWSER_CONFIG: BrowserSoundsConfig = {
  volume: 0.5,
  kinds: { 'task-finished': true, 'input-needed': true, generic: false },
  presets: { 'task-finished': 'bell', 'input-needed': 'ding', generic: 'chime' },
};

const DEFAULT_CONFIG: ExtensionConfig = {
  agentFinished: { pack: 'peasant', sound: 'PeasantJobDone' },
  questionAsked: { pack: 'peasant', sound: '' },
  delivery: 'local',
  browser: DEFAULT_BROWSER_CONFIG,
};

const isNotificationKind = (value: string): value is NotificationKind => value === 'task-finished' || value === 'input-needed' || value === 'generic';

const isBrowserSoundPreset = (value: string): value is BrowserSoundPreset => value === 'bell' || value === 'ding' || value === 'chime' || value === 'soft' || value === 'none';

/** Deep-merges stored config over defaults so configs predating Phase 2 pick up the new keys. */
function normalizeConfig(stored: Partial<ExtensionConfig> | null | undefined): ExtensionConfig {
  const browser = (stored?.browser ?? {}) as Partial<BrowserSoundsConfig>;
  const kinds: Partial<Record<NotificationKind, boolean>> = {};
  const presets: Partial<Record<NotificationKind, BrowserSoundPreset>> = {};

  if (browser.kinds) {
    for (const [kind, enabled] of Object.entries(browser.kinds)) {
      if (typeof enabled === 'boolean' && isNotificationKind(kind)) kinds[kind] = enabled;
    }
  }
  if (browser.presets) {
    for (const [kind, preset] of Object.entries(browser.presets)) {
      if (typeof preset === 'string' && isNotificationKind(kind) && isBrowserSoundPreset(preset)) presets[kind] = preset;
    }
  }

  const delivery = stored?.delivery === 'browser' || stored?.delivery === 'both' || stored?.delivery === 'local' ? stored.delivery : DEFAULT_CONFIG.delivery;

  return {
    ...DEFAULT_CONFIG,
    ...(stored ?? {}),
    delivery,
    browser: {
      ...DEFAULT_BROWSER_CONFIG,
      ...browser,
      volume: typeof browser.volume === 'number' && browser.volume >= 0 && browser.volume <= 1 ? browser.volume : DEFAULT_BROWSER_CONFIG.volume,
      kinds: { ...DEFAULT_BROWSER_CONFIG.kinds, ...kinds },
      presets: { ...DEFAULT_BROWSER_CONFIG.presets, ...presets },
    },
  } as ExtensionConfig;
}

const configComponentJsx = readFileSync(join(__dirname, 'ConfigComponent.jsx'), 'utf-8');
const browserPanelJsx = readFileSync(join(__dirname, 'SoundRemotePanel.jsx'), 'utf-8');
const bundledPacks: SoundPack[] = JSON.parse(readFileSync(join(__dirname, 'packs.json'), 'utf-8'));

export default class SoundNotificationExtension implements Extension {
  static metadata = {
    name: 'Sound Notification',
    version: '2.2.0',
    description: 'Plays sound notifications using packs from og-packs locally and synthesized chimes in remote browser tabs',
    iconUrl: 'https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/extensions/extensions/sound-notification/icon.png',
    capabilities: ['notifications'],
  };

  private configPath: string;
  private readonly browserQueue = new BrowserNotificationQueue();
  /**
   * Monotonic nonce stamped onto every getUIExtensionData payload (HIGH-1).
   * The renderer's extension UI store caches fetched data by JSON equality:
   * when a refresh returns an identical snapshot (e.g. notifications were
   * queued while the consumer tab could not play, then the user enables
   * sounds and requests a re-offer), the payload without a nonce would be
   * considered unchanged and the playback effect would never re-run. The
   * nonce makes every refresh payload unique, so any refresh — including the
   * 'request-refresh' re-offers — reaches the already-mounted panel.
   */
  private refreshNonce = 0;

  constructor() {
    this.configPath = join(__dirname, 'config.json');
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    // No main-process Electron gating here: the desktop renderer suppresses
    // the browser panel itself via the panel's isElectron guard (it renders
    // nothing and plays no chimes), while remote browser tabs keep getting
    // the panel even when the AiderDesk host runs inside Electron. Gating in
    // getUIComponents used to silently disable browser playback for browser
    // clients of a desktop install (LOW-1, phase-2 follow-up).
    if (!existsSync(CACHE_DIR)) {
      mkdirSync(CACHE_DIR, { recursive: true });
    }
    context.log('Sound notification extension loaded', 'info');
  }

  getConfigComponent(): string {
    return configComponentJsx;
  }

  async getConfigData(): Promise<unknown> {
    const config = this.loadConfigSync();
    return { ...config, packs: bundledPacks };
  }

  async saveConfigData(configData: unknown, context?: ExtensionContext): Promise<unknown> {
    const data = configData as Partial<ExtensionConfig> & { packs?: SoundPack[] };
    const { packs: _, ...userConfig } = data;
    const merged = normalizeConfig(userConfig);
    writeFileSync(this.configPath, JSON.stringify(merged, null, 2), 'utf-8');

    // Push updated browser sound settings (volume/presets) to any mounted panels,
    // and reload the UI components since the panel set depends on delivery mode
    // ('local' registers no panel; 'browser'/'both' do).
    context?.triggerUIComponentsReload();
    context?.triggerUIDataRefresh(BROWSER_COMPONENT_ID);

    // Eagerly download selected WAVs
    await this.downloadSoundIfNeeded(merged.agentFinished);
    await this.downloadSoundIfNeeded(merged.questionAsked);

    return merged;
  }

  async executeUIExtensionAction(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown> {
    if (componentId === BROWSER_COMPONENT_ID) {
      // Atomic playback claim (MED-2): the panel asks to claim the snapshot's
      // deliveries before playing. Claims are assigned inside this
      // single-threaded main process, so of N concurrent consumers exactly one
      // wins each delivery — the others must not play or acknowledge it.
      if (action === 'acquire-claims') {
        const [consumerId, deliveryIds] = (args ?? []) as [string, string[]];
        if (typeof consumerId === 'string' && consumerId.length > 0 && Array.isArray(deliveryIds) && deliveryIds.length > 0) {
          const claimed = this.browserQueue.acquireClaims(consumerId, deliveryIds);
          context.log(`Consumer '${consumerId}' claimed ${claimed.length}/${deliveryIds.length} browser notification(s) for playback`, 'debug');
          return { claimed };
        }
        return { claimed: [] };
      }

      // Re-offer queued notifications (MED-1): called by the panel after it
      // becomes able to play (user armed sounds / tab turned visible) so the
      // playback effect re-runs with the still-queued snapshot.
      if (action === 'request-refresh') {
        context.triggerUIDataRefresh(BROWSER_COMPONENT_ID);
        return { refreshed: true };
      }

      // Acknowledgement from the panel after successful playback: entries are
      // only removed from the non-destructive queue once a consumer confirms
      // they were actually played (see BrowserNotificationQueue). The panel
      // also sends its consumer id (the same tab id it claimed the deliveries
      // with) so an entry still claimed by a DIFFERENT consumer is never
      // dropped by an unrelated acker — the legitimate claimant would
      // otherwise silently lose its notification. The wire shape stays
      // backward-compatible: legacy panels send a single [deliveryIds] array
      // and fall back to the unconditional removal.
      if (action === 'acknowledge-played') {
        const [deliveryIds, consumerId] = (args ?? []) as [string[], string | undefined];
        if (Array.isArray(deliveryIds) && deliveryIds.length > 0) {
          const ackingConsumerId = typeof consumerId === 'string' && consumerId.length > 0 ? consumerId : undefined;
          const removed = this.browserQueue.acknowledge(deliveryIds, ackingConsumerId);
          if (removed < deliveryIds.length) {
            context.log(`Acknowledged ${removed}/${deliveryIds.length} browser notification(s) as played (rest still claimed by another consumer)`, 'debug');
          } else {
            context.log(`Acknowledged ${removed} browser notification(s) as played`, 'debug');
          }
        }
        return { acknowledged: true };
      }
      return undefined;
    }

    // Sibling extensions dispatch by literal component id (there is no
    // `extensionId` field on the Extension contract), so match the folder id
    // declared in extensions.json instead of a (non-existent) instance field.
    if (componentId !== CONFIG_COMPONENT_ID && componentId !== 'config' && componentId !== 'sound-notification') {
      return undefined;
    }

    if (action === 'play-sound') {
      const [packName, soundName] = args as [string, string];
      await this.playSound(packName, soundName, context);
      return { success: true };
    }

    if (action === 'refresh-packs') {
      return await this.refreshPacks(context);
    }

    return undefined;
  }

  getUIComponents(_context: ExtensionContext): UIComponentDefinition[] {
    // Only mount the remote-sounds panel when browser playback is enabled.
    // With 'local' delivery (the default) there is nothing for the panel to do,
    // and mounting it would only add needless consumers to the browser delivery path.
    const config = this.loadConfigSync();
    if (config.delivery === 'local') {
      return [];
    }

    // The panel lives in the global 'app-floating' placement: that mount is
    // always present in the main window (regardless of which project — or no
    // project at all — is active), so refreshes triggered from a background
    // project's onNotification context reach it (the renderer wrapper only
    // filters project-stamped refreshes for project-scoped mounts). A
    // 'project-floating' panel would only be mounted in the active project's
    // view and would miss notifications from background projects (phase-2 fix).
    // The desktop Electron renderer suppresses this panel itself via its
    // isElectron guard, so registration must not depend on the main process
    // being Electron.
    return [
      {
        id: BROWSER_COMPONENT_ID,
        placement: 'app-floating',
        name: 'Remote Sounds',
        jsx: browserPanelJsx,
        loadData: true,
      },
    ];
  }

  async getUIExtensionData(componentId: string, context: ExtensionContext): Promise<unknown> {
    if (componentId !== BROWSER_COMPONENT_ID) {
      return undefined;
    }

    // Non-destructive snapshot: entries stay queued until the panel confirms
    // playback via the 'acknowledge-played' UI action, so a consumer that
    // cannot play (hidden tab / not primary / audio locked) never steals a
    // notification from the tab that can.
    const pending = this.browserQueue.snapshot();
    if (pending.length > 0) {
      context.log(`${pending.length} queued notification(s) offered to browser UI`, 'debug');
    }

    const config = await this.loadConfigSync();
    return {
      pending,
      sounds: {
        volume: config.browser.volume,
        presets: { ...config.browser.presets },
      },
      // HIGH-1: every payload carries a fresh nonce so the renderer's
      // JSON-equality data cache always treats a refresh as changed and the
      // mounted panel's playback effect re-runs — even for an identical
      // snapshot (e.g. re-offering queued notifications after the user armed
      // sounds or the tab became visible again, and after returning to the
      // tab while notifications were queued in the background).
      refreshNonce: ++this.refreshNonce,
    };
  }

  async onNotification(event: NotificationEvent, context: ExtensionContext): Promise<void | Partial<NotificationEvent>> {
    const config = await this.loadConfigSync();

    if (config.delivery === 'local') {
      return undefined;
    }

    // Respect another extension's decision to suppress default notification delivery.
    if (event.blocked) {
      context.log('Notification delivery was blocked; skipping remote browser sound', 'debug');
      return undefined;
    }

    const kind: NotificationKind = event.notification.kind ?? 'generic';
    // Gate on the configured toggle for KNOWN kinds; an UNKNOWN non-empty kind
    // (e.g. 'deploy-done') is not represented in config.browser.kinds, so it
    // would otherwise always be dropped. Route those through the 'generic'
    // toggle (the DEFAULT_BROWSER_CONFIG catch-all) while keeping the
    // normalized kind for downstream queue/preset lookup.
    const kindEnabled = isNotificationKind(kind) ? config.browser.kinds[kind] : config.browser.kinds.generic;
    if (!kindEnabled) {
      return undefined;
    }

    const queued = this.browserQueue.enqueue(event.notification);
    if (!queued) {
      return undefined;
    }

    context.log(`Queued '${queued.kind}' notification (${queued.id || 'no id'}) for browser playback`, 'debug');
    context.triggerUIDataRefresh(BROWSER_COMPONENT_ID);
    return undefined;
  }

  async onPromptFinished(_event: PromptFinishedEvent, context: ExtensionContext): Promise<void> {
    const config = await this.loadConfig();
    if (config.delivery === 'browser') {
      context.log('Local playback skipped (delivery mode = browser)', 'debug');
      return;
    }
    try {
      await this.playEventSound(config.agentFinished, context);
    } catch (error) {
      context.log(`Failed to play agent finished sound: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  async onQuestionAsked(event: QuestionAskedEvent, context: ExtensionContext): Promise<void> {
    if (event.storedAnswer) {
      return;
    }

    const config = await this.loadConfig();
    if (config.delivery === 'browser') {
      context.log('Local playback skipped (delivery mode = browser)', 'debug');
      return;
    }
    try {
      await this.playEventSound(config.questionAsked, context);
    } catch (error) {
      context.log(`Failed to play question asked sound: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  }

  private loadConfigSync(): ExtensionConfig {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8');
        return normalizeConfig(JSON.parse(data));
      }
    } catch {
      // Ignore
    }
    return { ...DEFAULT_CONFIG, browser: { ...DEFAULT_BROWSER_CONFIG } };
  }

  private async loadConfig(): Promise<ExtensionConfig> {
    return this.loadConfigSync();
  }

  private async playEventSound(soundConfig: SoundConfig, context: ExtensionContext): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === soundConfig.pack);
    if (!pack) {
      context.log(`Sound pack "${soundConfig.pack}" not found`, 'warn');
      return;
    }

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundConfig.sound;
    });

    if (!soundEntry) {
      context.log(`Sound "${soundConfig.sound}" not found in pack "${soundConfig.pack}"`, 'warn');
      return;
    }

    const soundFile = soundEntry.file;
    const extension = soundFile.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, soundConfig.pack, `${soundConfig.sound}.${extension}`);

    if (!existsSync(cachePath)) {
      await this.downloadSound(soundConfig.pack, soundFile, cachePath, context);
    }

    await this.playAudioFile(cachePath, context);
  }

  private async downloadSoundIfNeeded(soundConfig: SoundConfig): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === soundConfig.pack);
    if (!pack) return;

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundConfig.sound;
    });
    if (!soundEntry) return;

    const extension = soundEntry.file.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, soundConfig.pack, `${soundConfig.sound}.${extension}`);

    if (!existsSync(cachePath)) {
      const packDir = join(CACHE_DIR, soundConfig.pack);
      if (!existsSync(packDir)) {
        mkdirSync(packDir, { recursive: true });
      }
      await this.downloadFile(
        `${PACKS_URL}/${soundConfig.pack}/${soundEntry.file}`,
        cachePath,
      );
    }
  }

  private async downloadSound(packName: string, soundFile: string, cachePath: string, context: ExtensionContext): Promise<void> {
    const packDir = join(CACHE_DIR, packName);
    if (!existsSync(packDir)) {
      mkdirSync(packDir, { recursive: true });
    }

    const url = `${PACKS_URL}/${packName}/${soundFile}`;
    context.log(`Downloading sound: ${url}`, 'debug');
    await this.downloadFile(url, cachePath);
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destPath);
      const request = https.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            https
              .get(redirectUrl, (redirectResponse) => {
                redirectResponse.pipe(file);
                file.on('finish', () => {
                  file.close();
                  resolve();
                });
              })
              .on('error', reject);
            return;
          }
        }

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  private async playSound(packName: string, soundName: string, context: ExtensionContext): Promise<void> {
    const pack = bundledPacks.find((p) => p.name === packName);
    if (!pack) {
      context.log(`Sound pack "${packName}" not found`, 'warn');
      return;
    }

    const soundEntry = pack.sounds.find((s) => {
      const fileName = s.file.split('/').pop();
      return fileName?.replace(/\.(wav|mp3)$/, '') === soundName;
    });

    if (!soundEntry) {
      context.log(`Sound "${soundName}" not found in pack "${packName}"`, 'warn');
      return;
    }

    const extension = soundEntry.file.split('.').pop() || 'wav';
    const cachePath = join(CACHE_DIR, packName, `${soundName}.${extension}`);

    if (!existsSync(cachePath)) {
      await this.downloadSound(packName, soundEntry.file, cachePath, context);
    }

    await this.playAudioFile(cachePath, context);
  }

  private async playAudioFile(filePath: string, context: ExtensionContext): Promise<void> {
    const platform = process.platform;
    let command: string;

    switch (platform) {
      case 'darwin':
        command = `afplay "${filePath}"`;
        break;
      case 'win32':
        command = `powershell -c "Add-Type -AssemblyName presentationCore; $player = New-Object System.Windows.Media.MediaPlayer; $player.Open('${filePath.replace(/\\/g, '\\\\')}'); $player.Play(); Start-Sleep -Seconds 3"`;
        break;
      case 'linux':
        command = `paplay "${filePath}" 2>/dev/null || mpg123 --quiet "${filePath}" 2>/dev/null || mpv --no-video --really-quiet "${filePath}" 2>/dev/null || ffplay -nodisp -autoexit -loglevel quiet "${filePath}" 2>/dev/null`;
        break;
      default:
        context.log(`Unsupported platform: ${platform}`, 'warn');
        return;
    }

    try {
      await execAsync(command, { timeout: 10000 });
      context.log('Sound played successfully', 'debug');
    } catch {
      if (platform === 'linux') {
        try {
          await execAsync(`aplay "${filePath}" 2>/dev/null`, { timeout: 10000 });
          return;
        } catch {
          // All players failed
        }
        context.log('Failed to play sound: no audio player available', 'warn');
      } else {
        context.log('Failed to play sound', 'warn');
      }
    }
  }

  private async refreshPacks(context: ExtensionContext): Promise<SoundPack[]> {
    context.log('Refreshing sound packs from GitHub...', 'info');

    try {
      const contentsUrl = 'https://api.github.com/repos/PeonPing/og-packs/contents';
      const response = await this.fetchJson<GitHubContentsEntry[]>(contentsUrl);

      if (!Array.isArray(response)) {
        throw new Error('Unexpected API response');
      }

      const dirs = response.filter((item) => {
        // Guard before dereferencing: a non-object entry in the contents
        // listing must be skipped, not crash the whole refresh.
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          return false;
        }
        return item.type === 'dir' && item.name !== '.github';
      });
      const newPacks: SoundPack[] = [];

      for (const dir of dirs) {
        const packName = dir.name;
        try {
          const openpeonUrl = `${PACKS_URL}/${packName}/openpeon.json`;
          const data = await this.fetchJson<OpenPeonManifest>(openpeonUrl);

          // A valid-JSON manifest whose root is not a plain object (array,
          // string, number, ...) carries no categories; failing here marks the
          // pack as failed so it is skipped instead of persisting an empty
          // pack that would silently replace the bundled catalog.
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Malformed manifest root');
          }

          const seen = new Set<string>();
          const sounds: PackSound[] = [];

          if (data.categories && typeof data.categories === 'object') {
            for (const cat of Object.values(data.categories)) {
              for (const entry of cat.sounds ?? []) {
                if (!isValidPackSound(entry)) {
                  context.log(`Skipping malformed sound entry in pack: ${packName}`, 'warn');
                  continue;
                }
                if (!seen.has(entry.file)) {
                  seen.add(entry.file);
                  sounds.push({ file: entry.file, label: entry.label, sha256: entry.sha256 });
                }
              }
            }
          }

          newPacks.push({
            name: packName,
            displayName: data.display_name || packName,
            sounds,
          });
        } catch {
          context.log(`Failed to fetch pack: ${packName}`, 'warn');
        }
      }

      // Degenerate refresh: an empty catalog (empty repo contents listing, or
      // every per-pack manifest fetch failed) must NOT be persisted nor
      // replace the bundled catalog — doing so would permanently disable
      // sound playback (no packs, no sounds) until the next successful
      // refresh. Keep the previous catalog and report the failure instead.
      if (newPacks.length === 0) {
        context.log('Pack refresh produced an empty catalog; keeping the previous pack catalog', 'error');
        return bundledPacks;
      }

      writeFileSync(join(__dirname, 'packs.json'), JSON.stringify(newPacks, null, 2), 'utf-8');

      // Update bundled packs
      bundledPacks.length = 0;
      bundledPacks.push(...newPacks);

      context.log(`Refreshed ${newPacks.length} packs from GitHub`, 'info');
      return newPacks;
    } catch (error) {
      context.log(`Failed to refresh packs: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return bundledPacks;
    }
  }

  private fetchJson<T = unknown>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      https.get(url, { headers: { 'User-Agent': 'AiderDesk' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }
}

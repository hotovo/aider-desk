import path from 'path';

import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';

import type { SettingsData } from '@common/types';
import type { Store } from '@/store';

import { shouldUsePolling } from '@/utils/file-watch';
import logger from '@/logger';

export type FileWatchOptions = {
  ignored?: (string | RegExp)[] | ((matchingPath: string) => boolean);
  debounceMs?: number;
};

export interface WatchHandle {
  unwatch: () => void;
}

type WatcherEntry = {
  dir: string;
  options: FileWatchOptions;
  watcher: FSWatcher;
  handles: Set<() => Promise<void>>;
  notify: (() => void) & { cancel: () => void };
};

const DEFAULT_DEBOUNCE_MS = 300;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const tryCatchAsync = async (fn: () => void | Promise<void>, context: string) => {
  try {
    await fn();
  } catch (error) {
    logger.error(`File watch handler failed (${context})`, { error: getErrorMessage(error) });
  }
};

export class FileWatcherManager {
  private entries = new Map<string, WatcherEntry>();

  constructor(private readonly store: Store) {}

  /**
   * Starts watching `dir` (one shared chokidar watcher per dir + options combination,
   * handles are ref-counted) and returns a handle that must be released with `unwatch()`.
   * The debounced `onChange` is invoked for file changes (add/change/unlink).
   */
  watch(dir: string, onChange: () => void | Promise<void>, options: FileWatchOptions = {}): WatchHandle {
    const resolvedDir = path.resolve(dir);
    const handler = () => tryCatchAsync(onChange, `watch '${resolvedDir}'`);
    const getKey = () => this.getWatchKey(resolvedDir, options);
    let entry = this.entries.get(getKey());

    if (!entry) {
      entry = this.createEntry(resolvedDir, options);
      this.entries.set(getKey(), entry);
    }

    const handle: WatchHandle = {
      unwatch: () => {
        const currentEntry = this.entries.get(getKey());
        if (!currentEntry || !currentEntry.handles.delete(handler)) {
          return;
        }
        if (currentEntry.handles.size === 0) {
          void this.closeEntry(currentEntry);
        }
      },
    };

    entry.handles.add(handler);
    return handle;
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData): Promise<void> {
    if (oldSettings.fileWatchMode === newSettings.fileWatchMode) {
      return;
    }

    // Restart all active watchers so polling/native mode is re-evaluated for each watched path
    const entries = Array.from(this.entries.values());
    this.entries.clear();

    await Promise.all(
      entries.map(async (entry) => {
        const handlers = Array.from(entry.handles);
        await this.closeWatcher(entry);

        const newEntry = this.createEntry(entry.dir, entry.options);
        handlers.forEach((handler) => newEntry.handles.add(handler));
        this.entries.set(this.getWatchKey(entry.dir, entry.options), newEntry);
      }),
    );
  }

  async dispose(): Promise<void> {
    const entries = Array.from(this.entries.values());
    this.entries.clear();
    await Promise.all(entries.map((entry) => this.closeWatcher(entry)));
  }

  private getWatchKey(dir: string, options: FileWatchOptions): string {
    const { debounceMs, ignored } = options;
    const serializableIgnored = Array.isArray(ignored) || typeof ignored === 'undefined' ? JSON.stringify(ignored ?? null) : null;
    // non-serializable (function) ignored cannot be merged into a shared watcher
    return serializableIgnored ? `${dir}|${debounceMs ?? DEFAULT_DEBOUNCE_MS}|${serializableIgnored}` : `${dir}|${Date.now()}|${Math.random()}`;
  }

  private createEntry(dir: string, options: FileWatchOptions): WatcherEntry {
    const entry: WatcherEntry = {
      dir,
      options,
      handles: new Set(),
      watcher: null as unknown as FSWatcher,
      notify: null as unknown as WatcherEntry['notify'],
    };

    entry.notify = debounce(() => {
      entry.handles.forEach((handler) => void tryCatchAsync(handler, `watch '${entry.dir}'`));
    }, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);

    entry.watcher = watch(dir, {
      persistent: true,
      ignoreInitial: true,
      usePolling: shouldUsePolling(dir, this.store.getSettings().fileWatchMode),
      ...(options.ignored ? { ignored: options.ignored } : {}),
    });

    entry.watcher.on('add', () => entry.notify());
    entry.watcher.on('change', () => entry.notify());
    entry.watcher.on('unlink', () => entry.notify());
    entry.watcher.on('error', (error) => logger.error('File watcher error', { dir: entry.dir, error: getErrorMessage(error) }));

    return entry;
  }

  private async closeEntry(entry: WatcherEntry): Promise<void> {
    let found = false;
    for (const value of this.entries.values()) {
      if (value === entry) {
        found = true;
        break;
      }
    }
    if (!found) {
      return;
    }
    this.deleteEntry(entry);
    entry.notify.cancel();
    await this.closeWatcher(entry);
  }

  private deleteEntry(entry: WatcherEntry): void {
    for (const [key, value] of this.entries) {
      if (value === entry) {
        this.entries.delete(key);
        return;
      }
    }
  }

  private async closeWatcher(entry: WatcherEntry): Promise<void> {
    try {
      await entry.watcher.close();
    } catch (error) {
      logger.warn('Failed to close file watcher', { dir: entry.dir, error: getErrorMessage(error) });
    }
  }
}

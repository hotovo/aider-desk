import fs from 'fs/promises';
import path from 'path';

import { FSWatcher, watch } from 'chokidar';
import debounce from 'lodash/debounce';
import { simpleGit } from 'simple-git';

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
  watcher: FSWatcher | null;
  handles: Set<() => Promise<void>>;
  notify: (() => void) & { cancel: () => void };
  loggedEnospc?: boolean;
};

const DEFAULT_DEBOUNCE_MS = 300;

// Heavy directories excluded from watching by default
export const DEFAULT_IGNORED_DIRS = ['.git', 'node_modules', 'out', 'dist', 'coverage', '.aider-desk'];

const MAX_WATCHED_ENTRIES = 20_000;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const tryCatchAsync = async (fn: () => void | Promise<void>, context: string) => {
  try {
    await fn();
  } catch (error) {
    logger.error(`File watch handler failed (${context})`, { error: getErrorMessage(error) });
  }
};

/**
 * Lists paths ignored by git rules (collapsed to top-level entries), e.g. `out/`, `.aider-desk/tmp/`.
 * Returns paths relative to `dir` (dirs end with `/`), or an empty list for non-git dirs / failures.
 */
const getGitIgnoredEntries = async (dir: string): Promise<string[]> => {
  try {
    const result = await simpleGit(dir).raw(['ls-files', '-o', '-i', '--exclude-standard', '--directory', '--no-empty-directory', '-z']);
    const entries = result
      .split('\0')
      .filter(Boolean)
      .map((entry) => entry.replace(/\\/g, '/').replace(/\/+$/, ''));
    return entries;
  } catch (error) {
    logger.debug('Failed to list gitignored paths for file watching, using defaults only', { dir, error: getErrorMessage(error) });
    return [];
  }
};

const countWatchedEntries = async (dir: string, isIgnored: (watcherPath: string) => boolean, isCancelled: () => boolean): Promise<number> => {
  let count = 1;
  const queue: string[] = [dir];

  while (queue.length > 0 && !isCancelled()) {
    const current = queue.pop() as string;
    let directory;
    try {
      directory = await fs.opendir(current);
    } catch {
      continue;
    }

    for await (const child of directory) {
      if (isCancelled()) {
        return count;
      }
      const childPath = path.join(current, child.name);
      if (isIgnored(childPath)) {
        continue;
      }
      count++;
      if (count > MAX_WATCHED_ENTRIES) {
        return count;
      }
      if (child.isDirectory()) {
        queue.push(childPath);
      }
    }
  }

  return count;
};

export class FileWatcherManager {
  private entries = new Map<string, WatcherEntry>();
  private setupLocks = new Map<string, Promise<void>>();
  private generation = 0;
  private nextFunctionKey = 0;

  constructor(private readonly store: Store) {}

  /**
   * Starts watching `dir` (one shared chokidar watcher per dir + options combination,
   * handles are ref-counted) and returns a handle that must be released with `unwatch()`.
   * The debounced `onChange` is invoked for file changes (add/change/unlink).
   *
   * Watching is skipped (no-op handle) when the directory tree is too large to watch safely.
   */
  async watch(dir: string, onChange: () => void | Promise<void>, options: FileWatchOptions = {}): Promise<WatchHandle> {
    const resolvedDir = path.resolve(dir);
    const handler = () => tryCatchAsync(onChange, `watch '${resolvedDir}'`);
    const key = this.getWatchKey(resolvedDir, options);
    const generation = this.generation;
    const isCancelled = () => generation !== this.generation;
    const previousSetup = this.setupLocks.get(key);
    let release!: () => void;
    const setup = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.setupLocks.set(key, setup);

    try {
      await previousSetup;
      if (isCancelled()) {
        return { unwatch: () => undefined };
      }
      let entry = this.entries.get(key);
      if (!entry) {
        const gitIgnoredEntries = await getGitIgnoredEntries(resolvedDir);
        if (isCancelled()) {
          return { unwatch: () => undefined };
        }
        const ignoredForWatcher = this.createIgnoredList(resolvedDir, gitIgnoredEntries, options.ignored);
        const entryCount = await countWatchedEntries(resolvedDir, ignoredForWatcher[0], isCancelled);
        if (isCancelled()) {
          return { unwatch: () => undefined };
        }
        if (entryCount > MAX_WATCHED_ENTRIES) {
          logger.warn('File watching skipped: directory tree exceeds watcher limit, changes will be refreshed on demand only', {
            dir: resolvedDir,
            entryCount,
            limit: MAX_WATCHED_ENTRIES,
          });
          return { unwatch: () => undefined };
        }

        entry = this.createEntry(resolvedDir, options, ignoredForWatcher);
        this.entries.set(key, entry);
      }

      const subscribedEntry = entry;
      entry.handles.add(handler);
      return {
        unwatch: () => {
          if (!subscribedEntry.handles.delete(handler)) {
            return;
          }
          if (subscribedEntry.handles.size === 0) {
            void this.closeEntry(subscribedEntry);
          }
        },
      };
    } finally {
      release();
      if (this.setupLocks.get(key) === setup) {
        this.setupLocks.delete(key);
      }
    }
  }

  async dispose(): Promise<void> {
    this.generation++;
    const entries = Array.from(this.entries.values());
    this.entries.clear();
    await Promise.all(entries.map((entry) => this.closeWatcher(entry)));
  }

  private createIgnoredList(dir: string, gitIgnoredEntries: string[], userIgnored?: FileWatchOptions['ignored']): ((watcherPath: string) => boolean)[] {
    const gitIgnoredDirs = new Set(gitIgnoredEntries.map((entry) => entry.replace(/\\/g, '/').replace(/\/+$/, '')));
    const ignoredDirs = new Set<string>(DEFAULT_IGNORED_DIRS);

    const matcher = (relativePath: string): boolean => {
      if (!relativePath || relativePath === '.') {
        return false;
      }
      const segments = relativePath.split('/');
      if (segments.some((segment) => ignoredDirs.has(segment))) {
        return true;
      }
      // path itself or one of its ancestors matches a gitignored entry
      for (let i = segments.length; i > 0; i--) {
        const ancestor = segments.slice(0, i).join('/');
        if (gitIgnoredDirs.has(ancestor)) {
          return true;
        }
      }
      return false;
    };

    const userPatterns = Array.isArray(userIgnored) ? userIgnored : userIgnored ? [userIgnored] : [];
    const userMatchers = userPatterns.map((pattern) => {
      if (typeof pattern === 'function') {
        return pattern;
      }
      if (pattern instanceof RegExp) {
        const regex = new RegExp(pattern.source, pattern.flags);
        return (watcherPath: string) => {
          regex.lastIndex = 0;
          return regex.test(watcherPath);
        };
      }
      const ignoredPath = path.resolve(pattern).replace(/\\/g, '/');
      return (watcherPath: string) => watcherPath === ignoredPath || watcherPath.startsWith(`${ignoredPath}/`);
    });

    const matchFn = (watcherPath: string): boolean => {
      const normalizedPath = path.resolve(watcherPath).replace(/\\/g, '/');
      const relativePath = path.relative(dir, watcherPath).replace(/\\/g, '/');
      return matcher(relativePath) || userMatchers.some((matches) => matches(normalizedPath));
    };

    return [matchFn];
  }

  private getWatchKey(dir: string, options: FileWatchOptions): string {
    const { debounceMs, ignored } = options;
    const ignoredKey =
      typeof ignored === 'function'
        ? { functionId: this.nextFunctionKey++ }
        : (ignored?.map((pattern) => (pattern instanceof RegExp ? { source: pattern.source, flags: pattern.flags } : pattern)) ?? null);
    return JSON.stringify([dir, debounceMs ?? DEFAULT_DEBOUNCE_MS, ignoredKey]);
  }

  private createEntry(dir: string, options: FileWatchOptions, ignoredForWatcher: ((watcherPath: string) => boolean)[]): WatcherEntry {
    const entry: WatcherEntry = {
      dir,
      handles: new Set(),
      watcher: null,
      notify: null as unknown as WatcherEntry['notify'],
    };

    entry.notify = debounce(() => {
      entry.handles.forEach((handler) => void tryCatchAsync(handler, `watch '${entry.dir}'`));
    }, options.debounceMs ?? DEFAULT_DEBOUNCE_MS);

    entry.watcher = watch(dir, {
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      usePolling: shouldUsePolling(dir, this.store.getSettings().fileWatchMode),
      ignored: ignoredForWatcher,
    });

    this.bindWatcherEvents(entry);
    return entry;
  }

  private bindWatcherEvents(entry: WatcherEntry) {
    const watcher = entry.watcher;
    if (!watcher) {
      return;
    }

    watcher.on('add', () => entry.notify());
    watcher.on('change', () => entry.notify());
    watcher.on('unlink', () => entry.notify());
    watcher.on('error', (error) => this.handleWatcherError(entry, error));
  }

  private handleWatcherError(entry: WatcherEntry, error: unknown): void {
    const message = getErrorMessage(error);
    if (message.includes('ENOSPC')) {
      // Log once per watcher instead of spamming an error for every unwatchable path
      if (!entry.loggedEnospc) {
        entry.loggedEnospc = true;
        logger.warn(
          'File watcher hit the OS watch limit (ENOSPC); some changes may not be detected. ' +
            'Consider increasing the limit, e.g. `sudo sysctl -w fs.inotify.max_user_watches=524288` (persist in /etc/sysctl.d/)',
          { dir: entry.dir },
        );
      }
      return;
    }
    logger.error('File watcher error', { dir: entry.dir, error: message });
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
    entry.notify.cancel();
    entry.handles.clear();
    if (!entry.watcher) {
      return;
    }
    try {
      await entry.watcher.close();
    } catch (error) {
      logger.warn('Failed to close file watcher', { dir: entry.dir, error: getErrorMessage(error) });
    }
  }
}

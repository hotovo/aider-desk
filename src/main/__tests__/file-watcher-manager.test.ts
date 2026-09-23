import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FileWatcherManager, DEFAULT_IGNORED_DIRS } from '../file-watcher-manager';

const MAX_WATCHED_ENTRIES = 20_000;

import type { Mock } from 'vitest';

vi.mock('chokidar', () => ({
  watch: vi.fn(),
  FSWatcher: vi.fn(),
}));

vi.mock('simple-git', () => ({ simpleGit: vi.fn() }));

vi.mock('fs/promises', () => {
  const opendirFn = vi.fn().mockResolvedValue([]);
  return {
    opendir: opendirFn,
    default: { opendir: opendirFn },
  };
});

vi.mock('@/utils/file-watch', () => ({
  shouldUsePolling: vi.fn().mockReturnValue(false),
}));

vi.mock('@/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createDirectory = (entries: { name: string; isDirectory: () => boolean }[]) =>
  ({
    [Symbol.asyncIterator]: () => entries[Symbol.iterator](),
  }) as unknown as Awaited<ReturnType<typeof import('fs/promises').opendir>>;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const createMockWatcher = () => ({
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
});

const getEventHandler = (watcher: ReturnType<typeof createMockWatcher>, event: string) => {
  const call = watcher.on.mock.calls.find((callCall) => callCall[0] === event);
  return call?.[1] as (...args: unknown[]) => void;
};

describe('FileWatcherManager', () => {
  let manager: FileWatcherManager;
  let watchers: ReturnType<typeof createMockWatcher>[];
  let mockGit: { raw: Mock };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    watchers = [];

    const fsPromises = await import('fs/promises');
    vi.mocked(fsPromises.opendir).mockImplementation(async () => createDirectory([{ isDirectory: () => false, name: 'file.txt' }]));

    mockGit = { raw: vi.fn().mockResolvedValue('') };
    const simpleGit = await import('simple-git');
    (simpleGit.simpleGit as unknown as Mock).mockReturnValue(mockGit);

    const { watch } = await import('chokidar');
    (watch as unknown as Mock).mockImplementation(() => {
      const watcher = createMockWatcher();
      watchers.push(watcher);
      return watcher;
    });

    manager = new FileWatcherManager({ getSettings: () => ({ fileWatchMode: 'auto' }) } as never);
  });

  afterEach(async () => {
    await manager.dispose();
    vi.useRealTimers();
  });

  const flushTimers = async () => {
    await vi.advanceTimersByTimeAsync(400);
  };

  describe('shared watchers and ref counting', () => {
    it('should emit debounced onChange to all handlers of a shared watcher', async () => {
      const onChangeA = vi.fn().mockResolvedValue(undefined);
      const onChangeB = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/test', onChangeA, { ignored: ['.git'] });
      await manager.watch('/dir/test', onChangeB, { ignored: ['.git'] });

      expect(watchers).toHaveLength(1);
      const changeHandler = getEventHandler(watchers[0], 'change');
      expect(changeHandler).toBeDefined();

      changeHandler('/dir/test/file1.ts');
      changeHandler('/dir/test/file2.ts');
      await flushTimers();

      expect(onChangeA).toHaveBeenCalledTimes(1);
      expect(onChangeB).toHaveBeenCalledTimes(1);
    });

    it('should close shared watcher only after last handle is unwatched', async () => {
      const onChange = vi.fn().mockResolvedValue(undefined);
      const handleA = await manager.watch('/dir/test', onChange, { ignored: ['.git'] });
      const handleB = await manager.watch('/dir/test', onChange, { ignored: ['.git'] });

      expect(watchers).toHaveLength(1);

      handleA.unwatch();
      expect(watchers[0].close).not.toHaveBeenCalled();

      handleB.unwatch();
      await flushTimers();
      expect(watchers[0].close).toHaveBeenCalledWith();
    });

    it('should create separate watchers per ignored options', async () => {
      await manager.watch('/dir/test', vi.fn(), { ignored: ['.git'] });
      await manager.watch('/dir/test', vi.fn(), { ignored: ['.git', 'node_modules'] });

      expect(watchers).toHaveLength(2);
    });

    it('should not invoke onChange with non-shared handles', async () => {
      const onChangeA = vi.fn().mockResolvedValue(undefined);
      const onChangeB = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/a', onChangeA);
      await manager.watch('/dir/b', onChangeB);

      getEventHandler(watchers[0], 'change')('/dir/a/x.ts');
      await flushTimers();

      expect(onChangeA).toHaveBeenCalledTimes(1);
      expect(onChangeB).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it.each(['add', 'change', 'unlink'])('should trigger onChange on %s events', async (event) => {
      const onChange = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/test', onChange);

      getEventHandler(watchers[0], event)('/dir/test/a.ts');
      await flushTimers();

      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('ignore handling', () => {
    it('should ignore default heavy directories', async () => {
      const onChange = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/test', onChange);

      const { watch } = await import('chokidar');
      const options = (watch as unknown as Mock).mock.calls[0][1];
      expect(options.ignored).toHaveLength(1);
      const matcher = options.ignored[0];
      expect(matcher('/dir/test/node_modules')).toBe(true);
      expect(options.ignored[0]('/dir/test/.git')).toBe(true);
      expect(options.ignored[0]('/dir/test/out/assets')).toBe(true);
      expect(options.ignored[0]('/dir/test/.aider-desk/tmp')).toBe(true);
      expect(options.ignored[0]('/dir/test/src/index.ts')).toBe(false);
    });

    it('should ignore gitignored entries returned by git', async () => {
      mockGit.raw.mockResolvedValue(['ignored-dir/', 'ignored-file.txt', 'nested/nested-ignored/'].join('\0'));
      const onChange = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/test', onChange);

      const matcher = ((await (await import('chokidar')).watch) as unknown as Mock).mock.calls[0][1].ignored[0];
      expect(matcher('/dir/test/ignored-dir/here')).toBe(true); // ancestor match
      expect(matcher('/dir/test/ignored-file.txt')).toBe(true);
      expect(matcher('/dir/test/ignored-dir')).toBe(true);
      expect(matcher('/dir/test/other/src')).toBe(false);
    });

    it('should merge user-provided patterns with default matcher', async () => {
      await manager.watch('/dir/test', vi.fn(), { ignored: ['/dir/test/custom'] });

      const { watch } = await import('chokidar');
      const options = (watch as unknown as Mock).mock.calls[0][1];
      expect(options.ignored[0]('/dir/test/custom')).toBe(true);
      expect(options.ignored[0]('/dir/test/custom/file.ts')).toBe(true);
      expect(options.ignored[0]('/dir/test/custom-other')).toBe(false);
    });

    it('should export known default ignored dirs', () => {
      expect(DEFAULT_IGNORED_DIRS).toContain('node_modules');
      expect(DEFAULT_IGNORED_DIRS).toContain('.git');
    });
  });

  describe('entry count governor', () => {
    it('should skip watching when directory tree exceeds the limit', async () => {
      const fsPromises = await import('fs/promises');
      // a single readdir result that already exceeds the directory limit
      const dirs = Array.from({ length: MAX_WATCHED_ENTRIES + 10 }, (_, i) => ({ isDirectory: () => true, name: `d${i}` })) as never;
      vi.mocked(fsPromises.opendir).mockImplementation(async () => createDirectory(dirs));

      const onChange = vi.fn().mockResolvedValue(undefined);
      const handle = await manager.watch('/dir/test', onChange);

      expect(handle.unwatch).toBeDefined();
      expect(watchers).toHaveLength(0);
    });

    it('should watch when directory tree is within the limit', async () => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.opendir).mockImplementation(async () => createDirectory([{ isDirectory: () => false, name: 'file.txt' }]));

      const onChange = vi.fn().mockResolvedValue(undefined);
      await manager.watch('/dir/test', onChange);

      expect(watchers).toHaveLength(1);
    });
  });

  it('should close all watchers on dispose', async () => {
    await manager.watch('/dir/a', vi.fn());
    await manager.watch('/dir/b', vi.fn());

    await manager.dispose();

    watchers.forEach((watcher) => expect(watcher.close).toHaveBeenCalledWith());
    expect(watchers).toHaveLength(2);
  });

  it('keeps active watchers unchanged and reads the latest mode when creating a new watcher', async () => {
    const { FileWatchMode } = await import('@common/types');
    const { shouldUsePolling } = await import('@/utils/file-watch');
    const settings = { fileWatchMode: FileWatchMode.Native };
    manager = new FileWatcherManager({ getSettings: () => settings } as never);
    const first = await manager.watch('/dir/test', vi.fn());
    settings.fileWatchMode = FileWatchMode.Polling;
    const second = await manager.watch('/dir/test', vi.fn());
    expect(watchers).toHaveLength(1);
    expect(shouldUsePolling).toHaveBeenCalledTimes(1);
    expect(shouldUsePolling).toHaveBeenLastCalledWith('/dir/test', FileWatchMode.Native);
    first.unwatch();
    second.unwatch();
    await manager.watch('/dir/test', vi.fn());
    expect(shouldUsePolling).toHaveBeenLastCalledWith('/dir/test', FileWatchMode.Polling);
  });

  it('serializes concurrent setup for the same key and releases every subscription', async () => {
    const pendingGit = deferred<string>();
    mockGit.raw.mockReturnValueOnce(pendingGit.promise);
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();
    const first = manager.watch('/dir/test', onChangeA);
    const second = manager.watch('/dir/test', onChangeB);
    await Promise.resolve();
    expect(mockGit.raw).toHaveBeenCalledTimes(1);
    pendingGit.resolve('');
    const handles = await Promise.all([first, second]);
    expect(watchers).toHaveLength(1);
    getEventHandler(watchers[0], 'change')();
    await flushTimers();
    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(1);
    handles[0].unwatch();
    expect(watchers[0].close).not.toHaveBeenCalled();
    handles[1].unwatch();
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
  });

  it('does not block unrelated directories during setup', async () => {
    const pendingGit = deferred<string>();
    mockGit.raw.mockReturnValueOnce(pendingGit.promise);
    const first = manager.watch('/dir/a', vi.fn());
    await manager.watch('/dir/b', vi.fn());
    expect(watchers).toHaveLength(1);
    pendingGit.resolve('');
    await first;
    expect(watchers).toHaveLength(2);
  });

  it('releases the setup lock after a failure', async () => {
    const { watch } = await import('chokidar');
    vi.mocked(watch).mockImplementationOnce(() => {
      throw new Error('setup failed');
    });
    const first = manager.watch('/dir/test', vi.fn());
    const second = manager.watch('/dir/test', vi.fn());
    await expect(first).rejects.toThrow('setup failed');
    const handle = await second;
    expect(watchers).toHaveLength(1);
    handle.unwatch();
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
  });

  it('invalidates active and queued setup on dispose and allows later reuse', async () => {
    const pendingGit = deferred<string>();
    mockGit.raw.mockReturnValueOnce(pendingGit.promise);
    const first = manager.watch('/dir/test', vi.fn());
    const second = manager.watch('/dir/test', vi.fn());
    await Promise.resolve();
    await manager.dispose();
    pendingGit.resolve('');
    const handles = await Promise.all([first, second]);
    handles.forEach((handle) => handle.unwatch());
    expect(watchers).toHaveLength(0);
    await manager.watch('/dir/test', vi.fn());
    expect(watchers).toHaveLength(1);
  });

  it('invalidates setup while directory scanning is pending', async () => {
    const fsPromises = await import('fs/promises');
    const started = deferred<void>();
    const directory = deferred<Awaited<ReturnType<typeof fsPromises.opendir>>>();
    vi.mocked(fsPromises.opendir).mockImplementationOnce(() => {
      started.resolve();
      return directory.promise;
    });
    const pending = manager.watch('/dir/test', vi.fn());
    await started.promise;
    await manager.dispose();
    directory.resolve(createDirectory([{ name: 'file.txt', isDirectory: () => false }]));
    await pending;
    expect(watchers).toHaveLength(0);
  });

  it('cancels pending notifications on dispose', async () => {
    const onChange = vi.fn();
    await manager.watch('/dir/test', onChange);
    getEventHandler(watchers[0], 'change')();
    await manager.dispose();
    await flushTimers();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cancels pending notifications when the last handle is released', async () => {
    const onChange = vi.fn();
    const handle = await manager.watch('/dir/test', onChange);
    getEventHandler(watchers[0], 'change')();
    handle.unwatch();
    handle.unwatch();
    await flushTimers();
    expect(onChange).not.toHaveBeenCalled();
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
  });

  it('releases function-filter watchers with stable handles', async () => {
    const ignored = () => false;
    const first = await manager.watch('/dir/test', vi.fn(), { ignored });
    const second = await manager.watch('/dir/test', vi.fn(), { ignored });
    expect(watchers).toHaveLength(2);
    first.unwatch();
    second.unwatch();
    watchers.forEach((watcher) => expect(watcher.close).toHaveBeenCalledTimes(1));
  });

  it('distinguishes regex sources and flags while sharing equivalent patterns', async () => {
    await manager.watch('/dir/test', vi.fn(), { ignored: [/foo/] });
    await manager.watch('/dir/test', vi.fn(), { ignored: [/bar/] });
    await manager.watch('/dir/test', vi.fn(), { ignored: [/foo/i] });
    await manager.watch('/dir/test', vi.fn(), { ignored: [/foo/] });
    expect(watchers).toHaveLength(3);
  });

  it('does not change handle identity when the supplied options are mutated', async () => {
    const options = { ignored: ['/dir/test/foo'] };
    const handle = await manager.watch('/dir/test', vi.fn(), options);
    options.ignored.push('/dir/test/bar');
    handle.unwatch();
    expect(watchers[0].close).toHaveBeenCalledTimes(1);
  });

  it('counts files and stops incremental iteration immediately at the entry limit', async () => {
    const fsPromises = await import('fs/promises');
    const visited = vi.fn();
    const closed = vi.fn();
    vi.mocked(fsPromises.opendir).mockResolvedValueOnce({
      async *[Symbol.asyncIterator]() {
        try {
          for (let i = 0; i < MAX_WATCHED_ENTRIES + 10; i++) {
            visited();
            yield { name: `file${i}`, isDirectory: () => false };
          }
        } finally {
          closed();
        }
      },
    } as unknown as Awaited<ReturnType<typeof fsPromises.opendir>>);
    await manager.watch('/dir/test', vi.fn());
    expect(watchers).toHaveLength(0);
    expect(visited).toHaveBeenCalledTimes(MAX_WATCHED_ENTRIES);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('allows exactly the entry limit including the root directory', async () => {
    const fsPromises = await import('fs/promises');
    vi.mocked(fsPromises.opendir).mockResolvedValueOnce(
      createDirectory(Array.from({ length: MAX_WATCHED_ENTRIES - 1 }, (_, i) => ({ name: `file${i}`, isDirectory: () => false }))),
    );
    await manager.watch('/dir/test', vi.fn());
    expect(watchers).toHaveLength(1);
  });

  it.each([{ ignored: ['/dir/test/generated'] }, { ignored: [/generated/g] }, { ignored: (watcherPath: string) => watcherPath.endsWith('/generated') }])(
    'applies custom ignores during scanning: $ignored',
    async ({ ignored }) => {
      const fsPromises = await import('fs/promises');
      vi.mocked(fsPromises.opendir).mockResolvedValueOnce(createDirectory([{ name: 'generated', isDirectory: () => true }]));
      await manager.watch('/dir/test', vi.fn(), { ignored });
      expect(fsPromises.opendir).toHaveBeenCalledTimes(1);
      const { watch } = await import('chokidar');
      const matcher = (vi.mocked(watch).mock.calls[0][1]?.ignored as ((path: string) => boolean)[])[0];
      expect(matcher('/dir/test/generated')).toBe(true);
      expect(matcher('/dir/test/generated')).toBe(true);
    },
  );

  it('does not traverse symlinks and disables symlink following in chokidar', async () => {
    const fsPromises = await import('fs/promises');
    vi.mocked(fsPromises.opendir).mockResolvedValueOnce(createDirectory([{ name: 'linked-tree', isDirectory: () => false }]));
    await manager.watch('/dir/test', vi.fn());
    expect(fsPromises.opendir).toHaveBeenCalledTimes(1);
    const { watch } = await import('chokidar');
    expect(vi.mocked(watch).mock.calls[0][1]?.followSymlinks).toBe(false);
  });

  it('should continue invoking remaining handlers after a handler throws', async () => {
    const onChangeA = vi.fn().mockRejectedValue(new Error('boom'));
    const onChangeB = vi.fn().mockResolvedValue(undefined);

    await manager.watch('/dir/test', onChangeA, { ignored: ['.git'] });
    await manager.watch('/dir/test', onChangeB, { ignored: ['.git'] });

    getEventHandler(watchers[0], 'change')('/dir/test/a.ts');
    await flushTimers();

    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(1);
  });

  it('should log a single ENOSPC warning per watcher', async () => {
    await manager.watch('/dir/test', vi.fn());
    const logger = await import('@/logger');
    const error = new Error('ENOSPC: System limit for number of file watchers reached');

    const errorEventHandler = getEventHandler(watchers[0], 'error');
    errorEventHandler(error);
    errorEventHandler(error);
    errorEventHandler(error);

    expect(vi.mocked(logger.default.warn).mock.calls.filter((logCall) => String(logCall[0]).includes('ENOSPC'))).toHaveLength(1);
  });
});

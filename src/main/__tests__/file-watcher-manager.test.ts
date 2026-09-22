import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { FileWatcherManager } from '../file-watcher-manager';

import type { Mock } from 'vitest';

vi.mock('chokidar', () => ({
  watch: vi.fn(),
  FSWatcher: vi.fn(),
}));

vi.mock('@/utils/file-watch', async () => {
  await vi.importActual<string>('@common/types');
  return {
    shouldUsePolling: vi.fn().mockReturnValue(false),
  };
});

vi.mock('@/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createMockWatcher = () => ({
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
});

const getEventHandler = (watcher: ReturnType<typeof createMockWatcher>, event: string) => {
  const call = watcher.on.mock.calls.find((callCall) => callCall[0] === event);
  return call?.[1] as (path: string) => void;
};

describe('FileWatcherManager', () => {
  let manager: FileWatcherManager;
  let watchers: ReturnType<typeof createMockWatcher>[];

  beforeEach(async () => {
    vi.useFakeTimers();
    watchers = [];
    const mockStore = { getSettings: vi.fn().mockReturnValue({ fileWatchMode: 'auto' }) };
    const { watch } = await import('chokidar');
    (watch as Mock).mockImplementation(() => {
      const watcher = createMockWatcher();
      watchers.push(watcher);
      return watcher;
    });
    manager = new FileWatcherManager(mockStore as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should emit debounced onChange for shared watchers', async () => {
    const onChangeA = vi.fn().mockResolvedValue(undefined);
    const onChangeB = vi.fn().mockResolvedValue(undefined);
    manager.watch('/dir', onChangeA, { ignored: ['.git'] });
    manager.watch('/dir', onChangeB, { ignored: ['.git'] });

    const changeHandler = getEventHandler(watchers[0], 'change');
    expect(changeHandler).toBeDefined();

    changeHandler('/dir/file1.ts');
    changeHandler('/dir/file2.ts');
    await vi.advanceTimersByTimeAsync(400);

    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(1);
  });

  it('should close shared watcher only after last handle is unwatched', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const handleA = manager.watch('/dir/test', onChange, { ignored: ['.git'] });
    const handleB = manager.watch('/dir/test', onChange, { ignored: ['.git'] });

    expect(watchers).toHaveLength(1);

    handleA.unwatch();
    expect(watchers[0].close).not.toHaveBeenCalled();

    handleB.unwatch();
    await vi.advanceTimersByTimeAsync(0);
    expect(watchers[0].close).toHaveBeenCalledWith();
  });

  it('should not invoke onChange after handle is unwatched', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const handle = manager.watch('/dir/test', onChange);

    getEventHandler(watchers[0], 'change')('/dir/test/a.ts');
    await vi.advanceTimersByTimeAsync(400);
    expect(onChange).toHaveBeenCalledTimes(1);

    handle.unwatch();
    getEventHandler(watchers[0], 'add')('/dir/test/b.ts');
    await vi.advanceTimersByTimeAsync(400);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should create separate watchers for different ignored options', () => {
    manager.watch('/dir', vi.fn(), { ignored: ['.git'] });
    manager.watch('/dir', vi.fn(), { ignored: ['.git', 'node_modules'] });

    expect(watchers).toHaveLength(2);
  });

  it('should restart watchers with same handlers on fileWatchMode change', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    const handle = manager.watch('/dir/test', onChange);

    await manager.settingsChanged({ fileWatchMode: 'native' } as never, { fileWatchMode: 'polling' } as never);

    expect(watchers[0].close).toHaveBeenCalledWith();
    expect(watchers).toHaveLength(2);

    getEventHandler(watchers[1], 'change')('/dir/test/a.ts');
    await vi.advanceTimersByTimeAsync(400);
    expect(onChange).toHaveBeenCalledTimes(1);

    handle.unwatch();
    await vi.advanceTimersByTimeAsync(0);
    expect(watchers[1].close).toHaveBeenCalledWith();
  });

  it('should not restart watchers when fileWatchMode is unchanged', async () => {
    manager.watch('/dir/test', vi.fn());
    await manager.settingsChanged({ fileWatchMode: 'native' } as never, { fileWatchMode: 'native' } as never);

    expect(watchers[0].close).not.toHaveBeenCalled();
  });

  it('should close all watchers on dispose', async () => {
    manager.watch('/dir/a', vi.fn());
    manager.watch('/dir/b', vi.fn());

    await manager.dispose();

    watchers.forEach((watcher) => expect(watcher.close).toHaveBeenCalledWith());
    expect(watchers).toHaveLength(2);
  });

  it('should continue invoking remaining handlers after a handler throws', async () => {
    const onChangeA = vi.fn().mockRejectedValue(new Error('boom'));
    const onChangeB = vi.fn().mockResolvedValue(undefined);

    manager.watch('/dir/test', onChangeA, { ignored: ['.git'] });
    manager.watch('/dir/test', onChangeB, { ignored: ['.git'] });

    getEventHandler(watchers[0], 'change')('/dir/test/a.ts');
    await vi.advanceTimersByTimeAsync(400);

    expect(onChangeA).toHaveBeenCalledTimes(1);
    expect(onChangeB).toHaveBeenCalledTimes(1);
  });

  it.each(['add', 'unlink'])('should trigger onChange on %s events', async (event) => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    manager.watch('/dir/test', onChange);

    getEventHandler(watchers[0], event)('/dir/test/a.ts');
    await vi.advanceTimersByTimeAsync(400);

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

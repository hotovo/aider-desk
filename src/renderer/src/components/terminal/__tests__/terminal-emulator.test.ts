import { Ghostty } from 'ghostty-web';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  Terminal: vi.fn(),
  FitAddon: vi.fn(),
}));

vi.mock('ghostty-web', () => ({
  Ghostty: { load: mocks.load },
  Terminal: mocks.Terminal,
  FitAddon: mocks.FitAddon,
}));

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('terminal emulator startup', () => {
  const ghostty = {} as Ghostty;
  let parent: HTMLDivElement;
  let terminal: {
    loadAddon: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };
  let fitAddon: { fit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    parent = document.createElement('div');
    terminal = { loadAddon: vi.fn(), open: vi.fn(), dispose: vi.fn() };
    fitAddon = { fit: vi.fn() };
    mocks.load.mockResolvedValue(ghostty);
    mocks.Terminal.mockImplementation(function () {
      return terminal;
    });
    mocks.FitAddon.mockImplementation(function () {
      return fitAddon;
    });
  });

  it('shares a pending WASM load while cancellation only abandons that caller', async () => {
    const loading = deferred<Ghostty>();
    mocks.load.mockReturnValue(loading.promise);
    const { createTerminalEmulator } = await import('../terminal-emulator');
    const aborted = new AbortController();
    const abandoned = createTerminalEmulator(parent, {}, aborted.signal);
    const active = createTerminalEmulator(parent, { scrollback: 1000 }, new AbortController().signal);
    aborted.abort();
    loading.resolve(ghostty);

    expect(await abandoned).toBeNull();
    expect(await active).toEqual({ terminal, fitAddon });
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.Terminal).toHaveBeenCalledExactlyOnceWith({
      scrollback: 1000,
      ghostty,
    });
    expect(terminal.loadAddon).toHaveBeenCalledWith(fitAddon);
    expect(terminal.loadAddon).toHaveBeenCalledBefore(terminal.open);
    expect(terminal.open).toHaveBeenCalledWith(parent);
  });

  it('keeps successful WASM loading cached for later terminals', async () => {
    const { createTerminalEmulator } = await import('../terminal-emulator');
    await createTerminalEmulator(parent, {}, new AbortController().signal);
    await createTerminalEmulator(parent, {}, new AbortController().signal);
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.Terminal).toHaveBeenCalledTimes(2);
  });

  it('retries WASM loading after a rejected attempt', async () => {
    const error = new Error('WASM unavailable');
    mocks.load.mockRejectedValueOnce(error);
    const { createTerminalEmulator } = await import('../terminal-emulator');
    await expect(createTerminalEmulator(parent, {}, new AbortController().signal)).rejects.toThrow(error);
    expect(mocks.Terminal).not.toHaveBeenCalled();
    await expect(createTerminalEmulator(parent, {}, new AbortController().signal)).resolves.toEqual({ terminal, fitAddon });
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });

  it('disposes partial initialization when opening the terminal fails', async () => {
    const error = new Error('open failed');
    terminal.open.mockImplementation(() => {
      parent.appendChild(document.createElement('canvas'));
      throw error;
    });
    terminal.dispose.mockImplementation(() => parent.replaceChildren());
    const { createTerminalEmulator } = await import('../terminal-emulator');
    await expect(createTerminalEmulator(parent, {}, new AbortController().signal)).rejects.toThrow(error);
    expect(terminal.dispose).toHaveBeenCalledOnce();
    expect(parent.children).toHaveLength(0);
  });
});

import { createRef, StrictMode } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGhosttyTerminal, GhosttyTerminalController } from '@openclaw/libterminal/browser';

import { Terminal, TerminalRef } from '../Terminal';

import { createMockApi } from '@/__tests__/mocks/api';
import { useApi } from '@/contexts/ApiContext';
import { setTabPtyId } from '@/stores/terminalStore';

vi.mock('@openclaw/libterminal/browser', () => ({ createGhosttyTerminal: vi.fn() }));
vi.mock('@/contexts/ApiContext', () => ({ useApi: vi.fn() }));
vi.mock('@/stores/terminalStore', () => ({ setTabPtyId: vi.fn() }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const createController = () => {
  const terminal = {
    cols: 80,
    rows: 24,
    onData: vi.fn<(listener: (data: string) => void) => void>(),
    onResize: vi.fn<(listener: (size: { cols: number; rows: number }) => void) => void>(),
    write: vi.fn(),
    writeln: vi.fn(),
    reset: vi.fn(),
    clear: vi.fn(),
    focus: vi.fn(),
    buffer: { active: { length: 1, getLine: vi.fn(() => ({ translateToString: () => 'terminal output' })) } },
  };
  const controller: GhosttyTerminalController = {
    terminal: terminal as unknown as GhosttyTerminalController['terminal'],
    readOnly: false,
    fit: vi.fn(() => {
      terminal.cols = 120;
      terminal.rows = 30;
    }),
    write: vi.fn(),
    resize: vi.fn(),
    setReadOnly: vi.fn(),
    attach: vi.fn(async () => {}),
    dispose: vi.fn(),
  };
  return { controller, terminal };
};

const props = {
  sessionKey: '/project:task',
  tabId: 'tab',
  baseDir: '/project',
  taskId: 'task',
  visible: true,
  ptyId: null,
  onClose: vi.fn(),
};

describe('Terminal lifecycle', () => {
  let api: ReturnType<typeof createMockApi>;
  let emulator: ReturnType<typeof createController>;

  beforeEach(() => {
    vi.clearAllMocks();
    emulator = createController();
    api = createMockApi({ getTerminalBuffer: vi.fn(async () => ({ exists: true, data: 'replayed output' })) });
    vi.mocked(useApi).mockReturnValue(api);
    vi.mocked(createGhosttyTerminal).mockResolvedValue(emulator.controller);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('waits for the emulator and its initial fit before creating a PTY', async () => {
    const startup = deferred<GhosttyTerminalController>();
    vi.mocked(createGhosttyTerminal).mockReturnValue(startup.promise);
    const view = render(<Terminal {...props} />);
    expect(api.createTerminal).not.toHaveBeenCalled();
    expect(createGhosttyTerminal).toHaveBeenCalledWith(expect.objectContaining({ readOnly: false, autoFit: false }));

    await act(async () => startup.resolve(emulator.controller));
    expect(api.createTerminal).toHaveBeenCalledWith('/project', 'task', 120, 30);
    expect(setTabPtyId).toHaveBeenCalledWith(props.sessionKey, 'tab', 'mock-terminal-id');
    expect(emulator.controller.fit).toHaveBeenCalledBefore(emulator.terminal.onResize);

    view.rerender(<Terminal {...props} ptyId="mock-terminal-id" />);
    expect(api.getTerminalBuffer).not.toHaveBeenCalled();
    expect(emulator.terminal.reset).toHaveBeenCalledOnce();
    expect(api.addTerminalDataListener).toHaveBeenCalledOnce();
  });

  it('aborts pending startup on unmount without creating or closing a PTY', async () => {
    const startup = deferred<GhosttyTerminalController>();
    vi.mocked(createGhosttyTerminal).mockReturnValue(startup.promise);
    const view = render(<Terminal {...props} />);
    const signal = vi.mocked(createGhosttyTerminal).mock.calls[0][0].signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => startup.resolve(emulator.controller));
    expect(emulator.controller.fit).not.toHaveBeenCalled();
    expect(api.createTerminal).not.toHaveBeenCalled();
    expect(api.closeTerminal).not.toHaveBeenCalled();
  });

  it('ignores an earlier startup after StrictMode restarts the effect', async () => {
    const first = deferred<GhosttyTerminalController>();
    const second = deferred<GhosttyTerminalController>();
    const earlier = createController();
    vi.mocked(createGhosttyTerminal).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(
      <StrictMode>
        <Terminal {...props} />
      </StrictMode>,
    );
    expect(createGhosttyTerminal).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createGhosttyTerminal).mock.calls[0][0].signal?.aborted).toBe(true);
    await act(async () => second.resolve(emulator.controller));
    await act(async () => first.resolve(earlier.controller));
    expect(earlier.controller.fit).not.toHaveBeenCalled();
    expect(api.createTerminal).toHaveBeenCalledExactlyOnceWith('/project', 'task', 120, 30);
  });

  it.each([true, false])('creates a hidden tab only when visible (ready first: %s)', async (readyFirst) => {
    const startup = deferred<GhosttyTerminalController>();
    vi.mocked(createGhosttyTerminal).mockReturnValue(startup.promise);
    const view = render(<Terminal {...props} visible={false} />);
    if (readyFirst) {
      await act(async () => startup.resolve(emulator.controller));
      expect(api.createTerminal).not.toHaveBeenCalled();
      view.rerender(<Terminal {...props} />);
    } else {
      view.rerender(<Terminal {...props} />);
      expect(api.createTerminal).not.toHaveBeenCalled();
      await act(async () => startup.resolve(emulator.controller));
    }
    await waitFor(() => expect(api.createTerminal).toHaveBeenCalledExactlyOnceWith('/project', 'task', 120, 30));
    expect(createGhosttyTerminal).toHaveBeenCalledOnce();
  });

  it('aborts the controller when initial fitting fails and never publishes readiness', async () => {
    const error = new Error('fit failed');
    vi.mocked(emulator.controller.fit).mockImplementation(() => {
      throw error;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Terminal {...props} />);
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to initialize ghostty-web:', error));
    expect(vi.mocked(createGhosttyTerminal).mock.calls[0][0].signal?.aborted).toBe(true);
    expect(api.createTerminal).not.toHaveBeenCalled();
    expect(emulator.terminal.onData).not.toHaveBeenCalled();
  });

  it('allows a new mount after startup rejects', async () => {
    const error = new Error('WASM unavailable');
    vi.mocked(createGhosttyTerminal).mockRejectedValueOnce(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<Terminal {...props} />);
    await waitFor(() => expect(log).toHaveBeenCalledWith('Failed to initialize ghostty-web:', error));
    expect(api.createTerminal).not.toHaveBeenCalled();
    view.unmount();
    render(<Terminal {...props} />);
    await waitFor(() => expect(api.createTerminal).toHaveBeenCalledOnce());
  });

  it('replays once before subscribing and keeps the same session while hidden', async () => {
    vi.useFakeTimers();
    const replay = deferred<{ exists: boolean; data: string }>();
    api.getTerminalBuffer.mockReturnValue(replay.promise);
    const view = render(<Terminal {...props} ptyId="existing" />);
    await act(async () => {});
    expect(api.addTerminalDataListener).not.toHaveBeenCalled();
    await act(async () => replay.resolve({ exists: true, data: 'saved output' }));
    expect(emulator.terminal.reset).toHaveBeenCalledBefore(emulator.terminal.write);
    expect(emulator.terminal.write).toHaveBeenCalledWith('saved output');
    expect(emulator.terminal.write).toHaveBeenCalledBefore(api.addTerminalDataListener);
    const onData = api.addTerminalDataListener.mock.calls[0][1];

    view.rerender(<Terminal {...props} ptyId="existing" visible={false} />);
    act(() => onData({ terminalId: 'existing', baseDir: '/project', taskId: 'task', data: 'hidden output' }));
    expect(emulator.terminal.write).toHaveBeenLastCalledWith('hidden output');
    view.rerender(<Terminal {...props} ptyId="existing" />);
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(emulator.controller.fit).toHaveBeenCalledTimes(2);
    expect(createGhosttyTerminal).toHaveBeenCalledOnce();
    expect(api.getTerminalBuffer).toHaveBeenCalledOnce();
    expect(api.createTerminal).not.toHaveBeenCalled();
    expect(api.closeTerminal).not.toHaveBeenCalled();
  });

  it('preserves native strings, resize, focus, clear, and buffer access', async () => {
    const ref = createRef<TerminalRef>();
    render(<Terminal {...props} ptyId="existing" ref={ref} />);
    await waitFor(() => expect(api.addTerminalDataListener).toHaveBeenCalledOnce());
    const input = '\uFEFF你好 🦊\ud800';
    emulator.terminal.onData.mock.calls[0][0](input);
    expect(api.writeToTerminal).toHaveBeenCalledWith('existing', input);
    emulator.terminal.onResize.mock.calls[0][0]({ cols: 90, rows: 25 });
    expect(api.resizeTerminal).toHaveBeenCalledWith('existing', 90, 25);
    expect(ref.current?.getOutput()).toBe('terminal output');
    ref.current?.focus();
    ref.current?.clear();
    ref.current?.resize();
    expect(emulator.terminal.focus).toHaveBeenCalledOnce();
    expect(emulator.terminal.clear).toHaveBeenCalledOnce();
    expect(emulator.controller.fit).toHaveBeenCalledTimes(2);
  });

  it('unsubscribes and aborts the emulator without closing an attached PTY', async () => {
    const removeData = vi.fn();
    const removeExit = vi.fn();
    api.addTerminalDataListener.mockReturnValue(removeData);
    api.addTerminalExitListener.mockReturnValue(removeExit);
    const view = render(<Terminal {...props} ptyId="existing" />);
    await waitFor(() => expect(api.addTerminalExitListener).toHaveBeenCalledOnce());
    view.unmount();
    expect(removeData).toHaveBeenCalledOnce();
    expect(removeExit).toHaveBeenCalledOnce();
    expect(vi.mocked(createGhosttyTerminal).mock.calls[0][0].signal?.aborted).toBe(true);
    expect(api.closeTerminal).not.toHaveBeenCalled();
  });

  it('closes only an orphan PTY created after the component unmounts', async () => {
    const creation = deferred<string>();
    api.createTerminal.mockReturnValue(creation.promise);
    const view = render(<Terminal {...props} />);
    await waitFor(() => expect(api.createTerminal).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => creation.resolve('orphan'));
    expect(api.closeTerminal).toHaveBeenCalledExactlyOnceWith('orphan');
    expect(setTabPtyId).not.toHaveBeenCalled();
  });

  it('forwards touch input and control keys without changing their string protocol', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
    const ref = createRef<TerminalRef>();
    const view = render(<Terminal {...props} ptyId="existing" ref={ref} />);
    await waitFor(() => expect(api.addTerminalDataListener).toHaveBeenCalledOnce());
    const input = view.container.querySelector('textarea')!;
    fireEvent.change(input, { target: { value: '\uFEFFhello\n' } });
    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(api.writeToTerminal.mock.calls.map((call) => call[1])).toEqual(['\uFEFFhello\r', '\x03', '\x1b[A']);
    ref.current?.focus();
    expect(input).toHaveFocus();
    expect(emulator.terminal.focus).not.toHaveBeenCalled();
  });
});

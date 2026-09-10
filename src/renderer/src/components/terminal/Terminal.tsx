import { forwardRef, useEffect, useImperativeHandle, useRef, useState, useCallback, ChangeEvent } from 'react';
import { Ghostty, Terminal as GhosttyTerminal, FitAddon } from 'ghostty-web';
import { TerminalData, TerminalExitData } from '@common/types';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

import './Terminal.scss';
import { useApi } from '@/contexts/ApiContext';
import { setTabPtyId } from '@/stores/terminalStore';

export type TerminalRef = {
  focus: () => void;
  clear: () => void;
  resize: () => void;
  getOutput: () => string;
};

type Props = {
  sessionKey: string;
  tabId: string;
  baseDir: string;
  taskId: string;
  visible: boolean;
  ptyId: string | null;
  className?: string;
};

const useIsTouchDevice = (): boolean => {
  const [isTouch, setIsTouch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)');
    const listener = (e: MediaQueryListEvent) => {
      setIsTouch(e.matches);
    };
    query.addEventListener('change', listener);
    return () => query.removeEventListener('change', listener);
  }, []);

  return isTouch;
};

// Load the ghostty WASM module once per app, not once per terminal instance
let ghosttyLoadPromise: Promise<InstanceType<typeof Ghostty>> | null = null;
const loadGhostty = (): Promise<InstanceType<typeof Ghostty>> => {
  if (!ghosttyLoadPromise) {
    ghosttyLoadPromise = Ghostty.load();
  }
  return ghosttyLoadPromise;
};

const KEY_SEQUENCES: Record<string, string> = {
  Enter: '\r',
  Backspace: '\x7f',
  ArrowUp: '\x1b[A',
  ArrowDown: '\x1b[B',
  ArrowRight: '\x1b[C',
  ArrowLeft: '\x1b[D',
  Escape: '\x1b',
  Tab: '\t',
};

export const Terminal = forwardRef<TerminalRef, Props>(({ sessionKey, tabId, baseDir, taskId, visible, ptyId, className }, ref) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<GhosttyTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(ptyId);
  const creatingRef = useRef(false);
  const skipReplayRef = useRef(false);
  const touchInputRef = useRef<HTMLTextAreaElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isEmulatorReady, setIsEmulatorReady] = useState(false);
  const [exited, setExited] = useState(false);
  const [creationEpoch, setCreationEpoch] = useState(0);
  const isTouch = useIsTouchDevice();
  const ghosttyInstanceRef = useRef<InstanceType<typeof Ghostty> | null>(null);
  const api = useApi();

  const { t } = useTranslation();
  const isConnecting = isInitialized && visible && !ptyId && !exited;

  const writeToPty = useCallback(
    (data: string) => {
      const currentPtyId = ptyIdRef.current;
      if (currentPtyId) {
        void api.writeToTerminal(currentPtyId, data);
      }
    },
    [api],
  );

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (isTouch) {
        touchInputRef.current?.focus();
      } else {
        terminalRef.current?.focus();
      }
    },
    clear: () => {
      terminalRef.current?.clear();
    },
    resize: () => {
      fitAddonRef.current?.fit();
    },
    getOutput: () => {
      if (!terminalRef.current) {
        return '';
      }

      const buffer = terminalRef.current.buffer.active;
      let output = '';

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          output += line.translateToString(true) + '\n';
        }
      }

      return output.trim();
    },
  }));

  // Initialize ghostty-web WASM once
  useEffect(() => {
    let cancelled = false;

    loadGhostty()
      .then((instance) => {
        if (!cancelled) {
          ghosttyInstanceRef.current = instance;
          setIsInitialized(true);
        }
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to initialize ghostty-web:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Initialize terminal emulator once - its lifetime is independent of the PTY session
  useEffect(() => {
    if (!isInitialized || !terminalContainerRef.current) {
      return;
    }

    const terminal = new GhosttyTerminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#e5e5e5',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#404040',
        black: '#000000',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f5f5f5',
        brightBlack: '#404040',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 12,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      ghostty: ghosttyInstanceRef.current!,
    });

    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);

    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    // Handle terminal input
    terminal.onData((data) => {
      writeToPty(data);
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      const currentPtyId = ptyIdRef.current;
      if (currentPtyId) {
        void api.resizeTerminal(currentPtyId, cols, rows);
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    setIsEmulatorReady(true);

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      setIsEmulatorReady(false);
    };
  }, [isInitialized, api, writeToPty]);

  // Create the PTY process when visible and no session is attached
  useEffect(() => {
    if (!visible || ptyId || exited || !isInitialized || creatingRef.current) {
      return;
    }

    const term = terminalRef.current;

    if (!term) {
      return;
    }

    let cancelled = false;
    creatingRef.current = true;

    const createTerminal = async () => {
      try {
        const cols = term.cols || 160;
        const rows = term.rows || 10;
        const id = await api.createTerminal(baseDir, taskId, cols, rows);

        if (cancelled) {
          void api.closeTerminal(id);
          setCreationEpoch((epoch) => epoch + 1);
          return;
        }

        ptyIdRef.current = id;
        skipReplayRef.current = true;
        setTabPtyId(sessionKey, tabId, id);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create terminal:', error);
        terminalRef.current?.writeln('\x1b[31mFailed to create terminal process\x1b[0m');
      } finally {
        creatingRef.current = false;
      }
    };

    void createTerminal();

    return () => {
      cancelled = true;
    };
  }, [baseDir, taskId, sessionKey, tabId, ptyId, visible, exited, isInitialized, api, creationEpoch]);

  // Attach to the PTY session: reset the emulator, replay the recent output,
  // and only then subscribe to live events so no output is rendered twice
  useEffect(() => {
    ptyIdRef.current = ptyId;

    if (!isEmulatorReady || !ptyId) {
      return;
    }

    setExited(false);

    let cancelled = false;
    let removeDataListener: (() => void) | null = null;
    let removeExitListener: (() => void) | null = null;

    const handleTerminalData = (data: TerminalData) => {
      if (data.terminalId === ptyIdRef.current && terminalRef.current) {
        terminalRef.current.write(data.data);
      }
    };

    const handleTerminalExit = (data: TerminalExitData) => {
      if (data.terminalId === ptyIdRef.current) {
        ptyIdRef.current = null;
        setTabPtyId(sessionKey, tabId, null);
        setExited(true);
      }
    };

    const subscribe = () => {
      if (cancelled || removeDataListener) {
        return;
      }

      removeDataListener = api.addTerminalDataListener(baseDir, handleTerminalData);
      removeExitListener = api.addTerminalExitListener(baseDir, handleTerminalExit);
    };

    const attach = async () => {
      try {
        const buffer = await api.getTerminalBuffer(ptyId);

        if (cancelled) {
          return;
        }

        if (!buffer.exists) {
          setTabPtyId(sessionKey, tabId, null);
          setExited(true);
          return;
        }

        terminalRef.current?.reset();
        terminalRef.current?.write(buffer.data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to fetch terminal buffer:', error);
      }

      subscribe();
    };

    // A freshly created PTY has an empty buffer - subscribe directly without a replay round trip
    if (skipReplayRef.current) {
      skipReplayRef.current = false;
      terminalRef.current?.reset();
      subscribe();

      return () => {
        cancelled = true;
        removeDataListener?.();
        removeExitListener?.();
      };
    }

    void attach();

    return () => {
      cancelled = true;
      removeDataListener?.();
      removeExitListener?.();
    };
  }, [ptyId, isEmulatorReady, api, baseDir, sessionKey, tabId]);

  // Handle restart on keypress after exit
  useEffect(() => {
    if (!exited || !terminalRef.current) {
      return undefined;
    }

    const disposable = terminalRef.current.onData(() => {
      terminalRef.current?.reset();
      setExited(false);
    });

    return () => {
      disposable.dispose();
    };
  }, [exited, isInitialized]);

  // Handle resize when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible]);

  // Touch input: forward soft keyboard input to the PTY
  useEffect(() => {
    if (!isTouch) {
      return undefined;
    }

    const input = touchInputRef.current;

    if (!input) {
      return undefined;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const sequence = KEY_SEQUENCES[e.key];

      if (sequence) {
        e.preventDefault();
        writeToPty(sequence);
        return;
      }

      if (e.ctrlKey && e.key.length === 1) {
        const charCode = e.key.toUpperCase().charCodeAt(0);
        if (charCode >= 64 && charCode <= 95) {
          e.preventDefault();
          writeToPty(String.fromCharCode(charCode & 0x1f));
        }
      }
    };

    const handleBeforeInput = (e: InputEvent) => {
      if (e.inputType === 'deleteContentBackward') {
        e.preventDefault();
        writeToPty('\x7f');
      } else if (e.inputType === 'deleteContentForward') {
        e.preventDefault();
        writeToPty('\x1b[3~');
      }
    };

    input.addEventListener('keydown', handleKeyDown);
    input.addEventListener('beforeinput', handleBeforeInput);

    return () => {
      input.removeEventListener('keydown', handleKeyDown);
      input.removeEventListener('beforeinput', handleBeforeInput);
    };
  }, [isTouch, isInitialized, writeToPty]);

  const restartSession = () => {
    terminalRef.current?.reset();
    setExited(false);
  };

  const handleTouchInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    e.target.value = '';

    if (exited) {
      restartSession();
      return;
    }

    if (!text) {
      return;
    }

    writeToPty(text.replace(/\n/g, '\r'));
  };

  const handleContainerPointerDown = () => {
    if (!isTouch) {
      return;
    }

    if (exited) {
      restartSession();
    }

    setTimeout(() => {
      touchInputRef.current?.focus();
    }, 0);
  };

  const handleTerminalFocus = () => {
    terminalRef.current?.renderer?.setCursorStyle('block');
    setTimeout(() => {
      terminalRef.current?.renderer?.setCursorBlink(true);
    }, 100);
  };

  const handleTerminalBlur = () => {
    terminalRef.current?.renderer?.setCursorStyle('underline');
    setTimeout(() => {
      terminalRef.current?.renderer?.setCursorBlink(false);
    }, 100);
  };

  return (
    <div className={clsx('absolute inset-0 overflow-hidden bg-[#0a0a0a]', visible ? 'block z-20' : 'hidden', className)}>
      <div
        ref={terminalContainerRef}
        className="ghostty-terminal-container absolute top-2 left-0 right-0 bottom-2"
        onBlur={handleTerminalBlur}
        onFocus={handleTerminalFocus}
        onPointerDown={handleContainerPointerDown}
      />
      {isTouch && (
        <textarea
          ref={touchInputRef}
          className="absolute bottom-0 left-0 h-px w-px resize-none border-none bg-transparent opacity-0 outline-none"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onChange={handleTouchInputChange}
          aria-hidden="true"
        />
      )}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-text-muted-light text-xs">{t('terminal.connecting')}</div>
        </div>
      )}
      {exited && visible && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-text-muted-light text-xs">{t('terminal.restartHint')}</div>
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

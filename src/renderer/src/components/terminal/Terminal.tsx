import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Ghostty, Terminal as GhosttyTerminal, FitAddon } from 'ghostty-web';
import { TerminalData, TerminalExitData } from '@common/types';
import { clsx } from 'clsx';

import './Terminal.scss';
import { useApi } from '@/contexts/ApiContext';

export type TerminalRef = {
  focus: () => void;
  clear: () => void;
  resize: () => void;
  getOutput: () => string;
};

type Props = {
  baseDir: string;
  taskId: string;
  visible: boolean;
  className?: string;
  onExit?: () => void;
};

export const Terminal = forwardRef<TerminalRef, Props>(({ baseDir, taskId, visible, className, onExit }, ref) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<GhosttyTerminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const ghosttyInstanceRef = useRef<InstanceType<typeof Ghostty> | null>(null);
  const api = useApi();

  // Show connecting overlay when WASM is ready but no PTY process exists yet
  const isConnecting = isInitialized && visible && !terminalId;

  useImperativeHandle(ref, () => ({
    focus: () => {
      terminalRef.current?.focus();
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
    let ghosttyInitPromise: Promise<InstanceType<typeof Ghostty>> | null = null;

    const getGhosttyInit = (): Promise<InstanceType<typeof Ghostty>> => {
      if (!ghosttyInitPromise) {
        ghosttyInitPromise = Ghostty.load();
      }
      return ghosttyInitPromise;
    };

    getGhosttyInit()
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

  // Initialize terminal
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
      if (terminalId) {
        void api.writeToTerminal(terminalId, data);
      }
    });

    // Handle terminal resize
    terminal.onResize(({ cols, rows }) => {
      if (terminalId) {
        void api.resizeTerminal(terminalId, cols, rows);
      }
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    return () => {
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId, api, isInitialized]);

  // Create terminal process
  useEffect(() => {
    if (!visible || terminalId || !isInitialized) {
      return;
    }

    const createTerminal = async () => {
      const term = terminalRef.current;

      if (!term) {
        return;
      }

      try {
        const cols = term.cols || 160;
        const rows = term.rows || 10;
        const id = await api.createTerminal(baseDir, taskId, cols, rows);

        // Handle terminal input
        term.onData((data) => {
          void api.writeToTerminal(id, data);
        });

        // Handle terminal resize
        term.onResize(({ cols, rows }) => {
          void api.resizeTerminal(id, cols, rows);
        });

        setTerminalId(id);
        setIsConnected(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create terminal:', error);
        terminalRef.current?.writeln('\x1b[31mFailed to create terminal process\x1b[0m');
      }
    };

    void createTerminal();
  }, [baseDir, terminalId, visible, api, taskId, isInitialized]);

  // Handle terminal data and exit/restart
  useEffect(() => {
    if (!terminalId) {
      return;
    }

    const handleTerminalData = (data: TerminalData) => {
      if (data.terminalId === terminalId && terminalRef.current) {
        terminalRef.current.write(data.data);
      }
    };

    const handleTerminalExit = (data: TerminalExitData) => {
      if (data.terminalId === terminalId) {
        setIsConnected(false);
        onExit?.();
      }
    };

    const removeTerminalDataListener = api.addTerminalDataListener(baseDir, handleTerminalData);
    const removeTerminalExitListener = api.addTerminalExitListener(baseDir, handleTerminalExit);

    return () => {
      removeTerminalDataListener();
      removeTerminalExitListener();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalId, baseDir, api]);

  // Handle restart on keypress after exit
  useEffect(() => {
    if (isConnected || !terminalRef.current) {
      return undefined;
    }

    const handleRestartInput = (_data: string) => {
      // Clear terminalId to trigger re-creation via the createTerminal effect
      terminalRef.current?.clear();
      setTerminalId(null);
    };

    const disposable = terminalRef.current.onData(handleRestartInput);

    return () => {
      disposable.dispose();
    };
  }, [isConnected, terminalId]);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalId) {
        void api.closeTerminal(terminalId);
      }
    };
  }, [terminalId, api]);

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
    <div key={terminalId} className={clsx('absolute inset-0 overflow-hidden bg-[#0a0a0a]', visible ? 'block z-20' : 'hidden', className)}>
      <div
        ref={terminalContainerRef}
        className="ghostty-terminal-container absolute top-2 left-0 right-0 bottom-2"
        onBlur={handleTerminalBlur}
        onFocus={handleTerminalFocus}
      />
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-text-muted-light text-xs">Connecting to terminal...</div>
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

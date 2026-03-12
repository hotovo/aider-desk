import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Terminal as GhosttyTerminal, FitAddon, init } from 'ghostty-web';
import { TerminalData, TerminalExitData } from '@common/types';
import { clsx } from 'clsx';

import './Terminal.scss';
import { useApi } from '@/contexts/ApiContext';

// Module-level promise to ensure ghostty-web init() is called only once globally
let ghosttyInitPromise: Promise<void> | null = null;

export type TerminalRef = {
  focus: () => void;
  clear: () => void;
  resize: () => void;
  getOutput: () => string;
  isReady: () => boolean;
};

type Props = {
  baseDir: string;
  taskId: string;
  visible: boolean;
  isActive?: boolean;
  className?: string;
};

export const Terminal = forwardRef<TerminalRef, Props>(({ baseDir, taskId, visible, isActive = false, className }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [ghosttyTerminal, setGhosttyTerminal] = useState<GhosttyTerminal | null>(null);
  const [fitAddon, setFitAddon] = useState<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const api = useApi();

  // Ref to track if initialization is in progress to prevent cleanup from disposing
  // a terminal that's about to be re-initialized
  const initInProgressRef = useRef(false);

  // Unique ID for each initialization cycle to track ownership of terminal instances
  // This prevents race conditions when cleanup runs after async initialization completes
  const initIdRef = useRef<number>(0);

  // Ref to track the current terminal instance for proper cleanup across effect runs
  // This is needed because ghosttyTerminal state value becomes stale in closures
  const ghosttyTerminalRef = useRef<GhosttyTerminal | null>(null);

  // Ref to track the current fit addon instance for proper cleanup
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Refs to track state values without causing re-runs
  const visibleRef = useRef(visible);
  const isActiveRef = useRef(isActive);
  const terminalIdRef = useRef(terminalId);
  const isConnectedRef = useRef(isConnected);

  // Update refs when state changes
  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    terminalIdRef.current = terminalId;
  }, [terminalId]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      // Only focus if terminal is fully initialized and connected
      const currentIsConnected = isConnectedRef.current;
      const currentIsActive = isActiveRef.current;
      const currentGhosttyTerminal = ghosttyTerminalRef.current;

      if (!currentIsActive) {
        return;
      }

      if (currentGhosttyTerminal && currentIsConnected) {
        currentGhosttyTerminal.focus();
      }
    },
    clear: () => {
      ghosttyTerminalRef.current?.clear();
    },
    resize: () => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    },
    getOutput: () => {
      const currentGhosttyTerminal = ghosttyTerminalRef.current;
      if (!currentGhosttyTerminal) {
        return '';
      }
      const buffer = currentGhosttyTerminal.buffer.active;
      let output = '';

      for (let i = 0; i < buffer.length; i++) {
        const line = buffer.getLine(i);
        if (line) {
          output += line.translateToString(true) + '\n';
        }
      }

      return output.trim();
    },
    isReady: () => {
      const currentGhosttyTerminal = ghosttyTerminalRef.current;
      const currentIsConnected = isConnectedRef.current;

      return currentGhosttyTerminal !== null && currentIsConnected;
    },
  }));

  // Initialize terminal (ghostty instance creation)
  useLayoutEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    // Generate a unique ID for this initialization cycle
    const currentInitId = ++initIdRef.current;

    // Mark that initialization is in progress
    initInProgressRef.current = true;

    // Timeout to prevent indefinite hanging on initialization failures
    const initTimeoutMs = 30000;
    const initTimeoutId = setTimeout(() => {
      if (initInProgressRef.current) {
        initInProgressRef.current = false;
        if (!ghosttyTerminalRef.current) {
          setErrorMessage('Terminal initialization timed out');
        }
      }
    }, initTimeoutMs);

    const initializeTerminal = async () => {
      // Check if we still have a container
      if (!terminalRef.current) {
        initInProgressRef.current = false;
        ghosttyInitPromise = null;
        return;
      }

      try {
        // Initialize ghostty-web library
        if (!ghosttyInitPromise) {
          ghosttyInitPromise = init();
        }
        await ghosttyInitPromise;

        // Create FitAddon
        const fitAddonInstance = new FitAddon();

        // Create GhosttyTerminal instance
        const ghostty = new GhosttyTerminal({
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
        });

        // Load fit addon
        ghostty.loadAddon(fitAddonInstance);

        // Store in refs for proper cleanup tracking
        fitAddonRef.current = fitAddonInstance;

        // Open terminal in container
        const container = terminalRef.current;
        if (!container) {
          ghostty.dispose();
          initInProgressRef.current = false;
          ghosttyInitPromise = null;
          return;
        }

        ghostty.open(container);

        // Fit the terminal
        fitAddonInstance.fit();

        // Update state
        ghosttyTerminalRef.current = ghostty;
        setGhosttyTerminal(ghostty);
        setFitAddon(fitAddonInstance);

        // Mark initialization as complete (only for this init cycle)
        if (initIdRef.current === currentInitId) {
          initInProgressRef.current = false;
        }

        // Clear the initialization timeout since we completed successfully
        clearTimeout(initTimeoutId);
      } catch (error) {
        // Only reset state if this is still the current initialization
        if (initIdRef.current === currentInitId) {
          initInProgressRef.current = false;
        }
        ghosttyInitPromise = null;

        const errorMsg = error instanceof Error ? error.message : String(error);
        setErrorMessage(errorMsg);

        // Display user-facing error message in the terminal
        if (ghosttyTerminalRef.current) {
          ghosttyTerminalRef.current.writeln('\x1b[31mFailed to initialize terminal\x1b[0m');
          ghosttyTerminalRef.current.writeln(`\x1b[31m${errorMsg}\x1b[0m`);
        }
      }
    };

    void initializeTerminal();

    return () => {
      // Clear any pending initialization timeout
      clearTimeout(initTimeoutId);

      // Capture ref values at cleanup time to detect ownership changes
      const currentInitIdRef = initIdRef.current;
      const currentInitInProgress = initInProgressRef.current;
      const currentGhosttyTerminal = ghosttyTerminalRef.current;

      // Determine ownership
      const ownsTerminal = currentGhosttyTerminal !== null;
      const isStaleInit = currentInitInProgress && currentInitIdRef !== currentInitId;
      const ownsAndReady = !currentInitInProgress && currentInitIdRef === currentInitId;

      const shouldDispose = (ownsAndReady || (isStaleInit && ownsTerminal)) && visibleRef.current;

      if (shouldDispose) {
        if (currentGhosttyTerminal) {
          currentGhosttyTerminal.dispose();
        }
        ghosttyTerminalRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, [taskId, visible, fitAddon]);

  // Create terminal process
  useLayoutEffect(() => {
    if (!visible) {
      return;
    }

    if (terminalId) {
      return;
    }

    const createTerminal = async () => {
      const ghostty = ghosttyTerminal;

      if (!ghostty) {
        return;
      }

      try {
        // Always create a new terminal for each Terminal component instance
        if (fitAddon) {
          fitAddon.fit();
        }

        // Get dimensions
        const cols = ghosttyTerminal?.cols || 160;
        const rows = ghosttyTerminal?.rows || 10;

        // Create terminal via API
        const id = await api.createTerminal(baseDir, taskId, cols, rows);

        setTerminalId(id);
        setIsConnected(true);

        // Focus after connection
        ghosttyTerminal?.focus();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        setErrorMessage(errorMsg);

        ghosttyTerminal?.writeln('\x1b[31mFailed to create terminal process\x1b[0m');
      }
    };

    void createTerminal();
  }, [baseDir, terminalId, visible, api, taskId, ghosttyTerminal]);

  // Set up terminal event handlers
  useLayoutEffect(() => {
    if (!ghosttyTerminal || !terminalId) {
      return;
    }

    const ghostty = ghosttyTerminal;

    const onDataHandler = (data: string) => {
      void api.writeToTerminal(terminalId, data);
    };

    const onResizeHandler = ({ cols, rows }: { cols: number; rows: number }) => {
      void api.resizeTerminal(terminalId, cols, rows);
    };

    // onData and onResize return IDisposable objects that must be disposed to cleanup
    const dataDisposable = ghostty.onData(onDataHandler);
    const resizeDisposable = ghostty.onResize(onResizeHandler);

    // Cleanup: dispose the event handlers to prevent memory leaks
    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
    };
  }, [terminalId, api, ghosttyTerminal]);

  // Handle terminal data (incoming data from backend)
  useEffect(() => {
    if (!terminalId) {
      return;
    }

    const handleTerminalData = (data: TerminalData) => {
      if (data.terminalId === terminalId && ghosttyTerminal) {
        ghosttyTerminal.write(data.data);
      }
    };

    const handleTerminalExit = (data: TerminalExitData) => {
      if (data.terminalId === terminalId) {
        setIsConnected(false);
        if (ghosttyTerminal) {
          ghosttyTerminal.writeln(`\x1b[33m\r\nProcess exited with code ${data.exitCode}\x1b[0m`);
          ghosttyTerminal.writeln('\x1b[90mPress any key to restart...\x1b[0m');
        }
      }
    };

    const removeTerminalDataListener = api.addTerminalDataListener(baseDir, handleTerminalData);
    const removeTerminalExitListener = api.addTerminalExitListener(baseDir, handleTerminalExit);

    return () => {
      removeTerminalDataListener();
      removeTerminalExitListener();
    };
  }, [terminalId, baseDir, api, ghosttyTerminal, isActive, visible]);

  // Trigger fit when terminal becomes visible after being hidden
  useEffect(() => {
    if (visible && fitAddon) {
      const timeoutId = setTimeout(() => {
        fitAddon.fit();
      }, 0);

      return () => {
        clearTimeout(timeoutId);
      };
    }
    return undefined;
  }, [visible, fitAddon]);

  return (
    <div ref={terminalRef} className={clsx('terminal flex-grow', className)}>
      {errorMessage && (
        <div className="flex items-center justify-center h-full text-red-500 p-4">
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

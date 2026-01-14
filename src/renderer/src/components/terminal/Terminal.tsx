import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { Terminal as GhosttyTerminal, init } from 'ghostty-web';
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
};

export const Terminal = forwardRef<TerminalRef, Props>(({ baseDir, taskId, visible, className }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [ghosttyTerminal, setGhosttyTerminal] = useState<GhosttyTerminal | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const api = useApi();

  useImperativeHandle(ref, () => ({
    focus: () => {
      ghosttyTerminal?.focus();
    },
    clear: () => {
      ghosttyTerminal?.clear();
    },
    resize: () => {
      // Ghostty handles resizing automatically
    },
    getOutput: () => {
      if (!ghosttyTerminal) {
        return '';
      }

      const buffer = ghosttyTerminal.buffer.active;
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

  // Initialize terminal
  useLayoutEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    const initializeTerminal = async () => {
      await init();

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

      const container = terminalRef.current;
      if (!container) {
        return;
      }
      ghostty.open(container);

      setGhosttyTerminal(ghostty);
    };

    void initializeTerminal();

    return () => {
      ghosttyTerminal?.dispose();
      setGhosttyTerminal(null);
    };
  }, [ghosttyTerminal]);

  // Create terminal process
  useLayoutEffect(() => {
    if (!visible || terminalId) {
      return;
    }

    const createTerminal = async () => {
      const ghostty = ghosttyTerminal;

      if (!ghostty) {
        return;
      }
      try {
        // Always create a new terminal for each Terminal component instance
        const cols = ghosttyTerminal?.cols || 160;
        const rows = ghosttyTerminal?.rows || 10;
        const id = await api.createTerminal(baseDir, taskId, cols, rows);

        setTerminalId(id);
        setIsConnected(true);
      } catch {
        ghosttyTerminal?.writeln('\\x1b[31mFailed to create terminal process\\x1b[0m');
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
    ghostty.onData((data) => {
      void api.writeToTerminal(terminalId, data);
    });

    ghostty.onResize(({ cols, rows }) => {
      void api.resizeTerminal(terminalId, cols, rows);
    });
  }, [terminalId, api, ghosttyTerminal]);

  // Handle terminal data
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
          ghosttyTerminal.writeln(`\\x1b[33m\\r\\nProcess exited with code ${data.exitCode}\\x1b[0m`);
          ghosttyTerminal.writeln('\\x1b[90mPress any key to restart...\\x1b[0m');
        }
      }
    };

    const removeTerminalDataListener = api.addTerminalDataListener(baseDir, handleTerminalData);
    const removeTerminalExitListener = api.addTerminalExitListener(baseDir, handleTerminalExit);

    return () => {
      removeTerminalDataListener();
      removeTerminalExitListener();
    };
  }, [terminalId, baseDir, api, ghosttyTerminal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminalId) {
        void api.closeTerminal(terminalId);
      }
    };
  }, [terminalId, api]);

  return (
    <div key="terminal" className={clsx('terminal absolute inset-0 overflow-hidden bg-[#0a0a0a]', visible ? 'visible' : 'invisible', className)}>
      <div ref={terminalRef} className="absolute top-2 left-0 right-0 bottom-2" />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-text-muted-light text-xs">Connecting to terminal...</div>
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

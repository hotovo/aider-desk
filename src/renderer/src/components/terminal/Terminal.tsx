import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { IpcRendererEvent } from 'electron';
import { TerminalData, TerminalExitData } from '@common/types';
import clsx from 'clsx';

import '@xterm/xterm/css/xterm.css';
import './Terminal.scss';

export type TerminalRef = {
  focus: () => void;
  clear: () => void;
  resize: () => void;
  getOutput: () => string;
};

type Props = {
  baseDir: string;
  visible: boolean;
  className?: string;
};

export const Terminal = forwardRef<TerminalRef, Props>(({ baseDir, visible, className }, ref) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useImperativeHandle(ref, () => ({
    focus: () => {
      xtermRef.current?.focus();
    },
    clear: () => {
      xtermRef.current?.clear();
    },
    resize: () => {
      fitAddonRef.current?.fit();
    },
    getOutput: () => {
      if (!xtermRef.current) {
        return '';
      }

      const buffer = xtermRef.current.buffer.active;
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
  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }

    const xterm = new XTerm({
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
      lineHeight: 1,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 4,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Handle terminal input
    xterm.onData((data) => {
      if (terminalId) {
        void window.api.writeToTerminal(terminalId, data);
      }
    });

    // Handle terminal resize
    xterm.onResize(({ cols, rows }) => {
      if (terminalId) {
        void window.api.resizeTerminal(terminalId, cols, rows);
      }
    });

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    return () => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalId]);

  // Create terminal process
  useEffect(() => {
    if (!visible || terminalId) {
      return;
    }

    const createTerminal = async () => {
      const xterm = xtermRef.current;

      if (!xterm) {
        return;
      }
      try {
        // Always create a new terminal for each Terminal component instance
        const cols = xtermRef.current?.cols || 160;
        const rows = xtermRef.current?.rows || 10;
        const id = await window.api.createTerminal(baseDir, cols, rows);

        // Handle terminal input
        xterm.onData((data) => {
          void window.api.writeToTerminal(id, data);
        });

        // Handle terminal resize
        xterm.onResize(({ cols, rows }) => {
          void window.api.resizeTerminal(id, cols, rows);
        });

        setTerminalId(id);
        setIsConnected(true);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to create terminal:', error);
        xtermRef.current?.writeln('\\x1b[31mFailed to create terminal process\\x1b[0m');
      }
    };

    void createTerminal();
  }, [baseDir, terminalId, visible]);

  // Handle terminal data
  useEffect(() => {
    if (!terminalId) {
      return;
    }

    const handleTerminalData = (_: IpcRendererEvent, data: TerminalData) => {
      if (data.terminalId === terminalId && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    };

    const handleTerminalExit = (_: IpcRendererEvent, data: TerminalExitData) => {
      if (data.terminalId === terminalId) {
        setIsConnected(false);
        if (xtermRef.current) {
          xtermRef.current.writeln(`\\x1b[33m\\r\\nProcess exited with code ${data.exitCode}\\x1b[0m`);
          xtermRef.current.writeln('\\x1b[90mPress any key to restart...\\x1b[0m');
        }
      }
    };

    const terminalDataListenerId = window.api.addTerminalDataListener(baseDir, handleTerminalData);
    const terminalExitListenerId = window.api.addTerminalExitListener(baseDir, handleTerminalExit);

    return () => {
      window.api.removeTerminalDataListener(terminalDataListenerId);
      window.api.removeTerminalExitListener(terminalExitListenerId);
    };
  }, [baseDir, terminalId]);

  // Handle resize when visibility changes
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      // Small delay to ensure the container is properly sized
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
        void window.api.closeTerminal(terminalId);
      }
    };
  }, [terminalId]);

  return (
    <div key={terminalId} className={clsx('absolute inset-0 overflow-hidden bg-[#0a0a0a]', visible ? 'block' : 'hidden', className)}>
      <div ref={terminalRef} className="absolute top-2 left-0 right-0 bottom-2" />
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-neutral-400 text-xs">Connecting to terminal...</div>
        </div>
      )}
    </div>
  );
});

Terminal.displayName = 'Terminal';

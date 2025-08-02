import * as os from 'os';

import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';

import logger from '@/logger';

export interface TerminalInstance {
  id: string;
  baseDir: string;
  ptyProcess: pty.IPty;
  cols: number;
  rows: number;
}

export class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();
  private mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  private getShellCommand(): string {
    const platform = os.platform();

    if (platform === 'win32') {
      // Try PowerShell first, fallback to cmd
      return process.env.SHELL || 'powershell.exe';
    } else {
      // Unix-like systems (Linux, macOS)
      return process.env.SHELL || '/bin/bash';
    }
  }

  private getShellArgs(): string[] {
    const platform = os.platform();

    if (platform === 'win32') {
      const shell = this.getShellCommand();
      if (shell.includes('powershell')) {
        return ['-NoLogo'];
      }
      return [];
    }

    return [];
  }

  public createTerminal(baseDir: string, cols: number = 80, rows: number = 24): string {
    const terminalId = uuidv4();

    try {
      const shell = this.getShellCommand();
      const args = this.getShellArgs();

      logger.info('Creating terminal:', { terminalId, baseDir, shell, args, cols, rows });

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols,
        rows,
        cwd: baseDir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        baseDir,
        ptyProcess,
        cols,
        rows,
      };

      // Handle data from terminal
      ptyProcess.onData((data) => {
        this.mainWindow.webContents.send('terminal-data', {
          terminalId,
          baseDir,
          data,
        });
      });

      // Handle terminal exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info('Terminal exited:', { terminalId, exitCode, signal });
        this.terminals.delete(terminalId);
        if (!this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('terminal-exit', {
            terminalId,
            baseDir,
            exitCode,
            signal,
          });
        }
      });

      this.terminals.set(terminalId, terminal);

      logger.info('Terminal created successfully:', { terminalId, baseDir });
      return terminalId;
    } catch (error) {
      logger.error('Failed to create terminal:', { baseDir, error });
      throw error;
    }
  }

  public writeToTerminal(terminalId: string, data: string): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      logger.warn('Terminal not found for write:', { terminalId });
      return false;
    }

    logger.debug('Writing to terminal:', { terminalId, data });

    try {
      terminal.ptyProcess.write(data);
      return true;
    } catch (error) {
      logger.error('Failed to write to terminal:', { terminalId, error });
      return false;
    }
  }

  public resizeTerminal(terminalId: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      logger.warn('Terminal not found for resize:', { terminalId });
      return false;
    }

    try {
      terminal.ptyProcess.resize(cols, rows);
      terminal.cols = cols;
      terminal.rows = rows;
      logger.debug('Terminal resized:', { terminalId, cols, rows });
      return true;
    } catch (error) {
      logger.error('Failed to resize terminal:', { terminalId, error });
      return false;
    }
  }

  public closeTerminal(terminalId: string): boolean {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      logger.warn('Terminal not found for close:', { terminalId });
      return false;
    }

    try {
      terminal.ptyProcess.kill();
      this.terminals.delete(terminalId);
      logger.info('Terminal closed:', { terminalId });
      return true;
    } catch (error) {
      logger.error('Failed to close terminal:', { terminalId, error });
      return false;
    }
  }

  public closeTerminalForProject(baseDir: string): void {
    const terminalsToClose = Array.from(this.terminals.values()).filter((terminal) => terminal.baseDir === baseDir);

    for (const terminal of terminalsToClose) {
      this.closeTerminal(terminal.id);
    }
  }

  public getTerminalForProject(baseDir: string): TerminalInstance | undefined {
    return Array.from(this.terminals.values()).find((terminal) => terminal.baseDir === baseDir);
  }

  public getTerminalsForProject(baseDir: string): TerminalInstance[] {
    return Array.from(this.terminals.values()).filter((terminal) => terminal.baseDir === baseDir);
  }

  public close(): void {
    logger.info('Closing all terminals');
    const terminalIds = Array.from(this.terminals.keys());
    for (const terminalId of terminalIds) {
      this.closeTerminal(terminalId);
    }
  }
}

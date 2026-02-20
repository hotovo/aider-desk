import * as os from 'os';

import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { v4 as uuidv4 } from 'uuid';

import logger from '@/logger';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { WorktreeManager } from '@/worktrees/worktree-manager';
import { ProjectManager } from '@/project/project-manager';

export interface TerminalInstance {
  id: string;
  baseDir: string;
  taskId: string;
  ptyProcess: pty.IPty;
  cols: number;
  rows: number;
}

export class TerminalManager {
  private terminals: Map<string, TerminalInstance> = new Map();

  constructor(
    private readonly eventManager: EventManager,
    private readonly worktreeManager: WorktreeManager,
    private readonly projectManager: ProjectManager,
    private readonly telemetryManager?: TelemetryManager,
  ) {}

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

  public async createTerminal(baseDir: string, taskId: string, cols: number = 80, rows: number = 24): Promise<string> {
    const terminalId = uuidv4();

    try {
      // First try to get worktree for this task directly
      let worktree = await this.worktreeManager.getTaskWorktree(baseDir, taskId);

      // If no worktree found, check if this is a subtask and inherit parent's worktree
      if (!worktree) {
        const project = this.projectManager.getProject(baseDir);
        const task = project.getTask(taskId);
        if (task?.task.parentId) {
          const parentTask = project.getTask(task.task.parentId);
          if (parentTask?.task.worktree) {
            worktree = parentTask.task.worktree;
          }
        }
      }

      const cwd = worktree ? worktree.path : baseDir;
      const shell = this.getShellCommand();
      const args = this.getShellArgs();

      logger.info('Creating terminal:', { terminalId, baseDir, cwd, shell, args, cols, rows });

      const ptyProcess = pty.spawn(shell, args, {
        name: 'xterm-color',
        cols,
        rows,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });

      const terminal: TerminalInstance = {
        id: terminalId,
        baseDir,
        taskId,
        ptyProcess,
        cols,
        rows,
      };

      // Handle data from terminal
      ptyProcess.onData((data) => {
        this.eventManager.sendTerminalData({
          terminalId,
          baseDir,
          taskId,
          data,
        });
      });

      // Handle terminal exit
      ptyProcess.onExit(({ exitCode, signal }) => {
        logger.info('Terminal exited:', { terminalId, exitCode, signal });
        this.terminals.delete(terminalId);
        this.eventManager.sendTerminalExit({
          terminalId,
          baseDir,
          taskId,
          exitCode,
          signal,
        });
      });

      this.terminals.set(terminalId, terminal);

      logger.info('Terminal created successfully:', { terminalId, baseDir });

      // Capture telemetry event for terminal creation
      this.telemetryManager?.captureTerminalCreated();

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

  public getTerminalForTask(taskId: string): TerminalInstance | undefined {
    return Array.from(this.terminals.values()).find((terminal) => terminal.taskId === taskId);
  }

  public getTerminalsForTask(taskId: string): TerminalInstance[] {
    return Array.from(this.terminals.values()).filter((terminal) => terminal.taskId === taskId);
  }

  public close(): void {
    logger.info('Closing all terminals');
    const terminalIds = Array.from(this.terminals.keys());
    for (const terminalId of terminalIds) {
      this.closeTerminal(terminalId);
    }
  }
}

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { watch, FSWatcher } from 'chokidar';
import { loadFront } from 'yaml-front-matter';

import type { CustomCommand } from '@common/types';

import { AIDER_DESK_COMMANDS_DIR } from '@/constants';
import logger from '@/logger';
import { Project } from '@/project/project';

// Constants for shell command formatting
const SHELL_COMMAND_TAGS = {
  WRAPPER: 'custom-command-bash',
  COMMAND: 'command',
  OUTPUT: 'output',
} as const;

const SHELL_COMMAND_PREFIX = '!';
const SHELL_COMMAND_TIMEOUT = 30000; // 30 seconds
const PLACEHOLDER_PATTERN = /\{\{(\d+)\}\}/g;

export class ShellCommandError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly stderr: string,
    public readonly exitCode?: number,
  ) {
    super(message);
    this.name = 'ShellCommandError';
  }
}

interface ExecError extends Error {
  stdout?: string;
  stderr?: string;
  code?: number;
}

const execAsync = promisify(exec);

export class CustomCommandManager {
  private commands: Map<string, CustomCommand> = new Map();
  private watchers: FSWatcher[] = [];

  constructor(private readonly project: Project) {
    this.initializeCommands();
    this.setupFileWatchers();
  }

  private initializeCommands(): void {
    this.commands.clear();

    const globalCommandsDir = path.join(homedir(), AIDER_DESK_COMMANDS_DIR);
    this.loadCommandsFromDir(globalCommandsDir, this.commands);

    // Load project-specific commands (these will overwrite global ones with same name)
    const projectCommandsDir = path.join(this.project.baseDir, AIDER_DESK_COMMANDS_DIR);
    this.loadCommandsFromDir(projectCommandsDir, this.commands);

    this.notifyCommandsUpdated();
  }

  private setupFileWatchers(): void {
    // Clean up existing watchers
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];

    // Watch global commands directory
    const globalCommandsDir = path.join(homedir(), AIDER_DESK_COMMANDS_DIR);
    this.setupWatcherForDirectory(globalCommandsDir);

    // Watch project-specific commands directory
    const projectCommandsDir = path.join(this.project.baseDir, AIDER_DESK_COMMANDS_DIR);
    this.setupWatcherForDirectory(projectCommandsDir);
  }

  private setupWatcherForDirectory(commandsDir: string): void {
    // Create directory if it doesn't exist
    if (!fs.existsSync(commandsDir)) {
      try {
        fs.mkdirSync(commandsDir, { recursive: true });
      } catch (err) {
        logger.error(`Failed to create commands directory ${commandsDir}: ${err}`);
        return;
      }
    }

    const watcher = watch(commandsDir, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on('add', () => {
        this.reloadCommands();
      })
      .on('change', () => {
        this.reloadCommands();
      })
      .on('unlink', () => {
        this.reloadCommands();
      })
      .on('error', (error) => {
        logger.error(`Watcher error for ${commandsDir}: ${error}`);
      });

    this.watchers.push(watcher);
  }

  private reloadCommands(): void {
    logger.info('Reloading commands...');
    this.initializeCommands();
  }

  private notifyCommandsUpdated(): void {
    this.project.sendCustomCommandsUpdated(Array.from(this.commands.values()));
  }

  private loadCommandsFromDir(commandsDir: string, commands: Map<string, CustomCommand>) {
    if (!fs.existsSync(commandsDir)) {
      return;
    }

    try {
      const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        this.loadCommandFile(path.join(commandsDir, file), commands);
      }
    } catch (err) {
      logger.error(`Failed to read commands directory ${commandsDir}: ${err}`);
    }
  }

  private loadCommandFile(filePath: string, commands: Map<string, CustomCommand>) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = loadFront(content);
      if (!parsed.description) {
        logger.warn(`Command file ${filePath} is missing a description`);
      }
      const name = path.basename(filePath, '.md');
      const args = Array.isArray(parsed.arguments) ? parsed.arguments : [];
      const template = parsed.__content?.trim() || '';
      const includeContext = typeof parsed.includeContext === 'boolean' ? parsed.includeContext : true;
      commands.set(name, {
        name,
        description: parsed.description || 'Not specified',
        arguments: args,
        template,
        includeContext,
      });
    } catch (err) {
      logger.error(`Failed to parse command file ${filePath}: ${err}`);
      // Optionally: send error to chat window via IPC or callback
    }
  }

  getCommand(name: string): CustomCommand | undefined {
    return this.commands.get(name);
  }

  getAllCommands(): CustomCommand[] {
    return Array.from(this.commands.values());
  }

  async processCommandTemplate(command: CustomCommand, args: string[]): Promise<string> {
    let prompt = this.substituteArguments(command.template, args, command.arguments);
    prompt = await this.executeShellCommands(prompt);
    return prompt;
  }

  private substituteArguments(template: string, args: string[], commandArgs: CustomCommand['arguments']): string {
    let prompt = template;

    // First, substitute provided arguments
    for (let i = 0; i < args.length; i++) {
      const value = args[i] !== undefined ? args[i] : '';
      prompt = prompt.replaceAll(`{{${i + 1}}}`, value);
    }

    // Handle any remaining placeholders that weren't substituted
    const unreplacedPlaceholders = this.findUnreplacedPlaceholders(template, args.length);

    // Replace unreplaced placeholders with empty strings for optional arguments
    for (const placeholderIndex of unreplacedPlaceholders) {
      const isOptional = commandArgs[placeholderIndex - 1]?.required === false;
      if (isOptional) {
        prompt = prompt.replaceAll(`{{${placeholderIndex}}}`, '');
      }
    }

    return prompt;
  }

  private findUnreplacedPlaceholders(template: string, argsLength: number): number[] {
    const unreplacedPlaceholders: number[] = [];
    let match: RegExpExecArray | null;
    const pattern = new RegExp(PLACEHOLDER_PATTERN);

    while ((match = pattern.exec(template)) !== null) {
      const placeholderIndex = parseInt(match[1]);
      if (placeholderIndex > argsLength) {
        unreplacedPlaceholders.push(placeholderIndex);
      }
    }

    return unreplacedPlaceholders;
  }

  private async executeShellCommands(prompt: string): Promise<string> {
    const lines = prompt.split('\n');
    const finalPrompt: string[] = [];

    for (const line of lines) {
      if (line.startsWith(SHELL_COMMAND_PREFIX)) {
        const processedLine = await this.processShellCommandLine(line);
        if (Array.isArray(processedLine)) {
          finalPrompt.push(...processedLine);
        } else {
          finalPrompt.push(processedLine);
        }
      } else {
        finalPrompt.push(line);
      }
    }

    return finalPrompt.join('\n');
  }

  private async processShellCommandLine(line: string): Promise<string | string[]> {
    const commandPortion = line.substring(SHELL_COMMAND_PREFIX.length).trim();

    if (!commandPortion) {
      // Handle edge case: line with just '!' or '! ' (space after)
      logger.debug('Detected shell command line with no command:', { line });
      return line;
    }

    try {
      logger.debug('Executing shell command:', { command: commandPortion });

      const { stdout } = await execAsync(commandPortion, {
        cwd: this.project.baseDir,
        timeout: SHELL_COMMAND_TIMEOUT,
      });

      logger.info('Shell command executed successfully:', {
        command: commandPortion,
        stdout: stdout.trim().slice(0, 100),
      });

      return this.formatShellOutput(commandPortion, stdout.trim());
    } catch (error) {
      logger.error('Shell command execution failed:', {
        command: commandPortion,
        error: error instanceof Error ? error.message : String(error),
      });

      const { stderr, exitCode } = this.extractErrorDetails(error);
      throw new ShellCommandError(`Shell command failed: ${commandPortion}`, commandPortion, stderr, exitCode);
    }
  }

  private extractErrorDetails(error: unknown): { stderr: string; exitCode?: number } {
    if (this.isExecError(error)) {
      return {
        stderr: error.stderr || error.message || String(error),
        exitCode: error.code,
      };
    }

    return {
      stderr: error instanceof Error ? error.message : String(error),
    };
  }

  private isExecError(error: unknown): error is ExecError {
    return error !== null && typeof error === 'object' && 'stderr' in error && 'code' in error;
  }

  private formatShellOutput(command: string, output: string): string[] {
    return [
      `<${SHELL_COMMAND_TAGS.WRAPPER}>`,
      `<${SHELL_COMMAND_TAGS.COMMAND}>${command}</${SHELL_COMMAND_TAGS.COMMAND}>`,
      `<${SHELL_COMMAND_TAGS.OUTPUT}>`,
      output,
      `</${SHELL_COMMAND_TAGS.OUTPUT}>`,
      `</${SHELL_COMMAND_TAGS.WRAPPER}>`,
    ];
  }

  dispose(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
  }
}

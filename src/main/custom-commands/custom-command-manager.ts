import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

import { watch, FSWatcher } from 'chokidar';
import { loadFront } from 'yaml-front-matter';
import debounce from 'lodash/debounce';

import type { CommandArgument, CustomCommand } from '@common/types';

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

  constructor(private readonly project: Project) {}

  public async start(): Promise<void> {
    await this.initializeCommands();
    await this.setupFileWatchers();
  }

  private async initializeCommands(): Promise<void> {
    this.commands.clear();

    const globalCommandsDir = path.join(homedir(), AIDER_DESK_COMMANDS_DIR);
    await this.loadCommandsFromDir(globalCommandsDir, this.commands);

    // Load project-specific commands (these will overwrite global ones with same name)
    const projectCommandsDir = path.join(this.project.baseDir, AIDER_DESK_COMMANDS_DIR);
    await this.loadCommandsFromDir(projectCommandsDir, this.commands);

    this.notifyCommandsUpdated();
  }

  private async setupFileWatchers(): Promise<void> {
    // Clean up existing watchers
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];

    // Watch global commands directory
    const globalCommandsDir = path.join(homedir(), AIDER_DESK_COMMANDS_DIR);
    await this.setupWatcherForDirectory(globalCommandsDir);

    // Watch project-specific commands directory
    const projectCommandsDir = path.join(this.project.baseDir, AIDER_DESK_COMMANDS_DIR);
    await this.setupWatcherForDirectory(projectCommandsDir);
  }

  private async setupWatcherForDirectory(commandsDir: string): Promise<void> {
    // Create directory if it doesn't exist
    const dirExists = await fs
      .access(commandsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      try {
        await fs.mkdir(commandsDir, { recursive: true });
      } catch (err) {
        logger.error(`Failed to create commands directory ${commandsDir}: ${err}`);
        return;
      }
    }

    const watcher = watch(commandsDir, {
      persistent: true,
      usePolling: true,
      ignoreInitial: true,
    });

    watcher
      .on('add', async () => {
        await this.debounceReloadCommands();
      })
      .on('change', async () => {
        await this.debounceReloadCommands();
      })
      .on('unlink', async () => {
        await this.debounceReloadCommands();
      })
      .on('error', (error) => {
        logger.error(`Watcher error for ${commandsDir}: ${error}`);
      });

    this.watchers.push(watcher);
  }

  private debounceReloadCommands = debounce(async () => {
    await this.reloadCommands();
  }, 1000);

  private async reloadCommands(): Promise<void> {
    logger.info('Reloading commands...');
    await this.initializeCommands();
  }

  private notifyCommandsUpdated(): void {
    this.project.sendCommandsUpdated();
  }

  private async loadCommandsFromDir(commandsDir: string, commands: Map<string, CustomCommand>): Promise<void> {
    const dirExists = await fs
      .access(commandsDir)
      .then(() => true)
      .catch(() => false);
    if (!dirExists) {
      return;
    }

    try {
      await this.loadCommandsRecursively(commandsDir, commands, commandsDir);
    } catch (err) {
      logger.error(`Failed to read commands directory ${commandsDir}: ${err}`);
    }
  }

  private async loadCommandsRecursively(dir: string, commands: Map<string, CustomCommand>, baseDir: string, prefix = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.loadCommandsRecursively(fullPath, commands, baseDir, `${prefix}${entry.name}:`);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = `${prefix}${path.basename(entry.name, '.md')}`;
        await this.loadCommandFile(fullPath, name, commands);
      }
    }
  }

  private async loadCommandFile(filePath: string, name: string, commands: Map<string, CustomCommand>): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = loadFront(content);
      if (!parsed.description) {
        logger.warn(`Command file ${filePath} is missing a description`);
      }
      const args = Array.isArray(parsed.arguments) ? parsed.arguments : [];
      const template = parsed.__content?.trim() || '';
      const includeContext = typeof parsed.includeContext === 'boolean' ? parsed.includeContext : true;
      const autoApprove = typeof parsed.autoApprove === 'boolean' ? parsed.autoApprove : undefined;
      commands.set(name, {
        name,
        description: parsed.description || 'Not specified',
        arguments: args,
        template,
        includeContext,
        autoApprove,
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

  private substituteArguments(template: string, args: string[], commandArgs: CommandArgument[]): string {
    let prompt = template;

    // First, substitute {{ARGUMENTS}} placeholder with all arguments joined by spaces
    if (template.includes('{{ARGUMENTS}}')) {
      const allArguments = args.join(' ');
      prompt = prompt.replaceAll('{{ARGUMENTS}}', allArguments);
    }

    // Then, substitute provided arguments
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
      logger.info('Executing shell command from custom command:', { command: commandPortion });

      const { stdout } = await execAsync(commandPortion, {
        cwd: this.project.baseDir,
        timeout: SHELL_COMMAND_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
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

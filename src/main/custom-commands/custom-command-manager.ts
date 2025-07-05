import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

import { watch, FSWatcher } from 'chokidar';
import { loadFront } from 'yaml-front-matter';

import type { CustomCommand } from '@common/types';

import { AIDER_DESK_COMMANDS_DIR } from '@/constants';
import logger from '@/logger';
import { Project } from '@/project/project';

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
      commands.set(name, { name, description: parsed.description || 'Not specified', arguments: args, template });
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

  dispose(): void {
    this.watchers.forEach((watcher) => watcher.close());
    this.watchers = [];
  }
}

import fs from 'fs/promises';
import path from 'path';

import { CustomCommand, FileEdit, InputHistoryData, SettingsData, StartupMode } from '@common/types';
import { fileExists } from '@common/utils';

import { getAllFiles } from '@/utils/file-system';
import { McpManager } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { MessageAction } from '@/messages';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { CustomCommandManager } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { Task } from '@/task';

export class Project {
  private readonly customCommandManager: CustomCommandManager;
  private readonly tasks = new Map<string, Task>();

  private connectors: Connector[] = [];
  private inputHistoryFile = '.aider.input.history';

  constructor(
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
  ) {
    this.customCommandManager = new CustomCommandManager(this);
  }

  public async start(startupMode?: StartupMode) {
    const settings = this.store.getSettings();
    const mode = startupMode ?? settings.startupMode;

    try {
      // Handle different startup modes
      switch (mode) {
        case StartupMode.Empty:
          // Don't load any session, start fresh
          logger.info('Starting with empty session');
          break;

        case StartupMode.Last:
          // Load the autosaved session
          logger.info('Loading autosaved session');
          break;
      }
    } catch (error) {
      logger.error('Error loading session:', { error });
    }

    if (!this.getTask('default')) {
      await this.createTask('default');
    }

    this.eventManager.sendProjectStarted(this.baseDir);
  }

  private async createTask(taskId: string) {
    const task = new Task(
      this,
      taskId,
      this.store,
      this.mcpManager,
      this.customCommandManager,
      this.telemetryManager,
      this.dataManager,
      this.eventManager,
      this.modelManager,
    );
    this.tasks.set(taskId, task);

    await task.start();

    this.eventManager.sendTaskCreated(task.task);
  }

  public getTask(taskId: string = 'default') {
    return this.tasks.get(taskId) || null;
  }

  public getDefaultTask() {
    return this.getTask('default')!;
  }

  public getProjectSettings() {
    return this.store.getProjectSettings(this.baseDir);
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
      source: connector.source,
    });

    this.connectors.push(connector);

    if (connector.taskId) {
      this.tasks.get(connector.taskId)?.addConnector(connector);
    }

    // Set input history file if provided by the connector
    if (connector.inputHistoryFile) {
      this.inputHistoryFile = connector.inputHistoryFile;
      void this.sendInputHistoryUpdatedEvent();
    }
  }

  public removeConnector(connector: Connector) {
    this.connectors = this.connectors.filter((c) => c !== connector);
  }

  private findMessageConnectors(action: MessageAction): Connector[] {
    return this.connectors.filter((connector) => connector.listenTo.includes(action));
  }

  public async loadInputHistory(): Promise<string[]> {
    try {
      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      if (!(await fileExists(historyPath))) {
        return [];
      }

      const content = await fs.readFile(historyPath, 'utf8');

      if (!content) {
        return [];
      }

      const history: string[] = [];
      const lines = content.split('\n');
      let currentInput = '';

      for (const line of lines) {
        if (line.startsWith('# ')) {
          if (currentInput) {
            history.push(currentInput.trim());
            currentInput = '';
          }
        } else if (line.startsWith('+')) {
          currentInput += line.substring(1) + '\n';
        }
      }

      if (currentInput) {
        history.push(currentInput.trim());
      }

      return history.reverse();
    } catch (error) {
      logger.error('Failed to load input history:', { error });
      return [];
    }
  }

  public async addToInputHistory(message: string) {
    try {
      const history = await this.loadInputHistory();
      if (history.length > 0 && history[0] === message) {
        return;
      }

      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

      const timestamp = new Date().toISOString();
      const formattedMessage = `\n# ${timestamp}\n+${message.replace(/\n/g, '\n+')}\n`;

      await fs.appendFile(historyPath, formattedMessage);

      await this.sendInputHistoryUpdatedEvent();
    } catch (error) {
      logger.error('Failed to add to input history:', { error });
    }
  }

  private async sendInputHistoryUpdatedEvent() {
    const history = await this.loadInputHistory();
    const inputHistoryData: InputHistoryData = {
      baseDir: this.baseDir,
      messages: history,
    };
    this.eventManager.sendInputHistoryUpdated(inputHistoryData);
  }

  public async updateAutocompletionData(words: string[], models: string[]) {
    this.eventManager.sendUpdateAutocompletion(this.baseDir, words, await getAllFiles(this.baseDir), models);
  }

  public async getAddableFiles(searchRegex?: string): Promise<string[]> {
    let files = await getAllFiles(this.baseDir);

    if (searchRegex) {
      try {
        const regex = new RegExp(searchRegex, 'i');
        files = files.filter((file) => regex.test(file));
      } catch (error) {
        logger.error('Invalid regex for getAddableFiles', {
          searchRegex,
          error,
        });
      }
    }

    return files;
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public getCustomCommands() {
    return this.customCommandManager.getAllCommands();
  }

  public sendCustomCommandsUpdated(commands: CustomCommand[]) {
    this.eventManager.sendCustomCommandsUpdated(this.baseDir, commands);
  }

  async close() {}

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.tasks.forEach((task) => {
      task.settingsChanged(oldSettings, newSettings);
    });
  }
}

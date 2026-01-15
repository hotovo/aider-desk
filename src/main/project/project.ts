import fs from 'fs/promises';
import path from 'path';

import { CustomCommand, ProjectSettings, SettingsData, TaskData, CreateTaskParams } from '@common/types';
import { fileExists } from '@common/utils';
import { v4 as uuidv4 } from 'uuid';

import { AgentProfileManager, McpManager } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { CustomCommandManager } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { INTERNAL_TASK_ID, Task } from '@/task';
import { migrateSessionsToTasks } from '@/project/migrations';
import { WorktreeManager } from '@/worktrees';
import { MemoryManager } from '@/memory/memory-manager';
import { HookManager } from '@/hooks/hook-manager';
import { PromptsManager } from '@/prompts';
import { AIDER_DESK_WATCH_FILES_LOCK } from '@/constants';
import { determineMainModel, determineWeakModel } from '@/utils';

export class Project {
  private readonly customCommandManager: CustomCommandManager;
  private readonly tasksLoadingPromise: Promise<void> | null = null;
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
    private readonly worktreeManager: WorktreeManager,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly memoryManager: MemoryManager,
    private readonly hookManager: HookManager,
    private readonly promptsManager: PromptsManager,
  ) {
    this.customCommandManager = new CustomCommandManager(this);
    // initialize global task
    this.prepareTask(INTERNAL_TASK_ID);
    this.tasksLoadingPromise = this.loadTasks();
  }

  public async start() {
    await this.customCommandManager.start();
    await this.promptsManager.watchProject(this.baseDir);
    await this.agentProfileManager.initializeForProject(this.baseDir);
    await this.sendInputHistoryUpdatedEvent();

    this.eventManager.sendProjectStarted(this.baseDir);
  }

  public async createNewTask(params?: CreateTaskParams) {
    const normalizedParams = {
      ...params,
      parentId: params?.parentId || null,
      name: params?.name || '',
    };

    let parentTask: Task | null = null;
    if (normalizedParams.parentId) {
      parentTask = this.getTask(normalizedParams.parentId);
      if (!parentTask) {
        throw new Error(`Parent task with id ${normalizedParams.parentId} not found`);
      }
    }

    const sourceTask = parentTask || this.getMostRecentTask();
    let initialTaskData: Partial<TaskData>;

    if (sourceTask) {
      initialTaskData = {
        mainModel: sourceTask.task.mainModel,
        weakModel: sourceTask.task.weakModel,
        architectModel: sourceTask.task.architectModel,
        reasoningEffort: sourceTask.task.reasoningEffort,
        thinkingTokens: sourceTask.task.thinkingTokens,
        currentMode: sourceTask.task.currentMode,
        contextCompactingThreshold: sourceTask.task.contextCompactingThreshold,
        weakModelLocked: sourceTask.task.weakModelLocked,
        ...(parentTask
          ? {
              workingMode: parentTask.task.workingMode,
              worktree: parentTask.task.worktree,
            }
          : {}),
        ...normalizedParams,
      };
    } else {
      const providerModels = await this.modelManager.getProviderModels();
      initialTaskData = {
        mainModel: determineMainModel(this.store.getSettings(), this.store.getProviders(), providerModels.models || [], this.baseDir),
        weakModel: determineWeakModel(this.baseDir),
        currentMode: 'agent',
        ...normalizedParams,
      };
    }

    const projectSettings = this.getProjectSettings();
    const task = this.prepareTask(undefined, {
      ...initialTaskData,
      autoApprove: projectSettings.autoApproveLocked ? true : initialTaskData?.autoApprove,
    });
    this.eventManager.sendTaskCreated(task.task);

    const internalTask = this.getTask(INTERNAL_TASK_ID);
    if (internalTask) {
      // adding files from internal task that keeps track of files to new task
      const contextFiles = await internalTask.getContextFiles();
      contextFiles.forEach((file) => {
        task.addFile(file);
      });
    }

    return task.task;
  }

  private prepareTask(taskId: string = uuidv4(), initialTaskData?: Partial<TaskData>) {
    const task = new Task(
      this,
      taskId,
      this.store,
      this.mcpManager,
      this.customCommandManager,
      this.agentProfileManager,
      this.telemetryManager,
      this.dataManager,
      this.eventManager,
      this.modelManager,
      this.worktreeManager,
      this.memoryManager,
      this.hookManager,
      this.promptsManager,
      initialTaskData,
    );
    this.tasks.set(taskId, task);

    void task.hookManager.trigger('onTaskCreated', { task: task.task }, task, this);

    return task;
  }

  private async loadTasks() {
    // Migrate sessions to tasks before starting
    await migrateSessionsToTasks(this);

    const tasksDir = path.join(this.baseDir, '.aider-desk', 'tasks');

    try {
      if (!(await fileExists(tasksDir))) {
        logger.debug('Tasks directory does not exist, skipping loadTasks', {
          baseDir: this.baseDir,
          tasksDir,
        });
        return;
      }

      const taskFolders = await fs.readdir(tasksDir, { withFileTypes: true });
      const taskDirs = taskFolders
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name)
        .filter((taskId) => taskId !== INTERNAL_TASK_ID);

      logger.info(`Loading ${taskDirs.length} tasks from directory`, {
        baseDir: this.baseDir,
        tasksDir,
        taskIds: taskDirs,
      });

      for (const taskId of taskDirs) {
        this.prepareTask(taskId);
      }

      logger.info('Successfully loaded tasks', {
        baseDir: this.baseDir,
        loadedTasks: taskDirs.length,
      });
    } catch (error) {
      logger.error('Failed to load tasks', {
        baseDir: this.baseDir,
        tasksDir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public getMostRecentTask() {
    return Array.from(this.tasks.values()).sort((a, b) => {
      if (!a.task.updatedAt) {
        return 1;
      }
      if (!b.task.updatedAt) {
        return -1;
      }
      return b.task.updatedAt.localeCompare(a.task.updatedAt);
    })[0];
  }

  public getTask(taskId: string = INTERNAL_TASK_ID) {
    const task = this.tasks.get(taskId);
    if (!task) {
      logger.warn('Task not found', {
        baseDir: this.baseDir,
        taskId,
      });
    }
    return task || null;
  }

  public getInternalTask() {
    return this.getTask(INTERNAL_TASK_ID);
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

    if (connector.taskId) {
      this.tasks.get(connector.taskId)?.removeConnector(connector);
    }
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
    this.eventManager.sendInputHistoryUpdated(this.baseDir, INTERNAL_TASK_ID, history);
  }

  public getCustomCommands() {
    return this.customCommandManager.getAllCommands();
  }

  public sendCustomCommandsUpdated(commands: CustomCommand[]) {
    this.eventManager.sendCustomCommandsUpdated(this.baseDir, INTERNAL_TASK_ID, commands);
  }

  private async deleteTaskInternal(taskId: string): Promise<void> {
    const taskDir = path.join(this.baseDir, '.aider-desk', 'tasks', taskId);

    // Close the task if it's loaded
    const task = this.tasks.get(taskId);
    if (task) {
      await task.close();
      this.tasks.delete(taskId);
      this.eventManager.sendTaskDeleted(task.task);
    }

    // Delete the task directory
    await fs.rm(taskDir, { recursive: true, force: true });
  }

  public async deleteTask(taskId: string): Promise<void> {
    try {
      // First, find and delete all subtasks recursively
      const allTasks = await this.getTasks();
      const subtasks = allTasks.filter((t) => t.parentId === taskId);

      for (const subtask of subtasks) {
        await this.deleteTaskInternal(subtask.id);
        logger.info('Successfully deleted subtask', {
          baseDir: this.baseDir,
          parentTaskId: taskId,
          subtaskId: subtask.id,
        });
      }

      // Then delete the parent task
      await this.deleteTaskInternal(taskId);

      logger.info('Successfully deleted task with subtasks', {
        baseDir: this.baseDir,
        taskId,
        subtaskCount: subtasks.length,
      });
    } catch (error) {
      logger.error('Failed to delete task:', {
        baseDir: this.baseDir,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  public async duplicateTask(taskId: string): Promise<TaskData> {
    const sourceTask = this.tasks.get(taskId);
    if (!sourceTask) {
      throw new Error(`Task with id ${taskId} not found`);
    }

    const newTask = this.prepareTask(undefined, sourceTask.task);
    await newTask.duplicateFrom(sourceTask);
    this.eventManager.sendTaskCreated(newTask.task);
    await newTask.init();

    return newTask.task;
  }

  async getTasks(): Promise<TaskData[]> {
    await this.tasksLoadingPromise;

    return Array.from(this.tasks.values())
      .map((task) => task.task)
      .filter((task) => task.id !== INTERNAL_TASK_ID);
  }

  forEachTask(callback: (task: Task) => void, initializedOnly = true) {
    this.tasks
      .values()
      .filter((task) => !initializedOnly || task.isInitialized())
      .forEach(callback);
  }

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    this.forEachTask((task) => {
      void task.settingsChanged(oldSettings, newSettings);
    });
  }

  async projectSettingsChanged(oldSettings: ProjectSettings, newSettings: ProjectSettings) {
    this.forEachTask((task) => {
      void task.projectSettingsChanged(oldSettings, newSettings);
    });
  }

  async close() {
    this.customCommandManager.dispose();
    this.agentProfileManager.removeProject(this.baseDir);
    await this.hookManager.stopWatchingProject(this.baseDir);
    await this.promptsManager.unwatchProject(this.baseDir);
    await Promise.all(Array.from(this.tasks.values()).map((task) => task.close()));
    await this.worktreeManager.close(this.baseDir);

    // Remove watch-files lock file if it exists
    const lockFilePath = path.join(this.baseDir, AIDER_DESK_WATCH_FILES_LOCK);
    try {
      await fs.unlink(lockFilePath);
      logger.debug('Removed watch-files lock file', { lockFilePath });
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to remove watch-files lock file', { lockFilePath, error });
      }
    }
  }
}

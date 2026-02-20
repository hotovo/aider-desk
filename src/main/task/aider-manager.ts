import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { EditFormat, ModelsData } from '@common/types';
import { fileExists } from '@common/utils';
import treeKill from 'tree-kill';
import { DEFAULT_AIDER_MAIN_MODEL } from '@common/agent';

import { AIDER_DESK_CONNECTOR_DIR, AIDER_DESK_PROJECT_RULES_DIR, AIDER_DESK_TASKS_DIR, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from '@/constants';
import { Connector } from '@/connector';
import logger from '@/logger';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { EventManager } from '@/events';
import { getEnvironmentVariablesForAider } from '@/utils';
import { Task } from '@/task/task';

export class AiderManager {
  private aiderProcess: ChildProcessWithoutNullStreams | null = null;
  private aiderStarting: boolean = false;
  private aiderStartPromise: Promise<void> | null = null;
  private aiderStartResolve: (() => void) | null = null;
  private aiderModelsData: ModelsData | null = null;
  private currentCommand: string | null = null;
  private commandOutputs: Map<string, string> = new Map();
  private repoMap: string = '';

  constructor(
    private readonly task: Task,
    private readonly store: Store,
    private readonly modelManager: ModelManager,
    private readonly eventManager: EventManager,
    private readonly getConnectors: () => Connector[],
  ) {}

  public async start(forceRestart = false): Promise<void> {
    if (this.aiderProcess) {
      if (!forceRestart) {
        return;
      }
      await this.kill();
    }

    await this.checkAndCleanupPidFile();

    // Set aiderStarting to true when starting aider
    this.aiderStarting = true;

    const settings = this.store.getSettings();
    const projectSettings = this.store.getProjectSettings(this.task.getProjectDir());
    const mainModel = this.task.task.mainModel || DEFAULT_AIDER_MAIN_MODEL;
    const weakModel = this.task.task.weakModel;
    const modelEditFormats = projectSettings.modelEditFormats;
    const reasoningEffort = this.task.task.reasoningEffort;
    const thinkingTokens = this.task.task.thinkingTokens;
    const environmentVariables = getEnvironmentVariablesForAider(settings, this.task.getProjectDir());

    const mainModelMapping = this.modelManager.getAiderModelMapping(mainModel, this.task.getProjectDir());
    const mainModelName = mainModelMapping.modelName;
    const envFromMain = mainModelMapping.environmentVariables;

    let envFromWeak = {};
    let weakModelName: string | null = null;
    if (weakModel) {
      const weakModelMapping = this.modelManager.getAiderModelMapping(weakModel, this.task.getProjectDir());
      weakModelName = weakModelMapping.modelName;
      envFromWeak = weakModelMapping.environmentVariables;
    }

    logger.info('Running Aider for project', {
      baseDir: this.task.getProjectDir(),
      taskId: this.task.task.id,
      taskDir: this.task.getTaskDir(),
      mainModel: mainModelName,
      weakModel: weakModelName,
      reasoningEffort,
      thinkingTokens,
    });

    const rawOptionsArgs = (settings.aider.options.match(/(?:[^\s"]+|"[^"]*")+/g) as string[]) || [];
    const optionsArgsSet = new Set(rawOptionsArgs);

    const processedOptionsArgs: string[] = [];
    for (let i = 0; i < rawOptionsArgs.length; i++) {
      const arg = rawOptionsArgs[i];
      if (arg === '--model') {
        i++; // Skip the model value
      } else {
        processedOptionsArgs.push(arg.startsWith('"') && arg.endsWith('"') ? arg.slice(1, -1) : arg);
      }
    }

    const args = ['-m', 'connector'];

    args.push(...processedOptionsArgs);

    args.push('--no-check-update', '--no-show-model-warnings');
    args.push('--model', mainModelName);

    if (weakModelName) {
      args.push('--weak-model', weakModelName);
    }

    args.push('--edit-format', modelEditFormats[mainModel] || 'diff');

    if (reasoningEffort != null && !optionsArgsSet.has('--reasoning-effort')) {
      args.push('--reasoning-effort', reasoningEffort);
    }

    if (thinkingTokens != null && !optionsArgsSet.has('--thinking-tokens')) {
      args.push('--thinking-tokens', thinkingTokens);
    }

    const rulesDir = path.join(this.task.getProjectDir(), AIDER_DESK_PROJECT_RULES_DIR);
    if (settings.aider.addRuleFiles && (await fileExists(rulesDir))) {
      args.push('--read', rulesDir);
    }

    if (!optionsArgsSet.has('--auto-commits') && !optionsArgsSet.has('--no-auto-commits')) {
      args.push(settings.aider.autoCommits ? '--auto-commits' : '--no-auto-commits');
    }

    if (!optionsArgsSet.has('--watch-files') && !optionsArgsSet.has('--no-watch-files')) {
      args.push(settings.aider.watchFiles ? '--watch-files' : '--no-watch-files');
    }

    if (!optionsArgsSet.has('--cache-prompts') && !optionsArgsSet.has('--no-cache-prompts')) {
      args.push(settings.aider.cachingEnabled ? '--cache-prompts' : '--no-cache-prompts');
    }

    if (!optionsArgsSet.has('--chat-history-file')) {
      args.push('--chat-history-file', path.join(this.task.getProjectDir(), AIDER_DESK_TASKS_DIR, this.task.taskId, '.aider.chat.history.md'));
    }

    logger.info('Running Aider with args:', {
      dir: this.task.getTaskDir(),
      taskId: this.task.taskId,
      args,
    });

    const env = {
      ...process.env,
      ...environmentVariables,
      ...envFromMain,
      ...envFromWeak,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      PYTHONUTF8: process.env.AIDER_DESK_OMIT_PYTHONUTF8 ? undefined : '1',
      BASE_DIR: this.task.getProjectDir(),
      TASK_ID: this.task.task.id,
      TASK_DIR: this.task.getTaskDir(),
      CONNECTOR_SERVER_URL: `http://localhost:${SERVER_PORT}`,
      CONNECTOR_CONFIRM_BEFORE_EDIT: settings.aider.confirmBeforeEdit ? '1' : '0',
    };

    // Spawn without shell to have direct process control
    this.aiderProcess = spawn(PYTHON_COMMAND, args, {
      cwd: this.task.getTaskDir(),
      detached: false,
      env,
    });

    logger.info('Starting Aider...', {
      baseDir: this.task.getTaskDir(),
      taskId: this.task.task.id,
    });
    this.aiderProcess.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug('Aider output:', { output });

      if (this.currentCommand) {
        this.addCommandOutput(this.currentCommand, output);
      }
    });

    this.aiderProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.startsWith('Warning:')) {
        logger.debug('Aider warning:', { output });
        return;
      }
      if (output.startsWith('usage:')) {
        logger.debug('Aider usage:', { output });
        return;
      }
      if (output.trim().startsWith('Scanning repo:')) {
        logger.debug('Aider repo scan:', { output });
        return;
      }

      logger.error('Aider stderr:', {
        baseDir: this.task.getTaskDir(),
        taskId: this.task.task.id,
        error: output,
      });
    });

    this.aiderProcess.on('close', (code) => {
      logger.info('Aider process exited:', {
        baseDir: this.task.getTaskDir(),
        taskId: this.task.task.id,
        code,
      });
    });

    void this.writeAiderProcessPidFile();
  }

  public async kill(): Promise<void> {
    if (this.aiderProcess) {
      logger.info('Killing Aider...', {
        baseDir: this.task.getTaskDir(),
        taskId: this.task.task.id,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          treeKill(this.aiderProcess!.pid!, 'SIGKILL', (err) => {
            if (err) {
              logger.error('Error killing Aider process:', {
                baseDir: this.task.getTaskDir(),
                taskId: this.task.task.id,
                error: err,
              });
              reject(err);
            } else {
              this.removeAiderProcessPidFile();
              resolve();
            }
          });
        });

        this.currentCommand = null;
      } catch (error) {
        logger.error('Error killing Aider process:', {
          baseDir: this.task.getTaskDir(),
          taskId: this.task.task.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        this.aiderProcess = null;
      }
    }
  }

  public isStarted(): boolean {
    return !!this.aiderProcess;
  }

  private createAiderStartPromise(): Promise<void> {
    if (this.aiderStartPromise) {
      return this.aiderStartPromise;
    }

    this.aiderStartPromise = new Promise((resolve) => {
      this.aiderStartResolve = resolve;
      if (!this.aiderStarting) {
        resolve();
      }
    });
    return this.aiderStartPromise;
  }

  public async waitForStart(): Promise<void> {
    if (!this.isStarted()) {
      await this.start();
    }

    await this.createAiderStartPromise();
  }

  private getAiderProcessPidFilePath(): string {
    const hash = createHash('sha256').update(this.task.getProjectDir()).update(this.task.task.id).digest('hex');
    return path.join(PID_FILES_DIR, `${hash}.pid`);
  }

  private async writeAiderProcessPidFile(): Promise<void> {
    try {
      await fs.mkdir(PID_FILES_DIR, { recursive: true });

      if (this.aiderProcess?.pid) {
        logger.info('Writing PID file:', {
          baseDir: this.task.getProjectDir(),
          taskId: this.task.task.id,
          pid: this.aiderProcess.pid,
        });
        await fs.writeFile(this.getAiderProcessPidFilePath(), this.aiderProcess.pid.toString());
      }
    } catch (error) {
      logger.error('Failed to write PID file:', {
        baseDir: this.task.getProjectDir(),
        taskId: this.task.task.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private removeAiderProcessPidFile() {
    try {
      unlinkSync(this.getAiderProcessPidFilePath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to remove PID file:', {
          baseDir: this.task.getProjectDir(),
          taskId: this.task.task.id,
          error,
        });
      }
    }
  }

  private async checkAndCleanupPidFile(): Promise<void> {
    const pidFilePath = this.getAiderProcessPidFilePath();
    try {
      if (await fileExists(pidFilePath)) {
        const pid = parseInt(await fs.readFile(pidFilePath, 'utf8'));
        await new Promise<void>((resolve, reject) => {
          treeKill(pid, 'SIGKILL', (err) => {
            if (err && !err.message.includes('No such process')) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        await fs.unlink(pidFilePath);
      }
    } catch (error) {
      logger.error('Error cleaning up old PID file:', {
        baseDir: this.task.getProjectDir(),
        taskId: this.task.task.id,
        error,
      });
    }
  }

  public handleConnectorAdded(connector: Connector): void {
    // Set aiderStarting to false when a connector with source==='aider' is added
    if (connector.source === 'aider') {
      this.aiderStarting = false;
      if (this.aiderStartResolve) {
        this.aiderStartResolve();
        this.aiderStartResolve = null;
        this.aiderStartPromise = null;
      }
    }
  }

  public updateAiderModels(modelsData: ModelsData): void {
    const mainModel = this.task.task.mainModel || DEFAULT_AIDER_MAIN_MODEL;
    const mainModelParts = mainModel.split('/');
    const weakModelParts = this.task.task.weakModel?.split('/') || modelsData.weakModel?.split('/');
    const architectModelParts = this.task.task.architectModel?.split('/') || modelsData.architectModel?.split('/');

    const getWeakModelProvider = () => {
      if (modelsData.mainModel !== this.task.task.mainModel && weakModelParts?.[0] === modelsData.mainModel.split('/')[0]) {
        // use the provider prefix from the main model when Aider's provider prefix is different
        return mainModelParts[0];
      }
      return weakModelParts ? weakModelParts[0] : mainModelParts[0];
    };

    this.aiderModelsData = {
      ...modelsData,
      mainModel: `${mainModelParts[0]}/${mainModelParts.slice(1).join('/')}`,
      weakModel: weakModelParts ? `${getWeakModelProvider()}/${weakModelParts.slice(1).join('/')}` : null,
      architectModel: architectModelParts ? `${architectModelParts[0]}/${architectModelParts.slice(1).join('/')}` : null,
    };

    this.sendUpdateAiderModels();
  }

  sendUpdateAiderModels() {
    if (!this.aiderModelsData) {
      return;
    }
    this.eventManager.sendUpdateAiderModels(this.task.getProjectDir(), this.task.taskId, this.aiderModelsData);
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff'): void {
    const mainModelMapping = this.modelManager.getAiderModelMapping(mainModel, this.task.getProjectDir());
    const mainModelName = mainModelMapping.modelName;
    const envFromMain = mainModelMapping.environmentVariables;

    let envFromWeak = {};
    let weakModelName: string | null = null;
    if (weakModel) {
      const weakModelMapping = this.modelManager.getAiderModelMapping(weakModel, this.task.getProjectDir());
      weakModelName = weakModelMapping.modelName;
      envFromWeak = weakModelMapping.environmentVariables;
    }

    logger.info('Updating models:', {
      baseDir: this.task.getProjectDir(),
      taskId: this.task.taskId,
      mainModel: mainModelName,
      weakModel: weakModelName,
      editFormat,
    });

    this.sendSetModels(mainModelName, weakModelName, editFormat, {
      ...envFromMain,
      ...envFromWeak,
    });

    if (this.aiderModelsData) {
      this.updateAiderModels({
        ...this.aiderModelsData!,
        mainModel: mainModelName,
        weakModel: weakModelName || mainModelName,
        editFormat,
      });
    } else {
      this.updateAiderModels({
        baseDir: this.task.getProjectDir(),
        taskId: this.task.taskId,
        mainModel: mainModelName,
        weakModel: weakModelName || mainModelName,
        editFormat,
      });
    }
  }

  private sendSetModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff', environmentVariables?: Record<string, string>): void {
    const connectors = this.getConnectors();
    connectors
      .filter((connector) => connector.listenTo.includes('set-models'))
      .forEach((connector) => connector.sendSetModelsMessage(mainModel, weakModel, editFormat, environmentVariables));
  }

  public setArchitectModel(architectModel: string): void {
    logger.info('Setting architect model', {
      architectModel,
    });
    this.updateAiderModels({
      ...this.aiderModelsData!,
      architectModel,
    });
  }

  public getArchitectModel(): string | null {
    return this.task.task.architectModel || this.store.getProjectSettings(this.task.getProjectDir()).architectModel || null;
  }

  public getAiderModelsData(): ModelsData | null {
    return this.aiderModelsData;
  }

  public getRepoMap(): string {
    return this.repoMap;
  }

  public setRepoMap(repoMap: string): void {
    this.repoMap = repoMap;
  }

  public updateRepoMapFromConnector(repoMap: string): void {
    this.setRepoMap(repoMap);
  }

  public openCommandOutput(command: string): void {
    this.currentCommand = command;
    this.commandOutputs.set(command, '');
    this.addCommandOutput(command, '');
  }

  private addCommandOutput(command: string, output: string): void {
    // Append output to the commandOutputs map
    const prev = this.commandOutputs.get(command) || '';
    this.commandOutputs.set(command, prev + output);

    this.eventManager.sendCommandOutput(this.task.getProjectDir(), this.task.taskId, command, output);
  }

  public closeCommandOutput(addToContext = true): {
    command: string;
    output: string | undefined;
    addToContext: boolean;
  } | null {
    if (!this.currentCommand) {
      return null;
    }
    const command = this.currentCommand;
    const output = this.commandOutputs.get(command);
    this.commandOutputs.delete(command);
    this.currentCommand = null;

    return { command, output: output || '', addToContext };
  }

  public sendUpdateEnvVars(environmentVariables: Record<string, unknown>): void {
    logger.info('Environment variables or LLM providers changed, updating connectors.');
    const connectors = this.getConnectors();
    connectors
      .filter((connector) => connector.listenTo.includes('update-env-vars'))
      .forEach((connector) => connector.sendUpdateEnvVarsMessage(environmentVariables));
  }
}

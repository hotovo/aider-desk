import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { EditFormat, ModelsData, ProjectSettings, TokensInfoData } from '@common/types';
import { fileExists } from '@common/utils';
import treeKill from 'tree-kill';

import { AIDER_DESK_CONNECTOR_DIR, AIDER_DESK_PROJECT_RULES_DIR, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from '@/constants';
import { Connector } from '@/connector';
import logger from '@/logger';
import { Store } from '@/store';
import { DEFAULT_MAIN_MODEL, ModelManager } from '@/models';
import { EventManager } from '@/events';
import { getEnvironmentVariablesForAider } from '@/utils';
import { Task } from '@/task/task';

export class AiderManager {
  private aiderProcess: ChildProcessWithoutNullStreams | null = null;
  private aiderStarting: boolean = false;
  private aiderStartPromise: Promise<void> | null = null;
  private aiderStartResolve: (() => void) | null = null;
  private aiderModelsData: ModelsData | null = null;
  private aiderTokensInfo: TokensInfoData;
  private currentCommand: string | null = null;
  private commandOutputs: Map<string, string> = new Map();
  private repoMap: string = '';

  constructor(
    private readonly task: Task,
    private readonly store: Store,
    private readonly modelManager: ModelManager,
    private readonly eventManager: EventManager,
    private readonly getConnectors: () => Connector[],
  ) {
    this.aiderTokensInfo = {
      baseDir: this.task.project.baseDir,
      taskId: this.task.taskId,
      chatHistory: { cost: 0, tokens: 0 },
      files: {},
      repoMap: { cost: 0, tokens: 0 },
      systemMessages: { cost: 0, tokens: 0 },
      agent: { cost: 0, tokens: 0 },
    };
  }

  public async start(): Promise<void> {
    if (this.aiderProcess) {
      await this.kill();
    }

    await this.checkAndCleanupPidFile();

    // Set aiderStarting to true when starting aider
    this.aiderStarting = true;

    const settings = this.store.getSettings();
    const projectSettings = this.store.getProjectSettings(this.task.project.baseDir);
    const mainModel = projectSettings.mainModel || DEFAULT_MAIN_MODEL;
    const weakModel = projectSettings.weakModel;
    const modelEditFormats = projectSettings.modelEditFormats;
    const reasoningEffort = projectSettings.reasoningEffort;
    const environmentVariables = getEnvironmentVariablesForAider(settings, this.task.project.baseDir);
    const thinkingTokens = projectSettings.thinkingTokens;

    const mainModelMapping = this.modelManager.getAiderModelMapping(mainModel);
    const mainModelName = mainModelMapping.modelName;
    const envFromMain = mainModelMapping.environmentVariables;

    let envFromWeak = {};
    let weakModelName: string | null = null;
    if (weakModel) {
      const weakModelMapping = this.modelManager.getAiderModelMapping(weakModel);
      weakModelName = weakModelMapping.modelName;
      envFromWeak = weakModelMapping.environmentVariables;
    }

    logger.info('Running Aider for project', {
      baseDir: this.task.project.baseDir,
      taskId: this.task.task.id,
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

    if (reasoningEffort !== undefined && !optionsArgsSet.has('--reasoning-effort')) {
      args.push('--reasoning-effort', reasoningEffort);
    }

    if (thinkingTokens !== undefined && !optionsArgsSet.has('--thinking-tokens')) {
      args.push('--thinking-tokens', thinkingTokens);
    }

    if (settings.aider.addRuleFiles && (await fileExists(path.join(this.task.project.baseDir, AIDER_DESK_PROJECT_RULES_DIR)))) {
      args.push('--read', AIDER_DESK_PROJECT_RULES_DIR);
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

    logger.info('Running Aider with args:', {
      baseDir: this.task.project.baseDir,
      taskId: this.task.task.id,
      args,
    });

    const env = {
      ...process.env,
      ...environmentVariables,
      ...envFromMain,
      ...envFromWeak,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      PYTHONUTF8: process.env.AIDER_DESK_OMIT_PYTHONUTF8 ? undefined : '1',
      BASE_DIR: this.task.project.baseDir,
      TASK_ID: this.task.task.id,
      CONNECTOR_SERVER_URL: `http://localhost:${SERVER_PORT}`,
      CONNECTOR_CONFIRM_BEFORE_EDIT: settings.aider.confirmBeforeEdit ? '1' : '0',
    };

    // Spawn without shell to have direct process control
    this.aiderProcess = spawn(PYTHON_COMMAND, args, {
      cwd: this.task.project.baseDir,
      detached: false,
      env,
    });

    logger.info('Starting Aider...', {
      baseDir: this.task.project.baseDir,
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

      logger.error('Aider stderr:', {
        baseDir: this.task.project.baseDir,
        taskId: this.task.task.id,
        error: output,
      });
    });

    this.aiderProcess.on('close', (code) => {
      logger.info('Aider process exited:', {
        baseDir: this.task.project.baseDir,
        taskId: this.task.task.id,
        code,
      });
    });

    void this.writeAiderProcessPidFile();
  }

  public async kill(): Promise<void> {
    if (this.aiderProcess) {
      logger.info('Killing Aider...', {
        baseDir: this.task.project.baseDir,
        taskId: this.task.task.id,
      });
      try {
        await new Promise<void>((resolve, reject) => {
          treeKill(this.aiderProcess!.pid!, 'SIGKILL', (err) => {
            if (err) {
              logger.error('Error killing Aider process:', {
                baseDir: this.task.project.baseDir,
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
      } catch (error: unknown) {
        logger.error('Error killing Aider process:', {
          baseDir: this.task.project.baseDir,
          taskId: this.task.task.id,
          error,
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
    await this.createAiderStartPromise();
  }

  private getAiderProcessPidFilePath(): string {
    const hash = createHash('sha256').update(this.task.project.baseDir).update(this.task.task.id).digest('hex');
    return path.join(PID_FILES_DIR, `${hash}.pid`);
  }

  private async writeAiderProcessPidFile(): Promise<void> {
    try {
      await fs.mkdir(PID_FILES_DIR, { recursive: true });

      if (this.aiderProcess?.pid) {
        await fs.writeFile(this.getAiderProcessPidFilePath(), this.aiderProcess.pid.toString());
      }
    } catch (error) {
      logger.error('Failed to write PID file:', {
        baseDir: this.task.project.baseDir,
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
          baseDir: this.task.project.baseDir,
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
        baseDir: this.task.project.baseDir,
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
    const currentSettings = this.store.getProjectSettings(this.task.project.baseDir);
    const updatedSettings: ProjectSettings = {
      ...currentSettings,
      reasoningEffort: modelsData.reasoningEffort ? modelsData.reasoningEffort : undefined,
      thinkingTokens: modelsData.thinkingTokens ? modelsData.thinkingTokens : undefined,
    };
    this.store.saveProjectSettings(this.task.project.baseDir, updatedSettings);

    const projectSettings = this.store.getProjectSettings(this.task.project.baseDir);
    const mainModel = projectSettings.mainModel || DEFAULT_MAIN_MODEL;
    const mainModelParts = mainModel.split('/');
    const weakModelParts = projectSettings.weakModel?.split('/') || modelsData.weakModel?.split('/');
    const architectModelParts = projectSettings.architectModel?.split('/') || modelsData.architectModel?.split('/');

    const getWeakModelProvider = () => {
      if (modelsData.mainModel !== projectSettings.mainModel && weakModelParts?.[0] === modelsData.mainModel.split('/')[0]) {
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
    this.eventManager.sendUpdateAiderModels(this.task.project.baseDir, this.task.taskId, this.aiderModelsData);
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff'): void {
    const mainModelMapping = this.modelManager.getAiderModelMapping(mainModel);
    const mainModelName = mainModelMapping.modelName;
    const envFromMain = mainModelMapping.environmentVariables;

    let envFromWeak = {};
    let weakModelName: string | null = null;
    if (weakModel) {
      const weakModelMapping = this.modelManager.getAiderModelMapping(weakModel);
      weakModelName = weakModelMapping.modelName;
      envFromWeak = weakModelMapping.environmentVariables;
    }

    logger.info('Updating models:', {
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
        baseDir: this.task.project.baseDir,
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
    return this.store.getProjectSettings(this.task.project.baseDir).architectModel || null;
  }

  public getAiderModelsData(): ModelsData | null {
    return this.aiderModelsData;
  }

  public getAiderTokensInfo(): TokensInfoData {
    return this.aiderTokensInfo;
  }

  public updateTokensInfo(data: Partial<TokensInfoData>): void {
    this.aiderTokensInfo = {
      ...this.aiderTokensInfo,
      ...data,
    };

    this.eventManager.sendUpdateTokensInfo(this.aiderTokensInfo);
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

    this.eventManager.sendCommandOutput(this.task.project.baseDir, this.task.taskId, command, output);
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

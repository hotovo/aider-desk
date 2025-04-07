import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import {
  ContextFile,
  Mode,
  FileEdit,
  InputHistoryData,
  LogData,
  LogLevel,
  MessageRole,
  ModelsData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SessionData,
  StartupMode,
  ToolData,
  UsageReportData,
  UserMessageData,
} from '@common/types';
import { fileExists, parseUsageReport } from '@common/utils';
import { BrowserWindow } from 'electron';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';
import { parse } from '@dotenvx/dotenvx';

import { SessionManager } from './session-manager';
import { Agent } from './agent';
import { Connector } from './connector';
import { AIDER_DESK_CONNECTOR_DIR, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from './constants';
import logger from './logger';
import { MessageAction, ResponseMessage } from './messages';
import { DEFAULT_MAIN_MODEL, Store } from './store';

export class Project {
  private process: ChildProcessWithoutNullStreams | null = null;
  private connectors: Connector[] = [];
  private currentCommand: string | null = null;
  private currentQuestion: QuestionData | null = null;
  private allTrackedFiles: string[] = [];
  private questionAnswers: Map<string, 'y' | 'n'> = new Map();
  private currentResponseMessageId: string | null = null;
  private currentPromptId: string | null = null;
  private inputHistoryFile = '.aider.input.history';
  private models: ModelsData | null = null;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];
  private sessionManager: SessionManager = new SessionManager(this);

  mcpAgentTotalCost: number = 0;
  aiderTotalCost: number = 0;

  constructor(
    private readonly mainWindow: BrowserWindow,
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly agent: Agent,
  ) {}

  public async start() {
    const settings = this.store.getSettings();

    try {
      // Handle different startup modes
      switch (settings.startupMode) {
        case StartupMode.Empty:
          // Don't load any session, start fresh
          logger.info('Starting with empty session');
          break;

        case StartupMode.Last:
          // Load the last active session
          logger.info('Loading last active session');
          await this.sessionManager.loadLastActive();
          break;

        case StartupMode.Specific:
          if (settings.startupSessionName) {
            // Load the specific session
            logger.info(`Loading specific session: ${settings.startupSessionName}`);
            await this.sessionManager.load(settings.startupSessionName);
          } else {
            logger.warn('Specific session mode selected but no session name provided, starting with empty session');
          }
          break;
      }
    } catch (error) {
      logger.error('Error loading session:', { error });
    }

    this.sessionManager.getContextFiles().forEach((contextFile) => {
      this.mainWindow.webContents.send('file-added', {
        baseDir: this.baseDir,
        file: contextFile,
      });
    });

    void this.runAider();
    void this.sendInputHistoryUpdatedEvent();

    this.mcpAgentTotalCost = 0;
    this.aiderTotalCost = 0;
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
    });
    this.connectors.push(connector);
    if (connector.listenTo.includes('add-file')) {
      this.sessionManager.getContextFiles().forEach(connector.sendAddFileMessage);
    }
    if (connector.listenTo.includes('add-message')) {
      this.sessionManager.filterUserAndAssistantMessages().forEach((message) => {
        connector.sendAddMessageMessage(message.role, message.content, false);
      });
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

  private getAiderProcessPidFilePath(): string {
    const hash = createHash('sha256').update(this.baseDir).digest('hex');
    return path.join(PID_FILES_DIR, `${hash}.pid`);
  }

  private async writeAiderProcessPidFile(): Promise<void> {
    if (!this.process?.pid) {
      return;
    }

    try {
      await fs.mkdir(PID_FILES_DIR, { recursive: true });
      await fs.writeFile(this.getAiderProcessPidFilePath(), this.process.pid.toString());
    } catch (error) {
      logger.error('Failed to write PID file:', { error });
    }
  }

  private removeAiderProcessPidFile() {
    try {
      unlinkSync(this.getAiderProcessPidFilePath());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.error('Failed to remove PID file:', { error });
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
      logger.error('Error cleaning up old PID file:', { error });
    }
  }

  private async runAider(): Promise<void> {
    if (this.process) {
      await this.killAider();
    }

    await this.checkAndCleanupPidFile();

    this.currentCommand = null;
    this.currentQuestion = null;

    const settings = this.store.getSettings();
    const mainModel = this.store.getProjectSettings(this.baseDir).mainModel || DEFAULT_MAIN_MODEL;
    const weakModel = this.store.getProjectSettings(this.baseDir).weakModel;
    const environmentVariables = parse(settings.aider.environmentVariables);

    logger.info('Running Aider for project', {
      baseDir: this.baseDir,
      mainModel,
      weakModel,
    });
    const options = settings.aider.options;

    const args = ['-m', 'connector'];
    if (options) {
      const optionsArgs = (options.match(/(?:[^\s"]+|"[^"]*")+/g) as string[]) || [];
      // remove existing --model defined by user
      const modelIndex = optionsArgs.indexOf('--model');
      if (modelIndex !== -1 && modelIndex + 1 < optionsArgs.length) {
        optionsArgs.splice(modelIndex, 2);
      }
      args.push(...optionsArgs.map((option) => (option.startsWith('"') && option.endsWith('"') ? option.slice(1, -1) : option)));
    }
    args.push(...['--no-check-update', '--no-show-model-warnings']);

    args.push('--model', mainModel);

    if (weakModel) {
      args.push('--weak-model', weakModel);
    }

    logger.info('Running Aider with args:', { args });

    const env = {
      ...process.env,
      ...environmentVariables,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      CONNECTOR_SERVER_URL: `http://localhost:${SERVER_PORT}`,
    };

    // Spawn without shell to have direct process control
    this.process = spawn(PYTHON_COMMAND, args, {
      cwd: this.baseDir,
      detached: false,
      env,
    });

    logger.info('Starting Aider...', { baseDir: this.baseDir });
    this.process.stdout.on('data', (data) => {
      const output = data.toString();
      logger.debug('Aider output:', { output });

      if (this.currentCommand) {
        this.addCommandOutput(this.currentCommand, output);
      }
    });

    this.process.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.startsWith('Warning:')) {
        logger.debug(data);
        return;
      }
      if (output.startsWith('usage:')) {
        logger.debug(output);
        this.addLogMessage('error', output.includes('error:') ? output.substring(output.indexOf('error:')) : output);
        return;
      }

      logger.error('Aider stderr:', { baseDir: this.baseDir, error: output });
    });

    this.process.on('close', (code) => {
      logger.info('Aider process exited:', { baseDir: this.baseDir, code });
    });

    void this.writeAiderProcessPidFile();
  }

  public isStarted() {
    return !!this.process;
  }

  public async close() {
    logger.info('Closing project...', { baseDir: this.baseDir });
    try {
      await this.sessionManager.save();
    } catch (error) {
      logger.error('Failed to save session on close:', { error });
    }
    await this.killAider();
  }

  public async saveSession(name: string, loadMessages = true, loadFiles = true): Promise<void> {
    logger.info('Saving session:', {
      baseDir: this.baseDir,
      name,
      loadMessages,
      loadFiles,
    });
    await this.sessionManager.save(name, loadMessages, loadFiles);
  }

  public async deleteSession(name: string): Promise<void> {
    logger.info('Deleting session:', { baseDir: this.baseDir, name });
    const lastActiveSession = this.sessionManager.getActiveSessionName();
    await this.sessionManager.delete(name);

    if (lastActiveSession !== this.sessionManager.getActiveSessionName()) {
      await this.sessionManager.loadLastActive();
    }
  }

  public async loadSession(name: string): Promise<void> {
    logger.info('Loading session:', { baseDir: this.baseDir, name });
    await this.sessionManager.save();
    await this.sessionManager.load(name);
  }

  public async listSessions(): Promise<SessionData[]> {
    return this.sessionManager.getAllSessions();
  }

  private async killAider(): Promise<void> {
    if (this.process) {
      logger.info('Killing Aider...', { baseDir: this.baseDir });
      try {
        await new Promise<void>((resolve, reject) => {
          treeKill(this.process!.pid!, 'SIGKILL', (err) => {
            if (err) {
              logger.error('Error killing Aider process:', { error: err });
              reject(err);
            } else {
              this.removeAiderProcessPidFile();
              resolve();
            }
          });
        });

        this.currentCommand = null;
        this.currentQuestion = null;
        this.currentResponseMessageId = null;
        this.currentPromptId = null;
        this.currentPromptResponses = [];

        this.runPromptResolves.forEach((resolve) => resolve([]));
        this.runPromptResolves = [];

        this.sessionManager.clearMessages();
      } catch (error: unknown) {
        logger.error('Error killing Aider process:', { error });
        throw error;
      } finally {
        this.process = null;
      }
    }
  }

  private findMessageConnectors(action: MessageAction): Connector[] {
    return this.connectors.filter((connector) => connector.listenTo.includes(action));
  }

  public async runPrompt(prompt: string, mode?: Mode): Promise<ResponseCompletedData[]> {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    // If a prompt is already running, wait for it to finish
    if (this.currentPromptId) {
      logger.info('Waiting for prompt to finish...');
      await new Promise<void>((resolve) => {
        this.runPromptResolves.push(() => resolve());
      });
    }

    logger.info('Running prompt:', {
      baseDir: this.baseDir,
      prompt,
      mode,
    });

    await this.addToInputHistory(prompt);

    this.addUserMessage(prompt, mode);
    this.addLogMessage('loading');

    if (mode === 'agent') {
      const agentMessages = await this.agent.runAgent(this, prompt);
      if (agentMessages.length > 0) {
        console.log('agentMessages', agentMessages);
        agentMessages.forEach((message) => this.sessionManager.addContextMessage(message));

        // send messages to connectors (aider)
        this.sessionManager.filterUserAndAssistantMessages(agentMessages).forEach((message) => {
          this.sendAddMessage(message.role, message.content, false);
        });
      }
      return [];
    } else {
      const responses = await this.sendPrompt(prompt, mode);

      // add messages to session
      this.sessionManager.addContextMessage(MessageRole.User, prompt);
      for (const response of responses) {
        if (response.content) {
          this.sessionManager.addContextMessage(MessageRole.Assistant, response.content);
        }
      }

      return responses;
    }
  }

  public sendPrompt(prompt: string, mode?: Mode, clearContext = false): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
    this.currentResponseMessageId = null;
    this.currentPromptId = uuidv4();

    this.findMessageConnectors('prompt').forEach((connector) =>
      connector.sendPromptMessage(prompt, mode, this.getArchitectModel(), this.currentPromptId, clearContext),
    );

    // Wait for prompt to finish and return collected responses
    return new Promise((resolve) => {
      this.runPromptResolves.push(resolve);
    });
  }

  private getArchitectModel(): string | null {
    return this.store.getProjectSettings(this.baseDir).architectModel || null;
  }

  public promptFinished() {
    if (this.currentResponseMessageId) {
      this.mainWindow.webContents.send('response-completed', {
        messageId: this.currentResponseMessageId,
        baseDir: this.baseDir,
        content: '',
      });
      this.currentResponseMessageId = null;
    }

    // Notify waiting prompts with collected responses
    const responses = [...this.currentPromptResponses];
    this.currentPromptResponses = [];
    this.currentPromptId = null;
    this.closeCommandOutput();

    while (this.runPromptResolves.length) {
      const resolve = this.runPromptResolves.shift();
      if (resolve) {
        resolve(responses);
      }
    }
  }

  public processResponseMessage(message: ResponseMessage) {
    if (!this.currentResponseMessageId) {
      this.currentResponseMessageId = uuidv4();
    }

    if (!message.finished) {
      logger.debug(`Sending response chunk to ${this.baseDir}`);
      const data: ResponseChunkData = {
        messageId: message.id || this.currentResponseMessageId,
        baseDir: this.baseDir,
        chunk: message.content,
        reflectedMessage: message.reflectedMessage,
      };
      this.mainWindow.webContents.send('response-chunk', data);
    } else {
      logger.info(`Sending response completed to ${this.baseDir}`);
      logger.debug(`Message data: ${JSON.stringify(message)}`);

      const usageReport = message.usageReport
        ? typeof message.usageReport === 'string'
          ? parseUsageReport(message.usageReport)
          : message.usageReport
        : undefined;

      if (usageReport) {
        logger.info(`Usage report: ${JSON.stringify(usageReport)}`);
        this.updateTotalCosts(usageReport);
      }
      const data: ResponseCompletedData = {
        messageId: message.id || this.currentResponseMessageId,
        content: message.content,
        reflectedMessage: message.reflectedMessage,
        baseDir: this.baseDir,
        editedFiles: message.editedFiles,
        commitHash: message.commitHash,
        commitMessage: message.commitMessage,
        diff: message.diff,
        usageReport,
      };
      this.mainWindow.webContents.send('response-completed', data);
      this.currentResponseMessageId = null;
      this.closeCommandOutput();

      // Collect the completed response
      this.currentPromptResponses.push(data);
    }

    return this.currentResponseMessageId;
  }

  private getQuestionKey(question: QuestionData) {
    return `${question.text}_${question.subject || ''}`;
  }

  public answerQuestion(answer: string): void {
    if (!this.currentQuestion) {
      return;
    }

    logger.info('Answering question:', {
      baseDir: this.baseDir,
      question: this.currentQuestion,
      answer,
    });

    const yesNoAnswer = answer.toLowerCase() === 'a' || answer.toLowerCase() === 'y' ? 'y' : 'n';
    if (answer.toLowerCase() === 'd' || answer.toLowerCase() === 'a') {
      logger.info('Storing answer for question:', {
        baseDir: this.baseDir,
        question: this.currentQuestion,
        answer,
      });
      this.questionAnswers.set(this.getQuestionKey(this.currentQuestion), yesNoAnswer);
    }

    this.findMessageConnectors('answer-question').forEach((connector) => connector.sendAnswerQuestionMessage(yesNoAnswer));
    this.currentQuestion = null;
  }

  public async addFile(contextFile: ContextFile): Promise<void> {
    logger.info('Adding file:', {
      path: contextFile.path,
      readOnly: contextFile.readOnly,
    });
    if (!(await this.sessionManager.addContextFile(contextFile))) {
      return;
    }
    this.sendAddFile(contextFile);
  }

  public sendAddFile(contextFile: ContextFile) {
    this.findMessageConnectors('add-file').forEach((connector) => connector.sendAddFileMessage(contextFile));
  }

  public dropFile(filePath: string): void {
    logger.info('Dropping file:', { path: filePath });
    const file = this.sessionManager.dropContextFile(filePath);
    if (file) {
      this.sendDropFile(file);
    }
  }

  public sendDropFile(file: ContextFile): void {
    const absolutePath = path.resolve(this.baseDir, file.path);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.baseDir));
    const pathToSend = file?.readOnly || isOutsideProject ? absolutePath : file.path.startsWith(this.baseDir) ? file.path : path.join(this.baseDir, file.path);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend));
  }

  public runCommand(command: string) {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    logger.info('Running command:', { command });
    this.findMessageConnectors('run-command').forEach((connector) => connector.sendRunCommandMessage(command));
  }

  public updateContextFiles(contextFiles: ContextFile[]) {
    this.sessionManager.setContextFiles(contextFiles);

    this.mainWindow.webContents.send('context-files-updated', {
      baseDir: this.baseDir,
      files: contextFiles,
    });
  }

  public async loadInputHistory(): Promise<string[]> {
    try {
      const historyPath = path.isAbsolute(this.inputHistoryFile) ? this.inputHistoryFile : path.join(this.baseDir, this.inputHistoryFile);

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
    this.mainWindow.webContents.send('input-history-updated', inputHistoryData);
  }

  public askQuestion(questionData: QuestionData) {
    this.currentQuestion = questionData;

    const storedAnswer = this.questionAnswers.get(this.getQuestionKey(questionData));

    logger.info('Asking question:', {
      baseDir: this.baseDir,
      question: questionData,
      answer: storedAnswer,
    });
    if (storedAnswer) {
      logger.info('Found stored answer for question:', {
        baseDir: this.baseDir,
        question: questionData,
        answer: storedAnswer,
      });
      // Auto-answer based on stored preference
      this.answerQuestion(storedAnswer);
      return;
    }

    this.mainWindow.webContents.send('ask-question', questionData);
  }

  public setAllTrackedFiles(files: string[]) {
    this.allTrackedFiles = files;
  }

  public setCurrentModels(modelsData: ModelsData) {
    this.models = {
      ...modelsData,
      architectModel: modelsData.architectModel !== undefined ? modelsData.architectModel : this.getArchitectModel(),
    };
    this.mainWindow.webContents.send('set-current-models', this.models);
  }

  public updateModels(mainModel: string, weakModel: string | null) {
    logger.info('Updating models:', {
      mainModel,
      weakModel,
    });
    this.findMessageConnectors('set-models').forEach((connector) => connector.sendSetModelsMessage(mainModel, weakModel));
  }

  public setArchitectModel(architectModel: string) {
    logger.info('Setting architect model', {
      architectModel,
    });
    this.setCurrentModels({
      ...this.models!,
      architectModel,
    });
  }

  public getAddableFiles(searchRegex?: string): string[] {
    const contextFilePaths = new Set(this.getContextFiles().map((file) => file.path));
    let files = this.allTrackedFiles.filter((file) => !contextFilePaths.has(file));

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

  public getContextFiles(): ContextFile[] {
    return this.sessionManager.getContextFiles();
  }

  public openCommandOutput(command: string) {
    this.currentCommand = command;
    this.addCommandOutput(command, '');
  }

  public closeCommandOutput() {
    this.currentCommand = null;
  }

  private addCommandOutput(command: string, output: string) {
    this.mainWindow.webContents.send('command-output', {
      baseDir: this.baseDir,
      command: command,
      output,
    });
  }

  public addLogMessage(level: LogLevel, message?: string) {
    const data: LogData = {
      baseDir: this.baseDir,
      level,
      message,
    };

    this.mainWindow.webContents.send('log', data);
  }

  public getContextMessages() {
    return this.sessionManager.getContextMessages();
  }

  public sendAddMessage(role: MessageRole = MessageRole.User, content: string, acknowledge = true) {
    logger.info('Adding message:', {
      baseDir: this.baseDir,
      role,
      content,
      acknowledge,
    });
    this.findMessageConnectors('add-message').forEach((connector) => connector.sendAddMessageMessage(role, content, acknowledge));
  }

  public clearContext() {
    this.sessionManager.clearMessages();
    this.runCommand('clear');
    this.mainWindow.webContents.send('clear-messages', this.baseDir);
  }

  public interruptResponse() {
    logger.info('Interrupting response:', { baseDir: this.baseDir });
    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public addToolMessage(id: string, serverName: string, toolName: string, args?: Record<string, unknown>, response?: string, usageReport?: UsageReportData) {
    logger.debug('Sending tool message:', {
      baseDir: this.baseDir,
      serverName,
      name: toolName,
      args,
      response,
      usageReport,
    });
    const data: ToolData = {
      baseDir: this.baseDir,
      id,
      serverName,
      toolName,
      args,
      response,
      usageReport,
    };

    // Update total costs when adding the tool message
    if (usageReport) {
      this.updateTotalCosts(usageReport);
    }

    this.mainWindow.webContents.send('tool', data);
  }

  private updateTotalCosts(usageReport: UsageReportData) {
    if (usageReport.mcpAgentTotalCost) {
      this.mcpAgentTotalCost = usageReport.mcpAgentTotalCost;
    }
    if (usageReport.aiderTotalCost) {
      this.aiderTotalCost = usageReport.aiderTotalCost;
    }
  }

  public addUserMessage(content: string, mode?: Mode) {
    logger.info('Adding user message:', {
      baseDir: this.baseDir,
      content,
      mode,
    });

    const data: UserMessageData = {
      baseDir: this.baseDir,
      content,
      mode,
    };

    this.mainWindow.webContents.send('user-message', data);
  }
}

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { simpleGit } from 'simple-git';
import { BrowserWindow, dialog, Notification } from 'electron';
import YAML from 'yaml';
import {
  AgentProfile,
  ContextFile,
  ContextMessage,
  EditFormat,
  FileEdit,
  InputHistoryData,
  LogData,
  LogLevel,
  MessageRole,
  Mode,
  ModelsData,
  ProjectSettings,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SessionData,
  SettingsData,
  StartupMode,
  Task,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageReportData,
  UserMessageData,
} from '@common/types';
import { extractTextContent, fileExists, getActiveAgentProfile, parseUsageReport } from '@common/utils';
import { INIT_PROJECT_RULES_AGENT_PROFILE, COMPACT_CONVERSATION_AGENT_PROFILE } from '@common/agent';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';
import { parse } from '@dotenvx/dotenvx';
import { TelemetryManager } from 'src/main/telemetry-manager';
import { getInitProjectPrompt, getCompactConversationPrompt } from 'src/main/agent/prompts';

import { TaskManager } from './task-manager';
import { SessionManager } from './session-manager';
import { Agent } from './agent';
import { Connector } from './connector';
import { AIDER_DESK_CONNECTOR_DIR, AIDER_DESK_PROJECT_RULES_DIR, AIDER_DESK_TODOS_FILE, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from './constants';
import logger from './logger';
import { MessageAction, ResponseMessage } from './messages';
import { DEFAULT_MAIN_MODEL, Store } from './store';

import type { SimpleGit } from 'simple-git';

export class Project {
  private process: ChildProcessWithoutNullStreams | null = null;
  private connectors: Connector[] = [];
  private currentCommand: string | null = null;
  private currentQuestion: QuestionData | null = null;
  private currentQuestionResolves: ((answer: [string, string | undefined]) => void)[] = [];
  private questionAnswers: Map<string, 'y' | 'n'> = new Map();
  private allTrackedFiles: string[] = [];
  private currentResponseMessageId: string | null = null;
  private currentPromptId: string | null = null;
  private inputHistoryFile = '.aider.input.history';
  private aiderModels: ModelsData | null = null;
  private tokensInfo: TokensInfoData;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];
  private sessionManager: SessionManager = new SessionManager(this);
  private taskManager: TaskManager = new TaskManager();
  private commandOutputs: Map<string, string> = new Map();
  private repoMap: string = '';

  aiderTotalCost: number = 0;
  agentTotalCost: number = 0;

  readonly git: SimpleGit;

  constructor(
    private readonly mainWindow: BrowserWindow,
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly agent: Agent,
    private readonly telemetryManager: TelemetryManager,
  ) {
    this.git = simpleGit(this.baseDir);
    this.tokensInfo = {
      baseDir,
      chatHistory: { cost: 0, tokens: 0 },
      files: {},
      repoMap: { cost: 0, tokens: 0 },
      systemMessages: { cost: 0, tokens: 0 },
      agent: { cost: 0, tokens: 0 },
    };
  }

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
          // Load the autosaved session
          logger.info('Loading autosaved session');
          await this.sessionManager.loadAutosaved();
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

    this.agentTotalCost = 0;
    this.aiderTotalCost = 0;
    this.currentPromptId = null;
    this.currentResponseMessageId = null;
    this.currentCommand = null;
    this.currentQuestion = null;
    this.currentQuestionResolves = [];
    this.questionAnswers.clear();

    void this.updateAgentEstimatedTokens();
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
    });
    this.connectors.push(connector);
    if (connector.listenTo.includes('add-file')) {
      const contextFiles = this.sessionManager.getContextFiles();
      for (let index = 0; index < contextFiles.length; index++) {
        const contextFile = contextFiles[index];
        connector.sendAddFileMessage(contextFile, index !== contextFiles.length - 1);
      }
    }
    if (connector.listenTo.includes('add-message')) {
      this.sessionManager.toConnectorMessages().forEach((message) => {
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

  private normalizeFilePath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);

    if (process.platform !== 'win32') {
      return normalizedPath.replace(/\\/g, '/');
    }

    return normalizedPath;
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

    const settings = this.store.getSettings();
    const projectSettings = this.store.getProjectSettings(this.baseDir);
    const mainModel = projectSettings.mainModel || DEFAULT_MAIN_MODEL;
    const weakModel = projectSettings.weakModel;
    const editFormat = projectSettings.editFormat;
    const reasoningEffort = projectSettings.reasoningEffort;
    const environmentVariables = parse(settings.aider.environmentVariables);
    const thinkingTokens = projectSettings.thinkingTokens;

    logger.info('Running Aider for project', {
      baseDir: this.baseDir,
      mainModel,
      weakModel,
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
    args.push('--model', mainModel);

    if (weakModel) {
      args.push('--weak-model', weakModel);
    }

    if (editFormat) {
      args.push('--edit-format', editFormat);
    }

    if (reasoningEffort !== undefined && !optionsArgsSet.has('--reasoning-effort')) {
      args.push('--reasoning-effort', reasoningEffort);
    }

    if (thinkingTokens !== undefined && !optionsArgsSet.has('--thinking-tokens')) {
      args.push('--thinking-tokens', thinkingTokens);
    }

    if (settings.aider.addRuleFiles && (await fileExists(path.join(this.baseDir, AIDER_DESK_PROJECT_RULES_DIR)))) {
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

    logger.info('Running Aider with args:', { args });

    const env = {
      ...process.env,
      ...environmentVariables,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      BASE_DIR: this.baseDir,
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
        logger.debug('Aider warning:', { output });
        return;
      }
      if (output.startsWith('usage:')) {
        logger.debug('Aider usage:', { output });
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
    if (!this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('clear-project', this.baseDir, true, true);
    }
    await this.killAider();
  }

  public async saveSession(name: string): Promise<void> {
    logger.info('Saving session:', {
      baseDir: this.baseDir,
      name,
    });
    await this.sessionManager.save(name);
  }

  public async loadSessionMessages(name: string) {
    const session = await this.sessionManager.findSession(name);
    if (!session?.contextMessages) {
      return;
    }

    await this.sessionManager.loadMessages(session.contextMessages || []);
    await this.updateAgentEstimatedTokens();
  }

  public async loadSessionFiles(name: string) {
    const session = await this.sessionManager.findSession(name);
    if (!session) {
      return;
    }

    await this.sessionManager.loadFiles(session.contextFiles || []);
    await this.updateAgentEstimatedTokens();
  }

  public async deleteSession(name: string): Promise<void> {
    logger.info('Deleting session:', { baseDir: this.baseDir, name });
    await this.sessionManager.delete(name);
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
      if (this.answerQuestion('n', prompt)) {
        // processed by the answerQuestion function
        return [];
      }
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

    this.telemetryManager.captureRunPrompt(mode);

    if (mode === 'agent') {
      const profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
      logger.debug('AgentProfile:', profile);

      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      return this.runAgent(profile, prompt);
    } else {
      const responses = await this.sendPrompt(prompt, mode);

      // add messages to session
      this.sessionManager.addContextMessage(MessageRole.User, prompt);
      for (const response of responses) {
        if (response.reflectedMessage) {
          this.sessionManager.addContextMessage(MessageRole.User, response.reflectedMessage);
        }
        if (response.content) {
          this.sessionManager.addContextMessage(MessageRole.Assistant, response.content);
        }
      }

      this.notifyIfEnabled('Prompt finished', 'Your Aider task has finished.');

      return responses;
    }
  }

  public async runAgent(profile: AgentProfile, prompt: string): Promise<ResponseCompletedData[]> {
    const agentMessages = await this.agent.runAgent(this, profile, prompt);
    if (agentMessages.length > 0) {
      agentMessages.forEach((message) => this.sessionManager.addContextMessage(message));

      // send messages to connectors (aider)
      this.sessionManager.toConnectorMessages(agentMessages).forEach((message) => {
        this.sendAddMessage(message.role, message.content, false);
      });
    }

    this.notifyIfEnabled('Prompt finished', 'Your Agent task has finished.');
    return [];
  }

  public async runSubAgent(
    profile: AgentProfile,
    prompt: string,
    contextFiles: ContextFile[],
    systemPrompt?: string,
    abortSignal?: AbortSignal,
  ): Promise<ContextMessage[]> {
    return await this.agent.runAgent(this, profile, prompt, [], contextFiles, systemPrompt, abortSignal);
  }

  public sendPrompt(prompt: string, mode?: Mode, clearContext = false, clearFiles = false): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
    this.currentResponseMessageId = null;
    this.currentPromptId = uuidv4();

    this.findMessageConnectors('prompt').forEach((connector) =>
      connector.sendPromptMessage(prompt, mode, this.getArchitectModel(), this.currentPromptId, clearContext, clearFiles),
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

      this.addResponseCompletedMessage(data);
      this.currentResponseMessageId = null;
      this.closeCommandOutput();

      // Collect the completed response
      this.currentPromptResponses.push(data);
    }

    return this.currentResponseMessageId;
  }

  addResponseCompletedMessage(data: ResponseCompletedData) {
    this.mainWindow.webContents.send('response-completed', data);
  }

  private notifyIfEnabled(title: string, text: string) {
    const settings = this.store.getSettings();
    if (!settings.notificationsEnabled) {
      return;
    }

    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body: text,
      });
      notification.show();
    } else {
      logger.warn('Notifications are not supported on this platform.');
    }
  }

  private getQuestionKey(question: QuestionData): string {
    return question.key || `${question.text}_${question.subject || ''}`;
  }

  public answerQuestion(answer: string, userInput?: string): boolean {
    if (!this.currentQuestion) {
      return false;
    }

    logger.info('Answering question:', {
      baseDir: this.baseDir,
      question: this.currentQuestion,
      answer,
    });

    const normalizedAnswer = answer.toLowerCase();
    let determinedAnswer: string | null = null;

    if (this.currentQuestion.answers && this.currentQuestion.answers.length > 0) {
      for (const answer of this.currentQuestion.answers) {
        if (answer.shortkey.toLowerCase() === normalizedAnswer) {
          determinedAnswer = answer.shortkey;
          break;
        }
      }
    }

    if (!determinedAnswer) {
      determinedAnswer = normalizedAnswer === 'a' || normalizedAnswer === 'y' ? 'y' : 'n';
    }

    // If user input 'd' (don't ask again) or 'a' (always), store the determined answer.
    if ((normalizedAnswer === 'd' || normalizedAnswer === 'a') && (determinedAnswer == 'y' || determinedAnswer == 'n')) {
      logger.info('Storing answer for question due to "d" or "a" input:', {
        baseDir: this.baseDir,
        questionKey: this.getQuestionKey(this.currentQuestion),
        rawInput: answer,
        determinedAndStoredAnswer: determinedAnswer,
      });
      this.questionAnswers.set(this.getQuestionKey(this.currentQuestion), determinedAnswer as 'y' | 'n');
    }

    if (!this.currentQuestion.internal) {
      this.findMessageConnectors('answer-question').forEach((connector) => connector.sendAnswerQuestionMessage(determinedAnswer!));
    }
    this.currentQuestion = null;

    if (this.currentQuestionResolves.length > 0) {
      for (const currentQuestionResolve of this.currentQuestionResolves) {
        currentQuestionResolve([determinedAnswer!, userInput]);
      }
      this.currentQuestionResolves = [];
      return true;
    }

    return false;
  }

  public async addFile(contextFile: ContextFile) {
    const normalizedPath = this.normalizeFilePath(contextFile.path);
    logger.info('Adding file or folder:', {
      path: normalizedPath,
      readOnly: contextFile.readOnly,
    });
    const fileToAdd = { ...contextFile, path: normalizedPath };
    if (!(await this.sessionManager.addContextFile(fileToAdd))) {
      return false;
    }
    this.sendAddFile(fileToAdd);
    return true;
  }

  public sendAddFile(contextFile: ContextFile, noUpdate?: boolean) {
    this.findMessageConnectors('add-file').forEach((connector) => connector.sendAddFileMessage(contextFile, noUpdate));
  }

  public dropFile(filePath: string) {
    const normalizedPath = this.normalizeFilePath(filePath);
    logger.info('Dropping file or folder:', { path: normalizedPath });
    const file = this.sessionManager.dropContextFile(normalizedPath);
    if (file) {
      this.sendDropFile(file.path, file.readOnly);
    } else {
      // send the path as it might be a folder
      this.sendDropFile(normalizedPath);
    }
  }

  public sendDropFile(filePath: string, readOnly?: boolean, noUpdate?: boolean): void {
    const absolutePath = path.resolve(this.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.baseDir));
    const pathToSend = readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.baseDir) ? filePath : path.join(this.baseDir, filePath);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend, noUpdate));
  }

  public runCommand(command: string, addToHistory = true) {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    logger.info('Running command:', { command });

    if (command.trim() === 'reset') {
      this.sessionManager.clearMessages();
      this.mainWindow.webContents.send('clear-project', this.baseDir, true, false);
    }

    if (addToHistory) {
      void this.addToInputHistory(`/${command}`);
    }
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
    this.mainWindow.webContents.send('input-history-updated', inputHistoryData);
  }

  public async askQuestion(questionData: QuestionData): Promise<[string, string | undefined]> {
    if (this.currentQuestion) {
      // Wait if another question is already pending
      await new Promise((resolve) => {
        this.currentQuestionResolves.push(resolve);
      });
    }

    const storedAnswer = this.questionAnswers.get(this.getQuestionKey(questionData));

    if (questionData.isGroupQuestion && !questionData.answers) {
      // group questions have a default set of answers
      questionData.answers = [
        { text: '(Y)es', shortkey: 'y' },
        { text: '(N)o', shortkey: 'n' },
        { text: '(A)ll', shortkey: 'a' },
        { text: '(S)kip all', shortkey: 's' },
      ];
    }

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

      if (!questionData.internal) {
        // Auto-answer based on stored preference
        this.answerQuestion(storedAnswer);
      }
      return Promise.resolve([storedAnswer, undefined]);
    }

    // At this point, this.currentQuestion should be null due to the loop above,
    // or it was null initially.
    this.currentQuestion = questionData;

    this.notifyIfEnabled('Waiting for your input', questionData.text);

    // Store the resolve function for the promise
    return new Promise<[string, string | undefined]>((resolve) => {
      this.currentQuestionResolves.push(resolve);
      this.mainWindow.webContents.send('ask-question', questionData);
    });
  }

  public setAllTrackedFiles(files: string[]) {
    this.allTrackedFiles = files;
  }

  public updateAiderModels(modelsData: ModelsData) {
    const currentSettings = this.store.getProjectSettings(this.baseDir);
    const updatedSettings: ProjectSettings = {
      ...currentSettings,
      reasoningEffort: modelsData.reasoningEffort ? modelsData.reasoningEffort : undefined,
      thinkingTokens: modelsData.thinkingTokens ? modelsData.thinkingTokens : undefined,
    };
    this.store.saveProjectSettings(this.baseDir, updatedSettings);

    this.aiderModels = {
      ...modelsData,
      architectModel: modelsData.architectModel !== undefined ? modelsData.architectModel : this.getArchitectModel(),
    };
    this.mainWindow.webContents.send('update-aider-models', this.aiderModels);
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat?: EditFormat) {
    logger.info('Updating models:', {
      mainModel,
      weakModel,
      editFormat,
    });
    this.findMessageConnectors('set-models').forEach((connector) => connector.sendSetModelsMessage(mainModel, weakModel, editFormat));
  }

  public setArchitectModel(architectModel: string) {
    logger.info('Setting architect model', {
      architectModel,
    });
    this.updateAiderModels({
      ...this.aiderModels!,
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

  public getRepoMap(): string {
    return this.repoMap;
  }

  public setRepoMap(repoMap: string): void {
    this.repoMap = repoMap;
  }

  public updateRepoMapFromConnector(repoMap: string): void {
    this.setRepoMap(repoMap);
  }

  public openCommandOutput(command: string) {
    this.currentCommand = command;
    this.commandOutputs.set(command, '');
    this.addCommandOutput(command, '');
  }

  public closeCommandOutput() {
    if (!this.currentCommand) {
      return;
    }
    const command = this.currentCommand;
    const output = this.commandOutputs.get(command);
    if (output && output.trim()) {
      // Add the command output to the session manager as an assistant message, prepending the command
      this.sessionManager.addContextMessage(MessageRole.Assistant, `${command}\n\n${output}`);
    }
    this.commandOutputs.delete(command);
    this.currentCommand = null;
  }

  private addCommandOutput(command: string, output: string) {
    // Append output to the commandOutputs map
    const prev = this.commandOutputs.get(command) || '';
    this.commandOutputs.set(command, prev + output);

    this.mainWindow.webContents.send('command-output', {
      baseDir: this.baseDir,
      command,
      output,
    });
  }

  public addLogMessage(level: LogLevel, message?: string, finished = false) {
    const data: LogData = {
      baseDir: this.baseDir,
      level,
      message,
      finished,
    };

    this.mainWindow.webContents.send('log', data);
  }

  public getContextMessages() {
    return this.sessionManager.getContextMessages();
  }

  public sendAddMessage(role: MessageRole = MessageRole.User, content: string, acknowledge = true) {
    logger.debug('Adding message:', {
      baseDir: this.baseDir,
      role,
      content,
      acknowledge,
    });
    this.findMessageConnectors('add-message').forEach((connector) => connector.sendAddMessageMessage(role, content, acknowledge));
  }

  public clearContext(addToHistory = false, updateEstimatedTokens = true) {
    this.sessionManager.clearMessages();
    this.runCommand('clear', addToHistory);
    this.mainWindow.webContents.send('clear-project', this.baseDir, true, false);

    if (updateEstimatedTokens) {
      void this.updateAgentEstimatedTokens();
    }
  }

  public interruptResponse() {
    logger.info('Interrupting response:', { baseDir: this.baseDir });

    if (this.currentQuestion) {
      this.answerQuestion('n', 'Cancelled');
    }

    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public addToolMessage(id: string, serverName: string, toolName: string, args?: Record<string, unknown>, response?: string, usageReport?: UsageReportData) {
    logger.debug('Sending tool message:', {
      id,
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
    if (usageReport.agentTotalCost !== undefined) {
      this.agentTotalCost = usageReport.agentTotalCost;

      this.updateTokensInfo({
        agent: {
          cost: usageReport.agentTotalCost,
          tokens: usageReport.sentTokens + usageReport.receivedTokens + (usageReport.cacheReadTokens ?? 0) + (usageReport.cacheWriteTokens ?? 0),
        },
      });
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

  public async removeLastMessage() {
    this.sessionManager.removeLastMessage();
    this.reloadConnectorMessages();

    await this.updateAgentEstimatedTokens();
  }

  public async redoLastUserPrompt(mode: Mode, updatedPrompt?: string) {
    logger.info('Redoing last user prompt:', {
      baseDir: this.baseDir,
      mode,
      hasUpdatedPrompt: !!updatedPrompt,
    });
    const originalLastUserMessageContent = this.sessionManager.removeLastUserMessage();

    const promptToRun = updatedPrompt ?? originalLastUserMessageContent;

    if (promptToRun) {
      logger.info('Found message content to run, reloading and re-running prompt.');
      this.reloadConnectorMessages(); // This sends 'clear-project' which truncates UI messages
      await this.updateAgentEstimatedTokens();

      // No need to await runPrompt here, let it run in the background
      void this.runPrompt(promptToRun, mode);
    } else {
      logger.warn('Could not find a previous user message to redo or an updated prompt to run.');
    }
  }

  private reloadConnectorMessages() {
    this.runCommand('clear', false);
    this.sessionManager.toConnectorMessages().forEach((message) => {
      this.sendAddMessage(message.role, message.content, false);
    });
  }

  public addContextMessage(role: MessageRole, content: string, acknowledge = false) {
    logger.info('Adding context message:', {
      baseDir: this.baseDir,
      role,
      content: content.length > 100 ? `${content.slice()}...` : content,
    });

    this.sessionManager.addContextMessage(role, content);
    this.sendAddMessage(role, content, acknowledge);
    void this.updateAgentEstimatedTokens();
  }

  public async compactConversation(mode: Mode, customInstructions?: string) {
    const userMessage = this.sessionManager.getContextMessages()[0];

    if (!userMessage) {
      this.addLogMessage('warning', 'No conversation to compact.');
      return;
    }

    this.addLogMessage('loading', 'Compacting conversation...');

    const extractSummary = (content: string): string => {
      const lines = content.split('\n');
      const summaryMarker = '### **Conversation Summary**';
      const markerIndex = lines.findIndex((line) => line.trim() === summaryMarker);
      if (markerIndex !== -1) {
        return lines.slice(markerIndex).join('\n');
      }
      return content;
    };

    if (mode === 'agent') {
      // Agent mode logic
      const profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));

      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      const agentMessages = await this.agent.runAgent(this, COMPACT_CONVERSATION_AGENT_PROFILE, getCompactConversationPrompt(customInstructions));

      if (agentMessages.length > 0) {
        // Clear existing context and add the summary
        const summaryMessage = agentMessages[agentMessages.length - 1];
        summaryMessage.content = extractSummary(extractTextContent(summaryMessage.content));

        this.sessionManager.setContextMessages([userMessage, summaryMessage]);
        this.sessionManager.toConnectorMessages([userMessage, summaryMessage]).forEach((message) => {
          this.sendAddMessage(message.role, message.content, false);
        });

        await this.sessionManager.loadMessages(this.sessionManager.getContextMessages());
      }

      // After compaction, update estimated tokens
      await this.updateAgentEstimatedTokens();
    } else {
      const responses = await this.sendPrompt(getCompactConversationPrompt(customInstructions), 'ask', false, true);

      // add messages to session
      this.sessionManager.setContextMessages([userMessage], false);
      for (const response of responses) {
        if (response.content) {
          this.sessionManager.addContextMessage(MessageRole.Assistant, extractSummary(response.content));
        }
      }
      await this.sessionManager.loadMessages(this.sessionManager.getContextMessages());
    }

    this.addLogMessage('info', 'Conversation compacted.');
  }

  public async exportSessionToMarkdown(): Promise<void> {
    logger.info('Exporting session to Markdown:', { baseDir: this.baseDir });
    try {
      const markdownContent = await this.sessionManager.generateSessionMarkdown();

      if (markdownContent) {
        const dialogResult = await dialog.showSaveDialog(this.mainWindow, {
          title: 'Export Session to Markdown',
          defaultPath: `${this.baseDir}/session-${new Date().toISOString().replace(/:/g, '-').substring(0, 19)}.md`,
          filters: [{ name: 'Markdown Files', extensions: ['md'] }],
        });
        logger.info('showSaveDialog result:', { dialogResult });

        const { filePath } = dialogResult;

        if (filePath) {
          try {
            await fs.writeFile(filePath, markdownContent, 'utf8');
            logger.info(`Session exported successfully to ${filePath}`);
          } catch (writeError) {
            logger.error('Failed to write session Markdown file:', {
              filePath,
              error: writeError,
            });
          }
        } else {
          logger.info('Markdown export cancelled by user.');
        }
      }
    } catch (error) {
      logger.error('Error exporting session to Markdown', { error });
    }
  }

  updateTokensInfo(data: Partial<TokensInfoData>) {
    const filesTokensChanged = data.files ? Object.keys(data.files).length !== Object.keys(this.tokensInfo.files).length : false;
    const repoMapChanged = data.repoMap ? data.repoMap.tokens !== this.tokensInfo.repoMap.tokens : false;

    this.tokensInfo = {
      ...this.tokensInfo,
      ...data,
    };

    this.mainWindow.webContents.send('update-tokens-info', this.tokensInfo);

    if (filesTokensChanged || repoMapChanged) {
      void this.updateAgentEstimatedTokens(true, true);
    }
  }

  async updateAgentEstimatedTokens(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    logger.info('Updating agent estimated tokens', {
      checkContextFilesIncluded,
      checkRepoMapIncluded,
    });
    const agentProfile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
    if (!agentProfile || (checkContextFilesIncluded && !agentProfile.includeContextFiles && checkRepoMapIncluded && !agentProfile.includeRepoMap)) {
      return;
    }

    const tokens = await this.agent.estimateTokens(this, agentProfile);
    this.updateTokensInfo({
      agent: {
        cost: this.agentTotalCost,
        tokens,
        tokensEstimated: true,
      },
    });
  }

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    const projectSettings = this.store.getProjectSettings(this.baseDir);
    const oldAgentProfile = getActiveAgentProfile(oldSettings, projectSettings);
    const newAgentProfile = getActiveAgentProfile(newSettings, projectSettings);

    // Check for changes in agent config properties that affect token count
    const modelChanged = oldAgentProfile?.model !== newAgentProfile?.model;
    const disabledServersChanged = JSON.stringify(oldAgentProfile?.enabledServers) !== JSON.stringify(newAgentProfile?.enabledServers);
    const toolApprovalsChanged = JSON.stringify(oldAgentProfile?.toolApprovals) !== JSON.stringify(newAgentProfile?.toolApprovals);
    const includeContextFilesChanged = oldAgentProfile?.includeContextFiles !== newAgentProfile?.includeContextFiles;
    const includeRepoMapChanged = oldAgentProfile?.includeRepoMap !== newAgentProfile?.includeRepoMap;
    const useAiderToolsChanged = oldAgentProfile?.useAiderTools !== newAgentProfile?.useAiderTools;
    const usePowerToolsChanged = oldAgentProfile?.usePowerTools !== newAgentProfile?.usePowerTools;
    const customInstructionsChanged = oldAgentProfile?.customInstructions !== newAgentProfile?.customInstructions;

    const agentSettingsAffectingTokensChanged =
      modelChanged ||
      disabledServersChanged ||
      toolApprovalsChanged ||
      includeContextFilesChanged ||
      includeRepoMapChanged ||
      useAiderToolsChanged ||
      usePowerToolsChanged ||
      customInstructionsChanged;

    if (agentSettingsAffectingTokensChanged) {
      logger.info('Agent settings affecting token count changed, updating estimated tokens.');
      void this.updateAgentEstimatedTokens();
    }
  }

  async updateTask(taskId: string, updates: { title?: string; completed?: boolean }): Promise<Task | undefined> {
    return this.taskManager.updateTask(taskId, updates);
  }

  async prepareTasks(titles: string[]): Promise<Task[]> {
    return this.taskManager.prepareTasks(titles);
  }

  async listTasks(completed?: boolean): Promise<Task[]> {
    const tasks = await this.taskManager.getTasks();
    if (completed === undefined) {
      return tasks;
    }
    return tasks.filter((task) => task.completed === completed);
  }

  private getTodoFilePath(): string {
    return path.resolve(this.baseDir, AIDER_DESK_TODOS_FILE);
  }

  public async readTodoFile(): Promise<{ initialUserPrompt: string; items: TodoItem[] } | null> {
    const todoFilePath = this.getTodoFilePath();
    try {
      const content = await fs.readFile(todoFilePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  public async writeTodoFile(data: { initialUserPrompt: string; items: TodoItem[] }): Promise<void> {
    const todoFilePath = this.getTodoFilePath();
    await fs.mkdir(path.dirname(todoFilePath), { recursive: true });
    await fs.writeFile(todoFilePath, JSON.stringify(data, null, 2), 'utf8');
  }

  public async getTodos(): Promise<TodoItem[]> {
    const data = await this.readTodoFile();
    return data?.items || [];
  }

  public async setTodos(items: TodoItem[], initialUserPrompt = ''): Promise<void> {
    await this.writeTodoFile({ initialUserPrompt, items });
  }

  public async addTodo(name: string): Promise<TodoItem[]> {
    const data = await this.readTodoFile();
    const currentItems = data?.items || [];
    const newItem: TodoItem = { name, completed: false };
    const updatedItems = [...currentItems, newItem];
    await this.writeTodoFile({ initialUserPrompt: data?.initialUserPrompt || '', items: updatedItems });
    return updatedItems;
  }

  public async updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]> {
    const data = await this.readTodoFile();
    if (!data) {
      throw new Error('No todo items found to update');
    }

    const itemIndex = data.items.findIndex((item) => item.name === name);
    if (itemIndex === -1) {
      throw new Error(`Todo item with name "${name}" not found`);
    }

    data.items[itemIndex] = { ...data.items[itemIndex], ...updates };
    await this.writeTodoFile(data);
    return data.items;
  }

  public async deleteTodo(name: string): Promise<TodoItem[]> {
    const data = await this.readTodoFile();
    if (!data) {
      throw new Error('No todo items found to delete');
    }

    const updatedItems = data.items.filter((item) => item.name !== name);
    await this.writeTodoFile({ initialUserPrompt: data.initialUserPrompt, items: updatedItems });
    return updatedItems;
  }

  async initProjectRulesFile(): Promise<void> {
    logger.info('Initializing PROJECT.md rules file', { baseDir: this.baseDir });

    this.addLogMessage('loading', 'Analyzing project to create PROJECT.md rules file...');

    const messages = this.sessionManager.getContextMessages();
    const files = this.sessionManager.getContextFiles();
    // clear context before execution
    this.sessionManager.clearMessages(false);
    this.sessionManager.setContextFiles([], false);

    try {
      // Get the active agent profile
      const activeProfile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
      if (!activeProfile) {
        throw new Error('No active agent profile found');
      }

      // Create a modified INIT_PROJECT_RULES_AGENT_PROFILE with active profile's provider and model
      const initProjectRulesAgentProfile: AgentProfile = {
        ...INIT_PROJECT_RULES_AGENT_PROFILE,
        provider: activeProfile.provider,
        model: activeProfile.model,
      };

      // Run the agent with the modified profile
      await this.runAgent(initProjectRulesAgentProfile, getInitProjectPrompt());

      // Check if the PROJECT.md file was created
      const projectRulesPath = path.join(this.baseDir, '.aider-desk', 'rules', 'PROJECT.md');
      const projectRulesExists = await fileExists(projectRulesPath);

      if (projectRulesExists) {
        logger.info('PROJECT.md file created successfully', { path: projectRulesPath });
        this.addLogMessage('info', 'PROJECT.md has been successfully initialized.');

        // Ask the user if they want to add this file to .aider.conf.yml
        const [answer] = await this.askQuestion({
          baseDir: this.baseDir,
          text: 'Do you want to add this file as read-only file for Aider (in .aider.conf.yml)?',
          defaultAnswer: 'y',
          internal: false,
        });

        if (answer === 'y') {
          await this.addProjectRulesToAiderConfig();
        }
      } else {
        logger.warn('PROJECT.md file was not created');
        this.addLogMessage('warning', 'PROJECT.md file was not created.');
      }
    } catch (error) {
      logger.error('Error initializing PROJECT.md rules file:', error);
      this.addLogMessage('error', `Failed to initialize PROJECT.md rules file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      this.sessionManager.setContextFiles(files, false);
      this.sessionManager.setContextMessages(messages, false);
    }
  }

  private async addProjectRulesToAiderConfig(): Promise<void> {
    const aiderConfigPath = path.join(this.baseDir, '.aider.conf.yml');
    const projectRulesRelativePath = '.aider-desk/rules/PROJECT.md';

    try {
      let config: { read?: string | string[] } = {};

      // Read existing config if it exists
      if (await fileExists(aiderConfigPath)) {
        const configContent = await fs.readFile(aiderConfigPath, 'utf8');
        config = (YAML.parse(configContent) as { read?: string | string[] }) || {};
      }

      // Ensure read section exists and is an array
      if (!config.read) {
        config.read = [];
      } else if (!Array.isArray(config.read)) {
        config.read = [config.read];
      }

      // Add PROJECT.md to read section if not already present
      if (!config.read.includes(projectRulesRelativePath)) {
        config.read.push(projectRulesRelativePath);

        // Write the updated config
        const yamlContent = YAML.stringify(config);
        await fs.writeFile(aiderConfigPath, yamlContent, 'utf8');

        logger.info('Added PROJECT.md to .aider.conf.yml', { path: aiderConfigPath });
        this.addLogMessage('info', `Added ${projectRulesRelativePath} to .aider.conf.yml`);
      } else {
        logger.info('PROJECT.md already exists in .aider.conf.yml');
      }
    } catch (error) {
      logger.error('Error updating .aider.conf.yml:', error);
      this.addLogMessage('error', `Failed to update .aider.conf.yml: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { createHash } from 'crypto';
import { unlinkSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

import { simpleGit } from 'simple-git';
import { Notification } from 'electron';
import YAML from 'yaml';
import {
  AgentProfile,
  ContextAssistantMessage,
  ContextFile,
  ContextMessage,
  CustomCommand,
  EditFormat,
  FileEdit,
  InputHistoryData,
  LogData,
  LogLevel,
  MessageRole,
  Mode,
  ModelsData,
  ProjectSettings,
  PromptContext,
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
import { COMPACT_CONVERSATION_AGENT_PROFILE, INIT_PROJECT_AGENTS_PROFILE } from '@common/agent';
import treeKill from 'tree-kill';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';

import type { SimpleGit } from 'simple-git';

import { getAllFiles } from '@/utils/file-system';
import { getCompactConversationPrompt, getInitProjectPrompt, getSystemPrompt } from '@/agent/prompts';
import { AIDER_DESK_CONNECTOR_DIR, AIDER_DESK_PROJECT_RULES_DIR, AIDER_DESK_TODOS_FILE, PID_FILES_DIR, PYTHON_COMMAND, SERVER_PORT } from '@/constants';
import { TaskManager } from '@/tasks';
import { SessionManager } from '@/session';
import { Agent } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { MessageAction, ResponseMessage } from '@/messages';
import { Store } from '@/store';
import { DEFAULT_MAIN_MODEL, ModelManager } from '@/models';
import { CustomCommandManager, ShellCommandError } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { getEnvironmentVariablesForAider } from '@/utils';

export class Project {
  private process: ChildProcessWithoutNullStreams | null = null;
  private connectors: Connector[] = [];
  private currentCommand: string | null = null;
  private currentQuestion: QuestionData | null = null;
  private currentQuestionResolves: ((answer: [string, string | undefined]) => void)[] = [];
  private questionAnswers: Map<string, 'y' | 'n'> = new Map();
  private currentResponseMessageId: string | null = null;
  private currentPromptContext: PromptContext | null = null;
  private inputHistoryFile = '.aider.input.history';
  private aiderModels: ModelsData | null = null;
  private tokensInfo: TokensInfoData;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];
  public sessionManager: SessionManager = new SessionManager(this);
  private customCommandManager: CustomCommandManager;
  private taskManager: TaskManager = new TaskManager();
  private commandOutputs: Map<string, string> = new Map();
  private repoMap: string = '';
  private aiderStarting: boolean = false;

  aiderTotalCost: number = 0;
  agentTotalCost: number = 0;

  readonly git: SimpleGit;

  constructor(
    public readonly baseDir: string,
    private readonly store: Store,
    private readonly agent: Agent,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
  ) {
    this.git = simpleGit(this.baseDir);
    this.customCommandManager = new CustomCommandManager(this);
    this.tokensInfo = {
      baseDir,
      chatHistory: { cost: 0, tokens: 0 },
      files: {},
      repoMap: { cost: 0, tokens: 0 },
      systemMessages: { cost: 0, tokens: 0 },
      agent: { cost: 0, tokens: 0 },
    };
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
          await this.sessionManager.loadAutosaved();
          break;
      }
    } catch (error) {
      logger.error('Error loading session:', { error });
    }

    this.sessionManager.enableAutosave();

    this.sessionManager.getContextFiles().forEach((contextFile) => {
      this.eventManager.sendFileAdded(this.baseDir, contextFile);
    });

    this.agentTotalCost = 0;
    this.aiderTotalCost = 0;
    this.currentPromptContext = null;
    this.currentResponseMessageId = null;
    this.currentCommand = null;
    this.currentQuestion = null;
    this.currentQuestionResolves = [];
    this.questionAnswers.clear();

    await this.updateAutocompletionData([], []);
    this.sendContextFilesUpdated();

    await Promise.all([this.startAider(), this.sendInputHistoryUpdatedEvent(), this.updateContextInfo()]);

    this.eventManager.sendProjectStarted(this.baseDir);
  }

  public addConnector(connector: Connector) {
    logger.info('Adding connector for base directory:', {
      baseDir: this.baseDir,
      source: connector.source,
    });

    // Set aiderStarting to false when a connector with source==='aider' is added
    if (connector.source === 'aider') {
      this.aiderStarting = false;
    }

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
    if (connector.listenTo.includes('update-env-vars')) {
      const environmentVariables = getEnvironmentVariablesForAider(this.store.getSettings(), this.baseDir);
      this.sendUpdateEnvVars(environmentVariables);
    }
    if (connector.listenTo.includes('request-context-info')) {
      connector.sendRequestTokensInfoMessage(this.sessionManager.toConnectorMessages(), this.getContextFiles());
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

  private async startAider(): Promise<void> {
    if (this.process) {
      await this.killAider();
    }

    await this.checkAndCleanupPidFile();

    // Set aiderStarting to true when starting aider
    this.aiderStarting = true;

    const settings = this.store.getSettings();
    const projectSettings = this.store.getProjectSettings(this.baseDir);
    const mainModel = projectSettings.mainModel || DEFAULT_MAIN_MODEL;
    const weakModel = projectSettings.weakModel;
    const modelEditFormats = projectSettings.modelEditFormats;
    const reasoningEffort = projectSettings.reasoningEffort;
    const environmentVariables = getEnvironmentVariablesForAider(settings, this.baseDir);
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
      baseDir: this.baseDir,
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
      ...envFromMain,
      ...envFromWeak,
      PYTHONPATH: AIDER_DESK_CONNECTOR_DIR,
      PYTHONUTF8: process.env.AIDER_DESK_OMIT_PYTHONUTF8 ? undefined : '1',
      BASE_DIR: this.baseDir,
      CONNECTOR_SERVER_URL: `http://localhost:${SERVER_PORT}`,
      CONNECTOR_CONFIRM_BEFORE_EDIT: settings.aider.confirmBeforeEdit ? '1' : '0',
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

      // Send stderr errors as log messages while aider is starting
      if (this.aiderStarting) {
        this.addLogMessage('error', output);
      }
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
    this.eventManager.sendClearProject(this.baseDir, true, true);
    await this.killAider();
    this.customCommandManager.dispose();
    this.sessionManager.disableAutosave();
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
    await this.updateContextInfo();
  }

  public async loadSessionFiles(name: string) {
    const session = await this.sessionManager.findSession(name);
    if (!session) {
      return;
    }

    await this.sessionManager.loadFiles(session.contextFiles || []);
    await this.updateContextInfo();
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
        this.currentPromptContext = null;
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

  private async waitForCurrentPromptToFinish() {
    if (this.currentPromptContext) {
      logger.info('Waiting for prompt to finish...');
      await new Promise<void>((resolve) => {
        this.runPromptResolves.push(() => resolve());
      });
    }
  }

  public async runPrompt(prompt: string, mode?: Mode): Promise<ResponseCompletedData[]> {
    if (this.currentQuestion) {
      if (this.answerQuestion('n', prompt)) {
        logger.debug('Processed by the answerQuestion function.');
        return [];
      }
    }

    await this.waitForCurrentPromptToFinish();

    logger.info('Running prompt:', {
      baseDir: this.baseDir,
      prompt,
      mode,
    });

    await this.addToInputHistory(prompt);

    this.addUserMessage(prompt, mode);
    this.addLogMessage('loading');

    this.telemetryManager.captureRunPrompt(mode);

    // Generate promptContext for this run
    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    if (mode === 'agent') {
      const profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
      logger.debug('AgentProfile:', profile);

      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      return this.runPromptInAgent(profile, prompt, promptContext);
    } else {
      return this.runPromptInAider(prompt, promptContext, mode);
    }
  }

  public async runPromptInAider(prompt: string, promptContext: PromptContext, mode?: Mode): Promise<ResponseCompletedData[]> {
    const responses = await this.sendPrompt(prompt, promptContext, mode);
    logger.debug('Responses:', { responses });

    // add messages to session
    this.sessionManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });
    for (const response of responses) {
      // if (response.reflectedMessage) {
      //   this.sessionManager.addContextMessage(MessageRole.User, response.reflectedMessage);
      // }
      if (response.content || response.reflectedMessage) {
        // Create enhanced assistant message with full metadata
        const assistantMessage: ContextAssistantMessage = {
          id: response.messageId,
          role: MessageRole.Assistant,
          content: response.content,
          usageReport: response.usageReport,
          reflectedMessage: response.reflectedMessage,
          editedFiles: response.editedFiles,
          commitHash: response.commitHash,
          commitMessage: response.commitMessage,
          diff: response.diff,
          promptContext,
        };
        this.sessionManager.addContextMessage(assistantMessage);
      }
    }

    this.sendRequestContextInfo();
    this.notifyIfEnabled('Prompt finished', 'Your Aider task has finished.');

    return responses;
  }

  public async runPromptInAgent(
    profile: AgentProfile,
    prompt: string,
    promptContext: PromptContext = { id: uuidv4() },
    contextMessages?: ContextMessage[],
    contextFiles?: ContextFile[],
    systemPrompt?: string,
  ): Promise<ResponseCompletedData[]> {
    const agentMessages = await this.agent.runAgent(this, profile, prompt, promptContext, contextMessages, contextFiles, systemPrompt);
    if (agentMessages.length > 0) {
      agentMessages.forEach((message) => this.sessionManager.addContextMessage(message));

      // send messages to connectors
      this.sessionManager.toConnectorMessages(agentMessages).forEach((message) => {
        this.sendAddMessage(message.role, message.content, false);
      });
    }

    this.notifyIfEnabled('Prompt finished', 'Your Agent task has finished.');
    this.sendRequestContextInfo();

    return [];
  }

  public async runSubagent(
    profile: AgentProfile,
    prompt: string,
    contextMessages: ContextMessage[],
    contextFiles: ContextFile[],
    systemPrompt?: string,
    abortSignal?: AbortSignal,
    promptContext?: PromptContext,
  ): Promise<ContextMessage[]> {
    return await this.agent.runAgent(this, profile, prompt, promptContext, contextMessages, contextFiles, systemPrompt, abortSignal);
  }

  public sendPrompt(
    prompt: string,
    promptContext: PromptContext = { id: uuidv4() },
    mode?: Mode,
    messages?: { role: MessageRole; content: string }[],
    files?: ContextFile[],
  ): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
    this.currentResponseMessageId = null;
    this.currentPromptContext = promptContext;

    const connectorMessages = messages || this.sessionManager.toConnectorMessages();
    const contextFiles = files || this.sessionManager.getContextFiles();
    const architectModel = this.getArchitectModel();
    const architectModelMapping = architectModel ? this.modelManager.getAiderModelMapping(architectModel) : null;

    this.findMessageConnectors('prompt').forEach((connector) => {
      connector.sendPromptMessage(prompt, promptContext, mode, architectModelMapping?.modelName, connectorMessages, contextFiles);
    });

    // Wait for prompt to finish and return collected responses
    return new Promise((resolve) => {
      this.runPromptResolves.push(resolve);
    });
  }

  private getArchitectModel(): string | null {
    return this.store.getProjectSettings(this.baseDir).architectModel || null;
  }

  public promptFinished(promptId?: string) {
    if (promptId && promptId !== this.currentPromptContext?.id) {
      logger.debug('Received prompt finished for different prompt id', {
        baseDir: this.baseDir,
        expectedPromptId: this.currentPromptContext?.id,
        receivedPromptId: promptId,
      });
      return;
    }

    if (this.currentResponseMessageId) {
      this.eventManager.sendResponseCompleted({
        messageId: this.currentResponseMessageId,
        baseDir: this.baseDir,
        content: '',
      });
      this.currentResponseMessageId = null;
    }

    // Notify waiting prompts with collected responses
    const responses = [...this.currentPromptResponses];
    this.currentPromptResponses = [];
    this.currentPromptContext = null;
    this.closeCommandOutput();

    while (this.runPromptResolves.length) {
      const resolve = this.runPromptResolves.shift();
      if (resolve) {
        resolve(responses);
      }
    }
  }

  public processResponseMessage(message: ResponseMessage, saveToDb = true) {
    if (!message.finished) {
      logger.debug(`Sending response chunk to ${this.baseDir}`);
      const data: ResponseChunkData = {
        messageId: message.id,
        baseDir: this.baseDir,
        chunk: message.content,
        reflectedMessage: message.reflectedMessage,
        promptContext: message.promptContext,
      };
      this.eventManager.sendResponseChunk(data);
    } else {
      logger.info(`Sending response completed to ${this.baseDir}`);
      logger.debug(`Message data: ${JSON.stringify(message)}`);

      const usageReport = message.usageReport
        ? typeof message.usageReport === 'string'
          ? parseUsageReport(this.aiderModels?.mainModel || 'unknown', message.usageReport)
          : message.usageReport
        : undefined;

      if (usageReport && saveToDb) {
        this.dataManager.saveMessage(message.id, 'assistant', this.baseDir, usageReport.model, usageReport, message.content);
      }

      if (usageReport) {
        logger.debug(`Usage report: ${JSON.stringify(usageReport)}`);
        this.updateTotalCosts(usageReport);
      }
      const data: ResponseCompletedData = {
        messageId: message.id,
        content: message.content,
        reflectedMessage: message.reflectedMessage,
        baseDir: this.baseDir,
        editedFiles: message.editedFiles,
        commitHash: message.commitHash,
        commitMessage: message.commitMessage,
        diff: message.diff,
        usageReport,
        sequenceNumber: message.sequenceNumber,
        promptContext: message.promptContext,
      };

      this.sendResponseCompleted(data);
      this.currentResponseMessageId = null;
      this.closeCommandOutput();

      // Collect the completed response
      this.currentPromptResponses.push(data);
      // Sort by sequence number when adding
      this.currentPromptResponses.sort((a, b) => (a.sequenceNumber || 0) - (b.sequenceNumber || 0));
    }
  }

  sendResponseCompleted(data: ResponseCompletedData) {
    this.eventManager.sendResponseCompleted(data);
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
    const addedFiles = await this.sessionManager.addContextFile(fileToAdd);
    if (addedFiles.length === 0) {
      return false;
    }

    // Send add file message for each added file
    for (const addedFile of addedFiles) {
      this.sendAddFile(addedFile);
    }

    this.sendContextFilesUpdated();
    await this.updateContextInfo(true, true);

    return true;
  }

  public sendAddFile(contextFile: ContextFile, noUpdate?: boolean) {
    this.findMessageConnectors('add-file').forEach((connector) => connector.sendAddFileMessage(contextFile, noUpdate));
  }

  public dropFile(filePath: string) {
    const normalizedPath = this.normalizeFilePath(filePath);
    logger.info('Dropping file or folder:', { path: normalizedPath });
    const droppedFiles = this.sessionManager.dropContextFile(normalizedPath);

    // Send drop file message for each dropped file
    for (const droppedFile of droppedFiles) {
      this.sendDropFile(droppedFile.path, droppedFile.readOnly);
    }

    this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
  }

  public sendDropFile(filePath: string, readOnly?: boolean, noUpdate?: boolean): void {
    const absolutePath = path.resolve(this.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.baseDir));
    const pathToSend = readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.baseDir) ? filePath : path.join(this.baseDir, filePath);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend, noUpdate));
  }

  private sendContextFilesUpdated() {
    this.eventManager.sendContextFilesUpdated(this.baseDir, this.sessionManager.getContextFiles());
  }

  public async runCommand(command: string, addToHistory = true) {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    let sendToConnectors = true;

    logger.info('Running command:', { command, addToHistory });

    if (addToHistory) {
      void this.addToInputHistory(`/${command}`);
    }

    if (command.trim() === 'reset') {
      this.sessionManager.clearMessages();
      this.eventManager.sendClearProject(this.baseDir, true, false);
    }

    if (command.trim() === 'undo') {
      sendToConnectors = false;
      try {
        // Get the Git root directory to handle monorepo scenarios
        const gitRoot = await this.git.revparse(['--show-toplevel']);
        const gitRootDir = simpleGit(gitRoot);

        // Get the current HEAD commit hash before undoing
        const commitHash = await gitRootDir.revparse(['HEAD']);
        const commitMessage = await gitRootDir.show(['--format=%s', '--no-patch', 'HEAD']);

        // Get all files from the last commit
        const lastCommitFiles = await gitRootDir.show(['--name-only', '--pretty=format:', 'HEAD']);
        const files = lastCommitFiles.split('\n').filter((file) => file.trim() !== '');

        // For each file, check if it exists at HEAD~1 before attempting checkout
        for (const file of files) {
          try {
            // Check if file exists at HEAD~1
            await gitRootDir.show(['HEAD~1', '--', file]);
            // If it exists, checkout the previous version
            await gitRootDir.checkout(['HEAD~1', '--', file]);
          } catch {
            await gitRootDir.rm(file);
          }
        }

        // Reset --soft HEAD~1
        await gitRootDir.reset(['--soft', 'HEAD~1']);
        logger.info(`Reverted: ${commitMessage} (${commitHash.substring(0, 7)})`);
        this.addLogMessage('info', `Reverted ${commitHash.substring(0, 7)}: ${commitMessage}`);
      } catch (error) {
        logger.error('Failed to undo last commit:', {
          error: error instanceof Error ? error.message : String(error),
        });
        this.addLogMessage('error', 'Failed to undo last commit.');
      }
    }

    if (sendToConnectors) {
      this.findMessageConnectors('run-command').forEach((connector) =>
        connector.sendRunCommandMessage(command, this.sessionManager.toConnectorMessages(), this.sessionManager.getContextFiles()),
      );
    }
  }

  public updateContextFiles(contextFiles: ContextFile[]) {
    this.sessionManager.setContextFiles(contextFiles);
    this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
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

  public async askQuestion(questionData: QuestionData, awaitAnswer = true): Promise<[string, string | undefined]> {
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

    // At this point, this.currentQuestion should be null due to the loop above,
    // or it was null initially.
    this.currentQuestion = questionData;

    if (storedAnswer) {
      logger.info('Found stored answer for question:', {
        baseDir: this.baseDir,
        question: questionData,
        answer: storedAnswer,
      });

      if (!questionData.internal) {
        // Auto-answer based on stored preference
        this.answerQuestion(storedAnswer);
      } else {
        this.currentQuestion = null;
      }
      return Promise.resolve([storedAnswer, undefined]);
    }

    this.notifyIfEnabled('Waiting for your input', questionData.text);

    // Store the resolve function for the promise
    return new Promise<[string, string | undefined]>((resolve) => {
      if (awaitAnswer) {
        this.currentQuestionResolves.push(resolve);
      }
      this.eventManager.sendAskQuestion(questionData);
      if (!awaitAnswer) {
        resolve(['', undefined]);
      }
    });
  }

  public async updateAutocompletionData(words: string[], models: string[]) {
    this.eventManager.sendUpdateAutocompletion(this.baseDir, words, await getAllFiles(this.baseDir), models);
  }

  public updateAiderModels(modelsData: ModelsData) {
    const currentSettings = this.store.getProjectSettings(this.baseDir);
    const updatedSettings: ProjectSettings = {
      ...currentSettings,
      reasoningEffort: modelsData.reasoningEffort ? modelsData.reasoningEffort : undefined,
      thinkingTokens: modelsData.thinkingTokens ? modelsData.thinkingTokens : undefined,
    };
    this.store.saveProjectSettings(this.baseDir, updatedSettings);

    const projectSettings = this.store.getProjectSettings(this.baseDir);
    const mainModel = projectSettings.mainModel || DEFAULT_MAIN_MODEL;
    const mainModelParts = mainModel.split('/');
    const weakModelParts = projectSettings.weakModel?.split('/') || modelsData.weakModel?.split('/');
    const architectModelParts = projectSettings.architectModel?.split('/') || modelsData.architectModel?.split('/');

    const getWeakModelProvider = () => {
      if (modelsData.mainModel !== projectSettings.mainModel) {
        // use the provider prefix from the main model when Aider's provider prefix is different
        return mainModelParts[0];
      }
      return weakModelParts ? weakModelParts[0] : mainModelParts[0];
    };

    this.aiderModels = {
      ...modelsData,
      mainModel: `${mainModelParts[0]}/${mainModelParts.slice(1).join('/')}`,
      weakModel: weakModelParts ? `${getWeakModelProvider()}/${weakModelParts.slice(1).join('/')}` : null,
      architectModel: architectModelParts ? `${architectModelParts[0]}/${architectModelParts.slice(1).join('/')}` : null,
    };
    this.eventManager.sendUpdateAiderModels(this.aiderModels);
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff') {
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

    this.sendSetModels(mainModelName, weakModelName, editFormat, { ...envFromMain, ...envFromWeak });
  }

  private sendSetModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff', environmentVariables?: Record<string, string>) {
    this.findMessageConnectors('set-models').forEach((connector) => connector.sendSetModelsMessage(mainModel, weakModel, editFormat, environmentVariables));
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

  public async getAddableFiles(searchRegex?: string): Promise<string[]> {
    const contextFilePaths = new Set(this.getContextFiles().map((file) => file.path));
    let files = (await getAllFiles(this.baseDir)).filter((file) => !contextFilePaths.has(file));

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

  private addCommandOutput(command: string, output: string) {
    // Append output to the commandOutputs map
    const prev = this.commandOutputs.get(command) || '';
    this.commandOutputs.set(command, prev + output);

    this.eventManager.sendCommandOutput(this.baseDir, command, output);
  }

  public closeCommandOutput(addToContext = true) {
    if (!this.currentCommand) {
      return;
    }
    const command = this.currentCommand;
    const output = this.commandOutputs.get(command);
    if (output && output.trim() && addToContext) {
      // Add the command output to the session manager as an assistant message, prepending the command
      this.sessionManager.addContextMessage(MessageRole.User, `Output from \`${command}\`\n\n\`\`\`${output}\`\`\``);
      this.sessionManager.addContextMessage(MessageRole.Assistant, 'Ok.');

      void this.updateContextInfo(true, false);
    }
    this.commandOutputs.delete(command);
    this.currentCommand = null;
  }

  public addLogMessage(level: LogLevel, message?: string, finished = false, promptContext?: PromptContext) {
    const data: LogData = {
      baseDir: this.baseDir,
      level,
      message,
      finished,
      promptContext,
    };

    this.eventManager.sendLog(data);
  }

  public getContextMessages() {
    return this.sessionManager.getContextMessages();
  }

  public async addContextMessage(role: MessageRole, content: string, usageReport?: UsageReportData) {
    logger.debug('Adding context message to session:', {
      baseDir: this.baseDir,
      role,
      content: content.substring(0, 30),
    });

    this.sessionManager.addContextMessage(role, content, usageReport);
    await this.updateContextInfo();
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

  public async clearContext(addToHistory = false, updateContextInfo = true) {
    logger.info('Clearing context:', {
      baseDir: this.baseDir,
      addToHistory,
      updateContextInfo,
    });

    this.sessionManager.clearMessages();
    await this.runCommand('clear', addToHistory);
    this.eventManager.sendClearProject(this.baseDir, true, false);

    if (updateContextInfo) {
      await this.updateContextInfo();
    }
  }

  public interruptResponse() {
    logger.debug('Interrupting response:', { baseDir: this.baseDir });

    if (this.currentQuestion) {
      this.answerQuestion('n', 'Cancelled');
    }

    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
    this.promptFinished();
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public addToolMessage(
    id: string,
    serverName: string,
    toolName: string,
    args?: Record<string, unknown>,
    response?: string,
    usageReport?: UsageReportData,
    promptContext?: PromptContext,
    saveToDb = true,
  ) {
    logger.debug('Sending tool message:', {
      id,
      baseDir: this.baseDir,
      serverName,
      name: toolName,
      args,
      response,
      usageReport,
      promptContext,
    });
    const data: ToolData = {
      baseDir: this.baseDir,
      id,
      serverName,
      toolName,
      args,
      response,
      usageReport,
      promptContext,
    };

    if (response && usageReport && saveToDb) {
      this.dataManager.saveMessage(id, 'tool', this.baseDir, usageReport.model, usageReport, {
        toolName,
        args,
        response,
      });
    }

    // Update total costs when adding the tool message
    if (usageReport) {
      this.updateTotalCosts(usageReport);
    }

    this.eventManager.sendTool(data);
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

  public addUserMessage(content: string, mode?: Mode, promptContext?: PromptContext) {
    logger.info('Adding user message:', {
      baseDir: this.baseDir,
      content: content.substring(0, 100),
      mode,
    });

    const data: UserMessageData = {
      baseDir: this.baseDir,
      content,
      mode,
      promptContext,
    };

    this.eventManager.sendUserMessage(data);
  }

  public async removeLastMessage() {
    this.sessionManager.removeLastMessage();
    await this.reloadConnectorMessages();

    await this.updateContextInfo();
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
      await this.reloadConnectorMessages(); // This sends 'clear-project' which truncates UI messages
      await this.updateContextInfo();

      // No need to await runPrompt here, let it run in the background
      void this.runPrompt(promptToRun, mode);
    } else {
      logger.warn('Could not find a previous user message to redo or an updated prompt to run.');
    }
  }

  private async reloadConnectorMessages() {
    await this.runCommand('clear', false);
    this.sessionManager.toConnectorMessages().forEach((message) => {
      this.sendAddMessage(message.role, message.content, false);
    });
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

      const compactConversationAgentProfile: AgentProfile = {
        ...COMPACT_CONVERSATION_AGENT_PROFILE,
        provider: profile.provider,
        model: profile.model,
      };
      const agentMessages = await this.agent.runAgent(this, compactConversationAgentProfile, getCompactConversationPrompt(customInstructions));

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
    } else {
      const responses = await this.sendPrompt(getCompactConversationPrompt(customInstructions), undefined, 'ask', undefined, []);

      // add messages to session
      this.sessionManager.setContextMessages([userMessage], false);
      for (const response of responses) {
        if (response.content) {
          this.sessionManager.addContextMessage(MessageRole.Assistant, extractSummary(response.content));
        }
      }
      await this.sessionManager.loadMessages(this.sessionManager.getContextMessages());
    }

    await this.updateContextInfo();
    this.addLogMessage('info', 'Conversation compacted.');
  }

  public async generateSessionMarkdown(): Promise<string | null> {
    logger.info('Exporting session to Markdown:', { baseDir: this.baseDir });
    return await this.sessionManager.generateSessionMarkdown();
  }

  updateTokensInfo(data: Partial<TokensInfoData>) {
    this.tokensInfo = {
      ...this.tokensInfo,
      ...data,
    };

    this.eventManager.sendUpdateTokensInfo(this.tokensInfo);
  }

  async updateContextInfo(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    this.sendRequestContextInfo();
    await this.updateAgentEstimatedTokens(checkContextFilesIncluded, checkRepoMapIncluded);
  }

  private sendRequestContextInfo() {
    this.findMessageConnectors('request-context-info').forEach((connector) =>
      connector.sendRequestTokensInfoMessage(this.sessionManager.toConnectorMessages(), this.getContextFiles()),
    );
  }

  async updateAgentEstimatedTokens(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    logger.debug('Updating agent estimated tokens', {
      baseDir: this.baseDir,
      checkContextFilesIncluded,
      checkRepoMapIncluded,
    });
    const agentProfile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
    if (!agentProfile || (checkContextFilesIncluded && !agentProfile.includeContextFiles && checkRepoMapIncluded && !agentProfile.includeRepoMap)) {
      return;
    }

    const tokens = await this.debouncedEstimateTokens(agentProfile);

    if (tokens !== undefined) {
      this.updateTokensInfo({
        agent: {
          cost: this.agentTotalCost,
          tokens,
          tokensEstimated: true,
        },
      });
    }
  }

  debouncedEstimateTokens = debounce(async (agentProfile: AgentProfile) => this.agent.estimateTokens(this, agentProfile), 1000);

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
      logger.debug('Agent settings affecting token count changed, updating estimated tokens.');
      void this.updateContextInfo();
    }

    // Check for changes in environment variables or LLM providers
    const aiderEnvVarsChanged = oldSettings.aider.environmentVariables !== newSettings.aider.environmentVariables;
    const llmProvidersChanged = JSON.stringify(oldSettings.llmProviders) !== JSON.stringify(newSettings.llmProviders);

    if (aiderEnvVarsChanged || llmProvidersChanged) {
      const updatedEnvironmentVariables = getEnvironmentVariablesForAider(newSettings, this.baseDir);
      this.sendUpdateEnvVars(updatedEnvironmentVariables);
    }
  }

  private sendUpdateEnvVars(environmentVariables: Record<string, unknown>) {
    logger.info('Environment variables or LLM providers changed, updating connectors.');
    this.findMessageConnectors('update-env-vars').forEach((connector) => connector.sendUpdateEnvVarsMessage(environmentVariables));
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

  public async readTodoFile(): Promise<{
    initialUserPrompt: string;
    items: TodoItem[];
  } | null> {
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
    await this.writeTodoFile({
      initialUserPrompt: data?.initialUserPrompt || '',
      items: updatedItems,
    });
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
    await this.writeTodoFile({
      initialUserPrompt: data.initialUserPrompt,
      items: updatedItems,
    });
    return updatedItems;
  }

  public async clearAllTodos(): Promise<TodoItem[]> {
    const data = await this.readTodoFile();
    if (!data) {
      throw new Error('No todo items found to clear');
    }

    await this.writeTodoFile({
      initialUserPrompt: data.initialUserPrompt,
      items: [],
    });
    return [];
  }

  async initProjectAgentsFile(): Promise<void> {
    logger.info('Initializing AGENTS.md file', {
      baseDir: this.baseDir,
    });

    this.addLogMessage('loading', 'Analyzing project to create AGENTS.md...');

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

      const initProjectRulesAgentProfile: AgentProfile = {
        ...INIT_PROJECT_AGENTS_PROFILE,
        provider: activeProfile.provider,
        model: activeProfile.model,
      };

      // Run the agent with the modified profile
      await this.runPromptInAgent(initProjectRulesAgentProfile, getInitProjectPrompt());

      // Check if the AGENTS.md file was created
      const projectAgentsPath = path.join(this.baseDir, 'AGENTS.md');
      const projectAgentsFileExists = await fileExists(projectAgentsPath);

      if (projectAgentsFileExists) {
        logger.info('AGENTS.md file created successfully', {
          path: projectAgentsPath,
        });
        this.addLogMessage('info', 'AGENTS.md has been successfully initialized.');

        // Ask the user if they want to add this file to .aider.conf.yml
        const [answer] = await this.askQuestion({
          baseDir: this.baseDir,
          text: 'Do you want to add AGENTS.md as read-only file for Aider (in .aider.conf.yml)?',
          defaultAnswer: 'y',
          internal: false,
        });

        if (answer === 'y') {
          await this.addProjectAgentsToAiderConfig();
        }
      } else {
        logger.warn('AGENTS.md file was not created');
        this.addLogMessage('warning', 'AGENTS.md file was not created.');
      }
    } catch (error) {
      logger.error('Error initializing AGENTS.md file:', error);
      this.addLogMessage('error', `Failed to initialize AGENTS.md file: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      this.sessionManager.setContextFiles(files, false);
      this.sessionManager.setContextMessages(messages, false);
    }
  }

  private async addProjectAgentsToAiderConfig(): Promise<void> {
    const aiderConfigPath = path.join(this.baseDir, '.aider.conf.yml');
    const projectAgentsRelativePath = 'AGENTS.md';

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
      if (!config.read.includes(projectAgentsRelativePath)) {
        config.read.push(projectAgentsRelativePath);

        // Write the updated config
        const yamlContent = YAML.stringify(config);
        await fs.writeFile(aiderConfigPath, yamlContent, 'utf8');

        logger.info('Added AGENTS.md to .aider.conf.yml', {
          path: aiderConfigPath,
        });
        this.addLogMessage('info', `Added ${projectAgentsRelativePath} to .aider.conf.yml`);
      } else {
        logger.info('AGENTS.md already exists in .aider.conf.yml');
      }
    } catch (error) {
      logger.error('Error updating .aider.conf.yml:', error);
      this.addLogMessage('error', `Failed to update .aider.conf.yml: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  public getCustomCommands() {
    return this.customCommandManager.getAllCommands();
  }

  public sendCustomCommandsUpdated(commands: CustomCommand[]) {
    this.eventManager.sendCustomCommandsUpdated(this.baseDir, commands);
  }

  public async runCustomCommand(commandName: string, args: string[], mode: Mode = 'agent'): Promise<void> {
    const command = this.customCommandManager.getCommand(commandName);
    if (!command) {
      this.addLogMessage('error', `Custom command '${commandName}' not found.`);
      this.eventManager.sendCustomCommandError(this.baseDir, `Invalid command: ${commandName}`);
      return;
    }

    logger.info('Running custom command:', { commandName, args, mode });
    this.telemetryManager.captureCustomCommand(commandName, args.length, mode);

    if (args.length < command.arguments.filter((arg) => arg.required !== false).length) {
      this.addLogMessage(
        'error',
        `Not enough arguments for command '${commandName}'. Expected arguments:\n${command.arguments.map((arg, idx) => `${idx + 1}: ${arg.description}${arg.required === false ? ' (optional)' : ''}`).join('\n')}`,
      );
      this.eventManager.sendCustomCommandError(this.baseDir, `Argument mismatch for command: ${commandName}`);
      return;
    }

    this.addLogMessage('loading', 'Executing custom command...');

    let prompt: string;
    try {
      prompt = await this.customCommandManager.processCommandTemplate(command, args);
    } catch (error) {
      // Handle shell command execution errors
      if (error instanceof ShellCommandError) {
        this.addLogMessage(
          'error',
          `Shell command failed: ${error.command}
${error.stderr}`,
          true,
        );
        return;
      }
      // Re-throw other errors
      throw error;
    }

    await this.addToInputHistory(`/${commandName}${args.length > 0 ? ' ' + args.join(' ') : ''}`);

    this.addUserMessage(prompt, mode);
    this.addLogMessage('loading');

    try {
      if (mode === 'agent') {
        // Agent mode logic
        let profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.baseDir));
        if (!profile) {
          this.addLogMessage('error', 'No active Agent profile found');
          return;
        }

        // Override profile's autoApprove if command specifies it
        if (command.autoApprove === true) {
          profile = { ...profile, autoApprove: true };
        }

        const systemPrompt = await getSystemPrompt(this.baseDir, profile);

        const messages = command.includeContext === false ? [] : undefined;
        const contextFiles = command.includeContext === false ? [] : undefined;
        await this.runPromptInAgent(profile, prompt, undefined, messages, contextFiles, systemPrompt);
      } else {
        // All other modes (code, ask, architect)
        const promptContext: PromptContext = {
          id: uuidv4(),
        };
        await this.runPromptInAider(prompt, promptContext, mode);
      }
    } finally {
      // Clear loading message after execution completes (success or failure)
      this.addLogMessage('loading', '', true);
    }
  }
}

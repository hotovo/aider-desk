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
  EditFormat,
  FileEdit,
  LogData,
  LogLevel,
  MessageRole,
  Mode,
  ModelsData,
  PromptContext,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskContextData,
  TaskData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageReportData,
  UserMessageData,
} from '@common/types';
import { extractTextContent, fileExists, getActiveAgentProfile, parseUsageReport } from '@common/utils';
import { COMPACT_CONVERSATION_AGENT_PROFILE, INIT_PROJECT_AGENTS_PROFILE } from '@common/agent';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';

import type { SimpleGit } from 'simple-git';

import { getAllFiles } from '@/utils/file-system';
import { getCompactConversationPrompt, getInitProjectPrompt, getSystemPrompt } from '@/agent/prompts';
import { AIDER_DESK_TASKS_DIR, AIDER_DESK_TODOS_FILE } from '@/constants';
import { Agent, McpManager } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { MessageAction, ResponseMessage } from '@/messages';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { CustomCommandManager, ShellCommandError } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { getEnvironmentVariablesForAider } from '@/utils';
import { ContextManager } from '@/task/context-manager';
import { Project } from '@/project';
import { AiderManager } from '@/task/aider-manager';

export class Task {
  private initialized = false;
  private connectors: Connector[] = [];
  private currentQuestion: QuestionData | null = null;
  private currentQuestionResolves: ((answer: [string, string | undefined]) => void)[] = [];
  private storedQuestionAnswers: Map<string, 'y' | 'n'> = new Map();
  private currentResponseMessageId: string | null = null;
  private currentPromptContext: PromptContext | null = null;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];

  private readonly taskDataPath: string;
  private readonly contextManager: ContextManager;
  private readonly agent: Agent;
  private readonly aiderManager: AiderManager;

  readonly task: TaskData;
  readonly git: SimpleGit;

  constructor(
    public readonly project: Project,
    public readonly taskId: string,
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly customCommandManager: CustomCommandManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
  ) {
    this.task = {
      id: taskId,
      baseDir: project.baseDir,
      name: '',
      aiderTotalCost: 0,
      agentTotalCost: 0,
    };
    this.taskDataPath = path.join(this.project.baseDir, AIDER_DESK_TASKS_DIR, this.taskId, 'settings.json');
    this.contextManager = new ContextManager(this, this.taskId);
    this.agent = new Agent(this.store, this.mcpManager, this.modelManager, this.telemetryManager);
    this.git = simpleGit(this.project.baseDir);
    this.aiderManager = new AiderManager(this, this.store, this.modelManager, this.eventManager, () => this.connectors);

    void this.loadTaskData();
  }

  private async loadTaskData() {
    logger.debug('Loading task data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    if (await fileExists(this.taskDataPath)) {
      const content = await fs.readFile(this.taskDataPath, 'utf8');
      const data = JSON.parse(content) as TaskData;

      logger.info('Loaded task data', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        data,
      });

      for (const key of Object.keys(data)) {
        this.task[key] = data[key];
      }
    }
  }

  public async saveTask(updates?: Partial<TaskData>) {
    logger.debug('Saving task data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      updates,
    });
    if (updates) {
      logger.debug('Saving task data updates', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        updates,
      });
      for (const key of Object.keys(updates)) {
        this.task[key] = updates[key];
      }
    }
    if (!this.task.createdAt) {
      this.task.createdAt = new Date().toISOString();
    }
    this.task.updatedAt = new Date().toISOString();

    await fs.mkdir(path.dirname(this.taskDataPath), { recursive: true });
    await fs.writeFile(this.taskDataPath, JSON.stringify(this.task, null, 2), 'utf8');

    this.eventManager.sendTaskUpdated(this.task);

    logger.info('Saved task data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    return this.task;
  }

  public async init() {
    if (this.initialized) {
      logger.debug('Task already initialized, skipping', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
      });
      this.aiderManager.sendUpdateAiderModels();
      return;
    }

    await this.loadContext();
    await Promise.all([this.aiderManager.start(), this.updateContextInfo()]);

    this.eventManager.sendTaskInitialized(this.task);

    this.initialized = true;
  }

  public async load(): Promise<TaskContextData> {
    logger.info('Loading task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.init();

    return {
      messages: this.contextManager.getContextMessagesData(),
      files: this.contextManager.getContextFiles(),
      todoItems: await this.getTodos(),
    };
  }

  private async loadContext() {
    logger.info('Loading context for task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.contextManager.load();
    this.sendContextFilesUpdated();
  }

  public addConnector(connector: Connector) {
    if (connector.taskId !== this.taskId) {
      logger.debug('Connector task id does not match', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        connectorTaskId: connector.taskId,
      });
      return;
    }

    logger.info('Adding connector for task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      source: connector.source,
    });

    // Handle connector addition in AiderManager
    this.aiderManager.handleConnectorAdded(connector);

    this.connectors.push(connector);
    if (connector.listenTo.includes('add-file')) {
      const contextFiles = this.contextManager.getContextFiles();
      for (let index = 0; index < contextFiles.length; index++) {
        const contextFile = contextFiles[index];
        connector.sendAddFileMessage(contextFile, index !== contextFiles.length - 1);
      }
    }
    if (connector.listenTo.includes('add-message')) {
      this.contextManager.toConnectorMessages().forEach((message) => {
        connector.sendAddMessageMessage(message.role, message.content, false);
      });
    }
    if (connector.listenTo.includes('update-env-vars')) {
      const environmentVariables = getEnvironmentVariablesForAider(this.store.getSettings(), this.project.baseDir);
      this.sendUpdateEnvVars(environmentVariables);
    }
    if (connector.listenTo.includes('request-context-info')) {
      connector.sendRequestTokensInfoMessage(this.contextManager.toConnectorMessages(), this.getContextFiles());
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

  public async close(clearContext = false) {
    logger.info('Closing task...', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    if (clearContext) {
      this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, true);
    }
    this.interruptResponse();

    await this.aiderManager.kill();
    await this.cleanUpEmptyTask();
    this.initialized = false;
  }

  private async cleanUpEmptyTask() {
    if (!(await fileExists(this.taskDataPath))) {
      logger.info('Removing empty task folder', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
      });
      try {
        const taskDir = path.dirname(this.taskDataPath);

        if (!(await fileExists(taskDir))) {
          return;
        }
        await fs.rm(taskDir, { recursive: true });
      } catch (error) {
        logger.error('Failed to remove empty task folder', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          error: error instanceof Error ? error.message : String(error),
        });
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
      baseDir: this.project.baseDir,
      prompt,
      mode,
    });

    await this.project.addToInputHistory(prompt);

    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    this.addUserMessage(promptContext.id, prompt);
    this.addLogMessage('loading');

    this.telemetryManager.captureRunPrompt(mode);
    // Generate promptContext for this run

    if (mode === 'agent') {
      const profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.project.baseDir));
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
    await this.aiderManager.waitForStart();

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      startedAt: new Date().toISOString(),
    });

    const responses = await this.sendPrompt(prompt, promptContext, mode);
    logger.debug('Responses:', { responses });

    // add messages to session
    this.contextManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });

    for (const response of responses) {
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
        this.contextManager.addContextMessage(assistantMessage);
      }
    }

    this.sendRequestContextInfo();
    this.notifyIfEnabled('Prompt finished', 'Your Aider task has finished.');

    await this.saveTask({
      completedAt: new Date().toISOString(),
    });

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
    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      startedAt: new Date().toISOString(),
    });

    const agentMessages = await this.agent.runAgent(this, profile, prompt, promptContext, contextMessages, contextFiles, systemPrompt);
    if (agentMessages.length > 0) {
      agentMessages.forEach((message) => this.contextManager.addContextMessage(message));

      // send messages to connectors
      this.contextManager.toConnectorMessages(agentMessages).forEach((message) => {
        this.sendAddMessage(message.role, message.content, false);
      });
    }

    this.notifyIfEnabled('Prompt finished', 'Your Agent task has finished.');
    this.sendRequestContextInfo();

    await this.saveTask({
      completedAt: new Date().toISOString(),
    });

    return [];
  }

  private getTaskNameFromPrompt(prompt: string) {
    return prompt.trim().split(' ').slice(0, 5).join(' ');
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

    const connectorMessages = messages || this.contextManager.toConnectorMessages();
    const contextFiles = files || this.contextManager.getContextFiles();
    const architectModel = this.aiderManager.getArchitectModel();
    const architectModelMapping = architectModel ? this.modelManager.getAiderModelMapping(architectModel) : null;

    this.findMessageConnectors('prompt').forEach((connector) => {
      connector.sendPromptMessage(prompt, promptContext, mode, architectModelMapping?.modelName, connectorMessages, contextFiles);
    });

    // Wait for prompt to finish and return collected responses
    return new Promise((resolve) => {
      this.runPromptResolves.push(resolve);
    });
  }

  public promptFinished(promptId?: string) {
    if (promptId && promptId !== this.currentPromptContext?.id) {
      logger.debug('Received prompt finished for different prompt id', {
        baseDir: this.project.baseDir,
        expectedPromptId: this.currentPromptContext?.id,
        receivedPromptId: promptId,
      });
      return;
    }

    if (this.currentResponseMessageId) {
      this.eventManager.sendResponseCompleted({
        type: 'response-completed',
        messageId: this.currentResponseMessageId,
        baseDir: this.project.baseDir,
        taskId: this.taskId,
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
      logger.debug(`Sending response chunk to ${this.project.baseDir}`);
      const data: ResponseChunkData = {
        messageId: message.id,
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        chunk: message.content,
        reflectedMessage: message.reflectedMessage,
        promptContext: message.promptContext,
      };
      this.eventManager.sendResponseChunk(data);
    } else {
      logger.info(`Sending response completed to ${this.project.baseDir}`);
      logger.debug(`Message data: ${JSON.stringify(message)}`);

      const usageReport = message.usageReport
        ? typeof message.usageReport === 'string'
          ? parseUsageReport(this.aiderManager.getAiderModelsData()?.mainModel || 'unknown', message.usageReport)
          : message.usageReport
        : undefined;

      if (usageReport && saveToDb) {
        this.dataManager.saveMessage(message.id, 'assistant', this.project.baseDir, usageReport.model, usageReport, message.content);
      }

      if (usageReport) {
        logger.debug(`Usage report: ${JSON.stringify(usageReport)}`);
        this.updateTotalCosts(usageReport);
      }
      const data: ResponseCompletedData = {
        type: 'response-completed',
        messageId: message.id,
        content: message.content,
        reflectedMessage: message.reflectedMessage,
        baseDir: this.project.baseDir,
        taskId: this.taskId,
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
      baseDir: this.project.baseDir,
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
        baseDir: this.project.baseDir,
        questionKey: this.getQuestionKey(this.currentQuestion),
        rawInput: answer,
        determinedAndStoredAnswer: determinedAnswer,
      });
      this.storedQuestionAnswers.set(this.getQuestionKey(this.currentQuestion), determinedAnswer as 'y' | 'n');
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
    logger.debug('Adding file or folder:', {
      path: normalizedPath,
      readOnly: contextFile.readOnly,
    });
    const fileToAdd = { ...contextFile, path: normalizedPath };
    const addedFiles = await this.contextManager.addContextFile(fileToAdd);
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
    const droppedFiles = this.contextManager.dropContextFile(normalizedPath);

    // Send drop file message for each dropped file
    for (const droppedFile of droppedFiles) {
      this.sendDropFile(droppedFile.path, droppedFile.readOnly);
    }

    this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
  }

  public sendDropFile(filePath: string, readOnly?: boolean, noUpdate?: boolean): void {
    const absolutePath = path.resolve(this.project.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.project.baseDir));
    const pathToSend =
      readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.project.baseDir) ? filePath : path.join(this.project.baseDir, filePath);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend, noUpdate));
  }

  private sendContextFilesUpdated() {
    this.eventManager.sendContextFilesUpdated(this.project.baseDir, this.taskId, this.contextManager.getContextFiles());
  }

  public async runCommand(command: string, addToHistory = true) {
    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    let sendToConnectors = true;

    logger.info('Running command:', { command, addToHistory });

    if (addToHistory) {
      void this.project.addToInputHistory(`/${command}`);
    }

    if (command.trim() === 'reset') {
      this.contextManager.clearMessages();
      this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, false);
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
        connector.sendRunCommandMessage(command, this.contextManager.toConnectorMessages(), this.contextManager.getContextFiles()),
      );
    }
  }

  public updateContextFiles(contextFiles: ContextFile[]) {
    this.contextManager.setContextFiles(contextFiles, false);
    this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
  }

  public async askQuestion(questionData: QuestionData, awaitAnswer = true): Promise<[string, string | undefined]> {
    if (this.currentQuestion) {
      // Wait if another question is already pending
      await new Promise((resolve) => {
        this.currentQuestionResolves.push(resolve);
      });
    }

    const storedAnswer = this.storedQuestionAnswers.get(this.getQuestionKey(questionData));

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
      baseDir: this.project.baseDir,
      question: questionData,
      answer: storedAnswer,
    });

    // At this point, this.currentQuestion should be null due to the loop above,
    // or it was null initially.
    this.currentQuestion = questionData;

    if (storedAnswer) {
      logger.info('Found stored answer for question:', {
        baseDir: this.project.baseDir,
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

  public updateAiderModels(modelsData: ModelsData) {
    this.aiderManager.updateAiderModels(modelsData);
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff') {
    this.aiderManager.updateModels(mainModel, weakModel, editFormat);
  }

  public setArchitectModel(architectModel: string) {
    this.aiderManager.setArchitectModel(architectModel);
  }

  public async getAddableFiles(searchRegex?: string): Promise<string[]> {
    const contextFilePaths = new Set(this.getContextFiles().map((file) => file.path));
    let files = (await getAllFiles(this.project.baseDir)).filter((file) => !contextFilePaths.has(file));

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
    return this.contextManager.getContextFiles();
  }

  public getRepoMap(): string {
    return this.aiderManager.getRepoMap();
  }

  public setRepoMap(repoMap: string): void {
    this.aiderManager.setRepoMap(repoMap);
  }

  public updateRepoMapFromConnector(repoMap: string): void {
    this.aiderManager.updateRepoMapFromConnector(repoMap);
  }

  public openCommandOutput(command: string) {
    this.aiderManager.openCommandOutput(command);
  }

  public closeCommandOutput(addToContext = true) {
    this.aiderManager.closeCommandOutput(addToContext);
  }

  public addLogMessage(level: LogLevel, message?: string, finished = false, promptContext?: PromptContext) {
    const data: LogData = {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      level,
      message,
      finished,
      promptContext,
    };

    this.eventManager.sendLog(data);
  }

  public getContextMessages() {
    return this.contextManager.getContextMessages();
  }

  public async addContextMessage(role: MessageRole, content: string, usageReport?: UsageReportData) {
    logger.debug('Adding context message to session:', {
      baseDir: this.project.baseDir,
      role,
      content: content.substring(0, 30),
    });

    this.contextManager.addContextMessage(role, content, usageReport);
    await this.updateContextInfo();
  }

  public sendAddMessage(role: MessageRole = MessageRole.User, content: string, acknowledge = true) {
    logger.debug('Adding message:', {
      baseDir: this.project.baseDir,
      role,
      content,
      acknowledge,
    });
    this.findMessageConnectors('add-message').forEach((connector) => connector.sendAddMessageMessage(role, content, acknowledge));
  }

  public sendUserMessage(data: UserMessageData) {
    logger.debug('Sending user message:', {
      baseDir: this.project.baseDir,
      content: data.content.substring(0, 100),
    });
    this.eventManager.sendUserMessage(data);
  }

  public sendToolMessage(data: ToolData) {
    logger.debug('Sending tool message:', {
      id: data.id,
      baseDir: this.project.baseDir,
      serverName: data.serverName,
      name: data.toolName,
      args: data.args,
      response: typeof data.response === 'string' ? data.response.substring(0, 100) : data.response,
      usageReport: data.usageReport,
      promptContext: data.promptContext,
    });

    if (data.response && data.usageReport) {
      this.dataManager.saveMessage(data.id, 'tool', this.project.baseDir, data.usageReport.model, data.usageReport, {
        toolName: data.toolName,
        args: data.args,
        response: data.response,
      });
    }

    // Update total costs when adding the tool message
    if (data.usageReport) {
      this.updateTotalCosts(data.usageReport);
    }

    this.eventManager.sendTool(data);
  }

  public async clearContext(addToHistory = false, updateContextInfo = true) {
    logger.info('Clearing context:', {
      baseDir: this.project.baseDir,
      addToHistory,
      updateContextInfo,
    });

    this.contextManager.clearMessages();
    await this.runCommand('clear', addToHistory);
    this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, false);

    if (updateContextInfo) {
      await this.updateContextInfo();
    }
  }

  public interruptResponse() {
    logger.debug('Interrupting response:', { baseDir: this.project.baseDir });

    if (this.currentQuestion) {
      this.answerQuestion('n', 'Cancelled');
    }

    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
    this.promptFinished();
  }

  public applyEdits(edits: FileEdit[]) {
    logger.info('Applying edits:', { baseDir: this.project.baseDir, edits });
    this.findMessageConnectors('apply-edits').forEach((connector) => connector.sendApplyEditsMessage(edits));
  }

  public addToolMessage(
    id: string,
    serverName: string,
    toolName: string,
    args?: unknown,
    response?: string,
    usageReport?: UsageReportData,
    promptContext?: PromptContext,
    saveToDb = true,
  ) {
    logger.debug('Sending tool message:', {
      id,
      baseDir: this.project.baseDir,
      serverName,
      name: toolName,
      args,
      response: typeof response === 'string' ? response.substring(0, 100) : response,
      usageReport,
      promptContext,
    });
    const data: ToolData = {
      type: 'tool',
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      id,
      serverName,
      toolName,
      args,
      response,
      usageReport,
      promptContext,
    };

    if (response && usageReport && saveToDb) {
      this.dataManager.saveMessage(id, 'tool', this.project.baseDir, usageReport.model, usageReport, {
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
      this.task.agentTotalCost = usageReport.agentTotalCost;

      this.updateTokensInfo({
        agent: {
          cost: usageReport.agentTotalCost,
          tokens: usageReport.sentTokens + usageReport.receivedTokens + (usageReport.cacheReadTokens ?? 0) + (usageReport.cacheWriteTokens ?? 0),
        },
      });
    }
    if (usageReport.aiderTotalCost) {
      this.task.aiderTotalCost = usageReport.aiderTotalCost;
    }
  }

  private addUserMessage(id: string, content: string, promptContext?: PromptContext) {
    logger.info('Adding user message:', {
      baseDir: this.project.baseDir,
      content: content.substring(0, 100),
    });

    const data: UserMessageData = {
      type: 'user',
      id,
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      content,
      promptContext,
    };

    this.eventManager.sendUserMessage(data);
  }

  public async removeLastMessage() {
    this.contextManager.removeLastMessage();
    await this.reloadConnectorMessages();

    await this.updateContextInfo();
  }

  public async redoLastUserPrompt(mode: Mode, updatedPrompt?: string) {
    logger.info('Redoing last user prompt:', {
      baseDir: this.project.baseDir,
      mode,
      hasUpdatedPrompt: !!updatedPrompt,
    });
    const originalLastUserMessageContent = this.contextManager.removeLastUserMessage();

    const promptToRun = updatedPrompt ?? originalLastUserMessageContent;

    if (promptToRun) {
      logger.info('Found message content to run, reloading and re-running prompt.');
      await this.reloadConnectorMessages(); // This sends 'clear-task' which truncates UI messages
      await this.updateContextInfo();

      // No need to await runPrompt here, let it run in the background
      void this.runPrompt(promptToRun, mode);
    } else {
      logger.warn('Could not find a previous user message to redo or an updated prompt to run.');
    }
  }

  private async reloadConnectorMessages() {
    await this.runCommand('clear', false);
    this.contextManager.toConnectorMessages().forEach((message) => {
      this.sendAddMessage(message.role, message.content, false);
    });
  }

  public async compactConversation(
    mode: Mode,
    customInstructions?: string,
    profile: AgentProfile | null = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.project.baseDir)),
    contextMessages: ContextMessage[] = this.contextManager.getContextMessages(),
    promptContext?: PromptContext,
    abortSignal?: AbortSignal,
    logMessage = 'Compacting conversation...',
  ) {
    const userMessage = contextMessages[0];

    if (!userMessage) {
      this.addLogMessage('warning', 'No conversation to compact.');
      return;
    }

    this.addLogMessage('loading', logMessage);

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
      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      const compactConversationAgentProfile: AgentProfile = {
        ...COMPACT_CONVERSATION_AGENT_PROFILE,
        provider: profile.provider,
        model: profile.model,
      };
      const agentMessages = await this.agent.runAgent(
        this,
        compactConversationAgentProfile,
        getCompactConversationPrompt(customInstructions),
        promptContext,
        contextMessages,
        [],
        undefined,
        abortSignal,
      );

      if (agentMessages.length > 0) {
        // Clear existing context and add the summary
        const summaryMessage = agentMessages[agentMessages.length - 1];
        summaryMessage.content = extractSummary(extractTextContent(summaryMessage.content));

        this.contextManager.setContextMessages([userMessage, summaryMessage]);

        await this.contextManager.loadMessages(this.contextManager.getContextMessages());
      }
    } else {
      const responses = await this.sendPrompt(getCompactConversationPrompt(customInstructions), undefined, 'ask', undefined, []);

      // add messages to session
      this.contextManager.setContextMessages([userMessage], false);
      for (const response of responses) {
        if (response.content) {
          this.contextManager.addContextMessage(MessageRole.Assistant, extractSummary(response.content));
        }
      }
      await this.contextManager.loadMessages(this.contextManager.getContextMessages());
    }

    await this.updateContextInfo();
    this.addLogMessage('info', 'Conversation compacted.');
  }

  public async generateContextMarkdown(): Promise<string | null> {
    logger.info('Exporting context to Markdown:', {
      baseDir: this.project.baseDir,
    });
    return await this.contextManager.generateContextMarkdown();
  }

  updateTokensInfo(data: Partial<TokensInfoData>) {
    this.aiderManager.updateTokensInfo(data);
  }

  async updateContextInfo(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    this.sendRequestContextInfo();
    await this.updateAgentEstimatedTokens(checkContextFilesIncluded, checkRepoMapIncluded);
  }

  private sendRequestContextInfo() {
    this.findMessageConnectors('request-context-info').forEach((connector) =>
      connector.sendRequestTokensInfoMessage(this.contextManager.toConnectorMessages(), this.getContextFiles()),
    );
  }

  async updateAgentEstimatedTokens(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    logger.debug('Updating agent estimated tokens', {
      baseDir: this.project.baseDir,
      checkContextFilesIncluded,
      checkRepoMapIncluded,
    });
    const agentProfile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.project.baseDir));
    if (!agentProfile || (checkContextFilesIncluded && !agentProfile.includeContextFiles && checkRepoMapIncluded && !agentProfile.includeRepoMap)) {
      return;
    }

    void this.debouncedEstimateTokens(agentProfile);
  }

  private debouncedEstimateTokens = debounce(async (agentProfile: AgentProfile) => {
    const tokens = await this.agent.estimateTokens(this, agentProfile);

    this.updateTokensInfo({
      agent: {
        cost: this.task.agentTotalCost,
        tokens,
        tokensEstimated: true,
      },
    });
  }, 500);

  settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    const projectSettings = this.store.getProjectSettings(this.project.baseDir);
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
      const updatedEnvironmentVariables = getEnvironmentVariablesForAider(newSettings, this.project.baseDir);
      this.sendUpdateEnvVars(updatedEnvironmentVariables);
    }
  }

  private sendUpdateEnvVars(environmentVariables: Record<string, unknown>) {
    this.aiderManager.sendUpdateEnvVars(environmentVariables);
  }

  private getTodoFilePath(): string {
    return path.join(this.project.baseDir, AIDER_DESK_TASKS_DIR, this.taskId, AIDER_DESK_TODOS_FILE);
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
      baseDir: this.project.baseDir,
    });

    this.addLogMessage('loading', 'Analyzing project to create AGENTS.md...');

    const messages = this.contextManager.getContextMessages();
    const files = this.contextManager.getContextFiles();
    // clear context before execution
    this.contextManager.clearMessages(false);
    this.contextManager.setContextFiles([], false);

    try {
      // Get the active agent profile
      const activeProfile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.project.baseDir));
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
      const projectAgentsPath = path.join(this.project.baseDir, 'AGENTS.md');
      const projectAgentsFileExists = await fileExists(projectAgentsPath);

      if (projectAgentsFileExists) {
        logger.info('AGENTS.md file created successfully', {
          path: projectAgentsPath,
        });
        this.addLogMessage('info', 'AGENTS.md has been successfully initialized.');

        // Ask the user if they want to add this file to .aider.conf.yml
        const [answer] = await this.askQuestion({
          baseDir: this.project.baseDir,
          taskId: this.taskId,
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
      this.contextManager.setContextFiles(files, false);
      this.contextManager.setContextMessages(messages, false);
    }
  }

  private async addProjectAgentsToAiderConfig(): Promise<void> {
    const aiderConfigPath = path.join(this.project.baseDir, '.aider.conf.yml');
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

  public async runCustomCommand(commandName: string, args: string[], mode: Mode = 'agent'): Promise<void> {
    const command = this.customCommandManager.getCommand(commandName);
    if (!command) {
      this.addLogMessage('error', `Custom command '${commandName}' not found.`);
      this.eventManager.sendCustomCommandError(this.project.baseDir, this.taskId, `Invalid command: ${commandName}`);
      return;
    }

    logger.info('Running custom command:', { commandName, args, mode });
    this.telemetryManager.captureCustomCommand(commandName, args.length, mode);

    if (args.length < command.arguments.filter((arg) => arg.required !== false).length) {
      this.addLogMessage(
        'error',
        `Not enough arguments for command '${commandName}'. Expected arguments:\n${command.arguments
          .map((arg, idx) => `${idx + 1}: ${arg.description}${arg.required === false ? ' (optional)' : ''}`)
          .join('\n')}`,
      );
      this.eventManager.sendCustomCommandError(this.project.baseDir, this.taskId, `Argument mismatch for command: ${commandName}`);
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

    await this.project.addToInputHistory(`/${commandName}${args.length > 0 ? ' ' + args.join(' ') : ''}`);

    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    this.addUserMessage(promptContext.id, prompt);
    this.addLogMessage('loading');

    try {
      if (mode === 'agent') {
        // Agent mode logic
        let profile = getActiveAgentProfile(this.store.getSettings(), this.store.getProjectSettings(this.project.baseDir));
        if (!profile) {
          this.addLogMessage('error', 'No active Agent profile found');
          return;
        }

        // Override profile's autoApprove if command specifies it
        if (command.autoApprove === true) {
          profile = { ...profile, autoApprove: true };
        }

        const systemPrompt = await getSystemPrompt(this.project.baseDir, profile);

        const messages = command.includeContext === false ? [] : undefined;
        const contextFiles = command.includeContext === false ? [] : undefined;
        await this.runPromptInAgent(profile, prompt, promptContext, messages, contextFiles, systemPrompt);
      } else {
        // All other modes (code, ask, architect)
        await this.runPromptInAider(prompt, promptContext, mode);
      }
    } finally {
      // Clear loading message after execution completes (success or failure)
      this.addLogMessage('loading', '', true);
    }
  }

  async restart() {
    if (!this.initialized) {
      return;
    }

    this.interruptResponse();
    await this.close();
    await this.init();
    if (this.task.createdAt) {
      await this.saveTask({
        aiderTotalCost: 0,
        agentTotalCost: 0,
      });
    }
    await this.updateContextInfo();
  }
}

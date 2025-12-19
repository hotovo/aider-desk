import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { simpleGit } from 'simple-git';
import YAML from 'yaml';
import {
  AiderRunOptions,
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
  ProjectSettings,
  PromptContext,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskStateData,
  TaskData,
  TodoItem,
  TokensInfoData,
  ToolData,
  UsageReportData,
  UserMessageData,
  WorkingMode,
  ModelInfo,
} from '@common/types';
import { extractTextContent, fileExists, parseUsageReport } from '@common/utils';
import { COMPACT_CONVERSATION_AGENT_PROFILE, CONFLICT_RESOLUTION_PROFILE, INIT_PROJECT_AGENTS_PROFILE } from '@common/agent';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import { isEqual } from 'lodash';

import type { SimpleGit } from 'simple-git';

import { getAllFiles } from '@/utils/file-system';
import {
  getCompactConversationPrompt,
  getConflictResolutionPrompt,
  getConflictResolutionSystemPrompt,
  getGenerateCommitMessagePrompt,
  getInitProjectPrompt,
  getSystemPrompt,
} from '@/agent/prompts';
import {
  AIDER_DESK_TASKS_DIR,
  AIDER_DESK_TODOS_FILE,
  WORKTREE_BRANCH_PREFIX,
  AIDER_DESK_PROJECT_RULES_DIR,
  AIDER_DESK_GLOBAL_RULES_DIR,
  AIDER_DESK_TMP_DIR,
} from '@/constants';
import { Agent, AgentProfileManager, McpManager } from '@/agent';
import { Connector } from '@/connector';
import { DataManager } from '@/data-manager';
import logger from '@/logger';
import { MessageAction, ResponseMessage } from '@/messages';
import { Store } from '@/store';
import { ModelManager } from '@/models';
import { CustomCommandManager, ShellCommandError } from '@/custom-commands';
import { TelemetryManager } from '@/telemetry';
import { EventManager } from '@/events';
import { getEnvironmentVariablesForAider, execWithShellPath } from '@/utils';
import { ContextManager } from '@/task/context-manager';
import { Project } from '@/project';
import { AiderManager } from '@/task/aider-manager';
import { WorktreeManager, GitError } from '@/worktrees';
import { MemoryManager } from '@/memory/memory-manager';
import { getElectronApp } from '@/app';
import { HookManager } from '@/hooks/hook-manager';

export const INTERNAL_TASK_ID = 'internal';

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
  private autocompletionAllFiles: string[] | null = null;
  private agentRunResolves: (() => void)[] = [];
  private git: SimpleGit;

  private readonly taskDataPath: string;
  private readonly contextManager: ContextManager;
  private readonly agent: Agent;
  private readonly aiderManager: AiderManager;

  readonly task: TaskData;

  constructor(
    public readonly project: Project,
    public readonly taskId: string,
    private readonly store: Store,
    private readonly mcpManager: McpManager,
    private readonly customCommandManager: CustomCommandManager,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly telemetryManager: TelemetryManager,
    private readonly dataManager: DataManager,
    private readonly eventManager: EventManager,
    private readonly modelManager: ModelManager,
    private readonly worktreeManager: WorktreeManager,
    private readonly memoryManager: MemoryManager,
    public readonly hookManager: HookManager,
    initialTaskData?: Partial<TaskData>,
  ) {
    this.task = {
      name: '',
      archived: false,
      aiderTotalCost: 0,
      agentTotalCost: 0,
      mainModel: '',
      currentMode: 'code',
      contextCompactingThreshold: 0,
      weakModelLocked: false,
      ...initialTaskData,
      id: taskId,
      baseDir: project.baseDir,
    };
    this.taskDataPath = path.join(this.project.baseDir, AIDER_DESK_TASKS_DIR, this.taskId, 'settings.json');
    this.contextManager = new ContextManager(this, this.taskId);
    this.agent = new Agent(this.store, this.agentProfileManager, this.mcpManager, this.modelManager, this.telemetryManager, this.memoryManager);
    this.git = simpleGit(this.project.baseDir);
    this.aiderManager = new AiderManager(this, this.store, this.modelManager, this.eventManager, () => this.connectors);

    void this.loadTaskData();
  }

  private async getTaskAgentProfile(): Promise<AgentProfile | null> {
    // Check task-level agent profile first
    let agentProfileId = this.task.agentProfileId;

    // If no task-level profile, fall back to project-level
    if (!agentProfileId) {
      const projectSettings = this.project.getProjectSettings();
      agentProfileId = projectSettings.agentProfileId;
    }

    if (!agentProfileId) {
      return null;
    }

    let profile = this.agentProfileManager.getProfile(agentProfileId);
    if (!profile) {
      logger.warn(`Agent profile with id ${agentProfileId} not found`);
      return null;
    }

    // If profile not found, try to create a temporary one from task-level provider/model
    if (this.task.provider && this.task.model) {
      // Create a temporary profile with task-level overrides
      profile = {
        ...profile,
        provider: this.task.provider,
        model: this.task.model,
      };
    }

    return profile;
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

    // Migrate missing task-level settings from project settings
    await this.migrateFromProjectSettings();

    if (await fileExists(this.getTaskDir())) {
      this.git = simpleGit(this.getTaskDir());
    }
  }

  /**
   * @deprecated Migrate missing task-level settings from project settings
   */
  private async migrateFromProjectSettings() {
    const projectSettings = this.project.getProjectSettings();

    if (!this.task.mainModel || !this.task.currentMode) {
      this.task.currentMode = projectSettings.currentMode;
      this.task.mainModel = projectSettings.mainModel;
      this.task.weakModel = projectSettings.weakModel;
      this.task.architectModel = projectSettings.architectModel;
      this.task.reasoningEffort = projectSettings.reasoningEffort;
      this.task.thinkingTokens = projectSettings.thinkingTokens;
      this.task.contextCompactingThreshold = projectSettings.contextCompactingThreshold;
      this.task.weakModelLocked = projectSettings.weakModelLocked ?? false;

      await this.saveTask(undefined, false);
    }
  }

  /**
   * Generate a branch name from task name (first 7 words, separated by '-')
   */
  private generateBranchName(): string {
    // Split into words, filter out empty strings, and take first 7
    const words = this.task.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .slice(0, 7);

    // Join with hyphens and ensure it's a valid branch name
    const branchName = words.join('-');

    // Ensure branch name doesn't start with a dot or dash, and replace consecutive dashes
    const cleanBranchName = branchName
      .replace(/^[.-]+/, '') // Remove leading dots or dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single dash
      .replace(/-$/, ''); // Remove trailing dash

    // If result is empty, use taskId
    return `${WORKTREE_BRANCH_PREFIX}${cleanBranchName || this.taskId}`;
  }

  private isInternal() {
    return this.taskId === INTERNAL_TASK_ID;
  }

  public async saveTask(updates?: Partial<TaskData>, updateTimestamps = true): Promise<TaskData> {
    if (this.isInternal()) {
      // Internal task is not saved
      return this.task;
    }

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

    if (updateTimestamps) {
      if (!this.task.createdAt) {
        this.task.createdAt = new Date().toISOString();
      }
      this.task.updatedAt = new Date().toISOString();
    }

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
      this.eventManager.sendTaskInitialized(this.task);
      this.aiderManager.sendUpdateAiderModels();
      await this.updateAutocompletionData(undefined, true);
      return;
    }

    // Check if worktree is enabled for this task
    const workingMode = this.task.workingMode;
    const existingWorktree = await this.worktreeManager.getTaskWorktree(this.project.baseDir, this.taskId);

    if (workingMode === 'worktree') {
      if (existingWorktree) {
        this.task.worktree = existingWorktree;
      } else {
        // Create a default worktree for this task
        const branchName = this.generateBranchName();
        this.task.worktree = await this.worktreeManager.createWorktree(this.project.baseDir, this.taskId, branchName);
      }
    } else if (workingMode === 'local') {
      // Check if worktree exists and set worktreeEnabled accordingly
      if (existingWorktree) {
        await this.worktreeManager.removeWorktree(this.project.baseDir, existingWorktree);
      }
    } else {
      logger.debug('Empty workingMode, setting to local', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        workingMode,
        currentWorktree: existingWorktree,
      });
      if (existingWorktree) {
        this.task.worktree = existingWorktree;
        this.task.workingMode = 'worktree';
      } else {
        this.task.worktree = undefined;
        this.task.workingMode = 'local';
      }
    }
    this.git = simpleGit(this.getTaskDir());

    await this.loadContext();
    await Promise.all([this.aiderManager.start(), this.updateContextInfo()]);
    await this.updateAutocompletionData();

    this.eventManager.sendTaskInitialized(this.task);

    this.initialized = true;
    await this.hookManager.trigger('onTaskInitialized', { task: this.task }, this, this.project);
  }

  public async load(): Promise<TaskStateData> {
    logger.info('Loading task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.init();

    const mode = this.store.getProjectSettings(this.project.baseDir).currentMode;
    return {
      messages: this.contextManager.getContextMessagesData(),
      files: await this.getContextFiles(mode === 'agent'),
      todoItems: await this.getTodos(),
      question: this.currentQuestion,
      workingMode: this.task.workingMode || 'local',
    };
  }

  private async loadContext() {
    logger.info('Loading context for task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.contextManager.load();
    await this.sendContextFilesUpdated();
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
      connector.sendRequestTokensInfoMessage(this.contextManager.toConnectorMessages(), this.contextManager.getContextFiles());
    }
  }

  public removeConnector(connector: Connector) {
    this.connectors = this.connectors.filter((c) => c !== connector);
  }

  public getProjectDir() {
    return this.project.baseDir;
  }

  public getTaskDir() {
    return this.task.worktree ? this.task.worktree.path : this.project.baseDir;
  }

  private normalizeFilePath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);

    if (process.platform !== 'win32') {
      return normalizedPath.replace(/\\/g, '/');
    }

    return normalizedPath;
  }

  public async close(clearContext = false, cleanupEmptyTask = true) {
    logger.info('Closing task...', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    await this.hookManager.trigger('onTaskClosed', { task: this.task }, this, this.project);
    if (clearContext) {
      this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, true);
    }
    this.interruptResponse(false);
    this.resolveAgentRunPromises();

    await this.aiderManager.kill();
    if (cleanupEmptyTask) {
      await this.cleanUpEmptyTask();
    }
    this.initialized = false;
  }

  private async cleanUpEmptyTask() {
    if (this.isInternal() || !(await fileExists(this.taskDataPath))) {
      logger.info(`Removing ${this.isInternal() ? 'internal' : 'empty'} task folder`, {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
      });
      try {
        const taskDir = path.dirname(this.taskDataPath);

        if (!(await fileExists(taskDir))) {
          return;
        }
        await fs.rm(taskDir, { recursive: true, force: true });
      } catch (error) {
        logger.error('Failed to remove task folder', {
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

  private async waitForCurrentAgentToFinish() {
    if (this.agent.isRunning()) {
      logger.warn('Agent is already running, waiting for current operation to complete...', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
      });
      await new Promise<void>((resolve) => {
        this.agentRunResolves.push(resolve);
      });
      logger.info('Current agent operation completed, proceeding...');
    }
  }

  private resolveAgentRunPromises() {
    while (this.agentRunResolves.length) {
      const resolve = this.agentRunResolves.shift();
      if (resolve) {
        resolve();
      }
    }
  }

  public async runPrompt(prompt: string, mode: Mode = 'code'): Promise<ResponseCompletedData[]> {
    if (this.currentQuestion) {
      if (this.answerQuestion('n', prompt)) {
        logger.debug('Processed by the answerQuestion function.');
        return [];
      }
    }

    await this.waitForCurrentPromptToFinish();

    const hookResult = await this.hookManager.trigger('onPromptSubmitted', { prompt, mode }, this, this.project);
    if (hookResult.blocked) {
      logger.info('Prompt blocked by hook');
      return [];
    }
    prompt = hookResult.event.prompt;
    mode = hookResult.event.mode;

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
      const profile = await this.getTaskAgentProfile();
      logger.debug('AgentProfile:', profile);

      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      return this.runPromptInAgent(profile, prompt, promptContext);
    } else {
      return this.runPromptInAider(prompt, promptContext, mode);
    }
  }

  public async savePromptOnly(prompt: string): Promise<void> {
    logger.info('Saving prompt without execution:', {
      baseDir: this.project.baseDir,
      prompt,
    });

    await this.project.addToInputHistory(prompt);

    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    // Add user message to context
    this.addUserMessage(promptContext.id, prompt);

    // Add to context manager
    this.contextManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
    });
  }

  public async runPromptInAider(prompt: string, promptContext: PromptContext, mode?: Mode): Promise<ResponseCompletedData[]> {
    await this.hookManager.trigger('onPromptStarted', { prompt, mode: mode || 'code' }, this, this.project);
    const aiderHookResult = await this.hookManager.trigger('onAiderPromptStarted', { prompt, mode: mode || 'code' }, this, this.project);
    if (aiderHookResult.blocked) {
      logger.info('Aider prompt blocked by hook');
      return [];
    }
    prompt = aiderHookResult.event.prompt;
    mode = aiderHookResult.event.mode;
    await this.aiderManager.waitForStart();

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      startedAt: new Date().toISOString(),
    });

    // Persist user message to the task context before running Aider so it can be redone even if the first call fails.
    this.contextManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });

    const responses = await this.sendPromptToAider(prompt, promptContext, mode, undefined, undefined, {
      autoApprove: this.task.autoApprove,
    });
    logger.debug('Responses:', { responses });

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

    void this.sendRequestContextInfo();
    void this.sendWorktreeIntegrationStatusUpdated();
    this.notifyIfEnabled('Prompt finished', 'Your Aider task has finished.');

    await this.hookManager.trigger('onAiderPromptFinished', { responses }, this, this.project);
    await this.hookManager.trigger('onPromptFinished', { responses }, this, this.project);

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
    waitForCurrentAgentToFinish = true,
  ): Promise<ResponseCompletedData[]> {
    await this.hookManager.trigger('onPromptStarted', { prompt, mode: 'agent' }, this, this.project);
    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      startedAt: new Date().toISOString(),
    });

    if (waitForCurrentAgentToFinish) {
      await this.waitForCurrentAgentToFinish();
    }
    const agentMessages = await this.agent.runAgent(this, profile, prompt, promptContext, contextMessages, contextFiles, systemPrompt);
    this.resolveAgentRunPromises();
    if (agentMessages.length > 0) {
      agentMessages.forEach((message) => this.contextManager.addContextMessage(message));

      // send messages to connectors
      this.contextManager.toConnectorMessages(agentMessages).forEach((message) => {
        this.sendAddMessage(message.role, message.content, false);
      });
    }

    void this.sendRequestContextInfo();
    void this.sendWorktreeIntegrationStatusUpdated();
    this.notifyIfEnabled('Prompt finished', 'Your Agent has finished the task.');

    await this.hookManager.trigger('onPromptFinished', { responses: [] }, this, this.project);

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
    const hookResult = await this.hookManager.trigger('onSubagentStarted', { subagentId: profile.id, prompt }, this, this.project);
    if (hookResult.blocked) {
      logger.info('Subagent execution blocked by hook');
      return [];
    }
    prompt = hookResult.event.prompt;
    const resultMessages = await this.agent.runAgent(this, profile, prompt, promptContext, contextMessages, contextFiles, systemPrompt, abortSignal);
    await this.hookManager.trigger('onSubagentFinished', { subagentId: profile.id, resultMessages }, this, this.project);
    return resultMessages;
  }

  public sendPromptToAider(
    prompt: string,
    promptContext: PromptContext = { id: uuidv4() },
    mode?: Mode,
    messages: { role: MessageRole; content: string }[] = this.contextManager.toConnectorMessages(),
    files: ContextFile[] = this.contextManager.getContextFiles(),
    options?: AiderRunOptions,
  ): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
    this.currentResponseMessageId = null;
    this.currentPromptContext = promptContext;

    const architectModel = this.aiderManager.getArchitectModel();
    const architectModelMapping = architectModel ? this.modelManager.getAiderModelMapping(architectModel, this.getProjectDir()) : null;

    this.findMessageConnectors('prompt').forEach((connector) => {
      connector.sendPromptMessage(prompt, promptContext, mode, architectModelMapping?.modelName, messages, files, options);
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

  public async processResponseMessage(message: ResponseMessage, saveToDb = true) {
    const hookResult = await this.hookManager.trigger('onResponseMessageProcessed', { message }, this, this.project);
    if (hookResult.result) {
      message = { ...message, ...hookResult.result };
    }

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
    const app = getElectronApp();
    const settings = this.store.getSettings();
    if (!settings.notificationsEnabled || !app) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Notification } = require('electron');
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

    void this.hookManager.trigger('onQuestionAnswered', { question: this.currentQuestion, answer, userInput }, this, this.project);

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

    const questionToAnswer = this.currentQuestion;

    if (!this.currentQuestion.internal) {
      this.findMessageConnectors('answer-question').forEach((connector) => connector.sendAnswerQuestionMessage(determinedAnswer));
    }
    this.currentQuestion = null;

    // Send question-answered event
    this.eventManager.sendQuestionAnswered(this.project.baseDir, this.taskId, questionToAnswer, determinedAnswer, userInput);

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
    const hookResult = await this.hookManager.trigger('onFileAdded', { file: contextFile }, this, this.project);
    if (hookResult.blocked) {
      logger.info('File addition blocked by hook');
      return false;
    }
    contextFile = hookResult.event.file;

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

    await this.sendContextFilesUpdated();
    await this.updateContextInfo(true, true);

    return true;
  }

  public sendAddFile(contextFile: ContextFile, noUpdate?: boolean) {
    this.findMessageConnectors('add-file').forEach((connector) => connector.sendAddFileMessage(contextFile, noUpdate));
  }

  public dropFile(filePath: string) {
    void this.hookManager.trigger('onFileDropped', { filePath }, this, this.project);
    const normalizedPath = this.normalizeFilePath(filePath);
    logger.info('Dropping file or folder:', { path: normalizedPath });
    const droppedFiles = this.contextManager.dropContextFile(normalizedPath);

    // Send drop file message for each dropped file
    for (const droppedFile of droppedFiles) {
      this.sendDropFile(droppedFile.path, droppedFile.readOnly);
    }

    void this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
  }

  public sendDropFile(filePath: string, readOnly?: boolean, noUpdate?: boolean): void {
    const absolutePath = path.resolve(this.project.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.project.baseDir));
    const pathToSend =
      readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.project.baseDir) ? filePath : path.join(this.project.baseDir, filePath);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend, noUpdate));
  }

  public async addToGit(absolutePath: string, promptContext?: PromptContext): Promise<void> {
    try {
      // Add the new file to git staging
      await this.git.add(absolutePath);
      await this.updateAutocompletionData(undefined, true);
    } catch (gitError) {
      const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
      this.addLogMessage('warning', `Failed to add new file ${absolutePath} to git staging area: ${gitErrorMessage}`, false, promptContext);
      // Continue even if git add fails, as the file was created successfully
    }
  }

  private async sendContextFilesUpdated() {
    const mode = this.store.getProjectSettings(this.project.baseDir).currentMode;
    const allFiles = await this.getContextFiles(mode === 'agent');

    this.eventManager.sendContextFilesUpdated(this.project.baseDir, this.taskId, allFiles);
  }

  public async runCommand(command: string, addToHistory = true) {
    const hookResult = await this.hookManager.trigger('onCommandExecuted', { command }, this, this.project);
    if (hookResult.blocked) {
      logger.info('Command execution blocked by hook');
      return;
    }
    command = hookResult.event.command;

    if (this.currentQuestion) {
      this.answerQuestion('n');
    }

    let sendToConnectors = true;

    logger.info('Running command:', { command, addToHistory });

    if (addToHistory) {
      void this.project.addToInputHistory(`/${command}`);
    }

    if (command.trim() === 'drop' || command.trim() === 'reset') {
      this.contextManager.clearContextFiles();
      void this.sendContextFilesUpdated();
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
        if (this.task.worktree) {
          void this.sendWorktreeIntegrationStatusUpdated();
        }

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
    void this.sendContextFilesUpdated();
    void this.updateContextInfo(true, true);
  }

  public async askQuestion(questionData: QuestionData, awaitAnswer = true): Promise<[string, string | undefined]> {
    const hookResult = await this.hookManager.trigger('onQuestionAsked', { question: questionData }, this, this.project);
    if (hookResult.result && typeof hookResult.result === 'string') {
      logger.info('Question answered by hook', { question: questionData.text, answer: hookResult.result });
      return [hookResult.result, undefined];
    }

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
    if (!this.initialized) {
      return;
    }

    this.task.reasoningEffort = modelsData.reasoningEffort;
    this.task.thinkingTokens = modelsData.thinkingTokens;
    this.aiderManager.updateAiderModels(modelsData);
    void this.sendUpdateModelsInfo();
  }

  public updateModels(mainModel: string, weakModel: string | null, editFormat: EditFormat = 'diff') {
    if (!this.initialized) {
      return;
    }
    this.aiderManager.updateModels(mainModel, weakModel, editFormat);
    void this.sendUpdateModelsInfo();
  }

  public setArchitectModel(architectModel: string) {
    if (!this.initialized) {
      return;
    }
    this.aiderManager.setArchitectModel(architectModel);
    void this.sendUpdateModelsInfo();
  }

  private async sendUpdateModelsInfo(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    const aiderModelsData = this.aiderManager.getAiderModelsData();
    if (!aiderModelsData) {
      return;
    }

    const modelsInfo: Record<string, ModelInfo> = {};

    // Helper function to extract model info using getModel with fallback
    const extractModelInfo = (modelName: string | null | undefined) => {
      if (!modelName) {
        return null;
      }

      // Parse providerId and actual modelId from the modelId string
      const [providerId, ...modelIdParts] = modelName.split('/');
      const modelId = modelIdParts.join('/');

      if (!providerId || !modelId) {
        return null;
      }

      const model = this.modelManager.getModel(providerId, modelId, true);
      if (!model) {
        return null;
      }

      return {
        maxInputTokens: model.maxInputTokens,
        maxOutputTokens: model.maxOutputTokens,
        inputCostPerToken: model.inputCostPerToken,
        outputCostPerToken: model.outputCostPerToken,
        cacheWriteInputTokenCost: model.cacheWriteInputTokenCost,
        cacheReadInputTokenCost: model.cacheReadInputTokenCost,
        temperature: model.temperature,
      } satisfies ModelInfo;
    };

    // Extract info for main model
    const mainModelInfo = extractModelInfo(aiderModelsData.mainModel);
    if (mainModelInfo) {
      modelsInfo[this.modelManager.getAiderModelMapping(aiderModelsData.mainModel, this.getProjectDir()).modelName] = mainModelInfo;
    }

    // Extract info for weak model
    if (aiderModelsData.weakModel) {
      const weakModelInfo = extractModelInfo(aiderModelsData.weakModel);
      if (weakModelInfo) {
        modelsInfo[this.modelManager.getAiderModelMapping(aiderModelsData.weakModel, this.getProjectDir()).modelName] = weakModelInfo;
      }
    }

    // Extract info for architect model
    if (aiderModelsData.architectModel) {
      const architectModelInfo = extractModelInfo(aiderModelsData.architectModel);
      if (architectModelInfo) {
        modelsInfo[this.modelManager.getAiderModelMapping(aiderModelsData.architectModel, this.getProjectDir()).modelName] = architectModelInfo;
      }
    }

    logger.info('Sending update models info to connectors', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      modelsInfo: Object.keys(modelsInfo),
    });

    // Send to connectors that listen to 'update-models-info'
    this.findMessageConnectors('update-models-info').forEach((connector) => connector.sendUpdateModelsInfoMessage(modelsInfo));
    await this.sendRequestContextInfo();
  }

  public async getAddableFiles(searchRegex?: string): Promise<string[]> {
    const contextFilePaths = new Set((await this.getContextFiles()).map((file) => file.path));
    let files = (await getAllFiles(this.getTaskDir())).filter((file) => !contextFilePaths.has(file));

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

  public async getAllFiles(useGit = true): Promise<string[]> {
    return getAllFiles(this.getTaskDir(), useGit);
  }

  public async getContextFiles(includeRuleFiles = false): Promise<ContextFile[]> {
    const contextFiles = await this.contextManager.getContextFilesEnsureLoaded();

    if (!includeRuleFiles) {
      return contextFiles;
    }

    const profile = await this.getTaskAgentProfile();
    const ruleFiles = await this.getRuleFilesAsContextFiles(profile || undefined);
    return [...contextFiles, ...ruleFiles];
  }

  public async getRuleFilesAsContextFiles(profile?: AgentProfile): Promise<ContextFile[]> {
    const ruleFiles: ContextFile[] = [];
    const homeDir = homedir();

    // Get global rule files
    try {
      const globalRulesDir = AIDER_DESK_GLOBAL_RULES_DIR;
      const globalRuleFileNames = await fs.readdir(globalRulesDir);
      for (const fileName of globalRuleFileNames) {
        if (fileName.endsWith('.md')) {
          const absolutePath = path.join(globalRulesDir, fileName);
          // Convert to relative path with ~/ prefix
          const relativePath = path.join('~', path.relative(homeDir, absolutePath));
          ruleFiles.push({
            path: relativePath,
            readOnly: true,
            source: 'global-rule',
          });
        }
      }
    } catch (error) {
      // Global rules directory doesn't exist or can't be read
      logger.debug('Could not read global rules directory', { error });
    }

    // Get project rule files
    try {
      const projectRulesDir = path.join(this.project.baseDir, AIDER_DESK_PROJECT_RULES_DIR);
      const projectRuleFileNames = await fs.readdir(projectRulesDir);
      for (const fileName of projectRuleFileNames) {
        if (fileName.endsWith('.md')) {
          const relativePath = path.join(AIDER_DESK_PROJECT_RULES_DIR, fileName);
          ruleFiles.push({
            path: relativePath,
            readOnly: true,
            source: 'project-rule',
          });
        }
      }
    } catch (error) {
      // Project rules directory doesn't exist or can't be read
      logger.debug('Could not read project rules directory', { error });
    }

    // Get agent profile rule files
    if (profile && profile.ruleFiles && profile.ruleFiles.length > 0) {
      for (const ruleFilePath of profile.ruleFiles) {
        try {
          await fs.access(ruleFilePath);
          // Convert to relative path with ~/ prefix if in home directory
          let displayPath: string;
          if (ruleFilePath.startsWith(this.project.baseDir)) {
            displayPath = path.relative(this.project.baseDir, ruleFilePath);
          } else if (ruleFilePath.startsWith(homeDir)) {
            displayPath = path.join('~', path.relative(homeDir, ruleFilePath));
          } else {
            displayPath = ruleFilePath;
          }
          ruleFiles.push({
            path: displayPath,
            readOnly: true,
            source: 'agent-rule',
          });
        } catch (error) {
          // Rule file doesn't exist or can't be accessed
          logger.debug('Could not access agent rule file', { ruleFilePath, error });
        }
      }
    }

    // Include AGENTS.md from project root if it exists
    const agentsFilePath = path.join(this.project.baseDir, 'AGENTS.md');
    try {
      await fs.access(agentsFilePath);
      ruleFiles.push({
        path: 'AGENTS.md',
        readOnly: true,
        source: 'project-rule',
      });
    } catch (error) {
      // AGENTS.md doesn't exist, which is fine
      logger.debug('AGENTS.md not found in project root', { error });
    }

    return ruleFiles;
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

  public addLogMessage(level: LogLevel, message?: string, finished = false, promptContext?: PromptContext, actionIds?: string[]) {
    const data: LogData = {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      level,
      message,
      finished,
      promptContext,
      actionIds,
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

  public interruptResponse(addMessage = true) {
    logger.info('Interrupting response:', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      promptContext: this.currentPromptContext?.id,
    });

    if (this.currentQuestion) {
      this.answerQuestion('n', 'Cancelled');
    }

    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    if (addMessage) {
      this.addLogMessage('warning', 'messages.interrupted');
    }
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
    profile: AgentProfile | null = null,
    contextMessages?: ContextMessage[],
    promptContext?: PromptContext,
    abortSignal?: AbortSignal,
    waitForAgentCompletion = true,
    logMessage = 'Compacting conversation...',
  ) {
    // Get profile if not provided
    if (!profile) {
      profile = await this.getTaskAgentProfile();
    }
    if (!contextMessages) {
      contextMessages = await this.contextManager.getContextMessages();
    }

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

      if (waitForAgentCompletion) {
        await this.waitForCurrentAgentToFinish();
      }
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
      if (waitForAgentCompletion) {
        this.resolveAgentRunPromises();
      }

      if (agentMessages.length > 0) {
        // Clear existing context and add the summary
        const summaryMessage = agentMessages[agentMessages.length - 1];
        summaryMessage.content = extractSummary(extractTextContent(summaryMessage.content));

        this.contextManager.setContextMessages([userMessage, summaryMessage]);

        await this.contextManager.loadMessages(await this.contextManager.getContextMessages());
      }
    } else {
      const responses = await this.sendPromptToAider(getCompactConversationPrompt(customInstructions), undefined, 'ask', undefined, [], undefined);

      // add messages to session
      this.contextManager.setContextMessages([userMessage], false);
      for (const response of responses) {
        if (response.content) {
          this.contextManager.addContextMessage(MessageRole.Assistant, extractSummary(response.content));
        }
      }
      await this.contextManager.loadMessages(await this.contextManager.getContextMessages());
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

  private async sendRequestContextInfo() {
    const contextFiles = await this.getContextFiles();
    this.findMessageConnectors('request-context-info').forEach((connector) =>
      connector.sendRequestTokensInfoMessage(this.contextManager.toConnectorMessages(), contextFiles),
    );
  }

  public async updateAutocompletionData(words?: string[], force = false, useGit = true) {
    logger.debug('Updating autocompletion data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      words: words?.length,
    });
    if (words) {
      this.eventManager.sendUpdateAutocompletion(this.project.baseDir, this.taskId, words);
    }

    const allFiles = await getAllFiles(this.getTaskDir(), useGit);
    if (force || !this.autocompletionAllFiles || !isEqual(this.autocompletionAllFiles, allFiles)) {
      this.eventManager.sendUpdateAutocompletion(this.project.baseDir, this.taskId, words, allFiles);
    }
    this.autocompletionAllFiles = allFiles;
  }

  async updateAgentEstimatedTokens(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    logger.debug('Updating agent estimated tokens', {
      baseDir: this.project.baseDir,
      checkContextFilesIncluded,
      checkRepoMapIncluded,
    });
    const agentProfile = await this.getTaskAgentProfile();
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

  async settingsChanged(oldSettings: SettingsData, newSettings: SettingsData) {
    // For old profile, we can't easily get it from old settings since they're now file-based
    // We'll just use null for old profile comparison
    // Note: agent profile changes are now handled differently since profiles are file-based

    // Check for changes in agent config properties that affect token count
    const modelChanged = false; // oldAgentProfile is null, so no change
    const disabledServersChanged = false; // oldAgentProfile is null, so no change
    const toolApprovalsChanged = false; // oldAgentProfile is null, so no change
    const includeContextFilesChanged = false; // oldAgentProfile is null, so no change
    const includeRepoMapChanged = false; // oldAgentProfile is null, so no change
    const useAiderToolsChanged = false; // oldAgentProfile is null, so no change
    const usePowerToolsChanged = false; // oldAgentProfile is null, so no change
    const customInstructionsChanged = false; // oldAgentProfile is null, so no change

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

    if (!this.initialized) {
      return;
    }

    // Check for changes in Aider
    const aiderEnvVarsChanged = oldSettings.aider.environmentVariables !== newSettings.aider.environmentVariables;
    const aiderOptionsChanged = oldSettings.aider.options !== newSettings?.aider.options;
    const aiderAutoCommitsChanged = oldSettings.aider.autoCommits !== newSettings?.aider.autoCommits;
    const aiderWatchFilesChanged = oldSettings.aider.watchFiles !== newSettings?.aider.watchFiles;
    const aiderCachingEnabledChanged = oldSettings.aider.cachingEnabled !== newSettings?.aider.cachingEnabled;
    const aiderConfirmBeforeEditChanged = oldSettings.aider.confirmBeforeEdit !== newSettings?.aider.confirmBeforeEdit;

    if (aiderOptionsChanged || aiderAutoCommitsChanged || aiderWatchFilesChanged || aiderCachingEnabledChanged || aiderConfirmBeforeEditChanged) {
      logger.debug('Aider options changed, restarting Aider.');
      void this.aiderManager.start();
    } else if (aiderEnvVarsChanged) {
      logger.debug('Aider environment variables changed, updating connectors.');
      const updatedEnvironmentVariables = getEnvironmentVariablesForAider(newSettings, this.project.baseDir);
      this.sendUpdateEnvVars(updatedEnvironmentVariables);
    }
  }

  async modelsUpdated() {
    await this.sendUpdateModelsInfo();
  }

  async projectSettingsChanged(oldSettings: ProjectSettings, newSettings: ProjectSettings) {
    const modeChanged = oldSettings.currentMode !== newSettings.currentMode;
    const agentProfileIdChanged = oldSettings.agentProfileId !== newSettings.agentProfileId;

    if (agentProfileIdChanged || modeChanged) {
      void this.sendContextFilesUpdated();
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

    const messages = await this.contextManager.getContextMessages();
    const files = this.contextManager.getContextFiles();
    // clear context before execution
    this.contextManager.clearMessages(false);
    this.contextManager.setContextFiles([], false);

    try {
      // Get the active agent profile
      const activeProfile = await this.getTaskAgentProfile();
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
        const profile = await this.getTaskAgentProfile();
        if (!profile) {
          this.addLogMessage('error', 'No active Agent profile found');
          return;
        }

        const systemPrompt = await getSystemPrompt(this.store.getSettings(), this, profile, command.autoApprove ?? this.task.autoApprove);

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

    this.interruptResponse(false);
    await this.close(false, false);
    await this.init();
    if (this.task.createdAt) {
      await this.saveTask({
        aiderTotalCost: 0,
        agentTotalCost: 0,
      });
    }
    await this.updateContextInfo();
  }

  public async updateTask(updates: Partial<TaskData>): Promise<TaskData> {
    // Handle worktree configuration changes
    if (updates.workingMode !== undefined && updates.workingMode !== this.task.workingMode) {
      if (!(await this.applyWorkingMode(updates.workingMode))) {
        return this.task;
      }
    }

    this.task.updatedAt = new Date().toISOString();
    for (const key of Object.keys(updates)) {
      this.task[key] = updates[key];
    }

    // setting a name will also save the task
    if (!this.task.createdAt && 'name' in updates) {
      this.task.createdAt = new Date().toISOString();
    }

    if (!this.task.createdAt) {
      // if this task is new empty task update should not trigger save
      this.eventManager.sendTaskUpdated(this.task);
      return this.task;
    }

    return this.saveTask(updates);
  }

  private async sendWorktreeIntegrationStatusUpdated() {
    this.eventManager.sendWorktreeIntegrationStatusUpdated(this.project.baseDir, this.taskId, await this.getWorktreeIntegrationStatus());
  }

  private async applyWorkingMode(mode: WorkingMode) {
    logger.info('Applying workingMode configuration', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      mode,
    });

    await this.waitForCurrentPromptToFinish();

    const currentWorktree = await this.worktreeManager.getTaskWorktree(this.project.baseDir, this.taskId);
    if (mode === 'worktree') {
      if (!currentWorktree) {
        const branchName = this.generateBranchName();
        this.task.worktree = await this.worktreeManager.createWorktree(this.project.baseDir, this.taskId, branchName);
      }
      this.task.workingMode = mode;
    } else if (mode === 'local') {
      if (currentWorktree) {
        await this.worktreeManager.removeWorktree(this.project.baseDir, currentWorktree);
      }
      this.task.worktree = undefined;
      this.task.lastMergeState = undefined;
      this.task.workingMode = mode;
    }

    this.git = simpleGit(this.getTaskDir());
    await this.aiderManager.start();

    return true;
  }

  public async mergeWorktreeToMain(squash: boolean, targetBranch?: string, commitMessage?: string): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    logger.info('Merging worktree', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      squash,
    });

    await this.waitForCurrentPromptToFinish();

    try {
      const effectiveTargetBranch = targetBranch || (await this.worktreeManager.getProjectMainBranch(this.project.baseDir));

      this.addLogMessage(
        'loading',
        squash ? `Squashing and merging worktree to ${effectiveTargetBranch} branch...` : `Merging worktree to ${effectiveTargetBranch} branch...`,
      );

      // For squash merge, we need a commit message
      let effectiveCommitMessage = commitMessage;
      if (squash && !effectiveCommitMessage) {
        // Get changes information for AI generation
        const changesDiff = await this.worktreeManager.getChangesDiff(this.project.baseDir, this.task.worktree.path, targetBranch);

        if (changesDiff) {
          // Try to generate commit message using AI
          const agentProfile = await this.getTaskAgentProfile();
          if (agentProfile) {
            try {
              effectiveCommitMessage = await this.agent.generateText(
                agentProfile,
                getGenerateCommitMessagePrompt(),
                `Generate a concise conventional commit message for these changes:\n\n${changesDiff}\n\nOnly answer with the commit message, nothing else.`,
              );
              logger.info('Generated commit message:', { commitMessage: effectiveCommitMessage });
            } catch (error) {
              logger.warn('Failed to generate AI commit message, falling back to task name:', error);
              // Fallback to task name if AI generation fails
              effectiveCommitMessage = this.task.name || `Task ${this.taskId} changes`;
            }
          } else {
            logger.warn('No active agent profile found, using task name for commit message');
            effectiveCommitMessage = this.task.name || `Task ${this.taskId} changes`;
          }
        } else {
          // No commits to merge, use default message
          effectiveCommitMessage = this.task.name || `Task ${this.taskId} changes`;
        }
      }

      const mergeState = await this.worktreeManager.mergeWorktreeToMainWithUncommitted(
        this.project.baseDir,
        this.task.id,
        this.task.worktree.path,
        squash,
        effectiveCommitMessage,
        targetBranch,
      );

      // Store merge state for potential revert
      await this.saveTask({ lastMergeState: mergeState });

      this.addLogMessage(
        'info',
        squash
          ? `Successfully squashed and merged worktree to ${effectiveTargetBranch} branch`
          : `Successfully merged worktree to ${effectiveTargetBranch} branch`,
        true,
      );
    } catch (error) {
      logger.error('Failed to merge worktree:', { error });

      const isConflict =
        error instanceof GitError &&
        (error.gitOutput?.toLowerCase().includes('resolve all conflicts') ||
          error.message?.toLowerCase().includes('conflicts must be resolved first') ||
          error.gitOutput?.toLowerCase().includes('conflicts must be resolved first'));

      this.addLogMessage(
        'error',
        isConflict
          ? 'worktree.mergeConflicts'
          : error instanceof GitError
            ? error.getErrorDetails()
            : `Failed to merge worktree: ${error instanceof Error ? error.message : String(error)}`,
        true,
        undefined,
        isConflict ? ['rebase-worktree'] : undefined,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async applyUncommittedChanges(targetBranch?: string): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    logger.info('Applying uncommitted changes to main', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.waitForCurrentPromptToFinish();

    try {
      const effectiveTargetBranch = targetBranch || (await this.worktreeManager.getProjectMainBranch(this.project.baseDir));

      this.addLogMessage('loading', `Applying uncommitted changes to ${effectiveTargetBranch} branch...`);

      await this.worktreeManager.applyUncommittedChangesToMain(this.project.baseDir, this.task.id, this.task.worktree.path, effectiveTargetBranch);

      this.addLogMessage('info', `Successfully applied uncommitted changes to ${effectiveTargetBranch} branch`, true);
    } catch (error) {
      logger.error('Failed to apply uncommitted changes:', error);

      const isConflict =
        error instanceof GitError &&
        (error.gitOutput?.toLowerCase().includes('conflict') ||
          error.message?.toLowerCase().includes('conflict') ||
          error.gitOutput?.toLowerCase().includes('conflicts must be resolved first') ||
          error.message?.toLowerCase().includes('conflicts must be resolved first'));

      this.addLogMessage(
        'error',
        isConflict
          ? 'worktree.applyUncommittedConflicts'
          : error instanceof GitError
            ? error.getErrorDetails()
            : `Failed to apply uncommitted changes: ${error instanceof Error ? error.message : String(error)}`,
        true,
        undefined,
        isConflict ? ['rebase-worktree'] : undefined,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async revertLastMerge(): Promise<void> {
    if (!this.task.lastMergeState) {
      throw new Error('No merge state found to revert');
    }

    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    logger.info('Reverting last merge', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.waitForCurrentPromptToFinish();

    try {
      this.addLogMessage('loading', 'Reverting last merge...');

      await this.worktreeManager.revertMerge(this.project.baseDir, this.task.id, this.task.worktree.path, this.task.lastMergeState);

      // Clear merge state after successful revert
      await this.saveTask({ lastMergeState: undefined });

      this.addLogMessage('info', 'Successfully reverted last merge', true);
    } catch (error) {
      logger.error('Failed to revert merge:', error);
      this.addLogMessage(
        'error',
        error instanceof GitError ? error.getErrorDetails() : `Failed to revert merge: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async getWorktreeIntegrationStatus(targetBranch?: string) {
    if (!this.task.worktree) {
      return null;
    }

    const effectiveTargetBranch = targetBranch || (await this.worktreeManager.getProjectMainBranch(this.project.baseDir));
    const worktreePath = this.task.worktree.path;

    const [unmergedWork, predictedConflicts, rebaseState] = await Promise.all([
      this.worktreeManager.checkWorktreeForUnmergedWork(this.project.baseDir, worktreePath, effectiveTargetBranch),
      this.worktreeManager.checkForRebaseConflicts(worktreePath, effectiveTargetBranch),
      this.worktreeManager.getRebaseState(worktreePath),
    ]);

    return {
      targetBranch: effectiveTargetBranch,
      aheadCommits: {
        count: unmergedWork.unmergedCommitCount,
        commits: unmergedWork.unmergedCommits,
      },
      uncommittedFiles: {
        count: unmergedWork.uncommittedFiles?.length || 0,
        files: unmergedWork.uncommittedFiles || [],
      },
      predictedConflicts,
      rebaseState,
    };
  }

  public async rebaseWorktreeFromBranch(fromBranch?: string): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    const effectiveFromBranch = fromBranch || (await this.worktreeManager.getProjectMainBranch(this.project.baseDir));

    logger.info('Rebasing worktree from branch', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      fromBranch: effectiveFromBranch,
    });

    await this.waitForCurrentPromptToFinish();

    try {
      this.addLogMessage('loading', `Rebasing worktree from ${effectiveFromBranch}...`);
      await this.worktreeManager.rebaseMainIntoWorktree(this.task.worktree.path, effectiveFromBranch);
      this.addLogMessage('info', 'Worktree rebased successfully', true);
    } catch (error) {
      logger.error('Failed to rebase worktree:', error);

      const isConflict = error instanceof GitError && error.gitOutput?.includes('Resolve all conflicts');

      this.addLogMessage(
        'error',
        isConflict
          ? 'worktree.rebaseConflicts'
          : error instanceof GitError
            ? error.getErrorDetails()
            : `Failed to rebase worktree: ${error instanceof Error ? error.message : String(error)}`,
        true,
        undefined,
        isConflict ? ['abort-rebase', 'resolve-conflicts-with-agent'] : undefined,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async abortWorktreeRebase(): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    await this.waitForCurrentPromptToFinish();

    try {
      this.addLogMessage('loading', 'Aborting rebase...');
      await this.worktreeManager.abortRebase(this.task.worktree.path);
      this.addLogMessage('info', 'Rebase aborted', true);
    } catch (error) {
      logger.error('Failed to abort rebase:', error);
      this.addLogMessage(
        'error',
        error instanceof GitError ? error.getErrorDetails() : `Failed to abort rebase: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async resolveWorktreeConflictsWithAgent(): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    await this.waitForCurrentPromptToFinish();

    const worktreePath = this.task.worktree.path;
    const activeProfile = await this.getTaskAgentProfile();
    if (!activeProfile) {
      throw new Error('No active agent profile found');
    }

    try {
      this.addLogMessage('loading', 'Resolving conflicts with agent...');

      const files = await this.worktreeManager.listConflictedFiles(worktreePath);
      if (files.length === 0) {
        this.addLogMessage('info', 'No conflicted files found', true);
        return;
      }

      const conflictProfile: AgentProfile = {
        ...CONFLICT_RESOLUTION_PROFILE,
        provider: activeProfile.provider,
        model: activeProfile.model,
      };

      const resolutionPromises = files.map(async (filePath) => {
        const promptContext: PromptContext = {
          id: uuidv4(),
          group: {
            id: uuidv4(),
            color: 'var(--color-agent-conflict-resolution)',
            name: `Resolving ${filePath}...`,
            finished: false,
          },
        };

        this.addLogMessage('loading', `Resolving ${filePath}...`, false, promptContext);

        const ctx = await this.worktreeManager.collectConflictContext(worktreePath, filePath);

        // Create temp directory structure for conflict files
        const conflictsDir = path.join(this.project.baseDir, AIDER_DESK_TMP_DIR, 'conflicts');
        const conflictFileDir = path.join(conflictsDir, filePath);
        await fs.mkdir(path.dirname(conflictFileDir), { recursive: true });

        // Create version files using the relative path structure
        const basePath = `${conflictFileDir}.base`;
        const oursPath = `${conflictFileDir}.ours`;
        const theirsPath = `${conflictFileDir}.theirs`;

        // Write version files
        await Promise.all([
          ctx.base ? fs.writeFile(basePath, ctx.base, 'utf8') : Promise.resolve(),
          ctx.ours ? fs.writeFile(oursPath, ctx.ours, 'utf8') : Promise.resolve(),
          ctx.theirs ? fs.writeFile(theirsPath, ctx.theirs, 'utf8') : Promise.resolve(),
        ]);

        try {
          const prompt = getConflictResolutionPrompt(filePath, {
            ...ctx,
            basePath: ctx.base ? basePath : undefined,
            oursPath: ctx.ours ? oursPath : undefined,
            theirsPath: ctx.theirs ? theirsPath : undefined,
          });
          const systemPrompt = getConflictResolutionSystemPrompt();

          await this.agent.runAgent(this, conflictProfile, prompt, promptContext, [], [{ path: filePath }], systemPrompt);

          // Update context to "Resolved"
          if (promptContext.group) {
            promptContext.group.name = `Resolved ${filePath}`;
            promptContext.group.finished = true;
          }
          this.addLogMessage('info', `Resolved ${filePath}`, true, promptContext);

          // Stage the file
          await execWithShellPath(`git add -- "${filePath}"`, { cwd: worktreePath });
        } finally {
          // Clean up temp files
          await Promise.allSettled([fs.unlink(basePath).catch(() => {}), fs.unlink(oursPath).catch(() => {}), fs.unlink(theirsPath).catch(() => {})]);
        }
      });

      await Promise.all(resolutionPromises);

      this.addLogMessage('info', 'Conflicts resolved and staged. You can now continue the rebase.', true, undefined, ['continue-rebase', 'abort-rebase']);
    } catch (error) {
      logger.error('Failed to resolve conflicts with agent:', error);
      this.addLogMessage(
        'error',
        error instanceof GitError
          ? error.getErrorDetails()
          : `Failed to resolve conflicts with agent: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async continueWorktreeRebase(): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    await this.waitForCurrentPromptToFinish();

    try {
      this.addLogMessage('loading', 'Continuing rebase...');
      await this.worktreeManager.continueRebase(this.task.worktree.path);
      this.addLogMessage('info', 'Rebase continued', true);
    } catch (error) {
      logger.error('Failed to continue rebase:', error);

      const isConflict = error instanceof GitError && error.gitOutput?.includes('Resolve all conflicts manually');

      this.addLogMessage(
        'error',
        isConflict
          ? 'worktree.rebaseConflicts'
          : error instanceof GitError
            ? error.getErrorDetails()
            : `Failed to continue rebase: ${error instanceof Error ? error.message : String(error)}`,
        true,
        undefined,
        isConflict ? ['abort-rebase', 'resolve-conflicts-with-agent'] : undefined,
      );
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async duplicateFrom(sourceTask: Task): Promise<void> {
    // Copy basic task data
    const sourceData = sourceTask.task;
    await this.saveTask({
      name: `${sourceData.name} (Copy)`,
    });

    // Copy context files
    const contextFiles = await sourceTask.getContextFiles();
    for (const file of contextFiles) {
      await this.addFile(file);
    }

    // Copy messages
    const messages = await sourceTask.getContextMessages();
    for (const message of messages) {
      this.contextManager.addContextMessage(message);
    }

    await this.updateContextInfo();

    // Copy todos
    const todos = await sourceTask.getTodos();
    if (todos.length > 0) {
      await this.setTodos(todos, 'Duplicated from original task');
    }

    // Copy worktree if exists
    if (sourceData.worktree && sourceData.workingMode === 'worktree') {
      await this.updateTask({
        workingMode: 'worktree',
      });
    }
  }

  async agentProfileUpdated(oldProfile: AgentProfile, newProfile: AgentProfile) {
    if (!this.initialized) {
      return;
    }

    const taskAgentProfile = await this.getTaskAgentProfile();

    if (taskAgentProfile?.id === newProfile.id) {
      if (oldProfile.includeContextFiles !== newProfile.includeContextFiles || oldProfile.includeRepoMap !== newProfile.includeRepoMap) {
        void this.updateContextInfo();
      }
    }
  }

  public getProject(): Project {
    return this.project;
  }

  public isInitialized() {
    return this.initialized;
  }
}

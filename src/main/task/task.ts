import fs from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

import { simpleGit } from 'simple-git';
import {
  AiderRunOptions,
  AIDER_MODES,
  AgentProfile,
  ContextAssistantMessage,
  ContextFile,
  ContextMessage,
  ToolCallPart,
  ToolResultPart,
  DefaultTaskState,
  EditFormat,
  FileEdit,
  LogData,
  LogLevel,
  MessageRole,
  Mode,
  ModelInfo,
  ModelsData,
  ProjectSettings,
  PromptContext,
  QueuedPromptData,
  QuestionData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskData,
  TaskStateData,
  TaskStateEmoji,
  TodoItem,
  TokensInfoData,
  ToolData,
  UpdatedFile,
  UpdatedFilesGroupMode,
  UsageReportData,
  UserMessageData,
  WorkingMode,
  AIDER_COMMANDS,
  ConnectorMessage,
  ChangeRequestItem,
} from '@common/types';
import { extractProviderModel, extractTextContent, extractServerNameToolName, fileExists, parseUsageReport } from '@common/utils';
import { COMPACT_CONVERSATION_AGENT_PROFILE, CONFLICT_RESOLUTION_PROFILE, HANDOFF_AGENT_PROFILE, INIT_PROJECT_AGENTS_PROFILE } from '@common/agent';
import { SKILLS_TOOL_ACTIVATE_SKILL } from '@common/tools';
import { v4 as uuidv4 } from 'uuid';
import debounce from 'lodash/debounce';
import { isEqual } from 'lodash';

import type { ToolContent } from '@common/types';
import type { SimpleGit } from 'simple-git';
import type { RegisteredCommand } from '@/extensions/extension-manager';

import { getAllFiles, isValidProjectFile } from '@/utils/file-system';
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
import { getEnvironmentVariablesForAider, execWithShellPath, isDirectory } from '@/utils';
import { ContextManager } from '@/task/context-manager';
import { Project } from '@/project';
import { AiderManager } from '@/task/aider-manager';
import { WorktreeManager, GitError } from '@/worktrees';
import { MemoryManager } from '@/memory/memory-manager';
import { getElectronApp } from '@/app';
import { PromptsManager } from '@/prompts';
import { ExtensionManager, ExtensionEventMap } from '@/extensions/extension-manager';
import { PythonDependenciesInstaller } from '@/python-dependencies-installer';
import { getProxyEnvVars } from '@/proxy-manager';

export const INTERNAL_TASK_ID = 'internal';
export const RESPONSE_CHUNK_FLUSH_INTERVAL_MS = 10;

export const EMPTY_TASK_DATA: TaskData = {
  id: '',
  baseDir: '',
  name: '',
  archived: false,
  aiderTotalCost: 0,
  agentTotalCost: 0,
  mainModel: '',
  currentMode: 'agent',
  contextCompactingThreshold: 0,
  weakModelLocked: false,
  parentId: null,
  lastAgentProviderMetadata: undefined,
};

const getTaskFinishedNotificationText = (task: TaskData) => {
  return `📋 ${task.name}${
    task.state
      ? `\n${TaskStateEmoji[task.state] || ''} ${task.state
          .toLowerCase()
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')}`
      : ''
  }`;
};

export class Task {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private connectors: Connector[] = [];
  private currentQuestion: QuestionData | null = null;
  private currentQuestionResolves: ((answer: [string, string | undefined]) => void)[] = [];
  private storedQuestionAnswers: Map<string, 'y' | 'n'> = new Map();
  private currentPromptContext: PromptContext | null = null;
  private currentPromptResponses: ResponseCompletedData[] = [];
  private runPromptResolves: ((value: ResponseCompletedData[]) => void)[] = [];
  private autocompletionAllFiles: string[] | null = null;
  private agentRunResolves: (() => void)[] = [];
  private git: SimpleGit | null = null;
  private responseChunkMap: Map<string, { buffer: string; interval: NodeJS.Timeout }> = new Map();
  private isDeterminingTaskState = false;
  private resolutionAbortControllers: Record<string, AbortController> = {};
  private subagentAbortControllers: Record<string, AbortController> = {};
  private tokensInfo: TokensInfoData;
  private queuedPrompts: QueuedPromptData[] = [];
  private isCompacting = false;

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
    private readonly promptsManager: PromptsManager,
    private readonly extensionManager: ExtensionManager,
    private readonly pythonInstaller: PythonDependenciesInstaller,
    initialTaskData?: Partial<TaskData>,
  ) {
    this.task = {
      ...EMPTY_TASK_DATA,
      ...initialTaskData,
      id: taskId,
      baseDir: project.baseDir,
    };
    this.taskDataPath = path.join(this.project.baseDir, AIDER_DESK_TASKS_DIR, this.taskId, 'settings.json');
    this.contextManager = new ContextManager(this, this.taskId);
    this.agent = new Agent(
      this.store,
      this.agentProfileManager,
      this.mcpManager,
      this.modelManager,
      this.telemetryManager,
      this.memoryManager,
      this.promptsManager,
      this.extensionManager,
    );
    this.tokensInfo = {
      baseDir: this.getProjectDir(),
      taskId: this.taskId,
      chatHistory: { cost: 0, tokens: 0 },
      files: {},
      repoMap: { cost: 0, tokens: 0 },
      systemMessages: { cost: 0, tokens: 0 },
      agent: { cost: 0, tokens: 0 },
    };
    this.aiderManager = new AiderManager(this, this.store, this.modelManager, this.eventManager, () => this.connectors, this.pythonInstaller);

    void this.loadTaskData();
  }

  public async getTaskAgentProfile(): Promise<AgentProfile | null> {
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

    // Apply task-level provider/model overrides if present
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

  private getAuxiliaryModelId(baseProfile: AgentProfile, auxiliaryModelId: string | null | undefined): string {
    if (auxiliaryModelId) {
      return auxiliaryModelId;
    }
    return `${baseProfile.provider}/${baseProfile.model}`;
  }

  private async loadTaskData() {
    logger.debug('Loading task data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    if (await fileExists(this.taskDataPath)) {
      const content = await fs.readFile(this.taskDataPath, 'utf8');
      const data = JSON.parse(content) as TaskData;

      logger.debug('Loaded task data', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        data,
      });

      for (const key of Object.keys(data)) {
        this.task[key] = data[key];
      }
      // make sure we always have the most recent project baseDir, in case the task was migrated from another path
      this.task.baseDir = this.project.baseDir;
    }
  }

  /**
   * Generate a branch name from task name (first 7 words, separated by '-')
   */
  private generateBranchName(): string {
    const settings = this.store.getSettings();
    const branchPrefix = settings.taskSettings.worktreeBranchPrefix || WORKTREE_BRANCH_PREFIX;

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
    return `${branchPrefix}${cleanBranchName || this.taskId}`;
  }

  private async renameWorktreeBranchIfNeeded(): Promise<void> {
    if (this.task.workingMode !== 'worktree' || !this.task.worktree?.baseBranch) {
      return;
    }

    const settings = this.store.getSettings();
    if (!settings.taskSettings.renameBranchOnNameGeneration) {
      return;
    }

    const oldBranch = this.task.worktree.baseBranch;
    const newBranch = this.generateBranchName();

    if (oldBranch === newBranch) {
      return;
    }

    await this.renameWorktreeBranch(newBranch);
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

    // Allow extensions to modify task data before saving
    const extensionResult = await this.extensionManager.dispatchEvent('onTaskUpdated', { task: this.task }, this.project, this);
    if (extensionResult.task) {
      for (const key of Object.keys(extensionResult.task)) {
        this.task[key] = extensionResult.task[key];
      }
    }

    if (this.task.createdAt) {
      // only save if task is not new
      await fs.mkdir(path.dirname(this.taskDataPath), { recursive: true });
      await fs.writeFile(this.taskDataPath, JSON.stringify(this.task, null, 2), 'utf8');
    }

    this.eventManager.sendTaskUpdated(this.task);

    logger.debug('Saved task data', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      task: this.task,
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
      await this.updateContextInfo();
      return;
    }

    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.initInternal();
    await this.initPromise;
    this.initPromise = null;
  }

  private async initInternal() {
    // Check if worktree is enabled for this task
    const workingMode = this.task.workingMode;
    const existingWorktree = await this.worktreeManager.getTaskWorktree(this.project.baseDir, this.taskId);

    if (workingMode === 'worktree') {
      if (existingWorktree) {
        this.task.worktree = existingWorktree;
      } else if (this.task.worktree) {
        // Worktree is already set (e.g. inherited from parent)
        logger.info('Using inherited worktree for task', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          worktreePath: this.task.worktree.path,
        });
      } else {
        // Create a default worktree for this task
        const branchName = this.generateBranchName();
        this.task.worktree = await this.worktreeManager.createWorktree(this.project.baseDir, this.taskId, branchName);
        void this.sendUpdatedFilesUpdated();
        void this.sendWorktreeIntegrationStatusUpdated();
      }
    } else if (workingMode === 'local') {
      // Check if worktree exists and set worktreeEnabled accordingly
      if (existingWorktree) {
        await this.worktreeManager.removeWorktree(this.project.baseDir, existingWorktree);
        void this.sendUpdatedFilesUpdated();
        void this.sendWorktreeIntegrationStatusUpdated();
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
    if (await fileExists(this.getTaskDir())) {
      this.git = simpleGit(this.getTaskDir());
    }

    await this.loadContext();
    if (await this.shouldStartAider()) {
      void this.aiderManager.start();
    }
    await this.updateContextInfo();
    await this.updateAutocompletionData();

    this.eventManager.sendTaskInitialized(this.task);

    this.initialized = true;
    await this.extensionManager.dispatchEvent('onTaskInitialized', { task: this.task }, this.project, this);
  }

  public async load(): Promise<TaskStateData> {
    logger.info('Loading task', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    await this.init();

    const mode = this.getCurrentMode();
    return {
      messages: this.contextManager.getContextMessagesData(),
      files: await this.getContextFiles(!AIDER_MODES.includes(mode)),
      todoItems: await this.getTodos(),
      question: this.currentQuestion,
      queuedPrompts: this.queuedPrompts,
      workingMode: this.task.workingMode || 'local',
    };
  }

  private async loadContext() {
    logger.debug('Loading context for task', {
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

  /**
   * Resolves a relative file path against taskDir first, then falls back to projectDir.
   * This handles git worktree cases where files may exist in the project directory
   * but not in the worktree (taskDir).
   *
   * @param relativePath - Relative file path to resolve
   * @returns The resolved absolute path if the file/dir exists in either location, or null otherwise
   */
  public async resolveContextFilePath(relativePath: string): Promise<string | null> {
    const taskDirAbsolutePath = path.resolve(this.getTaskDir(), relativePath);

    if ((await fileExists(taskDirAbsolutePath)) || (await isDirectory(taskDirAbsolutePath))) {
      return taskDirAbsolutePath;
    }

    const projectDirAbsolutePath = path.resolve(this.getProjectDir(), relativePath);

    if ((await fileExists(projectDirAbsolutePath)) || (await isDirectory(projectDirAbsolutePath))) {
      logger.debug('File not found in taskDir, falling back to projectDir:', {
        taskId: this.taskId,
        relativePath,
        projectDirAbsolutePath,
      });
      return projectDirAbsolutePath;
    }

    return null;
  }

  /**
   * Dispatches an extension event through the ExtensionManager.
   * This public method provides controlled access to extension event dispatch
   * without exposing the ExtensionManager instance directly.
   *
   * @param eventName - The name of the event to dispatch
   * @param event - The event payload
   * @returns Object containing potentially modified event, blocked status, and modified result
   */
  public dispatchExtensionEvent<K extends keyof ExtensionEventMap>(eventName: K, event: ExtensionEventMap[K]): Promise<ExtensionEventMap[K]> {
    return this.extensionManager.dispatchEvent(eventName, event, this.project, this);
  }

  private normalizeFilePath(filePath: string): string {
    const normalizedPath = path.normalize(filePath);

    if (process.platform !== 'win32') {
      return normalizedPath.replace(/\\/g, '/');
    }

    return normalizedPath;
  }

  private cleanupChunkBuffers() {
    for (const entry of this.responseChunkMap.values()) {
      clearInterval(entry.interval);
    }
    this.responseChunkMap.clear();
  }

  public async close(clearContext = false, cleanupEmptyTask = true) {
    if (!this.initialized) {
      return;
    }

    logger.info('Closing task...', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    await this.extensionManager.dispatchEvent('onTaskClosed', { task: this.task }, this.project, this);
    if (clearContext) {
      this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, true);
    }
    await this.interruptResponse();
    this.resolveAgentRunPromises();
    this.cleanupChunkBuffers();

    await this.aiderManager.kill();
    if (cleanupEmptyTask) {
      await this.cleanUpEmptyTask();
    }
    this.initialized = false;
  }

  private async cleanUpEmptyTask() {
    if (this.isInternal() || !(await fileExists(this.taskDataPath))) {
      logger.debug(`Removing ${this.isInternal() ? 'internal' : 'empty'} task folder`, {
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

  private isPromptRunning() {
    return !!this.currentPromptContext || this.agent.isRunning() || this.isCompacting;
  }

  public async runPrompt(
    prompt: string,
    mode: Mode = this.task.currentMode || 'agent',
    addToInputHistory = true,
    userMessageId = uuidv4(),
    sendNotification = true,
  ): Promise<ResponseCompletedData[]> {
    if (this.currentQuestion) {
      if (await this.answerQuestion('n', prompt)) {
        logger.debug('Processed by the answerQuestion function.');
        return [];
      }
    }

    if (this.isPromptRunning()) {
      // Queue the prompt for later execution
      const queuedPrompt: QueuedPromptData = {
        id: userMessageId,
        text: prompt,
        mode,
        timestamp: Date.now(),
      };
      this.queuedPrompts.push(queuedPrompt);
      this.eventManager.sendQueuedPromptsUpdated(this.project.baseDir, this.taskId, this.queuedPrompts);
      return [];
    }

    let promptContext: PromptContext = {
      id: userMessageId,
    };

    const extensionResult = await this.extensionManager.dispatchEvent('onPromptStarted', { prompt, mode, promptContext }, this.project, this);
    if (extensionResult.blocked) {
      logger.debug('Prompt blocked by extension');
      return [];
    }
    prompt = extensionResult.prompt;
    mode = extensionResult.mode;
    promptContext = extensionResult.promptContext;

    logger.info('Running prompt:', {
      baseDir: this.project.baseDir,
      prompt: prompt.substring(0, 100),
      mode,
      promptContext,
    });

    if (addToInputHistory) {
      await this.project.addToInputHistory(prompt);
    }

    this.addUserMessage(userMessageId, prompt);
    this.addLogMessage('loading');

    this.telemetryManager.captureRunPrompt(mode);

    let responses: ResponseCompletedData[] = [];
    if (!AIDER_MODES.includes(mode)) {
      const profile = await this.getTaskAgentProfile();
      logger.debug('AgentProfile:', profile);

      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      responses = await this.runPromptInAgent(profile, mode, prompt, promptContext, undefined, undefined, undefined, true, sendNotification);
    } else {
      responses = await this.runPromptInAider(mode, prompt, promptContext, sendNotification);
    }

    const promptFinishedExtensionResult = await this.extensionManager.dispatchEvent('onPromptFinished', { responses }, this.project, this);
    return promptFinishedExtensionResult.responses;
  }

  public async savePromptOnly(prompt: string, addInputHistory = true): Promise<void> {
    logger.info('Saving prompt without execution:', {
      baseDir: this.project.baseDir,
      prompt,
    });

    if (addInputHistory) {
      await this.project.addToInputHistory(prompt);
    }

    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    // Add to context manager
    this.contextManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });

    // Add user message to context
    this.addUserMessage(promptContext.id, prompt);

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      state: DefaultTaskState.Todo,
    });
  }

  private async runNextQueuedPrompt(): Promise<ResponseCompletedData[]> {
    if (this.queuedPrompts.length > 0) {
      const nextPrompt = this.queuedPrompts.shift();
      if (nextPrompt) {
        this.addUserMessage(nextPrompt.id, nextPrompt.text);
        this.addLogMessage('loading');
        this.eventManager.sendQueuedPromptsUpdated(this.project.baseDir, this.taskId, this.queuedPrompts);
        return this.runPrompt(nextPrompt.text, nextPrompt.mode, true, nextPrompt.id, false);
      }
    }

    return [];
  }

  public async runPromptInAider(mode: Mode, prompt: string, promptContext: PromptContext, sendNotification = true): Promise<ResponseCompletedData[]> {
    await this.waitForCurrentPromptToFinish();

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt),
      startedAt: new Date().toISOString(),
      state: DefaultTaskState.InProgress,
    });

    await this.aiderManager.waitForStart();

    // Detect files in prompt and ask to add them to context (only for aider modes)
    await this.detectAndAddFilesFromPrompt(prompt);

    // Persist user message to the task context before running Aider so it can be redone even if the first call fails.
    this.contextManager.addContextMessage({
      id: promptContext.id,
      role: MessageRole.User,
      content: prompt,
      promptContext,
    });

    let messages = this.contextManager.toConnectorMessages();
    let files = this.contextManager.getContextFiles();

    const extensionResult = await this.extensionManager.dispatchEvent(
      'onAiderPromptStarted',
      { prompt, mode, promptContext, messages, files },
      this.project,
      this,
    );
    if (extensionResult.blocked) {
      logger.debug('Aider prompt blocked by extension');
      return [];
    }

    prompt = extensionResult.prompt;
    mode = extensionResult.mode;
    promptContext = extensionResult.promptContext;
    messages = extensionResult.messages;
    files = extensionResult.files;

    let responses = await this.sendPromptToAider(prompt, promptContext, mode, messages, files, {
      autoApprove: extensionResult.autoApprove ?? this.task.autoApprove,
      denyCommands: extensionResult.denyCommands,
    });
    logger.debug('Responses:', { responses });

    const finishedExtensionResult = await this.extensionManager.dispatchEvent('onAiderPromptFinished', { responses }, this.project, this);

    responses = finishedExtensionResult.responses;

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

    this.sendStateUpdated();

    if (this.task.state === DefaultTaskState.InProgress) {
      await this.saveTask({
        completedAt: new Date().toISOString(),
        state: DefaultTaskState.ReadyForReview,
      });
    }

    const nextResponses = await this.runNextQueuedPrompt();
    responses.push(...nextResponses);

    if (sendNotification) {
      this.notifyIfEnabled('Task finished', getTaskFinishedNotificationText(this.task));
    }

    return responses;
  }

  public async runPromptInAgent(
    profile: AgentProfile,
    mode: Mode,
    prompt: string | null,
    promptContext: PromptContext = { id: uuidv4() },
    contextMessages?: ContextMessage[],
    contextFiles?: ContextFile[],
    systemPrompt?: string,
    waitForCurrentAgentToFinish = true,
    sendNotification = true,
  ): Promise<ResponseCompletedData[]> {
    if (waitForCurrentAgentToFinish) {
      await this.waitForCurrentAgentToFinish();
    }

    await this.saveTask({
      name: this.task.name || this.getTaskNameFromPrompt(prompt || ''),
      startedAt: new Date().toISOString(),
      state: DefaultTaskState.InProgress,
    });

    const agentMessages = await this.agent.runAgent(this, profile, prompt, mode, promptContext, contextMessages, contextFiles, systemPrompt);
    if (agentMessages.length > 0) {
      // send messages to connectors
      this.contextManager.toConnectorMessages(agentMessages).forEach((message) => {
        this.sendAddMessage(message.role, message.content, false);
      });
    }

    void this.sendRequestContextInfo();
    void this.sendWorktreeIntegrationStatusUpdated();
    void this.sendUpdatedFilesUpdated();

    this.resolveAgentRunPromises();

    if (waitForCurrentAgentToFinish) {
      await this.runNextQueuedPrompt();
    }

    if (this.task.state === DefaultTaskState.InProgress) {
      // Determine task state based on the last assistant message
      const settings = this.store.getSettings();
      let state: string | null = DefaultTaskState.ReadyForReview;

      if (settings.taskSettings.smartTaskState) {
        state = await this.determineTaskState(agentMessages);

        // check once again after determining task state which can task some time
        if (waitForCurrentAgentToFinish) {
          await this.runNextQueuedPrompt();
        }
      }

      if (this.task.state === DefaultTaskState.InProgress) {
        await this.saveTask({
          completedAt: new Date().toISOString(),
          state: state || DefaultTaskState.ReadyForReview,
        });
      }
    }

    if (sendNotification) {
      this.notifyIfEnabled('Task finished', getTaskFinishedNotificationText(this.task));
    }

    return [];
  }

  private getTaskNameFromPrompt(prompt: string): string {
    const fallbackName = prompt.trim().split(' ').slice(0, 5).join(' ');

    const settings = this.store.getSettings();
    if (settings.taskSettings.autoGenerateTaskName) {
      this.generateTaskNameInBackground(prompt)
        .then((taskName) => {
          const newName = taskName || fallbackName;
          void this.saveTask({ name: newName }).then(() => this.renameWorktreeBranchIfNeeded());
        })
        .catch((error) => {
          logger.warn('Failed to generate task name:', error);
          void this.saveTask({ name: fallbackName }).then(() => this.renameWorktreeBranchIfNeeded());
        });
      return '<<generating>>';
    } else {
      return fallbackName;
    }
  }

  private async generateTaskNameInBackground(prompt: string): Promise<string | null> {
    const agentProfile = await this.getTaskAgentProfile();
    if (agentProfile) {
      const settings = this.store.getSettings();
      const modelId = this.getAuxiliaryModelId(agentProfile, settings.taskSettings.taskNameModel);
      const maxPromptLength = 1000;
      const taskName = await this.agent.generateText(
        modelId,
        await this.promptsManager.getGenerateTaskNamePrompt(this),
        `Generate a concise task name for this request:\n\n${prompt.length > maxPromptLength ? prompt.substring(0, maxPromptLength) + '...' : prompt}\n\nOnly answer with the task name, nothing else.`,
        this.getProjectDir(),
        undefined,
        false,
      );
      if (taskName) {
        logger.debug('Generated task name:', { taskName });
        return taskName.trim();
      } else {
        logger.warn('Generate task name interrupted');
      }
    }

    return null;
  }

  private async determineTaskState(resultMessages: ContextMessage[]): Promise<string | null> {
    this.isDeterminingTaskState = true;

    try {
      // Find the last assistant message from result messages
      const lastAssistantMessage = [...resultMessages].reverse().find((msg) => msg.role === MessageRole.Assistant) as ContextAssistantMessage | undefined;

      if (!lastAssistantMessage) {
        logger.debug('No assistant message found for task state determination');
        return null;
      }

      // Extract reasoning and text from the last assistant message
      const reasoningText = Array.isArray(lastAssistantMessage.content) && lastAssistantMessage.content.find((part) => part.type === 'reasoning')?.text;
      const contentText = extractTextContent(lastAssistantMessage.content);

      if (!contentText && !reasoningText) {
        logger.debug('No content found in last assistant message for task state determination');
        return null;
      }

      // Create a user message wrapping the last assistant message information
      let wrappedMessage = "Based on the agent's last response, determine the appropriate task state.\n\n";
      if (reasoningText) {
        wrappedMessage += `<agent-reasoning>\n${reasoningText}</agent-reasoning>\n\n`;
      }
      wrappedMessage += `<agent-response>\n${contentText}</agent-response>`;

      const agentProfile = await this.getTaskAgentProfile();
      if (!agentProfile) {
        logger.debug('No agent profile found for task state determination');
        return null;
      }

      const settings = this.store.getSettings();
      const modelId = this.getAuxiliaryModelId(agentProfile, settings.taskSettings.taskStateModel);

      this.addLogMessage('loading', 'Updating task state...');

      const answer = await this.agent.generateText(modelId, await this.promptsManager.getUpdateTaskStatePrompt(this), wrappedMessage, this.getProjectDir());
      if (!answer) {
        logger.warn('Task state determination interrupted');
        return null;
      }

      logger.debug('Determining task state:', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        modelId,
      });

      const trimmedAnswer = answer.trim();
      const validStates = [DefaultTaskState.MoreInfoNeeded, DefaultTaskState.ReadyForImplementation, DefaultTaskState.ReadyForReview];

      if (validStates.includes(trimmedAnswer as DefaultTaskState)) {
        logger.debug(`Determined task state: ${trimmedAnswer}`);

        return trimmedAnswer;
      } else if (trimmedAnswer !== 'NONE') {
        logger.warn(`Invalid task state returned: ${trimmedAnswer}. Expected one of: ${validStates.join(', ')}, or NONE`, {
          answer: trimmedAnswer,
        });
      }
    } catch (error) {
      logger.error('Error determining task state:', error);
    } finally {
      this.isDeterminingTaskState = false;
    }

    return null;
  }

  public async runSubagent(
    profile: AgentProfile,
    prompt: string,
    contextMessages?: ContextMessage[],
    contextFiles?: ContextFile[],
    systemPrompt?: string,
    abortController?: AbortController,
    promptContext?: PromptContext,
  ): Promise<ContextMessage[]> {
    profile = {
      ...profile,
      isSubagent: true,
    };

    // Register abort controller if provided and promptContext has interruptId
    const interruptId = promptContext?.group?.interruptId;
    if (abortController && interruptId) {
      this.registerSubagentAbortController(interruptId, abortController);
    }

    try {
      if (!contextMessages) {
        contextMessages = await this.getContextMessages();
      }
      if (!contextFiles) {
        contextFiles = await this.getContextFiles();
      }

      const extensionResult = await this.extensionManager.dispatchEvent(
        'onSubagentStarted',
        {
          subagentProfile: profile,
          prompt,
          contextMessages,
          contextFiles,
          systemPrompt,
          promptContext,
        },
        this.project,
        this,
      );
      if (extensionResult.blocked) {
        logger.debug('Subagent execution blocked by extension');
        return [];
      }
      prompt = extensionResult.prompt;
      contextMessages = extensionResult.contextMessages;
      contextFiles = extensionResult.contextFiles;
      systemPrompt = extensionResult.systemPrompt;
      promptContext = extensionResult.promptContext;

      let resultMessages = await this.agent.runAgent(
        this,
        profile,
        prompt,
        'subagent',
        promptContext,
        contextMessages,
        contextFiles,
        systemPrompt,
        false,
        abortController?.signal,
      );
      const subagentFinishedExtensionResult = await this.extensionManager.dispatchEvent(
        'onSubagentFinished',
        { subagentProfile: profile, resultMessages },
        this.project,
        this,
      );
      resultMessages = subagentFinishedExtensionResult.resultMessages;

      return resultMessages;
    } finally {
      // Unregister abort controller if it was registered
      if (abortController && interruptId) {
        this.unregisterSubagentAbortController(interruptId);
      }
    }
  }

  public sendPromptToAider(
    prompt: string,
    promptContext: PromptContext = { id: uuidv4() },
    mode?: Mode,
    messages: ConnectorMessage[] = this.contextManager.toConnectorMessages(),
    files: ContextFile[] = this.contextManager.getContextFiles(),
    options?: AiderRunOptions,
  ): Promise<ResponseCompletedData[]> {
    this.currentPromptResponses = [];
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
    if (!message.finished) {
      const sendResponseChunk = async (chunk: string) => {
        let data: ResponseChunkData = {
          messageId: message.id,
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          chunk,
          reflectedMessage: message.reflectedMessage,
          promptContext: message.promptContext,
        };

        const extensionResult = await this.extensionManager.dispatchEvent('onResponseChunk', { chunk: data }, this.project, this);
        data = extensionResult.chunk;

        try {
          this.eventManager.sendResponseChunk(data);
        } catch (error) {
          logger.error('Failed to send response chunk', {
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      if (!this.responseChunkMap.has(message.id)) {
        // First chunk: send immediately and create interval
        logger.debug('Sending first chunk', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          messageId: message.id,
        });
        await sendResponseChunk(message.content);

        const messageId = message.id;
        const interval = setInterval(async () => {
          const entry = this.responseChunkMap.get(messageId);
          if (entry && entry.buffer.length > 0) {
            await sendResponseChunk(entry.buffer);
            logger.debug('Sending buffered chunk', {
              baseDir: this.project.baseDir,
              taskId: this.taskId,
              messageId: message.id,
              chunk: entry.buffer,
            });
            entry.buffer = '';
          } else {
            logger.debug('No buffered chunk, stopping interval', {
              baseDir: this.project.baseDir,
              taskId: this.taskId,
              messageId: message.id,
            });
            // No buffered chunk, stop interval
            clearInterval(interval);
            this.responseChunkMap.delete(messageId);
          }
        }, RESPONSE_CHUNK_FLUSH_INTERVAL_MS);
        logger.debug('Created interval for message', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          messageId: message.id,
        });
        this.responseChunkMap.set(messageId, { buffer: '', interval });
      } else {
        logger.debug('Appending to buffer', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          messageId: message.id,
        });
        // Subsequent chunks: append to buffer
        const entry = this.responseChunkMap.get(message.id)!;
        entry.buffer += message.content;
      }
    } else {
      const entry = this.responseChunkMap.get(message.id);
      if (entry) {
        clearInterval(entry.interval);
        this.responseChunkMap.delete(message.id);
      }

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
      let data: ResponseCompletedData = {
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

      const extensionResult = await this.extensionManager.dispatchEvent('onResponseCompleted', { response: data }, this.project, this);
      data = extensionResult.response;

      this.sendResponseCompleted(data);
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

    this.eventManager.sendNotification(this.getProjectDir(), title, text);

    const app = getElectronApp();
    if (!app) {
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

  public async answerQuestion(answer: string, userInput?: string): Promise<boolean> {
    if (!this.currentQuestion) {
      return false;
    }

    const extensionResult = await this.extensionManager.dispatchEvent(
      'onQuestionAnswered',
      { question: this.currentQuestion, answer, userInput },
      this.project,
      this,
    );
    answer = extensionResult.answer;
    userInput = extensionResult.userInput;

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
      logger.debug('Storing answer for question due to "d" or "a" input:', {
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

  public async addFiles(...contextFiles: ContextFile[]) {
    const addedFiles: ContextFile[] = [];

    for (let contextFile of contextFiles) {
      // Extension event uses plural name
      const extensionResult = await this.extensionManager.dispatchEvent('onFilesAdded', { files: [contextFile] }, this.project, this);
      if (extensionResult.files.length === 0) {
        logger.debug('File addition blocked by extension (empty files array)');
        return false;
      }
      contextFile = extensionResult.files[0];

      const normalizedPath = this.normalizeFilePath(contextFile.path);
      logger.debug('Adding file or folder:', {
        path: normalizedPath,
        readOnly: contextFile.readOnly,
      });
      const fileToAdd = { ...contextFile, path: normalizedPath };
      addedFiles.push(...(await this.contextManager.addContextFile(fileToAdd)));
    }
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

  public async dropFile(filePath: string) {
    // Extension event uses plural name and ContextFile array
    await this.extensionManager.dispatchEvent('onFilesDropped', { files: [{ path: filePath }] }, this.project, this);
    const normalizedPath = this.normalizeFilePath(filePath);
    logger.info('Dropping file or folder:', { path: normalizedPath });
    const droppedFiles = this.contextManager.dropContextFile(normalizedPath);

    // Send drop file message for each dropped file
    for (const droppedFile of droppedFiles) {
      this.sendDropFile(droppedFile.path, droppedFile.readOnly);
    }

    await this.sendContextFilesUpdated();
    await this.updateContextInfo(true, true);
  }

  public sendDropFile(filePath: string, readOnly?: boolean, noUpdate?: boolean): void {
    const absolutePath = path.resolve(this.project.baseDir, filePath);
    const isOutsideProject = !absolutePath.startsWith(path.resolve(this.project.baseDir));
    const pathToSend =
      readOnly || isOutsideProject ? absolutePath : filePath.startsWith(this.project.baseDir) ? filePath : path.join(this.project.baseDir, filePath);

    this.findMessageConnectors('drop-file').forEach((connector) => connector.sendDropFileMessage(pathToSend, noUpdate));
  }

  public async addToGit(absolutePath: string, promptContext?: PromptContext): Promise<void> {
    if (!this.git) {
      return;
    }

    try {
      // Check if the project is a git repository before attempting to add
      const isRepo = await this.git.checkIsRepo();
      if (!isRepo) {
        return;
      }

      // Add the new file to git staging
      await this.git.add(absolutePath);
      await this.updateAutocompletionData(undefined, true);
    } catch (gitError) {
      const gitErrorMessage = gitError instanceof Error ? gitError.message : String(gitError);
      this.addLogMessage('warning', `Failed to add new file ${absolutePath} to git staging area: ${gitErrorMessage}`, false, promptContext);
    }
  }

  private sendStateUpdated() {
    void this.sendRequestContextInfo();
    void this.sendWorktreeIntegrationStatusUpdated();
    void this.sendUpdatedFilesUpdated();
    void this.sendContextFilesUpdated();
  }

  private async sendContextFilesUpdated() {
    const mode = this.getCurrentMode();
    const allFiles = await this.getContextFiles(!AIDER_MODES.includes(mode));

    this.eventManager.sendContextFilesUpdated(this.project.baseDir, this.taskId, allFiles);
  }

  public async runCommand(command: string, addToHistory = true) {
    const extensionResult = await this.extensionManager.dispatchEvent('onCommandExecuted', { command }, this.project, this);
    if (extensionResult.blocked) {
      logger.debug('Command execution blocked by extension');
      return;
    }
    command = extensionResult.command;

    if (this.currentQuestion) {
      await this.answerQuestion('n');
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
        const gitRoot = (await this.git?.revparse(['--show-toplevel'])) || this.project.baseDir;
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

        void this.sendUpdatedFilesUpdated();
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
      if (AIDER_COMMANDS.includes(command.trim()) && !this.aiderManager.isStarted()) {
        logger.info('Starting Aider for command:', { command });
        this.addLogMessage('loading', 'Starting Aider...');
        await this.aiderManager.waitForStart();
        this.addLogMessage('loading', undefined, true);
      }

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
    const extensionResult = await this.extensionManager.dispatchEvent('onQuestionAsked', { question: questionData }, this.project, this);
    if (extensionResult.answer) {
      logger.info('Question answered by extension', {
        question: questionData.text,
        answer: extensionResult.answer,
      });
      return [extensionResult.answer, undefined];
    }
    questionData = extensionResult.question;

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
        await this.answerQuestion(storedAnswer);
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

      const [providerId, modelId] = extractProviderModel(modelName);

      if (!providerId || !modelId) {
        return null;
      }

      const model = this.modelManager.getModelSettings(providerId, modelId, true);
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

    logger.debug('Sending update models info to connectors', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      modelsInfo: Object.keys(modelsInfo),
    });

    // Send to connectors that listen to 'update-models-info'
    this.findMessageConnectors('update-models-info').forEach((connector) => connector.sendUpdateModelsInfoMessage(modelsInfo));
    await this.sendRequestContextInfo();
  }

  private async detectAndAddFilesFromPrompt(prompt: string): Promise<void> {
    try {
      const contextFiles = await this.getContextFiles();
      const contextFilePaths = new Set(contextFiles.map((file) => file.path.replace(/\\/g, '/')));
      const allFiles = await getAllFiles(this.getTaskDir());
      const addableFiles = allFiles.filter((file) => !contextFilePaths.has(file));

      if (addableFiles.length === 0) {
        return;
      }

      const normalizedPrompt = prompt.toLowerCase();

      const matchedFiles: string[] = [];
      const seen = new Set<string>();

      // First pass: match files by full path
      const matchedFileNames = new Set<string>();
      for (const filePath of addableFiles) {
        if (!isValidProjectFile(filePath, this.getTaskDir())) {
          continue;
        }

        const normalizedPath = filePath.replace(/\\/g, '/');

        if (normalizedPrompt.includes(normalizedPath.toLowerCase())) {
          matchedFiles.push(normalizedPath);
          seen.add(normalizedPath);
          matchedFileNames.add(path.posix.basename(normalizedPath));
        }
      }

      // Check if any context file matches a path in the prompt and track those names
      for (const contextFile of contextFiles) {
        const normalizedContextPath = contextFile.path.replace(/\\/g, '/');
        if (normalizedPrompt.includes(normalizedContextPath.toLowerCase())) {
          matchedFileNames.add(path.posix.basename(normalizedContextPath));
        }
      }

      // Second pass: match files by filename only (if not already matched by path)
      for (const filePath of addableFiles) {
        if (!isValidProjectFile(filePath, this.getTaskDir())) {
          continue;
        }

        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileName = path.posix.basename(normalizedPath);

        // Skip if already matched by path
        if (seen.has(normalizedPath)) {
          continue;
        }

        // Skip if filename was already matched by path (prevents false positives)
        if (matchedFileNames.has(fileName)) {
          continue;
        }

        // Only match by filename if it's not empty and appears in the prompt
        if (fileName.length > 0 && normalizedPrompt.includes(fileName.toLowerCase())) {
          matchedFiles.push(normalizedPath);
          seen.add(normalizedPath);
        }
      }

      if (matchedFiles.length === 0) {
        return;
      }

      let addAllRemaining = false;
      let skipAllRemaining = false;

      for (const filePath of matchedFiles) {
        if (skipAllRemaining) {
          break;
        }

        if (addAllRemaining) {
          await this.addFiles({ path: filePath, readOnly: false });
          continue;
        }

        const [answer] = await this.askQuestion({
          baseDir: this.getProjectDir(),
          taskId: this.taskId,
          text: 'Add file from prompt to context?',
          subject: filePath,
          defaultAnswer: 'y',
          answers: [
            { text: '(Y)es', shortkey: 'y' },
            { text: '(N)o', shortkey: 'n' },
            { text: '(A)ll', shortkey: 'a' },
            { text: '(S)kip all', shortkey: 's' },
          ],
          isGroupQuestion: true,
          key: `detect-files-prompt_${filePath}`,
        });

        if (answer === 's') {
          skipAllRemaining = true;
          break;
        }

        if (answer === 'a') {
          addAllRemaining = true;
          await this.addFiles({ path: filePath, readOnly: false });
          continue;
        }

        if (answer === 'y') {
          await this.addFiles({ path: filePath, readOnly: false });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error during file detection from prompt', {
        prompt,
        error: errorMessage,
      });
    }
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

  public async getUpdatedFiles(): Promise<UpdatedFile[]> {
    const mainBranch = this.task.worktree ? await this.worktreeManager.getProjectMainBranch(this.project.baseDir) : undefined;
    const projectSettings = this.project.getProjectSettings();
    const groupMode = (projectSettings.updatedFilesGroupMode as UpdatedFilesGroupMode) || UpdatedFilesGroupMode.Grouped;
    return await this.worktreeManager.getUpdatedFiles(this.getTaskDir(), this.task.workingMode, mainBranch, groupMode);
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
    if (await fileExists(AIDER_DESK_GLOBAL_RULES_DIR)) {
      try {
        const globalRuleFileNames = await fs.readdir(AIDER_DESK_GLOBAL_RULES_DIR);
        for (const fileName of globalRuleFileNames) {
          if (fileName.endsWith('.md')) {
            const absolutePath = path.join(AIDER_DESK_GLOBAL_RULES_DIR, fileName);
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
    }

    // Include AGENTS.md from project root if it exists
    const agentsFilePath = path.join(this.project.baseDir, 'AGENTS.md');
    if (await fileExists(agentsFilePath)) {
      ruleFiles.push({
        path: 'AGENTS.md',
        readOnly: true,
        source: 'project-rule',
      });
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
          logger.debug('Could not access agent rule file', {
            ruleFilePath,
            error,
          });
        }
      }
    }

    // Dispatch extension event to allow modification of rule files
    const extensionResult = await this.extensionManager.dispatchEvent('onRuleFilesRetrieved', { files: ruleFiles }, this.project, this);
    return extensionResult.files;
  }

  public getRepoMap(): string {
    return this.aiderManager.getRepoMap();
  }

  public updateRepoMapFromConnector(repoMap: string): void {
    this.aiderManager.setRepoMap(repoMap);
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

  public async addRoleContextMessage(role: MessageRole, content: string, usageReport?: UsageReportData) {
    logger.debug('Adding role message to session:', {
      baseDir: this.project.baseDir,
      role,
      content: content.substring(0, 30),
    });

    this.contextManager.addContextMessage(role, content, usageReport);
    await this.updateContextInfo();
  }

  public async addContextMessage(message: ContextMessage, updateContextInfo = false) {
    this.contextManager.addContextMessage(message);
    if (updateContextInfo) {
      await this.updateContextInfo();
    }
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
    this.eventManager.sendTool(data);
  }

  public async clearContext(addToHistory = false, updateContextInfo = true) {
    logger.info('Clearing context:', {
      baseDir: this.project.baseDir,
      addToHistory,
      updateContextInfo,
    });

    await this.updateTask({
      state: DefaultTaskState.Todo,
      metadata: undefined,
      lastAgentProviderMetadata: null,
    });
    this.contextManager.clearMessages();
    await this.runCommand('clear', addToHistory);
    this.eventManager.sendClearTask(this.project.baseDir, this.taskId, true, false);

    if (updateContextInfo) {
      await this.updateContextInfo();
    }
  }

  public async resetContext() {
    logger.debug('Reset task context', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });
    this.contextManager.clearContextFiles();
    this.contextManager.clearMessages();
    await this.contextManager.save();
  }

  /**
   * Load context messages into the task context and send them to the UI.
   * This is used for loading pre-authored context (e.g., from extensions).
   */
  public async loadContextMessages(messages: ContextMessage[]) {
    logger.debug('Loading context messages:', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      messagesCount: messages.length,
    });

    await this.contextManager.loadMessages(messages);
  }

  public async interruptResponse(interruptId?: string) {
    if (interruptId) {
      // Check for subagent abort controller first
      const subagentAbortController = this.subagentAbortControllers[interruptId];
      if (subagentAbortController) {
        logger.debug('Interrupting subagent:', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          interruptId,
        });
        subagentAbortController.abort();
        delete this.subagentAbortControllers[interruptId];
        logger.info('Aborted subagent', { interruptId });
        return;
      }

      // Check for conflict resolution agent
      const abortController = this.resolutionAbortControllers[interruptId];
      if (abortController) {
        logger.debug('Interrupting conflict resolution agent:', {
          baseDir: this.project.baseDir,
          taskId: this.taskId,
          interruptId,
        });
        abortController.abort();
        delete this.resolutionAbortControllers[interruptId];
        logger.info('Aborted conflict resolution agent', { interruptId });
        return;
      }

      logger.warn('No agent found for interruptId', {
        interruptId,
      });
      return;
    }

    // No specific interruptId - check for running subagents first
    const subagentInterruptIds = Object.keys(this.subagentAbortControllers);
    if (subagentInterruptIds.length > 0) {
      // Cancel the first running subagent
      const firstInterruptId = subagentInterruptIds[0];
      logger.debug('Interrupting first running subagent:', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        interruptId: firstInterruptId,
      });
      const abortController = this.subagentAbortControllers[firstInterruptId];
      abortController.abort();
      delete this.subagentAbortControllers[firstInterruptId];
      logger.info('Aborted subagent', { interruptId: firstInterruptId });
      return;
    }

    // Default behavior: interrupt main agent
    logger.debug('Interrupting response:', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      promptContext: this.currentPromptContext?.id,
    });

    if (this.currentQuestion) {
      await this.answerQuestion('n', 'Cancelled');
    }

    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
    this.promptFinished();
    this.cleanupChunkBuffers();

    if (this.initialized && this.task.state === DefaultTaskState.InProgress) {
      if (this.isDeterminingTaskState) {
        // cancel the task state determination and set the task to ready for review
        void this.saveTask({
          state: DefaultTaskState.ReadyForReview,
          completedAt: new Date().toISOString(),
        });
      } else {
        void this.saveTask({
          state: DefaultTaskState.Interrupted,
          interruptedAt: new Date().toISOString(),
        });
      }
    }
  }

  public registerSubagentAbortController(interruptId: string, abortController: AbortController): void {
    this.subagentAbortControllers[interruptId] = abortController;
    logger.debug('Registered subagent abort controller', { interruptId });
  }

  public unregisterSubagentAbortController(interruptId: string): void {
    delete this.subagentAbortControllers[interruptId];
    logger.debug('Unregistered subagent abort controller', { interruptId });
  }

  public getQueuedPrompts(): QueuedPromptData[] {
    return this.queuedPrompts;
  }

  public removeQueuedPrompt(promptId: string): void {
    this.queuedPrompts = this.queuedPrompts.filter((qp) => qp.id !== promptId);
    this.eventManager.sendQueuedPromptsUpdated(this.project.baseDir, this.taskId, this.queuedPrompts);
  }

  public reorderQueuedPrompts(prompts: QueuedPromptData[]): void {
    this.queuedPrompts = prompts;
    this.eventManager.sendQueuedPromptsUpdated(this.project.baseDir, this.taskId, this.queuedPrompts);
  }

  public editQueuedPrompt(promptId: string, newText: string): void {
    const prompt = this.queuedPrompts.find((qp) => qp.id === promptId);
    if (prompt) {
      prompt.text = newText;
      this.eventManager.sendQueuedPromptsUpdated(this.project.baseDir, this.taskId, this.queuedPrompts);
    }
  }

  public async sendQueuedPromptNow(promptId: string): Promise<void> {
    const queuedPromptIndex = this.queuedPrompts.findIndex((qp) => qp.id === promptId);
    if (queuedPromptIndex === -1) {
      logger.warn('Queued prompt not found:', { promptId });
      return;
    }

    const queuedPrompt = this.queuedPrompts[queuedPromptIndex];

    if (queuedPromptIndex > 0) {
      logger.debug('Moving queued prompt to top:', { promptId });
      this.queuedPrompts.splice(queuedPromptIndex, 1);
      this.queuedPrompts.unshift(queuedPrompt);
    }

    // interrupting to allow the next queued prompt to be sent
    this.addUserMessage(queuedPrompt.id, queuedPrompt.text);
    this.findMessageConnectors('interrupt-response').forEach((connector) => connector.sendInterruptResponseMessage());
    this.agent.interrupt();
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
    finished = !!response,
  ) {
    if (!id) {
      logger.debug('No tool id provided tool message, skipping...');
      return;
    }

    logger.debug('Sending tool message:', {
      id,
      baseDir: this.project.baseDir,
      serverName,
      name: toolName,
      args,
      response: typeof response === 'string' ? response.substring(0, 100) : response,
      usageReport,
      promptContext,
      finished,
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
      finished,
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
          tokens: usageReport.sentTokens + usageReport.receivedTokens + (usageReport.cacheReadTokens ?? 0),
        },
      });
    }
    if (usageReport.aiderTotalCost) {
      this.task.aiderTotalCost += usageReport.messageCost;
      this.eventManager.sendTaskUpdated(this.task);
    }
  }

  addUserMessage(id: string, content: string, promptContext?: PromptContext) {
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

  public async removeMessage(messageId: string): Promise<string[]> {
    const removedIds = this.contextManager.removeMessageById(messageId);
    await this.reloadConnectorMessages();

    await this.updateContextInfo();
    return removedIds;
  }

  public async removeMessagesUpTo(messageId: string): Promise<string[]> {
    const removedIds = this.contextManager.removeMessagesAfter(messageId);
    await this.reloadConnectorMessages();

    await this.updateContextInfo();
    return removedIds;
  }

  public sendTaskMessageRemoved(messageIds: string[]) {
    if (messageIds.length > 0) {
      this.eventManager.sendTaskMessageRemoved(this.project.baseDir, this.taskId, messageIds);
    }
  }

  public async redoLastUserPrompt(mode: Mode, updatedPrompt?: string) {
    logger.info('Redoing last user prompt:', {
      baseDir: this.project.baseDir,
      mode,
      hasUpdatedPrompt: !!updatedPrompt,
    });

    const removedMessages = this.contextManager.removeMessagesUpToLastUserMessage();
    const originalLastUserMessage = removedMessages.findLast((msg) => msg.role === MessageRole.User);
    if (!originalLastUserMessage) {
      logger.warn('Could not find original last user message content to redo.');
      return;
    }

    const promptToRun = updatedPrompt ?? (originalLastUserMessage.content as string);

    if (promptToRun) {
      logger.info('Found message content to run, reloading and re-running prompt.', {
        remainingMessagesCount: (await this.contextManager.getContextMessages()).length,
      });

      this.sendTaskMessageRemoved(removedMessages.slice(0, -1).map((msg) => msg.id));

      await this.updateContextInfo();

      // No need to await runPrompt here, let it run in the background
      void this.runPrompt(promptToRun, mode, false, originalLastUserMessage.id);
    } else {
      logger.warn('Could not find a previous user message to redo or an updated prompt to run.');
    }
  }

  public async resumeTask() {
    logger.info('Resuming task:', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    const mode = this.getCurrentMode();

    if (!AIDER_MODES.includes(mode)) {
      const profile = await this.getTaskAgentProfile();
      if (!profile) {
        logger.error('No active Agent profile found for resume');
        this.addLogMessage('error', 'No active Agent profile found');
        return;
      }

      logger.info('Resuming agent task...');
      this.addLogMessage('loading', 'Resuming task...');

      void this.runPromptInAgent(profile, mode, null);
    } else {
      // In other modes, check if last message is user
      const contextMessages = await this.contextManager.getContextMessages();
      const lastMessage = contextMessages[contextMessages.length - 1];

      if (lastMessage && lastMessage.role === MessageRole.User) {
        // Last message is from user, redo it
        logger.info('Last message is from user, redoing prompt');
        this.addLogMessage('loading', 'Resuming task...');
        void this.redoLastUserPrompt(mode);
      } else {
        // Last message is not from user, send "Continue" to aider
        logger.info('Last message is not from user, sending Continue prompt');
        void this.runPrompt('Continue', mode, false);
      }
    }
  }

  private getCurrentMode() {
    return this.task.currentMode || this.store.getProjectSettings(this.project.baseDir).currentMode || 'agent';
  }

  private async shouldStartAider(): Promise<boolean> {
    const agentProfile = await this.getTaskAgentProfile();
    return AIDER_MODES.includes(this.getCurrentMode()) || (agentProfile?.useAiderTools ?? false) || (agentProfile?.includeRepoMap ?? false);
  }

  private async reloadConnectorMessages() {
    await this.runCommand('clear', false);
    this.contextManager.toConnectorMessages().forEach((message) => {
      this.sendAddMessage(message.role, message.content, false);
    });
  }

  private findSkillActivationMessages(contextMessages: ContextMessage[]): ContextMessage[] {
    // Collect all skill activations with their skill names
    // We'll deduplicate by keeping only the most recent activation per skill
    const skillActivations: Map<string, { toolCall: ToolCallPart; assistantMsg: ContextMessage; toolMsg: ContextMessage; toolResultPart: ToolResultPart }> =
      new Map();

    for (const message of contextMessages) {
      if (message.role === 'assistant' && Array.isArray(message.content)) {
        // Collect skill activation tool calls from this message
        for (const part of message.content) {
          if (part.type === 'tool-call') {
            const [, toolName] = extractServerNameToolName(part.toolName);
            if (toolName === SKILLS_TOOL_ACTIVATE_SKILL) {
              // Extract skill name from the tool call input
              const skillName = (part.input as { skill: string })?.skill;
              if (!skillName) {
                continue;
              }

              // Find corresponding tool-result message
              const originalToolMsg = contextMessages.find(
                (m) => m.role === 'tool' && Array.isArray(m.content) && m.content.some((p) => p.type === 'tool-result' && p.toolCallId === part.toolCallId),
              );
              if (originalToolMsg) {
                // Find the tool result part
                const toolResultPart = (originalToolMsg.content as ToolContent).find((p) => p.type === 'tool-result' && p.toolCallId === part.toolCallId);
                if (toolResultPart) {
                  // Store the activation, overwriting any previous one for the same skill
                  // This keeps the most recent activation for each skill
                  skillActivations.set(skillName, {
                    toolCall: part,
                    assistantMsg: message,
                    toolMsg: originalToolMsg,
                    toolResultPart,
                  });
                }
              }
            }
          }
        }
      }
    }

    // Convert the deduplicated activations to the expected message format
    const skillMessages: ContextMessage[] = [];
    for (const { toolCall, assistantMsg, toolMsg, toolResultPart } of skillActivations.values()) {
      // Create a filtered assistant message that only contains the skill activation tool-call
      const filteredAssistantMsg: ContextMessage = {
        id: assistantMsg.id,
        role: assistantMsg.role as 'assistant',
        content: [toolCall],
        promptContext: assistantMsg.promptContext,
      };

      const filteredToolMsg: ContextMessage = {
        id: toolMsg.id,
        role: 'tool',
        content: [toolResultPart],
        promptContext: toolMsg.promptContext,
      };
      skillMessages.push(filteredAssistantMsg, filteredToolMsg);
    }

    return skillMessages;
  }

  public async compactConversation(
    mode: Mode,
    customInstructions?: string,
    profile: AgentProfile | null = null,
    contextMessages?: ContextMessage[],
    promptContext?: PromptContext,
    abortSignal?: AbortSignal,
    waitForAgentCompletion = true,
    loadingMessage = 'Compacting conversation...',
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

    const currentTaskState = this.task.state;
    await this.saveTask({
      state: DefaultTaskState.InProgress,
    });

    // Find skill activation messages before generating summary
    const skillMessages = this.findSkillActivationMessages(contextMessages);

    this.addLogMessage('loading', loadingMessage);
    this.isCompacting = true;

    const extractSummary = (content: string): string => {
      const lines = content.split('\n');
      const summaryMarker = '### **Conversation Summary**';
      const markerIndex = lines.findIndex((line) => line.trim() === summaryMarker);
      if (markerIndex !== -1) {
        return lines.slice(markerIndex).join('\n');
      }
      return content;
    };

    try {
      if (!AIDER_MODES.includes(mode)) {
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
          await this.promptsManager.getCompactConversationPrompt(this, customInstructions),
          'compact-conversation',
          promptContext,
          contextMessages,
          [],
          undefined,
          false,
          abortSignal,
        );
        if (waitForAgentCompletion) {
          this.resolveAgentRunPromises();
        }

        if (agentMessages.length > 0) {
          // Clear existing context and add the summary
          const summaryMessage = agentMessages[agentMessages.length - 1];
          summaryMessage.content = extractSummary(extractTextContent(summaryMessage.content));

          const finalMessages: ContextMessage[] = [userMessage, ...skillMessages, summaryMessage];

          this.contextManager.setContextMessages(finalMessages);

          await this.contextManager.loadMessages(await this.contextManager.getContextMessages());
        }
      } else {
        const responses = await this.sendPromptToAider(
          await this.promptsManager.getCompactConversationPrompt(this, customInstructions),
          undefined,
          'ask',
          undefined,
          [],
          undefined,
        );

        // Collect all new messages before setting the context
        const newMessages: ContextMessage[] = [userMessage];
        for (const response of responses) {
          if (response.content) {
            newMessages.push({
              id: response.messageId,
              role: MessageRole.Assistant,
              content: extractSummary(response.content),
              promptContext,
            });
          }
        }

        // Create final messages array with skill activations inserted between user message and rest
        const finalMessages: ContextMessage[] = [userMessage, ...skillMessages, ...newMessages.slice(1)];

        // Set all messages at once
        this.contextManager.setContextMessages(finalMessages);

        await this.contextManager.loadMessages(await this.contextManager.getContextMessages());
      }

      await this.updateContextInfo();
      this.addLogMessage('info', 'Conversation compacted.');
    } catch (error) {
      logger.error('Failed to compact conversation', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        mode,
        error: error instanceof Error ? error.message : String(error),
      });
      this.addLogMessage('error', 'Failed to compact conversation. Original conversation preserved.');
      // Prevent memory leaks by cleaning up pending prompt resources
      if (!AIDER_MODES.includes(mode) && waitForAgentCompletion) {
        this.resolveAgentRunPromises();
      } else if (AIDER_MODES.includes(mode)) {
        this.promptFinished();
      }
    } finally {
      this.isCompacting = false;
      await this.saveTask({
        state: currentTaskState,
      });

      await this.runNextQueuedPrompt();
    }
  }

  public async handoffConversation(
    mode: Mode,
    focus: string = '',
    execute = false,
    contextMessages?: ContextMessage[],
    waitForAgentCompletion = true,
    loadingMessage = 'Preparing handoff...',
  ): Promise<void> {
    if (!contextMessages) {
      // Get context messages
      contextMessages = await this.contextManager.getContextMessages();
      const userMessage = contextMessages[0];

      if (!userMessage) {
        throw new Error('No conversation to handoff. Please send at least one message before using /handoff.');
      }
    }

    this.addLogMessage('loading', loadingMessage, false, undefined, ['interrupt']);

    // Get context files to transfer
    const contextFiles = await this.getContextFiles();

    // Generate the handoff prompt using agent.generateText
    const handoffPrompt = await this.promptsManager.getHandoffPrompt(this, focus.trim().length ? focus.trim() : undefined);
    let generatedPrompt: string | undefined;

    if (!AIDER_MODES.includes(mode)) {
      // Agent mode logic
      const profile = await this.getTaskAgentProfile();
      if (!profile) {
        throw new Error('No active Agent profile found');
      }

      const handoffAgentProfile: AgentProfile = {
        ...HANDOFF_AGENT_PROFILE,
        provider: profile.provider,
        model: profile.model,
      };

      if (waitForAgentCompletion) {
        await this.waitForCurrentAgentToFinish();
      }
      generatedPrompt = await this.agent.generateText(
        `${handoffAgentProfile.provider}/${handoffAgentProfile.model}`,
        '',
        handoffPrompt,
        this.getProjectDir(),
        await this.contextManager.getContextMessages(),
        true,
      );
    } else {
      // Other modes (ask, edit)
      const responses = await this.sendPromptToAider(handoffPrompt, undefined, 'ask');

      if (responses.length > 0 && responses[0].content) {
        generatedPrompt = extractTextContent(responses[0].content);
      }
    }

    this.addLogMessage('loading', '', true);

    if (!generatedPrompt) {
      logger.warn('Handoff prompt generation cancelled or failed.');
      return;
    }

    // Create new task without sending event (sendEvent flag defaults to true)
    const newTaskData = await this.project.createNewTask({
      parentId: this.task.parentId || this.taskId,
      sendEvent: false,
      autoApprove: execute ? this.task.autoApprove : undefined,
      activate: true,
    });

    // Get the newly created Task instance
    const newTask = this.project.getTask(newTaskData.id);
    if (!newTask) {
      throw new Error('Failed to get newly created task');
    }

    await newTask.init();

    // Add prompt to new task
    await newTask.savePromptOnly(generatedPrompt, false);

    // Transfer context files
    await newTask.addFiles(...contextFiles);

    if (execute) {
      await newTask.resumeTask();
    }

    // Send task-created event to trigger activation and handoff
    this.eventManager.sendTaskCreated(newTask.task, true);
  }

  public async generateContextMarkdown(): Promise<string | null> {
    logger.info('Exporting context to Markdown:', {
      baseDir: this.project.baseDir,
    });
    return await this.contextManager.generateContextMarkdown();
  }

  updateTokensInfo(data: Partial<TokensInfoData>) {
    this.tokensInfo = {
      ...this.tokensInfo,
      ...data,
    };

    this.eventManager.sendUpdateTokensInfo(this.tokensInfo);
  }

  async updateContextInfo(checkContextFilesIncluded = false, checkRepoMapIncluded = false) {
    void this.debouncedUpdateContextInfo(checkContextFilesIncluded, checkRepoMapIncluded);
  }

  private debouncedUpdateContextInfo = debounce(async (checkContextFilesIncluded = false, checkRepoMapIncluded = false) => {
    void this.sendRequestContextInfo();
    await this.updateAgentEstimatedTokens(checkContextFilesIncluded, checkRepoMapIncluded);
  }, 500);

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
    const proxyChanged = oldSettings.proxy?.enabled !== newSettings.proxy?.enabled || oldSettings.proxy?.url !== newSettings.proxy?.url;

    if (
      (aiderOptionsChanged || aiderAutoCommitsChanged || aiderWatchFilesChanged || aiderCachingEnabledChanged || aiderConfirmBeforeEditChanged) &&
      (await this.shouldStartAider())
    ) {
      logger.debug('Aider options changed, restarting Aider.');
      void this.aiderManager.start(true);
    } else if (aiderEnvVarsChanged || proxyChanged) {
      logger.debug('Aider environment variables changed, updating connectors.');
      const updatedEnvironmentVariables = {
        ...getEnvironmentVariablesForAider(newSettings, this.project.baseDir),
        ...getProxyEnvVars(newSettings),
      };
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

  async initProjectAgentsFile(args?: string): Promise<void> {
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

      const systemPrompt = await this.promptsManager.getInitProjectSystemPrompt(this);
      const userPrompt = args ? `/init ${args}` : '/init';

      // Run the agent with the modified profile, using init-project template as system prompt
      await this.runPromptInAgent(initProjectRulesAgentProfile, 'init-project-agents-file', userPrompt, { id: uuidv4() }, undefined, undefined, systemPrompt);

      // Check if the AGENTS.md file was created
      const projectAgentsPath = path.join(this.project.baseDir, 'AGENTS.md');
      const projectAgentsFileExists = await fileExists(projectAgentsPath);

      if (projectAgentsFileExists) {
        logger.info('AGENTS.md file created successfully', {
          path: projectAgentsPath,
        });
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

  private async runExtensionCommand(extensionCommand: RegisteredCommand, args: string[], mode: Mode): Promise<void> {
    const { command } = extensionCommand;

    logger.info('Running extension command:', {
      commandName: command.name,
      args,
    });
    this.telemetryManager.captureCustomCommand(command.name, args.length, mode);

    try {
      // Execute the command - extension is fully responsible for its logic
      await this.extensionManager.executeCommand(command.name, args, this.project, this);
    } catch (error) {
      logger.error('Extension command execution failed:', error);
      this.addLogMessage('error', `Extension command failed: ${error instanceof Error ? error.message : String(error)}`);
      this.eventManager.sendCustomCommandError(this.project.baseDir, this.taskId, `Extension command execution failed: ${command.name}`);
    }

    await this.project.addToInputHistory(`/${command.name}${args.length > 0 ? ' ' + args.join(' ') : ''}`);
  }

  public async runCustomCommand(commandName: string, args: string[], mode: Mode = 'agent'): Promise<void> {
    // First, check if this is an extension command
    const extensionCommand = this.extensionManager.getCommands(this.project).find((c) => c.command.name === commandName);

    if (extensionCommand) {
      // Handle extension command execution
      await this.runExtensionCommand(extensionCommand, args, mode);
      return;
    }

    // Fall back to file-based custom command
    let command = this.customCommandManager.getCommand(commandName);
    if (!command) {
      this.addLogMessage('error', `Custom command '${commandName}' not found.`);
      this.eventManager.sendCustomCommandError(this.project.baseDir, this.taskId, `Invalid command: ${commandName}`);
      return;
    }

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

    const extensionResult = await this.extensionManager.dispatchEvent('onCustomCommandExecuted', { command, mode }, this.project, this);
    if (extensionResult.blocked) {
      logger.debug('Custom command execution blocked by extension');
      this.addLogMessage('loading', '', true);
      return;
    }

    let prompt = extensionResult.prompt;
    command = extensionResult.command;
    mode = extensionResult.mode;

    logger.info('Running custom command:', { commandName, args, mode });
    this.telemetryManager.captureCustomCommand(commandName, args.length, mode);

    if (!prompt) {
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
    }

    await this.project.addToInputHistory(`/${commandName}${args.length > 0 ? ' ' + args.join(' ') : ''}`);

    const promptContext: PromptContext = {
      id: uuidv4(),
    };

    this.addUserMessage(promptContext.id, prompt);
    this.addLogMessage('loading', 'Executing custom command...');

    try {
      if (!AIDER_MODES.includes(mode)) {
        // Agent mode logic
        const profile = await this.getTaskAgentProfile();
        if (!profile) {
          this.addLogMessage('error', 'No active Agent profile found');
          return;
        }

        const systemPrompt = await this.promptsManager.getSystemPrompt(this.store.getSettings(), this, profile, command.autoApprove ?? this.task.autoApprove);

        const messages = command.includeContext === false ? [] : undefined;
        const contextFiles = command.includeContext === false ? [] : undefined;
        await this.runPromptInAgent(profile, mode, prompt, promptContext, messages, contextFiles, systemPrompt);
      } else {
        // All other modes (code, ask, architect)
        await this.runPromptInAider(mode, prompt, promptContext);
      }
    } finally {
      // Clear loading message after execution completes (success or failure)
      this.addLogMessage('loading', '', true);
    }
  }

  async reset() {
    if (!this.initialized) {
      return;
    }

    await this.interruptResponse();
    await this.close(false, false);
    await this.init();
    if (this.task.createdAt) {
      await this.saveTask({
        aiderTotalCost: 0,
        agentTotalCost: 0,
        state: DefaultTaskState.Todo,
      });
    }
    await this.updateContextInfo();
  }

  public async updateTask(updates: Partial<TaskData>): Promise<TaskData> {
    const previousTaskString = JSON.stringify(this.task);

    // Handle worktree configuration changes
    if (updates.workingMode !== undefined && updates.workingMode !== this.task.workingMode) {
      if (!(await this.applyWorkingMode(updates.workingMode))) {
        return this.task;
      }
    }

    // Check if currentMode changed and start aider if new mode requires it
    const oldMode = this.getCurrentMode();
    if (updates.currentMode !== undefined && updates.currentMode !== oldMode && AIDER_MODES.includes(updates.currentMode)) {
      logger.debug('Task currentMode changed to aider-requiring mode, starting Aider.', {
        oldMode,
        newMode: updates.currentMode,
        baseDir: this.project.baseDir,
        taskId: this.taskId,
      });
      void this.aiderManager.start();
    }

    for (const key of Object.keys(updates)) {
      this.task[key] = updates[key];
    }

    if (updates.agentProfileId !== undefined) {
      void this.updateAgentEstimatedTokens();
      if (await this.shouldStartAider()) {
        void this.aiderManager.start();
      }
    }

    // setting a name will also save the task
    if (!this.task.createdAt && 'name' in updates) {
      this.task.createdAt = new Date().toISOString();
    }

    // no need to save if nothing changed
    if (previousTaskString === JSON.stringify(this.task)) {
      logger.debug('Task update prevented because no changes were detected', {
        baseDir: this.project.baseDir,
        taskId: this.taskId,
        updates,
      });
      return this.task;
    }

    this.task.updatedAt = new Date().toISOString();

    return this.saveTask(updates, !!this.task.createdAt);
  }

  private async sendWorktreeIntegrationStatusUpdated() {
    this.eventManager.sendWorktreeIntegrationStatusUpdated(this.project.baseDir, this.taskId, await this.getWorktreeIntegrationStatus());
  }

  private async sendUpdatedFilesUpdated() {
    const updatedFiles = await this.getUpdatedFiles();
    logger.debug('Sending updated files', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      updatedFiles: updatedFiles.map((f) => f.path),
    });
    this.eventManager.sendUpdatedFilesUpdated(this.project.baseDir, this.taskId, updatedFiles);
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

        const settings = this.store.getSettings();
        if (settings.taskSettings.worktreeSymlinkFolders && settings.taskSettings.worktreeSymlinkFolders.length > 0) {
          await this.worktreeManager.createSymlinks(this.project.baseDir, this.task.worktree.path, settings.taskSettings.worktreeSymlinkFolders);
        }
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
    if (await this.shouldStartAider()) {
      await this.aiderManager.start(true);
    }

    void this.sendUpdatedFilesUpdated();
    void this.sendWorktreeIntegrationStatusUpdated();

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
            const settings = this.store.getSettings();
            const modelId = this.getAuxiliaryModelId(agentProfile, settings.taskSettings.commitMessageModel);
            try {
              effectiveCommitMessage = await this.agent.generateText(
                modelId,
                await this.promptsManager.getGenerateCommitMessageSystemPrompt(this),
                `Generate a concise conventional commit message for these changes:\n\n${changesDiff}\n\nOnly answer with the commit message, nothing else.`,
                this.getProjectDir(),
                undefined,
                false,
              );
              logger.info('Generated commit message:', {
                commitMessage: effectiveCommitMessage,
              });
            } catch (error) {
              logger.warn('Failed to generate AI commit message, falling back to task name:', error);
              // Fallback to task name if AI generation fails
              effectiveCommitMessage = this.task.name || `Task ${this.taskId} changes`;
            }
          } else {
            logger.warn('No active agent profile found, using task name for commit message');
          }
        }
      }

      const settings = this.store.getSettings();
      const symlinkFolders = settings.taskSettings.worktreeSymlinkFolders || [];

      const mergeState = await this.worktreeManager.mergeWorktreeToMainWithUncommitted(
        this.project.baseDir,
        this.task.id,
        this.task.worktree.path,
        squash,
        effectiveCommitMessage || this.task.name || `Task ${this.taskId} changes`,
        targetBranch,
        symlinkFolders,
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

    await this.sendUpdatedFilesUpdated();
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

      const settings = this.store.getSettings();
      const symlinkFolders = settings.taskSettings.worktreeSymlinkFolders || [];

      await this.worktreeManager.applyUncommittedChangesToMain(
        this.project.baseDir,
        this.task.id,
        this.task.worktree.path,
        effectiveTargetBranch,
        symlinkFolders,
      );

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

    await this.sendUpdatedFilesUpdated();
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

      const settings = this.store.getSettings();
      const symlinkFolders = settings.taskSettings.worktreeSymlinkFolders || [];

      await this.worktreeManager.revertMerge(this.project.baseDir, this.task.id, this.task.worktree.path, this.task.lastMergeState, symlinkFolders);

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

    await this.sendUpdatedFilesUpdated();
    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async restoreFile(filePath: string): Promise<void> {
    logger.info('Restoring file', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      filePath,
    });

    await this.worktreeManager.restoreFile(this.getTaskDir(), filePath);
    await this.sendUpdatedFilesUpdated();
    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async generateCommitMessage(): Promise<string> {
    logger.info('Generating commit message', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
    });

    const taskDir = this.getTaskDir();
    const diff = await this.worktreeManager.getUncommittedDiff(taskDir);

    if (!diff) {
      throw new Error('No uncommitted changes to commit');
    }

    const agentProfile = await this.getTaskAgentProfile();
    if (!agentProfile) {
      throw new Error('No agent profile configured');
    }

    const settings = this.store.getSettings();
    const modelId = this.getAuxiliaryModelId(agentProfile, settings.taskSettings.commitMessageModel);

    // Get last 10 commit messages for context
    let commitHistoryText = '';
    try {
      const commits = await this.worktreeManager.getLastCommits(taskDir, 10, false);
      if (commits.length > 0) {
        const commitMessages = commits.map((commit) => commit.message);
        commitHistoryText = `\n\nHere are the last ${commits.length} commit messages for reference:\n\n${commitMessages.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}`;
      }
    } catch (error) {
      logger.warn('Failed to get commit history:', error);
      // Continue without commit history
    }

    const commitMessage = await this.agent.generateText(
      modelId,
      await this.promptsManager.getGenerateCommitMessageSystemPrompt(this),
      `Here is the git diff of uncommitted changes:\n\n\`\`\`diff\n${diff}\n\`\`\`${commitHistoryText}`,
      this.getProjectDir(),
      undefined,
      false,
    );

    if (!commitMessage) {
      throw new Error('Failed to generate commit message');
    }

    return commitMessage.trim();
  }

  public async commitChanges(message: string, amend: boolean): Promise<void> {
    logger.info('Committing changes', {
      baseDir: this.project.baseDir,
      taskId: this.taskId,
      amend,
    });

    const taskDir = this.getTaskDir();
    await this.worktreeManager.commitChanges(taskDir, message, amend);
    await this.sendUpdatedFilesUpdated();
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
      currentBranch: this.task.worktree.baseBranch || '',
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
      const { success, error } = await this.worktreeManager.rebaseMainIntoWorktree(this.task.worktree.path, effectiveFromBranch);

      if (success) {
        this.addLogMessage('info', 'Worktree rebased successfully', true);
        return;
      }

      if (error) {
        this.addLogMessage('loading', undefined, true);
        const isConflict = error.gitOutput?.includes('Resolve all conflicts');
        if (!isConflict) {
          this.addLogMessage('error', error.getErrorDetails(), true);
        }
      }
    } catch (error) {
      this.addLogMessage('loading', undefined, true);
      logger.error('Failed to rebase worktree:', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await this.sendWorktreeIntegrationStatusUpdated();
      await this.sendUpdatedFilesUpdated();
    }
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

    await this.sendUpdatedFilesUpdated();
    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async renameWorktreeBranch(newBranchName: string): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    const oldBranchName = this.task.worktree.baseBranch;
    if (!oldBranchName) {
      throw new Error('Cannot determine current branch name');
    }

    const actualBranchName = await this.worktreeManager.renameBranch(this.project.baseDir, oldBranchName, newBranchName);
    this.task.worktree.baseBranch = actualBranchName;
    await this.saveTask({ worktree: this.task.worktree });
    void this.sendWorktreeIntegrationStatusUpdated();
  }

  private async executeConflictResolution(directoryPath: string, directoryName: string): Promise<void> {
    const activeProfile = await this.getTaskAgentProfile();
    if (!activeProfile) {
      throw new Error('No active agent profile found');
    }

    const previousTaskState = this.task.state;
    await this.saveTask({ state: DefaultTaskState.InProgress });

    try {
      this.addLogMessage('loading', `Resolving conflicts in ${directoryName}...`);

      const files = await this.worktreeManager.listConflictedFiles(directoryPath);
      if (files.length === 0) {
        this.addLogMessage('info', 'No conflicted files found', true);
        return;
      }

      const conflictProfile: AgentProfile = {
        ...CONFLICT_RESOLUTION_PROFILE,
        provider: activeProfile.provider,
        model: activeProfile.model,
      };

      let interruptedCount = 0;

      const resolutionPromises = files.map(async (filePath) => {
        const interruptId = uuidv4();
        const abortController = new AbortController();
        this.resolutionAbortControllers[interruptId] = abortController;

        const promptContext: PromptContext = {
          id: uuidv4(),
          group: {
            id: uuidv4(),
            color: 'var(--color-agent-conflict-resolution)',
            name: `Resolving ${filePath}...`,
            finished: false,
            interruptId,
          },
        };

        this.addLogMessage('loading', `Resolving ${filePath}...`, false, promptContext);

        const ctx = await this.worktreeManager.collectConflictContext(directoryPath, filePath);

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
          const prompt = await this.promptsManager.getConflictResolutionPrompt(this, filePath, {
            ...ctx,
            basePath: ctx.base ? basePath : undefined,
            oursPath: ctx.ours ? oursPath : undefined,
            theirsPath: ctx.theirs ? theirsPath : undefined,
          });
          const systemPrompt = await this.promptsManager.getConflictResolutionSystemPrompt(this);

          await this.agent.runAgent(
            this,
            conflictProfile,
            prompt,
            'conflict-resolution',
            promptContext,
            [],
            [{ path: filePath }],
            systemPrompt,
            false,
            abortController.signal,
          );

          // Update context based on whether it was interrupted or resolved
          if (promptContext.group) {
            if (abortController.signal.aborted) {
              promptContext.group.name = `Resolution of ${filePath} interrupted`;
              promptContext.group.finished = true;
              this.addLogMessage('warning', `Resolution of ${filePath} interrupted`, true, promptContext);
              interruptedCount++;
            } else {
              promptContext.group.name = `Resolved ${filePath}`;
              promptContext.group.finished = true;
              this.addLogMessage('info', `Resolved ${filePath}`, true, promptContext);

              // Stage the file
              await execWithShellPath(`git add -- "${filePath}"`, {
                cwd: directoryPath,
              });
            }
          }
        } finally {
          // Clean up temp files
          await Promise.allSettled([fs.unlink(basePath).catch(() => {}), fs.unlink(oursPath).catch(() => {}), fs.unlink(theirsPath).catch(() => {})]);
          // Clean up abort controller
          delete this.resolutionAbortControllers[interruptId];
        }
      });

      await Promise.all(resolutionPromises);

      if (interruptedCount > 0 && interruptedCount < files.length) {
        this.addLogMessage('warning', 'Some conflicts were resolved, but some were interrupted. You can continue the rebase.', true, undefined, []);
      }
    } catch (error) {
      logger.error('Failed to resolve conflicts with agent:', error);
      this.addLogMessage(
        'error',
        error instanceof GitError
          ? error.getErrorDetails()
          : `Failed to resolve conflicts with agent: ${error instanceof Error ? error.message : String(error)}`,
        true,
      );
    } finally {
      await this.saveTask({ state: previousTaskState });
    }

    await this.sendWorktreeIntegrationStatusUpdated();
  }

  public async resolveConflictsWithAgent(): Promise<void> {
    await this.waitForCurrentPromptToFinish();

    // Check worktree first
    if (this.task.worktree) {
      const worktreePath = this.task.worktree.path;
      const worktreeRebaseState = await this.worktreeManager.getRebaseState(worktreePath);

      if (worktreeRebaseState.hasUnmergedPaths) {
        logger.info('Conflicts found in worktree, resolving...', {
          worktreePath,
        });
        await this.executeConflictResolution(worktreePath, 'worktree');
        return;
      }
    }

    // Check main repository
    const baseDir = this.project.baseDir;
    const baseRebaseState = await this.worktreeManager.getRebaseState(baseDir);

    if (baseRebaseState.hasUnmergedPaths) {
      logger.info('Conflicts found in main repository, resolving...', {
        baseDir,
      });
      await this.executeConflictResolution(baseDir, 'main repository');
      return;
    }

    // No conflicts found
    this.addLogMessage('info', 'No merge conflicts found in either worktree or main repository.', true);
  }

  public async continueWorktreeRebase(): Promise<void> {
    if (!this.task.worktree) {
      throw new Error('No worktree exists for this task');
    }

    await this.waitForCurrentPromptToFinish();

    try {
      this.addLogMessage('loading', 'Continuing rebase...');
      await this.worktreeManager.continueRebase(this.task.worktree.path);

      // Clear any remaining merge state after successful rebase continuation
      await this.saveTask({ lastMergeState: undefined });

      this.addLogMessage('info', 'Rebase completed', true);
    } catch (error) {
      logger.error('Failed to continue rebase:', error);

      const isConflict = error instanceof GitError && error.gitOutput?.includes('Resolve all conflicts manually');

      if (!isConflict) {
        this.addLogMessage(
          'error',
          error instanceof GitError ? error.getErrorDetails() : `Failed to continue rebase: ${error instanceof Error ? error.message : String(error)}`,
          true,
        );
      }
    }

    await this.sendUpdatedFilesUpdated();
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
    await this.addFiles(...contextFiles);

    // Copy messages
    const messages = await sourceTask.getContextMessages();
    this.contextManager.setContextMessages(messages);

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

  public async forkFrom(sourceTask: Task, messageId: string): Promise<void> {
    // Copy basic task data
    const sourceData = sourceTask.task;
    await this.saveTask({
      name: `${sourceData.name} (Fork)`,
    });

    // Copy ALL context files from source task (not just up to fork point)
    const contextFiles = await sourceTask.getContextFiles();
    await this.addFiles(...contextFiles);

    // Get messages up to and including the specified message
    const forkedMessages = sourceTask.contextManager.getMessagesUpTo(messageId);

    // Save forked messages into new task
    this.contextManager.setContextMessages(forkedMessages);

    await this.updateContextInfo();

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
      if (await this.shouldStartAider()) {
        void this.aiderManager.start();
      }
    }
  }

  public getProject(): Project {
    return this.project;
  }

  public isInitialized() {
    return this.initialized;
  }

  public async generateText(modelId: string, systemPrompt: string, prompt: string): Promise<string | undefined> {
    return this.agent.generateText(modelId, systemPrompt, prompt, this.getProjectDir());
  }

  async runCodeChangeRequests(requests: ChangeRequestItem[], contextSize: number = 5, createNewTask?: boolean): Promise<void> {
    const mode = this.getCurrentMode();

    const promptRequests = await Promise.all(
      requests.map(async (request) => {
        const filePath = path.isAbsolute(request.filename) ? request.filename : path.join(this.getTaskDir(), request.filename);
        const fileExtension = path.extname(request.filename).slice(1) || '';

        let contextLines: { lineNumber: number; content: string }[] = [];
        try {
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const lines = fileContent.split('\n');
          const startLine = Math.max(0, request.lineNumber - contextSize - 1);
          const endLine = Math.min(lines.length, request.lineNumber + contextSize);

          contextLines = lines.slice(startLine, endLine).map((content, index) => ({
            lineNumber: startLine + index + 1,
            content,
          }));
        } catch (error) {
          logger.warn('Failed to read file for context extraction', {
            filePath,
            error,
          });
        }

        return {
          filename: request.filename,
          lineNumber: request.lineNumber,
          fileExtension,
          contextLines,
          userComment: request.userComment,
        };
      }),
    );

    const prompt = await this.promptsManager.getCodeChangeRequestsPrompt(this, {
      requests: promptRequests,
    });

    if (!createNewTask) {
      const uniqueFiles = [...new Set(requests.map((r) => r.filename))];
      if (AIDER_MODES.includes(mode)) {
        for (const filename of uniqueFiles) {
          await this.addFiles({ path: filename });
        }
      }

      void this.runPrompt(prompt, mode, false);
      return;
    }

    const taskName = requests.length === 1 ? `${requests[0].filename}:${requests[0].lineNumber}` : `${requests.length} change requests`;

    const newTaskData = await this.project.createNewTask({
      name: taskName,
      sendEvent: false,
      autoApprove: true,
      activate: true,
      mode,
      parentId: this.task.parentId || this.taskId,
      addInitialContextFiles: false,
    });

    const newTask = this.project.getTask(newTaskData.id);
    if (!newTask) {
      throw new Error('Failed to get newly created task');
    }

    await newTask.init();
    if (AIDER_MODES.includes(mode)) {
      const uniqueFiles = [...new Set(requests.map((r) => r.filename))];
      for (const filename of uniqueFiles) {
        await newTask.addFiles({ path: filename });
      }
    }

    this.eventManager.sendTaskCreated(newTask.task, true);

    void newTask.runPrompt(prompt, mode, false);
  }
}

import { z } from 'zod';
import {
  AgentProfile,
  CommandArgument,
  CommandsData,
  ConnectorMessage,
  ContextFile,
  ContextMessage,
  CreateTaskParams,
  CustomCommand,
  Mode,
  ModeDefinition,
  Model,
  ProjectSettings,
  PromptContext,
  QuestionData,
  QueuedPromptData,
  ResponseChunkData,
  ResponseCompletedData,
  TaskData,
  TodoItem,
  UpdatedFile,
  UsageReportData,
  SettingsData,
  ProviderProfile,
} from '@common/types';

export type AgentStepResult = unknown;
export type { ModeDefinition };

export const AIDER_DESK_EXTENSIONS_REPO_URL = 'https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/';

export interface ResponseMessage {
  id: string;
  content: string;
  reflectedMessage?: string;
  finished: boolean;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

/**
 * Metadata describing an extension
 */
export interface ExtensionMetadata {
  /** Extension name (displayed in UI) */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Brief description of extension functionality */
  description?: string;
  /** Author name or organization */
  author?: string;
  /** Optional list of extension capabilities (e.g., ["tools", "ui-elements"]) */
  capabilities?: string[];
}

/**
 * Result returned by tool execution
 */
export interface ToolResult {
  /** Content array with text or image data */
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: unknown }>;
  /** Additional metadata for extensions */
  details?: Record<string, unknown>;
  /** Mark result as error */
  isError?: boolean;
}

/**
 * Definition of a tool that can be registered by an extension
 *
 * @example
 * ```typescript
 * const myTool: ToolDefinition = {
 *   name: 'run-linter',
 *   description: 'Run the project linter',
 *   parameters: z.object({
 *     fix: z.boolean().optional().describe('Auto-fix issues'),
 *   }),
 *   async execute(input, signal, context) {
 *     const output = await runLinter(input.fix);
 *     return output;
 *   },
 * };
 * ```
 */
export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType<Record<string, unknown>>> {
  /** Tool identifier in kebab-case (e.g., 'run-linter') */
  name: string;
  /** Description for LLM to understand tool purpose */
  description: string;
  /** Zod schema for parameter validation */
  inputSchema: TSchema;
  /** Execute function with type-safe args */
  execute: (input: z.infer<TSchema>, signal: AbortSignal | undefined, context: ExtensionContext) => Promise<unknown>;
}

/** UI element types */
export type UIElementType = 'action-button' | 'status-indicator' | 'badge';

/** Placement locations for UI elements */
export enum UIPlacement {
  /** Task sidebar area */
  TaskSidebar = 'task-sidebar',
  /** Chat toolbar area */
  ChatToolbar = 'chat-toolbar',
  /** Message action buttons */
  MessageActions = 'message-actions',
  /** Global toolbar */
  GlobalToolbar = 'global-toolbar',
}

/**
 * Definition of a UI element that can be registered by an extension
 *
 * @example
 * ```typescript
 * const myButton: UIElementDefinition = {
 *   id: 'generate-jira-ticket',
 *   type: 'action-button',
 *   label: 'Create JIRA Ticket',
 *   icon: 'FiExternalLink',
 *   description: 'Create a JIRA ticket from this task',
 *   placement: UIPlacement.TaskSidebar,
 *   context: 'task',
 *   onClick: 'handleJiraClick',
 * };
 * ```
 */
export interface UIElementDefinition {
  /** Unique element identifier in kebab-case */
  id: string;
  /** Element type (button, status indicator, etc.) */
  type: UIElementType;
  /** Display text for button or label */
  label: string;
  /** Optional icon name from react-icons library */
  icon?: string;
  /** Optional tooltip or help text */
  description?: string;
  /** Where in UI to render this element */
  placement: UIPlacement;
  /** Context type (task, project, global) */
  context?: 'task' | 'project' | 'global';
  /** Handler ID to call in extension when clicked */
  onClick: string;
  /** Optional: Conditional visibility check */
  enabled?: (context: unknown) => boolean;
}

/**
 * Definition of a command that can be registered by an extension
 *
 * Extension commands are fully responsible for their own execution logic.
 * The execute function should handle everything including:
 * - Processing arguments
 * - Performing any operations (file I/O, API calls, etc.)
 * - Sending prompts to agent/aider if needed via context methods
 * - Displaying results to the user
 *
 * @example
 * ```typescript
 * const myCommand: CommandDefinition = {
 *   name: 'generate-tests',
 *   description: 'Generate unit tests for the current file',
 *   arguments: [
 *     { description: 'File path to generate tests for', required: true },
 *     { description: 'Test framework (jest, vitest, mocha)', required: false }
 *   ],
 *   async execute(args, context) {
 *     const filePath = args[0];
 *     const framework = args[1] || 'vitest';
 *
 *     // Read file, process it, send prompt to agent, etc.
 *     const fileContent = await readFile(filePath);
 *     const prompt = `Generate tests for ${filePath} using ${framework}...`;
 *
 *     // Extension handles sending the prompt
 *     // (context would provide methods to do this)
 *   },
 * };
 * ```
 */
export interface CommandDefinition {
  /** Command name in kebab-case (e.g., 'generate-tests') */
  name: string;
  /** Description shown in autocomplete */
  description: string;
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Execute function that handles the complete command logic */
  execute: (args: string[], context: ExtensionContext) => Promise<void>;
}

// Event Payload Interfaces

/** Event payload for task creation events */
export interface TaskCreatedEvent {
  task: TaskData;
}

/** Event payload for task prepared events */
export interface TaskPreparedEvent {
  task: TaskData;
}

/** Event payload for task initialization events */
export interface TaskInitializedEvent {
  readonly task: TaskData;
}

/** Event payload for task closed events */
export interface TaskClosedEvent {
  readonly task: TaskData;
}

/** Event payload for task updated events */
export interface TaskUpdatedEvent {
  task: TaskData;
}

/** Event payload for project opened events */
export interface ProjectStartedEvent {
  readonly baseDir: string;
}

/** Event payload for project closed events */
export interface ProjectStoppedEvent {
  readonly baseDir: string;
}

/** Event payload for prompt started events */
export interface PromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  blocked?: boolean;
}

/** Event payload for prompt finished events */
export interface PromptFinishedEvent {
  responses: ResponseCompletedData[];
}

/** Event payload for prompt template events */
export interface PromptTemplateEvent {
  /** Template name (e.g., 'system-prompt', 'init-project', etc.) */
  readonly name: string;
  /** Template data object */
  readonly data: unknown;
  /** Rendered prompt that can be overridden by extension */
  prompt: string;
}

/** Event payload for agent started events */
export interface AgentStartedEvent {
  readonly mode: Mode;
  prompt: string | null;
  agentProfile: AgentProfile;
  providerProfile: ProviderProfile;
  model: string;
  promptContext?: PromptContext;
  systemPrompt: string | undefined;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
  blocked?: boolean;
}

/** Event payload for agent finished events */
export interface AgentFinishedEvent {
  readonly mode: Mode;
  readonly aborted: boolean;
  readonly contextMessages: ContextMessage[];
  resultMessages: ContextMessage[];
}

/** Event payload for agent step finished events */
export interface AgentStepFinishedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly stepResult: AgentStepResult;
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
  responseMessages: ContextMessage[];
}

/** Event payload for message optimization events */
export interface OptimizeMessagesEvent {
  readonly originalMessages: ContextMessage[];
  optimizedMessages: ContextMessage[];
}

/** Event payload for important reminders events */
export interface ImportantRemindersEvent {
  readonly profile: AgentProfile;
  remindersContent: string;
}

/** Event payload for tool approval events */
export interface ToolApprovalEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  blocked?: boolean;
  allowed?: boolean;
}

/** Event payload for tool called events */
export interface ToolCalledEvent {
  readonly toolName: string;
  readonly abortSignal?: AbortSignal;
  input: Record<string, unknown> | undefined;
  output?: unknown;
}

/** Event payload for tool finished events */
export interface ToolFinishedEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  output: unknown;
}

/** Event payload for files added events */
export interface FilesAddedEvent {
  files: ContextFile[];
}

/** Event payload for files dropped events */
export interface FilesDroppedEvent {
  files: ContextFile[];
}

/** Event payload for rule files retrieved events */
export interface RuleFilesRetrievedEvent {
  files: ContextFile[];
}

/** Event payload for response message processed events */
export interface ResponseChunkEvent {
  chunk: ResponseChunkData;
}

export interface ResponseCompletedEvent {
  response: ResponseCompletedData;
}

export interface HandleApprovalEvent {
  key: string;
  text: string;
  subject?: string;
  blocked?: boolean;
  allowed?: boolean;
}

/** Event payload for subagent started events */
export interface SubagentStartedEvent {
  subagentProfile: AgentProfile;
  prompt: string;
  promptContext?: PromptContext;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
  systemPrompt?: string;
  blocked?: boolean;
}

/** Event payload for subagent finished events */
export interface SubagentFinishedEvent {
  readonly subagentProfile: AgentProfile;
  resultMessages: ContextMessage[];
}

/** Event payload for question asked events */
export interface QuestionAskedEvent {
  question: QuestionData;
  answer?: string;
}

/** Event payload for question answered events */
export interface QuestionAnsweredEvent {
  readonly question: QuestionData;
  answer: string;
  userInput?: string;
}

/** Event payload for command executed events */
export interface CommandExecutedEvent {
  command: string;
  blocked?: boolean;
}

/** Event payload for custom command executed events */
export interface CustomCommandExecutedEvent {
  command: CustomCommand;
  mode: Mode;
  blocked?: boolean;
  prompt?: string;
}

/** Event payload for aider prompt started events */
export interface AiderPromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  messages: ConnectorMessage[];
  files: ContextFile[];
  blocked?: boolean;
  autoApprove?: boolean;
  denyCommands?: boolean;
}

/** Event payload for aider prompt finished events */
export interface AiderPromptFinishedEvent {
  responses: ResponseCompletedData[];
}

/** Options for asking questions to the user */
export interface QuestionOptions {
  subject?: string;
  answers?: Array<{ text: string; shortkey: string }>;
  defaultAnswer?: string;
}

/**
 * Safe subset of Task capabilities exposed to extensions.
 * Provides read-only access to task data and safe operations.
 */
export interface TaskContext {
  // Task Data (read-only access to all task properties)
  readonly data: TaskData;

  // Context Files (Read + Safe Write)
  getContextFiles(): Promise<ContextFile[]>;
  addFile(path: string, readOnly?: boolean): Promise<void>;
  addFiles(...files: ContextFile[]): Promise<void>;
  dropFile(path: string): Promise<void>;

  // Data Context Messages (Read + Safe Write)
  getContextMessages(): Promise<ContextMessage[]>;
  addContextMessage(message: ContextMessage, updateContextInfo?: boolean): Promise<void>;
  removeMessage(messageId: string): Promise<void>;
  removeLastMessage(): Promise<void>;
  removeMessagesUpTo(messageId: string): Promise<void>;
  loadContextMessages(messages: ContextMessage[]): Promise<void>;
  redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void>;

  // UI Context Messages
  addUserMessage(id: string, content: string, promptContext?: PromptContext): void;
  addToolMessage(
    id: string,
    serverName: string,
    toolName: string,
    input?: unknown,
    response?: string,
    usageReport?: UsageReportData,
    promptContext?: PromptContext,
    saveToDb?: boolean,
    finished?: boolean,
  ): void;
  addResponseMessage(message: ResponseMessage, saveToDb?: boolean): Promise<void>;

  // Files & Repo (Read-only)
  getTaskDir(): string;
  getAddableFiles(searchRegex?: string): Promise<string[]>;
  getAllFiles(useGit?: boolean): Promise<string[]>;
  getUpdatedFiles(): Promise<UpdatedFile[]>;
  getRepoMap(): string;
  addToGit(path: string): Promise<void>;

  // Todos (Read + Safe Write)
  getTodos(): Promise<TodoItem[]>;
  addTodo(name: string): Promise<TodoItem[]>;
  updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>;
  deleteTodo(name: string): Promise<TodoItem[]>;
  clearAllTodos(): Promise<TodoItem[]>;
  setTodos(items: TodoItem[], initialUserPrompt?: string): Promise<void>;

  // Execution
  runPrompt(prompt: string, mode?: string): Promise<void>;
  runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;
  runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;
  runCommand(command: string): Promise<void>;
  interruptResponse(): Promise<void>;
  generateText(agentProfile: AgentProfile, systemPrompt: string, prompt: string): Promise<string | undefined>;

  // User Interaction
  askQuestion(text: string, options?: QuestionOptions): Promise<string>;
  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void;
  addLoadingMessage(message?: string, finished?: boolean): void;

  // Task Management
  updateTask(updates: Partial<TaskData>): Promise<TaskData>;
  handoffConversation(focus?: string, execute?: boolean): Promise<void>;

  // Context Management
  clearContext(): Promise<void>;
  resetContext(): Promise<void>;
  compactConversation(instructions?: string): Promise<void>;
  generateContextMarkdown(): Promise<string | null>;
  isInitialized(): boolean;
  updateAutocompletionWords(words?: string[]): Promise<void>;

  // Queued Prompts
  getQueuedPrompts(): QueuedPromptData[];
  sendQueuedPromptNow(promptId: string): Promise<void>;
  removeQueuedPrompt(promptId: string): void;

  // Advanced Operations
  getTaskAgentProfile(): Promise<AgentProfile | null>;
  answerQuestion(answer: string, userInput?: string): Promise<boolean>;
}

/**
 * Safe subset of Project capabilities exposed to extensions.
 * Provides read-only access to project data and safe operations.
 */
export interface ProjectContext {
  // Identity
  readonly baseDir: string;

  // Task Management
  createTask(params: CreateTaskParams): Promise<TaskData>;
  getTask(taskId: string): TaskContext | null;
  getTasks(): Promise<TaskData[]>;
  getMostRecentTask(): TaskContext | null;
  forkTask(taskId: string, messageId: string): Promise<TaskData>;
  duplicateTask(taskId: string): Promise<TaskData>;
  deleteTask(taskId: string): Promise<void>;

  // Agent Profiles
  getAgentProfiles(): AgentProfile[];

  // Commands (Read-only)
  getCommands(): CommandsData;

  // Settings (Read-only)
  getProjectSettings(): ProjectSettings;

  // Input History (Read-only)
  getInputHistory(): Promise<string[]>;
}

/**
 * Context object passed to extension methods providing access to AiderDesk APIs
 *
 * @example
 * ```typescript
 * async onLoad(context: ExtensionContext) {
 *   const taskContext = context.getTaskContext();
 *   if (taskContext) {
 *     context.log(`Task: ${taskContext.data.name}`, 'info');
 *   }
 * }
 * ```
 */
export interface ExtensionContext {
  /**
   * Log a message to the AiderDesk console and log files
   * @param message - Message to log
   * @param type - Log level (info, error, warn, debug)
   */
  log(message: string, type?: 'info' | 'error' | 'warn' | 'debug'): void;

  /**
   * Get the current project directory path
   * @returns Absolute path to the project directory
   */
  getProjectDir(): string;

  /**
   * Get the current task context for safe task operations
   * @returns TaskContext or null if no task is active
   */
  getTaskContext(): TaskContext | null;

  /**
   * Get the project context for safe project operations
   * @returns ProjectContext
   */
  getProjectContext(): ProjectContext;

  /**
   * Get all available model configurations
   * @returns Promise resolving to array of models
   */
  getModelConfigs(): Promise<Model[]>;

  /**
   * Get a specific setting value
   * @param key - Setting key (dot-notation supported, e.g., 'general.theme')
   * @returns Promise resolving to the setting value
   */
  getSetting(key: string): Promise<unknown>;

  /**
   * Update multiple settings at once
   * @param updates - Partial settings object with updates
   * @returns Promise that resolves when settings are saved
   */
  updateSettings(updates: Partial<SettingsData>): Promise<void>;
}

/**
 * Main extension interface that all extensions must implement
 *
 * All methods are optional - implement only what you need.
 * Event handlers can return void or a partial event to modify the event data.
 *
 * @example
 * ```typescript
 * class MyExtension implements Extension {
 *   async onLoad(context: ExtensionContext) {
 *     this.context = context;
 *     context.log('My extension loaded!', 'info');
 *   }
 *
 *   getTools(context: ExtensionContext): ToolDefinition[] {
 *     return [{
 *       name: 'my-tool',
 *       description: 'My custom tool',
 *       parameters: z.object({ input: z.string() }),
 *       async execute(args, signal, context) {
 *         return { content: [{ type: 'text', text: args.input }] };
 *       },
 *     }];
 *   }
 *
 *   async onPromptSubmitted(event: PromptSubmittedEvent, context: ExtensionContext) {
 *     context.log(`Prompt: ${event.prompt}`, 'debug');
 *   }
 * }
 * ```
 */
export interface Extension {
  // Lifecycle methods

  /**
   * Called when extension is loaded
   * Use this to initialize your extension, set up state, etc.
   */
  onLoad?(context: ExtensionContext): void | Promise<void>;

  /**
   * Called when extension is unloaded
   * Clean up resources, save state, etc.
   */
  onUnload?(): void | Promise<void>;

  // Tool registration

  /**
   * Return array of tools this extension provides
   * Called when extension is loaded and when tools need to be refreshed
   * @param context - Extension context
   * @param mode - Current mode
   * @param agentProfile - Current agent profile
   */
  getTools?(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[];

  // Command registration

  /**
   * Return array of commands this extension provides
   * Called when extension is loaded and when commands need to be refreshed
   */
  getCommands?(context: ExtensionContext): CommandDefinition[];

  // Mode registration

  /**
   * Return array of modes this extension provides
   * Called when extension is loaded and when modes need to be refreshed
   */
  getModes?(context: ExtensionContext): ModeDefinition[];

  // Agent registration

  /**
   * Return array of agent profiles this extension provides
   * Called when extension is loaded and when agents need to be refreshed
   * Extension-provided agents will be included in the list of all agents
   */
  getAgents?(context: ExtensionContext): AgentProfile[];

  /**
   * Called when a user updates an extension-provided agent profile
   * Extension should persist the updated profile and return it from future getAgents() calls
   * @param context - Extension context (no project available for global operations)
   * @param agentId - The ID of the agent being updated
   * @param updatedProfile - The complete updated profile
   * @returns The updated agent profile
   */
  onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;

  // Task Events

  /**
   * Called when a new task is created
   * @returns void or partial event to modify task data
   */
  onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;

  /**
   * Called when a task is prepared (both new and loaded tasks)
   * @returns void or partial event to modify task data
   */
  onTaskPrepared?(event: TaskPreparedEvent, context: ExtensionContext): Promise<void | Partial<TaskPreparedEvent>>;

  /**
   * Called when a task is initialized and ready for use
   * @returns void or partial event to modify task data
   */
  onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void | Partial<TaskInitializedEvent>>;

  /**
   * Called when a task is closed
   * @returns void or partial event to modify task data
   */
  onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void | Partial<TaskClosedEvent>>;

  /**
   * Called before a task is updated and saved
   * Modify event.task to change the task data before it's persisted
   * @returns void or partial event to modify task data
   */
  onTaskUpdated?(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void | Partial<TaskUpdatedEvent>>;

  // Project Events

  /**
   * Called when a project is started
   * @returns void or partial event to modify project data
   */
  onProjectStarted?(event: ProjectStartedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStartedEvent>>;

  /**
   * Called when a project is closed
   * @returns void or partial event to modify project data
   */
  onProjectStopped?(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStoppedEvent>>;

  // Prompt Events

  /**
   * Called when prompt processing starts
   * @returns void or partial event to modify
   */
  onPromptStarted?(event: PromptStartedEvent, context: ExtensionContext): Promise<void | Partial<PromptStartedEvent>>;

  /**
   * Called when prompt processing finishes
   * @returns void or partial event to modify
   */
  onPromptFinished?(event: PromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<PromptFinishedEvent>>;

  /**
   * Called when a prompt template is rendered
   * Modify event.prompt to override the rendered prompt
   * @returns void or partial event to modify prompt
   */
  onPromptTemplate?(event: PromptTemplateEvent, context: ExtensionContext): Promise<void | Partial<PromptTemplateEvent>>;

  // Agent Events

  /**
   * Called when agent mode starts
   * @returns void or partial event to modify prompt
   */
  onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;

  /**
   * Called when agent mode finishes
   * @returns void or partial event to modify result messages
   */
  onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;

  /**
   * Called after each agent step completes
   * @returns void or partial event
   */
  onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;

  /**
   * Called when messages are optimized before being sent to the LLM
   * Modify event.optimizedMessages to change the messages that will be sent
   * @returns void or partial event to modify optimized messages
   */
  onOptimizeMessages?(event: OptimizeMessagesEvent, context: ExtensionContext): Promise<void | Partial<OptimizeMessagesEvent>>;

  /**
   * Called when important reminders are being added to the user message
   * Modify event.remindersContent to change the reminders content
   * @returns void or partial event to modify reminders content
   */
  onImportantReminders?(event: ImportantRemindersEvent, context: ExtensionContext): Promise<void | Partial<ImportantRemindersEvent>>;

  // Tool Events

  /**
   * Called when a tool requires approval
   * Set event.blocked = true to prevent execution
   * @returns void or partial event to modify approval behavior
   */
  onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;

  /**
   * Called when a tool is about to be executed
   * Set event.blocked = true to prevent execution
   * @returns void or partial event to modify tool call
   */
  onToolCalled?(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>>;

  /**
   * Called after tool execution completes
   * Use modifiedResult to change the result
   * @returns void or partial event to modify result
   */
  onToolFinished?(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>>;

  // File Events

  /**
   * Called when files are added to context
   * Modify event.files to filter, add, or clear files (return empty array to prevent addition)
   * @returns void or partial event to modify files
   */
  onFilesAdded?(event: FilesAddedEvent, context: ExtensionContext): Promise<void | Partial<FilesAddedEvent>>;

  /**
   * Called when files are dropped into the chat
   * Modify event.files to filter, add, or clear files (return empty array to prevent addition)
   * @returns void or partial event to modify files
   */
  onFilesDropped?(event: FilesDroppedEvent, context: ExtensionContext): Promise<void | Partial<FilesDroppedEvent>>;

  /**
   * Called when rule files are retrieved
   * Modify event.files to filter, add, or clear rule files
   * @returns void or partial event to modify files
   */
  onRuleFilesRetrieved?(event: RuleFilesRetrievedEvent, context: ExtensionContext): Promise<void | Partial<RuleFilesRetrievedEvent>>;

  // Message Events

  /**
   * Called on each response chunk
   * @returns void or partial event to modify message
   */
  onResponseChunk?(event: ResponseChunkEvent, context: ExtensionContext): Promise<void | Partial<ResponseChunkEvent>>;

  /**
   * Called on response completion
   * @returns void or partial event to modify message
   */
  onResponseCompleted?(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void | Partial<ResponseCompletedEvent>>;

  // Approval Events

  /**
   * Called when handling user approval requests
   * Set event.blocked = true to prevent approval handling
   * @returns void or partial event to modify approval
   */
  onHandleApproval?(event: HandleApprovalEvent, context: ExtensionContext): Promise<void | Partial<HandleApprovalEvent>>;

  // Subagent Events

  /**
   * Called when a subagent starts
   * Set event.blocked = true to prevent subagent spawning
   * @returns void or partial event to modify prompt
   */
  onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;

  /**
   * Called when a subagent finishes
   * @returns void or partial event to modify result
   */
  onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void | Partial<SubagentFinishedEvent>>;

  // Question Events

  /**
   * Called when a question is asked to the user
   * @returns void or partial event to modify question
   */
  onQuestionAsked?(event: QuestionAskedEvent, context: ExtensionContext): Promise<void | Partial<QuestionAskedEvent>>;

  /**
   * Called when user answers a question
   * @returns void or partial event to modify answer
   */
  onQuestionAnswered?(event: QuestionAnsweredEvent, context: ExtensionContext): Promise<void | Partial<QuestionAnsweredEvent>>;

  // Command Events

  /**
   * Called when a slash command is executed
   * @returns void or partial event to modify command
   */
  onCommandExecuted?(event: CommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CommandExecutedEvent>>;

  /**
   * Called when a custom command is executed
   * Set event.blocked = true to prevent execution
   * Set event.prompt to override the processed template
   * @returns void or partial event to modify command execution
   */
  onCustomCommandExecuted?(event: CustomCommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CustomCommandExecutedEvent>>;

  // Aider Events (Legacy)

  /**
   * Called when Aider prompt starts (legacy event)
   * @returns void or partial event to modify prompt
   */
  onAiderPromptStarted?(event: AiderPromptStartedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptStartedEvent>>;

  /**
   * Called when Aider prompt finishes (legacy event)
   * @returns void or partial event to modify responses
   */
  onAiderPromptFinished?(event: AiderPromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptFinishedEvent>>;
}

/**
 * Constructor type for extension classes
 */
export interface ExtensionConstructor {
  new (): Extension;
  metadata?: ExtensionMetadata;
}

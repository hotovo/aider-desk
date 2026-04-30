import { z } from 'zod';
import {
  AgentProfile,
  CommandArgument,
  CommandsData,
  ConnectorMessage,
  ContextFile,
  ContextMemoryMode,
  ContextMessage,
  CreateTaskParams,
  CustomCommand,
  InvocationMode,
  JSONValue,
  MemoryEntry,
  MemoryEntryType,
  Mode,
  ModeDefinition,
  Model,
  ProjectSettings,
  PromptContext,
  SkillDefinition,
  ProviderProfile,
  QuestionData,
  QueuedPromptData,
  ResponseChunkData,
  ResponseCompletedData,
  SettingsData,
  TaskData,
  TodoItem,
  ToolApprovalState,
  UpdatedFile,
  UsageReportData,
  VoiceSession,
} from "@common/types";

export { ContextMemoryMode, InvocationMode, ToolApprovalState };

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
  /** Optional URL to an icon image for the extension */
  iconUrl?: string;
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
 * Definition of a tool that is part of the tool set. This tool can be executed internally by extension, but it won't be propagated to UI.
 *
 * @execute - Optional execute function. If not provided, the tool has other unsupported means of execution.
 */
export interface Tool {
  execute?: (input: Record<string, unknown>) => Promise<unknown>;
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
  execute: (input: z.infer<TSchema>, signal: AbortSignal | undefined, context: ExtensionContext, allTools: Record<string, Tool>) => Promise<unknown>;
}

/**
 * Response from loading models for a provider
 */
export interface LoadModelsResponse {
  models: Model[];
  success: boolean;
  error?: string;
}

/**
 * Aider-compatible model mapping with environment variables
 */
export interface AiderModelMapping {
  modelName: string;
  environmentVariables: Record<string, string>;
}

export interface CacheControl {
  providerOptions: Record<string, Record<string, JSONValue>>;
  placement?: 'message' | 'message-part';
}

/**
 * Simplified provider strategy for extensions.
 * Only `createLlm` and `loadModels` are required.
 * All other methods are optional and will use built-in defaults when omitted.
 */
export interface ExtensionProviderStrategy {
  createLlm: (
    profile: ProviderProfile,
    model: Model,
    settings: SettingsData,
    projectDir: string,
  ) => unknown | Promise<unknown>;
  loadModels: (profile: ProviderProfile, settings: SettingsData) => Promise<LoadModelsResponse>;

  getAiderMapping?: (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string) => AiderModelMapping;
  getUsageReport?: (task: unknown, provider: ProviderProfile, model: Model, usage: unknown, providerMetadata?: unknown) => UsageReportData;
  getProviderOptions?: (model: Model) => Record<string, Record<string, JSONValue>> | undefined;
  getCacheControl?: (model: Model) => CacheControl | undefined;
  getProviderTools?: (model: Model) => Record<string, Tool> | Promise<Record<string, Tool>>;
  getProviderParameters?: (model: Model) => Record<string, unknown>;
  createVoiceSession?: (profile: ProviderProfile, settings: SettingsData) => Promise<VoiceSession>;
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Definition of an LLM provider that can be registered by an extension.
 * The extension fully owns the provider config — it is not UI-editable.
 */
export interface ProviderDefinition {
  /** Unique provider identifier (e.g., 'my-provider') */
  id: string;
  /** Provider name — can be a new name or a built-in provider name to override it */
  name: string;
  /** Provider configuration (not UI-editable, extension-owned) */
  provider: { name: string; [key: string]: unknown };
  /** Provider strategy implementation */
  strategy: ExtensionProviderStrategy;
  /** Optional HTTP headers for API requests */
  headers?: Record<string, string>;
}

/** Placement locations for extension UI components */
export type UIComponentPlacement =
  | 'task-status-bar-left'
  | 'task-status-bar-right'
  | 'task-usage-info-bottom'
  | 'task-messages-top'
  | 'task-messages-bottom'
  | 'header-left'
  | 'header-right'
  | 'task-input-above'
  | 'task-input-toolbar-left'
  | 'task-input-toolbar-right'
  | 'tasks-sidebar-header'
  | 'tasks-sidebar-bottom'
  | 'task-message-above'
  | 'task-message-below'
  | 'task-message-bar'
  | 'task-top-bar-left'
  | 'task-top-bar-right'
  | 'task-state-actions'
  | 'task-state-actions-all'
  | 'welcome-page';

/**
 * Definition of a React UI component that can be registered by an extension.
 * The component is defined as a JSX string and rendered using string-to-react-component.
 *
 * Available props for the component:
 * - React: React object with hooks (useState, useEffect, useCallback, useMemo, useRef, etc.)
 * - task: Current TaskData
 * - projectDir: Project directory path
 * - mode: Current mode string
 *
 * @example
 * ```typescript
 * const myStatusComponent: UIComponentDefinition = {
 *   id: 'my-status-indicator',
 *   placement: UIComponentPlacement.TaskStatusBar,
 *   jsx: `
 *     <div className="flex items-center gap-2 text-xs text-text-secondary">
 *       <span>Task: {task.name}</span>
 *       <span>Mode: {mode}</span>
 *     </div>
 *   `,
 * };
 * ```
 */
export interface UIComponentDefinition {
  /** Unique component identifier*/
  id: string;
  /** Where in UI to render this component */
  placement: UIComponentPlacement;
  /** JSX/TSX component as string to be parsed by string-to-react-component */
  jsx: string;
  /** Optional flag to indicate if the component should load data from the extension to be passed as a prop (default: false) */
  loadData?: boolean;
  /** Optional flag to disable data caching - when true, data is always fetched fresh on render (default: false) */
  noDataCache?: boolean;
}

/**
 * Marker type for UI components provided by AiderDesk
 * Actual component implementation is provided by renderer at runtime
 */
export type UIComponent = object;

/**
 * Common UI components available to extension JSX components
 */
export interface UIComponents {
  Button: UIComponent;
  Checkbox: UIComponent;
  Input: UIComponent;
  Select: UIComponent;
  TextArea: UIComponent;
  IconButton: UIComponent;
  RadioButton: UIComponent;
  MultiSelect: UIComponent;
  Slider: UIComponent;
  DatePicker: UIComponent;
  Chip: UIComponent;
  ModelSelector: UIComponent;
  Tooltip: UIComponent;
  LoadingOverlay: UIComponent;
  ConfirmDialog: UIComponent;
}

export interface UIComponentProps {
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  models: Model[];
  providers: ProviderProfile[];
  ui: UIComponents;
  icons: Record<string, unknown>;
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

/** Event payload for agent step started events */
export interface AgentStepStartedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly iterationCount: number;
  messages: ContextMessage[];
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

/** Event payload for before commit events */
export interface BeforeCommitEvent {
  message: string;
  amend: boolean;
  blocked?: boolean;
}

/** Event payload for after commit events */
export interface AfterCommitEvent {
  readonly message: string;
  readonly amend: boolean;
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

  /** Read-only snapshot of the current task state including id, name, status, mode, and all persisted fields */
  readonly data: TaskData;

  // Context Files (Read + Safe Write)

  /**
   * Get the list of files currently in the task's context.
   * These are the files the agent is aware of and can reference.
   * @returns Array of context files with their paths and read-only flags
   */
  getContextFiles(): Promise<ContextFile[]>;

  /**
   * Add a single file to the task's context by path.
   * Dispatches the `onFilesAdded` extension event before adding.
   * Updates context info and notifies connectors after adding.
   * @param path - Relative or absolute file path to add
   * @param readOnly - If true, the file is marked as read-only in the context
   */
  addFile(path: string, readOnly?: boolean): Promise<void>;

  /**
   * Add multiple files to the task's context at once.
   * Dispatches the `onFilesAdded` extension event for each file before adding.
   * Updates context info and notifies connectors after adding.
   * @param files - One or more ContextFile objects with path and optional readOnly flag
   */
  addFiles(...files: ContextFile[]): Promise<void>;

  /**
   * Remove a file from the task's context by path.
   * Dispatches the `onFilesDropped` extension event before removing.
   * @param path - File path to remove
   */
  dropFile(path: string): Promise<void>;

  // Data Context Messages (Read + Safe Write)

  /**
   * Get the full conversation history from the task's context manager.
   * These messages are stored in a JSON file on disk (not in a database) and sent to the LLM.
   * @returns Array of context messages (user, assistant, system, tool, etc.)
   */
  getContextMessages(): Promise<ContextMessage[]>;

  /**
   * Append a message to the task's context messages.
   * The message is stored in memory and auto-saved to the context JSON file on disk.
   * Optionally refreshes the context info summary displayed in the UI.
   * @param message - The context message to add
   * @param updateContextInfo - If true, refreshes the context info summary after adding
   */
  addContextMessage(message: ContextMessage, updateContextInfo?: boolean): Promise<void>;

  /**
   * Remove a specific message from the context by its ID.
   * Reloads connector messages and updates context info after removal.
   * @param messageId - The unique identifier of the message to remove
   */
  removeMessage(messageId: string): Promise<void>;

  /**
   * Remove the most recent message from the context.
   * Reloads connector messages and updates context info after removal.
   */
  removeLastMessage(): Promise<void>;

  /**
   * Remove all messages after the specified message (inclusive).
   * Reloads connector messages and updates context info after removal.
   * @param messageId - The ID of the message; this message and all messages after it are removed
   */
  removeMessagesUpTo(messageId: string): Promise<void>;

  /**
   * Load a set of messages into the context manager, replacing the current in-memory messages
   * and sending them to the UI via the event manager.
   * This is used for loading pre-authored context (e.g., from extensions).
   * @param messages - The context messages to load
   */
  loadContextMessages(messages: ContextMessage[]): Promise<void>;

  /**
   * Re-execute the last user prompt, optionally with a different mode or edited text.
   * Removes the last user message and all messages after it from the context, then resubmits.
   * @param mode - Optional mode to use for re-execution (defaults to current mode)
   * @param updatedPrompt - Optional new prompt text; if omitted, reuses the original prompt
   */
  redoUserPrompt(messageId: string, mode?: string, updatedPrompt?: string): Promise<void>;

  /**
   * Re-execute the last user prompt, optionally with a different mode or edited text.
   * Convenience method that finds the last user message and calls redoUserPrompt with its ID.
   * @param mode - Optional mode to use for re-execution (defaults to current mode)
   * @param updatedPrompt - Optional new prompt text; if omitted, reuses the original prompt
   */
  redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void>;

  // UI Context Messages

  /**
   * Send a user message to the UI for display in the task's chat.
   * This only sends the message to the renderer via the event manager — it does not
   * add the message to the data context or persist it.
   * @param id - Unique identifier for the message
   * @param content - Text content of the user message
   * @param promptContext - Optional prompt context metadata
   */
  addUserMessage(id: string, content: string, promptContext?: PromptContext): void;

  /**
   * Send a tool execution message to the UI for display in the task's chat.
   * If a response and usage report are provided and saveToDb is true, the message is also
   * persisted via the data manager. Updates total cost tracking when usage data is present.
   * @param id - Unique identifier for the tool message
   * @param serverName - Name of the tool server (e.g., MCP server name or tool group)
   * @param toolName - Name of the tool that was called
   * @param input - Tool input parameters
   * @param response - Tool response text (if already available)
   * @param usageReport - Token usage data for this tool call
   * @param promptContext - Optional prompt context metadata
   * @param saveToDb - Whether to persist this message via the data manager (default: true)
   * @param finished - Whether the tool execution is complete (default: true if response is provided)
   */
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

  /**
   * Process a response message — streams response chunks to the UI while in progress,
   * and sends the completed response when finished.
   * If finished and saveToDb is true, persists the response via the data manager.
   * Dispatches the `onResponseChunk` and `onResponseCompleted` extension events.
   * @param message - The response message containing content, finish state, and optional usage
   * @param saveToDb - Whether to persist the completed response via the data manager (default: true)
   */
  addResponseMessage(message: ResponseMessage, saveToDb?: boolean): Promise<void>;

  // Files & Repo (Read-only)

  /**
   * Get the working directory for this task.
   * Returns the worktree path if the task has a git worktree configured,
   * otherwise returns the project's base directory.
   * @returns Absolute filesystem path to the task's working directory
   */
  getTaskDir(): string;

  /**
   * Get a list of files that can be added to the task's context.
   * Returns all files in the task directory that are not already in the context,
   * optionally filtered by a regex pattern.
   * @param searchRegex - Optional regex pattern to filter file names
   * @returns Array of file paths relative to the task directory
   */
  getAddableFiles(searchRegex?: string): Promise<string[]>;

  /**
   * Get all files in the task directory, optionally filtered by git tracking.
   * @param useGit - If true (default), returns only git-tracked files; if false, returns all files
   * @returns Array of file paths relative to the task directory
   */
  getAllFiles(useGit?: boolean): Promise<string[]>;

  /**
   * Get files modified during the current task's execution.
   * Compares the current state against the main branch using the worktree manager.
   * @returns Array of updated file entries with path and diff information
   */
  getUpdatedFiles(): Promise<UpdatedFile[]>;

  /**
   * Get the cached repository map string.
   * The repo map summarizes the codebase structure and is maintained by the Aider manager.
   * @returns Repository map as a formatted string
   */
  getRepoMap(): string;

  /**
   * Stage a file in git (equivalent to `git add`).
   * No-op if the project is not a git repository.
   * @param path - File path to stage
   */
  addToGit(path: string): Promise<void>;

  // Todos (Read + Safe Write)

  /**
   * Get all todo items for this task, read from the task's todo file on disk.
   * @returns Array of todo items with name, completed status, and metadata
   */
  getTodos(): Promise<TodoItem[]>;

  /**
   * Create a new uncompleted todo item and write the updated list to the todo file.
   * @param name - Descriptive name for the todo item
   * @returns Updated array of all todo items
   */
  addTodo(name: string): Promise<TodoItem[]>;

  /**
   * Update an existing todo item's properties (e.g., mark as completed).
   * Writes the updated list to the todo file.
   * @param name - The name of the todo item to update
   * @param updates - Partial fields to update (e.g., { completed: true })
   * @returns Updated array of all todo items
   * @throws Error if no todo items exist or the specified name is not found
   */
  updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>;

  /**
   * Remove a todo item by name and write the updated list to the todo file.
   * @param name - The name of the todo item to delete
   * @returns Updated array of all todo items
   * @throws Error if no todo items exist
   */
  deleteTodo(name: string): Promise<TodoItem[]>;

  /**
   * Remove all todo items from the task and write the empty list to the todo file.
   * @returns Empty array
   * @throws Error if no todo items exist
   */
  clearAllTodos(): Promise<TodoItem[]>;

  /**
   * Replace the entire todo list with the provided items and write to the todo file.
   * @param items - Complete set of todo items to set
   * @param initialUserPrompt - Optional prompt text to associate with the todo set
   */
  setTodos(items: TodoItem[], initialUserPrompt?: string): Promise<void>;

  // Execution

  /**
   * Submit a prompt for processing. If a prompt is already running, the new prompt is queued
   * and will execute after the current one finishes.
   * If there is a pending question, it will be answered with 'no' using the prompt text as user input.
   * @param prompt - The text prompt to send
   * @param mode - Optional mode to use (defaults to the task's current mode)
   */
  runPrompt(prompt: string, mode?: string): Promise<void>;

  /**
   * Execute a prompt directly using a specific agent profile.
   * Optionally waits for the currently running agent to finish before starting.
   * Saves the task state, runs the agent, sends resulting messages to connectors,
   * and determines the final task state.
   * @param profile - The agent profile configuration to use
   * @param mode - Execution mode
   * @param prompt - The prompt text, or null to use the current conversation context
   * @param promptContext - Optional prompt context metadata
   * @param contextMessages - Override context messages (uses task's context messages if omitted)
   * @param contextFiles - Override context files (uses task's context files if omitted)
   * @param systemPrompt - Override system prompt for the agent
   * @param waitForCurrentAgentToFinish - If true (default), waits for the running agent to complete before starting
   * @param sendNotification - If true (default), sends a desktop notification when the prompt completes
   * @returns Array of response completion data from the agent's execution
   */
  runPromptInAgent(
    profile: AgentProfile,
    mode: string,
    prompt: string | null,
    promptContext?: PromptContext,
    contextMessages?: ContextMessage[],
    contextFiles?: ContextFile[],
    systemPrompt?: string,
    waitForCurrentAgentToFinish?: boolean,
    sendNotification?: boolean,
  ): Promise<ResponseCompletedData[]>;

  /**
   * Execute a registered custom command by name.
   * First checks extension commands, then falls back to file-based custom commands.
   * Dispatches the `onCustomCommandExecuted` extension event. Processes the command template
   * with the provided arguments before executing it.
   * @param name - The command name (without the leading slash)
   * @param args - Optional arguments to pass to the command template
   * @param mode - Optional mode context for the command execution
   */
  runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;

  /**
   * Spawn a subagent with the given profile and prompt within the current task context.
   * The profile is automatically marked as a subagent. Dispatches the `onSubagentStarted`
   * extension event (can be blocked). Uses the task's context messages and files unless
   * overridden. Dispatches `onSubagentFinished` when complete.
   * @param agentProfile - The agent profile configuration for the subagent
   * @param prompt - The prompt to send to the subagent
   */
  runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;

  /**
   * Execute a slash command in the task's context.
   * Dispatches the `onCommandExecuted` extension event (can be blocked).
   * Adds the command to input history. Handles built-in commands like 'drop', 'reset',
   * and 'undo' with special logic; forwards other commands to connectors.
   * @param command - The command string to execute (without the leading slash)
   */
  runCommand(command: string): Promise<void>;

  /**
   * Interrupt the currently running agent response or a specific subagent/conflict-resolution
   * agent by ID. Aborts the corresponding AbortController and answers any pending question with 'no'.
   */
  interruptResponse(): Promise<void>;

  /**
   * Generate text using a specific model without running the full agent loop.
   * Delegates to the Agent's generateText method using the project directory.
   * Useful for quick LLM calls (e.g., summarization, classification) within extensions.
   * @param modelId - The model identifier to use (format: "provider/model")
   * @param systemPrompt - System prompt for the generation request
   * @param prompt - User prompt for the generation request
   * @returns The generated text, or undefined if generation failed
   */
  generateText(modelId: string, systemPrompt: string, prompt: string): Promise<string | undefined>;

  // User Interaction

  /**
   * Ask the user a question and wait for their response.
   * Dispatches the `onQuestionAsked` extension event. If a previous question is pending,
   * waits for it to be answered first. Supports stored answers for auto-answering.
   * Sends a desktop notification if notifications are enabled.
   * @param text - The question text to display to the user
   * @param options - Optional configuration for answer choices, default answer, and subject
   * @returns The user's selected answer string
   */
  askQuestion(text: string, options?: QuestionOptions): Promise<string>;

  /**
   * Send a log message to the UI via the event manager.
   * Log messages appear in the task's message stream as informational, error, or warning entries.
   * @param level - Severity level: 'info', 'error', or 'warning'
   * @param message - The log message text
   */
  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void;

  /**
   * Show or update a loading indicator in the task's UI.
   * Sends a loading log message via the event manager with optional interrupt action IDs.
   * @param message - Loading text to display
   * @param finished - If true, dismisses the loading indicator
   */
  addLoadingMessage(message?: string, finished?: boolean): void;

  // Task Management

  /**
   * Update the task's data with the provided partial changes and persist them.
   * Merges updates into the existing task data. Handles special side effects:
   * working mode changes trigger worktree setup, mode changes may start the Aider manager,
   * and agent profile changes update estimated tokens. Skips saving if nothing changed.
   * @param updates - Partial task data fields to update
   * @returns The fully updated task data
   */
  updateTask(updates: Partial<TaskData>): Promise<TaskData>;

  /**
   * Perform a conversation handoff — generates a handoff summary of the current conversation
   * using the handoff prompt template, then optionally executes a follow-up prompt.
   * In agent mode, uses the handoff agent profile to generate the summary text.
   * @param focus - Optional focus description to guide the handoff summary
   * @param execute - If true, automatically runs the handoff prompt after generating the summary
   */
  handoffConversation(focus?: string, execute?: boolean): Promise<void>;

  // Context Management

  /**
   * Clear the task's conversation context: sets the task state to Todo, clears all context messages
   * in the context manager, sends a 'clear' command to connectors, and dispatches a clear event to the UI.
   */
  clearContext(): Promise<void>;

  /**
   * Reset the task context by clearing both context files and context messages in the context manager,
   * then saves the context to disk immediately.
   */
  resetContext(): Promise<void>;

  /**
   * Compact the conversation by running a compact-conversation agent that summarizes the history.
   * Preserves the original user message and skill activation messages, replacing the rest with the summary.
   * Updates context info and adjusts the token usage estimate afterward.
   * @param instructions - Optional custom instructions to guide the compaction process
   */
  compactConversation(instructions?: string): Promise<void>;

  /**
   * Generate a markdown representation of the context messages in the context manager.
   * Formats user and assistant messages as text, and tool messages with tool name and JSON result.
   * @returns Markdown string of the context messages, or null if generation fails
   */
  generateContextMarkdown(): Promise<string | null>;

  /**
   * Check whether the task has been fully initialized and is ready for use.
   * @returns True if the task initialization process is complete
   */
  isInitialized(): boolean;

  /**
   * Update the autocompletion data sent to the UI.
   * Sends the provided words and the current file list from the task directory,
   * but only if the file list has changed or force is true.
   * @param words - New set of autocompletion words, or undefined to only update file list
   */
  updateAutocompletionWords(words?: string[]): Promise<void>;

  // Queued Prompts

  /**
   * Get all prompts currently queued for execution in this task.
   * Queued prompts are held in memory and execute sequentially after the current prompt finishes.
   * @returns Array of queued prompt data with IDs, text, mode, and timestamp
   */
  getQueuedPrompts(): QueuedPromptData[];

  /**
   * Immediately execute a queued prompt by moving it to the front of the queue,
   * adding it as a user message, and interrupting the current agent response.
   * @param promptId - The ID of the queued prompt to execute now
   */
  sendQueuedPromptNow(promptId: string): Promise<void>;

  /**
   * Remove a prompt from the execution queue without running it.
   * Notifies the UI of the updated queue.
   * @param promptId - The ID of the queued prompt to remove
   */
  removeQueuedPrompt(promptId: string): void;

  /**
   * Reorder the queued prompts to a specific arrangement.
   * Notifies the UI of the updated queue.
   * @param prompts - The complete reordered array of queued prompts
   */
  reorderQueuedPrompts(prompts: QueuedPromptData[]): void;

  /**
   * Edit the text content of an existing queued prompt.
   * Notifies the UI of the updated queue.
   * @param promptId - The ID of the queued prompt to edit
   * @param newText - The new text content for the prompt
   */
  editQueuedPrompt(promptId: string, newText: string): void;

  // Advanced Operations

  /**
   * Get the agent profile assigned to this task.
   * Checks the task-level agentProfileId first, then falls back to the project-level setting.
   * Applies any task-level provider/model overrides to the resolved profile.
   * @returns The resolved agent profile, or null if no profile is configured
   */
  getTaskAgentProfile(): Promise<AgentProfile | null>;

  /**
   * Programmatically answer a pending question that was asked to the user.
   * Dispatches the `onQuestionAnswered` extension event. Matches the answer against
   * configured shortkeys, or defaults to 'y'/'n'. Supports storing the answer for
   * future auto-answering with 'd' (don't ask again) or 'a' (always).
   * @param answer - The answer text to submit (e.g., 'y', 'n', 'a', 'd')
   * @param userInput - Optional raw user input associated with the answer
   * @returns True if a pending question was answered, false if no question is pending
   */
  answerQuestion(answer: string, userInput?: string): Promise<boolean>;
}

/**
 * Safe subset of Project capabilities exposed to extensions.
 * Provides read-only access to project data and safe operations.
 */
export interface ProjectContext {
  // Identity

  /** Absolute path to the project's root directory on the filesystem */
  readonly baseDir: string;

  // Task Management

  /**
   * Create a new task within the project. Inherits model, mode, and other settings from the
   * most recent task (or from the parent task if parentId is specified).
   * Dispatches the `onTaskCreated` extension event after the task is created.
   * @param params - Task creation parameters including optional name, parentId, mode, and agent/model selection
   * @returns The newly created task data
   */
  createTask(params: CreateTaskParams): Promise<TaskData>;

  /**
   * Get a TaskContext for a specific loaded task by its ID.
   * Returns null if the task is not currently loaded in memory.
   * @param taskId - The unique identifier of the task to retrieve
   * @returns A TaskContext wrapping the Task instance, or null if not found
   */
  getTask(taskId: string): TaskContext | null;

  /**
   * Get all loaded tasks in the project (excluding the internal task).
   * Waits for initial task loading to complete before returning.
   * @returns Array of all task data objects sorted by updatedAt (most recent first)
   */
  getTasks(): Promise<TaskData[]>;

  /**
   * Get the TaskContext for the most recently updated task.
   * Determined by the updatedAt timestamp, excluding the internal task.
   * @returns A TaskContext for the most recent task, or null if no tasks exist
   */
  getMostRecentTask(): TaskContext | null;

  /**
   * Fork a task at a specific message, creating a new subtask.
   * The new task inherits settings from the source task and copies context messages
   * up to and including the specified message. The new task's parentId is set to the
   * source task or its parent.
   * @param taskId - The ID of the task to fork
   * @param messageId - The ID of the message to fork at (conversation is copied up to this point)
   * @returns The newly created forked task data
   */
  forkTask(taskId: string, messageId: string): Promise<TaskData>;

  /**
   * Create a duplicate of an existing task.
   * The duplicate inherits settings from the source task and copies all context messages and files.
   * If the source task has a worktree, the duplicate is made a subtask of the same parent.
   * @param taskId - The ID of the task to duplicate
   * @returns The newly created duplicate task data
   */
  duplicateTask(taskId: string): Promise<TaskData>;

  /**
   * Permanently delete a task and all its subtasks.
   * Closes the task(s), removes their worktrees if not shared with other tasks,
   * and deletes their task directories from disk.
   * @param taskId - The ID of the task to delete
   */
  deleteTask(taskId: string): Promise<void>;

  // Agent Profiles

  /**
   * Get all agent profiles available for this project.
   * Returns profiles from the agent profile manager scoped to this project,
   * including built-in, user-defined, and extension-provided profiles.
   * @returns Array of agent profile configurations
   */
  getAgentProfiles(): AgentProfile[];

  // Commands (Read-only)

  /**
   * Get all custom commands registered in the project.
   * Returns the full command data from the custom command manager,
   * which includes both file-based and extension-provided commands.
   * @returns Commands data containing all registered command definitions
   */
  getCommands(): CommandsData;

  // Settings (Read-only)

  /**
   * Get the project-level settings from the store.
   * @returns Current project settings
   */
  getProjectSettings(): ProjectSettings;

  // Input History (Read-only)

  /**
   * Load the input history file for the project.
   * Reads a file in a custom format where entries are separated by timestamp headers (# ...)
   * and lines starting with + contain the actual input text.
   * @returns Array of prompt strings in reverse chronological order (most recent first)
   */
  getInputHistory(): Promise<string[]>;
}

/**
 * Context object passed to extension methods providing access to AiderDesk APIs.
 *
 * Availability depends on where the context is created:
 * - **Global context** (e.g., `onLoad` without project, `getAgents`, `getConfigComponent`):
 *   project and task are not available — `getProjectDir()` returns empty string,
 *   `getTaskContext()` returns null, and `getProjectContext()` throws.
 * - **Project context** (e.g., event handlers, `getTools`, `getCommands`):
 *   project is available but task may not be.
 * - **Task context** (e.g., task-specific event handlers, command execution):
 *   both project and task are available.
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
   * Log a message prefixed with the extension name to the AiderDesk logger.
   * Messages appear in the console output and log files at the specified level.
   * @param message - Message to log
   * @param type - Log level: 'info' (default), 'error', 'warn', or 'debug'
   */
  log(message: string, type?: 'info' | 'error' | 'warn' | 'debug'): void;

  /**
   * Get the current project directory path.
   * Only available when the context is created within a project scope (e.g., event handlers,
   * getTools, getCommands). Returns an empty string when no project is available.
   * @returns Absolute path to the project directory, or empty string if not in a project context
   */
  getProjectDir(): string;

  /**
   * Get the task context for the current task.
   * Only available when the context is created for a specific task (e.g., task event handlers,
   * command execution within a task). Returns null when no task is available.
   * @returns TaskContext wrapping the current Task, or null if no task is active
   */
  getTaskContext(): TaskContext | null;

  /**
   * Get the project context for safe project-level operations.
   * Only available when the context is created within a project scope.
   * Throws an Error if no project is available (e.g., during global onLoad).
   * @returns ProjectContext wrapping the current Project
   * @throws Error if called outside of a project context
   */
  getProjectContext(): ProjectContext;

  /**
   * Get all available model configurations from all enabled providers.
   * Loads models from providers on first call and caches the results.
   * Returns an empty array if the ModelManager is not available.
   * @returns Promise resolving to a flat array of Model objects from all providers
   */
  getModelConfigs(): Promise<Model[]>;

  /**
   * Get a specific setting value from the global settings using dot-notation path.
   * Navigates the settings object by splitting the key on '.' and reducing.
   * Returns undefined if the key path does not exist.
   * @param key - Setting key in dot-notation (e.g., 'general.theme', 'taskSettings.defaultWorkingMode')
   * @returns Promise resolving to the setting value, or undefined if not found
   * @throws Error if the Store is not available
   */
  getSetting(key: string): Promise<unknown>;

  /**
   * Update global settings by merging the provided partial updates into the current settings,
   * saving them via the store, and notifying the renderer via the event manager.
   * @param updates - Partial settings object with fields to update
   * @throws Error if the Store is not available
   */
  updateSettings(updates: Partial<SettingsData>): Promise<void>;

  /**
   * Trigger a data refresh for UI components in the renderer.
   * Sends an event to the renderer causing matching components to re-fetch their data
   * via `getUIExtensionData`. Can target a specific component and/or task.
   * No-op if the EventManager is not available.
   * @param componentId - Optional component ID to refresh only a specific component
   * @param taskId - Optional task ID to scope the refresh to components for a specific task
   */
  triggerUIDataRefresh(componentId?: string, taskId?: string): void;

  /**
   * Trigger a full reload of all UI component definitions for this extension.
   * Causes the renderer to discard cached component definitions and re-fetch them
   * via `getUIComponents`. Use this when component structure or JSX has changed.
   * No-op if the EventManager is not available.
   */
  triggerUIComponentsReload(): void;

  /**
   * Open a URL in the specified target.
   * - 'external': Opens in the system's default browser via `shell.openExternal`.
   * - 'window': Opens in a new Electron BrowserWindow (in Node/Docker environments, falls back to external).
   * - 'modal-overlay': Opens as an iframe inside a modal overlay dialog in the app (requires EventManager).
   * @param url - URL to open
   * @param target - Where to open: 'external' (system browser), 'window' (new Electron window), or 'modal-overlay' (iframe in modal)
   * @throws Error if the URL fails to open
   */
  openUrl(url: string, target?: 'external' | 'window' | 'modal-overlay'): Promise<void>;

  /**
   * Open a file or directory in the system's default application using Electron's `shell.openPath`.
   * @param path - Absolute path to the file or directory to open
   * @returns true if opened successfully, false if it failed (e.g., not in Electron environment)
   */
  openPath(path: string): Promise<boolean>;

  /**
   * Get the memory context for vector store operations (store, retrieve, update, delete memories).
   * Uses the same underlying vector store as the built-in memory tools.
   * @returns MemoryContext instance (the MemoryManager itself)
   * @throws Error if the MemoryManager is not available
   */
  getMemoryContext(): MemoryContext;
}

/**
 * Memory context providing access to AiderDesk's memory system.
 * Uses the same underlying vector store as the built-in memory MCP tools.
 */
export interface MemoryContext {
  /**
   * Store a new memory entry
   * @returns The ID of the created memory
   */
  storeMemory(projectId: string, taskId: string, type: MemoryEntryType, content: string): Promise<string>;

  /**
   * Retrieve memories by semantic similarity
   * @returns Array of matching memory entries, ranked by relevance
   */
  retrieveMemories(projectId: string, query: string, limit?: number): Promise<MemoryEntry[]>;

  /**
   * Get a single memory by ID
   */
  getMemory(id: string): Promise<MemoryEntry | null>;

  /**
   * Delete a specific memory by ID
   */
  deleteMemory(id: string): Promise<boolean>;

  /**
   * Update the content of an existing memory
   */
  updateMemory(id: string, content: string): Promise<boolean>;

  /**
   * Get all stored memories
   */
  getAllMemories(): Promise<MemoryEntry[]>;

  /**
   * Check if the memory system is enabled and initialized
   */
  isMemoryEnabled(): boolean;

  /**
   * Enable or disable the memory system
   * Persists the setting to the store
   */
  setMemoryEnabled(enabled: boolean): void;
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

  // Provider registration

  /**
   * Return array of LLM providers this extension provides
   * Each provider includes a strategy for LLM creation and model loading,
   * and a pre-configured provider profile.
   * Extension providers appear as read-only in the UI — the extension owns the configuration.
   * Provider names can override built-in providers (user responsibility to avoid conflicts between extensions).
   */
  getProviders?(context: ExtensionContext): ProviderDefinition[];

  // Skill registration

  /**
   * Return array of skills this extension provides
   * Each skill must have a name, description, location, and dirPath
   * Skills are loaded when the agent has Skills Tools enabled
   * @param context - Extension context
   */
  getSkills?(context: ExtensionContext): SkillDefinition[];

  /**
   * Called when a user updates an extension-provided agent profile
   * Extension should persist the updated profile and return it from future getAgents() calls
   * @param context - Extension context (no project available for global operations)
   * @param agentId - The ID of the agent being updated
   * @param updatedProfile - The complete updated profile
   * @returns The updated agent profile
   */
  onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;

  // UI Component registration

  /**
   * Return array of React UI components this extension provides
   * Components are defined as JSX/TSX strings and rendered using string-to-react-component
   * Called when extension is loaded and when components need to be refreshed
   */
  getUIComponents?(context: ExtensionContext): UIComponentDefinition[];

  /**
   * Return data for a specific UI component
   * Called when the component is mounted or when UI refresh is triggered
   * @param componentId - The ID of the component to get data for
   * @param context - Extension context
   * @returns Data to be passed to the component as `data` binding
   */
  getUIExtensionData?(componentId: string, context: ExtensionContext): Promise<unknown>;

  /**
   * Handle an action triggered from a UI component via executeExtensionAction
   * @param componentId - The ID of the component that triggered the action
   * @param action - The action identifier
   * @param args - Additional arguments passed from the component
   * @param context - Extension context
   * @returns Result of the action execution
   */
  executeUIExtensionAction?(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown>;

  // Settings configuration (per-extension settings UI)

  /**
   * Return this extension's settings/config UI component.
   * Only one config component per extension is supported.
   * The returned JSX receives { config, updateConfig } props.
   * @param context - Extension context
   * @returns JSX string for the settings component, or undefined if no settings UI
   */
  getConfigComponent?(context: ExtensionContext): string | undefined;

  /**
   * Return the current configuration data for this extension's settings.
   * Called by the settings dialog on mount to populate initial values.
   * @param context - Extension context
   * @returns Current config data (any serializable type)
   */
  getConfigData?(context: ExtensionContext): Promise<unknown>;

  /**
   * Save configuration data for this extension's settings.
   * Called by the settings dialog when user clicks Save.
   * @param configData - The config data to persist
   * @param context - Extension context
   * @returns Result of the save operation
   */
  saveConfigData?(configData: unknown, context: ExtensionContext): Promise<unknown>;

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
   * Called before each agent step starts
   * Modify event.messages to change the messages that will be sent to the LLM
   * @returns void or partial event to modify messages
   */
  onAgentStepStarted?(event: AgentStepStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepStartedEvent>>;

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

  // Commit Events

  /**
   * Called before changes are committed
   * Modify event.message and event.amend to change the commit message or amend flag
   * Set event.blocked = true to prevent the commit
   * @returns void or partial event to modify commit parameters
   */
  onBeforeCommit?(event: BeforeCommitEvent, context: ExtensionContext): Promise<void | Partial<BeforeCommitEvent>>;

  /**
   * Called after changes are committed
   * @returns void (read-only event)
   */
  onAfterCommit?(event: AfterCommitEvent, context: ExtensionContext): Promise<void>;
}

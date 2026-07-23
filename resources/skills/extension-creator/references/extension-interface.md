# Extension Interface

Full TypeScript interface reference for AiderDesk extensions. All methods are optional — implement only what you need.

> **IMPORTANT:** This is a comprehensive reference, but for the absolute latest types, always refer to the authoritative source: [extensions.ts on GitHub](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/extensions.ts). See also [context.ts](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/types/context.ts) for context message types and [common.ts](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/types/common.ts) for task/common types.

---

## Table of Contents

- [Extension Interface](#extension-interface)
- [ExtensionContext](#extensioncontext)
- [TaskContext](#taskcontext)
- [ProjectContext](#projectcontext)
- [MemoryContext](#memorycontext)
- [Supporting Types](#supporting-types)

---

## Extension Interface

The main interface all extensions implement. Every method is optional. Event handlers may return `void` or a partial event object to modify the event data.

### Lifecycle

```typescript
interface Extension {
  /** Called when extension is loaded. Use this to initialize state, set up resources, etc. */
  onLoad?(context: ExtensionContext): void | Promise<void>;

  /** Called when extension is unloaded. Clean up resources, save state, etc. */
  onUnload?(): void | Promise<void>;
}
```

### Registration

```typescript
interface Extension {
  /** Return array of tools this extension provides. Called on load and when tools need refresh. */
  getTools?(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[];

  /** Return array of commands this extension provides. */
  getCommands?(context: ExtensionContext): CommandDefinition[];

  /** Return array of modes this extension provides. */
  getModes?(context: ExtensionContext): ModeDefinition[];

  /** Return array of agent profiles this extension provides. */
  getAgents?(context: ExtensionContext): AgentProfile[];

  /** Return array of LLM providers this extension provides. Providers appear as read-only in the UI — the extension owns the config. */
  getProviders?(context: ExtensionContext): ProviderDefinition[];

  /** Return array of skills this extension provides. Each skill must have name, description, location, and dirPath. */
  getSkills?(context: ExtensionContext): SkillDefinition[];

  /** Return array of React UI components this extension provides (as JSX strings). */
  getUIComponents?(context: ExtensionContext): UIComponentDefinition[];

  /** Return list of npm packages that extension UI components need (resolved via esm.sh). Keys become `props.libraries.<key>`. */
  getUIComponentsLibraries?(): Record<string, string>;

  /** Return data for a specific UI component. Called on mount or when UI refresh is triggered. */
  getUIExtensionData?(componentId: string, context: ExtensionContext): Promise<unknown>;

  /** Handle an action triggered from a UI component via executeExtensionAction. */
  executeUIExtensionAction?(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown>;
}
```

### Settings Config

```typescript
interface Extension {
  /** Return this extension's settings/config UI component as a JSX string. Receives `{ config, updateConfig }` props. */
  getConfigComponent?(context: ExtensionContext): string | undefined;

  /** Return the current configuration data for this extension's settings. */
  getConfigData?(context: ExtensionContext): Promise<unknown>;

  /** Save configuration data for this extension's settings. Called when user clicks Save. */
  saveConfigData?(configData: unknown, context: ExtensionContext): Promise<unknown>;
}
```

### Profile Updates

```typescript
interface Extension {
  /** Called when a user updates an extension-provided agent profile. Extension should persist the updated profile. */
  onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;
}
```

### Task Events

```typescript
interface Extension {
  /** Called when a new task is created. Return partial event to modify task data. */
  onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;

  /** Called when a task is prepared (both new and loaded tasks). */
  onTaskPrepared?(event: TaskPreparedEvent, context: ExtensionContext): Promise<void | Partial<TaskPreparedEvent>>;

  /** Called when a task is initialized and ready for use. */
  onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void | Partial<TaskInitializedEvent>>;

  /** Called when a task is closed. */
  onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void | Partial<TaskClosedEvent>>;

  /** Called before a task is updated and saved. Modify `event.task` to change the task data before it's persisted. */
  onTaskUpdated?(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void | Partial<TaskUpdatedEvent>>;
}
```

### Project Events

```typescript
interface Extension {
  /** Called when a project is started. */
  onProjectStarted?(event: ProjectStartedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStartedEvent>>;

  /** Called when a project is closed/stopped. */
  onProjectStopped?(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStoppedEvent>>;
}
```

### Prompt Events

```typescript
interface Extension {
  /** Called when prompt processing starts. */
  onPromptStarted?(event: PromptStartedEvent, context: ExtensionContext): Promise<void | Partial<PromptStartedEvent>>;

  /** Called when prompt processing finishes. */
  onPromptFinished?(event: PromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<PromptFinishedEvent>>;

  /** Called when a prompt template is rendered. Modify `event.prompt` to override the rendered prompt. */
  onPromptTemplate?(event: PromptTemplateEvent, context: ExtensionContext): Promise<void | Partial<PromptTemplateEvent>>;
}
```

### Agent Events

```typescript
interface Extension {
  /** Called when agent mode starts. */
  onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;

  /** Called when agent mode finishes. */
  onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;

  /** Called before each agent step starts. Modify `event.messages` to change messages sent to the LLM. */
  onAgentStepStarted?(event: AgentStepStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepStartedEvent>>;

  /** Called after each agent step completes. */
  onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;

  /** Called when messages are optimized before being sent to the LLM. Modify `event.optimizedMessages` to change what's sent. */
  onOptimizeMessages?(event: OptimizeMessagesEvent, context: ExtensionContext): Promise<void | Partial<OptimizeMessagesEvent>>;

  /** Called when important reminders are added to the user message. Modify `event.remindersContent`. */
  onImportantReminders?(event: ImportantRemindersEvent, context: ExtensionContext): Promise<void | Partial<ImportantRemindersEvent>>;
}
```

### Interrupt Events

```typescript
interface Extension {
  /** Called when a response is interrupted (e.g., user clicks Stop). Set `event.blocked = true` to skip default interrupt cleanup. */
  onInterrupted?(event: InterruptedEvent, context: ExtensionContext): Promise<void | Partial<InterruptedEvent>>;
}
```

### Tool Events

```typescript
interface Extension {
  /** Called when a tool requires approval. Set `event.blocked = true` (or a reason string) to prevent execution. */
  onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;

  /** Called when a tool is about to be executed. */
  onToolCalled?(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>>;

  /** Called after tool execution completes. */
  onToolFinished?(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>>;
}
```

### File Events

```typescript
interface Extension {
  /** Called when files are added to context. Modify `event.files` to filter, add, or clear files. Return empty array to prevent addition. */
  onFilesAdded?(event: FilesAddedEvent, context: ExtensionContext): Promise<void | Partial<FilesAddedEvent>>;

  /** Called when files are dropped into the chat. Modify `event.files` to filter, add, or clear files. */
  onFilesDropped?(event: FilesDroppedEvent, context: ExtensionContext): Promise<void | Partial<FilesDroppedEvent>>;

  /** Called when rule files are retrieved. Modify `event.files` to filter, add, or clear rule files. */
  onRuleFilesRetrieved?(event: RuleFilesRetrievedEvent, context: ExtensionContext): Promise<void | Partial<RuleFilesRetrievedEvent>>;
}
```

### Message Events

```typescript
interface Extension {
  /** Called on each response chunk. */
  onResponseChunk?(event: ResponseChunkEvent, context: ExtensionContext): Promise<void | Partial<ResponseChunkEvent>>;

  /** Called on response completion. */
  onResponseCompleted?(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void | Partial<ResponseCompletedEvent>>;
}
```

### Approval Events

```typescript
interface Extension {
  /** Called when handling user approval requests. Set `event.blocked = true` to prevent approval handling. */
  onHandleApproval?(event: HandleApprovalEvent, context: ExtensionContext): Promise<void | Partial<HandleApprovalEvent>>;
}
```

### Subagent Events

```typescript
interface Extension {
  /** Called when a subagent starts. Set `event.blocked = true` to prevent subagent spawning. */
  onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;

  /** Called when a subagent finishes. */
  onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void | Partial<SubagentFinishedEvent>>;
}
```

### Question Events

```typescript
interface Extension {
  /** Called when a question is asked to the user. Event includes optional `storedAnswer` when a cached/auto answer exists. */
  onQuestionAsked?(event: QuestionAskedEvent, context: ExtensionContext): Promise<void | Partial<QuestionAskedEvent>>;

  /** Called when user answers a question. */
  onQuestionAnswered?(event: QuestionAnsweredEvent, context: ExtensionContext): Promise<void | Partial<QuestionAnsweredEvent>>;
}
```

### Command Events

```typescript
interface Extension {
  /** Called when a slash command is executed. */
  onCommandExecuted?(event: CommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CommandExecutedEvent>>;

  /** Called when a custom command is executed. Set `event.blocked = true` to prevent execution, `event.prompt` to override template. */
  onCustomCommandExecuted?(event: CustomCommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CustomCommandExecutedEvent>>;
}
```

### Aider Events (Legacy)

```typescript
interface Extension {
  /** Called when Aider prompt starts (legacy event). */
  onAiderPromptStarted?(event: AiderPromptStartedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptStartedEvent>>;

  /** Called when Aider prompt finishes (legacy event). */
  onAiderPromptFinished?(event: AiderPromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptFinishedEvent>>;
}
```

### Commit Events

```typescript
interface Extension {
  /** Called before changes are committed. Modify `event.message` and `event.amend`, or set `event.blocked = true` to prevent the commit. */
  onBeforeCommit?(event: BeforeCommitEvent, context: ExtensionContext): Promise<void | Partial<BeforeCommitEvent>>;

  /** Called after changes are committed (read-only event). */
  onAfterCommit?(event: AfterCommitEvent, context: ExtensionContext): Promise<void>;
}
```

---

## ExtensionContext

Context object passed to extension methods, providing access to AiderDesk APIs.

> **Context Availability:**
> - **Global context** (e.g., `onLoad` without project, `getAgents`, `getConfigComponent`): project and task are not available. `getProjectDir()` returns empty string, `getTaskContext()` returns null, and `getProjectContext()` throws.
> - **Project context** (e.g., event handlers, `getTools`, `getCommands`): project is available but task may not be.
> - **Task context** (e.g., task-specific event handlers, command execution): both project and task are available.

```typescript
interface ExtensionContext {
  /** Log a message prefixed with the extension name. Type defaults to 'info'. */
  log(message: string, type?: 'info' | 'error' | 'warn' | 'debug'): void;

  /** Get the current project directory path. Returns empty string when no project is available. */
  getProjectDir(): string;

  /** Get the base directories of all currently open projects (open project tabs/windows).
   *  Available regardless of whether the context itself is scoped to a project or task. */
  getOpenProjectDirs(): string[];

  /** Get the task context for the current task. Returns null when no task is available. */
  getTaskContext(): TaskContext | null;

  /** Get the project context for safe project-level operations. Throws if no project is available. */
  getProjectContext(): ProjectContext;

  /** Get all available model configurations from all enabled providers. */
  getModelConfigs(): Promise<Model[]>;

  /** Get a specific setting value from global settings using dot-notation (e.g., 'general.theme'). */
  getSetting(key: string): Promise<unknown>;

  /** Update global settings by merging the provided partial updates. */
  updateSettings(updates: Partial<SettingsData>): Promise<void>;

  /** Trigger a data refresh for UI components. Optionally target a specific component and/or task. */
  triggerUIDataRefresh(componentId?: string, taskId?: string): void;

  /** Trigger a full reload of all UI component definitions for this extension. */
  triggerUIComponentsReload(): void;

  /** Open a URL. Target: 'external' (system browser), 'window' (new Electron window), or 'modal-overlay' (iframe in modal). */
  openUrl(url: string, target?: 'external' | 'window' | 'modal-overlay'): Promise<void>;

  /** Open a file or directory in the system's default application. Returns true if opened successfully. */
  openPath(path: string): Promise<boolean>;

  /** Get a narrowed Electron App object (e.g., for getAppMetrics CPU/memory stats). Returns null when not running in Electron. */
  getElectronApp(): Promise<ElectronApp | null>;

  /** Get the memory context for vector store operations (store, retrieve, update, delete memories). */
  getMemoryContext(): MemoryContext;

  /** Truncate a tool result string that exceeds size limits (lines, bytes, tokens). Saves full content to a temp file by default. */
  truncateToolResult(
    content: string,
    maxLines?: number,
    maxSizeKB?: number,
    maxTokens?: number,
    saveToFile?: boolean,
    truncationSuffix?: string,
  ): Promise<string>;
}
```

### ElectronApp and Related Types

```typescript
/** Narrow subset of Electron's App object exposed to extensions. */
interface ElectronApp {
  /** Returns process metrics (memory + CPU usage) for all app processes. Memory is in KB. */
  getAppMetrics(): ElectronProcessMetric[];
  /** Current application version. */
  getVersion(): string;
  /** Current application name. */
  getName(): string;
  /** True when the application has finished initializing. */
  isReady(): boolean;
}

interface ElectronCPUUsage {
  /** Percentage of CPU used since last call (0–100). */
  percentCPUUsage?: number;
  /** Cumulative CPU time in seconds since process start. */
  cumulativeCPUUsage?: number;
}

interface ElectronMemoryInfo {
  /** Working set size in KB. */
  workingSetSize?: number;
  /** Peak working set size in KB. */
  peakWorkingSetSize?: number;
}

interface ElectronProcessMetric {
  pid?: number;
  /** One of: Browser, Renderer, GPU, Utility, etc. */
  type?: string;
  serviceName?: string;
  name?: string;
  cpu?: ElectronCPUUsage;
  memory?: ElectronMemoryInfo;
}
```

---

## TaskContext

Safe subset of Task capabilities exposed to extensions. Provides read-only access to task data and safe write operations.

### Task Data

```typescript
interface TaskContext {
  /** Read-only snapshot of the current task state (id, name, status, mode, all persisted fields). */
  readonly data: TaskData;
}
```

### Context Files (Read + Safe Write)

```typescript
interface TaskContext {
  /** Get the list of files currently in the task's context. */
  getContextFiles(): Promise<ContextFile[]>;

  /** Add a single file to the task's context by path. Dispatches `onFilesAdded` event before adding. */
  addFile(path: string, readOnly?: boolean): Promise<void>;

  /** Add multiple files to the task's context at once. Dispatches `onFilesAdded` for each file. */
  addFiles(...files: ContextFile[]): Promise<void>;

  /** Remove a file from the task's context by path. Dispatches `onFilesDropped` event before removing. */
  dropFile(path: string): Promise<void>;
}
```

### Context Messages (Read + Safe Write)

```typescript
interface TaskContext {
  /** Get the full conversation history from the task's context manager. */
  getContextMessages(): Promise<ContextMessage[]>;

  /** Append a message to the context messages. Auto-saves to disk. */
  addContextMessage(message: ContextMessage, updateContextInfo?: boolean): Promise<void>;

  /** Remove a specific message from the context by its ID. */
  removeMessage(messageId: string): Promise<void>;

  /** Remove the most recent message from the context. */
  removeLastMessage(): Promise<void>;

  /** Remove a message and all messages after it (inclusive). */
  removeMessagesUpTo(messageId: string): Promise<void>;

  /** Load a set of messages, replacing the current in-memory messages. Used for loading pre-authored context. */
  loadContextMessages(messages: ContextMessage[]): Promise<void>;

  /** Re-execute a user prompt at a specific message ID, optionally with a different mode or edited text. */
  redoUserPrompt(messageId: string, mode?: string, updatedPrompt?: string): Promise<void>;

  /** Re-execute the last user prompt. Convenience method that finds the last user message and calls redoUserPrompt. */
  redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void>;
}
```

### UI Messages

```typescript
interface TaskContext {
  /** Send a user message to the UI for display. Does NOT add to context or persist. */
  addUserMessage(id: string, content: string, promptContext?: PromptContext): void;

  /** Send a tool execution message to the UI. Optionally persists via data manager. */
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

  /** Process a response message — streams chunks to UI, sends completed response when finished. Dispatches `onResponseChunk` and `onResponseCompleted`. */
  addResponseMessage(message: ResponseMessage, saveToDb?: boolean): Promise<void>;
}
```

### Files & Repo (Read-only)

```typescript
interface TaskContext {
  /** Get the working directory for this task (worktree path or project base directory). */
  getTaskDir(): string;

  /** Get files that can be added to context (not already in context), optionally filtered by regex. */
  getAddableFiles(searchRegex?: string): Promise<string[]>;

  /** Get all files in the task directory, optionally filtered by git tracking. */
  getAllFiles(useGit?: boolean): Promise<string[]>;

  /** Get files modified during the current task's execution (compares against main branch). */
  getUpdatedFiles(): Promise<UpdatedFile[]>;

  /** Get the cached repository map string summarizing the codebase structure. */
  getRepoMap(): string;

  /** Stage a file in git (equivalent to `git add`). No-op if not a git repo. */
  addToGit(path: string): Promise<void>;
}
```

### Todos

```typescript
interface TaskContext {
  /** Get all todo items for this task. */
  getTodos(): Promise<TodoItem[]>;

  /** Create a new uncompleted todo item. Returns updated array of all todos. */
  addTodo(name: string): Promise<TodoItem[]>;

  /** Update an existing todo item's properties (e.g., `{ completed: true }`). Returns updated array. */
  updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>;

  /** Remove a todo item by name. Returns updated array. */
  deleteTodo(name: string): Promise<TodoItem[]>;

  /** Remove all todo items. Returns empty array. */
  clearAllTodos(): Promise<TodoItem[]>;

  /** Replace the entire todo list with the provided items. */
  setTodos(items: TodoItem[], initialUserPrompt?: string): Promise<void>;
}
```

### Execution

```typescript
interface TaskContext {
  /** Submit a prompt for processing. If a prompt is running, the new one is queued. */
  runPrompt(prompt: string, mode?: string): Promise<void>;

  /** Execute a prompt directly using a specific agent profile. Returns array of response completion data. */
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

  /** Execute a registered custom command by name. */
  runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;

  /** Spawn a subagent with the given profile and prompt. Dispatches `onSubagentStarted` and `onSubagentFinished`. */
  runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;

  /** Execute a slash command in the task's context. Dispatches `onCommandExecuted`. */
  runCommand(command: string): Promise<void>;

  /** Interrupt the currently running agent response or subagent. */
  interruptResponse(): Promise<void>;

  /** Generate text using a specific model without running the full agent loop. */
  generateText(modelId: string, systemPrompt: string, prompt: string): Promise<string | undefined>;

  /** Generate a structured object using a specific model and Zod schema, without running the full agent loop. */
  generateObject<T>(modelId: string, systemPrompt: string, prompt: string, schema: z.ZodType<T>): Promise<T | undefined>;
}
```

### User Interaction

```typescript
interface TaskContext {
  /** Ask the user a question and wait for their response. Supports answer choices via QuestionOptions. */
  askQuestion(text: string, options?: QuestionOptions): Promise<string>;

  /** Send a log message to the UI (appears in the task's message stream). */
  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void;

  /** Show or update a loading indicator in the task's UI. Pass `finished: true` to dismiss. */
  addLoadingMessage(message?: string, finished?: boolean): void;
}
```

### Task Management

```typescript
interface TaskContext {
  /** Update the task's data with partial changes and persist them. */
  updateTask(updates: Partial<TaskData>): Promise<TaskData>;

  /** Generate a handoff summary and optionally execute a follow-up prompt. */
  handoffConversation(focus?: string, execute?: boolean): Promise<void>;
}
```

### Context Management

```typescript
interface TaskContext {
  /** Clear the task's conversation context (messages, connectors, UI). */
  clearContext(): Promise<void>;

  /** Reset the task context by clearing both context files and messages, then saving to disk. */
  resetContext(): Promise<void>;

  /** Compact the conversation by summarizing history via a compact-conversation agent. */
  compactConversation(instructions?: string): Promise<void>;

  /** Generate a markdown representation of the context messages. */
  generateContextMarkdown(): Promise<string | null>;

  /** Check whether the task has been fully initialized and is ready for use. */
  isInitialized(): boolean;

  /** Update the autocompletion data sent to the UI. */
  updateAutocompletionWords(words?: string[]): Promise<void>;
}
```

### Queued Prompts

```typescript
interface TaskContext {
  /** Get all prompts currently queued for execution. */
  getQueuedPrompts(): QueuedPromptData[];

  /** Immediately execute a queued prompt by moving it to the front and interrupting the current response. */
  sendQueuedPromptNow(promptId: string): Promise<void>;

  /** Remove a prompt from the execution queue without running it. */
  removeQueuedPrompt(promptId: string): void;

  /** Reorder the queued prompts to a specific arrangement. */
  reorderQueuedPrompts(prompts: QueuedPromptData[]): void;

  /** Edit the text content of an existing queued prompt. */
  editQueuedPrompt(promptId: string, newText: string): void;
}
```

### Advanced

```typescript
interface TaskContext {
  /** Get the agent profile assigned to this task (checks task-level, then project-level). Returns null if none configured. */
  getTaskAgentProfile(): Promise<AgentProfile | null>;

  /** Programmatically answer a pending question. Returns true if a question was answered, false if none pending. */
  answerQuestion(answer: string, userInput?: string): Promise<boolean>;
}
```

### Working Mode & Worktrees

```typescript
interface TaskContext {
  /** Switch the task to worktree working mode, optionally carrying over uncommitted changes. */
  switchToWorktreeWorkingMode(options?: SwitchToWorktreeOptions): Promise<void>;

  /** Switch the task to local working mode, optionally merging the worktree branch first. */
  switchToLocalWorkingMode(options?: SwitchToLocalOptions): Promise<void>;

  /** Get uncommitted files from the project's main repository (not from a worktree). */
  getLocalUncommittedFiles(): Promise<WorktreeUncommittedFiles>;

  /** Apply uncommitted changes from the task's worktree to a target branch in the main repository. */
  applyUncommittedChanges(targetBranch?: string): Promise<void>;

  /** Merge commits and optionally uncommitted changes from this task's worktree to a target worktree directory. */
  mergeWorktreeToWorktree(targetWorktreeDir: string, includeUncommitted?: boolean): Promise<void>;
}

### Resume

```typescript
interface TaskContext {
  /** Resume the task — starts execution as if the user clicked the "Execute"/"Resume" button.
   *  In agent mode, this runs the last user prompt through the agent pipeline.
   *  In Aider modes, this re-executes the last user message.
   *  No-op if the task is already running or has no prior user message to resume from. */
  resumeTask(): Promise<void>;
}
```

---

## ProjectContext

Safe subset of Project capabilities exposed to extensions. Provides read-only access to project data and safe operations.

```typescript
interface ProjectContext {
  /** Absolute path to the project's root directory. */
  readonly baseDir: string;

  /** Create a new task within the project. Inherits settings from the most recent task (or parent task). */
  createTask(params: CreateTaskParams): Promise<TaskData>;

  /** Get a TaskContext for a specific loaded task by ID. Returns null if not loaded. */
  getTask(taskId: string): TaskContext | null;

  /** Get all loaded tasks in the project (most recent first). */
  getTasks(): Promise<TaskData[]>;

  /** Get the TaskContext for the most recently updated task, or null if no tasks exist. */
  getMostRecentTask(): TaskContext | null;

  /** Fork a task at a specific message, creating a new subtask. Copies context up to and including the specified message. */
  forkTask(taskId: string, messageId: string): Promise<TaskData>;

  /** Create a duplicate of an existing task (copies all context messages and files). */
  duplicateTask(taskId: string): Promise<TaskData>;

  /** Permanently delete a task and all its subtasks. */
  deleteTask(taskId: string): Promise<void>;

  /** Get all agent profiles available for this project (built-in, user-defined, and extension-provided). */
  getAgentProfiles(): AgentProfile[];

  /** Get all custom commands registered in the project (file-based and extension-provided). */
  getCommands(): CommandsData;

  /** Get the project-level settings. */
  getProjectSettings(): ProjectSettings;

  /** Load the input history file for the project (most recent first). */
  getInputHistory(): Promise<string[]>;
}
```

---

## MemoryContext

Provides access to AiderDesk's memory system. Uses the same underlying vector store as the built-in memory MCP tools.

```typescript
interface MemoryContext {
  /** Store a new memory entry. Returns the ID of the created memory. */
  storeMemory(projectId: string, taskId: string, type: MemoryEntryType, content: string): Promise<string>;

  /** Retrieve memories by semantic similarity. Returns array ranked by relevance. */
  retrieveMemories(projectId: string, query: string, limit?: number): Promise<MemoryEntry[]>;

  /** Get a single memory by ID. */
  getMemory(id: string): Promise<MemoryEntry | null>;

  /** Delete a specific memory by ID. */
  deleteMemory(id: string): Promise<boolean>;

  /** Update the content of an existing memory. */
  updateMemory(id: string, content: string): Promise<boolean>;

  /** Get all stored memories. */
  getAllMemories(): Promise<MemoryEntry[]>;

  /** Check if the memory system is enabled and initialized. */
  isMemoryEnabled(): boolean;

  /** Enable or disable the memory system. Persists the setting. */
  setMemoryEnabled(enabled: boolean): void;
}
```

### MemoryEntryType

```typescript
enum MemoryEntryType {
  Task = 'task',
  UserPreference = 'user-preference',
  CodePattern = 'code-pattern',
}
```

### MemoryEntry

```typescript
interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryEntryType;
  taskId?: string;
  projectId?: string;
  timestamp: number;
}
```

---

## Supporting Types

### ExtensionMetadata

```typescript
interface ExtensionMetadata {
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
  /** Optional URL to an icon image */
  iconUrl?: string;
  /** Optional list of supported operating systems. If undefined, all OSes are supported. */
  supportedOS?: OS[];
}
```

### ResponseMessage

```typescript
interface ResponseMessage {
  id: string;
  content: string;
  reasoning?: string;
  reflectedMessage?: string;
  finished: boolean;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
  timestamp?: number;
}
```

### QuestionOptions

> ⚠️ **CRITICAL:** There is **no `options` field** on `QuestionOptions`. Multiple-choice answers are provided via the **`answers`** array, where each entry has `{ text, shortkey }`.

```typescript
interface QuestionOptions {
  /** Optional subject/title for the question dialog */
  subject?: string;
  /** Multiple-choice answers. Each has display text and a short key (e.g., 'y', 'n'). */
  answers?: Array<{ text: string; shortkey: string }>;
  /** Default answer if user doesn't choose */
  defaultAnswer?: string;
}
```

### CreateTaskParams

```typescript
interface CreateTaskParams {
  parentId?: string | null;
  name?: string;
  autonomyMode?: AutonomyMode;
  activate?: boolean;
  handoff?: boolean;
  sendEvent?: boolean;
  provider?: string;
  model?: string;
  agentProfileId?: string;
  mode?: Mode;
  workingMode?: WorkingMode;
  addInitialContextFiles?: boolean;
}
```

### ContextMessage

`ContextMessage` is a union type representing messages in the conversation context. The `content` field varies by role:

```typescript
type ContextMessage = ContextUserMessage | ContextAssistantMessage | ContextToolMessage;

interface ContextUserMessage {
  id: string;
  role: 'user';
  content: UserContent;   // string | Array<TextPart | ImagePart | FilePart>
  timestamp?: number;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

interface ContextAssistantMessage {
  id: string;
  role: 'assistant';
  content: AssistantContent;  // string | Array<TextPart | FilePart | ReasoningPart | ToolCallPart | ToolResultPart>
  reflectedMessage?: string;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
  timestamp?: number;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}

interface ContextToolMessage {
  id: string;
  role: 'tool';
  content: ToolContent;  // Array<ToolResultPart>
  timestamp?: number;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
}
```

The `content` can be a plain **string** (for user/assistant messages) or an **array of parts**. To extract plain text from any content:

```typescript
function extractText(content: UserContent | AssistantContent): string {
  if (typeof content === 'string') return content;
  return content
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}
```

### Content Part Types

```typescript
interface TextPart { type: 'text'; text: string; }
interface ImagePart { type: 'image'; image: DataContent | URL; mediaType?: string; }
interface FilePart { type: 'file'; data: DataContent | URL; filename?: string; mediaType: string; }
interface ReasoningPart { type: 'reasoning'; text: string; }
interface ToolCallPart { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown; }
interface ToolResultPart { type: 'tool-result'; toolCallId: string; toolName: string; output: ToolResultOutput; }
```

### ContextFile

```typescript
interface ContextFile {
  path: string;
  readOnly?: boolean;
  source?: 'global-rule' | 'project-rule' | 'agent-rule';
}
```

### UIComponentPlacement

> ⚠️ There is **no generic `'floating'`** placement. Use `'task-floating'`, `'project-floating'`, or `'app-floating'`.

```typescript
type UIComponentPlacement =
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
  | 'tasks-sidebar-actions-left'
  | 'tasks-sidebar-actions-right'
  | 'task-message'
  | 'task-message-above'
  | 'task-message-below'
  | 'task-message-bar'
  | 'task-top-bar-left'
  | 'task-top-bar-right'
  | 'task-state-actions'
  | 'task-state-actions-all'
  | 'task-sidebar-item-badges'
  | 'welcome-page'
  | 'task-floating'
  | 'project-floating'
  | 'app-floating';
```

### UIComponentDefinition

```typescript
interface UIComponentDefinition {
  /** Unique component identifier */
  id: string;
  /** Where in UI to render this component */
  placement: UIComponentPlacement;
  /** Display name (used as floating panel title, tooltip, etc.) */
  name?: string;
  /** JSX/TSX component as string to be parsed by string-to-react-component */
  jsx: string;
  /** If true, component will load data from extension via getUIExtensionData (default: false) */
  loadData?: boolean;
  /** If true, data is always fetched fresh on render — disables caching (default: false) */
  noDataCache?: boolean;
  /** Optional filter for which messages this component should handle (for task-message placement) */
  messageFilter?: MessageFilter;
}
```

### MessageFilter

```typescript
interface MessageFilter {
  /** Message types this component handles (e.g., 'user', 'tool', 'response', 'log') */
  types?: string[];
  /** For tool messages: filter by server name */
  serverName?: string;
  /** For tool messages: filter by tool name */
  toolName?: string;
}
```

### UIComponents

Common UI components available to extension JSX components via `props.ui`:

```typescript
interface UIComponents {
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
  ModalOverlayLayout: UIComponent;
}
```

### ToolDefinition

```typescript
interface ToolDefinition<TSchema extends z.ZodType = z.ZodType<Record<string, unknown>>> {
  /** Tool identifier in kebab-case (e.g., 'run-linter') */
  name: string;
  /** Description for LLM to understand tool purpose */
  description: string;
  /** Zod schema for parameter validation */
  inputSchema: TSchema;
  /** Execute function with type-safe args */
  execute: (
    input: z.infer<TSchema>,
    signal: AbortSignal | undefined,
    context: ExtensionContext,
    allTools: Record<string, Tool>,
  ) => Promise<unknown>;
}
```

### CommandDefinition

```typescript
interface CommandDefinition {
  /** Command name in kebab-case (e.g., 'generate-tests') */
  name: string;
  /** Description shown in autocomplete */
  description: string;
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Execute function that handles the complete command logic */
  execute: (args: string[], context: ExtensionContext) => Promise<void>;
}
```

### ProviderDefinition

```typescript
interface ProviderDefinition {
  /** Unique provider identifier (e.g., 'my-provider') */
  id: string;
  /** Provider name — can be new or a built-in provider name to override */
  name: string;
  /** Provider configuration (not UI-editable, extension-owned) */
  provider: { name: string; [key: string]: unknown };
  /** Provider strategy implementation */
  strategy: ExtensionProviderStrategy;
  /** Optional HTTP headers for API requests */
  headers?: Record<string, string>;
}
```

### Event Payload Types

<details>
<summary>Click to expand all event payload interfaces</summary>

```typescript
interface TaskCreatedEvent { task: TaskData; }
interface TaskPreparedEvent { task: TaskData; }
interface TaskInitializedEvent { readonly task: TaskData; }
interface TaskClosedEvent { readonly task: TaskData; }
interface TaskUpdatedEvent { task: TaskData; }

interface ProjectStartedEvent { readonly baseDir: string; }
interface ProjectStoppedEvent { readonly baseDir: string; }

interface PromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  blocked?: boolean;
}

interface PromptFinishedEvent {
  responses: ResponseCompletedData[];
}

interface PromptTemplateEvent {
  readonly name: string;
  readonly data: unknown;
  prompt: string;
}

interface AgentStartedEvent {
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
  images?: string[];
  skillsToActivate?: string[];
}

interface AgentFinishedEvent {
  readonly mode: Mode;
  readonly aborted: boolean;
  readonly contextMessages: ContextMessage[];
  resultMessages: ContextMessage[];
}

interface AgentStepStartedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly iterationCount: number;
  messages: ContextMessage[];
}

interface AgentStepFinishedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly stepResult: AgentStepResult;
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
  responseMessages: ContextMessage[];
}

interface OptimizeMessagesEvent {
  readonly originalMessages: ContextMessage[];
  optimizedMessages: ContextMessage[];
}

interface ImportantRemindersEvent {
  /** @deprecated Use `agentProfile` instead. */
  readonly profile: AgentProfile;
  readonly agentProfile: AgentProfile;
  remindersContent: string;
}

interface ToolApprovalEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  blocked?: boolean | string;
  allowed?: boolean;
}

interface ToolCalledEvent {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly agentProfile: AgentProfile;
  readonly abortSignal?: AbortSignal;
  input: Record<string, unknown> | undefined;
  output?: unknown;
}

interface ToolFinishedEvent {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly agentProfile: AgentProfile;
  readonly input: Record<string, unknown> | undefined;
  output: unknown;
}

interface FilesAddedEvent { files: ContextFile[]; }
interface FilesDroppedEvent { files: ContextFile[]; }
interface RuleFilesRetrievedEvent { files: ContextFile[]; }

interface ResponseChunkEvent { chunk: ResponseChunkData; }
interface ResponseCompletedEvent { response: ResponseCompletedData; }

interface HandleApprovalEvent {
  key: string;
  text: string;
  subject?: string;
  blocked?: boolean;
  allowed?: boolean;
}

interface SubagentStartedEvent {
  subagentProfile: AgentProfile;
  prompt: string;
  promptContext?: PromptContext;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
  systemPrompt?: string;
  blocked?: boolean;
}

interface SubagentFinishedEvent {
  readonly subagentProfile: AgentProfile;
  resultMessages: ContextMessage[];
}

interface QuestionAskedEvent {
  question: QuestionData;
  readonly storedAnswer?: string;
  answer?: string;
}

interface QuestionAnsweredEvent {
  readonly question: QuestionData;
  answer: string;
  userInput?: string;
}

interface CommandExecutedEvent {
  command: string;
  blocked?: boolean;
}

interface CustomCommandExecutedEvent {
  command: CustomCommand;
  mode: Mode;
  blocked?: boolean;
  prompt?: string;
}

interface AiderPromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  messages: ConnectorMessage[];
  files: ContextFile[];
  blocked?: boolean;
  autonomyMode?: AutonomyMode;
  denyCommands?: boolean;
}

interface AiderPromptFinishedEvent {
  responses: ResponseCompletedData[];
}

interface InterruptedEvent {
  /** Optional interrupt ID for targeting a specific subagent or conflict-resolution agent */
  interruptId?: string;
  /** Set to true by extension to skip the default interrupt cleanup */
  blocked?: boolean;
}

interface BeforeCommitEvent {
  message: string;
  amend: boolean;
  blocked?: boolean;
}

interface AfterCommitEvent {
  readonly message: string;
  readonly amend: boolean;
}
```

</details>

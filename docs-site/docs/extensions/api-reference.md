# API Reference

This page provides complete API documentation for the extension system.

## Extension Interface

The main interface that all extensions must implement. All methods are optional - implement only what you need.

```typescript
interface Extension {
  // Lifecycle
  onLoad?(context: ExtensionContext): void | Promise<void>;
  onUnload?(): void | Promise<void>;

  // Registration
  getTools?(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[];

  getCommands?(context: ExtensionContext): CommandDefinition[];
  getModes?(context: ExtensionContext): ModeDefinition[];
  getAgents?(context: ExtensionContext): AgentProfile[];

  // UI Components
  getUIComponents?(context: ExtensionContext): UIComponentDefinition[];
  getUIExtensionData?(componentId: string, context: ExtensionContext): Promise<unknown>;
  executeUIExtensionAction?(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown>;

  // Agent Profile Updates
  onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;

  // Event Handlers - See Events Reference for details
  onTaskCreated?(event, context): Promise<void | Partial<Event>>;
  onPromptTemplate?(event, context): Promise<void | Partial<PromptTemplateEvent>>;
  // ... and more event handlers
}
```

## ExtensionContext

Passed to all extension methods, providing access to AiderDesk APIs.

```typescript
interface ExtensionContext {
  // Logging
  log(message: string, type?: 'info' | 'error' | 'warn' | 'debug'): void;

  // Project access
  getProjectDir(): string;
  getProjectContext(): ProjectContext;

  // Task access
  getTaskContext(): TaskContext | null;

  // Memory access
  getMemoryContext(): MemoryContext;

  // Model access
  getModelConfigs(): Promise<Model[]>;

  // Settings access
  getSetting(key: string): Promise<unknown>;
  updateSettings(updates: Partial<SettingsData>): Promise<void>;

  // UI refresh
  triggerUIDataRefresh(componentId?: string, taskId?: string): void;
  triggerUIComponentsReload(): void;
  
  // Navigation
  openUrl(url: string, target?: 'external' | 'window' | 'modal-overlay'): Promise<void>;
  openPath(path: string): Promise<boolean>;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `log(message, type?)` | Log a message to AiderDesk console and log files |
| `getProjectDir()` | Get the current project directory path |
| `getTaskContext()` | Get the current task context (null if no task active) |
| `getProjectContext()` | Get the project context for project operations |
| `getMemoryContext()` | Get the memory context for store/retrieve/delete memory operations |
| `getModelConfigs()` | Get all available model configurations |
| `getSetting(key)` | Get a setting value (supports dot-notation) |
| `updateSettings(updates)` | Update multiple settings at once |
| `triggerUIDataRefresh(componentId?, taskId?)` | Trigger UI component data refresh |
| `triggerUIComponentsReload()` | Reload all UI component definitions for this extension |
| `openUrl(url, target?)` | Open URL in external browser, new window, or modal overlay |
| `openPath(path)` | Open file or directory in system's default application |

## TaskContext

Safe subset of Task capabilities exposed to extensions.

```typescript
interface TaskContext {
  readonly data: TaskData;

  // Context Files
  getContextFiles(): Promise<ContextFile[]>;
  addFile(path: string, readOnly?: boolean): Promise<void>;
  addFiles(...files: ContextFile[]): Promise<void>;
  dropFile(path: string): Promise<void>;
  getAddableFiles(searchRegex?: string): Promise<string[]>;
  getAllFiles(useGit?: boolean): Promise<string[]>;
  getUpdatedFiles(): Promise<UpdatedFile[]>;

  // Context Messages
  getContextMessages(): Promise<ContextMessage[]>;
  addContextMessage(message: ContextMessage, updateContextInfo?: boolean): Promise<void>;
  removeMessage(messageId: string): Promise<void>;
  removeLastMessage(): Promise<void>;
  removeMessagesUpTo(messageId: string): Promise<void>;
  loadContextMessages(messages: ContextMessage[]): Promise<void>;

  // Message Helpers
  addUserMessage(id: string, content: string, promptContext?: PromptContext): void;
  addToolMessage(id: string, serverName: string, toolName: string, input?: unknown, response?: string, usageReport?: UsageReportData, promptContext?: PromptContext, saveToDb?: boolean, finished?: boolean): void;
  addResponseMessage(message: ResponseMessage, saveToDb?: boolean): Promise<void>;

  // Execution
  runPrompt(prompt: string, mode?: string): Promise<void>;
  runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;
  runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;
  runCommand(command: string): Promise<void>;
  interruptResponse(): Promise<void>;
  generateText(modelId: string, systemPrompt: string, prompt: string): Promise<string | undefined>;

  // User Interaction
  askQuestion(text: string, options?: QuestionOptions): Promise<string>;
  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void;
  addLoadingMessage(message?: string, finished?: boolean): void;

  // Todos
  getTodos(): Promise<TodoItem[]>;
  addTodo(name: string): Promise<TodoItem[]>;
  updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>;
  deleteTodo(name: string): Promise<TodoItem[]>;
  clearAllTodos(): Promise<TodoItem[]>;
  setTodos(items: TodoItem[], initialUserPrompt?: string): Promise<void>;

  // Task Management
  updateTask(updates: Partial<TaskData>): Promise<TaskData>;
  getTaskDir(): string;
  getTaskAgentProfile(): Promise<AgentProfile | null>;
  isInitialized(): boolean;

  // Context Operations
  getRepoMap(): string;
  generateContextMarkdown(): Promise<string | null>;
  clearContext(): Promise<void>;
  resetContext(): Promise<void>;
  compactConversation(instructions?: string): Promise<void>;
  handoffConversation(focus?: string, execute?: boolean): Promise<void>;
  updateAutocompletionWords(words?: string[]): Promise<void>;

  // Git
  addToGit(path: string): Promise<void>;

  // Questions
  answerQuestion(answer: string, userInput?: string): Promise<boolean>;

  // Queued Prompts
  getQueuedPrompts(): QueuedPromptData[];
  sendQueuedPromptNow(promptId: string): Promise<void>;
  removeQueuedPrompt(promptId: string): void;

  // Redo
  redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void>;
}
```

## ProjectContext

Safe subset of Project capabilities exposed to extensions.

```typescript
interface ProjectContext {
  readonly baseDir: string;

  // Task Management
  createTask(params: CreateTaskParams): Promise<TaskData>;
  getTask(taskId: string): TaskContext | null;
  getTasks(): Promise<TaskData[]>;
  getMostRecentTask(): TaskContext | null;
  forkTask(taskId: string, messageId: string): Promise<TaskData>;
  duplicateTask(taskId: string): Promise<TaskData>;
  deleteTask(taskId: string): Promise<void>;

  // Configuration
  getAgentProfiles(): AgentProfile[];
  getCommands(): CommandsData;
  getProjectSettings(): ProjectSettings;

  // History
  getInputHistory(): Promise<string[]>;
}
```

## ToolDefinition

Define custom tools that the AI can use.

```typescript
interface ToolDefinition<TSchema extends z.ZodType = z.ZodType<Record<string, unknown>>> {
  name: string;              // Tool identifier in kebab-case
  description: string;       // Description for the LLM
  inputSchema: TSchema;      // Zod schema for parameter validation
  execute: (                 // Execute function
    input: z.infer<TSchema>,
    signal: AbortSignal | undefined,
    context: ExtensionContext
  ) => Promise<unknown>;
}
```

### Example

```typescript
const myTool: ToolDefinition = {
  name: 'run-linter',
  description: 'Run the project linter',
  inputSchema: z.object({
    fix: z.boolean().optional().describe('Auto-fix issues'),
    files: z.array(z.string()).optional().describe('Files to lint'),
  }),
  async execute(input, signal, context) {
    // Your implementation
    return { results: '...' };
  },
};
```

## CommandDefinition

Define custom slash commands.

```typescript
interface CommandDefinition {
  name: string;              // Command name in kebab-case
  description: string;       // Description shown in autocomplete
  arguments?: CommandArgument[];  // Optional command arguments
  execute: (args: string[], context: ExtensionContext) => Promise<void>;
}

interface CommandArgument {
  description: string;
  required?: boolean;
  options?: string[];
}
```

### Example

```typescript
const myCommand: CommandDefinition = {
  name: 'generate-tests',
  description: 'Generate unit tests for a file',
  arguments: [
    { description: 'File path', required: true },
    { description: 'Framework (jest, vitest)', required: false },
  ],
  async execute(args, context) {
    const filePath = args[0];
    const framework = args[1] || 'vitest';
    // Your implementation
  },
};
```

## ModeDefinition

Define custom chat modes.

```typescript
interface ModeDefinition {
  name: Mode;           // Mode identifier
  label: string;        // Display name
  description?: string; // Optional description
  icon?: string;        // Optional icon from react-icons (e.g., 'FiCode')
}
```

### Example

```typescript
const planMode: ModeDefinition = {
  name: 'plan',
  label: 'Plan',
  description: 'Plan before coding - no file modifications',
  icon: 'FiClipboard',
};
```

## UIComponentDefinition

Define custom React components that render in AiderDesk's UI.

**Important:** The `jsx` property must be a **string** containing the component code, not a function. The `React` object is globally available within components (not passed as a prop).

```typescript
interface UIComponentDefinition {
  id: string;                      // Unique component identifier
  placement: UIComponentPlacement; // Where to render the component
  jsx: string;                     // JSX/TSX component as string
  loadData?: boolean;              // Enable data loading via getUIExtensionData (default: false)
  noDataCache?: boolean;           // Always fetch fresh data on render (default: false)
}
```

### Example

```typescript
const myComponent: UIComponentDefinition = {
  id: 'my-status-indicator',
  placement: 'task-status-bar-right',
  loadData: true,
  jsx: `
(props) => {
  const { ui, data, task } = props;
  const { useState } = React;
  const { Tooltip } = ui;
  
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <Tooltip content="Task status">
      <div 
        className="flex items-center gap-1 text-xs"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span className="w-2 h-2 rounded-full bg-success" />
        <span>{task?.name || 'No task'}</span>
      </div>
    </Tooltip>
  );
}
  `,
};
```

### Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Unique identifier for the component |
| `placement` | `UIComponentPlacement` | Yes | Where to render the component (see placements below) |
| `jsx` | `string` | Yes | JSX/TSX component code as a string |
| `loadData` | `boolean` | No | Enable data loading via `getUIExtensionData()` |
| `noDataCache` | `boolean` | No | Disable caching - always fetch fresh data |

## UIComponentPlacement

Available placement locations for UI components (21 total).

```typescript
type UIComponentPlacement =
  // Task Status Bar
  | 'task-status-bar-left'        // Left side of task status bar (top of task page)
  | 'task-status-bar-right'       // Right side of task status bar
  
  // Task Top Bar
  | 'task-top-bar-left'           // Left side of task top bar (above messages)
  | 'task-top-bar-right'          // Right side of task top bar
  
  // Task Messages
  | 'task-messages-top'           // Above all messages
  | 'task-messages-bottom'        // Below all messages
  | 'task-message-above'          // Above each message (receives message prop)
  | 'task-message-below'          // Below each message (receives message prop)
  | 'task-message-bar'            // In message action bar (receives message prop)
  
  // Task Usage Info
  | 'task-usage-info-bottom'      // Below usage info (tokens, costs)
  
  // Task Input
  | 'task-input-above'            // Above input field
  | 'task-input-toolbar-left'     // Left side of input toolbar
  | 'task-input-toolbar-right'    // Right side of input toolbar
  
  // Task State Actions
  | 'task-state-actions'          // Action buttons (when stopped/waiting)
  | 'task-state-actions-all'      // Action buttons (all states)
  
  // Sidebar
  | 'tasks-sidebar-header'        // Header of tasks sidebar
  | 'tasks-sidebar-bottom'        // Bottom of tasks sidebar
  
  // Header
  | 'header-left'                 // Left side of main header
  | 'header-right'                // Right side of main header
  
  // Welcome Page
  | 'welcome-page'                // Full welcome page (no task open)
  | 'tasks-sidebar-header'
  | 'tasks-sidebar-bottom'
  | 'task-message-above'
  | 'task-message-below'
  | 'task-message-bar'
  | 'task-top-bar-left'
  | 'task-top-bar-right'
  | 'task-state-actions';
```

## UI Component Props

**Important:** The `React` object is globally available in all UI components (not passed as a prop). Access hooks via `React.useState`, `React.useEffect`, etc.

Props passed to UI component functions:

```typescript
interface UIComponentProps {
  // Context data
  projectDir?: string;              // Project directory path
  task?: TaskData;                  // Current task data
  agentProfile?: AgentProfile;      // Current agent profile
  models: Model[];                  // Available AI models
  providers: ProviderProfile[];     // Available provider profiles
  
  // UI library
  ui: UIComponents;                 // Pre-built UI components
  
  // Icons library (organized by icon set)
  icons: Record<string, Record<string, IconComponent>>;
  
  // Extension integration
  executeExtensionAction: (action: string, ...args: unknown[]) => Promise<unknown>;
  
  // Data from getUIExtensionData() (if loadData: true)
  data?: unknown;
  
  // Message-specific (for message placements)
  message?: MessageData;
}
```

### Using React Hooks

```jsx
(props) => {
  const { useState, useEffect, useCallback } = React;
  const [count, setCount] = useState(0);
  
  const handleClick = useCallback(() => {
    setCount(count + 1);
  }, [count]);
  
  return <button onClick={handleClick}>Count: {count}</button>;
}
```

### Using Icons

The `icons` prop provides access to all react-icons libraries:

```jsx
(props) => {
  const { icons } = props;
  const FiSettings = icons.Fi.FiSettings;
  const HiCheck = icons.Hi.HiCheck;
  
  return (
    <div>
      <FiSettings className="w-4 h-4" />
      <HiCheck className="w-5 h-5 text-success" />
    </div>
  );
}
```

Available icon sets: `Ai`, `Bi`, `Bs`, `Cg`, `Ci`, `Di`, `Fa`, `Fc`, `Fi`, `Gi`, `Go`, `Gr`, `Hi`, `Im`, `Io`, `Io5`, `Lu`, `Md`, `Pi`, `Ri`, `Rx`, `Si`, `Sl`, `Tb`, `Tfi`, `Ti`, `Vsc`, `Wi`

## UIComponents

Pre-built UI components available via `props.ui`:

```typescript
interface UIComponents {
  Button: UIComponent;            // Standard button with variants
  IconButton: UIComponent;        // Button with icon only
  Checkbox: UIComponent;          // Checkbox input with label
  Input: UIComponent;             // Text input field
  Select: UIComponent;            // Dropdown select
  MultiSelect: UIComponent;       // Multi-value select
  TextArea: UIComponent;          // Multi-line text input
  RadioButton: UIComponent;       // Radio button input
  Slider: UIComponent;            // Range slider
  DatePicker: UIComponent;        // Date picker
  Chip: UIComponent;              // Tag/chip component
  ModelSelector: UIComponent;     // AiderDesk model selector
  Tooltip: UIComponent;           // Tooltip wrapper
  LoadingOverlay: UIComponent;    // Loading spinner with message
  ConfirmDialog: UIComponent;     // Confirmation dialog modal
}
```

## ExtensionMetadata

Metadata describing an extension.

```typescript
interface ExtensionMetadata {
  name: string;              // Display name
  version: string;           // Semantic version (e.g., "1.0.0")
  description?: string;      // Brief description
  author?: string;           // Author name or organization
  capabilities?: string[];   // Optional capabilities list
}
```

## ToolResult

Result returned by tool execution.

```typescript
interface ToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; source: unknown }
  >;
  details?: Record<string, unknown>;
  isError?: boolean;
}
```

## MemoryContext

Provides access to AiderDesk's memory system — the same underlying vector store used by the built-in memory MCP tools. Available via `context.getMemoryContext()` in any extension lifecycle hook or method.

```typescript
interface MemoryContext {
  storeMemory(projectId: string, taskId: string, type: MemoryEntryType, content: string): Promise<string>;
  retrieveMemories(projectId: string, query: string, limit?: number): Promise<MemoryEntry[]>;
  getMemory(id: string): Promise<MemoryEntry | null>;
  deleteMemory(id: string): Promise<boolean>;
  updateMemory(id: string, content: string): Promise<boolean>;
  getAllMemories(): Promise<MemoryEntry[]>;
  isMemoryEnabled(): boolean;
  setMemoryEnabled(enabled: boolean): void;
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `storeMemory(projectId, taskId, type, content)` | `Promise<string>` | Store a new memory entry. Returns the created memory ID. |
| `retrieveMemories(projectId, query, limit?)` | `Promise<MemoryEntry[]>` | Retrieve memories by semantic similarity, ranked by relevance. |
| `getMemory(id)` | `Promise<MemoryEntry \| null>` | Get a single memory by ID. |
| `deleteMemory(id)` | `Promise<boolean>` | Delete a specific memory by ID. Returns `true` if successful. |
| `updateMemory(id, content)` | `Promise<boolean>` | Update the content of an existing memory. Returns `true` if successful. |
| `getAllMemories()` | `Promise<MemoryEntry[]>` | Get all stored memories. |
| `isMemoryEnabled()` | `boolean` | Check if the memory system is enabled and initialized. |
| `setMemoryEnabled(enabled)` | `void` | Enable or disable the memory system. Persists the setting. |

### MemoryEntryType

Memory entries are categorized by type:

```typescript
enum MemoryEntryType {
  Task = 'task',                          // Task-specific outcomes and observations
  UserPreference = 'user-preference',     // Durable user preferences and conventions
  CodePattern = 'code-pattern',           // Reusable codebase patterns and practices
}
```

### MemoryEntry

```typescript
interface MemoryEntry {
  id: string;            // Unique memory identifier
  content: string;       // Memory content text
  type: MemoryEntryType; // Category of memory
  taskId?: string;       // Associated task ID (if applicable)
  projectId?: string;    // Associated project directory path
  timestamp: number;     // Creation timestamp
}
```

### Example

```typescript
import type { Extension, ExtensionContext, AgentFinishedEvent } from '@aiderdesk/extensions';

export default class MemoryExtension implements Extension {
  async onAgentFinished(event: AgentFinishedEvent, context: ExtensionContext) {
    const memory = context.getMemoryContext();
    if (!memory.isMemoryEnabled()) return;

    const projectId = context.getProjectDir();
    const taskId = context.getTaskContext()?.data.id ?? '';

    // Store a code pattern discovered during the task
    await memory.storeMemory(
      projectId,
      taskId,
      'code-pattern',
      'Always use clsx for conditional class names in React components',
    );

    // Retrieve relevant memories
    const memories = await memory.retrieveMemories(projectId, 'React class naming conventions');
    context.log(`Found ${memories.length} relevant memories`, 'info');
  }
}
```

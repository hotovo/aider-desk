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

  // Model access
  getModelConfigs(): Promise<Model[]>;

  // Settings access
  getSetting(key: string): Promise<unknown>;
  updateSettings(updates: Partial<SettingsData>): Promise<void>;

  // UI refresh
  triggerUIDataRefresh(componentId?: string, taskId?: string): void;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `log(message, type?)` | Log a message to AiderDesk console and log files |
| `getProjectDir()` | Get the current project directory path |
| `getTaskContext()` | Get the current task context (null if no task active) |
| `getProjectContext()` | Get the project context for project operations |
| `getModelConfigs()` | Get all available model configurations |
| `getSetting(key)` | Get a setting value (supports dot-notation) |
| `updateSettings(updates)` | Update multiple settings at once |
| `triggerUIDataRefresh(componentId?, taskId?)` | Trigger UI component data refresh |

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
  generateText(agentProfile: AgentProfile, systemPrompt: string, prompt: string): Promise<string | undefined>;

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

```typescript
interface UIComponentDefinition {
  id: string;                      // Unique component identifier
  placement: UIComponentPlacement; // Where to render the component
  jsx: string;                     // JSX/TSX component as string
  loadData?: boolean;              // Enable data loading via getUIExtensionData
}
```

### Example

```typescript
const myComponent: UIComponentDefinition = {
  id: 'my-status-indicator',
  placement: 'task-status-bar-right',
  jsx: (props) => {
    const { Flex, Text, Badge } = props.ui;
    return (
      <Flex align="center" gap="xs">
        <Badge color="green">Active</Badge>
        <Text size="xs">{props.task?.name}</Text>
      </Flex>
    );
  },
};
```

## UIComponentPlacement

Available placement locations for UI components.

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
  | 'task-message-above'
  | 'task-message-below'
  | 'task-message-bar'
  | 'task-top-bar-left'
  | 'task-top-bar-right'
  | 'task-state-actions';
```

## UIComponents

UI components available in the `props.ui` object within your JSX.

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
  Flex: UIComponent;
  Box: UIComponent;
  Text: UIComponent;
  Badge: UIComponent;
  Tooltip: UIComponent;
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

# Extension Interface

Full TypeScript interface for AiderDesk extensions.

## Extension Interface

```typescript
interface Extension {
  // Lifecycle
  onLoad?(context: ExtensionContext): Promise<void> | void;
  onUnload?(context: ExtensionContext): Promise<void> | void;

  // Registration
  getCommands?(context: ExtensionContext): CommandDefinition[];
  getTools?(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[];
  getAgents?(context: ExtensionContext): AgentProfile[];
  getModes?(context: ExtensionContext): ModeDefinition[];
  getUIComponents?(context: ExtensionContext): UIComponentDefinition[];
  
  // UI Component support
  getUIExtensionData?(componentId: string, context: ExtensionContext): Promise<unknown>;
  executeUIExtensionAction?(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown>;

  // Settings configuration (per-extension settings UI)
  getConfigComponent?(context: ExtensionContext): string | undefined;
  getConfigData?(context: ExtensionContext): Promise<unknown>;
  saveConfigData?(configData: unknown, context: ExtensionContext): Promise<unknown>;

  // Task Events
  onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;
  onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void>;
  onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void>;

  // Agent Events
  onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;
  onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;
  onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;
  onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;

  // Tool Events
  onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;
  onToolCalled?(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>>;
  onToolFinished?(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>>;

  // File Events
  onFileAdded?(event: FileAddedEvent, context: ExtensionContext): Promise<void>;
  onFileDropped?(event: FileDroppedEvent, context: ExtensionContext): Promise<void>;

  // Prompt Events
  onPromptSubmitted?(event: PromptSubmittedEvent, context: ExtensionContext): Promise<void | Partial<PromptSubmittedEvent>>;
  onPromptStarted?(event: PromptStartedEvent, context: ExtensionContext): Promise<void>;
  onPromptFinished?(event: PromptFinishedEvent, context: ExtensionContext): Promise<void>;

  // Message Events
  onResponseMessageProcessed?(event: ResponseMessageProcessedEvent, context: ExtensionContext): Promise<void | Partial<ResponseMessageProcessedEvent>>;

  // Other Events
  onProjectOpen?(context: ExtensionContext): Promise<void>;
  onRuleFilesRetrieved?(context: ExtensionContext, ruleFiles: string[]): Promise<string[]>;
  onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;
  onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void>;
  onQuestionAsked?(event: QuestionAskedEvent, context: ExtensionContext): Promise<void>;
  onQuestionAnswered?(event: QuestionAnsweredEvent, context: ExtensionContext): Promise<void>;
  onCommandExecuted?(event: CommandExecutedEvent, context: ExtensionContext): Promise<void>;
}
```

## ExtensionContext

```typescript
interface ExtensionContext {
  // Logging
  log(message: string, type: 'info' | 'error' | 'warn' | 'debug'): void;

  // Project access
  getProjectDir(): string;
  getTaskContext(): TaskContext | null;
  getProjectContext(): ProjectContext;

  // Settings
  getSetting(key: string): Promise<unknown>;
  updateSettings(updates: Record<string, unknown>): Promise<void>;

  // Models
  getModelConfigs(): Promise<Model[]>;
  
  // UI updates
  triggerUIDataRefresh(componentId?: string, taskId?: string): void;
  triggerUIComponentsReload(): void;
  
  // Navigation
  openUrl(url: string, target?: 'external' | 'window' | 'modal-overlay'): Promise<void>;
  openPath(path: string): Promise<boolean>;
}
```

## TaskContext

```typescript
interface TaskContext {
  // Logging to chat
  addLogMessage(level: 'info' | 'error' | 'warning', message?: string): void;
  addLoadingMessage(message?: string, finished?: boolean): void;

  // Task operations
  updateTask(updates: Partial<TaskData>): Promise<TaskData>;
  runPrompt(prompt: string, mode?: string): Promise<void>;
  runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;
  runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;
  interruptResponse(): Promise<void>;

  // File operations
  getRepoMap(): string;
  getContextFiles(): ContextFile[];
  addContextFiles(files: ContextFile[]): Promise<void>;

  // Questions
  askQuestion(text: string, options?: QuestionOptions): Promise<string>;
}
```

## UIComponentDefinition

```typescript
interface UIComponentDefinition {
  /** Unique component identifier */
  id: string;
  
  /** Where in UI to render this component */
  placement: UIComponentPlacement;
  
  /** JSX/TSX component as string to be parsed */
  jsx: string;
  
  /** Optional flag to load data from extension (default: false) */
  loadData?: boolean;
  
  /** Optional flag to disable data caching (default: false) */
  noDataCache?: boolean;
}

type UIComponentPlacement =
  | 'task-status-bar-left'
  | 'task-status-bar-right'
  | 'task-usage-info-bottom'
  | 'task-messages-top'
  | 'task-messages-bottom'
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
  | 'header-left'
  | 'header-right'
  | 'welcome-page';
```

## UIComponentProps

Props available to UI components via the `data` prop (React is globally available, not a prop):

```typescript
interface UIComponentProps {
  // Context data
  projectDir?: string;
  task?: TaskData;
  agentProfile?: AgentProfile;
  models: Model[];
  providers: ProviderProfile[];
  
  // UI library
  ui: UIComponents;
  
  // Icons library (organized by icon set)
  icons: Record<string, Record<string, IconComponent>>;
  
  // Extension actions
  executeExtensionAction: (action: string, ...args: unknown[]) => Promise<unknown>;
  
  // Data from getUIExtensionData() (if loadData: true)
  data?: unknown;
  
  // Message-specific (for message placements)
  message?: MessageData;
}

interface UIComponents {
  Button: Component;
  Checkbox: Component;
  Input: Component;
  Select: Component;
  TextArea: Component;
  IconButton: Component;
  RadioButton: Component;
  MultiSelect: Component;
  Slider: Component;
  DatePicker: Component;
  Chip: Component;
  ModelSelector: Component;
  Tooltip: Component;
  LoadingOverlay: Component;
  ConfirmDialog: Component;
}
```

## Metadata

```typescript
interface ExtensionMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  capabilities: (
    | 'events'
    | 'commands'
    | 'tools'
    | 'agents'
    | 'modes'
    | 'ui'
    | 'onLoad'
    | 'onAgentStarted'
    | 'onToolCalled'
    // ... other specific capabilities
  )[];
}
```

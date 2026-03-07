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
    | 'onLoad'
    | 'onAgentStarted'
    | 'onToolCalled'
    // ... other specific capabilities
  )[];
}
```

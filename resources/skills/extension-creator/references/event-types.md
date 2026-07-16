# Event Types

All event types and their payloads for extension event handlers.

> **IMPORTANT:** For the authoritative event type definitions, see [extensions.ts on GitHub](https://raw.githubusercontent.com/hotovo/aider-desk/refs/heads/main/packages/common/src/extensions.ts) (event interfaces start at line ~360).

---

## Extension Method → Event Mapping

Every Extension interface method dispatches a specific event type. All handlers return `Promise<void | Partial<Event>>` except `onAfterCommit` which returns `Promise<void>` (read-only).

| Extension Method | Event Type | Can Block |
|---|---|---|
| `onTaskCreated` | `TaskCreatedEvent` | — |
| `onTaskPrepared` | `TaskPreparedEvent` | — |
| `onTaskInitialized` | `TaskInitializedEvent` | — |
| `onTaskClosed` | `TaskClosedEvent` | — |
| `onTaskUpdated` | `TaskUpdatedEvent` | — |
| `onProjectStarted` | `ProjectStartedEvent` | — |
| `onProjectStopped` | `ProjectStoppedEvent` | — |
| `onPromptStarted` | `PromptStartedEvent` | ✅ Yes |
| `onPromptFinished` | `PromptFinishedEvent` | — |
| `onPromptTemplate` | `PromptTemplateEvent` | — |
| `onAgentStarted` | `AgentStartedEvent` | ✅ Yes |
| `onAgentFinished` | `AgentFinishedEvent` | — |
| `onAgentStepStarted` | `AgentStepStartedEvent` | — |
| `onAgentStepFinished` | `AgentStepFinishedEvent` | — |
| `onOptimizeMessages` | `OptimizeMessagesEvent` | — |
| `onImportantReminders` | `ImportantRemindersEvent` | — |
| `onInterrupted` | `InterruptedEvent` | ✅ Yes |
| `onToolApproval` | `ToolApprovalEvent` | ✅ Yes |
| `onToolCalled` | `ToolCalledEvent` | — |
| `onToolFinished` | `ToolFinishedEvent` | — |
| `onFilesAdded` | `FilesAddedEvent` | — |
| `onFilesDropped` | `FilesDroppedEvent` | — |
| `onRuleFilesRetrieved` | `RuleFilesRetrievedEvent` | — |
| `onResponseChunk` | `ResponseChunkEvent` | — |
| `onResponseCompleted` | `ResponseCompletedEvent` | — |
| `onHandleApproval` | `HandleApprovalEvent` | ✅ Yes |
| `onSubagentStarted` | `SubagentStartedEvent` | ✅ Yes |
| `onSubagentFinished` | `SubagentFinishedEvent` | — |
| `onQuestionAsked` | `QuestionAskedEvent` | — |
| `onQuestionAnswered` | `QuestionAnsweredEvent` | — |
| `onCommandExecuted` | `CommandExecutedEvent` | ✅ Yes |
| `onCustomCommandExecuted` | `CustomCommandExecutedEvent` | ✅ Yes |
| `onAiderPromptStarted` | `AiderPromptStartedEvent` | ✅ Yes |
| `onAiderPromptFinished` | `AiderPromptFinishedEvent` | — |
| `onBeforeCommit` | `BeforeCommitEvent` | ✅ Yes |
| `onAfterCommit` | `AfterCommitEvent` (read-only) | — |

---

## Event Modification Modes

Events with a `blocked?: boolean` field allow extensions to **block** the operation by returning `{ blocked: true }` from the handler. Events without `blocked` fields are still modifiable (non-readonly fields can be changed by returning a `Partial` result), but cannot prevent the operation.

| Capability | Events |
|---|---|
| **Can Block** (have `blocked?` field) | `PromptStartedEvent`, `AgentStartedEvent`, `InterruptedEvent`, `ToolApprovalEvent`, `ToolCalledEvent`, `HandleApprovalEvent`, `SubagentStartedEvent`, `CommandExecutedEvent`, `CustomCommandExecutedEvent`, `AiderPromptStartedEvent`, `BeforeCommitEvent` |
| **Read-Only** (all fields `readonly`) | `TaskInitializedEvent`, `TaskClosedEvent`, `ProjectStartedEvent`, `ProjectStoppedEvent`, `AfterCommitEvent` |

---

## Task Events

### TaskCreatedEvent

Dispatched after a task is created.

```typescript
interface TaskCreatedEvent {
  task: TaskData;
}
```

### TaskPreparedEvent

Dispatched when a task is prepared (resources allocated, ready to initialize).

```typescript
interface TaskPreparedEvent {
  task: TaskData;
}
```

### TaskInitializedEvent

Dispatched after a task is initialized. All fields are read-only.

```typescript
interface TaskInitializedEvent {
  readonly task: TaskData;
}
```

### TaskClosedEvent

Dispatched when a task is closed. All fields are read-only.

```typescript
interface TaskClosedEvent {
  readonly task: TaskData;
}
```

### TaskUpdatedEvent

Dispatched whenever task data is updated.

```typescript
interface TaskUpdatedEvent {
  task: TaskData;
}
```

---

## Project Events

### ProjectStartedEvent

Dispatched when a project is started/opened. All fields are read-only.

```typescript
interface ProjectStartedEvent {
  readonly baseDir: string;
}
```

### ProjectStoppedEvent

Dispatched when a project is stopped/closed. All fields are read-only.

```typescript
interface ProjectStoppedEvent {
  readonly baseDir: string;
}
```

---

## Prompt Events

### PromptStartedEvent (Can Block)

Dispatched when a prompt is about to be submitted. Set `blocked: true` to prevent the prompt.

```typescript
interface PromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  blocked?: boolean;
}
```

### PromptFinishedEvent

Dispatched after a prompt has been fully processed.

```typescript
interface PromptFinishedEvent {
  responses: ResponseCompletedData[];
}
```

### PromptTemplateEvent

Dispatched when a prompt template is rendered. Extensions can override the `prompt` field.

```typescript
interface PromptTemplateEvent {
  readonly name: string;
  readonly data: unknown;
  prompt: string;
}
```

---

## Agent Events

### AgentStartedEvent (Can Block)

Dispatched when the agent is about to start processing. Set `blocked: true` to prevent the agent from running.

```typescript
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
```

### AgentFinishedEvent

Dispatched when the agent has finished processing.

```typescript
interface AgentFinishedEvent {
  readonly mode: Mode;
  readonly aborted: boolean;
  readonly contextMessages: ContextMessage[];
  resultMessages: ContextMessage[];
}
```

### AgentStepStartedEvent

Dispatched at the start of each agent step/iteration.

```typescript
interface AgentStepStartedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly iterationCount: number;
  messages: ContextMessage[];
}
```

### AgentStepFinishedEvent

Dispatched at the end of each agent step/iteration.

```typescript
interface AgentStepFinishedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly stepResult: AgentStepResult;
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
  responseMessages: ContextMessage[];
}
```

### OptimizeMessagesEvent

Dispatched during context message optimization. Extensions can provide optimized messages.

```typescript
interface OptimizeMessagesEvent {
  readonly originalMessages: ContextMessage[];
  optimizedMessages: ContextMessage[];
}
```

### ImportantRemindersEvent

Dispatched when important reminders content is being assembled. Extensions can modify the reminders content.

```typescript
interface ImportantRemindersEvent {
  /** @deprecated Use `agentProfile` instead. Will be removed in a future version. */
  readonly profile: AgentProfile;
  readonly agentProfile: AgentProfile;
  remindersContent: string;
}
```

---

## Interrupt Events

### InterruptedEvent (Can Block)

Dispatched when an interrupt occurs. Set `blocked: true` to skip the default interrupt cleanup.

```typescript
interface InterruptedEvent {
  /** Optional interrupt ID for targeting a specific subagent or conflict-resolution agent */
  interruptId?: string;
  /** Set to true to skip the default interrupt cleanup */
  blocked?: boolean;
}
```

---

## Tool Events

### ToolApprovalEvent (Can Block)

Dispatched when a tool requires approval. Set `blocked` to a boolean or string message to block; set `allowed: true` to auto-approve.

```typescript
interface ToolApprovalEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  blocked?: boolean | string;
  allowed?: boolean;
}
```

### ToolCalledEvent

Dispatched when a tool is about to be called. Extensions can modify `input` and `output`.

```typescript
interface ToolCalledEvent {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly agentProfile: AgentProfile;
  readonly abortSignal?: AbortSignal;
  input: Record<string, unknown> | undefined;
  output?: unknown;
}
```

### ToolFinishedEvent

Dispatched after a tool has finished executing. Extensions can modify `output`.

```typescript
interface ToolFinishedEvent {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly agentProfile: AgentProfile;
  readonly input: Record<string, unknown> | undefined;
  output: unknown;
}
```

---

## File Events

### FilesAddedEvent

Dispatched before files are added to the context. Extensions can modify the `files` array.

```typescript
interface FilesAddedEvent {
  files: ContextFile[];
}
```

### FilesDroppedEvent

Dispatched before files are dropped from the context. Extensions can modify the `files` array.

```typescript
interface FilesDroppedEvent {
  files: ContextFile[];
}
```

### RuleFilesRetrievedEvent

Dispatched when rule files are retrieved. Extensions can modify the `files` array.

```typescript
interface RuleFilesRetrievedEvent {
  files: ContextFile[];
}
```

---

## Message Events

### ResponseChunkEvent

Dispatched for each response chunk (streaming).

```typescript
interface ResponseChunkEvent {
  chunk: ResponseChunkData;
}
```

### ResponseCompletedEvent

Dispatched when a response is completed.

```typescript
interface ResponseCompletedEvent {
  response: ResponseCompletedData;
}
```

---

## Approval Events

### HandleApprovalEvent (Can Block)

Dispatched when an approval dialog is about to be shown. Set `blocked: true` to prevent the dialog, or `allowed: true` to auto-approve.

```typescript
interface HandleApprovalEvent {
  key: string;
  text: string;
  subject?: string;
  blocked?: boolean;
  allowed?: boolean;
}
```

---

## Subagent Events

### SubagentStartedEvent (Can Block)

Dispatched when a subagent is about to start. Set `blocked: true` to prevent the subagent from launching.

```typescript
interface SubagentStartedEvent {
  subagentProfile: AgentProfile;
  prompt: string;
  promptContext?: PromptContext;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
  systemPrompt?: string;
  blocked?: boolean;
}
```

### SubagentFinishedEvent

Dispatched when a subagent has finished.

```typescript
interface SubagentFinishedEvent {
  readonly subagentProfile: AgentProfile;
  resultMessages: ContextMessage[];
}
```

---

## Question Events

### QuestionAskedEvent

Dispatched when a question is asked to the user. Extensions can set `answer` to auto-answer.

```typescript
interface QuestionAskedEvent {
  question: QuestionData;
  readonly storedAnswer?: string;
  answer?: string;
}
```

### QuestionAnsweredEvent

Dispatched after a question has been answered.

```typescript
interface QuestionAnsweredEvent {
  readonly question: QuestionData;
  answer: string;
  userInput?: string;
}
```

---

## Command Events

### CommandExecutedEvent (Can Block)

Dispatched when a command is about to be executed. Set `blocked: true` to prevent execution.

```typescript
interface CommandExecutedEvent {
  command: string;
  blocked?: boolean;
}
```

### CustomCommandExecutedEvent (Can Block)

Dispatched when a custom command is about to be executed. Set `blocked: true` to prevent execution.

```typescript
interface CustomCommandExecutedEvent {
  command: CustomCommand;
  mode: Mode;
  blocked?: boolean;
  prompt?: string;
}
```

---

## Aider Events (Legacy)

These events are dispatched for backward compatibility with the Aider connector.

### AiderPromptStartedEvent (Can Block)

Dispatched when an Aider prompt is about to start. Set `blocked: true` to prevent it.

```typescript
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
```

### AiderPromptFinishedEvent

Dispatched after an Aider prompt has finished.

```typescript
interface AiderPromptFinishedEvent {
  responses: ResponseCompletedData[];
}
```

---

## Commit Events

### BeforeCommitEvent (Can Block)

Dispatched before a git commit is made. Set `blocked: true` to prevent the commit.

```typescript
interface BeforeCommitEvent {
  message: string;
  amend: boolean;
  blocked?: boolean;
}
```

### AfterCommitEvent (Read-Only)

Dispatched after a git commit is made. This event is read-only — handlers return `Promise<void>`.

```typescript
interface AfterCommitEvent {
  readonly message: string;
  readonly amend: boolean;
}
```

---

## Common Patterns

### Blocking Execution

Block dangerous tool calls by setting `blocked: true`:

```typescript
async onToolApproval(
  event: ToolApprovalEvent,
  context: ExtensionContext
): Promise<Partial<ToolApprovalEvent>> {
  if (event.toolName === 'power---bash' && isDangerous(event.input)) {
    return { blocked: 'This command requires manual approval.' };
  }
  return {};
}
```

### Blocking Prompts

Block a prompt from being submitted:

```typescript
async onPromptStarted(
  event: PromptStartedEvent,
  context: ExtensionContext
): Promise<Partial<PromptStartedEvent>> {
  if (containsSecrets(event.prompt)) {
    return { blocked: true };
  }
  return {};
}
```

### Modifying Context Messages

Add a custom system instruction when the agent starts:

```typescript
async onAgentStarted(
  event: AgentStartedEvent,
  context: ExtensionContext
): Promise<Partial<AgentStartedEvent>> {
  return {
    contextMessages: [
      { id: 'custom', role: 'user', content: 'Always use TypeScript.' },
      ...event.contextMessages,
    ],
  };
}
```

### Modifying Profile

Override agent profile fields when the agent starts:

```typescript
async onAgentStarted(
  event: AgentStartedEvent,
  context: ExtensionContext
): Promise<Partial<AgentStartedEvent>> {
  return {
    agentProfile: {
      ...event.agentProfile,
      includeRepoMap: false,
    },
  };
}
```

### Modifying Files

Add or filter context files before they are added:

```typescript
async onFilesAdded(
  event: FilesAddedEvent,
  context: ExtensionContext
): Promise<Partial<FilesAddedEvent>> {
  // Filter out generated files from being added
  return {
    files: event.files.filter((f) => !f.path.includes('node_modules')),
  };
}
```

### Overriding Prompt Templates

Override the rendered output of a prompt template:

```typescript
async onPromptTemplate(
  event: PromptTemplateEvent,
  context: ExtensionContext
): Promise<Partial<PromptTemplateEvent>> {
  if (event.name === 'system-prompt') {
    return { prompt: event.prompt + '\n\nAdditional rules...' };
  }
  return {};
}
```

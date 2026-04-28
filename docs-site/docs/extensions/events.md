# Events Reference

Extensions can listen to and modify events throughout AiderDesk. This page documents all available events and their properties.

## Modifying Event Properties

Properties in event interfaces can be modified by returning a partial event from your handler. The rule is simple:

- Properties marked `readonly` **cannot** be modified
- Properties without `readonly` **can** be modified by returning them in a partial event

```typescript
// Example: Modifying a modifiable property
async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext) {
  // prompt is NOT readonly, so it can be modified
  return {
    prompt: event.prompt?.toUpperCase(),
  };
}
```

## Event Handling Patterns

### 1. Read-Only
Observe the event without modifying anything.

```typescript
async onTaskClosed(event: TaskClosedEvent, context: ExtensionContext) {
  context.log(`Task ${event.task.name} closed`, 'info');
  // Return nothing - event continues unchanged
}
```

### 2. Blocking
Prevent an operation by setting `blocked: true`.

```typescript
async onToolApproval(event: ToolApprovalEvent, context: ExtensionContext) {
  if (event.toolName === 'dangerous_tool') {
    return { blocked: true };  // Prevents execution
  }
}
```

### 3. Modifying
Change event data by returning a partial event.

```typescript
async onAgentStarted(event: AgentStartedEvent, context: ExtensionContext) {
  return {
    agentProfile: {
      ...event.agentProfile,
      customInstructions: event.agentProfile.customInstructions + '\nBe concise.',
    },
  };
}
```

---

## Event Categories

| Category | Events | Purpose |
|----------|--------|---------|
| **Task** | Created, Prepared, Initialized, Closed, Updated | Task lifecycle |
| **Project** | Started, Stopped | Project lifecycle |
| **Agent** | Started, Step Started, Finished, Step Finished | Agent execution |
| **Message Optimization** | Optimize, Important Reminders | Message optimization |
| **Tool** | Approval, Called, Finished | Tool execution |
| **File** | Added, Dropped, Rule Files Retrieved | File context management |
| **Prompt** | Started, Finished | Prompt processing |
| **Prompt Template** | Template Rendered | Prompt template customization |
| **Response** | Chunk, Completed | Response streaming |
| **Approval** | Handle Approval | User approvals |
| **Subagent** | Started, Finished | Subagent execution |
| **Question** | Asked, Answered | User questions |
| **Command** | Executed, Custom Command Executed | Command execution |
| **Commit** | Before Commit, After Commit | Commit lifecycle |
| **Aider** | Prompt Started, Prompt Finished | Legacy Aider events |

---

## Task Events

### TaskCreatedEvent
Called when a new task is created.

```typescript
interface TaskCreatedEvent {
  task: TaskData;
}
```

### TaskPreparedEvent
Called when a task is prepared (both new and loaded tasks).

```typescript
interface TaskPreparedEvent {
  task: TaskData;
}
```

### TaskInitializedEvent
Called when a task is initialized and ready for use.

```typescript
interface TaskInitializedEvent {
  readonly task: TaskData;
}
```

### TaskClosedEvent
Called when a task is closed.

```typescript
interface TaskClosedEvent {
  readonly task: TaskData;
}
```

### TaskUpdatedEvent
Called before a task is updated and saved.

```typescript
interface TaskUpdatedEvent {
  task: TaskData;
}
```

---

## Project Events

### ProjectStartedEvent
Called when a project is started.

```typescript
interface ProjectStartedEvent {
  readonly baseDir: string;
}
```

### ProjectStoppedEvent
Called when a project is stopped.

```typescript
interface ProjectStoppedEvent {
  readonly baseDir: string;
}
```

---

## Prompt Events

### PromptStartedEvent
Called when prompt processing starts.

```typescript
interface PromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  blocked?: boolean;
}
```

### PromptFinishedEvent
Called when prompt processing finishes.

```typescript
interface PromptFinishedEvent {
  responses: ResponseCompletedData[];
}
```

---

## Prompt Template Events

### PromptTemplateEvent
Called when a prompt template is rendered. Use to customize or override prompt templates.

```typescript
interface PromptTemplateEvent {
  /** Template name (e.g., 'system-prompt', 'init-project', etc.) */
  readonly name: string;
  /** Template data object */
  readonly data: unknown;
  /** Rendered prompt that can be overridden by extension */
  prompt: string;
}
```

**Available Template Names:**
- `system-prompt` - System prompt for the agent
- `init-project` - Project initialization prompt
- `workflow` - Workflow execution prompt
- `compact-conversation` - Conversation compaction prompt
- `commit-message` - Git commit message generation prompt
- `task-name` - Task name generation prompt
- `conflict-resolution` - Conflict resolution prompt
- `conflict-resolution-system` - Conflict resolution system prompt
- `update-task-state` - Task state update prompt
- `handoff` - Task handoff prompt
- `code-inline-request` - Inline code request prompt

#### Example: Customizing System Prompt

```typescript
async onPromptTemplate(event: PromptTemplateEvent, context: ExtensionContext) {
  // Customize the system prompt
  if (event.name === 'system-prompt') {
    return {
      prompt: event.prompt + '\n\nAdditional instructions: Always be concise.',
    };
  }
}
```

#### Example: Project-Specific Prompt Customization

```typescript
async onPromptTemplate(event: PromptTemplateEvent, context: ExtensionContext) {
  const projectDir = context.getProjectDir();

  // Add project-specific context to init-project prompt
  if (event.name === 'init-project') {
    const customInstructions = `

## Project-Specific Guidelines
This project uses TypeScript with strict mode enabled.
Always prefer type-safe implementations over any types.
    `;

    return {
      prompt: event.prompt + customInstructions,
    };
  }
}
```

---

## Agent Events

### AgentStartedEvent
Called when agent mode starts. Use to modify prompts, context, or block execution.

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
}
```

### AgentStepStartedEvent
Called before each agent step starts (before the LLM call). Use to modify messages that will be sent.

```typescript
interface AgentStepStartedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly iterationCount: number;
  messages: ContextMessage[];
}
```

### AgentFinishedEvent
Called when agent mode finishes.

```typescript
interface AgentFinishedEvent {
  readonly mode: Mode;
  readonly aborted: boolean;
  readonly contextMessages: ContextMessage[];
  resultMessages: ContextMessage[];
}
```

### AgentStepFinishedEvent
Called after each agent step completes.

```typescript
interface AgentStepFinishedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  readonly currentResponseId: string;
  readonly stepResult: AgentStepResult;
  finishReason: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown';
  responseMessages: ContextMessage[];
}
```

---

## Message Optimization Events

### OptimizeMessagesEvent
Called when messages are being optimized. Use to modify or filter the optimized messages.

```typescript
interface OptimizeMessagesEvent {
  readonly originalMessages: ContextMessage[];
  optimizedMessages: ContextMessage[];
}
```

### ImportantRemindersEvent
Called when important reminders are being generated. Use to modify the reminders content.

```typescript
interface ImportantRemindersEvent {
  readonly profile: AgentProfile;
  remindersContent: string;
}
```

---

## Tool Events

### ToolApprovalEvent
Called when a tool requires approval.

```typescript
interface ToolApprovalEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  blocked?: boolean;
  allowed?: boolean;
}
```

### ToolCalledEvent
Called when a tool is about to be executed.

```typescript
interface ToolCalledEvent {
  readonly toolName: string;
  readonly abortSignal?: AbortSignal;
  input: Record<string, unknown> | undefined;
  output?: unknown;
}
```

### ToolFinishedEvent
Called after tool execution completes.

```typescript
interface ToolFinishedEvent {
  readonly toolName: string;
  readonly input: Record<string, unknown> | undefined;
  output: unknown;
}
```

---

## File Events

### FilesAddedEvent
Called when files are added to context. Return empty array to prevent addition.

```typescript
interface FilesAddedEvent {
  files: ContextFile[];
}
```

### FilesDroppedEvent
Called when files are dropped into the chat. Return empty array to prevent addition.

```typescript
interface FilesDroppedEvent {
  files: ContextFile[];
}
```

### RuleFilesRetrievedEvent
Called when rule files are retrieved. Modify to filter or add rule files.

```typescript
interface RuleFilesRetrievedEvent {
  files: ContextFile[];
}
```

---

## Response Events

### ResponseChunkEvent
Called on each response chunk during streaming.

```typescript
interface ResponseChunkEvent {
  chunk: ResponseChunkData;
}
```

### ResponseCompletedEvent
Called when response is complete.

```typescript
interface ResponseCompletedEvent {
  response: ResponseCompletedData;
}
```

---

## Approval Events

### HandleApprovalEvent
Called when handling user approval requests.

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

### SubagentStartedEvent
Called when a subagent starts. Use to modify or block subagent execution.

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
Called when a subagent finishes.

```typescript
interface SubagentFinishedEvent {
  readonly subagentProfile: AgentProfile;
  resultMessages: ContextMessage[];
}
```

---

## Question Events

### QuestionAskedEvent
Called when a question is asked to the user. Set `answer` to auto-answer.

```typescript
interface QuestionAskedEvent {
  question: QuestionData;
  answer?: string;
}
```

### QuestionAnsweredEvent
Called when the user answers a question.

```typescript
interface QuestionAnsweredEvent {
  readonly question: QuestionData;
  answer: string;
  userInput?: string;
}
```

---

## Command Events

### CommandExecutedEvent
Called when a slash command is executed.

```typescript
interface CommandExecutedEvent {
  command: string;
  blocked?: boolean;
}
```

### CustomCommandExecutedEvent
Called when a custom command is executed.

```typescript
interface CustomCommandExecutedEvent {
  command: CustomCommand;
  mode: Mode;
  blocked?: boolean;
  prompt?: string;
}
```

---

## Commit Events

### BeforeCommitEvent
Called before changes are committed. Use to modify the commit message, amend flag, or block the commit.

```typescript
interface BeforeCommitEvent {
  message: string;
  amend: boolean;
  blocked?: boolean;
}
```

### AfterCommitEvent
Called after changes are committed. Read-only event for observing committed changes.

```typescript
interface AfterCommitEvent {
  readonly message: string;
  readonly amend: boolean;
}
```

---

## Aider Events (Legacy)

### AiderPromptStartedEvent
Called when Aider prompt starts (legacy event).

```typescript
interface AiderPromptStartedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  messages: ConnectorMessage[];
  files: ContextFile[];
  blocked?: boolean;
  autoApprove?: boolean;
  denyCommands?: boolean;
}
```

### AiderPromptFinishedEvent
Called when Aider prompt finishes (legacy event).

```typescript
interface AiderPromptFinishedEvent {
  responses: ResponseCompletedData[];
}
```

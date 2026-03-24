# Event Types

All event types and their payloads for extension event handlers.

## Event Modification Modes

| Mode | Events | Can Block | Can Modify |
|------|--------|-----------|------------|
| Read-Only | onTaskCreated, onTaskClosed, onFileAdded, etc. | No | No |
| Blocking | onToolApproval, onToolCalled, onPromptSubmitted, onHandleApproval, onSubagentStarted | Yes | Some |
| Modifying | onToolFinished, onResponseMessageProcessed, onAgentStarted | No | Yes |

## Agent Events

### AgentStartedEvent (Modifying)

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

### AgentFinishedEvent

```typescript
interface AgentFinishedEvent {
  readonly mode: Mode;
  readonly agentProfile: AgentProfile;
  resultMessages: ContextMessage[];
}
```

### AgentStepFinishedEvent (Modifying)

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

## Tool Events

### ToolCalledEvent (Blocking)

```typescript
interface ToolCalledEvent {
  readonly tool: string;
  readonly toolInput: Record<string, unknown>;
  readonly agentProfile: AgentProfile;
  blocked?: boolean;
}
```

### ToolFinishedEvent (Modifying)

```typescript
interface ToolFinishedEvent {
  readonly tool: string;
  readonly toolInput: Record<string, unknown>;
  readonly agentProfile: AgentProfile;
  toolResult: unknown;
  metadata?: Record<string, unknown>;
}
```

## Prompt Events

### PromptSubmittedEvent (Blocking/Modifying)

```typescript
interface PromptSubmittedEvent {
  prompt: string;
  mode: Mode;
  promptContext: PromptContext;
  blocked?: boolean;
}
```

## File Events

### FileAddedEvent

```typescript
interface FileAddedEvent {
  files: string[];
}
```

## Subagent Events

### SubagentStartedEvent (Blocking/Modifying)

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

## Common Patterns

### Blocking Execution

```typescript
async onToolCalled(event: ToolCalledEvent): Promise<Partial<ToolCalledEvent>> {
  if (event.tool === 'power---bash' && isDangerous(event.toolInput)) {
    return { blocked: true };
  }
  return {};
}
```

### Modifying Messages

```typescript
async onAgentStarted(event: AgentStartedEvent): Promise<Partial<AgentStartedEvent>> {
  return {
    contextMessages: [
      { id: 'custom', role: 'user', content: 'Custom instruction' },
      ...event.contextMessages
    ]
  };
}
```

### Modifying Profile

```typescript
async onAgentStarted(event: AgentStartedEvent): Promise<Partial<AgentStartedEvent>> {
  return {
    agentProfile: {
      ...event.agentProfile,
      includeRepoMap: false
    }
  };
}
```

# Agent Profile Schema Reference

Complete reference for the `AgentProfile` interface defined in `packages/common/src/types/common.ts`.

## Required Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Unique identifier (UUID) | `"550e8400-e29b-41d4-a716-446655440000"` |
| `name` | string | Display name of the profile | `"Code Reviewer"` |
| `provider` | string | LLM provider ID | `"anthropic"`, `"openai"`, `"ollama"` |
| `model` | string | Model identifier | `"claude-sonnet-4-5-20250929"`, `"gpt-4o"` |
| `maxIterations` | number | Max thinking/acting cycles per prompt | `250` |
| `minTimeBetweenToolCalls` | number | Delay in ms between tool calls | `0` |
| `enabledServers` | string[] | List of MCP server names | `["filesystem", "github"]` |
| `toolApprovals` | Record<string, ToolApprovalState> | Tool approval settings | See Tool Approvals below |
| `toolSettings` | Record<string, ToolSettings> | Tool-specific settings | See Tool Settings below |
| `includeContextFiles` | boolean | Include context files in system prompt | `true` |
| `includeRepoMap` | boolean | Include repository map | `true` |
| `usePowerTools` | boolean | Enable Power Tools group | `true` |
| `useAiderTools` | boolean | Enable Aider integration tools | `false` |
| `useTodoTools` | boolean | Enable Todo management tools | `false` |
| `useSubagents` | boolean | Enable subagent delegation | `false` |
| `useTaskTools` | boolean | Enable task management tools | `false` |
| `useMemoryTools` | boolean | Enable memory tools | `false` |
| `useSkillsTools` | boolean | Enable skills tools | `false` |
| `customInstructions` | string | Free-text custom instructions | `"Focus on security..."` |
| `subagent` | SubagentConfig | Subagent configuration | See Subagent Config below |

## Optional Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `maxTokens` | number? | Override model max output tokens | `4000` |
| `temperature` | number? | Override model temperature | `0.7` |
| `projectDir` | string? | Project directory (if project-level) | `"/path/to/project"` |
| `isSubagent` | boolean? | Flag for subagent usage | `true` |
| `ruleFiles` | string[]? | Paths to rule files (dynamic) | `["/path/to/rule.md"]` |

## Supporting Types

### ToolApprovalState

```typescript
enum ToolApprovalState {
  Always = 'always',   // Auto-approve without prompting
  Never = 'never',     // Disable tool completely
  Ask = 'ask',         // Prompt for approval each time
}
```

### SubagentConfig

```typescript
interface SubagentConfig {
  enabled: boolean;              // Can this profile be used as subagent?
  contextMemory: ContextMemoryMode;  // Memory sharing mode
  systemPrompt: string;           // Specialized system prompt
  invocationMode: InvocationMode;  // When to invoke
  color: string;                  // Visual identifier (hex or CSS color)
  description: string;             // Description for auto-invocation
}
```

### ContextMemoryMode

```typescript
enum ContextMemoryMode {
  Off = 'off',                    // No memory sharing
  FullContext = 'full-context',   // Share full conversation context
  LastMessage = 'last-message',   // Share only last message
}
```

### InvocationMode

```typescript
enum InvocationMode {
  OnDemand = 'on-demand',      // Only when explicitly requested
  Automatic = 'automatic',     // Automatically when relevant
}
```

### ToolSettings

```typescript
interface BashToolSettings {
  allowedPattern: string;  // Regex pattern for allowed commands
  deniedPattern: string;   // Regex pattern for denied commands
}

type ToolSettings = BashToolSettings;
```

## Tool Approval Keys Format

**Tool approval keys follow the pattern: `{group}---{tool}`**

**Separator is three dashes (`---`)**, not colon.

### Power Tools Group
- `power---file_edit` - Edit files
- `power---file_write` - Write/create files
- `power---file_read` - Read files
- `power---glob` - Find files by pattern
- `power---grep` - Search file content
- `power---bash` - Execute shell commands
- `power---semantic_search` - Search code semantically
- `power---fetch` - Fetch web content

### Aider Tools Group
- `aider---add_context_files` - Add files to Aider context
- `aider---remove_context_files` - Remove files from context
- `aider---run` - Run Aider commands
- `aider---get_diff` - Get file diffs

### Subagents Group
- `subagents---run_task` - Delegate to subagent

### Memory Tools Group
- `memory---store_memory` - Store information
- `memory---retrieve_memory` - Retrieve stored information
- `memory---delete_memory` - Delete stored information
- `memory---list_memories` - List all stored information
- `memory---update_memory` - Update stored information

### Skills Tools Group
- `skills---activate_skill` - Activate a skill

### Task Tools Group
- `task---complete_task` - Mark task as complete
- `task---pause_task` - Pause a task

### Todo Tools Group
- `todo---add_todo` - Add todo item
- `todo---complete_todo` - Complete todo
- `todo---list_todos` - List todos

## Default Values Applied by Sanitization

When loading a profile, these defaults are applied if missing:

```typescript
{
  id: generated UUID,
  name: derived from directory name,
  provider: 'anthropic',
  model: default model for provider,
  maxIterations: 250,
  minTimeBetweenToolCalls: 0,
  enabledServers: [],
  customInstructions: '',
  toolApprovals: {},
  toolSettings: {},
  subagent: {
    enabled: false,
    contextMemory: ContextMemoryMode.LastMessage,
    systemPrompt: '',
    invocationMode: InvocationMode.OnDemand,
    color: '#3b82f6',
    description: ''
  }
}
```

## Example Complete Profile

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Code Reviewer",
  "provider": "anthropic",
  "model": "claude-sonnet-4-5-20250929",
  "maxIterations": 250,
  "minTimeBetweenToolCalls": 0,
  "maxTokens": 8192,
  "temperature": 0.3,
  "enabledServers": ["filesystem", "github"],
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_edit": "ask",
    "power---bash": "never"
  },
  "toolSettings": {},
  "includeContextFiles": true,
  "includeRepoMap": true,
  "usePowerTools": true,
  "useAiderTools": false,
  "useTodoTools": false,
  "useSubagents": false,
  "useTaskTools": false,
  "useMemoryTools": true,
  "useSkillsTools": false,
  "customInstructions": "Focus on code quality, security, and best practices. Provide constructive feedback.",
  "subagent": {
    "enabled": true,
    "contextMemory": "full-context",
    "systemPrompt": "You are a code review expert. Analyze changes for correctness, security, and adherence to coding standards.",
    "invocationMode": "on-demand",
    "color": "#ef4444",
    "description": "Expert code review specialist focused on quality and security"
  }
}
```

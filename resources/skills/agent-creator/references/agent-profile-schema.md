# Agent Profile Schema Reference

Complete reference for the `AgentProfile` interface defined in `packages/common/src/types/common.ts`.

## Required Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `id` | string | Unique profile identifier (any unique string; readable names like `"code-reviewer"` are fine — no UUID needed) | `"code-reviewer"` |
| `name` | string | Display name of the profile | `"Code Reviewer"` |
| `provider` | string | LLM provider ID. Defaults to `"anthropic"` if not specified (see `DEFAULT_AGENT_PROFILE` / `DEFAULT_PROVIDER_MODELS` in `packages/common/src/agent.ts`). | `"anthropic"`, `"openai"`, `"ollama"` |
| `model` | string | Model identifier. Defaults to the provider's default model (`"claude-sonnet-5"` for anthropic) if not specified. | `"claude-sonnet-5"`, `"gpt-5.5"` |
| `maxIterations` | number | Max thinking/acting cycles per prompt. `0` means unlimited (this is the default). | `250`, `0` |
| `minTimeBetweenToolCalls` | number | Delay in ms between tool calls (rate limiting) | `0` |
| `enabledServers` | string[] | List of MCP server names | `["filesystem", "github"]` |
| `toolApprovals` | Record<string, ToolApprovalState> | Tool approval settings (keys: `{group}---{tool}`) | See Tool Approvals below |
| `toolSettings` | Record<string, ToolSettings> | Tool-specific settings (e.g., bash patterns) | See Tool Settings below |
| `includeContextFiles` | boolean | Include context files in system prompt. Defaults to `false`. | `true` |
| `includeRepoMap` | boolean | Include repository map. Defaults to `false`. | `true` |
| `usePowerTools` | boolean | Enable Power Tools group | `true` |
| `useAiderTools` | boolean | Enable Aider integration tools | `false` |
| `useTodoTools` | boolean | Enable Todo management tools | `false` |
| `useSubagents` | boolean | Enable subagent delegation | `false` |
| `useTaskTools` | boolean | Enable task management tools | `false` |
| `useMemoryTools` | boolean | Enable memory tools | `false` |
| `useSkillsTools` | boolean | Enable skills tools | `false` |
| `useExtensionTools` | boolean | Enable tools from installed extensions | `true` |
| `disabledExtensionTools` | string[] | Extension IDs whose tools are disabled | `["my-extension"]` |
| `customInstructions` | string | Free-text instructions appended to system prompt | `"Focus on security..."` |
| `subagent` | SubagentConfig | Subagent configuration | See Subagent Config below |

## Optional Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `maxTokens` | number? | Override model max output tokens | `4000` |
| `temperature` | number? | Override model temperature | `0.7` |
| `projectDir` | string? | Project directory (if project-level profile) | `"/path/to/project"` |
| `systemPrompt` | string? | Overrides the default built-in system prompt when running as the main agent. Rules files and `customInstructions` are still appended. Falls back as subagent system prompt when `subagent.systemPrompt` is empty. | `"You are a code reviewer..."` |
| `enabledSubagentIds` | string[]? | Profile IDs allowed to be used as subagents by this profile. Omit/undefined = all subagents allowed. | `["code-reviewer", "security-auditor"]` |
| `ruleFiles` | string[]? | Absolute paths to rule files. **Dynamically discovered** at load time from `rules/` subdirectory. Do NOT set in config.json. | `["/path/to/rule.md"]` |
| `autoCompactThresholdPercentage` | number? | Override global auto-compact threshold percentage | `80` |
| `autoCompactThresholdTokens` | number? | Override global auto-compact threshold tokens | `50000` |
| `autoCompactionType` | ContextCompactionType? | Override global compaction type | `"smart"` |

**Note:** `isSubagent` is a runtime flag set by the system when this profile is being used as a subagent. Do not include it in config.json.

## System Prompt Behavior

The system prompt is resolved by `PromptsManager.getSystemPrompt()`:

1. If `agentProfile.systemPrompt` is set and non-empty → **uses it as the base system prompt**, then appends:
   - `<Rules>` section from rule files (if any)
   - `customInstructions` (if non-empty)
2. If `agentProfile.systemPrompt` is empty/undefined → **uses the default template-generated system prompt**, which includes:
   - OS info, project context, tool permissions, autonomy mode
   - Rules files and `customInstructions` are still appended

When the profile runs as a **subagent**:
- `subagent.systemPrompt` is used directly (if non-empty)
- If `subagent.systemPrompt` is empty, `agentProfile.systemPrompt` is used as fallback
- `customInstructions` are appended

## Subagent Filtering

`enabledSubagentIds` on a **parent** profile controls which subagent profiles it can use:

- **Omitted/undefined** — All enabled subagents are available
- **Array of profile IDs** — Only subagents whose `id` matches are available

Filtering logic is centralized in `isSubagentEnabled(agentProfile, mainAgentProfile?)` in `packages/common/src/agent.ts`:
- Subagent must have `subagent.enabled: true`
- Subagent must not be the same profile as the main agent
- If `mainAgentProfile.enabledSubagentIds` is defined, subagent ID must be in the array

## Supporting Types

### ToolApprovalState

```typescript
enum ToolApprovalState {
  Always = 'always',   // Auto-approve without prompting
  Never = 'never',     // Disable tool completely
  Ask = 'ask',         // Prompt for approval each time (DEFAULT)
}
```

### SubagentConfig

```typescript
interface SubagentConfig {
  enabled: boolean;              // Can this profile be used as subagent?
  contextMemory: ContextMemoryMode;  // How much previous context to share
  systemPrompt: string;           // Specialized system prompt for subagent role
  invocationMode: InvocationMode;  // When to invoke
  color: string;                  // Visual identifier (hex color)
  description: string;             // Description for auto-invocation
}
```

### ContextMemoryMode

```typescript
enum ContextMemoryMode {
  Off = 'off',                    // No context from previous subagent runs
  FullContext = 'full-context',   // Share full conversation history
  LastMessage = 'last-message',   // Share only last message from previous runs
}
```

### InvocationMode

```typescript
enum InvocationMode {
  OnDemand = 'on-demand',      // Only when explicitly requested by user
  Automatic = 'automatic',     // Automatically when relevant (requires description)
}
```

### ContextCompactionType

```typescript
enum ContextCompactionType {
  Compact = 'compact',   // Summarize and compress conversation
  Handoff = 'handoff',   // Generate handoff document for continuation
  Smart = 'smart',       // Adaptive multi-level compaction
}
```

### ToolSettings

```typescript
interface BashToolSettings {
  allowedPattern: string;  // Regex pattern for allowed commands (empty = all allowed)
  deniedPattern: string;   // Regex pattern for denied commands (overrides allowed)
}

type ToolSettings = BashToolSettings;
```

## Tool Approval Keys Format

**Tool approval keys follow the pattern: `{group}---{tool}`**

**Separator is three dashes (`---`)**, not colon.

### Power Tools Group (`usePowerTools`)
- `power---file_edit` - Edit files
- `power---file_write` - Write/create files
- `power---file_read` - Read files
- `power---glob` - Find files by pattern
- `power---grep` - Search file content with regex
- `power---bash` - Execute shell commands
- `power---semantic_search` - Search code semantically
- `power---fetch` - Fetch web content

### Aider Tools Group (`useAiderTools`)
- `aider---get_context_files` - Get Aider context files
- `aider---add_context_files` - Add files to Aider context
- `aider---drop_context_files` - Remove files from Aider context
- `aider---run` - Run Aider commands

### Subagents Tools Group (`useSubagents`)
- `subagents---run_task` - Delegate to subagent

### Memory Tools Group (`useMemoryTools`)
- `memory---store_memory` - Store information
- `memory---retrieve_memory` - Retrieve stored information
- `memory---delete_memory` - Delete stored information
- `memory---list_memories` - List all stored information
- `memory---update_memory` - Update stored information

### Skills Tools Group (`useSkillsTools`)
- `skills---activate_skill` - Activate a skill

### Task Tools Group (`useTaskTools`)
- `tasks---list_tasks` - List all tasks in the project
- `tasks---get_task` - Get task details by ID
- `tasks---get_task_message` - Retrieve a message from task history
- `tasks---create_task` - Create a new task
- `tasks---delete_task` - Permanently delete a task
- `tasks---search_task` - Search within a task semantically
- `tasks---run_prompt` - Run a prompt on an existing task
- `tasks---search_parent_task` - Search within parent task

### Todo Tools Group (`useTodoTools`)
- `todo---set_items` - Initialize or overwrite todo list
- `todo---get_items` - Retrieve current todo list
- `todo---update_item_completion` - Update todo item completion status
- `todo---clear_items` - Clear all todo items

### Extension Tools Group (`useExtensionTools`)
- Tools are dynamically provided by installed extensions
- Tool keys are `{extensionToolGroupName}---{toolName}` (group name is defined by each extension)
- Disable specific extensions' tools via `disabledExtensionTools: ["extensionId"]`
- Cannot enumerate tool keys statically — they depend on installed extensions

## Default Values Applied by Sanitization

When loading a profile, these defaults are applied if missing:

```typescript
{
  id: the profile id as written (populated if empty; authors should just provide a unique readable id),
  name: derived from directory name (if empty),
  provider: 'anthropic',
  model: 'claude-sonnet-5' (default model for anthropic),
  maxIterations: 0 (unlimited),
  includeContextFiles: false,
  includeRepoMap: false,
  minTimeBetweenToolCalls: 0,
  enabledServers: [],
  disabledExtensionTools: [],
  customInstructions: '',
  toolApprovals: {},
  toolSettings: {},
  subagent: {
    enabled: false,
    contextMemory: ContextMemoryMode.Off,
    systemPrompt: '',
    invocationMode: InvocationMode.OnDemand,
    color: '#3368a8',
    description: ''
  }
}
```

**Boolean tool group flags** (`usePowerTools`, `useAiderTools`, etc.) default to `false` if not present (inherited from the spread of the loaded profile).

**Note:** `systemPrompt`, `enabledSubagentIds`, `ruleFiles`, `autoCompactThresholdPercentage`, `autoCompactThresholdTokens`, and `autoCompactionType` are all optional and default to `undefined` when not set in config.json.

## Rule Files

Rule files are markdown files that provide additional instructions appended to the system prompt. They are:

- Placed in a `rules/` subdirectory next to `config.json` (e.g., `~/.aider-desk/agents/my-agent/rules/security-rules.md`)
- Discovered automatically at load time (do not set `ruleFiles` in config.json — it's dynamically populated)
- For project-level profiles, also checks global profile with same ID for global rule files
- All `.md` files in the `rules/` directory are loaded (order is alphabetical by filename)

**Example structure:**
```
~/.aider-desk/agents/my-agent/
├── config.json
└── rules/
    ├── coding-standards.md
    └── project-conventions.md
```

## Example Complete Profile

```json
{
  "id": "code-reviewer",
  "name": "Code Reviewer",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 150,
  "minTimeBetweenToolCalls": 0,
  "maxTokens": 8192,
  "temperature": 0.3,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_edit": "never",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
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
  "useExtensionTools": true,
  "disabledExtensionTools": [],
  "customInstructions": "Focus on code quality, security, and best practices.",
  "systemPrompt": "You are a code review expert. Analyze changes for correctness, security, and adherence to coding standards.",
  "subagent": {
    "enabled": true,
    "contextMemory": "full-context",
    "systemPrompt": "You are a code review expert. Analyze changes for correctness, security, and adherence to coding standards. Identify bugs, potential issues, and improvement opportunities.",
    "invocationMode": "automatic",
    "color": "#ef4444",
    "description": "Expert code review specialist focused on quality and security"
  }
}
```

# Subagent Configuration Guide

Complete guide to configuring subagents and subagent filtering for agent profiles in AiderDesk.

## SubagentConfig Properties

| Property | Type | Description | Default |
|-----------|------|-------------|----------|
| `enabled` | boolean | Can this profile be used as a subagent? | `false` |
| `contextMemory` | ContextMemoryMode | How much previous context to share | `"off"` |
| `systemPrompt` | string | Specialized system prompt for subagent role | Empty |
| `invocationMode` | InvocationMode | When to invoke this subagent | `"on-demand"` |
| `color` | string | Visual identifier (hex color) | `"#3368a8"` |
| `description` | string | Description for automatic invocation | Empty |

## System Prompts: Two Distinct Fields

AiderDesk has two separate system prompt fields that serve different roles:

### Top-Level `systemPrompt` (AgentProfile)

- Used when the profile runs as the **main agent**
- Replaces the default template-generated system prompt entirely
- Rules files and `customInstructions` are still appended after it
- If empty, the default built-in system prompt is used (includes OS info, project context, tool permissions, autonomy mode)
- Falls back as subagent system prompt when `subagent.systemPrompt` is empty

### `subagent.systemPrompt` (SubagentConfig)

- Used when the profile runs as a **subagent**
- Passed directly to the subagent's LLM
- If empty, falls back to the top-level `systemPrompt`

### When to Use Which

| Scenario | Top-level `systemPrompt` | `subagent.systemPrompt` |
|----------|-------------------------|------------------------|
| Agent works only as main agent | Set with custom behavior | Leave empty |
| Agent works only as subagent | Leave empty (default used) | Set with subagent-specific behavior |
| Agent works in both roles | Set with main-agent behavior | Set with subagent-specific behavior (can differ) |
| Agent doesn't need custom prompts | Leave empty | Leave empty |

**Example:** An agent that acts as a code reviewer both as main agent and subagent:
```json
{
  "systemPrompt": "You are a code review expert. Analyze changes systematically. Provide constructive feedback.",
  "subagent": {
    "enabled": true,
    "systemPrompt": "You are a specialized code review subagent. Focus on the specific code changes provided. Be concise and actionable.",
    "contextMemory": "full-context",
    "invocationMode": "automatic",
    "color": "#ef4444",
    "description": "Expert code review specialist focused on quality and security"
  }
}
```

## Context Memory Modes

Controls how much of previous conversation context is remembered by the subagent across multiple invocations.

### Off (`"off"`)

**Behavior:** Subagent starts fresh with no previous conversation history. Each invocation is completely independent.

**When to Use:**
- Tasks are independent and self-contained
- Token cost is a priority
- Previous context isn't relevant to new tasks
- Default for most profiles

**Pros:**
- Lower token cost
- Cleaner context
- No confusion from previous conversations
- Predictable behavior

**Cons:**
- No continuity across multiple invocations
- Cannot reference previous decisions or work

**Examples:** Power Tools profile, Aider profile, general purpose agents, single-task agents

### Last Message (`"last-message"`)

**Behavior:** Subagent receives only the final message from previous runs. Intermediate steps and reasoning are filtered out.

**When to Use:**
- Need the result of previous work but not the full journey
- Want cost savings but still need continuity
- Building upon latest state is sufficient

**Pros:**
- Token-efficient
- Provides continuity via latest result
- Avoids context bloat

**Cons:**
- Loses intermediate steps and reasoning
- Cannot reference earlier decisions
- Limited context for complex dependencies

**Examples:** Documentation generators, status update agents, progressive builders

### Full Context (`"full-context"`)

**Behavior:** Subagent receives entire conversation history from previous runs. All messages, tool calls, and results are preserved.

**When to Use:**
- Complex, iterative tasks requiring deep continuity
- Building upon previous decisions and reasoning
- Analysis that needs complete history
- Specialized, expert agents

**Pros:**
- Complete context awareness
- Maintains reasoning and decisions
- Can reference any point in conversation history

**Cons:**
- Higher token cost
- Potential for context bloat
- May include irrelevant information

**Examples:** Code reviewers, security auditors, debugging agents, long-running analysis

## Invocation Modes

### On-Demand (`"on-demand"`)

- Only invoked when explicitly requested by user or main agent
- Manual control over when to use
- Default for most profiles

**When to Use:** General purpose profiles, profiles with broad capabilities, user wants manual control

### Automatic (`"automatic"`)

- Automatically invoked when relevant to current task
- Based on `description` matching task context
- Requires clear, specific `description`

**When to Use:** Specialized profiles with clear purpose, domain experts

**Tips for Automatic Invocation:**
- Write clear, specific descriptions
- Include domain keywords (e.g., "security", "code review", "documentation")
- Avoid overly broad descriptions that trigger too frequently
- Focus on the agent's unique value proposition

**Example Description (Good):**
```
"Expert code review specialist focused on quality, security, and adherence to coding standards"
```

**Example Description (Bad - too vague):**
```
"Helps with code"
```

## Subagent Filtering

`enabledSubagentIds` on a **parent** agent profile controls which subagent profiles it can use.

### How It Works

When a main agent has `useSubagents: true`, it can delegate tasks to subagents. The `enabledSubagentIds` field controls which subagents are available:

- **Omitted/undefined** — All enabled subagents are available (default)
- **Array of profile IDs** — Only subagents whose `id` matches are available

### Subagent Eligibility

A subagent profile must pass `isSubagentEnabled(agentProfile, mainAgentProfile?)` check:
1. `subagent.enabled` must be `true`
2. Must not be the same profile as the main agent
3. If parent has `enabledSubagentIds` defined, subagent's `id` must be in the array

### Filtering Scenarios

**Allow all subagents** (default):
```json
{
  "useSubagents": true
  // enabledSubagentIds omitted
}
```

**Allow only specific subagents:**
```json
{
  "useSubagents": true,
  "enabledSubagentIds": ["code-reviewer", "security-auditor", "doc-generator"]
}
```

**Parent allows all, override for a restricted child agent:**
```json
{
  "useSubagents": true,
  "enabledSubagentIds": ["code-reviewer"]
}
```

### Practical Use Cases

- **Security-focused agent**: Only allow security auditor and code reviewer subagents
- **Documentation agent**: Only allow documentation generator subagent
- **Orchestrator agent**: Allow all subagents (omit `enabledSubagentIds`)
- **Sandboxed/isolated agent**: Allow no subagents (set `useSubagents: false`)

## Color Selection

Colors help visually distinguish subagents in the UI.

**Common Color Patterns:**
- **Blue** (`#3b82f6` / `#3368a8`): General purpose, power tools
- **Red** (`#ef4444` / `#dc2626`): Security, critical tasks
- **Green** (`#10b981`): Success, Aider, positive actions
- **Purple** (`#8b5cf6`): Documentation, creative tasks
- **Yellow/Orange** (`#f59e0b`): Warnings, analysis
- **Gray** (`#6b7280`): Neutral, default

## Default Configuration

**Every agent that should be delegable should have subagent enabled:**

```json
{
  "subagent": {
    "enabled": true,
    "contextMemory": "off",
    "systemPrompt": "",
    "invocationMode": "on-demand",
    "color": "#3368a8",
    "description": ""
  }
}
```

**Adjust Based on Agent Type:**
- **Analysis experts**: `contextMemory: "full-context"`, `invocationMode: "automatic"`
- **Progressive builders**: `contextMemory: "last-message"`, `invocationMode: "automatic"`
- **General purpose**: `contextMemory: "off"`, `invocationMode: "on-demand"`
- **Single-task agents**: `contextMemory: "off"`, `invocationMode: "on-demand"`

## Configuration Checklist

Before finalizing subagent configuration:

- [ ] `enabled` reflects whether this profile should be delegable
- [ ] `contextMemory` is appropriate for agent type
- [ ] `systemPrompt` is set if subagent-specific behavior is needed (optional — falls back to top-level `systemPrompt`)
- [ ] `invocationMode` matches agent's intended use
- [ ] If `invocationMode` is "automatic", `description` is non-empty and specific
- [ ] `color` is visually distinct and appropriate
- [ ] Parent profiles with `useSubagents: true` have `enabledSubagentIds` set if filtering is needed
- [ ] All referenced subagent IDs in `enabledSubagentIds` correspond to existing profiles

## Common Subagent Patterns

### Analysis Agent (Automatic Subagent)
```json
{
  "subagent": {
    "enabled": true,
    "contextMemory": "full-context",
    "systemPrompt": "You are an expert analyst specializing in code quality and security analysis.",
    "invocationMode": "automatic",
    "color": "#ef4444",
    "description": "Expert analyst for detailed code and security analysis"
  }
}
```

### Documentation Agent (On-Demand Subagent)
```json
{
  "subagent": {
    "enabled": true,
    "contextMemory": "last-message",
    "systemPrompt": "You are a technical documentation specialist. Create clear, comprehensive documentation.",
    "invocationMode": "on-demand",
    "color": "#8b5cf6",
    "description": ""
  }
}
```

### Orchestrator Agent (Uses Filtered Subagents)
```json
{
  "useSubagents": true,
  "enabledSubagentIds": ["code-reviewer", "security-auditor", "doc-generator"],
  "toolApprovals": {
    "subagents---run_task": "always"
  }
}
```

### General Purpose Agent (Uses All Subagents)
```json
{
  "useSubagents": true,
  "toolApprovals": {
    "subagents---run_task": "always"
  }
}
```

## Integration Notes

- Nested subagents are disabled by default (a subagent cannot use its own subagents)
- Todo tools are disabled for subagents (`useTodoTools: false` in subagent runtime config)
- Context messages are collected from both `contextMessages` and `currentMessages`
- When context is passed, an enhanced prompt is added: "Make sure to reuse previous conversation if possible."
- Subagent runs with its own abort controller; parent abort cascades to subagent

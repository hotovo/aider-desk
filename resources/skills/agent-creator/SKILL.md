---
name: agent-creator
description: Create and configure AiderDesk agent profiles by defining tool groups, approval rules, system prompts, subagent settings, subagent filtering, and provider/model selection. Use when setting up a new agent, creating a profile, or configuring agent tools, permissions, and subagent behavior.
---

# Agent Profile Creator

Create agent profiles stored as `config.json` in `~/.aider-desk/agents/{name}/` (global) or `{project}/.aider-desk/agents/{name}/` (project-level).

Read all reference files before proposing a profile to ensure accuracy:
- `references/agent-profile-schema.md` — Complete property reference
- `references/subagent-guide.md` — Subagent config, system prompts, context memory, filtering
- `references/tool-approval-guide.md` — All tool groups, correct tool keys, approval strategies
- `references/profile-examples.md` — Complete working examples

## Q&A Process

Gather complete requirements before proposing a profile. Ask focused questions, propose internally, and present **one** final summary for approval.

### Step 1: Purpose & Behavior

Ask: "Describe the agent's purpose and what it should do."

Based on the response, internally propose:
- Name (derived from purpose)
- Max iterations (default `0` = unlimited; use a finite value like 250 for bounded tasks, or lower for focused tasks like review/analysis: 150)
- Tool groups (based on purpose — see Step 3)
- Custom instructions (free-text guidance appended to the system prompt)
- **System prompt** — does the agent need a fully custom system prompt that replaces the default built-in one? If the user describes specific behavioral constraints, role, or identity, propose a `systemPrompt`.
- **Subagent config** — should this profile be usable as a subagent? If yes, gather subagent-specific system prompt, invocation mode, color, description, and context memory mode.

### Step 2: Provider & Model

Ask: "Which provider/model? (format: provider/model, e.g., anthropic/claude-sonnet-5)"

- Split by first slash to get provider and model
- Use as-is (correct obvious typos only)
- If the user does not specify, **default to `anthropic` / `claude-sonnet-5`** (matching `DEFAULT_AGENT_PROFILE` / `DEFAULT_PROVIDER_MODELS` in `packages/common/src/agent.ts`). You may ask the user for their preferred provider/model, but if none is given, use these defaults.
- Optionally ask about `temperature` and `maxTokens` if the purpose implies precision (low temp) or creativity (high temp)

### Step 3: Tool Groups & Approvals

Based on the purpose, propose tool groups to enable. Present each group with a brief rationale:

| Tool Group Flag | Description | When to Enable |
|----------------|-------------|----------------|
| `usePowerTools` | File read/write/edit, glob, grep, bash, semantic_search, fetch | Most agents needing file or system access |
| `useAiderTools` | Aider AI code generation context management and run | Code generation/refactoring agents |
| `useTodoTools` | Todo list management | Agents tracking multi-step work |
| `useSubagents` | Delegate tasks to subagents | Orchestrator/manager agents |
| `useTaskTools` | Create/list/get/delete/search tasks, run prompts | Project management agents |
| `useMemoryTools` | Store/retrieve persisted knowledge | Most agents (disabled for stateless ones) |
| `useSkillsTools` | Activate skills | Agents that benefit from specialized skills |
| `useExtensionTools` | Tools provided by installed extensions (default: true) | Most agents; disable for sandboxed/isolated profiles |

For each enabled group, propose tool approval defaults (`always`, `ask`, `never`). Only include tools in `toolApprovals` that deviate from the default `"ask"`.

If `useSubagents` is enabled, ask: "Should this agent use all available subagents or only specific ones?" — set `enabledSubagentIds` if filtering is needed (omit for all).

### Step 4: Subagent Configuration

Ask: "Should this profile be usable as a subagent by other agents?"

If yes, gather:
- **Subagent system prompt** — specialized prompt for subagent role (distinct from the main agent `systemPrompt`)
- **Invocation mode** — automatic (needs a clear description) or on-demand
- **Context memory** — off (default), last-message, or full-context
- **Color** — visual identifier
- **Description** — required for automatic invocation; should contain domain keywords

### Step 5: Advanced Settings (Optional)

**Only ask if user mentioned** any of these:
- Temperature (0.1-1.0)
- Max tokens
- Min time between tool calls (rate limiting, in ms)
- MCP servers to enable (`enabledServers`)
- Rule files (markdown files placed in `~/.aider-desk/agents/{name}/rules/`)
- Auto-compaction overrides (`autoCompactThresholdPercentage`, `autoCompactThresholdTokens`, `autoCompactionType`)
- Bash tool settings (`allowedPattern` / `deniedPattern` regex)

If not mentioned, skip this step entirely.

### Step 6: Location

Ask: "Global profile (all projects) or project-specific? (default: global)"

### Step 7: Review & Confirm

Present **one complete summary** with all proposed properties:

- Name, provider/model, temperature/maxTokens (if set)
- Tool groups enabled with rationale
- Tool approvals (which are "never", which are "always"; rest default to "ask")
- System prompt (if any)
- Custom instructions (if any)
- Subagent config (if enabled)
- Subagent filtering (`enabledSubagentIds`, if applicable)
- Rule files (if any)
- Location (global/project)

Ask: "Here's your agent profile. Should I create it?"

**Do not ask for confirmations on individual items.** Only one final approval.

### Step 8: Create

On confirmation:
1. Choose a unique, readable `id` (e.g., `code-reviewer`, `security-auditor`). No UUID is required — readable names matching the examples are fine, as long as it is unique.
2. Build the complete `config.json` — verify structure against `references/profile-examples.md`
3. Do **not** include `ruleFiles` in config.json — rule files are dynamically discovered from the `rules/` subdirectory
4. Do **not** include `isSubagent` — it's a runtime flag
5. Create the directory and write `config.json`
6. If rule files were requested, create them as `.md` files in a `rules/` subdirectory next to `config.json`

## Tool Approval Strategy

**Keys: `{group}---{tool}`** (three dashes as separator)

**Default is "ask"**. Only explicitly set:
- **"never"**: Tools completely irrelevant to the agent's purpose
- **"always"**: Safe, essential, read-only operations

Do not include tools that should remain at default ("ask").

Only include tool keys that exist in `references/tool-approval-guide.md`.

## System Prompt Strategy

Two distinct system prompt fields exist:

1. **Top-level `systemPrompt`** — overrides the default built-in system prompt when this profile runs as the **main agent**. Rules files and `customInstructions` are still appended. Use when the agent needs a completely different identity or behavioral framework.

2. **`subagent.systemPrompt`** — used when this profile runs as a **subagent**. Passed directly to the subagent's LLM. If empty, falls back to the top-level `systemPrompt`.

**When to use which:**
- Agent works only as main agent → set top-level `systemPrompt`
- Agent works only as subagent → set `subagent.systemPrompt`
- Agent works in both roles → set both; they can differ for context-appropriate behavior
- Agent doesn't need custom prompts → leave both empty; default system prompt is used

## Subagent Configuration

Every agent **can** be a subagent. Set `subagent.enabled: true` to allow delegation.

**Context memory modes:**
- `"off"` — fresh each time (default for most agents)
- `"last-message"` — receives last result from previous runs
- `"full-context"` — full conversation history (for complex iterative analysis)

**Subagent filtering:** `enabledSubagentIds?: string[]` on the **parent** profile controls which subagents it can use. Omit to allow all. Set to an array of profile `id` values to restrict. Note: `enabledSubagentIds` holds **profile `id` values** (the same `id` field set on each profile), not directory names — they only match when a directory name happens to equal the profile `id`.

See `references/subagent-guide.md` for detailed guidance.

## Minimal config.json Structure

```json
{
  "id": "my-agent",
  "name": "my-agent",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 0,
  "minTimeBetweenToolCalls": 0,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---bash": "ask"
  },
  "toolSettings": {},
  "includeContextFiles": false,
  "includeRepoMap": false,
  "usePowerTools": true,
  "useAiderTools": false,
  "useTodoTools": true,
  "useSubagents": false,
  "useTaskTools": false,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "disabledExtensionTools": [],
  "customInstructions": "",
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

**Note on defaults shown above:** `id` is any unique readable string (no UUID needed). When the user does not specify provider/model, default to `anthropic` / `claude-sonnet-5`. `maxIterations: 0` means unlimited. `includeContextFiles` and `includeRepoMap` both default to `false` — the values above are defaults; set them to `true` only when you want context files / repo map included. The subagent `color` default is `#3368a8`.

## Validation Checklist

Before writing `config.json`:

- [ ] Unique name
- [ ] Unique, readable `id` (no UUID required)
- [ ] Provider/model present (use as-is; default to `anthropic`/`claude-sonnet-5` if unspecified)
- [ ] Tool keys use `{group}---{tool}` format with three dashes
- [ ] Tool approval values are "always", "ask", or "never"
- [ ] Only tools from `references/tool-approval-guide.md` are in `toolApprovals`
- [ ] `systemPrompt` set only if custom behavior is needed
- [ ] `subagent.enabled` reflects whether this profile should be delegable
- [ ] If `subagent.invocationMode` is "automatic", `description` is non-empty
- [ ] If `useSubagents` is true and filtering needed, `enabledSubagentIds` is set
- [ ] `useExtensionTools` and `disabledExtensionTools` included (default: true / [])
- [ ] `ruleFiles` NOT in config.json (dynamically discovered)
- [ ] `isSubagent` NOT in config.json (runtime flag)
- [ ] All boolean tool group flags present
- [ ] Directory location matches user preference (global/project)

## Resources

- `references/agent-profile-schema.md` — Complete schema with all properties and types
- `references/subagent-guide.md` — Subagent config, context memory, filtering, system prompts
- `references/tool-approval-guide.md` — All tool groups and correct tool keys
- `references/profile-examples.md` — Complete working examples
- `assets/templates/config.json.template` — Template
- `assets/examples/sample-profile.json` — Example profile

---
name: agent-creator
description: Create and configure AiderDesk agent profiles by defining tool groups, approval rules, subagent settings, and provider/model selection. Use when setting up a new agent, creating a profile, or configuring agent tools and permissions.
---

# Agent Profile Creator

Create agent profiles stored as `config.json` in `~/.aider-desk/agents/{name}/` (global) or `{project}/.aider-desk/agents/{name}/` (project-level).

Read all reference files before proposing a profile to ensure accuracy.

## Q&A Process

### Step 1: Understand Purpose

Ask user: "Describe the agent's purpose and what it should do."

Based on their response, **internally propose** all properties:
- Name (derived from purpose)
- Max iterations (default 250)
- Tool groups (based on purpose)
- Custom instructions (if applicable)
- Subagent config (always enabled, contextMemory: "off" by default)
- Tool approvals (based on needs)

### Step 2: Provider/Model

Ask: "Which provider/model? (format: provider/model, e.g., anthropic/claude-sonnet-4-5-20250929)"

- Split by first slash to get provider and model
- **No validation** - use as-is (correct obvious typos only)

### Step 3: Optional Advanced Settings

**ONLY ask if user specifically mentioned** temperature, max tokens, rate limiting, or MCP servers:

- "What temperature should I use?" (0.1-1.0, optional)
- "Max tokens limit?" (optional)
- "Min time between tool calls in ms?" (optional)
- "Which MCP servers should be enabled?" (optional, default: none)

If not mentioned, skip this entire step.

### Step 4: Location

Ask: "Global profile (all projects) or project-specific? (default: global)"

### Step 5: Single Review & Confirm

Present **one complete summary** with all proposed properties. Ask:

"Here's your agent profile. Should I create it?"

Show:
- Name, provider/model
- Tool groups enabled
- Tool approvals summary (which are "never", which are "always")
- Subagent config
- Location

**DO NOT ask for confirmations on individual items.** Only one final approval.

### Step 6: Create

On user confirmation, generate the profile. Verify structure against `references/profile-examples.md` before creating files.

## Tool Approval Strategy

**Keys: `{group}---{tool}`** (three dashes)

**Default is "ask"**. Only set:
- **"never"**: Tools completely irrelevant (e.g., `power---bash` for read-only agents)
- **"always"**: Safe, essential tools (e.g., read operations for reviewers)

Only include tools that exist in `references/tool-approval-guide.md`.

## Subagent Configuration

**Every agent is a subagent (enabled: true)**. See `references/subagent-guide.md` for detailed guidance.

- `contextMemory`: **Default is `"off"`** (fresh each time)
  - Use `"full-context"` only for specialized analysis agents (code review, security audit)
  - Use `"last-message"` for progressive builders (documentation, iterative tasks)
- `systemPrompt`: Specialized for agent's purpose
- `invocationMode`: automatic (specialized), on-demand (general)
- `color`: Relevant color (e.g., red=security, blue=power tools)
- `description`: Clear description for auto-invocation

## Minimal config.json Structure

```json
{
  "name": "my-agent",
  "provider": "anthropic",
  "model": "claude-sonnet-4-5-20250929",
  "maxIterations": 250,
  "toolGroups": ["power", "todo"],
  "toolApprovals": {
    "power---bash": "ask",
    "power---read": "always"
  },
  "subagent": {
    "enabled": true,
    "contextMemory": "off"
  }
}
```

## Validation

- Unique name
- Provider/model: Use as-is (correct obvious typos only)
- Tool keys: `{group}---{tool}` format
- Values: "always", "ask", or "never"
- Subagent enabled
- All tool keys from references

## Resources

- `references/agent-profile-schema.md` - Complete schema
- `references/subagent-guide.md` - Subagent configuration guide (context memory modes)
- `references/profile-examples.md` - Examples
- `references/tool-approval-guide.md` - Tool approval config
- `assets/templates/config.json.template` - Template
- `assets/examples/sample-profile.json` - Example

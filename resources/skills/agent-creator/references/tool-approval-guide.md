# Tool Approval Configuration Guide

Complete guide to configuring tool approvals for agent profiles in AiderDesk.

## Overview

Tool approvals control when and how an agent can use specific tools. Each tool can be set to one of three states:

1. **Always** (`"always"`) - Auto-approve tool usage without prompting
2. **Ask** (`"ask"`) - Prompt user for approval each time the tool is used (**DEFAULT**)
3. **Never** (`"never"`) - Disable the tool completely

**Important**: The default value is "ask". Only explicitly set tools to "always" or "never" based on the agent's needs. Do not include tools that should remain at "ask" in `toolApprovals`.

## Tool Approval States

### Always (`"always"`)
- Tool executes immediately without user confirmation
- Best for safe, read-only operations
- Reduces friction for trusted actions

**Use cases:** Reading files, searching code, finding files, retrieving memories

### Ask (`"ask"`)
- Prompts user before each tool execution
- Provides transparency and control
- Ideal for potentially destructive operations

**Use cases:** Editing files, running commands, creating/deleting tasks, Aider operations

### Never (`"never"`)
- Tool is completely disabled for the profile
- Cannot be used even with manual approval
- Useful for restricting dangerous capabilities

**Use cases:** Shell commands for read-only profiles, file editing in review-only agents

## Tool Groups and Their Tools

### Power Tools (`power---*`) — enabled by `usePowerTools`

Direct file system and system operations.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `power---file_read` | **always** | Most profiles | Default | Air-gapped systems |
| `power---file_write` | ask | Trusted contexts | Default | Review-only agents |
| `power---file_edit` | ask | Trusted contexts | Default | Review-only agents |
| `power---glob` | **always** | Most profiles | Default | None |
| `power---grep` | **always** | Most profiles | Default | None |
| `power---semantic_search` | **always** | Most profiles | Default | None |
| `power---bash` | ask | Trusted scripts | Default | Read-only profiles |
| `power---fetch` | ask | Trusted domains | Default | Air-gapped systems |

**Recommended Patterns:**

```json
// Full access profile
{
  "toolApprovals": {
    "power---file_read": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always"
  }
}

// Read-only profile
{
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_write": "never",
    "power---file_edit": "never",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "power---bash": "never"
  }
}
```

### Aider Tools (`aider---*`) — enabled by `useAiderTools`

AI-powered code generation via Aider.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `aider---get_context_files` | **always** | Always helpful | Default | N/A |
| `aider---add_context_files` | **always** | Auto-building context | Default | N/A |
| `aider---drop_context_files` | ask | Bulk operations | Default | N/A |
| `aider---run` | ask | Trusted contexts | Default | Non-Aider profiles |

**Recommended Patterns:**

```json
// Full Aider profile
{
  "toolApprovals": {
    "aider---get_context_files": "always",
    "aider---add_context_files": "always"
  }
}

// Aider with auto-approve (advanced users)
{
  "toolApprovals": {
    "aider---get_context_files": "always",
    "aider---add_context_files": "always",
    "aider---drop_context_files": "always",
    "aider---run": "always"
  }
}
```

### Subagents Tools (`subagents---*`) — enabled by `useSubagents`

Task delegation to specialized subagents.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `subagents---run_task` | **always** | Trusted subagents | Default | Subagent-free profiles |

**Recommended Patterns:**

```json
// With subagent delegation
{
  "toolApprovals": {
    "subagents---run_task": "always"
  }
}

// Manual subagent control
{
  "toolApprovals": {
    "subagents---run_task": "ask"
  }
}
```

### Memory Tools (`memory---*`) — enabled by `useMemoryTools`

Persistent information storage and retrieval.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `memory---store_memory` | **always** | Learning preferences | Default | Stateless profiles |
| `memory---retrieve_memory` | **always** | Always helpful | Default | Stateless profiles |
| `memory---delete_memory` | **never** | Trusted contexts only | Default | Most profiles |
| `memory---list_memories` | **never** | Admin/debug contexts | Default | Most profiles |
| `memory---update_memory` | **never** | Trusted contexts only | Default | Most profiles |

**Note:** The default profile has `delete_memory`, `list_memories`, and `update_memory` set to `"never"` for safety. Override to `"always"` only for trusted/admin profiles.

**Recommended Patterns:**

```json
// Full memory support (standard)
{
  "toolApprovals": {
    "memory---store_memory": "always",
    "memory---retrieve_memory": "always"
  }
}

// Full memory control (admin/trusted)
{
  "toolApprovals": {
    "memory---store_memory": "always",
    "memory---retrieve_memory": "always",
    "memory---delete_memory": "always",
    "memory---list_memories": "always",
    "memory---update_memory": "always"
  }
}

// Stateless profile (no memory)
{
  "useMemoryTools": false
}
```

### Skills Tools (`skills---*`) — enabled by `useSkillsTools`

Access to project-specific and built-in skills.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `skills---activate_skill` | **always** | Auto-skills | Default | No custom skills |

**Recommended Patterns:**

```json
// With skills
{
  "toolApprovals": {
    "skills---activate_skill": "always"
  }
}
```

### Task Tools (`tasks---*`) — enabled by `useTaskTools`

Task management and tracking within the project.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `tasks---list_tasks` | **always** | Always helpful | Default | N/A |
| `tasks---get_task` | **always** | Always helpful | Default | N/A |
| `tasks---get_task_message` | **always** | Always helpful | Default | N/A |
| `tasks---create_task` | ask | Trusted contexts | Default | N/A |
| `tasks---delete_task` | ask | Trusted contexts | Default | N/A |
| `tasks---search_task` | **always** | Always helpful | Default | N/A |
| `tasks---run_prompt` | ask | Trusted contexts | Default | N/A |
| `tasks---search_parent_task` | **always** | Always helpful | Default | N/A |

**Recommended Patterns:**

```json
// Standard task tools
{
  "toolApprovals": {
    "tasks---list_tasks": "always",
    "tasks---get_task": "always",
    "tasks---get_task_message": "always",
    "tasks---search_task": "always",
    "tasks---search_parent_task": "always"
  }
}

// Full task management (trusted)
{
  "toolApprovals": {
    "tasks---list_tasks": "always",
    "tasks---get_task": "always",
    "tasks---get_task_message": "always",
    "tasks---create_task": "always",
    "tasks---delete_task": "always",
    "tasks---search_task": "always",
    "tasks---run_prompt": "always",
    "tasks---search_parent_task": "always"
  }
}
```

### Todo Tools (`todo---*`) — enabled by `useTodoTools`

Todo list management for tracking multi-step work.

| Tool | Recommended Default | When to Use "Always" | When to Use "Ask" | When to Use "Never" |
|------|-------------------|---------------------|-------------------|---------------------|
| `todo---set_items` | **always** | Always helpful | Default | N/A |
| `todo---get_items` | **always** | Always helpful | Default | N/A |
| `todo---update_item_completion` | **always** | Always helpful | Default | N/A |
| `todo---clear_items` | **always** | Always helpful | Default | N/A |

**Recommended Patterns:**

```json
// Standard todo tools
{
  "toolApprovals": {
    "todo---set_items": "always",
    "todo---get_items": "always",
    "todo---update_item_completion": "always",
    "todo---clear_items": "always"
  }
}
```

### Extension Tools — enabled by `useExtensionTools`

Tools dynamically provided by installed AiderDesk extensions.

- Tool keys use `{extensionToolGroupName}---{toolName}` format
- Group names are defined by each extension individually
- Tool keys cannot be enumerated statically — they depend on installed extensions
- Use `disabledExtensionTools: ["extensionId"]` to disable all tools from a specific extension
- Set `useExtensionTools: false` to disable all extension tools entirely

**Configuration:**

```json
// Extension tools enabled (default), disable specific extension
{
  "useExtensionTools": true,
  "disabledExtensionTools": ["untrusted-extension"]
}

// All extension tools disabled
{
  "useExtensionTools": false,
  "disabledExtensionTools": []
}
```

**Note:** Extension tool approval keys can be added to `toolApprovals` if you know the extension's tool group name and tool names. Check the extension's documentation for the exact tool keys.

## Tool Settings

Some tools support additional configuration beyond approval states.

### Bash Tool Settings

Control which shell commands can be executed via `toolSettings`.

```json
{
  "toolSettings": {
    "power---bash": {
      "allowedPattern": "^(git|npm|ls|cat|echo)\\s",
      "deniedPattern": "(rm -rf|dd|mkfs|format)"
    }
  }
}
```

**Components:**
- `allowedPattern` - Regex pattern for allowed commands (empty string = all allowed)
- `deniedPattern` - Regex pattern for denied commands (overrides allowed pattern)

**Examples:**

```json
// Allow only git commands
{
  "power---bash": {
    "allowedPattern": "^git\\s",
    "deniedPattern": ""
  }
}

// Block dangerous commands
{
  "power---bash": {
    "allowedPattern": "",
    "deniedPattern": "(rm -rf|--force|dd|mkfs|format)"
  }
}
```

## Best Practices

### 1. Start Conservative
Begin with "ask" for most tools, then relax as trust builds. Only set "always" for safe read-only operations.

### 2. Profile-Specific Defaults
Different profiles need different defaults:

- **Code Reviewer**: Read-only, always for search tools, never for edits
- **Developer**: Ask for edits, always for read operations
- **Auditor**: Never for destructive tools, always for analysis
- **Orchestrator**: Always for subagent delegation, ask for direct operations

### 3. Group-Level Control
Use tool group toggles (`usePowerTools`, `useAiderTools`, etc.) before configuring individual tools. If a group is disabled, its tools are not available regardless of `toolApprovals`.

### 4. Context Awareness
Consider:
- Environment (development vs production)
- User expertise level
- Project criticality
- Security requirements

### 5. Review Regularly
Periodically audit tool approvals:
- Remove unused "never" tools
- Relax "ask" to "always" for trusted operations
- Add restrictions for security concerns

## Common Configurations

### Safe Development Profile
```json
{
  "usePowerTools": true,
  "useTodoTools": true,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "toolApprovals": {
    "power---file_read": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "memory---store_memory": "always",
    "memory---retrieve_memory": "always",
    "todo---set_items": "always",
    "todo---get_items": "always",
    "todo---update_item_completion": "always",
    "todo---clear_items": "always",
    "skills---activate_skill": "always"
  }
}
```

### Read-Only Auditor Profile
```json
{
  "usePowerTools": true,
  "useMemoryTools": true,
  "useExtensionTools": false,
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_write": "never",
    "power---file_edit": "never",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "power---bash": "never",
    "memory---store_memory": "always",
    "memory---retrieve_memory": "always"
  }
}
```

### Full Access Orchestrator Profile
```json
{
  "usePowerTools": true,
  "useTodoTools": true,
  "useSubagents": true,
  "useTaskTools": true,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_write": "always",
    "power---file_edit": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "subagents---run_task": "always",
    "tasks---list_tasks": "always",
    "tasks---get_task": "always",
    "tasks---get_task_message": "always",
    "tasks---search_task": "always",
    "tasks---search_parent_task": "always",
    "memory---store_memory": "always",
    "memory---retrieve_memory": "always",
    "skills---activate_skill": "always",
    "todo---set_items": "always",
    "todo---get_items": "always",
    "todo---update_item_completion": "always",
    "todo---clear_items": "always"
  }
}
```

## Troubleshooting

### Tool Not Available
**Issue:** Agent tries to use a tool that doesn't work.

**Solution:**
1. Verify the tool group is enabled (e.g., `usePowerTools: true`)
2. Check `toolApprovals` — the tool might be set to "never"
3. For extension tools, verify `useExtensionTools: true` and extension is not in `disabledExtensionTools`
4. Verify the tool key format: `{group}---{tool}` (three dashes)

### Excessive Prompts
**Issue:** Too many approval prompts during workflow.

**Solution:**
1. Identify frequently-used tools
2. Change "ask" to "always" for trusted operations
3. Consider creating specialized profiles for different tasks

### Tool Executes Unexpectedly
**Issue:** Tool runs without confirmation.

**Solution:**
1. Review `toolApprovals` for "always" settings
2. Change to "ask" for better control
3. Implement `toolSettings` restrictions if needed

### Bash Command Blocked
**Issue:** Shell command is denied.

**Solution:**
1. Check `allowedPattern` regex in `toolSettings`
2. Review `deniedPattern` restrictions
3. Adjust patterns to permit necessary commands

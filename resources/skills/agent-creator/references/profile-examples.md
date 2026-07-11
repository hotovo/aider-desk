# Agent Profile Examples

Complete examples of different agent profile types for AiderDesk.

## 1. Power Tools Profile

Use case: Direct file system access and system operations.

```json
{
  "id": "power-tools-profile",
  "name": "Power Tools",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 250,
  "minTimeBetweenToolCalls": 0,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_write": "always",
    "power---file_edit": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always"
  },
  "toolSettings": {},
  "includeContextFiles": true,
  "includeRepoMap": true,
  "usePowerTools": true,
  "useAiderTools": false,
  "useTodoTools": true,
  "useSubagents": false,
  "useTaskTools": true,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "disabledExtensionTools": [],
  "customInstructions": "",
  "subagent": {
    "enabled": false,
    "contextMemory": "off",
    "systemPrompt": "",
    "invocationMode": "on-demand",
    "color": "#3b82f6",
    "description": ""
  }
}
```

**Key characteristics:**
- `usePowerTools: true` enables the full power tools group
- Most file operations set to "always" approve
- Shell commands left at default "ask" for safety
- No Aider tools, uses direct file manipulation
- Includes memory, skills, todo, and task tools
- Extension tools enabled (default)

---

## 2. Aider Profile

Use case: AI-powered code generation using Aider's advanced capabilities.

```json
{
  "id": "aider-profile",
  "name": "Aider",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 250,
  "minTimeBetweenToolCalls": 0,
  "enabledServers": [],
  "toolApprovals": {
    "aider---get_context_files": "always",
    "aider---add_context_files": "always",
    "power---file_read": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always"
  },
  "toolSettings": {},
  "includeContextFiles": true,
  "includeRepoMap": true,
  "usePowerTools": false,
  "useAiderTools": true,
  "useTodoTools": true,
  "useSubagents": false,
  "useTaskTools": true,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "disabledExtensionTools": [],
  "customInstructions": "",
  "subagent": {
    "enabled": false,
    "contextMemory": "off",
    "systemPrompt": "",
    "invocationMode": "on-demand",
    "color": "#10b981",
    "description": ""
  }
}
```

**Key characteristics:**
- `useAiderTools: true` enables Aider-specific tools
- `usePowerTools: false` — relies on Aider for file operations
- Limited power tools: only read-only operations approved
- Aider operations left at default "ask" for review
- Extension tools enabled (default)

---

## 3. Code Reviewer (Automatic Subagent with Custom System Prompt)

Use case: Specialized subagent for code review tasks with both main agent and subagent system prompts.

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
    "power---bash": "never",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always"
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
  "useExtensionTools": false,
  "disabledExtensionTools": [],
  "customInstructions": "Focus on code quality, security, and best practices. Provide constructive feedback.",
  "systemPrompt": "You are a code review expert. Analyze changes for correctness, security, and adherence to coding standards. Provide constructive feedback with severity ratings.",
  "subagent": {
    "enabled": true,
    "contextMemory": "full-context",
    "systemPrompt": "You are a code review subagent. Focus on the specific code changes provided. Identify bugs, potential issues, and improvement opportunities. Be concise and actionable.",
    "invocationMode": "automatic",
    "color": "#ef4444",
    "description": "Expert code review specialist focused on quality and security"
  }
}
```

**Key characteristics:**
- Both `systemPrompt` (main agent) and `subagent.systemPrompt` (subagent role) are set
- `subagent.enabled: true` for delegation
- `invocationMode: automatic` with clear description for auto-triggering
- `contextMemory: full-context` — sees entire conversation history
- Lower `maxIterations` (150) and `temperature` (0.3) for focused analysis
- Read-only tools (no editing or shell commands)
- Extension tools disabled for isolated review context

---

## 4. Documentation Generator (On-Demand Subagent)

Use case: Generating and updating documentation, usable as subagent.

```json
{
  "id": "doc-generator",
  "name": "Documentation Generator",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 200,
  "minTimeBetweenToolCalls": 0,
  "maxTokens": 16384,
  "temperature": 0.5,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_write": "always",
    "power---file_edit": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "power---bash": "never"
  },
  "toolSettings": {},
  "includeContextFiles": true,
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
  "customInstructions": "Generate clear, well-structured documentation in Markdown. Use proper formatting, code blocks, and examples.",
  "subagent": {
    "enabled": true,
    "contextMemory": "last-message",
    "systemPrompt": "You are a technical documentation specialist. Create comprehensive, user-friendly documentation that explains concepts clearly and provides practical examples.",
    "invocationMode": "on-demand",
    "color": "#8b5cf6",
    "description": "Technical documentation expert specializing in clear, comprehensive docs"
  }
}
```

**Key characteristics:**
- High `maxTokens` (16384) for long-form content
- Moderate `temperature` (0.5) for creative yet structured output
- File editing enabled, shell commands disabled
- Subagent with `last-message` context for progressive building
- On-demand invocation (user triggers explicitly)

---

## 5. Security Auditor (Automatic Subagent, Strict Restrictions)

Use case: Security-focused code analysis and vulnerability detection.

```json
{
  "id": "security-auditor",
  "name": "Security Auditor",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 250,
  "minTimeBetweenToolCalls": 100,
  "maxTokens": 8192,
  "temperature": 0.2,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---file_edit": "never",
    "power---bash": "never",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "power---fetch": "always"
  },
  "toolSettings": {
    "power---bash": {
      "allowedPattern": "^$",
      "deniedPattern": ".*"
    }
  },
  "includeContextFiles": true,
  "includeRepoMap": true,
  "usePowerTools": true,
  "useAiderTools": false,
  "useTodoTools": false,
  "useSubagents": false,
  "useTaskTools": false,
  "useMemoryTools": true,
  "useSkillsTools": false,
  "useExtensionTools": false,
  "disabledExtensionTools": [],
  "customInstructions": "Focus exclusively on security vulnerabilities, including XSS, SQL injection, authentication issues, authorization flaws, and OWASP Top 10 risks. Provide severity ratings and remediation steps.",
  "subagent": {
    "enabled": true,
    "contextMemory": "full-context",
    "systemPrompt": "You are a security expert specializing in application security. Identify vulnerabilities following OWASP guidelines and industry best practices. Provide clear, actionable remediation steps with severity ratings (Critical, High, Medium, Low).",
    "invocationMode": "automatic",
    "color": "#dc2626",
    "description": "Security specialist focused on vulnerability detection and OWASP compliance"
  }
}
```

**Key characteristics:**
- Very low `temperature` (0.2) for precise analysis
- `minTimeBetweenToolCalls: 100` for rate limiting
- Strict `toolSettings` blocking all bash commands
- Read-only access (no editing capabilities)
- Extension tools disabled for isolated security context
- Automatic invocation for security-related tasks

---

## 6. Orchestrator Agent (Uses Filtered Subagents)

Use case: Main agent that delegates to specific subagents using `enabledSubagentIds`.

```json
{
  "id": "orchestrator",
  "name": "Orchestrator",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 300,
  "minTimeBetweenToolCalls": 0,
  "enabledServers": [],
  "toolApprovals": {
    "power---file_read": "always",
    "power---glob": "always",
    "power---grep": "always",
    "power---semantic_search": "always",
    "subagents---run_task": "always",
    "tasks---list_tasks": "always",
    "tasks---get_task": "always",
    "tasks---get_task_message": "always",
    "tasks---search_task": "always",
    "tasks---search_parent_task": "always"
  },
  "toolSettings": {},
  "includeContextFiles": true,
  "includeRepoMap": true,
  "usePowerTools": true,
  "useAiderTools": false,
  "useTodoTools": true,
  "useSubagents": true,
  "useTaskTools": true,
  "useMemoryTools": true,
  "useSkillsTools": true,
  "useExtensionTools": true,
  "disabledExtensionTools": [],
  "enabledSubagentIds": ["code-reviewer", "security-auditor", "doc-generator"],
  "customInstructions": "You are an orchestrator agent. Delegate specialized tasks to appropriate subagents. Use task tools to manage work streams. Always verify subagent results before presenting to user.",
  "subagent": {
    "enabled": false,
    "contextMemory": "off",
    "systemPrompt": "",
    "invocationMode": "on-demand",
    "color": "#6b7280",
    "description": ""
  }
}
```

**Key characteristics:**
- `useSubagents: true` with `enabledSubagentIds` to restrict to specific subagents
- `subagents---run_task` set to "always" for smooth delegation
- Higher `maxIterations` (300) for complex orchestration
- Task tools enabled for work stream management
- Subagent disabled (this profile is a main agent, not delegable)
- Custom instructions for orchestration behavior

---

## 7. Minimal Profile

Use case: Basic agent with minimal tool set — starting point for custom configurations.

```json
{
  "id": "minimal-profile",
  "name": "Minimal Agent",
  "provider": "anthropic",
  "model": "claude-sonnet-5",
  "maxIterations": 250,
  "minTimeBetweenToolCalls": 0,
  "enabledServers": [],
  "toolApprovals": {},
  "toolSettings": {},
  "includeContextFiles": false,
  "includeRepoMap": false,
  "usePowerTools": false,
  "useAiderTools": false,
  "useTodoTools": false,
  "useSubagents": false,
  "useTaskTools": false,
  "useMemoryTools": false,
  "useSkillsTools": false,
  "useExtensionTools": false,
  "disabledExtensionTools": [],
  "customInstructions": "",
  "subagent": {
    "enabled": false,
    "contextMemory": "off",
    "systemPrompt": "",
    "invocationMode": "on-demand",
    "color": "#6b7280",
    "description": ""
  }
}
```

**Key characteristics:**
- All tool groups disabled
- No context files or repo map
- No approvals defined (uses defaults)
- Extension tools disabled
- Base configuration that can be extended

---

## Profile Type Comparison

| Profile Type | Power Tools | Aider Tools | Read-Only | Subagent | Uses Subagents | Extension Tools | Best For |
|--------------|-------------|-------------|-----------|----------|----------------|-----------------|----------|
| Power Tools | ✅ | ❌ | No | ❌ | ❌ | ✅ | Direct file operations |
| Aider | ❌ | ✅ | Partial | ❌ | ❌ | ✅ | Code generation/refactoring |
| Code Reviewer | ✅ (limited) | ❌ | Yes | ✅ | ❌ | ❌ | Code analysis |
| Documentation | ✅ | ❌ | No | ✅ | ❌ | ✅ | Writing docs |
| Security Auditor | ✅ (limited) | ❌ | Yes | ✅ | ❌ | ❌ | Security analysis |
| Orchestrator | ✅ (limited) | ❌ | No | ❌ | ✅ | ✅ | Delegation & management |
| Minimal | ❌ | ❌ | Yes | ❌ | ❌ | ❌ | Custom configurations |

---

## Common Patterns

### Read-Only Profiles
Set these to "never" in `toolApprovals`:
```json
{
  "power---file_edit": "never",
  "power---file_write": "never",
  "power---bash": "never"
}
```

### Automatic Subagent Invocation
```json
{
  "subagent": {
    "enabled": true,
    "invocationMode": "automatic",
    "description": "Clear, specific description for auto-triggering",
    "systemPrompt": "Specialized system prompt for this role"
  }
}
```

### Subagent Filtering
```json
{
  "useSubagents": true,
  "enabledSubagentIds": ["code-reviewer", "security-auditor"]
}
```

### Custom System Prompt (Main Agent)
```json
{
  "systemPrompt": "You are a specialized agent. Follow these rules: ...",
  "customInstructions": "Additional behavioral guidance appended after system prompt."
}
```

### High Precision Analysis
```json
{
  "temperature": 0.1,
  "maxTokens": 8192,
  "maxIterations": 150
}
```

### Creative Content Generation
```json
{
  "temperature": 0.7,
  "maxTokens": 16384,
  "maxIterations": 250
}
```

### Rule Files Setup
Rule files are placed in a `rules/` subdirectory next to `config.json`:
```
~/.aider-desk/agents/my-agent/
├── config.json
└── rules/
    ├── coding-standards.md
    └── project-conventions.md
```
No configuration in `config.json` needed — rule files are discovered automatically.

### Auto-Compaction Overrides
```json
{
  "autoCompactThresholdPercentage": 80,
  "autoCompactThresholdTokens": 50000,
  "autoCompactionType": "smart"
}
```

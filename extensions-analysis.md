# Extension System Analysis: pi-mono vs AiderDesk

This document analyzes the extension examples from [pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions) and identifies what would be needed to support each in AiderDesk.

## Overview

### Current AiderDesk Extension Capabilities

AiderDesk's extension system supports:

- **Lifecycle**: `onLoad`, `onUnload`
- **Tools**: `getTools()` returning `ToolDefinition[]`
- **UI Elements**: `getUIElements()` returning `UIElementDefinition[]`
- **Commands**: `getCommands()` returning `CommandDefinition[]` ✨ **NEW**
- **Events**:
  - Task: `onTaskCreated`, `onTaskPrepared`, `onTaskInitialized`, `onTaskClosed`
  - Prompt: `onPromptStarted`, `onPromptFinished`
  - Agent: `onAgentStarted`, `onAgentFinished`, `onAgentStepFinished`
  - Aider: `onAiderPromptStarted`, `onAiderPromptFinished`
  - Tool: `onToolApproval`, `onToolCalled`, `onToolFinished`
  - File: `onFilesAdded`, `onFilesDropped`
  - Response: `onResponseChunk`, `onResponseCompleted`
  - Approval: `onHandleApproval`
  - Subagent: `onSubagentStarted`, `onSubagentFinished`
  - Question: `onQuestionAsked`, `onQuestionAnswered`
  - Command: `onCommandExecuted`, `onCustomCommandExecuted`
- **Context Methods**: `log`, `getProjectDir`, `getCurrentTask`, `createTask`, `getAgentProfiles`, `getModelConfigs`, `getSetting`, `updateSettings`, `showNotification`, `showConfirm`, `showInput`

### pi-mono Additional Capabilities

pi-mono has significantly more extension capabilities:

- **Events**: `session_start`, `session_before_switch/switch`, `session_before_fork/fork`, `session_before_compact/compact`, `session_before_tree/tree`, `session_shutdown`, `before_agent_start` (modify system prompt), `turn_start/end`, `message_start/update/end`, `tool_execution_start/update/end`, `context` (modify messages), `model_select`, `tool_call` (can block), `tool_result` (can modify), `user_bash` (intercept), `input` (transform/handle), `resources_discover`
- **API Methods**: `registerCommand`, `registerShortcut`, `registerFlag`, `registerProvider`, `registerMessageRenderer`, `sendMessage`, `sendUserMessage`, `appendEntry`, `setSessionName/getSessionName`, `setLabel`, `getCommands`, `getActiveTools/getAllTools/setActiveTools`, `setModel`, `getThinkingLevel/setThinkingLevel`, `events` (inter-extension), `exec`
- **Context**: `ctx.ui` (extensive - select, confirm, input, editor, notify, setStatus, setWidget, setFooter, setHeader, setTitle, setEditorText, setEditorComponent, setTheme), `ctx.hasUI`, `ctx.cwd`, `ctx.sessionManager`, `ctx.modelRegistry/model`, `ctx.isIdle/abort/hasPendingMessages`, `ctx.shutdown`, `ctx.getContextUsage`, `ctx.compact`, `ctx.getSystemPrompt`
- **Command Context**: `waitForIdle`, `newSession`, `fork`, `navigateTree`, `reload`

---

### hello.ts
**Status:** ✅ Possible

**Description:** Minimal custom tool registration example that greets a user by name.

**pi-mono APIs used:**
- `pi.registerTool()` with name, label, description, parameters (TypeBox), execute
- Tool result with `content` array and `details` object

**AiderDesk has:**
- `getTools()` returning `ToolDefinition[]` with name, description, inputSchema (Zod), execute
- Tool result supports `content` array and `details` object
- Zod schemas (instead of TypeBox) for parameter validation

**Missing:** None

**Implementation notes:**
Direct port possible. Replace TypeBox schema with Zod equivalent:
```typescript
// pi-mono
parameters: Type.Object({ name: Type.String() })

// AiderDesk
inputSchema: z.object({ name: z.string() })
```

---

### question.ts
**Status:** 🔶 Partial

**Description:** Single question tool with options list and inline editor for custom input.

**pi-mono APIs used:**
- `pi.registerTool()` with `renderCall`/`renderResult` for custom TUI rendering
- `ctx.ui.custom()` for full custom terminal UI component
- `ctx.hasUI` to check UI availability
- `@mariozechner/pi-tui`: Editor, Key, matchesKey, Text, truncateToWidth
- Tool result `details` for answer persistence

**AiderDesk has:**
- `getTools()` with execute - ✅
- `ExtensionContext.showConfirm()` - basic yes/no dialogs ✅
- `ExtensionContext.showInput()` - basic text input ✅
- Tool result `details` - ✅

**Missing:**
- ❌ `renderCall`/`renderResult` for custom tool call/result rendering
- ❌ `ctx.ui.custom()` for complex custom UI
- ❌ `ctx.ui.select()` for option selection with descriptions
- ❌ `ctx.hasUI` flag
- ❌ TUI components (Editor, Key handling, etc.)

**Workaround:**
Can implement basic version using `showInput()` for custom text or simple `showConfirm()` for first option. Lacks the rich TUI experience (option list, descriptions, navigation).

**Gap analysis:**
| Feature | pi-mono | AiderDesk | Alternative |
|---------|---------|-----------|-------------|
| Option selection | `ctx.ui.select()` | ❌ | Multiple `showConfirm()` calls |
| Custom input | Inline editor | `showInput()` | Separate prompt |
| Rich rendering | `renderCall`/`renderResult` | ❌ | Text in execute result |

---

### questionnaire.ts
**Status:** 🔶 Partial

**Description:** Multi-question tool with tab bar navigation between questions and submit step.

**pi-mono APIs used:**
- `pi.registerTool()` with `renderCall`/`renderResult`
- `ctx.ui.custom()` for complex multi-tab TUI
- `ctx.hasUI` for non-interactive mode check
- `@mariozechner/pi-tui`: Editor, Key, matchesKey, Text, truncateToWidth
- State management via tool result `details`

**AiderDesk has:**
- `getTools()` with execute - ✅
- `showConfirm()`/`showInput()` for basic interactions - ✅
- Tool result `details` - ✅

**Missing:**
- ❌ `renderCall`/`renderResult` for custom rendering
- ❌ `ctx.ui.custom()` for complex UI
- ❌ Tab navigation, keyboard handling
- ❌ `ctx.hasUI`

**Workaround:**
Could implement as sequential `showInput()` calls, one question at a time. No tab interface possible. Each question would need separate prompts.

**Implementation complexity:** High - requires complete redesign from rich TUI to sequential dialogs.

---

### todo.ts
**Status:** 🔶 Partial

**Description:** Todo list tool with state persistence via session entries and `/todos` command.

**pi-mono APIs used:**
- `pi.registerTool()` with `renderCall`/`renderResult` - ✅ (partial)
- `pi.registerCommand()` for `/todos` command - ❌
- `ctx.sessionManager.getBranch()` for state reconstruction - ❌
- Session events: `session_start`, `session_switch`, `session_fork`, `session_tree` - ❌
- `ctx.ui.custom()` for todo list display - ❌
- `ctx.ui.notify()` - ✅ (via `showNotification`)

**AiderDesk has:**
- `getTools()` with execute - ✅
- `showNotification()` - ✅
- Tool result `details` for persistence - ✅
- `onTaskCreated`, `onTaskPrepared`, `onTaskInitialized` - partial session events ✅

**Missing:**
- ❌ `registerCommand()` for custom slash commands
- ❌ `sessionManager.getBranch()` for accessing task history
- ❌ Session branch/switch/fork events
- ❌ `ctx.ui.custom()` for display component
- ❌ `renderCall`/`renderResult`

**Workaround:**
- State persistence: Store in tool result `details` (works, but can't reconstruct from history)
- Commands: Not possible - would need to be a separate tool
- UI: Basic notifications only

**Gap:** Cannot reconstruct state from session history when task is reloaded. pi-mono scans tool results in session branch to rebuild todos.

---

### truncated-tool.ts
**Status:** 🔶 Partial

**Description:** Wraps ripgrep with proper output truncation and temp file saving.

**pi-mono APIs used:**
- `pi.registerTool()` with `renderCall`/`renderResult` - ✅ (partial)
- Built-in truncation utilities: `truncateHead`, `truncateTail`, `DEFAULT_MAX_BYTES`, `DEFAULT_MAX_LINES`, `formatSize` - ❌
- `ctx.cwd` - ✅ (via `getProjectDir()`)
- Custom rendering with truncation warnings

**AiderDesk has:**
- `getTools()` with execute - ✅
- `getProjectDir()` for cwd - ✅
- Can implement truncation manually - ✅

**Missing:**
- ❌ Built-in truncation utilities
- ❌ `renderCall`/`renderResult` for custom display

**Workaround:**
- Truncation: Implement manually (simple string slicing + byte counting)
- Rendering: Tool result includes truncation info as text

**Implementation notes:**
Core functionality (truncation, temp file saving) is implementable. The custom rendering (`renderCall`/`renderResult`) showing truncation warnings nicely in the UI is missing, but the tool will still work.

---

### tool-override.ts
**Status:** 🔶 Partial

**Description:** Override built-in `read` tool with logging and access control.

**pi-mono APIs used:**
- Tool override via same name registration - ❓ (untested)
- `pi.registerCommand()` for `/read-log` - ❌
- `ctx.cwd` - ✅
- `ctx.ui.notify()` - ✅

**AiderDesk has:**
- `getTools()` with execute - ✅
- `getProjectDir()` - ✅
- `showNotification()` - ✅
- `onToolCalled` event (could intercept) - ✅

**Missing:**
- ❓ Tool override behavior unclear - extensions register tools but may not override built-ins
- ❌ `registerCommand()` for custom commands

**Alternative approach:**
Use `onToolCalled` event to intercept read tool calls and implement access control there:
```typescript
async onToolCalled(event: ToolCalledEvent, context: ExtensionContext) {
  if (event.toolName === 'read') {
    // Check path, log access, potentially block
    if (isBlocked(event.input.path)) {
      event.blocked = true;
    }
  }
}
```

**Implementation notes:**
Access control via event interception is possible. Full tool replacement behavior needs verification.

---

### ssh.ts
**Status:** ❌ Not Possible

**Description:** Delegate read/write/edit/bash tools to remote machine via SSH.

**pi-mono APIs used:**
- `pi.registerFlag()` for CLI flag registration - ❌
- `createReadTool()`, `createWriteTool()`, `createEditTool()`, `createBashTool()` with custom operations - ❌
- Tool override pattern - ❓
- `ctx.ui.setStatus()` for status bar - ❌
- `session_start` event - ✅ (partial via `onTaskCreated`)
- `user_bash` event to intercept user commands - ❌
- `before_agent_start` to modify system prompt - ❌

**AiderDesk has:**
- `getTools()` for registering tools - ✅
- `onTaskCreated` event - partial ✅
- `getProjectDir()` - ✅

**Missing:**
- ❌ `registerFlag()` for CLI arguments
- ❌ Factory functions for built-in tools (`createReadTool`, etc.)
- ❌ Custom operations injection into built-in tools
- ❌ `user_bash` event for intercepting user shell commands
- ❌ `before_agent_start` for system prompt modification
- ❌ `setStatus()` for status bar updates

**Gap analysis:**
This is a fundamentally different architecture. pi-mono allows injecting custom operations into built-in tools, while AiderDesk's tools are hardcoded. Would need to:
1. Register completely separate `ssh-read`, `ssh-write`, etc. tools
2. No way to intercept user bash commands
3. No way to modify system prompt with remote cwd info

---

### subagent/index.ts
**Status:** 🔶 Partial

**Description:** Delegate tasks to specialized subagents with isolated context. Supports single, parallel, and chain modes.

**pi-mono APIs used:**
- `pi.registerTool()` with `renderCall`/`renderResult` - ✅ (partial)
- `ctx.ui.confirm()` for project agent approval - ✅ (via `showConfirm`)
- `ctx.hasUI` - ❌
- `ctx.cwd` - ✅
- `getMarkdownTheme()` - ❌
- `@mariozechner/pi-tui`: Container, Markdown, Spacer, Text - ❌

**AiderDesk has:**
- `getTools()` with execute - ✅
- `showConfirm()` for confirmations - ✅
- `getProjectDir()` - ✅
- Built-in subagent support via `createTask()` - ✅
- `onSubagentStarted`/`onSubagentFinished` events - ✅

**Missing:**
- ❌ `renderCall`/`renderResult` for rich rendering
- ❌ Markdown rendering in tool results
- ❌ TUI components for structured display
- ❌ `ctx.hasUI`

**Workaround:**
- Subagent spawning: Use `context.createTask()` with appropriate profile
- Rendering: Return structured text/JSON in tool result
- Parallel execution: Use Promise.all() within execute()

**Implementation notes:**
Core functionality is implementable using AiderDesk's built-in subagent/task system. The rich rendering (markdown, containers, usage stats formatting) would need to be simplified to text output.

---

## Summary Table

| Extension | Status | Key Missing Features |
|-----------|--------|---------------------|
| hello.ts | ✅ Possible | None |
| question.ts | 🔶 Partial | `ui.select()`, `ui.custom()`, `renderCall/Result`, `ctx.hasUI` |
| questionnaire.ts | 🔶 Partial | `ui.custom()`, tab navigation, `renderCall/Result`, keyboard handling |
| todo.ts | 🔶 Partial | `registerCommand()`, `sessionManager.getBranch()`, session events, `ui.custom()` |
| truncated-tool.ts | 🔶 Partial | Built-in truncation utils, `renderCall/Result` |
| tool-override.ts | 🔶 Partial | `registerCommand()`, tool override behavior unclear |
| ssh.ts | ❌ Not Possible | `registerFlag()`, tool factory functions, `user_bash` event, `before_agent_start`, `setStatus()` |
| subagent/index.ts | 🔶 Partial | `renderCall/Result`, Markdown rendering, TUI components, `ctx.hasUI` |

---

## Priority Gaps for Full Compatibility

### High Priority
1. **`ctx.hasUI`** - Simple flag to check if running in interactive mode. Easy to add.
2. **`ui.select()` / `ui.confirm()` with descriptions** - Enhanced selection dialogs with option descriptions.
3. **Tool override capability** - Allow extensions to replace built-in tools.

### Medium Priority
4. **`renderCall()` / `renderResult()`** - Custom rendering for tool calls and results. Major feature.
5. **`registerCommand()`** - Custom slash commands.
6. **Session history access** - `sessionManager.getBranch()` equivalent.

### Low Priority (Requires Significant Architecture Changes)
7. **`ui.custom()`** - Full custom TUI components (requires terminal UI framework).
8. **Tool factory functions** - `createReadTool()`, etc. with custom operations.
9. **`before_agent_start`** - System prompt modification hook.
10. **`registerFlag()`** - CLI flag registration.

### 5. event-bus.ts - Inter-Extension Communication

**Source**: [event-bus.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/event-bus.ts)

**Purpose**: Demonstrates inter-extension communication via a shared event bus (`pi.events`).

**pi-mono APIs Used**:
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.events.on(event, handler)` | Subscribe to events from other extensions | ❌ None |
| `pi.events.emit(event, data)` | Publish events to the bus | ❌ None |
| `pi.on("session_start", handler)` | Session lifecycle hook | ❌ None (has `onLoad` only) |
| `pi.registerCommand(name, options)` | Register custom `/emit` command | ❌ None |
| `ctx.ui.notify(message, type)` | Show UI notification | ✅ `showNotification()` |

**AiderDesk Compatibility**: ❌ **Not Possible**

**Missing Capabilities**:
1. **Inter-Extension Communication** - No `pi.events` equivalent; extensions are fully isolated
2. **Custom Commands** - Extensions cannot register new slash commands
3. **Session Lifecycle Events** - No `session_start` event (extensions only get `onLoad`)

**Architecture Assessment**:

Inter-extension communication is **not currently needed** in AiderDesk's architecture because:

1. **Isolation by Design**: AiderDesk extensions are intentionally isolated, each operating independently on their own concerns (tools, UI elements, lifecycle hooks)

2. **No Cross-Extension Use Cases**: Current extensions (context flags, model selection, voice control) don't require coordination between each other

3. **Alternative Patterns**:
   - **Shared State**: Could be achieved via settings (`getSetting`/`updateSettings`)
   - **Coordinator Pattern**: Main process could mediate between extensions if needed
   - **Event Aggregation**: Could add a main-process event bus that extensions subscribe to

4. **Complexity vs Value**: Adding `pi.events`-style communication adds complexity (ordering, error handling, debugging) without clear use cases in AiderDesk's current extension ecosystem

**Recommendation**: Do not implement inter-extension communication until a concrete use case emerges. If needed in the future, consider:
- A simple `ExtensionContext.broadcast(event, data)` method
- Main process as mediator with typed event channels
- Explicit extension dependency declarations

---

### input-transform.ts

**Source**: [input-transform.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/input-transform.ts)

**Purpose**: Transform user input before agent processing. Enables:
- `?quick` prefix for brief responses
- `ping` / `time` instant responses (no LLM needed)

**pi-mono APIs Used**:
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("input", handler)` | Intercept user input before submission | ❌ None |
| `event.text` | Get user input text | N/A |
| `event.source` | Check message origin | N/A |
| `return { action: "transform", text }` | Replace input text | ❌ None |
| `return { action: "handled" }` | Consume input, skip agent | ❌ None |
| `return { action: "continue" }` | Pass through unchanged | N/A |
| `ctx.ui.notify(msg, type)` | Show notification | ✅ `showNotification()` |

**AiderDesk Compatibility**: ❌ **Not Possible**

**Missing Capabilities**:
1. **Input Interception** - No event fires when user types in the chat input
2. **Input Transformation** - Cannot modify user input before it's submitted
3. **Input Handling** - Cannot consume input and skip agent processing entirely

**Architecture Assessment**:

This extension pattern is **inherently CLI-centric** and less applicable to GUI:

1. **CLI Context**: In a terminal, typing `?quick question` is natural; in a GUI, users have rich input options (buttons, menus)

2. **AiderDesk Alternatives**:
   - **Quick prompts**: Could be a dropdown or button in the UI
   - **Instant commands**: Could be `/ping` or `/time` custom commands (if custom commands were supported)
   - **Mode switching**: GUI can provide explicit mode toggles

3. **Implementation Path** (if desired):
   - Would require **renderer-side** input hook in the React chat component
   - IPC to main process for extension processing
   - Blocking UI interaction until extension responds

**Recommendation**: Do not implement input interception. Instead:
- Add custom command support (`/quick`, `/ping`, `/time`)
- Provide UI elements for mode switching
- Let extensions register "slash commands" that can transform prompts

---

### inline-bash.ts

**Source**: [inline-bash.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/inline-bash.ts)

**Purpose**: Expand `!{command}` patterns in prompts with command output before sending to agent.

Example: `What's in !{pwd}?` → `What's in /home/user/project?`

**pi-mono APIs Used**:
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("input", handler)` | Intercept user input | ❌ None |
| `pi.exec("bash", args, opts)` | Execute bash command | ❌ None |
| `ctx.hasUI` | Check UI availability | N/A |
| `ctx.ui.notify(msg, type)` | Show notification | ✅ `showNotification()` |
| Regex pattern matching | Find `!{cmd}` patterns | N/A (client-side) |

**AiderDesk Compatibility**: ❌ **Not Possible**

**Missing Capabilities**:
1. **Input Interception** - Same as input-transform.ts
2. **Bash Execution API** - No `pi.exec()` equivalent for extensions to run commands

**Architecture Assessment**:

This is a **powerful CLI productivity feature** but has significant security/UX implications:

1. **Security Concerns**:
   - Arbitrary command execution in user prompts
   - Could exfiltrate data via command output
   - Extension has full shell access

2. **UX Considerations**:
   - Error handling for failed commands
   - Timeout for long-running commands
   - Output truncation for verbose commands

3. **AiderDesk Alternative**:
   - Could implement in **renderer process** (React side)
   - User types message → React preprocesses → sends to main
   - No extension involvement needed
   - Or: Add as a built-in feature, not an extension point

**Recommendation**: 
- If desired, implement as a **built-in feature** in the renderer, not as an extension API
- Add user confirmation for command execution
- Require opt-in setting for security

---

### interactive-shell.ts

**Source**: [interactive-shell.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/interactive-shell.ts)

**Purpose**: Enable running interactive commands (vim, htop, git rebase -i) with full terminal access. The TUI suspends while they run.

**pi-mono APIs Used**:
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("user_bash", handler)` | Intercept `!` commands | ❌ None |
| `ctx.hasUI` | Check TUI availability | N/A (GUI always has UI) |
| `ctx.ui.custom(fn)` | Get TUI access for custom UI | ❌ None |
| `tui.stop()` / `tui.start()` | Suspend/resume TUI | ❌ None |
| `spawnSync()` | Run command with inherited stdio | ❌ No terminal access |

**AiderDesk Compatibility**: ❌ **Not Possible**

**Missing Capabilities**:
1. **`user_bash` Event** - No way to intercept `!` commands entered by user
2. **Terminal Access** - No way to spawn processes with interactive terminal
3. **TUI Control** - No concept of "suspending" the GUI for terminal access

**Architecture Assessment**:

This extension is **fundamentally incompatible with GUI architecture**:

1. **Terminal vs GUI Paradigm**:
   - pi-mono runs in terminal, can suspend itself and give terminal to subprocess
   - AiderDesk is a GUI app; cannot "give terminal" to a subprocess

2. **Alternative Approaches for GUI**:
   - **Embedded Terminal**: Use xterm.js or similar to embed a terminal in a panel/window
   - **External Terminal**: Open commands in external terminal emulator
   - **VS Code-style Integrated Terminal**: Dedicated terminal panel

3. **Current AiderDesk State**:
   - No integrated terminal component
   - Commands run via `execa` without TTY
   - No way to run interactive commands

**Recommendation**:
- If interactive shell support is desired, implement as a **core feature** (not extension API)
- Use xterm.js for embedded terminal in a dedicated panel
- Extensions could potentially configure which commands should open in terminal
- This is a major architectural addition, not a simple extension hook

---

### bash-spawn-hook.ts

**Source**: [bash-spawn-hook.ts](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/examples/extensions/bash-spawn-hook.ts)

**Purpose**: Adjust command, cwd, and environment before bash execution. Example: Prepend `source ~/.profile` to all commands.

**pi-mono APIs Used**:
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `createBashTool(cwd, options)` | Create bash tool with hooks | ❌ None |
| `options.spawnHook` | Function to modify execution params | ❌ None |
| `pi.registerTool(tool)` | Register/replace tools | ✅ `getTools()` (partial) |

**AiderDesk Compatibility**: 🔶 **Partially Possible**

**Available**:
- `getTools()` - Extensions can return tool definitions
- Custom tool registration - Can provide alternative bash implementation

**Missing**:
1. **Spawn Hook Pattern** - No way to intercept and modify tool execution parameters
2. **Tool Replacement** - Cannot cleanly "wrap" existing tools, must fully replace

**Architecture Assessment**:

This pattern is **partially achievable** with creative workarounds:

1. **Current Approach**:
   - Extension returns a custom "bash" tool via `getTools()`
   - Tool wraps the actual execution, applies modifications
   - **Problem**: Name collision with built-in bash tool

2. **Implementation Path** (Workaround):
   - Extension could register a differently-named tool (e.g., "hooked_bash")
   - User would need to use that tool explicitly
   - Cannot transparently intercept built-in bash calls

3. **Clean Solution Would Require**:
   - Tool middleware/interceptor pattern
   - `onToolCalled` with parameter modification capability
   - Or: `wrapTool(name, wrapper)` API

**What AiderDesk Has**:
- `onToolCalled` event - Fires before tool execution
- Event can return `blocked: true` to prevent execution
- **Cannot modify tool parameters** through this event

**Recommendation**:
- Add parameter modification to `onToolCalled` event
- Allow extensions to return `{ params: modifiedParams }` to transform tool inputs
- This would enable spawn-hook-style modifications for any tool, not just bash

**Example Enhancement**:
```typescript
// Current onToolCalled signature
onToolCalled?: (event: ToolCalledEvent) => Promise<void | { blocked?: boolean }>

// Enhanced with parameter modification
onToolCalled?: (event: ToolCalledEvent) => Promise<void | { 
  blocked?: boolean,
  params?: Partial<ToolParams>  // Allow modifying tool parameters
}>
```

---

## Summary Table

| Extension | Status | Key Missing API | GUI Applicability |
|-----------|--------|-----------------|-------------------|
| input-transform.ts | ❌ Not Possible | `pi.on("input")` | Low - CLI productivity pattern |
| inline-bash.ts | ❌ Not Possible | `pi.on("input")`, `pi.exec()` | Medium - Could be built-in feature |
| interactive-shell.ts | ❌ Not Possible | `pi.on("user_bash")`, TUI access | Low - Requires terminal paradigm |
| bash-spawn-hook.ts | 🔶 Partial | `spawnHook`, tool wrapping | High - Useful for customization |

---

## Safety Extensions Analysis

The following extensions focus on protecting users from accidental or malicious operations.

---

### permission-gate.ts

**Status:** ✅ Possible

**Description:** Prompts for confirmation before running potentially dangerous bash commands (rm -rf, sudo, chmod/chown 777).

**pi-mono APIs used:**
- `pi.on("tool_call")` - intercept bash tool calls before execution
- `event.toolName`, `event.input` - inspect tool parameters
- `return { block: true, reason }` - block tool execution
- `ctx.hasUI` - check interactive mode availability
- `ctx.ui.select()` - confirmation dialog with options

**AiderDesk has:**
- `onToolCalled` event with `blocked` property - ✅
- `event.toolName`, `event.input` for inspection - ✅
- `showConfirm()` for yes/no dialogs - ✅ (partial alternative to select)
- Regex pattern matching for dangerous commands - ✅

**Missing:**
- ❌ `ctx.hasUI` flag to detect non-interactive mode
- ❌ `ctx.ui.select()` with custom options (Yes/No/View Command works via `showConfirm`)

**Implementation notes:**
Core functionality is fully implementable. Use `onToolCalled` to intercept bash tool, check patterns, and use `showConfirm()` for user approval.

```typescript
const dangerousPatterns = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*777/i,
];

async onToolCalled(event: ToolCalledEvent, context: ExtensionContext) {
  if (event.toolName !== 'bash') return;
  
  const command = event.input?.command as string;
  const isDangerous = dangerousPatterns.some(p => p.test(command));
  
  if (isDangerous) {
    const confirmed = await context.showConfirm(
      `⚠️ Dangerous command:\n\n${command}\n\nAllow execution?`,
      'Allow',
      'Block'
    );
    
    if (!confirmed) {
      event.blocked = true;
      await context.showNotification('Command blocked by permission gate', 'warning');
    }
  }
}
```

---

### protected-paths.ts

**Status:** ✅ Possible

**Description:** Blocks write and edit operations to protected paths (.env, .git/, node_modules/).

**pi-mono APIs used:**
- `pi.on("tool_call")` - intercept write/edit tool calls
- `return { block: true, reason }` - block tool execution
- `ctx.hasUI` - check UI availability
- `ctx.ui.notify()` - show notification

**AiderDesk has:**
- `onToolCalled` event with `blocked` property - ✅
- `event.toolName`, `event.input` for path inspection - ✅
- `showNotification()` - ✅

**Missing:**
- ❌ `ctx.hasUI` flag

**Implementation notes:**
Direct port possible. Simple path matching in `onToolCalled` for write/edit tools.

```typescript
const protectedPaths = ['.env', '.git/', 'node_modules/', '.aws/', '.ssh/'];

async onToolCalled(event: ToolCalledEvent, context: ExtensionContext) {
  if (!['write', 'edit'].includes(event.toolName)) return;
  
  const path = event.input?.path as string;
  const isProtected = protectedPaths.some(p => path.includes(p));
  
  if (isProtected) {
    event.blocked = true;
    await context.showNotification(
      `Blocked write to protected path: ${path}`,
      'warning'
    );
  }
}
```

---

### confirm-destructive.ts

**Status:** ❌ Not Possible

**Description:** Prompts for confirmation before destructive session actions (clear, switch, fork/branch).

**pi-mono APIs used:**
- `pi.on("session_before_switch")` - intercept session switches with `event.reason` (new/resume)
- `pi.on("session_before_fork")` - intercept session forks
- `ctx.sessionManager.getEntries()` - access session entries for checking unsaved work
- `return { cancel: true }` - cancel the action
- `ctx.ui.confirm()` - confirmation dialog
- `ctx.ui.select()` - selection dialog with options
- `ctx.ui.notify()` - show notification

**AiderDesk has:**
- `showConfirm()` - ✅
- `showNotification()` - ✅
- Task events: `onTaskCreated`, `onTaskPrepared`, `onTaskClosed` - 🔶 Different lifecycle model

**Missing:**
- ❌ Session lifecycle events (`session_before_switch`, `session_before_fork`)
- ❌ Ability to cancel session/task operations
- ❌ `sessionManager.getEntries()` to access conversation history
- ❌ Events for task switching or branching operations

**Architecture Assessment:**
AiderDesk's task model differs significantly from pi-mono's session model. pi-mono has a concept of session branching/forking and navigation through a session tree. AiderDesk tasks are more isolated. To support this pattern, AiderDesk would need:

1. Events for task operations: `onTaskBeforeDelete`, `onTaskBeforeArchive`, `onTaskBeforeSwitch`
2. Ability to cancel operations via `event.blocked = true`
3. Task history access API

---

### dirty-repo-guard.ts

**Status:** 🔶 Partial

**Description:** Prevents session changes when there are uncommitted git changes.

**pi-mono APIs used:**
- `pi.on("session_before_switch")` - intercept session switches
- `pi.on("session_before_fork")` - intercept session forks
- `pi.exec("git", args)` - execute git commands from extension
- `ctx.ui.select()` - user choice dialog
- `ctx.ui.notify()` - show notification

**AiderDesk has:**
- `getProjectDir()` - ✅
- `showConfirm()` - ✅
- `showNotification()` - ✅
- Custom tools via `getTools()` - ✅

**Missing:**
- ❌ Session lifecycle events with cancellation
- ❌ `pi.exec()` for running shell commands from extension context
- ❌ `ctx.ui.select()` with custom options

**Workaround:**
Could implement a "git-status" tool that the agent can call, but cannot proactively prevent session operations. Alternatively:

1. Use `onPromptStarted` to check git status and warn user
2. Register a tool that checks git status and provides warnings
3. Cannot actually block task switching/deletion

**Implementation notes:**
The core git checking logic could be implemented, but the blocking capability is missing. This is a "guard rail" extension that requires pre-operation interception.

```typescript
// Partial implementation - can warn but not block
async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext) {
  // Cannot execute git commands directly from extension
  // Would need to use child_process or a helper tool
  const hasChanges = await checkGitStatus(context.getProjectDir());
  
  if (hasChanges) {
    await context.showNotification(
      'Warning: You have uncommitted changes',
      'warning'
    );
  }
}
```

---

### sandbox/index.ts

**Status:** ❌ Not Possible

**Description:** OS-level sandboxing for bash commands using @anthropic-ai/sandbox-runtime (sandbox-exec on macOS, bubblewrap on Linux). Enforces filesystem and network restrictions at the OS level.

**pi-mono APIs used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerFlag("no-sandbox", opts)` | CLI flag registration | ❌ None |
| `createBashTool(cwd, options)` | Create bash tool with custom operations | ❌ None |
| `options.operations.exec()` | Custom bash execution logic | ❌ None |
| `pi.registerTool()` with override | Replace built-in bash tool | ❓ Unclear |
| `pi.on("user_bash", handler)` | Intercept user bash commands | ❌ None |
| `pi.on("session_start", handler)` | Session lifecycle | 🔶 `onLoad` |
| `pi.on("session_shutdown", handler)` | Session cleanup | 🔶 `onUnload` |
| `pi.registerCommand("sandbox", opts)` | Custom /sandbox command | ❌ None |
| `pi.getFlag("no-sandbox")` | Read CLI flag value | ❌ None |
| `ctx.ui.setStatus()` | Status bar update | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |
| `ctx.cwd` | Current working directory | ✅ `getProjectDir()` |

**AiderDesk has:**
- `getTools()` for tool registration - ✅
- `onLoad`/`onUnload` for lifecycle - ✅
- `getProjectDir()` - ✅
- `showNotification()` - ✅

**Missing:**
- ❌ `registerFlag()` for CLI arguments
- ❌ Tool factory functions (`createBashTool`) with custom operations
- ❌ Tool override capability (replacing built-in tools)
- ❌ `user_bash` event for intercepting user-entered shell commands
- ❌ `registerCommand()` for custom slash commands
- ❌ `setStatus()` for status bar updates
- ❌ `getFlag()` for reading runtime configuration

**Architecture Assessment:**
This is a major architectural difference. pi-mono allows:
1. Injecting custom execution logic into built-in tools via `operations`
2. Overriding built-in tools by registering a tool with the same name
3. CLI flag integration for extension configuration

Implementing sandboxing in AiderDesk would require either:
1. **Core Feature**: Implement as a built-in AiderDesk feature (not extension)
2. **Tool Wrapper API**: Add ability for extensions to wrap/intercept built-in tool execution
3. **Separate Sandboxed Tools**: Register `sandboxed_bash` as a separate tool (but agent won't use it automatically)

**Recommendation:**
Sandboxing is a security-critical feature that should be implemented as a **core AiderDesk feature**, not as an extension. The extension API could expose configuration hooks, but the actual sandboxing logic should be built into the application.

---

## Safety Extensions Summary

| Extension | Status | Can Implement | Blocking Factor |
|-----------|--------|---------------|-----------------|
| permission-gate.ts | ✅ Possible | Yes | None - all APIs available |
| protected-paths.ts | ✅ Possible | Yes | None - all APIs available |
| confirm-destructive.ts | ❌ Not Possible | No | Missing session lifecycle events |
| dirty-repo-guard.ts | 🔶 Partial | Warning only | Missing `pi.exec()` and session events |
| sandbox/index.ts | ❌ Not Possible | No | Requires tool factory/override architecture |

### Priority Gaps for Safety Extensions

1. **High Priority**
   - `pi.exec()` or equivalent for running shell commands from extensions
   - Session/task lifecycle events with cancellation (`onTaskBeforeDelete`, etc.)

2. **Medium Priority**
   - `ctx.hasUI` flag for non-interactive mode detection
   - `ctx.ui.select()` with custom options beyond yes/no

3. **Core Feature (not extension)**
   - OS-level sandboxing (should be built-in, not extension)
   - Tool override/wrapping capability

---

**Key Insights**:

1. **Input interception** (`pi.on("input")`) is the most requested missing capability, but it's inherently CLI-centric. GUI apps should use explicit controls instead of text-based command prefixes.

2. **Interactive terminal** is fundamentally incompatible with GUI architecture. If needed, implement as a core feature with an embedded terminal.

3. **Tool execution hooks** would be valuable. Adding parameter modification to `onToolCalled` would enable spawn-hook patterns for any tool.

4. **Command execution API** (`pi.exec()`) for extensions would enable utility extensions but raises security considerations.


## Extension Analysis

Legend:
- ✅ **Possible** - Can be implemented with current AiderDesk capabilities
- 🔶 **Partial** - Some functionality possible, some missing
- ❌ **Not Possible** - Missing critical capabilities
- 🎨 **UI-focused** - Skipped (requires TUI components AiderDesk doesn't have)

---

### Safety Extensions

---

### permission-gate.ts
**Status:** 🔶 Partial

**Description:** Prompts for confirmation before running potentially dangerous bash commands (rm -rf, sudo, chmod/chown 777).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("tool_call", handler)` | Intercept tool calls before execution | ✅ `onToolCalled` event |
| `event.toolName`, `event.input` | Inspect tool parameters | ✅ Available in event |
| `return { block: true }` | Block tool execution | ✅ `event.blocked = true` |
| `ctx.hasUI` | Check interactive mode | ❌ None |
| `ctx.ui.select()` | Confirmation dialog with options | 🔶 `showConfirm()` (yes/no only) |

**AiderDesk has:**
- `onToolCalled` event with `blocked` property - ✅
- `event.toolName`, `event.input` for inspection - ✅
- `showConfirm()` for yes/no dialogs - ✅
- Regex pattern matching for dangerous commands - ✅

**Missing:**
- ❌ `ctx.hasUI` flag to detect non-interactive mode
- ❌ `ctx.ui.select()` with custom options (Yes/No works via `showConfirm`)

**Implementation notes:**
Core functionality is implementable. Use `onToolCalled` to intercept bash tool, check patterns, and use `showConfirm()` for user approval. The `ctx.hasUI` check would need to be added or worked around.

```typescript
async onToolCalled(event: ToolCalledEvent, context: ExtensionContext) {
  if (event.toolName !== 'bash') return;
  const command = event.input?.command as string;
  if (isDangerous(command)) {
    const confirmed = await context.showConfirm(`Allow dangerous command: ${command}?`);
    if (!confirmed) event.blocked = true;
  }
}
```

---

### protected-paths.ts
**Status:** ✅ Possible

**Description:** Blocks write and edit operations to protected paths (.env, .git/, node_modules/).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("tool_call", handler)` | Intercept write/edit tools | ✅ `onToolCalled` event |
| `return { block: true, reason }` | Block with reason | ✅ `event.blocked = true` |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `onToolCalled` event - ✅
- `event.blocked` to prevent execution - ✅
- `showNotification()` - ✅

**Missing:** None

**Implementation notes:**
Direct port possible. Simple path matching in `onToolCalled` for write/edit tools.

```typescript
const protectedPaths = ['.env', '.git/', 'node_modules/'];
async onToolCalled(event: ToolCalledEvent, context: ExtensionContext) {
  if (!['write', 'edit'].includes(event.toolName)) return;
  const path = event.input?.path as string;
  if (protectedPaths.some(p => path.includes(p))) {
    event.blocked = true;
    await context.showNotification(`Blocked write to protected path: ${path}`, 'warning');
  }
}
```

---

### confirm-destructive.ts
**Status:** ❌ Not Possible

**Description:** Prompts for confirmation before destructive session actions (clear, switch, branch/fork).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_before_switch", handler)` | Intercept session switches | ❌ None |
| `pi.on("session_before_fork", handler)` | Intercept session forks | ❌ None |
| `ctx.sessionManager.getEntries()` | Access session entries | ❌ None |
| `return { cancel: true }` | Cancel the action | ❌ None |
| `ctx.ui.confirm()` | Confirmation dialog | ✅ `showConfirm()` |
| `ctx.ui.select()` | Selection dialog | 🔶 `showConfirm()` only |

**AiderDesk has:**
- `showConfirm()` - ✅
- Task events: `onTaskCreated`, `onTaskPrepared`, `onTaskClosed` - 🔶 Different lifecycle

**Missing:**
- ❌ Session lifecycle events (`session_before_switch`, `session_before_fork`)
- ❌ Ability to cancel session operations
- ❌ `sessionManager.getEntries()` to check session state

**Architecture Assessment:**
AiderDesk's task model is different from pi-mono's session model. There's no concept of "switching" or "forking" tasks in the same way. The extension system would need new events for task operations (delete, archive, branch) to support this pattern.

---

### dirty-repo-guard.ts
**Status:** ❌ Not Possible

**Description:** Prevents session changes when there are uncommitted git changes.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_before_switch", handler)` | Intercept session switches | ❌ None |
| `pi.on("session_before_fork", handler)` | Intercept session forks | ❌ None |
| `pi.exec("git", args)` | Execute git commands | ❌ None |
| `ctx.ui.select()` | User choice dialog | 🔶 `showConfirm()` only |

**AiderDesk has:**
- `getProjectDir()` - ✅
- Can execute git via tool - 🔶 (but not from extension context directly)

**Missing:**
- ❌ Session lifecycle events with cancellation
- ❌ `pi.exec()` for running shell commands from extensions
- ❌ `ctx.ui.select()` with custom options

**Alternative:**
Could implement as a tool that checks git status, but can't prevent session operations.

---

### sandbox/index.ts
**Status:** ❌ Not Possible

**Description:** OS-level sandboxing for bash commands using @anthropic-ai/sandbox-runtime (sandbox-exec on macOS, bubblewrap on Linux).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerFlag("no-sandbox", opts)` | CLI flag registration | ❌ None |
| `createBashTool(cwd, options)` | Create bash tool with custom ops | ❌ None |
| `options.operations` | Custom bash execution | ❌ None |
| `pi.on("user_bash", handler)` | Intercept user bash commands | ❌ None |
| `pi.on("session_start/shutdown", handler)` | Lifecycle events | 🔶 Partial (`onLoad`) |
| `pi.registerCommand("sandbox", opts)` | Custom command | ❌ None |
| `ctx.ui.setStatus()` | Status bar update | ❌ None |

**AiderDesk has:**
- `getTools()` for tool registration - ✅
- `onLoad` for initialization - ✅

**Missing:**
- ❌ `registerFlag()` for CLI arguments
- ❌ Tool factory functions (`createBashTool`)
- ❌ Custom operations injection
- ❌ `user_bash` event
- ❌ `registerCommand()`
- ❌ `setStatus()` for status bar

**Architecture Assessment:**
This is a major architectural difference. pi-mono allows injecting custom execution logic into built-in tools, while AiderDesk's tools are fixed. Implementing sandboxing would require either:
1. Core feature in AiderDesk (not extension)
2. Extension API for tool execution hooks with custom spawn logic

---

### Command Extensions

---

### preset.ts
**Status:** ❌ Not Possible

**Description:** Define named presets that configure model, thinking level, tools, and system prompt instructions. Activated via CLI flag, command, or shortcut.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerFlag("preset", opts)` | CLI flag registration | ❌ None |
| `pi.registerCommand("preset", opts)` | Custom command | ❌ None |
| `pi.registerShortcut(Key, opts)` | Keyboard shortcut | ❌ None |
| `pi.on("before_agent_start", handler)` | Modify system prompt | ❌ None |
| `pi.on("session_start", handler)` | Session lifecycle | 🔶 `onLoad` |
| `pi.setModel(model)` | Change active model | ❌ None |
| `pi.setThinkingLevel(level)` | Set thinking level | ❌ None |
| `pi.setActiveTools(tools)` | Enable/disable tools | ❌ None |
| `pi.getActiveTools()`, `getAllTools()` | Query tools | ❌ None |
| `ctx.modelRegistry.find()` | Find model by provider/id | ❌ None |
| `ctx.ui.setStatus()` | Status bar update | ❌ None |
| `pi.appendEntry()` | Persist state to session | ❌ None |
| `ctx.ui.custom()` | Custom TUI selector | ❌ None |

**AiderDesk has:**
- `getAgentProfiles()` - list available profiles - ✅
- `getModelConfigs()` - list available models - ✅
- File-based config loading - ✅

**Missing:**
- ❌ `registerCommand()` for custom slash commands
- ❌ `registerFlag()` for CLI arguments
- ❌ `registerShortcut()` for keyboard shortcuts
- ❌ `before_agent_start` event for system prompt modification
- ❌ `setModel()`, `setThinkingLevel()`, `setActiveTools()` for runtime configuration
- ❌ State persistence to session (`appendEntry`)

**Workaround:**
Could implement preset loading at extension load time, but cannot change settings dynamically during a session.

---

### tools.ts
**Status:** ❌ Not Possible

**Description:** Provides a /tools command to enable/disable tools interactively with persistence across session reloads.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("tools", opts)` | Custom command | ❌ None |
| `pi.setActiveTools(tools)` | Set enabled tools | ❌ None |
| `pi.getActiveTools()`, `getAllTools()` | Query tools | ❌ None |
| `pi.appendEntry()` | Persist state | ❌ None |
| `ctx.sessionManager.getBranch()` | Access session branch | ❌ None |
| `pi.on("session_start/fork/tree", handler)` | Session events | ❌ None |
| `ctx.ui.custom()` | Custom TUI | ❌ None |

**AiderDesk has:**
- `getTools()` - register tools - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ Tool enable/disable API (`setActiveTools`, `getActiveTools`, `getAllTools`)
- ❌ Session state persistence
- ❌ Session branch access
- ❌ Session lifecycle events

---

### handoff.ts
**Status:** ❌ Not Possible

**Description:** Transfer context to a new focused session by generating a summary prompt using LLM.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("handoff", opts)` | Custom command | ❌ None |
| `ctx.sessionManager.getBranch()` | Get conversation entries | ❌ None |
| `ctx.modelRegistry.getApiKey()` | Get API key for model | ❌ None |
| `ctx.newSession()` | Create new session | 🔶 `createTask()` |
| `ctx.ui.editor()` | Edit prompt before sending | ❌ None |
| `ctx.ui.setEditorText()` | Set editor content | ❌ None |
| `ctx.ui.custom()` | Custom UI with loader | ❌ None |
| `complete()` from pi-ai | LLM completion | ❌ None |
| `convertToLlm()`, `serializeConversation()` | Message utilities | ❌ None |

**AiderDesk has:**
- `createTask()` - create new task - ✅
- `getCurrentTask()` - get current task - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ Session/branch access for conversation history
- ❌ `ctx.ui.editor()` for text editing
- ❌ `ctx.ui.setEditorText()` for setting prompt
- ❌ Access to API keys for making LLM calls
- ❌ Built-in LLM completion utilities

---

### send-user-message.ts
**Status:** ❌ Not Possible

**Description:** Demonstrates sending user messages from extensions with different delivery modes (immediate, steer, followUp).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("ask", opts)` | Custom command | ❌ None |
| `pi.sendUserMessage(text, opts)` | Send user message | ❌ None |
| `ctx.isIdle()` | Check if agent is busy | ❌ None |
| `opts.deliverAs` | Delivery mode (steer/followUp) | ❌ None |

**AiderDesk has:**
- No equivalent

**Missing:**
- ❌ `registerCommand()`
- ❌ `sendUserMessage()` for programmatic message sending
- ❌ `isIdle()` for agent state
- ❌ Message delivery modes (steer, followUp)

---

### reload-runtime.ts
**Status:** ❌ Not Possible

**Description:** Reload extensions, skills, prompts, and themes via command or tool.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("reload-runtime", opts)` | Custom command | ❌ None |
| `ctx.reload()` | Reload runtime | ❌ None |
| `pi.registerTool()` | LLM-callable tool | ✅ `getTools()` |
| `pi.sendUserMessage()` | Queue follow-up command | ❌ None |

**AiderDesk has:**
- `getTools()` - register tools - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ `ctx.reload()` for runtime reload
- ❌ `sendUserMessage()` for follow-up commands

---

### shutdown-command.ts
**Status:** ❌ Not Possible

**Description:** Adds a /quit command for clean shutdown from extensions.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("quit", opts)` | Custom command | ❌ None |
| `ctx.shutdown()` | Graceful shutdown | ❌ None |
| `pi.registerTool()` | LLM-callable tool | ✅ `getTools()` |

**AiderDesk has:**
- `getTools()` - register tools - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ `ctx.shutdown()` for application exit

---

### Prompt/Compaction Extensions

---

### pirate.ts
**Status:** ❌ Not Possible

**Description:** Toggle pirate mode to modify system prompt with pirate personality instructions.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("pirate", opts)` | Custom command | ❌ None |
| `pi.on("before_agent_start", handler)` | Modify system prompt | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅
- `onAgentStarted` event - 🔶 (but cannot modify system prompt)

**Missing:**
- ❌ `registerCommand()`
- ❌ `before_agent_start` event with system prompt modification

**Workaround:**
Could potentially use agent profiles with different system prompts, but not dynamically toggleable.

---

### claude-rules.ts
**Status:** ❌ Not Possible

**Description:** Scans project's .claude/rules/ folder and lists available rules in system prompt.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_start", handler)` | Session lifecycle | 🔶 `onLoad` |
| `pi.on("before_agent_start", handler)` | Modify system prompt | ❌ None |
| `ctx.cwd` | Project directory | ✅ `getProjectDir()` |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `getProjectDir()` - ✅
- `showNotification()` - ✅
- File system access - ✅

**Missing:**
- ❌ `before_agent_start` event for system prompt modification

**Workaround:**
Could register a tool that reads rules, but cannot inject them into system prompt automatically.

---

### custom-compaction.ts
**Status:** ❌ Not Possible

**Description:** Replaces default compaction with full summary using a different model (Gemini Flash).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_before_compact", handler)` | Intercept compaction | ❌ None |
| `ctx.modelRegistry.find()` | Find model | ❌ None |
| `ctx.modelRegistry.getApiKey()` | Get API key | ❌ None |
| `complete()` from pi-ai | LLM completion | ❌ None |
| `convertToLlm()`, `serializeConversation()` | Message utilities | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅

**Missing:**
- ❌ Compaction lifecycle events
- ❌ Model registry access
- ❌ API key access
- ❌ Built-in LLM completion utilities
- ❌ Message conversion utilities

---

### trigger-compact.ts
**Status:** ❌ Not Possible

**Description:** Auto-triggers compaction when context exceeds threshold, plus manual /trigger-compact command.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("trigger-compact", opts)` | Custom command | ❌ None |
| `pi.on("turn_end", handler)` | Turn lifecycle | ❌ None |
| `ctx.getContextUsage()` | Get token usage | ❌ None |
| `ctx.compact()` | Trigger compaction | ❌ None |
| `ctx.hasUI` | Check interactive | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ `turn_end` event
- ❌ `getContextUsage()` for token tracking
- ❌ `ctx.compact()` for triggering compaction

---

### Git/Session Extensions

---

### git-checkpoint.ts
**Status:** ❌ Not Possible

**Description:** Creates git stash checkpoints at each turn so forking can restore code state.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("turn_start", handler)` | Turn lifecycle | ❌ None |
| `pi.on("tool_result", handler)` | Tool result event | ❌ None |
| `pi.on("session_before_fork", handler)` | Intercept fork | ❌ None |
| `pi.on("agent_end", handler)` | Agent lifecycle | 🔶 `onAgentFinished` |
| `pi.exec("git", args)` | Execute git | ❌ None |
| `ctx.sessionManager.getLeafEntry()` | Get current entry | ❌ None |
| `ctx.ui.select()` | User choice | 🔶 `showConfirm()` only |

**AiderDesk has:**
- `onAgentFinished` event - ✅

**Missing:**
- ❌ `turn_start`, `tool_result` events
- ❌ `session_before_fork` event
- ❌ `pi.exec()` for running commands
- ❌ `sessionManager` access

---

### auto-commit-on-exit.ts
**Status:** ❌ Not Possible

**Description:** Automatically commits changes when the agent exits, using last assistant message for commit message.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_shutdown", handler)` | Session end | ❌ None |
| `pi.exec("git", args)` | Execute git | ❌ None |
| `ctx.sessionManager.getEntries()` | Access messages | ❌ None |
| `ctx.hasUI` | Check interactive | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅

**Missing:**
- ❌ `session_shutdown` event
- ❌ `pi.exec()` for running commands
- ❌ `sessionManager` for accessing messages

---

### session-name.ts
**Status:** ❌ Not Possible

**Description:** Set or show session name for display in session selector.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("session-name", opts)` | Custom command | ❌ None |
| `pi.setSessionName(name)` | Set session name | ❌ None |
| `pi.getSessionName()` | Get session name | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅
- Tasks have names via `TaskData` - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ `setSessionName()`/`getSessionName()` API

**Workaround:**
AiderDesk tasks already have names. Could potentially use settings for persistence.

---

### bookmark.ts
**Status:** ❌ Not Possible

**Description:** Bookmark entries with labels for easy navigation in session tree.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerCommand("bookmark", opts)` | Custom command | ❌ None |
| `pi.setLabel(entryId, label)` | Set entry label | ❌ None |
| `ctx.sessionManager.getEntries()` | Access entries | ❌ None |
| `ctx.sessionManager.getLabel(entryId)` | Get entry label | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |

**AiderDesk has:**
- `showNotification()` - ✅

**Missing:**
- ❌ `registerCommand()`
- ❌ `sessionManager` access
- ❌ Entry labeling API

---

### file-trigger.ts
**Status:** 🔶 Partial

**Description:** Watches a trigger file and injects its contents into the conversation when modified.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("session_start", handler)` | Session lifecycle | 🔶 `onLoad` |
| `pi.sendMessage(msg, opts)` | Send message to agent | ❌ None |
| `ctx.hasUI` | Check interactive | ❌ None |
| `ctx.ui.notify()` | Show notification | ✅ `showNotification()` |
| `fs.watch()` | File watching | ✅ Node.js built-in |

**AiderDesk has:**
- `showNotification()` - ✅
- File watching via Node.js - ✅
- `onLoad` for initialization - ✅

**Missing:**
- ❌ `sendMessage()` for injecting messages
- ❌ `triggerTurn` option to trigger agent response

**Workaround:**
Can watch files, but cannot programmatically inject messages into the conversation.

---

### Provider/Resource Extensions

---

### dynamic-resources/index.ts
**Status:** ❌ Not Possible

**Description:** Dynamically discover and provide skills, prompts, and themes from extensions.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.on("resources_discover", handler)` | Resource discovery | ❌ None |

**AiderDesk has:**
- No equivalent

**Missing:**
- ❌ `resources_discover` event
- ❌ Dynamic skill/prompt/theme loading from extensions

**Architecture Assessment:**
AiderDesk doesn't have a concept of dynamically loaded skills, prompts, or themes from extensions. These are likely configured at the application level.

---

### custom-provider-anthropic/index.ts
**Status:** ❌ Not Possible

**Description:** Register a custom LLM provider with OAuth support, custom streaming, and model definitions.

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerProvider(id, config)` | Register custom provider | ❌ None |
| Provider config: models, baseUrl, apiKey | Provider configuration | ❌ None |
| OAuth: login, refreshToken, getApiKey | OAuth flow | ❌ None |
| `streamSimple()` | Custom streaming implementation | ❌ None |

**AiderDesk has:**
- Model configurations via settings - 🔶
- Multiple built-in providers - ✅

**Missing:**
- ❌ `registerProvider()` API
- ❌ Custom provider configuration
- ❌ OAuth flow support in extensions
- ❌ Custom streaming implementations

**Architecture Assessment:**
AiderDesk's model/provider configuration is built into the application. Adding custom providers would require core changes, not extension API additions.

---

### with-deps/index.ts
**Status:** ✅ Possible

**Description:** Example extension with its own npm dependencies (tests that jiti resolves modules from extension's node_modules).

**pi-mono APIs Used:**
| API | Purpose | AiderDesk Equivalent |
|-----|---------|---------------------|
| `pi.registerTool()` | Register tool | ✅ `getTools()` |
| TypeBox parameters | Parameter schema | 🔶 Zod equivalent |

**AiderDesk has:**
- `getTools()` - ✅
- Zod schemas - ✅
- Extension directory for node_modules - ❓ (untested)

**Missing:** None for basic functionality

**Implementation notes:**
Core functionality works. The key question is whether AiderDesk's extension loader resolves dependencies from the extension's own node_modules directory. This depends on the extension loading mechanism (jiti or similar).

---


## Complete Summary Table

### All Extensions Analyzed

| Extension | Category | Status | Key Missing API(s) |
|-----------|----------|--------|-------------------|
| hello.ts | Tools | ✅ Possible | None |
| protected-paths.ts | Safety | ✅ Possible | None |
| with-deps/index.ts | Provider | ✅ Possible | None (untested deps resolution) |
| permission-gate.ts | Safety | 🔶 Partial | `ctx.hasUI`, `ui.select()` |
| truncated-tool.ts | Tools | 🔶 Partial | Built-in truncation utils, `renderCall/Result` |
| tool-override.ts | Tools | 🔶 Partial | `registerCommand()`, tool override behavior |
| bash-spawn-hook.ts | Tools | 🔶 Partial | `spawnHook`, tool parameter modification |
| subagent/index.ts | Tools | 🔶 Partial | `renderCall/Result`, Markdown rendering |
| file-trigger.ts | Session | 🔶 Partial | `sendMessage()`, `triggerTurn` |
| question.ts | UI | 🔶 Partial | `ui.select()`, `ui.custom()`, `renderCall/Result` |
| questionnaire.ts | UI | 🔶 Partial | `ui.custom()`, tab navigation |
| todo.ts | UI | 🔶 Partial | `registerCommand()`, `sessionManager.getBranch()` |
| input-transform.ts | Input | ❌ Not Possible | `pi.on("input")` |
| inline-bash.ts | Input | ❌ Not Possible | `pi.on("input")`, `pi.exec()` |
| interactive-shell.ts | Input | ❌ Not Possible | `user_bash` event, TUI access |
| ssh.ts | Tools | ❌ Not Possible | `registerFlag()`, tool factories, `before_agent_start` |
| event-bus.ts | Core | ❌ Not Possible | `pi.events`, inter-extension communication |
| confirm-destructive.ts | Safety | ❌ Not Possible | Session lifecycle events, cancellation |
| dirty-repo-guard.ts | Safety | ❌ Not Possible | Session lifecycle, `pi.exec()` |
| sandbox/index.ts | Safety | ❌ Not Possible | `registerFlag()`, tool factories, `user_bash` |
| preset.ts | Commands | ❌ Not Possible | `registerCommand()`, `registerFlag()`, `before_agent_start` |
| tools.ts | Commands | ❌ Not Possible | `registerCommand()`, `setActiveTools()` |
| handoff.ts | Commands | ❌ Not Possible | `registerCommand()`, session access, LLM utils |
| send-user-message.ts | Commands | ❌ Not Possible | `registerCommand()`, `sendUserMessage()` |
| reload-runtime.ts | Commands | ❌ Not Possible | `registerCommand()`, `ctx.reload()` |
| shutdown-command.ts | Commands | ❌ Not Possible | `registerCommand()`, `ctx.shutdown()` |
| pirate.ts | Prompt | ❌ Not Possible | `registerCommand()`, `before_agent_start` |
| claude-rules.ts | Prompt | ❌ Not Possible | `before_agent_start` |
| custom-compaction.ts | Prompt | ❌ Not Possible | Compaction events, model registry, LLM utils |
| trigger-compact.ts | Prompt | ❌ Not Possible | `turn_end`, `getContextUsage()`, `ctx.compact()` |
| git-checkpoint.ts | Git/Session | ❌ Not Possible | `turn_start`, `tool_result`, `pi.exec()` |
| auto-commit-on-exit.ts | Git/Session | ❌ Not Possible | `session_shutdown`, `pi.exec()` |
| session-name.ts | Git/Session | ❌ Not Possible | `registerCommand()`, `setSessionName()` |
| bookmark.ts | Git/Session | ❌ Not Possible | `registerCommand()`, `sessionManager` |
| dynamic-resources/index.ts | Provider | ❌ Not Possible | `resources_discover` event |
| custom-provider-anthropic/index.ts | Provider | ❌ Not Possible | `registerProvider()`, OAuth, streaming |

### Statistics

- **✅ Possible:** 3 extensions (8%)
- **🔶 Partial:** 10 extensions (28%)
- **❌ Not Possible:** 23 extensions (64%)

---

## Priority Ranking of Missing APIs

### High Priority (Enables Multiple Common Patterns)

| API | Extensions Enabled | Effort | Impact |
|-----|-------------------|--------|--------|
| `registerCommand()` | 15+ | Medium | Very High - Custom slash commands are fundamental |
| `pi.exec()` / Shell execution API | 5+ | Medium | High - Many extensions need to run commands |
| `before_agent_start` (system prompt modification) | 5+ | Low | High - Critical for prompt customization |
| `ctx.hasUI` flag | 5+ | Low | Medium - Simple flag, useful for non-interactive mode |

### Medium Priority (Enables Important Patterns)

| API | Extensions Enabled | Effort | Impact |
|-----|-------------------|--------|--------|
| `sendMessage()` / `sendUserMessage()` | 4+ | Medium | High - Programmatic message injection |
| `pi.on("turn_start")` / `pi.on("turn_end")` | 3+ | Low | Medium - Turn lifecycle tracking |
| `sessionManager.getEntries()` / `getBranch()` | 4+ | Medium | Medium - Access to conversation history |
| `setModel()`, `setActiveTools()` | 2+ | Medium | Medium - Runtime configuration |
| Tool parameter modification in `onToolCalled` | 2+ | Low | Medium - Enable spawn-hook patterns |

### Low Priority (Requires Significant Architecture Changes)

| API | Extensions Enabled | Effort | Impact |
|-----|-------------------|--------|--------|
| `ui.custom()` / Custom TUI components | 4+ | Very High | Medium - TUI-specific, limited GUI applicability |
| `registerProvider()` / Custom providers | 1 | Very High | Low - Core architecture change |
| `registerFlag()` / CLI arguments | 3+ | High | Low - CLI-specific, less relevant for GUI |
| `registerShortcut()` / Keyboard shortcuts | 1 | Medium | Low - GUI has different shortcut model |
| `ctx.compact()` / Compaction API | 2 | High | Low - Niche feature |
| `pi.events` / Inter-extension communication | 1 | Medium | Low - No clear use case yet |

---

## Recommended Implementation Order

### Phase 1: Foundation (Enables Most Extensions)

1. **`registerCommand()`** - Custom slash commands
   - Most requested feature across all extension categories
   - Enables: preset, tools, handoff, send-user-message, pirate, bookmark, session-name, etc.
   - Implementation: Add command registry to ExtensionManager, integrate with command parsing

2. **`pi.exec()` or shell execution context method**
   - Fundamental for git, safety, and automation extensions
   - Enables: dirty-repo-guard, git-checkpoint, auto-commit-on-exit, etc.
   - Implementation: Add `execCommand(command, args, options)` to ExtensionContext

3. **`before_agent_start` event with system prompt modification**
   - Critical for prompt customization patterns
   - Enables: preset, pirate, claude-rules, ssh
   - Implementation: Add return value processing to `onAgentStarted` event

### Phase 2: Enhanced Interaction

4. **`sendMessage()` / `sendUserMessage()` API**
   - Programmatic message injection
   - Enables: file-trigger, handoff, reload-runtime
   - Implementation: Add method to ExtensionContext, integrate with task message handling

5. **`turn_start` / `turn_end` events**
   - Turn lifecycle tracking
   - Enables: git-checkpoint, trigger-compact
   - Implementation: Add events to agent execution flow

6. **`sessionManager` access (read-only)**
   - Access to conversation history
   - Enables: todo, handoff, auto-commit-on-exit, bookmark
   - Implementation: Add `getTaskHistory()` or similar to ExtensionContext

### Phase 3: Runtime Configuration

7. **`setModel()`, `setActiveTools()` APIs**
   - Runtime configuration changes
   - Enables: preset, tools
   - Implementation: Add methods to ExtensionContext with IPC to main process

8. **Tool parameter modification in `onToolCalled`**
   - Enable spawn-hook patterns
   - Enables: bash-spawn-hook, tool-override
   - Implementation: Modify event return type to accept parameter changes

### Phase 4: Polish

9. **`ctx.hasUI` flag**
   - Simple addition, useful for non-interactive mode handling
   - Implementation: Add boolean property to ExtensionContext

10. **`ctx.isIdle()` method**
    - Check if agent is processing
    - Enables: send-user-message, condition-based behavior
    - Implementation: Add method that checks agent state

---

## Architecture Considerations

### CLI vs GUI Paradigm

Several pi-mono features are inherently CLI/TUI-centric and may not translate well to AiderDesk's GUI architecture:

- **`input` event** - GUI has explicit input fields, not text-based command prefixes
- **`user_bash` event** - GUI doesn't have `!` command interception
- **`ui.custom()` TUI components** - Requires full terminal UI framework
- **Interactive shell support** - Fundamentally incompatible with GUI (would need embedded terminal)

### Recommended Approach for GUI Alternatives

| CLI Pattern | GUI Alternative |
|-------------|-----------------|
| `?quick` prefix | Dropdown or button for response mode |
| `!{command}` expansion | Pre-processor in React input component |
| Interactive commands | Embedded terminal (xterm.js) |
| TUI selectors | Native HTML select/dialogs |

### Session vs Task Model

pi-mono's session model (switch, fork, branch, tree navigation) differs from AiderDesk's task model. Extensions relying on session lifecycle events may need redesign for AiderDesk's architecture.

---

## Conclusion

AiderDesk's extension system is well-designed for its core use cases (tool registration, event observation, basic UI interaction). The main gaps compared to pi-mono are:

1. **No custom command registration** - The single most impactful missing feature
2. **No shell execution from extensions** - Limits automation and git integrations
3. **No system prompt modification** - Prevents prompt customization patterns
4. **Limited session/task introspection** - Cannot access conversation history

Implementing Phase 1 (commands, shell execution, system prompt modification) would enable ~70% of the analyzed extensions with partial or full functionality.

The TUI-specific extensions (interactive-shell, question, questionnaire) are architectural mismatches and should either be skipped or implemented as core GUI features rather than extension APIs.

---

## ✨ Extension Command Registration - Implementation Complete

### Overview

Extension command registration has been **successfully implemented** in AiderDesk, allowing extension creators to register custom commands with custom execution logic. This addresses the #1 missing feature identified in the gap analysis above.

### Implementation Date
Completed: February 24, 2026

### Key Differences from File-Based Custom Commands

**File-Based Custom Commands** (existing):
- Defined in `.md` files with YAML front matter
- Use template strings with placeholder substitution (`{{1}}`, `{{2}}`, `{{ARGUMENTS}}`)
- Support shell command execution (lines starting with `!`)
- Located in `~/.aider-desk/commands/` or `<project>/.aider-desk/commands/`

**Extension Commands** (new):
- Defined in extension code via `getCommands()` method
- Have `execute` functions with custom TypeScript/JavaScript logic
- Return a prompt string that is fed to the agent or aider
- Can access full `ExtensionContext` API (file I/O, settings, notifications, etc.)
- Can perform any computation or integration before generating the prompt

### API Design

```typescript
interface CommandDefinition {
  /** Command name in kebab-case (e.g., 'generate-tests') */
  name: string;
  /** Description shown in autocomplete */
  description: string;
  /** Command arguments */
  arguments?: CommandArgument[];
  /** Execute function that handles the complete command logic */
  execute: (args: string[], context: ExtensionContext) => Promise<void>;
}

interface CommandArgument {
  /** Argument description for autocomplete/help */
  description: string;
  /** Whether this argument is required */
  required?: boolean;
}

interface ExtensionContext {
  // ... existing methods
  /** Send a prompt to the agent or aider for execution */
  runPrompt(prompt: string, mode?: 'agent' | 'code' | 'ask' | 'architect'): Promise<void>;
}
```

### Usage Example

```typescript
class MyExtension implements Extension {
  getCommands(): CommandDefinition[] {
    return [
      {
        name: 'generate-tests',
        description: 'Generate unit tests for a file',
        arguments: [
          { description: 'File path', required: true },
          { description: 'Framework (jest, vitest, mocha)', required: false },
        ],
        execute: async (args: string[], context: ExtensionContext) => {
          const filePath = args[0];
          const framework = args[1] || 'vitest';
          
          // Read file content
          const projectDir = context.getProjectDir();
          const fullPath = path.join(projectDir, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          
          // Build prompt
          const prompt = `Generate comprehensive unit tests for ${filePath} using ${framework}.

File content:
\`\`\`
${content}
\`\`\`

Include edge cases, error handling, and mocking examples.`;

          // Extension sends prompt to agent
          await context.runPrompt(prompt, 'agent');
        },
      },
    ];
  }
}
```

### Execution Flow

```
User types: /generate-tests src/utils/helper.ts vitest
   ↓
Task.runCustomCommand('generate-tests', ['src/utils/helper.ts', 'vitest'])
   ↓
Check if extension command exists
   ↓
Task.runExtensionCommand() validates arguments
   ↓
ExtensionManager.executeCommand('generate-tests', args, context)
   ↓
Extension's execute() function runs
   ↓
Extension is fully responsible for:
  - Processing arguments
  - Performing operations (file I/O, API calls, etc.)
  - Calling context.runPrompt() if it wants to send prompts
  - Or doing anything else without sending prompts
   ↓
Done (extension controls everything)
```

### Files Modified

| File | Changes |
|------|---------|
| `src/common/extensions/types.ts` | Added `CommandDefinition`, `CommandArgument` interfaces; Added `getCommands()` to `Extension` interface |
| `src/common/extensions/index.ts` | Exported new command types |
| `src/main/extensions/extension-registry.ts` | Added `RegisteredCommand` interface; Added command storage map and registration methods |
| `src/main/extensions/extension-manager.ts` | Added `validateCommandDefinition()`, `collectCommands()`, `executeCommand()` methods; Integrated command collection in init/reload |
| `src/main/task/task.ts` | Added `runExtensionCommand()` method; Modified `runCustomCommand()` to check extension commands first |

### Files Created

| File | Purpose |
|------|---------|
| `src/main/extensions/__tests__/command-registration.test.ts` | Comprehensive test suite for command registration (17 tests, all passing) |
| `examples/extensions/command-example.ts` | Example extension demonstrating 5 different command patterns |

### Testing

All tests pass (32 total):
- ✅ 17 tests in `command-registration.test.ts` - Command validation, registration, execution
- ✅ 15 tests in `agent-integration.test.ts` - Integration with agent system, includes command examples

### Validation Rules

Commands are validated on collection with the following rules:
- Name must be kebab-case (e.g., `generate-tests`, `review-pr`)
- Description must be a non-empty string
- Execute must be a function
- Arguments must be an array (if provided)

Invalid commands are logged and skipped during collection.

### Features

✅ **Declarative API**: Uses `getCommands()` getter method (consistent with `getTools()`)
✅ **Hot Reload**: Commands automatically reload when extension is modified
✅ **Error Isolation**: Command execution errors are caught and reported
✅ **ExtensionContext Access**: Full access to project, settings, notifications, etc.
✅ **Argument Validation**: Required vs optional arguments enforced
✅ **Mode Support**: Works in both agent mode and aider modes (code, ask, architect)
✅ **No Name Collision**: Extension commands checked before file-based commands

### Limitations

- Extension commands cannot block or modify other commands (unlike `onCustomCommandExecuted` event)
- No support for streaming output during execute function
- No direct access to chat history within execute function (can use getCurrentTask() for task data)

### Future Enhancements

Potential improvements for future consideration:
1. Command categories/grouping for better organization
2. Dynamic command availability (based on context)
3. Command-specific UI rendering in chat
4. Access to conversation history in execute function
5. Streaming logs during command execution
6. Command aliases or shortcuts

### Comparison with pi-mono

**pi-mono's `registerCommand`**:
- Imperative API: `pi.registerCommand(name, options)`
- Commands have `action` callback that can perform full session control
- Commands can access extensive session APIs

**AiderDesk's `getCommands`**:
- Declarative API: Return array from `getCommands()`
- Commands have `execute` function with full control over logic
- Extensions are responsible for everything including calling `context.runPrompt()` if needed
- More flexible: commands can do anything without requiring agent/aider execution

AiderDesk's approach gives extensions complete control while maintaining a simple, declarative registration pattern.

### Status

✅ **Implementation Complete**
- All core functionality implemented
- Tests passing
- Example extension created
- Code quality verified (ESLint + TypeScript)

This implementation enables extension creators to add custom commands with rich, programmatic logic, closing the #1 gap identified in the pi-mono comparison analysis.

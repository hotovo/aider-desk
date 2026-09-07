# Plannotator Extension

Plan-based development workflow with planning mode, tool restrictions, and execution tracking.

Kudos to https://github.com/backnotprop/plannotator.

## Architecture

The extension uses a **task-based state management** approach:

- **State is tracked per task** using a `Map<taskId, TaskState>`
- **Responds to mode changes** via `onAgentStarted` event
- **Mode can be changed** via command or directly in AiderDesk UI
- **Phase management** is independent of mode switching

## Features

### Planning Mode
- **Tool Restrictions**: During planning phase, only read operations and writes to `PLAN.md` are allowed
- **Context Injection**: Automatically injects planning instructions when in plannotator mode
- **Iterative Workflow**: Encourages exploring code, updating plan, and asking questions

- **Auto-detected Address**: The plan review UI address is auto-detected from `os.networkInterfaces()` (falls back to `localhost`)

### Task Directory Storage
- PLAN.md is stored in `.aider-desk/tasks/{taskId}/PLAN.md` (AiderDesk's task-specific directory)
- This keeps plans organized per-task and accessible to other extensions

### SPEC.md Symlink
- After plan approval, a `SPEC.md → PLAN.md` symlink is created in the same task directory
- This bridges the planning → execution gap, allowing executor extensions (like Conductor) to find the plan via their `read-spec` tool

### Execution Tracking
- **Checklist Parsing**: Parses `- [ ] n. Description` items from PLAN.md
- **Progress Tracking**: Tracks completion via `[DONE:n]` markers in responses

### Commands
- `/plannotator [file]` - Toggle plannotator mode (optionally specify plan file path)
- `/plannotator-review` - Open code review UI for current git changes

### Code Review

The `/plannotator-review` command reviews your current uncommitted git changes. By default it runs **inline in the AiderDesk chat** (no browser required); when *Use browser-based review* is enabled in the extension settings, it opens the full browser-based UI instead:

**Features:**
- View git diffs (uncommitted, staged, last commit, branch comparison)
- Add line annotations and comments
- Send feedback directly to the agent for fixes

**Workflow:**
1. Run `/plannotator-review` command
2. Diff is shown inline (or browser opens if browser review is enabled)
3. Review the changes and approve or request changes
4. If feedback is provided, agent receives a prompt to address the issues

### Tools
- `exit_plan_mode` - Exit planning phase and start execution

## Workflow

### Phase 1: Planning

1. **Enter Plannotator Mode**:
   - Use `/plannotator` command, OR
   - Switch to "Plannotator" mode in AiderDesk UI

2. **Agent Creates Plan**:
   - Agent explores codebase (read-only tools)
   - Writes findings to PLAN.md
   - Asks user questions when needed
   - Structures plan with sections (Context, Approach, Files, Steps, etc.)

3. **Agent Calls exit_plan_mode**:
   - Agent calls `exit_plan_mode` tool when plan is ready

### Phase 2: Review

4. **Plan Is Presented** (inline by default):
   - **Inline (default)**: A review panel appears in the AiderDesk chat with the full plan, an optional feedback box, and Approve / Request-changes buttons. No browser or XDG-open is needed — works in headless and remote-server deployments.
   - **Browser (optional)**: If *Use browser-based review* is enabled in settings, the extension starts an HTTP review server on a random port and opens it (e.g., `http://localhost:3777`). When AiderDesk runs as a remote/headless server, the reachable host is auto-detected from the machine's network interfaces; to override it, set the *Server Host / Base URL* setting so the review URL points at the reachable host instead.

5. **User Reviews Plan**:
   - **Approve**: Click "Approve" (optionally add notes)
   - **Request Changes**: Click "Request changes" and provide feedback

6. **Decision Sent to Agent**:
   - **If approved**: Agent transitions to execution phase
   - **If rejected**: Agent receives feedback and must revise plan

### Phase 3: Execution

7. **Execute Plan** (if approved):
   - Full tool access restored
   - Agent implements plan step by step
   - Tracks progress with `[DONE:n]` markers
   - Checklist items marked as completed

### Rejection Flow

If the plan is rejected:
1. Agent receives feedback from user
2. Agent reads current PLAN.md
3. Agent uses `file_edit` to make targeted changes
4. Agent calls `exit_plan_mode` again
5. Review panel appears again
6. Repeat until approved

## Server / Remote Deployment

The extension no longer assumes `localhost`. When AiderDesk runs as a remote or headless server, the review UI is shown **inline in the chat** by default, so nothing needs to be configured for plan reviews.

For the optional browser-based review UI, configure the extension via **Settings → Extensions → Plannotator**:

- **Server Host / Base URL** — The hostname (or full origin such as `https://plannotator.example.com`) the browser uses to reach this AiderDesk server. Bare hosts get the server's dynamic port appended automatically; full origins (with or without an explicit port) are used verbatim, since reverse-proxy endpoints on a fixed port would become unreachable if the dynamic review port were appended. Leave blank for auto-detected host. This is also respected as the environment variable `PLANNOTATOR_HOST`.
- **Use browser-based review** — Off by default (inline review). Enable for the full browser reviewer on local/Electron setups.

## Mode vs Phase

### Mode
- **What**: AiderDesk task mode (e.g., "plannotator", "agent", "architect")
- **Where**: Stored in `task.currentMode`
- **Changed by**: UI mode selector or `/plannotator` command
- **Detected by**: `onAgentStarted` event (`event.mode`)

### Phase
- **What**: Plannotator workflow phase ("idle", "planning", "executing")
- **Where**: Stored in extension's `taskStates` Map
- **Changed by**: Extension logic only
- **Transitions**:
  - `idle` → `planning`: When entering plannotator mode
  - `planning` → `executing`: When `exit_plan_mode` tool is called
  - `executing` → `idle`: When task is closed or mode changed

## State Management

State is tracked in memory per task:

```typescript
interface TaskState {
  phase: 'idle' | 'planning' | 'executing';
  planFile: string;
  checklistItems: ChecklistItem[];
}

// Stored in: Map<taskId, TaskState>
```

### Lifecycle

1. **Task Initialized**: State map entry created on first access
2. **Mode Changed**: Detected via `onAgentStarted`, phase initialized to "planning"
3. **Phase Transitions**: Managed by tool calls and events
4. **Task Closed**: State map entry removed

## Plan File Format

```markdown
# Plan Title

## Context
Why this change is being made...

## Approach
Recommended approach...

## Files to Modify
- path/to/file1.ts
- path/to/file2.ts

## Reuse
- Existing utilities and functions...

## Steps
- [ ] 1. First implementation step
- [ ] 2. Second implementation step
- [ ] 3. Third implementation step

## Verification
How to test the changes...
```

## Important Reminders

When in planning phase, the extension automatically adds a reminder to the agent's context:

```
## Plannotator Mode Active

You are in planning phase. Your available tools are restricted to read-only operations and writing to PLAN.md.

**When your plan is ready**: Call the `exit_plan_mode` tool to exit planning phase and begin implementation.
```

This ensures the agent remembers to call `exit_plan_mode` when the plan is complete.

## Event Flow

### Mode Change Flow

```
User switches to plannotator mode (UI or command)
    ↓
task.currentMode = 'plannotator'
    ↓
Agent starts with new mode
    ↓
onAgentStarted(event) { event.mode === 'plannotator' }
    ↓
Initialize taskState.phase = 'planning'
    ↓
Inject planning instructions
    ↓
Tool restrictions applied in onToolCalled
```

### Phase Transition Flow

```
Phase: idle → planning → executing
    ↓           ↓           ↓
onAgentStart  exit_plan   execution
   (auto)      tool       tracking
```

## Review Server

The extension uses the **original plannotator server implementation** from [backnotprop/plannotator](https://github.com/backnotprop/plannotator).

### Features

When `exit_plan_mode` is called, the extension:

1. **Starts HTTP Server**: Lightweight Node.js HTTP server on random port
2. **Version History**: Automatically saves plan versions to `~/.plannotator/history/`
3. **Project Detection**: Detects git project name for organization
4. **Serves Review UI**: HTML page with plan content and approve/deny buttons
5. **Provides API Endpoints**:
   - `GET /api/plan` - Returns plan content with version info
   - `GET /api/plan/version?v=N` - Returns specific plan version
   - `GET /api/plan/versions` - Lists all plan versions
   - `GET /api/plan/history` - Lists all project plans
   - `POST /api/approve` - User approves plan
   - `POST /api/deny` - User rejects plan
6. **Opens Browser**: Automatically opens review URL in default browser
7. **Waits for Decision**: Tool blocks until user makes decision
8. **Cleans Up**: Server stopped after decision

### Version History

Plans are automatically versioned and saved to:
```
~/.plannotator/history/{project}/{plan-slug}/
  ├── 001.md
  ├── 002.md
  └── 003.md
```

Each revision is saved with a timestamp, allowing users to:
- View previous versions
- Compare changes over time
- Restore older versions if needed

### Checklist Format

The extension uses **standard markdown checkboxes** (compatible with GitHub, GitLab, etc.):

```markdown
- [ ] First step description
- [ ] Second step description
- [x] Completed step
```

**Note**: Unlike the previous version which used numbered steps (`- [ ] 1. Step`), this uses the standard markdown checkbox format.

### Progress Tracking

During execution, the agent marks steps as completed using `[DONE:n]` markers:

```
I've completed the first step. [DONE:1]

Now moving on to the second step...
```

The extension tracks these markers and updates checklist items accordingly.

### Browser Compatibility

The extension uses platform-specific commands to open browsers:
- **macOS**: `open`
- **Windows/WSL**: `cmd.exe /c start`
- **Linux**: `xdg-open`

Environment variables:
- `BROWSER`: Custom browser command (on macOS treated as an app name via `open -a`)

## Key Differences from Previous Version

1. **No file-based state**: State is in-memory only, per task
2. **Mode-driven**: Responds to `task.currentMode` changes, not just commands
3. **Task-scoped**: Each task has independent state
4. **Automatic initialization**: Planning phase starts automatically when entering plannotator mode
5. **Review workflow**: Browser-based review with approve/deny before execution

## Debugging

The extension logs important events at the 'info' level:
- Task initialized/closed
- Mode changes detected
- Phase transitions
- Review server started
- Browser opened
- User decisions (approve/deny)
- Checklist parsing
- Tool blocking

To see these logs, check the AiderDesk console.

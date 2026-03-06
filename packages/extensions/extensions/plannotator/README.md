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

### Execution Tracking
- **Checklist Parsing**: Parses `- [ ] n. Description` items from PLAN.md
- **Progress Tracking**: Tracks completion via `[DONE:n]` markers in responses

### Commands
- `/plannotator [file]` - Toggle plannotator mode (optionally specify plan file path)

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

4. **Review Server Starts**:
   - Extension starts HTTP review server on random port
   - Browser opens to review URL (e.g., `http://localhost:3777`)
   - User sees plan in browser UI

5. **User Reviews Plan**:
   - **Approve**: Click "Approve Plan" (optionally add notes)
   - **Request Changes**: Click "Request Changes" and provide feedback

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
5. Browser opens for review again
6. Repeat until approved

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
- `PLANNOTATOR_BROWSER`: Custom browser command
- `BROWSER`: Fallback browser command

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

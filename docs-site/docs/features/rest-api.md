---
title: "REST API"
sidebar_label: "REST API"
---

# REST API

AiderDesk exposes a comprehensive REST API that allows external tools, such as IDE plugins, web applications, and automation scripts, to interact with the application programmatically. The API runs on the same port as the main application, which defaults to `24337` but can be configured with the `AIDER_DESK_PORT` environment variable.

## Overview

The REST API is organized into logical modules covering different aspects of AiderDesk functionality:

- **Context Management**: File and context operations
- **Prompt Execution**: AI interaction and response handling
- **Queued Prompts**: Managing prompts waiting in the execution queue
- **Project Management**: Project lifecycle and configuration
- **Task Management**: Task creation, updates, and lifecycle
- **Worktree Operations**: Git worktree isolation, merging, and rebase
- **Settings Management**: Application and project settings
- **Session Management**: Conversation persistence
- **Todo Management**: Task tracking
- **Usage Analytics**: Token usage and cost tracking
- **System Integration**: Environment variables and system info
- **Custom Commands**: User-defined command execution
- **MCP Integration**: Model Context Protocol server management

## Authentication & Configuration

All API endpoints accept JSON payloads and return JSON responses. The API uses consistent error handling with appropriate HTTP status codes.

### Base URL
```
http://localhost:24337/api
```

### Common Request Patterns
Most endpoints require a `projectDir` parameter specifying the absolute path to the project directory.

### Error Handling
```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "details": "Additional error information"
}
```

## Endpoints by Category

### Context Management

#### Add Context File
Adds a file to the project's context for AI processing.

- **Endpoint**: `POST /api/add-context-file`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "path": "src/main.ts",
    "readOnly": false
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "File added to context"
  }
  ```

#### Drop Context File
Removes a file from the project's context.

- **Endpoint**: `POST /api/drop-context-file`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "path": "src/utils.ts"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "File dropped from context"
  }
  ```

#### Get Context Files
Retrieves the list of all files currently in the project's context.

- **Endpoint**: `POST /api/get-context-files`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK` (returns context files array)

#### Get Addable Files
Retrieves a list of all files in the project that can be added to the context.

- **Endpoint**: `POST /api/get-addable-files`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "searchRegex": ".*\\.ts$"
  }
  ```
- **Response**: `200 OK` (returns file paths array)

### Prompt Execution

#### Run Prompt
Executes an AI prompt in the specified project. Supports two response modes via content negotiation:

- **JSON response** (default): Waits for the prompt to complete and returns the result. When `taskId` is omitted, the project and task are auto-created.
- **SSE streaming**: When `Accept: text/event-stream` is provided, the response is streamed in real-time as Server-Sent Events. The project and task are auto-created if needed, and the `X-Task-Id` header is returned.

- **Endpoint**: `POST /api/run-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "prompt": "Create a user authentication system",
    "mode": "code",
    "taskId": "optional-task-id"
  }
  ```
- **JSON Response**: `200 OK` (returns prompt execution result)
- **SSE Response**: `200 OK` with `Content-Type: text/event-stream`

  SSE event types: `response-chunk`, `response-completed`, `tool`, `log`, `ask-question`, `user-message`, `task-updated`. The stream ends with a `stream-end` event after `response-completed`.

  Example SSE output:
  ```
  event: response-chunk
  data: {"chunk":"Hello","reasoning":"","taskId":"abc123",...}

  event: tool
  data: {"toolName":"file_read","finished":false,...}

  event: response-completed
  data: {"content":"Hello!","taskId":"abc123",...}

  event: stream-end
  data: {"type":"stream-end"}
  ```

#### Redo Last User Prompt
Re-executes the last user prompt with optional modifications.

- **Endpoint**: `POST /api/project/redo-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "mode": "code",
    "updatedPrompt": "Add error handling to the authentication system"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Redo last user prompt initiated"
  }
  ```

#### Save Prompt
Saves a prompt to the task without executing it. The prompt is stored as a user message in the task's context and the task state is set to `TODO`. This is useful for pre-loading a task with a prompt that an operator can review before manually starting execution.

Unlike `POST /api/run-prompt`, this endpoint does **not** trigger any AI model execution. The prompt is simply saved and becomes visible in the task's chat history.

- **Endpoint**: `POST /api/save-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "prompt": "Create a user authentication system with JWT tokens"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Prompt saved successfully"
  }
  ```

#### Answer Question
Provides an answer to a question asked by the AI.

- **Endpoint**: `POST /api/project/answer-question`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "answer": "React"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Answer submitted"
  }
  ```

### Queued Prompts

When a task is already processing a prompt, any new prompts submitted via `POST /api/run-prompt` are automatically queued for sequential execution. The queued prompts are visible in the AiderDesk UI and can be managed through the following endpoints.

Queued prompts are useful for:
- **Batch processing**: Submit multiple prompts that execute one after another
- **Manual review**: Prompts wait in the queue until the operator or the system processes them
- **Reordering**: Adjust the execution order before prompts are processed

#### Remove Queued Prompt
Removes a prompt from the task's queue.

- **Endpoint**: `POST /api/project/remove-queued-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "promptId": "prompt-uuid"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Queued prompt removed"
  }
  ```

#### Send Queued Prompt Now
Moves a queued prompt to the top of the queue and interrupts the current execution to start processing it immediately.

- **Endpoint**: `POST /api/project/send-queued-prompt-now`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "promptId": "prompt-uuid"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Queued prompt sent"
  }
  ```

#### Reorder Queued Prompts
Changes the execution order of all queued prompts for a task. The `prompts` array must contain all existing queued prompts in the desired order.

- **Endpoint**: `POST /api/project/reorder-queued-prompts`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "prompts": [
      { "id": "prompt-2", "text": "Second prompt", "mode": "code", "timestamp": 1715340000000 },
      { "id": "prompt-1", "text": "First prompt", "mode": "agent", "timestamp": 1715330000000 }
    ]
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Queued prompts reordered"
  }
  ```

#### Edit Queued Prompt
Modifies the text of a prompt that is already in the queue.

- **Endpoint**: `POST /api/project/edit-queued-prompt`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "taskId": "abc123",
    "promptId": "prompt-uuid",
    "newText": "Updated prompt text"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Queued prompt edited"
  }
  ```

### Project Management

#### Get Projects
Retrieves all open projects.

- **Endpoint**: `GET /api/projects`
- **Response**: `200 OK` (returns projects array)

#### Start Project
Starts a new AiderDesk project.

- **Endpoint**: `POST /api/project/start`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project started"
  }
  ```

#### Stop Project
Stops a running project.

- **Endpoint**: `POST /api/project/stop`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project stopped"
  }
  ```

#### Restart Project
Restarts a project with optional mode.

- **Endpoint**: `POST /api/project/restart`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/your/project",
    "startupMode": "architect"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Project restarted"
  }
  ```

#### Get Project Settings
Retrieves settings for a specific project.

- **Endpoint**: `GET /api/project/settings?projectDir=/path/to/project`
- **Response**: `200 OK` (returns project settings object)

#### Patch Project Settings
Updates project settings.

- **Endpoint**: `PATCH /api/project/settings`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "mainModel": "gpt-4-turbo",
    "editFormat": "diff-fenced"
  }
  ```
- **Response**: `200 OK` (returns updated settings)

### Commands and Execution

#### Run Command
Executes a shell command in the project.

- **Endpoint**: `POST /api/project/run-command`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "command": "npm install"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Command executed"
  }
  ```

#### Paste Image
Pastes an image from clipboard into the project.

- **Endpoint**: `POST /api/project/paste-image`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Image pasted"
  }
  ```

### Task Management

Tasks are the primary unit of work in AiderDesk. Each task holds its own conversation context, mode, working mode (local or worktree), and agent configuration. Understanding the task lifecycle is important for automation use cases.

#### Create Task
Creates a new task within a project. The new task inherits model, mode, and other settings from the most recent task (or from the parent task if `parentId` is specified).

- **Endpoint**: `POST /api/project/tasks/new`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "parentId": null,
    "name": "Implement login feature"
  }
  ```
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `projectDir` | string | Yes | Absolute path to the project directory |
  | `parentId` | string \| null | No | Parent task ID for creating subtasks |
  | `name` | string | No | Display name for the task |
- **Response**: `200 OK` (returns `TaskData` object)
  ```json
  {
    "id": "a1b2c3d4",
    "baseDir": "/path/to/project",
    "name": "Implement login feature",
    "currentMode": "agent",
    "workingMode": "local",
    "worktree": null,
    "autonomyMode": "guided",
    ...
  }
  ```

:::important Task Initialization and Worktree
The task is returned in an **uninitialized** state. The `workingMode` field reflects the global default (`taskSettings.defaultWorkingMode`), but the Git worktree is **not yet materialized** at this point — `worktree` will be `null` even if `workingMode` is `"worktree"`. Worktree creation happens when the task is initialized (loaded or when a prompt is run). To create a task with a verified worktree via the REST API, use the two-step pattern described in [External Automation Bridge](#external-automation-bridge).
:::

#### Update Task
Updates a task's properties. This is the supported way to change `workingMode`, `currentMode`, `autonomyMode`, and other task fields.

- **Endpoint**: `POST /api/project/tasks`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "id": "a1b2c3d4",
    "updates": {
      "workingMode": "worktree",
      "currentMode": "agent",
      "name": "Updated task name"
    }
  }
  ```
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `projectDir` | string | Yes | Absolute path to the project directory |
  | `id` | string | Yes | Task ID to update |
  | `updates` | object | Yes | Partial `TaskData` with fields to change |
- **Response**: `200 OK` (returns updated `TaskData`)

When `workingMode` is changed to `"worktree"`, the Git worktree is **synchronously created** during this call. The response will contain the fully populated `worktree` object with `path` and `branch`. No polling is required.

```json
{
  "id": "a1b2c3d4",
  "workingMode": "worktree",
  "worktree": {
    "path": "/path/to/project/.aider-desk/tasks/a1b2c3d4/worktree",
    "branch": "task/a1b2c3d4",
    "baseBranch": "main"
  },
  ...
}
```

#### List Tasks
Lists all tasks for a project.

- **Endpoint**: `GET /api/project/tasks?projectDir=/path/to/project`
- **Response**: `200 OK` (returns array of `TaskData` objects)

Note that listed tasks may not be fully initialized. The `workingMode` and `worktree` fields reflect the persisted state but may not yet match the runtime state if the task hasn't been loaded.

#### Load Task Data
Loads a task's runtime state including messages, context files, and queued prompts. This also triggers task initialization (including worktree materialization if `workingMode` is `"worktree"` and no worktree exists yet).

- **Endpoint**: `POST /api/project/tasks/load`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "id": "a1b2c3d4"
  }
  ```
- **Response**: `200 OK` (returns `TaskStateData` with `messages`, `files`, `workingMode`, etc.)

The returned object contains the conversation state but **not** the full `worktree` metadata. Use `GET /api/project/worktree/status` or `POST /api/project/tasks` (update) to get worktree details.

#### Save Task
Saves the current conversation task.

- **Endpoint**: `POST /api/project/task/save`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "name": "feature-login"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Task saved"
  }
  ```

### Settings Management

#### Get Settings
Retrieves application settings.

- **Endpoint**: `GET /api/settings`
- **Response**: `200 OK` (returns settings object)

#### Save Settings
Updates application settings.

- **Endpoint**: `POST /api/settings`
- **Request Body**:
  ```json
  {
    "language": "en",
    "theme": "dark",
    "font": "JetBrainsMono",
    "aiderDeskAutoUpdate": true,
    "aider": {
      "options": "--verbose --model gpt-4",
      "cachingEnabled": true,
      ...
    },
    "models": {
      "aiderPreferred": ["gpt-4", "claude-3-sonnet"],
      ...
    },
    "telemetryEnabled": false,
    "promptBehavior": {
      "suggestionMode": "automatically",
      ...
    },
    "server": {
      "enabled": true,
      ...
    },
    ...
  }
  ```
  For the complete `SettingsData` structure, see [packages/common/src/types/common.ts](https://github.com/hotovo/aider-desk/blob/main/packages/common/src/types/common.ts).
- **Response**: `200 OK` (returns updated settings)

#### Get Models Info
Retrieves information about available AI models.

- **Endpoint**: `GET /api/models`
- **Response**: `200 OK` (returns models info object)

### Usage Analytics

#### Query Usage Data
Retrieves usage data for a specific date range.

- **Endpoint**: `GET /api/usage?from=2025-01-01&to=2025-01-31`
- **Response**: `200 OK` (returns usage data array)

### System Integration

#### Health Check
Returns the server health status. Useful for checking if the AiderDesk server is running before making API calls.

- **Endpoint**: `GET /api/health`
- **Response**: `200 OK`
  ```json
  { "status": "ok" }
  ```

#### Get Effective Environment Variable
Retrieves the effective value of an environment variable.

- **Endpoint**: `GET /api/system/env-var?key=OPENAI_API_KEY&baseDir=/path/to/project`
- **Response**: `200 OK` (returns environment variable object)

### MCP Integration

#### Load MCP Server Tools
Loads tools from an MCP server.

- **Endpoint**: `POST /api/mcp/tools`
- **Request Body**:
  ```json
  {
    "serverName": "filesystem",
    "config": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
  ```
- **Response**: `200 OK` (returns tools array)

#### Reload MCP Servers
Reloads all MCP servers with new configuration.

- **Endpoint**: `POST /api/mcp/reload`
- **Request Body**:
  ```json
  {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
      }
    },
    "force": true
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "MCP servers reloaded"
  }
  ```

### Worktree Operations

Worktrees provide Git isolation for tasks. Each worktree is a separate working directory linked to the main repository, allowing tasks to make changes without affecting each other or the main branch. All worktree endpoints require `projectDir` and `taskId` parameters.

#### Get Worktree Status
Returns the integration status of a task's worktree against a target branch. This is the **authoritative endpoint** for verifying that a Git worktree has been materialized and checking its state.

- **Endpoint**: `GET /api/project/worktree/status`
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  |-----------|------|----------|-------------|
  | `projectDir` | string | Yes | Absolute path to the project directory |
  | `taskId` | string | Yes | Task ID |
  | `targetBranch` | string | No | Branch to compare against (defaults to main branch) |
- **Response**: `200 OK`
  ```json
  {
    "currentBranch": "task/a1b2c3d4",
    "baseBranch": "main",
    "targetBranch": "main",
    "aheadCommits": {
      "count": 3,
      "commits": ["abc1234 feat: add login", "def5678 fix: validation", "..."]
    },
    "uncommittedFiles": {
      "count": 2,
      "files": ["src/auth.ts", "src/login.tsx"]
    },
    "predictedConflicts": [],
    "rebaseState": null
  }
  ```
  Returns `null` if no worktree exists for the task. A non-null response confirms the worktree is materialized on disk.

#### Merge Worktree to Main
Merges the task's worktree branch into a target branch (typically main).

- **Endpoint**: `POST /api/project/worktree/merge-to-main`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "squash": false,
    "targetBranch": "main",
    "commitMessage": "feat: implement login feature"
  }
  ```
- **Response**: `200 OK` `{ "message": "Worktree merged" }`

#### Commit Changes
Commits uncommitted changes in the worktree.

- **Endpoint**: `POST /api/project/worktree/commit-changes`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "message": "feat: implement login",
    "amend": false
  }
  ```
- **Response**: `200 OK` `{ "message": "Changes committed" }`

#### Generate Commit Message
Uses AI to generate a commit message based on the worktree's uncommitted changes.

- **Endpoint**: `POST /api/project/worktree/generate-commit-message`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4"
  }
  ```
- **Response**: `200 OK` (returns generated commit message string)

#### Rebase Worktree from Branch
Rebases the worktree branch onto the specified source branch.

- **Endpoint**: `POST /api/project/worktree/rebase-from-branch`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "fromBranch": "main"
  }
  ```
- **Response**: `200 OK` `{ "message": "Worktree rebased" }`

#### Rename Worktree Branch
Renames the current worktree branch.

- **Endpoint**: `POST /api/project/worktree/rename-branch`
- **Request Body**:
  ```json
  {
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "newBranchName": "feature/login-v2"
  }
  ```
- **Response**: `200 OK` `{ "message": "Branch renamed" }`

#### Additional Worktree Endpoints

- `POST /api/project/switch-to-local-working-mode` — Switch task to local working mode (optionally merge first)
- `POST /api/project/switch-to-worktree-working-mode` — Switch task to worktree working mode (optionally carry over uncommitted changes)
- `GET /api/project/local-uncommitted-files` — Get uncommitted files in the local project directory
- `POST /api/project/worktree/apply-uncommitted` — Apply uncommitted changes to a target branch
- `POST /api/project/worktree/revert-last-merge` — Revert the most recent merge
- `POST /api/project/worktree/restore-file` — Restore a file from the target branch
- `POST /api/project/worktree/abort-rebase` — Abort an in-progress rebase
- `POST /api/project/worktree/continue-rebase` — Continue an in-progress rebase after resolving conflicts
- `POST /api/project/worktree/resolve-conflicts-with-agent` — Use AI agent to resolve rebase conflicts
- `GET /api/project/worktree/branches` — List worktree branches

### Additional Endpoints

The API includes many more endpoints for:

- **Input History**: Load and manage input history
- **File Operations**: Path validation, file suggestions, edit application
- **Conversation Management**: Remove messages, compact conversations
- **Web Scraping**: Scrape and add web content to context
- **Todo Management**: Create, update, and manage todo items
- **Custom Commands**: Execute user-defined commands
- **Version Management**: Check for updates and get version info
- **Terminal Operations**: Create, write to, and manage terminals

## Integration Patterns

### External Automation Bridge

For external tools (CI/CD pipelines, IssueOps bridges, chat bots) that need to create isolated tasks with verified Git worktree isolation, use the following two-step pattern. This ensures the task is created in Worktree mode with the worktree fully materialized, while keeping the task queued and ready for manual or deferred execution.

#### Step 1: Create the Task

```bash
curl -X POST http://localhost:24337/api/project/tasks/new \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "name": "issue-123: Fix login bug"
  }'
```

Response:
```json
{
  "id": "a1b2c3d4",
  "name": "issue-123: Fix login bug",
  "currentMode": "agent",
  "workingMode": "local",
  "worktree": null,
  ...
}
```

The task is created but the worktree is **not yet materialized**. The `workingMode` reflects the global default setting.

#### Step 2: Enable Worktree Mode

```bash
curl -X POST http://localhost:24337/api/project/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "id": "a1b2c3d4",
    "updates": {
      "workingMode": "worktree",
      "currentMode": "agent"
    }
  }'
```

Response:
```json
{
  "id": "a1b2c3d4",
  "workingMode": "worktree",
  "worktree": {
    "path": "/path/to/project/.aider-desk/tasks/a1b2c3d4/worktree",
    "branch": "task/a1b2c3d4",
    "baseBranch": "main"
  },
  ...
}
```

The worktree is **synchronously created** during this call. The response is authoritative — if it contains a `worktree` object, the Git worktree is materialized on disk.

#### Step 3 (Optional): Verify Worktree Isolation

```bash
curl "http://localhost:24337/api/project/worktree/status?projectDir=/path/to/project&taskId=a1b2c3d4"
```

A non-null response confirms the worktree exists and is operational. Use this to verify isolation before transitioning external state (e.g., moving a GitHub issue to `a2a/queued`).

#### Step 4 (When Ready): Execute the Task

```bash
curl -X POST http://localhost:24337/api/run-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "prompt": "Fix the login bug described in issue #123",
    "mode": "agent"
  }'
```

Or save a prompt for later review without starting execution:

```bash
curl -X POST http://localhost:24337/api/save-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4",
    "prompt": "Fix the login bug described in issue #123"
  }'
```

#### Failure Recovery

If Step 2 fails (e.g., git error, disk full), the task exists but has no worktree. The bridge should treat this as a failure and either retry or clean up:

```bash
# Clean up the failed task
curl -X POST http://localhost:24337/api/project/delete-task \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "taskId": "a1b2c3d4"
  }'
```

### Task Initialization Lifecycle

Understanding the task lifecycle is important for automation:

1. **Created** (`POST /api/project/tasks/new`) — Task object exists in memory with persisted data. No initialization has occurred. Worktree is not materialized. Aider process is not started.

2. **Updated** (`POST /api/project/tasks`) — Task properties are changed. If `workingMode` is changed to `"worktree"`, the Git worktree is synchronously created. If `currentMode` is set to an aider-requiring mode, the Aider process is started in the background.

3. **Loaded** (`POST /api/project/tasks/load`) — Task is fully initialized: worktree is materialized (if `workingMode` is `"worktree"`), context files are loaded, and the Aider process starts if needed.

4. **Prompt executed** (`POST /api/run-prompt`) — The AI processes the prompt. This is the execution step.

5. **Prompt saved** (`POST /api/save-prompt`) — A prompt is stored without execution. The task state is set to `TODO`, making it visible in the UI for an operator to review and start manually.

For external bridges that need verified isolation before execution, the recommended approach is: create → update with `workingMode: "worktree"` → verify via worktree status → run prompt (or save prompt for manual start).

## Usage Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');
const AIDER_API_BASE = 'http://localhost:24337/api';

async function startProject(projectDir) {
  const response = await axios.post(`${AIDER_API_BASE}/project/start`, {
    projectDir
  });
  return response.data;
}

async function runPrompt(projectDir, taskId, prompt, mode = 'code') {
  const response = await axios.post(`${AIDER_API_BASE}/run-prompt`, {
    projectDir,
    taskId,
    prompt,
    mode
  });
  return response.data;
}

async function savePrompt(projectDir, taskId, prompt) {
  const response = await axios.post(`${AIDER_API_BASE}/save-prompt`, {
    projectDir,
    taskId,
    prompt
  });
  return response.data;
}

// Create an isolated worktree task (two-step pattern)
async function createWorktreeTask(projectDir, name) {
  // Step 1: Create the task (uninitialized, no worktree yet)
  const { data: task } = await axios.post(`${AIDER_API_BASE}/project/tasks/new`, {
    projectDir,
    name
  });

  // Step 2: Enable worktree mode (synchronously materializes the Git worktree)
  const { data: updatedTask } = await axios.post(`${AIDER_API_BASE}/project/tasks`, {
    projectDir,
    id: task.id,
    updates: { workingMode: 'worktree', currentMode: 'agent' }
  });

  // Verify worktree isolation
  if (!updatedTask.worktree) {
    throw new Error(`Worktree not materialized for task ${task.id}`);
  }

  return updatedTask;
}

// Usage
const projectDir = '/path/to/my/project';
await startProject(projectDir);

// Simple prompt execution
const result = await runPrompt(projectDir, 'abc123', 'Create a hello world function');

// Or save a draft prompt for later review
await savePrompt(projectDir, 'abc123', 'Create a hello world function');

// Or create an isolated worktree task for external automation
const task = await createWorktreeTask(projectDir, 'issue-123: Fix login bug');
console.log(`Worktree isolated at: ${task.worktree.path}`);
console.log(`Branch: ${task.worktree.branch}`);

// Save a prompt for the worktree task (does not start execution)
await savePrompt(projectDir, task.id, 'Fix the login bug described in issue #123');
```

### cURL Examples

```bash
# Start a project
curl -X POST http://localhost:24337/api/project/start \
  -H "Content-Type: application/json" \
  -d '{"projectDir": "/path/to/project"}'

# Run a prompt
curl -X POST http://localhost:24337/api/run-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "prompt": "Create a hello world function",
    "mode": "code"
  }'

# Save a prompt without executing it
curl -X POST http://localhost:24337/api/save-prompt \
  -H "Content-Type: application/json" \
  -d '{
    "projectDir": "/path/to/project",
    "taskId": "abc123",
    "prompt": "Create a hello world function"
  }'

# Create a worktree task (two-step pattern)
# Step 1: Create task
TASK_ID=$(curl -s -X POST http://localhost:24337/api/project/tasks/new \
  -H "Content-Type: application/json" \
  -d '{"projectDir": "/path/to/project", "name": "issue-123"}' \
  | jq -r '.id')

# Step 2: Enable worktree mode (synchronously creates Git worktree)
curl -X POST http://localhost:24337/api/project/tasks \
  -H "Content-Type: application/json" \
  -d "{
    \"projectDir\": \"/path/to/project\",
    \"id\": \"$TASK_ID\",
    \"updates\": {\"workingMode\": \"worktree\", \"currentMode\": \"agent\"}
  }"

# Step 3: Verify worktree isolation
curl "http://localhost:24337/api/project/worktree/status?projectDir=/path/to/project&taskId=$TASK_ID"
```

## Error Handling

The API uses standard HTTP status codes:
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **403**: Forbidden (project not started)
- **404**: Not Found (project or resource doesn't exist)
- **429**: Too Many Requests (rate limiting)
- **500**: Internal Server Error

## Best Practices

1. **Project Management**: Always start projects before running prompts
2. **Error Handling**: Implement proper error handling for all API calls
3. **Resource Cleanup**: Use appropriate endpoints to clean up resources
4. **Rate Limiting**: Respect rate limits and implement exponential backoff
5. **Authentication**: Keep API keys secure when using environment variables
6. **Validation**: Validate paths and parameters before sending requests
7. **Worktree Isolation**: Use the two-step create-then-update pattern to ensure Git worktree isolation is verified before starting execution. Do not rely on `POST /api/project/tasks/new` alone to materialize a worktree.
8. **Conservative Automation**: For external bridges, verify worktree status via `GET /api/project/worktree/status` before transitioning external state (e.g., moving a GitHub issue to `a2a/queued`). Fail closed if the worktree cannot be verified.

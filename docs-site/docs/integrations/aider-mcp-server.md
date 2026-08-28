---
title: AiderDesk as MCP Server
description: Learn how to use AiderDesk as a Model Context Protocol (MCP) server to integrate with other MCP-compatible clients.
---

AiderDesk can be used as a Model Context Protocol (MCP) server, allowing other MCP-compatible clients (like Claude Desktop, Cursor, etc.) to interact with AiderDesk's core functionalities.

## Configuration

The MCP server is available as an npm package: [`@aiderdesk/mcp-server`](https://www.npmjs.com/package/@aiderdesk/mcp-server). Add the following configuration to your MCP client settings:

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "npx",
      "args": ["-y", "@aiderdesk/mcp-server", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

Replace `/path/to/project` with the absolute path to your project directory.

If you prefer to install it globally instead of using `npx`:

```bash
npm install -g @aiderdesk/mcp-server
```

Then use this configuration:

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "aider-desk-mcp-server",
      "args": ["/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

## Arguments & Environment

- **Command Argument 1:** Project directory path (required).
- **`AIDER_DESK_API_BASE_URL`:** Base URL of the running AiderDesk API (default: `http://localhost:24337/api`).

## Available Tools via MCP

The server exposes these tools to MCP clients:

### Task Management

- `list_tasks`: List all tasks in the project, sorted by most recently updated. Supports `offset` and `limit` for pagination.
- `create_task`: Create a new task. Returns the task ID and name.
- `get_task`: Get detailed information about a task — message count, context files, todo items, working mode.

### Context Files

- `add_context_file`: Add a file to a task's context. Requires `taskId`.
- `drop_context_file`: Remove a file from a task's context. Requires `taskId`.
- `get_context_files`: List files currently in a task's context. Requires `taskId`.
- `get_addable_files`: List project files available to add to a task's context. Requires `taskId`.
- `get_updated_files`: List files that were changed during a task. Requires `taskId`.

### Conversation History

- `get_context_messages`: Get conversation messages for a task with pagination. Supports negative offset (e.g., `-1` for last message, `-5` for last 5). Requires `taskId`.

### Prompt Execution

- `run_prompt`: Execute a prompt within a task. Requires `taskId`. Mode can be `code`, `ask`, `architect`, `context`, or `agent`.
- `clear_context`: Clear the conversation context of a task. Requires `taskId`.

## Typical Workflow

1. **`list_tasks`** — discover existing tasks and their IDs.
2. **`create_task`** — create a new task if needed.
3. **`get_context_files`** — check what files are already in context.
4. **`add_context_file`** — add the files relevant to your task.
5. **`run_prompt`** — execute the coding task.
6. **`get_updated_files`** — review the changes made.

## Requirements

**Note:** AiderDesk must be running for its MCP server to be accessible.

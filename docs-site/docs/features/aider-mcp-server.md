---
title: AiderDesk as MCP Server
description: Learn how to use AiderDesk as a Model Context Protocol (MCP) server to integrate with other MCP-compatible clients.
---

AiderDesk includes a built-in MCP server, allowing other MCP-compatible clients (like Claude Desktop, Cursor, etc.) to interact with AiderDesk's core functionalities.

## Configuration

Add the following configuration to your MCP client settings, adjusting paths as needed.

### Windows

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["path-to-appdata/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `path-to-appdata` with the absolute path to your AppData directory. You can find this value by running `echo %APPDATA%` in your command prompt.

### macOS

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["/path/to/home/Library/Application Support/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `/path/to/home` with the absolute path to your home directory. You can find this value by running `echo $HOME` in your terminal.

### Linux

```json
{
  "mcpServers": {
    "aider-desk": {
      "command": "node",
      "args": ["/path/to/home/.config/aider-desk/mcp-server/aider-desk-mcp-server.js", "/path/to/project"],
      "env": {
        "AIDER_DESK_API_BASE_URL": "http://localhost:24337/api"
      }
    }
  }
}
```

**Note:** Replace `/path/to/home` with the absolute path to your home directory. You can find this value by running `echo $HOME` in your terminal.

## Arguments & Environment

- **Command Argument 1:** Project directory path (required).
- **`AIDER_DESK_API_BASE_URL`:** Base URL of the running AiderDesk API (default: `http://localhost:24337/api`).

## Available Tools via MCP

The built-in server exposes these tools to MCP clients:

- `add_context_file`: Add a file to AiderDesk's context.
- `drop_context_file`: Remove a file from AiderDesk's context.
- `get_context_files`: List files currently in AiderDesk's context.
- `get_addable_files`: List project files available to be added to the context.
- `run_prompt`: Execute a prompt within AiderDesk.
- `clear_context`: Clear the context of AiderDesk.

## Requirements

**Note:** AiderDesk must be running for its MCP server to be accessible.

# @aiderdesk/mcp-server

MCP server that exposes [AiderDesk](https://aiderdesk.hotovo.com)'s functionality to external MCP-compatible clients (like Claude Desktop, Cursor, etc.).

## Installation

```bash
npm install -g @aiderdesk/mcp-server
```

Or run directly without installing:

```bash
npx @aiderdesk/mcp-server /path/to/project
```

## Usage

Add the following configuration to your MCP client settings:

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

### Arguments

- **Command Argument 1** (required): Project directory path.

### Environment Variables

- `AIDER_DESK_API_BASE_URL` — Base URL of the running AiderDesk API (default: `http://localhost:24337/api`).

### Requirements

AiderDesk must be running for the MCP server to communicate with it.

## Available Tools

| Tool | Description |
|------|-------------|
| `add_context_file` | Add a file to AiderDesk's context. |
| `drop_context_file` | Remove a file from AiderDesk's context. |
| `get_context_files` | List files currently in AiderDesk's context. |
| `get_addable_files` | List project files available to be added to the context. |
| `run_prompt` | Execute a prompt within AiderDesk. |
| `clear_context` | Clear the context of AiderDesk. |

## Development

```bash
# Build
npm run build --workspace=packages/mcp-server

# Type check
npm run typecheck --workspace=packages/mcp-server
```

## License

MIT

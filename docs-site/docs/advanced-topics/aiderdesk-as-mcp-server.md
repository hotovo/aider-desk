# AiderDesk as an MCP Server

In addition to being an MCP client, AiderDesk also includes a built-in MCP server. This allows other MCP-compatible clients (such as Claude Desktop, Cursor, or custom scripts) to interact with AiderDesk's core functionalities.

This feature turns AiderDesk into a powerful hub for AI-driven development, allowing you to leverage its capabilities from other tools and workflows.

## Available Tools

The built-in MCP server exposes the following AiderDesk functionalities as tools:

-   `add_context_file`: Adds a file to the context of a specified project in AiderDesk.
-   `drop_context_file`: Removes a file from the context of a specified project.
-   `get_context_files`: Lists the files that are currently in the context of a project.
-   `get_addable_files`: Lists all the files in a project that can be added to the context.
-   `run_prompt`: Executes a prompt in a specified project within AiderDesk.

## Configuration

To use AiderDesk as an MCP server, you need to configure your MCP client to connect to it. The exact configuration will depend on your client, but it will typically involve specifying a command to start the AiderDesk MCP server.

Here are example configurations for different operating systems.

**Note:** AiderDesk must be running for its MCP server to be accessible.

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
*Replace `path-to-appdata` with the absolute path to your AppData directory (e.g., `C:\\Users\\YourUser\\AppData\\Roaming`).*

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
*Replace `/path/to/home` with the absolute path to your home directory.*

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
*Replace `/path/to/home` with the absolute path to your home directory.*

### Configuration Details

-   **`command`**: The command to start the MCP server. This should be `node`.
-   **`args`**: The arguments to the command. The first argument is the path to the AiderDesk MCP server script, and the second argument is the path to the project you want to work on.
-   **`env`**: Environment variables to be set for the server process. `AIDER_DESK_API_BASE_URL` should point to the AiderDesk REST API, which is typically running on `http://localhost:24337/api`.

By setting up this connection, you can orchestrate complex workflows where another AI agent (e.g., in Claude Desktop) can delegate coding tasks to AiderDesk, leveraging its specialized capabilities for software development.

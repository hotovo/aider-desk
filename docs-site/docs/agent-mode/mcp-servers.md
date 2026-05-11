---
title: "MCP Servers"
sidebar_label: "MCP Servers"
---

# MCP Servers

AiderDesk's Agent Mode can be extended with external tools through the **Model Context Protocol (MCP)**. By connecting to MCP servers, you can grant the agent new capabilities, such as web browsing, accessing documentation, or interacting with custom internal services.

## What is MCP?

The [Model Context Protocol](https://modelcontextprotocol.io/) is an open standard that allows AI models to safely and effectively use external tools. An MCP server exposes a set of tools that an AI agent can call to perform actions or retrieve information.

## Configuring MCP Servers

You can manage your MCP servers in **Settings > Agent**.

### Adding a New Server

1.  Navigate to the **Agent** tab in Settings.
2.  Find the **MCP Servers** section.
3.  Click the **Add** button.
4.  A form will appear where you can paste your server configuration.

### Configuration Format

The configuration is a JSON object that specifies how to run the MCP server. AiderDesk will start and manage the server process for you.

The configuration requires a `command` and an array of `args`. You can also provide environment variables in an `env` object.

For streamable http servers, you can also specify `url` and `headers`.

**Example: Adding a streamable http server**
```json
{
  "mcpServers": {
    "http-server": {
      "url": "http://localhost:8000/mcp",
      "headers": {
        "x-api-key": "super-secret-key"
      }
    }
  }
}
```

**Example: Adding a Puppeteer server for web browsing**
```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-puppeteer"
      ]
    }
  }
}
```

You can also paste a "bare" configuration without the `mcpServers` wrapper.

### Using Directory Placeholders in Configuration

You can use placeholders in your server's `args` or `env` configuration:

- `${projectDir}` - Replaced with the absolute path to the project's root directory
- `${taskDir}` - Replaced with the absolute path to the current task's working directory:
  - When using worktree mode: points to the worktree directory
  - When using local mode: points to the project root directory (same as `${projectDir}`)

**Example using projectDir:**
```json
{
  "mcpServers": {
    "my-custom-tool": {
      "command": "node",
      "args": [
        "/path/to/my/tool.js",
        "--project-root",
        "${projectDir}"
      ]
    }
  }
}
```

**Example using taskDir (works with both worktree and local modes):**
```json
{
  "mcpServers": {
    "file-operations": {
      "command": "node",
      "args": [
        "/path/to/file-tool.js",
        "--working-dir",
        "${taskDir}"
      ]
    }
  }
}
```

**Important:** The MCP server's working directory (`cwd`) is automatically set to `${taskDir}`, so tools that operate on files will work in the task's working directory by default. Use `${projectDir}` when you need to access the project root regardless of whether worktree mode is active.

## Enabling Servers and Tools in Agent Profiles

Once a server is configured globally, you must enable it within a specific **Agent Profile** to make its tools available to the agent.

1.  In the **Agent** settings tab, select the profile you wish to edit.
2.  In the **MCP Servers** section, you will see a list of all configured servers.
3.  Use the checkbox next to each server name to enable or disable it for the selected profile.
4.  You can further refine tool access by expanding a server's entry and setting the approval state for each individual tool (`Always`, `Never`, `Ask`).

## Authorization for Remote MCP Servers

AiderDesk's MCP client does not currently support OAuth authorization for remote MCP servers. If your server requires authorization (e.g., Sentry), you can use [mcp-remote](https://github.com/geelen/mcp-remote) as a workaround.

### Step 1: Authorize in Your Terminal

Run `mcp-remote` in your terminal and complete the authorization flow:

```bash
npx mcp-remote https://mcp.sentry.dev/mcp
```

### Step 2: Configure AiderDesk

Use `mcp-remote` as a stdio-based proxy in your MCP server configuration instead of connecting directly:

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.sentry.dev/mcp"
      ]
    }
  }
}
```

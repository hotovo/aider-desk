---
sidebar_position: 6
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

### Using Project Directory in Configuration

You can use the `${projectDir}` placeholder in your server's `args` or `env` configuration. AiderDesk will automatically replace this with the absolute path to the current project's root directory.

**Example:**
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

## Enabling Servers and Tools in Agent Profiles

Once a server is configured globally, you must enable it within a specific **Agent Profile** to make its tools available to the agent.

1.  In the **Agent** settings tab, select the profile you wish to edit.
2.  In the **MCP Servers** section, you will see a list of all configured servers.
3.  Use the checkbox next to each server name to enable or disable it for the selected profile.
4.  You can further refine tool access by expanding a server's entry and setting the approval state for each individual tool (`Always`, `Never`, `Ask`).

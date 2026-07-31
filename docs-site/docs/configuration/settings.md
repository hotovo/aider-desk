---
title: "Settings Overview"
sidebar_label: "Settings"
---

# Settings Overview

AiderDesk provides a centralized location to manage all your configurations. You can access it by clicking the gear icon in the top-right corner of the application.

The settings are organized into the following tabs:

### General

This tab contains settings related to the user interface and general application behavior.
- **Appearance**: Configure the application's language, zoom level, and theme (Dark/Light).
- **Start Up**: Choose what AiderDesk should do on launch: start with an empty task or load the last used task.
- **Notifications**: Enable or disable system notifications.
- **Prompt Behavior**: Customize autocompletion, command confirmation, and key bindings for the prompt field. See [Prompt Behavior](./prompt-behavior.md) for more details.

### Providers

Manage the API keys and connection settings for all supported Large Language Model (LLM) providers, such as OpenAI, Anthropic, Gemini, and more. This is where you connect AiderDesk to your AI models.

### Aider

Configure the underlying `aider-chat` engine.
- **Options**: Pass command-line arguments directly to Aider.
- **Environment Variables**: Set environment variables for the Aider process.
- **Context**: Control automatic inclusion of rule files.
For more details, see [Aider Configuration](./aider-configuration.md).

### Agent

Configure the powerful Agent Mode.
- **Agent Profiles**: Create and manage different profiles for the agent, each with its own model, tools, and behaviors.
- **MCP Servers**: Add and manage external tools via MCP servers.
- **Tool Approvals**: Set permissions for each tool on a per-profile basis.
See [Agent Mode](../agent-mode/agent-mode.md) and [MCP Servers](../agent-mode/mcp-servers.md) for more information.

### Memory

Configure the built-in long-term Memory system.
- **Enable/disable Memory**
- **Embedding model selection** and similarity tuning
- **View and delete stored memories**
See [Memory](../features/memory.md) for details.

### Network

Configure the built-in web server and network connectivity.
- **Server**: Start/stop the HTTP server that powers the [REST API](../features/rest-api.md), [Browser API](../features/browser-api.md), and remote access. When the server is running, it is accessible on port `24337` (configurable via `AIDER_DESK_PORT`).
- **Basic Auth**: Protect the server with a username and password.
- **Readonly View Mode**: Toggle [Readonly View Mode](../features/readonly-view.md) to expose a server-enforced, read-only browser UI. A nested option controls whether extension UI components render in the readonly view.
- **CORS**: Restrict which origins can access the server.
- **Cloudflare Tunnel**: Expose the server securely to the internet via a Cloudflare Tunnel without port forwarding.
- **Proxy**: Configure HTTP/HTTPS proxy settings for outbound requests.

### About

View version information for AiderDesk and the integrated Aider library.
- **Check for Updates**: Manually trigger an update check.
- **Automatic Updates**: Enable or disable automatic downloading of AiderDesk updates.
- **Logs**: Open the directory containing application logs for troubleshooting.
See [Automatic Updates](./automatic-updates.md) for more details.

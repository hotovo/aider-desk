---
title: "Agent Client Protocol (ACP)"
sidebar_label: "ACP"
slug: "/advanced/acp"
---

# Agent Client Protocol (ACP)

AiderDesk supports the [Agent Client Protocol (ACP)](https://agentclientprotocol.com), a standardized protocol for communication between code editors/IDEs and AI coding agents. This means you can use AiderDesk as an AI agent inside any ACP-compatible editor or client — such as [Zed](https://zed.dev), [JetBrains AI Assistant](https://www.jetbrains.com/help/ai-assistant/acp.html), [VS Code](https://github.com/formulahendry/vscode-acp), [neovim](https://github.com/olimorris/codecompanion.nvim), and [many others](https://agentclientprotocol.com/get-started/clients).

ACP is similar to the [Language Server Protocol (LSP)](https://microsoft.github.io/language-server-protocol/), but for AI coding agents. Instead of each editor building a custom integration for every agent, ACP provides a single standard. Any ACP-compatible editor can use any ACP-compatible agent.

## How It Works

AiderDesk's ACP server is a thin stdio bridge that connects an ACP client (your editor) to a running AiderDesk instance. When your editor launches the ACP agent, AiderDesk receives prompts over JSON-RPC, processes them through its existing task system (via the [REST API](../features/rest-api.md)), and streams back responses, tool calls, diffs, and reasoning in real time.

```
┌─────────┐     JSON-RPC (stdio)      ┌──────────────┐     HTTP/SSE      ┌─────────────────┐
│  Editor  │ ◄──────────────────────► │  aiderdesk   │ ◄───────────────► │  AiderDesk Server │
│ (ACP     │                          │  acp (CLI)   │                   │  (Electron /      │
│  Client) │                          │              │                   │   Docker / npm)   │
└─────────┘                          └──────────────┘                   └─────────────────┘
```

The `aiderdesk acp` command does **not** start a server — it connects to an already-running AiderDesk instance and bridges ACP protocol messages to its REST API.

## Prerequisites

:::info A running AiderDesk instance is required
The ACP bridge connects to a running AiderDesk server. It does not start one. Make sure AiderDesk is running in one of the following ways:
:::

### 1. Electron Desktop App

If you have the desktop app installed and running, the ACP bridge will connect to it on the default port (`24337`).

### 2. Docker

Run AiderDesk in headless mode via Docker. See the [Docker guide](./docker.md) for full setup instructions.

```bash
docker run -d \
  --name aiderdesk \
  -p 24337:24337 \
  -v ~/aiderdesk-data:/app/data \
  -v ~/.aider-desk:/root/.aider-desk \
  -v ~/projects:/projects \
  ghcr.io/hotovo/aider-desk:latest
```

### 3. npm CLI

Install and run AiderDesk as a global npm package. See the [npm CLI guide](./npm-cli.md) for details.

```bash
npm install -g @aiderdesk/aiderdesk
aiderdesk start
```

### Verifying AiderDesk is Running

Before configuring your editor, verify AiderDesk is reachable:

```bash
curl http://localhost:24337/api/health
# Expected: {"status":"ok"}
```

## Installation

The ACP bridge is included in the `aiderdesk` CLI, which is part of the [`@aiderdesk/aiderdesk`](https://www.npmjs.com/package/@aiderdesk/aiderdesk) npm package.

```bash
npm install -g @aiderdesk/aiderdesk
```

You can verify the ACP command is available:

```bash
aiderdesk acp --help
```

## Usage

```bash
aiderdesk acp [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | AiderDesk server port (default: `24337`, env: `AIDER_DESK_PORT`) |
| `--host <host>` | AiderDesk server host (default: `localhost`) |

The command communicates over stdio using JSON-RPC with newline-delimited JSON (NDJSON), as defined by the ACP specification. You normally don't run this command directly — your editor launches it as a subprocess.

### Port Configuration

The port can be configured in three ways (highest priority first):

1. **CLI flag**: `aiderdesk acp --port 8080`
2. **Environment variable**: `AIDER_DESK_PORT=8080 aiderdesk acp`
3. **Default**: `24337`

## Configuring ACP Clients

To use AiderDesk as an ACP agent, register it in your editor's ACP/agent server configuration. The configuration tells the editor what command to run to start the agent.

### Zed

Add AiderDesk to your Zed [`agent_servers` configuration](https://zed.dev/docs/ai/external-agents) (`~/.config/zed/settings.json`):

```json
{
  "agent_servers": {
    "AiderDesk": {
      "command": "npx",
      "args": ["@aiderdesk/aiderdesk", "acp"]
    }
  }
}
```

If you installed AiderDesk globally, you can use the `aiderdesk` command directly:

```json
{
  "agent_servers": {
    "AiderDesk": {
      "command": "aiderdesk",
      "args": ["acp"]
    }
  }
}
```

To connect to a non-default port, pass `--port`:

```json
{
  "agent_servers": {
    "AiderDesk": {
      "command": "aiderdesk",
      "args": ["acp", "--port", "8080"]
    }
  }
}
```

### JetBrains IDEs

JetBrains IDEs (IntelliJ IDEA, WebStorm, PyCharm, GoLand, etc.) support ACP via [AI Assistant](https://www.jetbrains.com/help/ai-assistant/acp.html). Configure AiderDesk as a custom agent server in JetBrains settings under **Settings → Tools → AI Assistant → Custom Agent Servers**:

- **Name**: AiderDesk
- **Command**: `aiderdesk acp` (or `npx @aiderdesk/aiderdesk acp`)

### Visual Studio Code

Install an ACP extension such as [ACP Client](https://github.com/formulahendry/vscode-acp) or [ACP Pro](https://marketplace.visualstudio.com/items?itemName=duclvz.acp-pro), then configure AiderDesk as an agent server:

```json
{
  "acp.servers": {
    "AiderDesk": {
      "command": "aiderdesk",
      "args": ["acp"]
    }
  }
}
```

### neovim

Using [CodeCompanion](https://github.com/olimorris/codecompanion.nvim):

```lua
require("codecompanion").setup({
  adapters = {
    aiderdesk = function()
      return require("codecompanion.definitions.adapter")
        :new({
          name = "aiderdesk",
          scheme = "acp",
          cmd = "aiderdesk",
          args = { "acp" },
          env = {},
        })
    end,
  },
})
```

### Generic Configuration

For any ACP-compatible client, the agent server definition follows this pattern:

| Field | Value |
|-------|-------|
| **Name** | `AiderDesk` |
| **Command** | `aiderdesk` (or `npx @aiderdesk/aiderdesk`) |
| **Args** | `["acp"]` |
| **Working directory** | Your project directory |
| **Port override** | Add `--port <port>` to args |
| **Host override** | Add `--host <host>` to args |

See the full list of [ACP-compatible clients](https://agentclientprotocol.com/get-started/clients) for more configuration options.

## Session Configuration

When you start a new ACP session, AiderDesk exposes several configurable options that the client may present as dropdowns or selectors. You can set these before or during a session.

### Chat Mode

Selects the [chat mode](../features/chat-modes.md) for the session:

| Mode | Description |
|------|-------------|
| **Agent** | Agent mode with full tool access |
| **Code** | Code mode using Aider for edits |
| **Ask** | Ask questions without making changes |
| **Architect** | Design and plan without implementation |
| **Context** | Add context files to the conversation |

Custom modes defined per-project are also included if available.

### Agent Profile

Selects the [agent profile](../agent-mode/agent-profiles.md) to use. This option is only visible when the selected chat mode is **Agent** (i.e., not one of the Aider modes: Code, Ask, Architect, Context). The list is fetched from your configured agent profiles, or defaults to the project's default profile.

### Autonomy

Controls how much human oversight the agent has:

| Mode | Description |
|------|-------------|
| **Manual** | Requires approval for every tool call and plan |
| **Guided** | Auto-approves tool calls, waits for plan approval |
| **Autonomous** | Runs without interruption |

## What You Get

When using AiderDesk through ACP, your editor receives rich, structured updates:

- **Agent message streaming** — Responses stream in real time as the agent works
- **Agent reasoning** — Thinking/reasoning steps are displayed as they occur
- **Tool calls** — File reads, edits, searches, bash commands, and more are shown with their inputs and outputs
- **Diffs** — File edits and writes are rendered as diffs that the editor can display natively
- **Terminal output** — Bash command results are surfaced as terminal content
- **Usage and cost** — Token usage and cost information is reported after each response
- **Session info** — Task names and metadata are synced with the editor
- **Cancellation** — You can cancel in-progress prompts; the editor will notify AiderDesk to interrupt the task

## Troubleshooting

### "AiderDesk server is not running" error

The ACP bridge connects to a running AiderDesk server. Make sure it's started:

- **Desktop app**: Launch the AiderDesk application
- **Docker**: `docker start aiderdesk` (or `docker run ...` — see [Docker guide](./docker.md))
- **npm CLI**: Run `aiderdesk start` (see [npm CLI guide](./npm-cli.md))

Verify the server is healthy:

```bash
curl http://localhost:24337/api/health
```

### Wrong port

If AiderDesk is running on a non-default port, pass `--port` to the ACP command:

```json
{
  "command": "aiderdesk",
  "args": ["acp", "--port", "8080"]
}
```

Or set the `AIDER_DESK_PORT` environment variable in the agent server config:

```json
{
  "command": "aiderdesk",
  "args": ["acp"],
  "env": { "AIDER_DESK_PORT": "8080" }
}
```

### Remote AiderDesk instance

If your AiderDesk server is running on a different host, use the `--host` flag:

```json
{
  "command": "aiderdesk",
  "args": ["acp", "--host", "192.168.1.100"]
}
```

### Sessions not persisting

ACP sessions map to AiderDesk tasks. Each new ACP session creates a new task. To resume a conversation, use your editor's session management features — AiderDesk will reuse the existing task if the session continues.

## Learn More

- [Agent Client Protocol](https://agentclientprotocol.com) — Official protocol documentation
- [ACP Clients](https://agentclientprotocol.com/get-started/clients) — Full list of compatible editors and tools
- [Chat Modes](../features/chat-modes.md) — Learn about AiderDesk's chat modes
- [Agent Profiles](../agent-mode/agent-profiles.md) — Configure agent behavior and tool access
- [REST API](../features/rest-api.md) — The underlying API that the ACP bridge uses
- [npm CLI](./npm-cli.md) — Running AiderDesk via npm
- [Docker](./docker.md) — Running AiderDesk in Docker

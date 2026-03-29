---
title: "Running AiderDesk via npm (CLI)"
sidebar_label: "npm CLI"
slug: "/advanced/npm-cli"
---

# Running AiderDesk via npm (CLI)

AiderDesk can be installed and run as a global npm package. This runs **only the AiderDesk backend service** — there is no Electron desktop window. Instead, you access AiderDesk through your web browser, similar to [running with Docker](/docs/advanced/docker).

This is useful when you:
- Prefer a lightweight setup without the desktop app
- Want to run AiderDesk on a remote server
- Need to integrate AiderDesk into scripts or CI/CD pipelines
- Don't want to download a platform-specific installer

## Installation

Install globally with npm:

```bash
npm install -g @aiderdesk/aiderdesk
```

Alternatively, run it directly without installing:

```bash
npx @aiderdesk/aiderdesk
```

During installation, the postinstall script automatically downloads the required `uv` Python package manager and `probe` binary for your platform.

## Running

### Interactive TUI (Default)

```bash
aiderdesk
```

This opens an interactive terminal UI where you can:
- **Start/Stop** the service with `s`
- **Change port** with `p`
- **Scroll logs** with arrow keys or Page Up/Down
- **Exit** with `q` or `Ctrl+C`

### Headless Foreground

```bash
aiderdesk start
```

Runs the service in the foreground with logs printed to stdout. This is ideal for:
- Docker containers
- systemd services
- CI/CD environments
- Any environment where you need process output in the terminal

### Options

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Set the port to listen on (default: `24337`) |
| `-h, --help` | Show help message |
| `-v, --version` | Show version number |

### Port Configuration

The port can be configured in three ways (highest priority first):

1. **CLI flag**: `aiderdesk start --port 8080`
2. **Environment variable**: `AIDER_DESK_PORT=8080 aiderdesk start`
3. **Default**: `24337`

## Accessing the UI

Once the service is running, open your browser and navigate to:

```
http://localhost:<port>
```

The default address is `http://localhost:24337`.

From the browser, you get the full AiderDesk experience — project management, chat, context files, agent mode, and all other features work the same way as in the desktop app.

## Requirements

- **Node.js** 20 or later
- **Python** 3.8+ (automatically managed via the bundled `uv` package manager)

## Differences from the Desktop App

| Feature | Desktop App | npm CLI |
|---------|-------------|---------|
| Electron window | ✅ | ❌ |
| Browser-based UI | ✅ (via Docker) | ✅ |
| System tray integration | ✅ | ❌ |
| Native notifications | ✅ | ❌ |
| Auto-updates | ✅ | Update via `npm update -g @aiderdesk/aiderdesk` |
| Agent Mode | ✅ | ✅ |
| All AI features | ✅ | ✅ |
| REST API | ✅ | ✅ |
| MCP Server | ✅ | ✅ |

## Updating

To update to the latest version:

```bash
npm update -g @aiderdesk/aiderdesk
```

## Next Steps

- [Open a project](/docs/getting-started/projects) to start coding
- [Configure providers](/docs/configuration/providers) to connect your AI models
- [Explore Agent Mode](../agent-mode/agent-mode.md) for autonomous AI assistance

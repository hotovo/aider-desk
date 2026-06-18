# @aiderdesk/aiderdesk

Run AiderDesk as a headless backend service accessible through your browser. This package provides a lightweight alternative to the desktop application — similar to running AiderDesk with Docker.

After starting, the AiderDesk web UI is available at `http://localhost:24337`.

## Installation

```bash
npm install -g @aiderdesk/aiderdesk
```

Alternatively, run it directly without installing:

```bash
npx @aiderdesk/aiderdesk
```

The postinstall script automatically downloads the required `uv` Python package manager and `probe` binary for your platform.

## Usage

### Interactive TUI (default)

```bash
aiderdesk
# or
aiderdesk tui
```

Opens an interactive terminal UI where you can start/stop the service, configure the port, and view logs.

**Keyboard shortcuts:**

| Key | Action |
|-----|--------|
| `s` | Start / Stop the service |
| `p` | Change port |
| `q` | Exit |
| `↑` / `↓` | Scroll logs |
| `PgUp` / `PgDn` | Scroll logs by half page |
| `Ctrl+C` | Exit |

### Headless Foreground

```bash
aiderdesk start
```

Runs the service in the foreground with logs printed to stdout. Useful for Docker containers, systemd services, or CI environments.

### Run a Prompt

```bash
aiderdesk run "What does this project do?"
```

Connects to a running AiderDesk server, sends the prompt, streams the AI response to your terminal, and exits when done. Uses the current working directory as the project (auto-creates it if needed).

Stdin piping is supported:

```bash
cat README.md | aiderdesk run "Summarize this file"
git diff | aiderdesk run "Review these changes"
```

**Options:**

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Server port (default: `24337`, env: `AIDER_DESK_PORT`) |
| `--host <host>` | Server hostname (default: `localhost`) |
| `-f, --format <format>` | Output format: `text` (default) or `json` (JSONL) |
| `-q, --quiet` | Suppress progress indicators and tool call output |
| `-m, --model <provider/model>` | Override the model (e.g. `openai/gpt-4o-mini`) |
| `-a, --agent-profile <id>` | Use a specific agent profile by ID or name |
| `--task-id <id>` | Run on an existing task (for multi-turn conversations) |

**Output formats:**

- `text` (default) — Streams the answer to stdout. Tool calls are shown as compact indicators (`⚙ tool_name(args)` / `✓ tool_name`) on stderr. Use `-q` to show only the answer.
- `json` — One JSON object per line for each event with `{type, taskId, projectDir, data}` structure. Useful for scripting and automation.
- `json -q` — Outputs only the final `response-completed` event as a single JSON line with content, usage stats, and metadata.

**Multi-turn conversations:**

```bash
# First prompt — creates a new task
aiderdesk run -q -f json "Remember the word BANANA. Say OK."
# {"type":"response-completed","taskId":"a1b2c3d4","projectDir":"...","data":{"content":"OK.",...}}

# Second prompt — resumes the same task
aiderdesk run --task-id "a1b2c3d4" -q "What word did I ask you to remember?"
# BANANA
```

:::info
The `run` command requires a running AiderDesk server. If the server is not reachable, it will print an error and exit with code 1.
:::

### Options

```
-p, --port <port>   Set the port to listen on (default: 24337, env: AIDER_DESK_PORT)
-h, --help          Show help message
-v, --version       Show version number
```

### Port Configuration

You can set the port in three ways (highest priority first):

1. CLI flag: `aiderdesk start --port 8080`
2. Environment variable: `AIDER_DESK_PORT=8080`
3. Default: `24337`

## Accessing the UI

Once running, open your browser and navigate to:

```
http://localhost:24337
```

From there you can use AiderDesk the same way as the desktop application.

## Requirements

- **Node.js** 20 or later
- **Python** 3.8+ (automatically managed via `uv`)

## Differences from the Desktop App

This package runs only the AiderDesk backend service. It does **not** include the Electron desktop shell. The experience is identical to running AiderDesk in a browser (e.g., via Docker). Features like system tray integration and native desktop notifications are not available.

## Links

- [Documentation](https://aiderdesk.hotovo.com/docs)
- [GitHub](https://github.com/hotovo/aider-desk)
- [Docker Guide](https://aiderdesk.hotovo.com/docs/advanced/docker)
- [Discord](https://discord.com/invite/dyM3G9nTe4)

## License

MIT

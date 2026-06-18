---
title: "CLI Run Command"
sidebar_label: "CLI Run"
slug: "/advanced/cli-run"
---

# CLI Run Command

The `aiderdesk run` command lets you execute prompts non-interactively from the terminal. It connects to a running AiderDesk server, streams the AI response in real-time, and exits when the task completes. This is ideal for scripting, automation, and quickly getting answers without opening the UI.

:::info Prerequisite
AiderDesk must already be running (via the desktop app, `aiderdesk start`, or `aiderdesk tui`). The `run` command does not start a server — it connects to an existing one.
:::

## Basic Usage

```bash
aiderdesk run "What does this project do?"
```

You can also pipe content via stdin:

```bash
cat README.md | aiderdesk run "Summarize this file"
echo "The secret is 42" | aiderdesk run "What is the secret from stdin?"
```

When stdin is piped, the content is appended to the prompt.

## How It Works

1. **Health check** — Verifies the AiderDesk server is reachable at the configured host/port
2. **Project setup** — Uses the current working directory as the project. If the project doesn't exist yet, it's automatically created
3. **Task creation** — A new task is created for each `run` invocation (unless `--task-id` is provided)
4. **Prompt execution** — The prompt is sent to the AI agent and the response is streamed back in real-time
5. **Exit** — The process exits with code `0` on success, `1` on failure

## Options

| Option | Description |
|--------|-------------|
| `-p, --port <port>` | Server port (default: `24337`, env: `AIDER_DESK_PORT`) |
| `--host <host>` | Server hostname (default: `localhost`) |
| `-f, --format <format>` | Output format: `text` (default) or `json` |
| `-q, --quiet` | Suppress progress indicators and tool call output |
| `-m, --model <provider/model>` | Override the model to use (e.g. `openai/gpt-4o-mini`) |
| `-a, --agent-profile <id>` | Use a specific agent profile by ID or name |
| `--task-id <id>` | Run the prompt on an existing task instead of creating a new one |

## Output Formats

### Text (default)

Streams the AI response to stdout with tool call indicators on stderr:

```bash
aiderdesk run "Read package.json and tell me the version"
```

Output:
```
Running prompt in /path/to/project
  ⚙ file_read(filePath=package.json)
  ✓ file_read
1.0.0
```

- **Answer text** → stdout
- **Tool indicators** (`⚙` start / `✓` complete) → stderr
- **Errors** → stderr (red)

### Text + Quiet (`-q`)

Suppresses everything except the answer text on stdout:

```bash
aiderdesk run -q "What is 2+2?"
```

Output:
```
4
```

Ideal for piping into other commands:

```bash
aiderdesk run -q "What is the version in package.json?" | xargs echo "Version:"
# Version: 1.0.0
```

### JSON (`-f json`)

Outputs one JSON object per line (JSONL) for each event — useful for programmatic consumption:

```bash
aiderdesk run -f json "Read package.json and tell me the version"
```

Output:
```json
{"type":"user-message","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"user-message","messageId":"...","content":"Read package.json...","timestamp":1781729359277}}
{"type":"log","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"log","level":"loading","timestamp":1781729359278}}
{"type":"tool-start","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"tool","id":"call_...","toolName":"file_read","serverName":"aider","input":{"filePath":"package.json"},"finished":false,"timestamp":1781729359300}}
{"type":"tool-end","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"tool","id":"call_...","toolName":"file_read","serverName":"aider","input":{"filePath":"package.json"},"output":"...","finished":true,"timestamp":1781729359310}}
{"type":"response-chunk","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"response-chunk","chunk":"1.0.0","reasoning":"","timestamp":1781729359320}}
{"type":"response-completed","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"response-completed","messageId":"...","content":"1.0.0","usageReport":{"model":"openai/gpt-4o-mini","sentTokens":7290,"receivedTokens":34,"cacheReadTokens":0,"messageCost":0.0011139,"agentTotalCost":0.0011139},"promptContext":{"id":"..."},"timestamp":1781729359350}}
```

Each line has the following top-level structure:

```typescript
{
  type: string;        // Event type (see below)
  taskId: string;       // The task ID
  projectDir: string;   // The project directory
  data: {              // Message-specific fields
    type: string;       // Event type (mirrors top-level type)
    timestamp: number;  // Unix timestamp in milliseconds
    content?: string;   // (user-message, response-completed)
    chunk?: string;      // (response-chunk)
    reasoning?: string; // (response-chunk)
    toolName?: string;  // (tool-start, tool-end)
    input?: unknown;    // (tool-start, tool-end)
    output?: unknown;   // (tool-end)
    finished?: boolean;  // (tool-start, tool-end)
    usageReport?: object; // (response-completed)
    level?: string;     // (log)
    // ... and other fields
  }
}
```

Event types:
- `user-message` — The prompt was received
- `response-chunk` — Partial response (has `chunk` for text, `reasoning` for thinking)
- `response-completed` — Final response with full content and usage stats
- `tool-start` / `tool-end` — Tool execution lifecycle
- `log` — Log messages
- `task-updated` — Task state changes

### JSON + Quiet (`-q -f json`)

Outputs only a single JSON line — the final `response-completed` event with the full response and usage metadata. No streaming chunks, tool events, or logs:

```bash
aiderdesk run -q -f json "What is 2+2?"
```

Output:
```json
{"type":"response-completed","taskId":"a1b2c3d4","projectDir":"/path/to/project","data":{"type":"response-completed","messageId":"...","content":"4","usageReport":{"model":"openai/gpt-4o-mini","sentTokens":7290,"receivedTokens":3,"cacheReadTokens":0,"messageCost":0.0011139,"agentTotalCost":0.0011139},"promptContext":{"id":"..."},"timestamp":1781729359350}}
```

Ideal for programmatic use where you only need the final result:

```bash
aiderdesk run -q -f json "What is the version in package.json?" | jq -r '.data.content'
# 1.0.0
```

## Model Selection

Use `--model` (`-m`) to override the model for this prompt. The format is `provider/model`:

```bash
aiderdesk run -m "openai/gpt-4o-mini" "Explain closures"
aiderdesk run -m "anthropic/claude-sonnet-4-20250514" "Write a test for src/main.ts"
```

When omitted, the project's default model is used.

## Agent Profile Selection

Use `--agent-profile` (`-a`) to run the prompt with a specific agent profile. Accepts either the profile ID or name:

```bash
aiderdesk run -a "code-reviewer" "Review the latest changes"
aiderdesk run -a "dae6b64c-db1a-4e2e-8e93-17bf0d8efef8" "Review the latest changes"
```

When omitted, the project's default agent profile is used.

## Resuming Tasks

Use `--task-id` to run the prompt on an existing task instead of creating a new one. This allows multi-turn conversations from the CLI:

```bash
# First prompt — creates a new task
aiderdesk run -q -f json "Remember the word BANANA. Say OK."
# {"type":"response-completed","taskId":"a1b2c3d4","projectDir":"...","data":{"content":"OK.",...}}

# Second prompt — resumes the same task
aiderdesk run --task-id "a1b2c3d4" -q "What word did I ask you to remember?"
# BANANA
```

When resuming a task:
- The task's existing context (conversation history, files, etc.) is preserved
- The task's autonomy mode is kept as-is (not overridden)
- When creating a new task (no `--task-id`), the autonomy mode is set to `Auto` by default

## Host & Port Configuration

By default, the command connects to `localhost:24337`. You can override this:

```bash
# Via CLI flags
aiderdesk run -p 8080 --host 192.168.1.100 "Fix the tests"

# Via environment variable for port
AIDER_DESK_PORT=8080 aiderdesk run "Fix the tests"
```

## Stdin Piping

When stdin is not a TTY (i.e., piped input), the content is read and appended to the prompt:

```bash
# Pipe a file for review
cat src/main.ts | aiderdesk run "Review this code for bugs"

# Chain with other commands
git diff | aiderdesk run "Summarize these changes"
```

The stdin content is separated from the prompt text and included in the AI's context.

## Error Handling

If the AiderDesk server is not running:

```bash
aiderdesk run -p 99999 "test"
# Error: AiderDesk server is not running on localhost:99999. Start it first with 'aiderdesk' or 'aiderdesk start'.
```

The process exits with code `1` on any error (server unreachable, API failure, etc.).

## Use Cases

- **Quick questions** from the terminal without switching to the browser
- **Scripting** AI tasks in shell scripts or CI pipelines
- **Piped input** processing (`git diff | aiderdesk run "..."`)
- **JSON output** for integration with other tools (`-f json -q | jq ...`)
- **Multi-turn conversations** via `--task-id`
- **Automated code review** or analysis workflows
- **Model-specific tasks** with `-m provider/model`

## Differences from Interactive Mode

| Feature | `aiderdesk run` | Desktop / Browser UI |
|---------|-----------------|---------------------|
| Interactive chat | ❌ Single prompt per invocation | ✅ Multi-turn |
| Session continuation | ✅ Via `--task-id` | ✅ Built-in |
| Streaming output | ✅ Real-time | ✅ Real-time |
| Tool call visibility | ✅ Compact indicators | ✅ Full UI |
| Ask questions (user input) | ❌ | ✅ |
| Model selection | ✅ `-m provider/model` | ✅ |
| Agent profile selection | ✅ `-a <id\|name>` | ✅ |
| Autonomy mode | Auto by default | Configurable |

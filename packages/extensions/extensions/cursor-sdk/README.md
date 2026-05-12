# Cursor SDK Extension for AiderDesk

Adds a `cursor/` provider that runs [Cursor SDK](https://www.npmjs.com/package/@cursor/sdk) agents directly from within AiderDesk, fully overriding the internal agent loop for `cursor/*` models.

This is useful if you want to use AiderDesk as a UI for running Cursor agents — giving you better visibility into what the agent is doing, including streamed reasoning, tool calls, and file edits, all within AiderDesk's task-based interface.

## How It Works

When a `cursor/` model is selected, the extension intercepts the agent lifecycle using two blocking hooks:

1. **`onAgentStarted`** — Detects `cursor/` provider, creates a Cursor SDK agent via `Agent.create()` (or resumes an existing one), sends the prompt with `agent.send()`, and processes the streaming response via `run.stream()`. Returns `{ blocked: true }` so AiderDesk skips its own agent loop entirely.

2. **`onInterrupted`** — When the user clicks Stop, resolves an internal abort promise that cancels the in-flight Cursor run. Returns `{ blocked: true }` to skip default cleanup.

Streaming events from the Cursor SDK are mapped to AiderDesk's message system through `TaskContext` methods:

| Cursor SDK Event | AiderDesk Action |
|---|---|
| `thinking` | Streamed as reasoning blocks via `taskContext.addResponseMessage()` |
| `assistant` (text) | Streamed as assistant text via `taskContext.addResponseMessage()` |
| `assistant` (tool_use) | Displayed via `taskContext.addToolMessage()` |
| `tool_call` | Mapped to AiderDesk power tools and shown via `taskContext.addToolMessage()` |

### Tool Mapping

Cursor SDK tools are translated to AiderDesk's built-in power tools where possible:

| Cursor Tool | AiderDesk Tool |
|---|---|
| `shell` | `power---bash` |
| `read` | `power---file_read` |
| `write` | `power---file_write` |
| `edit` | `power---file_edit` (with unified diff → search/replace conversion) |
| `glob` | `power---glob` |
| `grep` | `power---grep` |

## Setup

1. Set the `CURSOR_API_KEY` environment variable, or configure it in the extension settings (click the gear icon on the extension card).
2. Select a `cursor/` model in AiderDesk's model selector (e.g., `cursor/composer-2`).
3. Send a prompt — the extension takes over automatically.

## Supported Models

Models are loaded dynamically from `Cursor.models.list()` at runtime. Available models depend on your Cursor API key and account. Example models include:

- `cursor/composer-2`

## Configuration

The extension supports a JSON configuration file (`config.json`) with the following options:

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | `""` | Cursor API key (falls back to `CURSOR_API_KEY` env var) |

Configuration can also be managed through the extension's settings UI.

## Cancellation

When the user interrupts a running Cursor agent:

1. AiderDesk fires `onInterrupted`
2. The extension calls `run.cancel()` on the active Cursor SDK run (if supported)
3. The stream drains naturally until it ends with a terminal `status: "cancelled"` event
4. `{ blocked: true }` is returned to prevent AiderDesk's default interrupt handling
5. The agent ID is cleared from task metadata so the next prompt starts a fresh agent

## Limitations / Known Gaps

- **No connector message forwarding** — Messages produced by the extension are sent directly to the UI via `TaskContext`. External API clients (REST API, MCP) will not see these messages.
- **Limited abort integration** — Cancellation relies on `run.cancel()`. If the run does not support cancellation (e.g., detached/replayed run handles), the stream will still drain naturally until it ends.
- **Edit tool diff parsing** — The `edit` tool results are parsed from unified diffs into search/replace pairs. Complex edits (creates, deletes, renames) may not be accurately represented.
- **Agent resumption** — If the extension is unloaded or AiderDesk restarts mid-run, the agent ID stored in task metadata may reference a stale agent that cannot be resumed.

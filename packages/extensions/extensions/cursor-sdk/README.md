# Cursor SDK Extension for AiderDesk

Adds a `cursor-sdk/` provider that runs [Cursor SDK](https://www.npmjs.com/package/@cursor/sdk) agents directly from within AiderDesk, fully overriding the internal agent loop for `cursor-sdk/*` models.

This is useful if you want to use AiderDesk as a UI for running Cursor agents — giving you better visibility into what the agent is doing, including streamed reasoning, tool calls, and file edits, all within AiderDesk's task-based interface.

> **Note:** AiderDesk also has a [cursor extension](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/cursor) which is preferred if you want AiderDesk to have full control over tool execution, approval, and MCP integration. However, this `cursor-sdk` extension is more stable as it uses the official `@cursor/sdk` package, while the `cursor` extension depends on Cursor's internal API which may break at any time.

## How It Works

When a `cursor-sdk/` model is selected, the extension intercepts the agent lifecycle using two blocking hooks:

1. **`onAgentStarted`** — Detects `cursor-sdk/` provider, creates a Cursor SDK agent via `Agent.create()` (or resumes an existing one), sends the prompt with `agent.send()`, and processes the streaming response via `run.stream()`. Returns `{ blocked: true }` so AiderDesk skips its own agent loop entirely.

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
2. Select a `cursor-sdk/` model in AiderDesk's model selector (e.g., `cursor-sdk/composer-2`).
3. Send a prompt — the extension takes over automatically.

## Supported Models

Models are loaded dynamically from `Cursor.models.list()` at runtime. Available models depend on your Cursor API key and account. Parameterized variants are shown with readable aliases based on their effort and context, such as `cursor-sdk/claude-fable-5-high[1m]`. The `[1m]` suffix appears only for variants with 1M context.

Variants with an effort setting are listed only when Cursor enables thinking for them. The extension retains the exact Cursor parameter set internally when the selected alias is executed.

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
5. The agent ID is retained so the next prompt resumes the same conversation

## SDK version and shell workspace

The extension uses `@cursor/sdk@1.0.37` without bundle patches. Shell executors are scoped to a conversation and initialized with the task workspace; changes to the shell working directory persist within that conversation. Calls without a conversation ID still use the base executor, so live parent/subagent CWD verification is recommended after SDK updates.

Only one run per task is accepted, including during agent setup. Interruptions during setup prevent sending a prompt, and runs arriving after an interrupt are cancelled. Callback processing is serialized and drained before final persistence. SDK terminal errors are reported without automatic retries. Raw event payloads and conversation text are not included in diagnostic logs.

## Limitations / Known Gaps

- **No tool approval control** — Tool execution happens inside Cursor's CLI subprocess and cannot be intercepted or approved by AiderDesk. Use the [cursor extension](https://github.com/hotovo/aider-desk/tree/main/packages/extensions/extensions/cursor) if you need tool approval.
- **No connector message forwarding** — Messages produced by the extension are sent directly to the UI via `TaskContext`. External API clients (REST API, MCP) will not see these messages.
- **Limited abort integration** — Cancellation relies on `run.cancel()`. If the run does not support cancellation (e.g., detached/replayed run handles), the stream will still drain naturally until it ends.
- **Edit tool diff parsing** — The `edit` tool results are parsed from unified diffs into search/replace pairs. Complex edits (creates, deletes, renames) may not be accurately represented.
- **Agent resumption** — If the extension is unloaded or AiderDesk restarts mid-run, the agent ID stored in task metadata may reference a stale agent that cannot be resumed.

## Repairing historical context ordering

Older versions could save tool results before the assistant messages containing their calls. The repair utility scans `.aider-desk/tasks/*/context.json` and reports eligible files without modifying them by default:

```bash
node packages/extensions/extensions/cursor-sdk/repair-context-order.mjs --project /path/to/project
```

To target just one context file instead, use `--file` (mutually exclusive with `--project`). It also defaults to dry-run; add `--apply` to repair it:

```bash
node packages/extensions/extensions/cursor-sdk/repair-context-order.mjs --file /path/to/context.json
node packages/extensions/extensions/cursor-sdk/repair-context-order.mjs --file /path/to/context.json --apply
```

Review the JSON report first. Stop all tasks and close the project in AiderDesk before applying repairs, so in-memory context/autosave cannot overwrite the repaired files:

```bash
node packages/extensions/extensions/cursor-sdk/repair-context-order.mjs --project /path/to/project --apply
```

The script preserves message contents, IDs, context files, and non-tool message order. Calls and results must match uniquely within the same user turn and prompt context. Files with missing or ambiguous matches are skipped and reported for manual review; no calls or results are fabricated or deleted.

Each changed file receives a byte-for-byte `context.json.order-backup-<id>` backup before atomic replacement. The script checks for concurrent changes before replacement, refuses non-regular context files, and is idempotent. To restore a backup, keep the project closed and copy that backup over its corresponding `context.json`.

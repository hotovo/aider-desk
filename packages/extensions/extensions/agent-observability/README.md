# Agent Observability Extension

Records agent events from AiderDesk and sends them to a [pi-agent-observability](https://github.com/disler/pi-agent-observability) server for real-time monitoring, debugging, and analysis.

## Features

- Real-time event streaming to an observability server
- Tracks full agent lifecycle: prompts, responses, tool calls, tool results
- Captures usage data (tokens, cost, timing)
- Supports TTFT (Time To First Token) and TPS (Tokens Per Second) metrics
- Compatible with the pi-agent-observability server and UI

## Setup

1. Start the [pi-agent-observability server](https://github.com/disler/pi-agent-observability) locally:

   ```bash
   git clone https://github.com/disler/pi-agent-observability.git
   cd pi-agent-observability
   ```

   **Option A — Using [Bun](https://bun.sh/) directly:**

   ```bash
   cd apps/observability
   OBS_AUTH_TOKEN=devtoken bun server.ts
   ```

   **Option B — Using [just](https://github.com/casey/just) (a command runner):**

   ```bash
   just obs
   ```

   The server starts on `http://127.0.0.1:43190` by default. The auth token defaults to `devtoken` — set `OBS_AUTH_TOKEN` to customize it.

2. In AiderDesk, open the Agent Observability extension settings and configure:
   - **Server URL**: The URL of your observability server (default: `http://127.0.0.1:43190`)
   - **Auth Token**: Must match the `OBS_AUTH_TOKEN` set on the server
   - **Pool**: Logical grouping name (default: `default`)
   - **Tags**: Comma-separated tags for filtering sessions
   - **Agent Name**: Optional friendly name for the agent

3. Start a task in AiderDesk — events will stream to the observability server in real-time.

## Events Captured

| AiderDesk Event | Observability Event |
|---|---|
| Task Created | `session_start` |
| Task Closed | `session_shutdown` |
| Prompt Started | `user_message` |
| Agent Started | `agent_start` |
| Agent Finished | `agent_end` |
| Agent Step Started | `turn_start` |
| Agent Step Finished | `turn_end` |
| Response Completed | `assistant_message` |
| Tool Called | `tool_call` |
| Tool Finished | `tool_result` |

## Configuration

Access settings via the extension gear icon in AiderDesk's extension list.

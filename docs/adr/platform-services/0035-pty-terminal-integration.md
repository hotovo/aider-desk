# ADR-0035: PTY-Based Integrated Terminal

## Status

Accepted (2026-08-28)

## Context

Users (and the AI features around them) need a real terminal inside the app: full TTY semantics (colors, cursor control, interactive programs), session persistence across UI reloads, and streaming output to the UI over the event bus. Rendering terminal output as plain text logs loses interactivity; `child_process` without a PTY breaks interactive commands.

## Decision Drivers

- **Must** provide a true PTY (interactive programs, ANSI rendering)
- **Must** stream terminal data to clients over the event bus (Electron and browser mode, [ADR-0003](../core-architecture/0003-socket-io-event-bus.md))
- **Must** manage terminal lifecycle (create, resize, exit) per project/task context
- **Should** survive renderer reloads without killing running commands

## Considered Options

### Option A — Spawn shell via `child_process` and render output as text

- **Pros**: No native dependency.
- **Cons**: No TTY — vim, htop, REPLs, progress bars break; no ANSI state; poor UX.

### Option B — node-pty managed by a terminal manager

- **Pros**: `terminal-manager.ts` owns PTY sessions (`node-pty`), exposing create/resize/kill; output flows as `TerminalData`/`TerminalExitData` events; input flows back via the API; the frontend renders with a terminal emulator component (xterm-style); sessions outlive transient UI states.
- **Cons**: Native module (platform binaries; packaging/rebuild considerations via electron-builder); process lifecycle must be reaped carefully.

## Decision

Implement the integrated terminal on **`node-pty`**, encapsulated in `src/main/terminal/terminal-manager.ts` with its REST surface (`terminal-api.ts`) and event-bus streaming. The manager creates PTY sessions scoped to the project/task context, forwards input, handles resize, detects exit (`TerminalExitData`), and cleans up on project close. The renderer consumes the event stream and renders an emulator component; sessions are intentionally independent of renderer lifetime so a reload doesn't kill running processes.

## Rationale

node-pty is the industry-standard way to embed a real terminal in an Electron app (the same primitive VS Code uses). Encapsulating it in one manager keeps the native dependency, its lifecycle, and its event contract isolated from feature code.

## Consequences

### Positive

- Fully interactive terminals inside tasks; AI/agents can observe `TerminalData` as context
- Works identically over remote/browser mode via the event bus
- Renderer reloads don't destroy long-running commands

### Negative

- Native module adds packaging complexity per platform
- Zombie process risk if exit/reap paths regress

### Risks & Mitigations

- Risk: PTY output floods the event bus — Mitigation: chunking/throttling in the manager; clients render incrementally

## Guardrails for Agents

### Do

- Perform all PTY operations through `terminal-manager.ts`; UI/API layers never touch node-pty directly
- Treat terminal output as event-stream data (`TerminalData`) — chunked, ordered, potentially high-volume
- Clean up sessions on project/task close and handle `TerminalExitData` in consumers

### Don't

- Never buffer unbounded terminal output in memory (main or renderer)
- Never send raw ANSI capture to LLMs without sanitization/limits — use the established context extraction paths
- Never assume a terminal session exists — consumers must handle absence and exit events

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0040: electron-vite Build System](../testing-tooling/0040-electron-vite-build-system.md)

# ADR-0001: Electron Multi-Process Model

## Status

Accepted (2026-08-28)

## Context

AiderDesk is a desktop application that combines a rich UI (chat, diffs, settings), long-running background services (projects, Aider processes, agents, terminal, servers), and direct filesystem/git access. A single-process design would freeze the UI during long operations and mix privileged filesystem access with untrusted web content. Electron's multi-process model is the platform-native answer, but it must be applied with a strict separation of concerns to stay maintainable.

## Decision Drivers

- **Must** keep the UI responsive during long-running operations (agent steps, Aider generation, git operations)
- **Must** keep Node.js privileges (fs, child_process, git) out of the renderer
- **Must** support multiple concurrent projects, each with its own state and processes
- **Should** allow the UI to also run in a plain browser (remote access) — see [ADR-0020](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md)

## Considered Options

### Option A — Single Electron process with nodeIntegration

- **Pros**: No IPC plumbing; direct access to Node APIs from UI code.
- **Cons**: Renderer crashes take everything down; security exposure; cannot run in a plain browser; unmaintainable mixing of concerns.

### Option B — Electron multi-process with strict separation

- **Pros**: UI isolation, privilege isolation, browser-capable renderer, clear module boundaries (`src/main`, `src/renderer`, `src/preload`).
- **Cons**: All main↔renderer interaction must go through IPC/event channels; more boilerplate.

## Decision

Use Electron's multi-process model with strict separation: **`src/main/`** owns all Node.js capabilities (projects, agents, MCP, Python connector, REST server, terminal, git, telemetry), **`src/renderer/`** is a pure Chromium/React UI with no Node access, and **`src/preload/`** is the only bridge between them. Every background concern is a dedicated manager/module under `src/main/` (e.g. `project/`, `agent/`, `task/`, `worktrees/`, `telemetry/`, `server/`), wired in `managers.ts` / `start-up.ts`, never in UI code.

## Rationale

The separation directly maps to the risk model: anything privileged lives in main, anything user-facing lives in renderer, and the only legal path between them is the typed preload bridge ([ADR-0002](0002-preload-ipc-bridge-and-api-contract.md)). It also enables the browser-based remote access mode, where the renderer runs without Electron at all and talks to the REST server.

## Consequences

### Positive

- Renderer can crash/reload without losing main-process state (projects keep running)
- Clear ownership: new background capability → new module under `src/main/`; new UI → `src/renderer/`
- Renderer code stays portable to browser mode

### Negative

- Every new capability needs explicit API surface + IPC wiring
- Some logic is duplicated in shape (main API implementation vs browser API implementation)

### Risks & Mitigations

- Risk: developers "temporarily" leak Node code into renderer — Mitigation: `nodeIntegration` is off; typecheck configs split node/web globals ([ADR-0004](0004-typescript-project-references.md))

## Guardrails for Agents

### Do

- Put all Node-only logic (fs, child_process, git, network servers) in `src/main/`
- Route renderer→main calls exclusively through the typed API surface in `packages/common/src/api.ts`
- Wire new main-process services through the existing manager wiring (`managers.ts`, `start-up.ts`), not ad-hoc singletons in components

### Don't

- Never use `require('fs')` / Node globals in `src/renderer/` or `src/preload/` beyond the exposed bridge
- Never spawn processes or open sockets directly from the renderer
- Never place business logic in `src/preload/` — it is a bridge, not a service layer

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0003: Socket.IO Event Bus for Push Events](0003-socket-io-event-bus.md)
- [ADR-0020: Remote Access](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md)

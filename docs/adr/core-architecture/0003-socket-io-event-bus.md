# ADR-0003: Socket.IO Event Bus for Push Events

## Status

Accepted (2026-08-28)

## Context

Beyond request/response ([ADR-0002](0002-preload-ipc-bridge-and-api-contract.md)), the UI needs continuous push updates: streaming response chunks, tool progress, context-file changes, terminal output, logs, autocompletions, and updates for dozens of other data types. These flows outlive individual requests, must reach multiple consumers (main window UI, browser clients, external tooling), and must be subscribable per project/base directory.

## Decision Drivers

- **Must** deliver ~40 distinct typed event types to one or many renderer instances in real time
- **Must** support multiple concurrent clients (desktop window, browser clients, readonly viewers, external connectors)
- **Must** allow clients to subscribe selectively (event types, base directories, readonly view)
- **Should** reuse the same mechanism the Python connector already speaks (Socket.IO)

## Considered Options

### Option A — Raw Electron `webContents.send` per feature

- **Pros**: Direct; no dependency.
- **Cons**: No multiplexing to multiple clients, no subscription filtering, unusable in browser mode, each feature reinvents push plumbing.

### Option B — Central event manager over Socket.IO

- **Pros**: One typed fan-out point; per-connector filtering (`eventTypes`, `baseDirs`, `readonly`); works identically for Electron (via preload listeners) and browser (via socket client); same protocol as the Python connector bridge.
- **Cons**: Another long-lived connection to manage; event payloads must be serializable.

## Decision

Use a central **event manager** (`src/main/events/event-manager.ts`, wired via `events-handler.ts`) over **Socket.IO** as the single push-event bus. All event payload types are defined in `@common/types` (e.g. `ResponseChunkData`, `ToolData`, `TerminalData`, `ContextInfoData`). Connectors (`EventsConnector`) register with optional `eventTypes`, `baseDirs`, and `readonly` filters; the manager fans events out only to matching connectors. The Python connector subscribes to the same bus with `isSubscribeEventsMessage`/`isReadonlySubscribeEventsMessage`, and browser clients receive the same stream over the REST server's socket namespace.

## Rationale

One typed fan-out point serves four consumers (Electron window, browser UI, readonly viewers, external connectors) with one implementation, and matches the transport the connector bridge ([ADR-0014](../aider-integration/0014-python-connector-bridge.md)) already uses — avoiding a second realtime protocol.

## Consequences

### Positive

- New push data = add one typed event + emit; all transports get it for free
- Subscription filtering gives readonly/external clients a bounded event surface ([ADR-0038](../security/0038-context-isolation-secrets-readonly.md))
- Serializable payloads keep the bus usable across processes and machines

### Negative

- Every event payload must be JSON-serializable and forward-compatible
- High-frequency events (streaming chunks) all traverse one bus; per-event overhead matters

### Risks & Mitigations

- Risk: event type explosion makes the shared types file unwieldy — Mitigation: all event payloads live in `@common/types` and follow the `XxxData` naming convention; reuse payloads before adding new event types

## Guardrails for Agents

### Do

- Define new event payloads in `packages/common/src/types` following the `XxxData` naming convention
- Emit through the event manager; never call `webContents.send` directly from feature code
- Respect connector filters: events that may contain sensitive data must be suppressible via the `readonly` filter

### Don't

- Never use the event bus for request/response; use the `ApplicationAPI` ([ADR-0002](0002-preload-ipc-bridge-and-api-contract.md))
- Never put non-serializable values (functions, class instances, Buffers without encoding) into event payloads
- Never assume exactly one listener — events are broadcast

## Related Decisions

- [ADR-0001: Electron Multi-Process Model](0001-electron-multi-process-model.md)
- [ADR-0014: Python Connector Bridge](../aider-integration/0014-python-connector-bridge.md)
- [ADR-0038: Electron Trust Boundaries, Secrets, and Readonly Access](../security/0038-context-isolation-secrets-readonly.md)

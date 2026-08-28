# ADR-0002: Preload IPC Bridge and Shared API Contract

## Status

Accepted (2026-08-28)

## Context

The renderer must invoke main-process capabilities (project operations, settings, tasks, agents, models) and receive events back. Naive `ipcRenderer.send('string-channel', payload)` usage scatters untyped channel names across the codebase and makes the main↔renderer interface unauditable. Additionally, the renderer must also work in a plain browser (remote access mode), where Electron IPC does not exist.

## Decision Drivers

- **Must** have a single, type-safe, auditable list of everything the UI can ask the main process to do
- **Must** support two transports for the same logical API: Electron IPC (desktop) and REST/WebSocket (browser mode)
- **Should** keep types shared between main and renderer without runtime coupling

## Considered Options

### Option A — Ad-hoc `ipcMain.on` string channels

- **Pros**: Quick to add.
- **Cons**: No type safety, no single interface, drift between callers and handlers, impossible to mirror over REST.

### Option B — Typed API interface in shared package, implemented per transport

- **Pros**: One `ApplicationAPI` interface as the contract; two implementations (preload IPC bridge, browser REST client); compile-time guarantee that both transports stay in sync.
- **Cons**: Contract file becomes large; adding a method requires touching multiple files.

## Decision

Define the entire main↔renderer surface as the `ApplicationAPI` TypeScript interface in **`packages/common/src/api.ts`**, with all request/response types in `@common/types`. It has exactly two implementations:

- **`src/preload/index.ts`** — exposes the API to the renderer via Electron IPC (`ipcRenderer.invoke` behind a `contextBridge`)
- **`src/renderer/src/api/browser-api.ts`** — implements the same interface against the REST API server ([ADR-0018](../api-surface/0018-rest-api-base-pattern.md)) for browser/remote mode

Renderers inject the API via `ApiContext` ([ADR-0021](../frontend-ui/0021-zustand-for-state-context-for-di.md)) and never know which transport is active.

## Rationale

The shared interface is the single point of audit for the app's privileged surface and makes the desktop/browser duality a compile-time-checked property instead of a runtime hope. Event push in the other direction is handled separately by the event bus ([ADR-0003](0003-socket-io-event-bus.md)), keeping request/response and event streams orthogonal.

## Consequences

### Positive

- Adding a capability = extend `api.ts` → implement in preload + browser-api → consume; typecheck enforces completeness
- Security review has one file to look at
- Browser mode requires no renderer changes

### Negative

- `api.ts` grows large; both implementations must be updated for every new method
- IPC method count is high (dozens of channels), which is noise but manageable

### Risks & Mitigations

- Risk: implementations drift (method added to one transport only) — Mitigation: both classes `implement ApplicationAPI`; `npm run typecheck` fails on drift

## Guardrails for Agents

### Do

- Add every new renderer→main capability to `packages/common/src/api.ts` first, with types in `@common/types`
- Implement the method in **both** `src/preload/index.ts` and `src/renderer/src/api/browser-api.ts`, plus a matching REST endpoint if it needs one
- Access the API in components via `useApi()` / `ApiContext`, never via `window.*` directly

### Don't

- Never invent raw `ipcRenderer`/`ipcMain` channels outside the `ApplicationAPI` pattern
- Never call `browser-api.ts`'s REST endpoints directly from components; always go through the interface
- Never put transport logic (fetch, ipc) in `packages/common` — it must stay environment-agnostic

## Related Decisions

- [ADR-0001: Electron Multi-Process Model](0001-electron-multi-process-model.md)
- [ADR-0003: Socket.IO Event Bus for Push Events](0003-socket-io-event-bus.md)
- [ADR-0018: REST API Base Pattern](../api-surface/0018-rest-api-base-pattern.md)
- [ADR-0021: Zustand for State, Context for DI](../frontend-ui/0021-zustand-for-state-context-for-di.md)

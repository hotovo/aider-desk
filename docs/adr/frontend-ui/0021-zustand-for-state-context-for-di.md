# ADR-0021: Zustand for State, Context for Dependency Injection

## Status

Accepted (2026-08-28)

## Context

The renderer needs two different kinds of shared state: (1) *service instances* that never change at runtime — the API client ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)), the extension API, worker pools — which must be injectable (and mockable in tests); and (2) *application state* that changes frequently — tasks, settings, overlays, editors, command palette — consumed by many components with fine-grained reactivity. React Context alone handles (1) well but causes provider pyramids and over-rendering for (2); a state library alone handles (2) but is awkward for injected instances.

## Decision Drivers

- **Must** avoid "must be used within Provider" errors and provider nesting depth
- **Must** support fine-grained subscriptions (a token-count change must not re-render the file tree)
- **Must** allow state access outside components (event handlers, utilities) and devtools debugging
- **Must** keep stable service instances mockable in component tests

## Considered Options

### Option A — React Context for everything

- **Pros**: No new dependency.
- **Cons**: Every consumer re-renders on any context value change; deep provider trees; no store access outside React; awkward devtools.

### Option B — Zustand stores for app state; Context strictly for stable DI

- **Pros**: `createWithEqualityFn` + `devtools` middleware + `shallow` equality give performant selective subscriptions; stores usable from non-React code (e.g. socket event handlers updating `taskStore` directly); Contexts (`ApiContext`, `ExtensionApiContext`, `ReadonlyApiContext`, `DiffsWorkerPoolContext`) hold only immutable service handles, trivially mocked in tests.
- **Cons**: Two mechanisms to learn; discipline needed to keep the boundary clean.

## Decision

Use **Zustand** for all mutable shared state — stores live in `src/renderer/src/stores/` (`taskStore`, `settingsStore`, `projectStore`, `overlayStore`, `fileEditorStore`, `actionsStore`, `commandPaletteStore`, `commitStore`, `extensionUIStore`, `taskFilesStore`, `settingsNavigationStore`), created with `createWithEqualityFn`, `devtools` middleware, and `shallow` equality; components subscribe selectively (`useStore((s) => s.field)`). Use **React Context only for dependency injection of stable instances** — the 14 contexts in `src/renderer/src/contexts/` (e.g. `ApiContext`, `McpServersContext`, `ModelProviderContext`) exist to inject API clients/services that never change identity. Socket/event updates write into stores from outside React.

## Rationale

Matching mechanism to lifetime (mutable state vs stable services) yields both performance (selective subscriptions) and testability (mock the service, ignore the store). Store access outside components is essential — event-bus handlers are the primary state writers and are not React code.

## Consequences

### Positive

- Minimal re-renders; large UI stays responsive during streaming updates
- Tests mock contexts easily; no provider pyramids for state
- Devtools time-travel for stores during UI debugging

### Negative

- Contributors must know which mechanism fits; occasional debate at the boundary
- Store boilerplate (devtools wiring, equality fn) per store

### Risks & Mitigations

- Risk: creeping Context misuse for state recreates render storms — Mitigation: guardrails below; new shared state defaults to a store

## Guardrails for Agents

### Do

- Put new shared/mutable state in a Zustand store under `src/renderer/src/stores/`, following the `createWithEqualityFn` + `devtools` + `shallow` pattern
- Subscribe with selectors (`useStore((s) => s.x)`) — never destructure whole stores in components
- Update stores from event handlers outside React directly (e.g. in the socket wiring)

### Don't

- Never put changing application state into a React Context
- Never put service instances into a Zustand store — they belong in DI contexts
- Never create a new context for something an existing store already covers

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0025: Web Workers for Heavy Computation](0025-web-workers-for-heavy-compute.md)

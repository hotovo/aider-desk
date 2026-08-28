# ADR-0028: Renderer-Side Local Persistence

## Status

Accepted (2026-08-28)

## Context

Not all UI state belongs in the main process: ephemeral or per-window preferences (command palette recently-used actions, UI layout state, editor drafts) are renderer concerns, and putting them through the `ApplicationAPI` ([ADR-0002](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)) into main-process files would bloat the API and the settings schema with trivial data. The renderer also runs in plain-browser remote mode ([ADR-0020](../api-surface/0020-remote-access-tunnel-and-readonly-mode.md)), where Electron storage APIs don't exist, so any persistence must use web-standard storage.

## Decision Drivers

- **Must** persist trivial UI state without new API surface
- **Must** work identically in Electron renderer and plain browser mode
- **Must** keep the split clear: user-meaningful data → main process; UI-local convenience state → renderer storage
- **Should** handle larger structured payloads (e.g. IndexedDB for bigger data) when needed

## Considered Options

### Option A — Everything persisted main-side via the API

- **Pros**: One storage location.
- **Cons**: API bloat for trivial state; settings schema polluted; round-trips for keystroke-level data; couples renderer-internal UX to the main process.

### Option B — Web-standard storage in the renderer (localStorage / IndexedDB)

- **Pros**: Zero API surface; works in both renderer modes; synchronous localStorage fits tiny preferences; IndexedDB (via `useIndexedDB`) fits larger structured data; data is naturally per-profile/per-origin.
- **Cons**: Not shared across machines (acceptable for UI conveniences); cleared if users wipe site data (acceptable — nothing critical lives here).

## Decision

Persist **UI-local convenience state in the renderer** using web-standard storage: `localStorage` for small synchronous preferences (e.g. command palette recently-used action IDs referenced by [ADR-0022](../frontend-ui/0022-stable-ui-action-catalog.md)) and IndexedDB via the `useIndexedDB` hook for larger structured payloads. The rule of thumb is enforced: if losing the data would harm the user's *work* (tasks, settings, providers), it belongs to its main-process domain owner ([ADR-0026](0026-central-data-manager.md)); if losing it merely costs a little convenience (recents, layout), renderer storage is correct.

## Rationale

Web-standard storage is the only renderer persistence that works identically across Electron and browser mode, requires no API surface, and matches the trivial durability expectations of UI conveniences. The work-vs-convenience classification keeps critical data safe in main-process storage with its migrations and locking.

## Consequences

### Positive

- No API/settings churn for minor UX state
- Renderer stays portable (browser mode parity)
- Tiny state reads are synchronous and cheap

### Negative

- UI conveniences don't roam across machines/profiles
- Two storage tiers require the classification discipline to be applied honestly

### Risks & Mitigations

- Risk: critical data quietly lands in localStorage — Mitigation: guardrails below; the classification rule is the review question ("would losing this hurt the user's work?")

## Guardrails for Agents

### Do

- Use `localStorage` for small UI preferences and `useIndexedDB` for larger renderer-local data
- Key renderer-stored data namespaced and forward-compatible ( tolerate missing entries)
- Ask the classification question before choosing storage: work data → main process; convenience → renderer

### Don't

- Never store tasks, settings, credentials, or anything the user would consider "their data" in renderer storage
- Never add API methods or settings fields just to persist trivial UI state
- Never assume renderer storage exists/has data (private mode, cleared storage) — code defensively

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0022: Stable UI Action Catalog](../frontend-ui/0022-stable-ui-action-catalog.md)
- [ADR-0026: Domain-Owned Persistence Backends](0026-central-data-manager.md)

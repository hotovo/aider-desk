# ADR-0025: Web Workers for Heavy Computation

## Status

Accepted (2026-08-28)

## Context

Some renderer work is CPU-heavy — computing and re-computing syntax-highlighted diffs as streaming responses update files many times per second. Running such work on the main thread blocks painting and input: during active agent output the UI must stay interactive while diffs grow. The cost is per-chunk recomputation, which multiplies quickly on large files.

## Decision Drivers

- **Must** keep the UI thread free during streaming updates (60fps interactions while diffs recompute)
- **Must** parallelize and pool work (many files diffing concurrently)
- **Should** keep worker code co-located and typed with the rest of the renderer

## Considered Options

### Option A — Compute on the main thread

- **Pros**: Simplest data flow (direct function calls).
- **Cons**: Jank during streaming; large diffs freeze the UI; no parallelism.

### Option B — Pooled web workers with a context-managed client

- **Pros**: Diff computation off-thread; a pool (`DiffsWorkerPoolContext`) bounds concurrency and queues work; results arrive as regular state updates into stores ([ADR-0021](0021-zustand-for-state-context-for-di.md)); Vite bundles worker modules natively.
- **Cons**: Structured-clone serialization at the boundary; workers complicate debugging slightly.

## Decision

Run heavy renderer computation — diff processing in particular — in **pooled Web Workers**, accessed through `DiffsWorkerPoolContext` (`src/renderer/src/contexts/`). The pool owns worker lifecycle and concurrency; components request computation and consume results via hooks/state, never by awaiting inline main-thread loops. New heavy computation must follow the same pattern: a dedicated worker module, a pool/context client, and serializable inputs/outputs.

## Rationale

A pool gives bounded parallelism (no worker-per-file explosions) and a single place to manage lifecycle, while the Context-with-stable-instance pattern ([ADR-0021](0021-zustand-for-state-context-for-di.md)) keeps the client injectable and testable. Off-thread diffs are the difference between "usable during agent streaming" and "frozen".

## Consequences

### Positive

- Streaming updates never block interaction; large diffs render smoothly
- Concurrency is bounded and tunable in one place
- Pattern generalizes to future heavy work (parsing, indexing)

### Negative

- Data crossing the boundary must be serializable (no class instances, no functions)
- Two-step debugging (main thread + worker threads)

### Risks & Mitigations

- Risk: ad-hoc `new Worker(...)` calls scatter lifecycle management — Mitigation: guardrails below; all workers route through pool contexts

## Guardrails for Agents

### Do

- Route diff computation through `DiffsWorkerPoolContext`; add new heavy compute as a worker module + pool client following the same pattern
- Keep worker message payloads plain, serializable data (POJOs, strings, typed arrays)
- Co-locate worker sources with the feature and let the bundler (electron-vite/Vite) handle them

### Don't

- Never run O(file-size) computation loops synchronously in components or event handlers
- Never create unmanaged workers directly in components
- Never pass non-serializable values (DOM nodes, class instances, callbacks) to workers

## Related Decisions

- [ADR-0021: Zustand for State, Context for DI](0021-zustand-for-state-context-for-di.md)
- [ADR-0040: electron-vite Build System](../testing-tooling/0040-electron-vite-build-system.md)

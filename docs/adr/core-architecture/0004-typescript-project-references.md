# ADR-0004: TypeScript Project References (node/web split)

## Status

Accepted (2026-08-28)

## Context

The codebase contains two runtime environments with different globals and libraries: the Electron main/preload processes (Node.js: `fs`, `path`, `process`, Node types) and the renderer (Chromium/DOM: `window`, `document`, DOM types). A single tsconfig would allow Node code in the renderer and DOM code in the main process, breaking the process separation enforced by [ADR-0001](0001-electron-multi-process-model.md) only at runtime — the worst place to find out.

## Decision Drivers

- **Must** catch environment violations at compile time
- **Must** share code (packages/common) between both environments without duplicating types
- **Should** keep typecheck fast and scoped per environment

## Considered Options

### Option A — Single tsconfig for everything

- **Pros**: One config; simplest setup.
- **Cons**: `lib: dom` + Node types together silently permit cross-environment mistakes; slower whole-tree checks.

### Option B — TypeScript project references with separate node/web configs

- **Pros**: `tsconfig.node.json` (main/preload: Node types, no DOM) and `tsconfig.web.json` (renderer: DOM, no Node globals) make violations a compile error; shared code included in both; per-environment incremental checks.
- **Cons**: Three configs to maintain; boundary code must be careful about which config covers it.

## Decision

Use **TypeScript project references** with `tsconfig.node.json` for `src/main` + `src/preload` and `tsconfig.web.json` for `src/renderer`, rooted by the base `tsconfig.json`. Additional scoped configs exist for server and test code (`tsconfig.server.json`, `tsconfig.test.json`). Verification commands: `npm run typecheck` (both), `npm run typecheck:node`, `npm run typecheck:web`. `packages/common` is consumed by both and must compile under each environment's rules.

## Rationale

The environment split is the compile-time reflection of the runtime split from [ADR-0001](0001-electron-multi-process-model.md): if renderer code accidentally uses Node APIs, the web typecheck fails — the same guarantee the Electron flag `nodeIntegration: false` provides at runtime.

## Consequences

### Positive

- Environment violations fail `npm run typecheck` before they ever run
- Fast, scoped checks during development (`typecheck:web` for UI work)
- Test configs can extend the right environment per test suite

### Negative

- Files near the boundary (e.g. shared utilities needing both) need explicit care
- New top-level directories must be added to the right tsconfig's include list

### Risks & Mitigations

- Risk: agent edits land in the wrong tsconfig scope — Mitigation: always run `npm run typecheck` (both configs) after main+renderer changes; CI runs the full check

## Guardrails for Agents

### Do

- Run `npm run typecheck` after changes spanning main and renderer; use `typecheck:node`/`typecheck:web` for scoped verification
- Put cross-environment code in `packages/common` only, and keep it free of Node- and DOM-specific imports
- Add new source directories to the correct tsconfig include list

### Don't

- Never import `src/main/*` modules from `src/renderer/*` or vice versa
- Never relax `lib`/`types` settings in either config to make an environment violation pass — fix the boundary instead

## Related Decisions

- [ADR-0001: Electron Multi-Process Model](0001-electron-multi-process-model.md)
- [ADR-0039: Vitest Multi-Config Testing](../testing-tooling/0039-vitest-multi-config-and-playwright.md)

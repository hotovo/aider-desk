# ADR-0039: Vitest Multi-Config Testing and Playwright E2E

## Status

Accepted (2026-08-28)

## Context

The codebase spans two runtime environments (node-like main/preload, web renderer) with different testing needs: main-process unit tests need Node mocks and heavy service mocking; renderer tests need React Testing Library; the whole app occasionally needs real end-to-end flows. A single test setup cannot serve both environments' module graphs and globals (see [ADR-0004](../core-architecture/0004-typescript-project-references.md)) — and agents running tests need clean, parseable output.

## Decision Drivers

- **Must** test main/preload and renderer with environment-appropriate setups
- **Must** keep test co-location conventions predictable (`__tests__/` directories)
- **Must** support mocking Electron, the `ApplicationAPI`, and heavy managers
- **Should** have real E2E coverage for critical flows without slowing the unit loop

## Considered Options

### Option A — One Vitest config for everything

- **Pros**: One command.
- **Cons**: Node-vs-DOM environment fights; renderer component tests need jsdom + RTL setup that pollutes node tests; module mocking differs per side.

### Option B — Split Vitest configs + Playwright for E2E

- **Pros**: `vitest.config.node.ts` (main/preload/common, Node environment) and `vitest.config.web.ts` (renderer, jsdom + React Testing Library) mirror the tsconfig split; scripts (`test:node`, `test:web`, `test:watch`, `test:coverage`, `test:ui`) target each; `e2e/` holds Playwright (`playwright.config.ts`, `global-setup.ts`) for full-app flows; tests live beside code in `__tests__/`.
- **Cons**: Two unit configs + one E2E stack to maintain; agents must pick the right command per change.

## Decision

Use **Vitest with two environment-scoped configs** and **Playwright for E2E**:

- `npm run test:node` — main/preload/common unit tests (`vitest.config.node.ts`)
- `npm run test:web` — renderer component tests (`vitest.config.web.ts`, jsdom + React Testing Library)
- `npm run test` — both suites
- `npm run test:watch` / `test:coverage` / `test:ui` — developer workflows
- `e2e/` — Playwright flows (`npm`-driven dev instance on a separate port per the E2E testing skill)

Tests co-locate with source in `__tests__/` directories throughout `src/` and `packages/`. When running suites via shell, append `-- --no-color` for clean parseable output (a documented agent requirement).

## Rationale

Environment-scoped configs give each suite correct globals, mocking patterns, and setup with no cross-contamination, directly mirroring the typecheck split so a file's test home is obvious from its tsconfig. Playwright covers the integration seams (real app boot, connector, UI flows) that unit tests structurally cannot.

## Consequences

### Positive

- Fast, focused unit loops per environment; deterministic CI (`test` runs both)
- Established mocking patterns for Electron/API/managers per suite
- E2E guards the riskiest seams (startup, project flows) without taxing unit runs

### Negative

- Contributors must choose the right command/config (mitigated by convention: match the tsconfig)
- Playwright runs are slow and flakier; kept out of the unit gate

### Risks & Mitigations

- Risk: tests written into the wrong suite fail mysteriously (wrong environment) — Mitigation: co-location convention + config `include` patterns; CI surfaces misplacement quickly

## Guardrails for Agents

### Do

- Run `npm run test:node` for main-process changes and `npm run test:web` for renderer changes; both (`npm run test -- --no-color`) after cross-cutting changes
- Place tests in the `__tests__/` directory beside the code under test, matching neighboring tests' mocking style
- Mock Electron and `ApplicationAPI` using the patterns in existing tests; activate the project's test-writing guidance before authoring tests

### Don't

- Never put DOM-dependent tests in the node suite or Node-API tests in the web suite
- Never skip writing tests for bug fixes; regression tests accompany fixes
- Never mark flaky E2E steps with long sleeps — fix waits via Playwright's condition-based APIs

## Related Decisions

- [ADR-0004: TypeScript Project References](../core-architecture/0004-typescript-project-references.md)
- [ADR-0040: electron-vite Build System](0040-electron-vite-build-system.md)

# ADR-0042: Extension Isolation

## Status

Accepted (2026-10-14)

## Context

Extensions are independently owned implementations under `packages/extensions/extensions/<extension-id>/`. The core application provides their lifecycle and UI contracts but must not depend on a particular extension ([ADR-0029](0029-lifecycle-hook-extension-system.md)). This boundary also applies to tests: a renderer test importing a specific extension's JSX makes the core test suite depend on that extension's files and behavior.

The sound-notification configuration tests originally lived in `src/renderer/src/components/settings/__tests__/SoundNotificationConfig.test.tsx`. They now live beside the extension in `packages/extensions/extensions/sound-notification/__tests__/ConfigComponent.test.tsx`, alongside its audio and lifecycle tests. The UI tests use local stubs for host-provided components rather than importing renderer implementations.

`packages/extensions/vitest.config.ts` discovers extension-local `__tests__` files and defaults to Node. Individual UI tests can select jsdom with `@vitest-environment jsdom`, provide DOM matchers and cleanup locally, and reuse repository development dependencies without depending on core application modules.

## Decision Drivers

- **Must** keep extension-specific tests, fixtures, and test helpers inside their owning extension folder
- **Must** prevent core application tests from importing specific extension implementations or assets
- **Must** retain core-owned tests for generic extension infrastructure and public contracts
- **Should** preserve extension UI coverage without requiring the core renderer's test setup
- **Should** avoid changing shared test configuration solely for one extension

## Considered Options

### Option A — Put extension UI tests in the core renderer suite

- **Pros**: Reuses renderer setup and real host components directly.
- **Cons**: Couples the core suite to specific extensions and splits extension ownership across folders.

### Option B — Keep all extension-specific tests with the extension

- **Pros**: Tests follow extension ownership; UI and backend coverage run through the extension workspace; local stubs avoid core module dependencies.
- **Cons**: UI tests need their own DOM setup and cannot establish that real host components behave identically to stubs.

### Option C — Remove extension UI tests when core setup is unavailable

- **Pros**: Preserves the boundary without additional setup.
- **Cons**: Loses regression coverage; unnecessary when extension-local DOM tests are feasible.

## Decision

Place tests for a specific extension, including its configuration UI, in `packages/extensions/extensions/<extension-id>/__tests__/`. Keep extension-specific fixtures and helpers inside the same extension folder. Run these tests with the extension workspace's Vitest configuration, selecting the appropriate runtime environment within the extension rather than relocating tests into core.

Core tests may test generic extension infrastructure, such as the manager, loader, action bridge, and JSX renderer, using synthetic extensions or generic fixtures. They must not import a bundled extension's implementation or assets to test that extension's behavior.

## Rationale

Test ownership follows implementation ownership, consistent with [ADR-0039](../testing-tooling/0039-vitest-multi-config-and-playwright.md). Extension-local UI tests can exercise configuration state, uploads, and preview actions using the injected UI contract documented in [ADR-0030](0030-runtime-jsx-transpiled-extension-ui.md), without making the application depend on a specific extension.

## Consequences

### Positive

- Extension behavior and regression coverage stay together when an extension changes or is removed.
- The core test suite remains independent of bundled extension features.
- UI coverage is retained alongside backend tests without modifying the renderer test setup.

### Negative

- Extension UI tests must supply local DOM setup and contract-compatible host component stubs.
- Stubs verify extension behavior, not the implementation of real host components; generic host tests cover those components separately.
- The root `npm run test` command does not run the extension workspace suite; contributors must run it explicitly.

### Risks & Mitigations

- Risk: local stubs drift from the host UI contract — Mitigation: keep stubs small and test shared host components and extension contracts in core-owned tests.
- Risk: extension tests are accidentally put in core — Mitigation: review imports and test locations against the guardrails below. This is an architectural convention, not an automated import restriction.
- Risk: DOM tests silently rely on renderer setup — Mitigation: declare their environment, matchers, and cleanup locally and verify them using the extension workspace runner.

## Guardrails for Agents

### Do

- Put every extension-specific test and fixture inside its owning `packages/extensions/extensions/<extension-id>/` folder.
- For extension UI tests, use an extension-local DOM environment and local stubs for host-provided UI components.
- Run `npm run test --workspace=packages/extensions -- --no-color extensions/<extension-id>/__tests__` after changing an extension.
- Keep tests of generic extension infrastructure beside the core modules they exercise, using synthetic fixtures rather than bundled extension implementations.

### Don't

- Do not create tests for a named extension under `src/main/`, `src/preload/`, or `src/renderer/`.
- Do not import bundled extension code or assets into core test files.
- Do not import core application implementations or renderer test setup into extension-owned tests merely to obtain UI components or mocks.
- Do not broaden the core test suite's include patterns to accommodate a specific extension.
- Do not delete useful extension coverage simply because it needs a DOM environment; first attempt extension-local setup.

## Addendum: Extension-Owned Data Storage (2026-10-14)

Extension-owned data must also remain inside the installed extension's own folder. Store configuration, uploaded assets, generated files, persistent state, and caches relative to that folder; do not create extension-owned storage under a separate global directory such as `~/.aider-desk/extension-state/` or the system temporary directory.

Sound Notification stores uploaded audio in `<extension-folder>/data/audio/` and downloaded sound-pack files in `<extension-folder>/data/cache/`. Its configuration remains in `<extension-folder>/config.json`. Resolve these locations from the extension module directory, not the process working directory or the source repository path, so project-local and global installations each own their data.

User-supplied external paths are references to existing user-owned files, not extension-owned storage. An extension may read such a file when the user explicitly selects it; uploads and extension-generated copies must be stored inside the extension folder.

### Consequences

- Removing an extension folder also removes its extension-owned data.
- Folder replacement during an update can remove data unless the update mechanism preserves it; keeping data locally does not itself guarantee survival across updates or reinstalls.
- This rule applies to new storage and storage changes. Existing extensions using external stores require separate migration work; this addendum does not claim they have all been migrated.

### Guardrails for Agents

- Keep all extension-owned configuration, assets, state, generated files, and caches inside the owning extension folder.
- Resolve storage relative to the installed extension and verify the directory in extension-local tests.
- Do not introduce separate home-directory or temporary-directory storage for extension-owned data.
- Do not silently modify user-owned external files referenced by configuration.

## Related Decisions

- [ADR-0029: Lifecycle-Hook Extension System](0029-lifecycle-hook-extension-system.md) — core/extension dependency boundary
- [ADR-0030: Runtime-Transpiled Extension UI Components](0030-runtime-jsx-transpiled-extension-ui.md) — host-injected UI contract
- [ADR-0039: Vitest Multi-Config Testing and Playwright E2E](../testing-tooling/0039-vitest-multi-config-and-playwright.md) — test co-location and environment selection

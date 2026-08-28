# ADR-0031: npm Workspaces Monorepo Layout

## Status

Accepted (2026-08-28)

## Context

The project produces several artifacts with different distribution models: the Electron app (GitHub releases/installers), published npm libraries (`@aiderdesk/common`, `@aiderdesk/extensions`, `@aiderdesk/mcp-server`, `@aiderdesk/tree-sitter-utils`), and a generated published app package (`@aiderdesk/aiderdesk`). Code must be shared between the app and the published packages without publish-time copying or version skew between siblings.

## Decision Drivers

- **Must** share types and utilities between app and published packages from one source
- **Must** publish packages independently (common is a dependency of mcp-server and extensions ecosystem)
- **Must** keep the lockfile authoritative for the whole workspace
- **Should** keep CI/build simple (one install, per-package builds)

## Considered Options

### Option A — Separate repositories per package

- **Pros**: Isolation.
- **Cons**: Cross-repo changes for one feature; version skew between common and consumers; heavy tooling.

### Option B — Single repo with npm workspaces

- **Pros**: Root `package.json` `workspaces` covers `packages/*` (app, common, extensions, mcp-server, tree-sitter-utils) alongside `src/`; workspace resolution makes local packages importable by name during development; one lockfile governs everything (critical for the pinning policy, [ADR-0032](0032-exact-version-pinning.md)); per-package builds (tsc/esbuild) produce publishable artifacts.
- **Cons**: Root dependency changes affect all packages; workspace hoisting can shadow nested versions (documented exceptions exist for extensions, [ADR-0032](0032-exact-version-pinning.md)).

## Decision

Use a **single npm-workspaces monorepo**: the Electron app in `src/` (plus its published wrapper `packages/app`), shared code in `packages/common` (`@aiderdesk/common` — types, API contract, locales, extension contract, utilities), extension contract ecosystem in `packages/extensions`, the MCP bridge in `packages/mcp-server`, and tree-sitter code-graph utilities in `packages/tree-sitter-utils`. During development, workspace packages resolve locally; publishing copies/builds per package (`packages/app/scripts/generate-package.mjs` derives the published app package from root). Cross-package imports during development always reference the workspace name (e.g. `@common/*` path aliases for app code; `@aiderdesk/common` for external packages).

## Rationale

Workspaces give atomic cross-package changes and one lockfile — the latter is what makes exact version pinning enforceable at all. Keeping the app's hot paths in `src/` (built by electron-vite) while published libraries live in `packages/` separates build models cleanly.

## Consequences

### Positive

- One-feature-one-PR across app + packages
- Published packages always match the app's shared code
- Single `npm install`, single lockfile, single typecheck entry points

### Negative

- Root-level dependency edits need care (affect everything)
- Hoisting exceptions (nested versions for extensions) need awareness ([ADR-0032](0032-exact-version-pinning.md))

### Risks & Mitigations

- Risk: circular imports between workspace packages — Mitigation: dependency direction is app → common ← packages; guardrails below

## Guardrails for Agents

### Do

- Put cross-process/cross-package shared code in `packages/common`; app-only code stays in `src/`
- Import shared code via the established aliases (`@common/*` in app code) or package names (`@aiderdesk/common`) — never via relative paths crossing package roots
- Run `npm install` at the repo root after any dependency change; the lockfile is authoritative

### Don't

- Never make `packages/common` depend on app code or Electron — it must stay platform-agnostic
- Never create a new published package without a deliberate decision (distribution, versioning, and security review)
- Never edit `package-lock.json` manually

## Related Decisions

- [ADR-0002: Preload IPC Bridge and Shared API Contract](../core-architecture/0002-preload-ipc-bridge-and-api-contract.md)
- [ADR-0032: Exact Version Pinning](0032-exact-version-pinning.md)
- [ADR-0040: electron-vite Build System](../testing-tooling/0040-electron-vite-build-system.md)

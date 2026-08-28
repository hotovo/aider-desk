# ADR-0033: Generated Extension Type Declarations

## Status

Accepted (2026-08-28)

## Context

The extension contract (`Extension` interface and its ~1700 lines of hook documentation) lives in `packages/common/src/extensions.ts` — the single source of truth, edited alongside core changes. Third-party extension authors need those types as a standalone `@aiderdesk/extensions` package with a ready-to-import `extensions.d.ts`. Keeping a hand-maintained copy of the declarations in the extensions package would inevitably drift from the source of truth, producing types that lie about the actual API.

## Decision Drivers

- **Must** guarantee the published extension types exactly match the contract in `packages/common/src/extensions.ts`
- **Must** keep the workflow zero-effort for core contributors (no "remember to update the other file")
- **Should** make the generated artifact obviously non-source (so nobody edits it)

## Considered Options

### Option A — Manually maintained duplicate declarations

- **Pros**: None, beyond not needing a generator.
- **Cons**: Guaranteed drift; the published types become actively misleading; every contract change doubles the work.

### Option B — Auto-generate `extensions.d.ts` from the source contract

- **Pros**: `packages/extensions/extensions.d.ts` is generated from `packages/common/src/extensions.ts` by the build; contributors edit only the source; the artifact is reproducible and always current after a build.
- **Cons**: Requires the generation step in builds/CI (a missing run is visible as a stale artifact).

## Decision

Treat **`packages/extensions/extensions.d.ts` as a build-generated artifact** derived from `packages/common/src/extensions.ts`. It is never edited by hand — changes to the extension contract are made exclusively in the common source, and builds (including the packaging flow from [ADR-0032](0032-exact-version-pinning.md)) regenerate the declaration file for publishing.

## Rationale

Single-source generation eliminates the entire class of drift bugs by construction: the published types cannot disagree with the contract because they *are* the contract. This also concentrates contract design discussions on one file, keeping the public API reviewable.

## Consequences

### Positive

- Published extension types can never diverge from the actual implemented contract
- Contract changes are one-file changes
- The generated file's header makes its nature clear to curious contributors

### Negative

- Builds must run the generation step before publishing
- Tooling that greps the `.d.ts` sees generated formatting, not hand-written organization

### Risks & Mitigations

- Risk: someone "fixes" a type error directly in `extensions.d.ts` — Mitigation: the file is regenerated on next build (their fix silently vanishes), and guardrails below direct edits to the source

## Guardrails for Agents

### Do

- Make all extension-contract changes in `packages/common/src/extensions.ts`
- Rebuild (or run the generator) after contract changes so the `.d.ts` and published package refresh
- Mention in PRs when the extension contract changed — it is a public API change

### Don't

- Never edit `packages/extensions/extensions.d.ts` — it is generated and will be overwritten
- Never treat the generated file as documentation to link; link the source contract instead
- Never add contract surface in the extensions package itself

## Related Decisions

- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)
- [ADR-0031: npm Workspaces Monorepo](0031-npm-workspaces-monorepo.md)
- [ADR-0032: Exact Version Pinning](0032-exact-version-pinning.md)

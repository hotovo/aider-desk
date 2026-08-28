# ADR-0032: Exact Version Pinning for Published Packages

## Status

Accepted (2026-08-28)

## Context

Several workspace packages are published to npm (`@aiderdesk/aiderdesk`, `@aiderdesk/extensions`, and the range-based legacy packages). npm strips `package-lock.json` from published tarballs, so any `^`/`~` range in a published package's dependencies floats at the *consumer's* install time. A floating transitive dependency can break consumer installs or behavior weeks after a clean release — nondeterminism the project cannot test against.

## Decision Drivers

- **Must** make consumer installs reproducible — what we test is what they get
- **Must** keep the root lockfile the single source of resolved versions
- **Must** have a mechanical path for version bumps (automation exists: `update-ai-sdk-dependencies.yml` writes exact pins)
- **Must** handle the documented exceptions honestly rather than pretending they don't exist

## Considered Options

### Option A — Standard caret ranges (npm default)

- **Pros**: Consumers pick up patch fixes automatically.
- **Cons**: Uncontrolled floating at install time; breakage appears "spontaneously"; impossible to reproduce reported issues; untested combinations shipped to users.

### Option B — Exact pinned versions everywhere in published packages

- **Pros**: Consumer installs resolve to exactly the tested tree; root pinning propagates to published output via `generate-package.mjs` (which copies versions verbatim from root); lockfile stays authoritative.
- **Cons**: Consumers get no automatic fixes (release cadence controls it); every bump requires a lockfile-syncing `npm install`; discipline required — reintroducing ranges is a latent outage.

## Decision

Pin **exact versions** (no `^`/`~`) for all dependencies in the root `package.json`, `packages/app/package.json`, and `packages/extensions/package.json`. `packages/app/scripts/generate-package.mjs` copies these pins verbatim into the published `@aiderdesk/aiderdesk` package, so root pinning propagates on build. Version bumps change the pin and run `npm install` to sync `package-lock.json`. **Documented exceptions**: the ranged entries under root `overrides` (`@tootallnate/once`, `jsondiffpatch`) are intentional — neither exists in the lockfile, so there is no resolved version to pin; and `packages/extensions`' `peerDependencies` (`zod`) stays a range, because peers declare consumer compatibility and install nothing. Prefer the *nested* resolved versions under `packages/extensions/node_modules/` when they differ from hoisted ones (e.g. `chalk`, `commander`, `execa`, `ora`). Remaining packages (`common`, `mcp-server`, `tree-sitter-utils`) still use ranges — known gap, not yet covered by this policy.

## Rationale

Exact pins convert "works on my machine" into "works on every machine", which for an app distributed via npm-generated packages is the difference between supportable and not. The lockfile remains the resolution authority; pins just freeze its decisions into artifacts consumers install.

## Consequences

### Positive

- Reproducible consumer installs; test/prod parity
- Automated workflows can manage bumps mechanically (exact-pin writing)
- Security response is explicit: bumping a pin is a visible change

### Negative

- No automatic patch fixes for consumers
- Migration burden for the not-yet-pinned packages
- Exceptions must be re-justified if lockfile topology changes

### Risks & Mitigations

- Risk: an agent "normalizes" a pin back to a caret range — Mitigation: guardrails below; this is called out explicitly in `AGENTS.md` as a policy violation

## Guardrails for Agents

### Do

- Bump versions by editing the exact pin and running `npm install` to sync the lockfile — both steps, always
- Preserve the documented exceptions (overrides ranges; `zod` peer range) exactly as they are
- Check nested resolutions under `packages/extensions/node_modules/` when reasoning about extension-package dependencies

### Don't

- Never reintroduce `^` or `~` ranges into root, `packages/app`, or `packages/extensions` dependencies
- Never hand-edit `package-lock.json` to "fix" version drift
- Never bump a pinned version without a reason (bugfix, security, feature) recorded in the change

## Related Decisions

- [ADR-0031: npm Workspaces Monorepo](0031-npm-workspaces-monorepo.md)
- [ADR-0019: Standalone MCP Server Package](../api-surface/0019-standalone-mcp-server-package.md)

# ADR-0027: Versioned Migrations for Evolving Stored Data

## Status

Accepted (2026-08-28)

## Context

Persisted settings and task context outlive releases, while their schemas and AI SDK message shapes evolve. Existing installations must be upgraded without server-side tooling. Not every persisted domain uses the same format or migration mechanism: global settings have a long sequential version chain, task `context.json` has its own version, and project-level compatibility transforms live in `src/main/project/migrations.ts`.

## Decision Drivers

- **Must** migrate released settings and context formats before current runtime code consumes them
- **Must** keep migration steps ordered, reviewable, and testable
- **Must** preserve user data unless a destructive transform is explicitly justified
- **Must** let each persistence owner define the mechanism appropriate to its format ([ADR-0026](0026-central-data-manager.md))
- **Should** make current code operate on the latest known shape

## Considered Options

### Option A — Tolerant readers only

- **Pros**: No migration files.
- **Cons**: Historical shapes accumulate in runtime branches; renames and structural changes become ambiguous; old combinations are difficult to test.

### Option B — One global migration chain for every persisted artifact

- **Pros**: Uniform version number and startup sequence.
- **Cons**: Couples unrelated backends and lifecycles; does not fit task files, project compatibility transforms, SQLite tables, caches, or LanceDB equally.

### Option C — Owner-specific versioning and ordered migrations

- **Pros**: `Store` applies settings migrations from `src/main/store/migrations/`; `ContextManager` upgrades versioned task context through `src/main/task/migrations/`; project compatibility code owns project-level transforms. Each owner can test and persist its upgraded shape appropriately.
- **Cons**: Contributors must identify the correct owner and cannot assume every stored file has an explicit version field.

## Decision

Use **owner-specific migrations** for durable formats that require compatibility transforms:

- `Store` maintains `CURRENT_SETTINGS_VERSION` and applies the ordered settings/provider chain under `src/main/store/migrations/` before exposing current settings.
- `ContextManager` maintains `CURRENT_CONTEXT_VERSION` and applies task-context migrations under `src/main/task/migrations/` while loading `context.json`.
- Project-level compatibility transforms remain in `src/main/project/migrations.ts` and are invoked by project startup/migration flows.
- Other backends follow their owning subsystem's schema policy; they are not automatically covered by the settings chain.

Once a migration has shipped, preserve its behavior. Fix subsequent compatibility issues with a new version/step unless correcting the old step is necessary to make upgrades from that historical version possible and is backed by tests.

## Rationale

Sequential migration chains bound runtime complexity for settings and context while respecting the domain-owned persistence architecture. Explicitly limiting the decision to formats that actually use versions avoids the false rule that every cache, task metadata file, database table, or vector index shares one mechanism.

## Consequences

### Positive

- Released settings and conversation contexts can be upgraded predictably
- Current runtime paths mostly consume current shapes
- Migration responsibilities follow storage ownership
- Individual transforms are small enough to test directly

### Negative

- Migration mechanisms differ across domains
- Additive defaults in tolerant readers can coexist with explicit version changes, so contributors must inspect the owner
- Historical migration code accumulates and must remain buildable

### Risks & Mitigations

- Risk: a schema change omits required compatibility work — Mitigation: inspect persisted examples and add owner-specific migration tests
- Risk: migration order or version constants diverge — Mitigation: keep imports and progression explicit in the owning loader
- Risk: migration fails after partially changing files — Mitigation: make transforms idempotent where practical and preserve/backup important source data during destructive operations

## Guardrails for Agents

### Do

- Identify which manager owns the persisted format before changing its schema
- Bump the relevant version and add the next ordered migration when old data cannot be read safely by defaults alone
- Test representative old, missing, and current-version inputs
- Preserve unknown fields where forward compatibility matters
- Ensure the loader persists or consistently uses the migrated result

### Don't

- Don't add a migration to the settings chain for a task-, project-, database-, or memory-owned format
- Don't assume every persisted object has an explicit schema version
- Don't scatter historical-shape handling throughout current feature code when a load-time migration is appropriate
- Don't reorder or silently remove released migration steps
- Don't make destructive transforms without backup/recovery considerations and focused tests

## Related Decisions

- [ADR-0007: Agent Profiles and System Prompts](../agent-system/0007-agent-profiles-and-system-prompts.md)
- [ADR-0016: Task Lifecycle and Persistence](../task-and-project/0016-task-lifecycle-and-persistence.md)
- [ADR-0026: Domain-Owned Persistence Backends](0026-central-data-manager.md)

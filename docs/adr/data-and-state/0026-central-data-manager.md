# ADR-0026: Domain-Owned Persistence Backends

## Status

Accepted (2026-08-28)

## Context

AiderDesk persists data with different access and lifecycle requirements: global settings and provider profiles, task metadata and conversation context, usage records, extension state, agent memory, caches, and user-managed agent/MCP configuration. These domains do not fit one storage engine. The existing `DataManager` name can also be misleading: `src/main/data-manager/data-manager.ts` owns the SQLite database used for usage records and extension key/value state; it is not the persistence gateway for every subsystem.

## Decision Drivers

- **Must** choose storage according to each domain's query, portability, and lifecycle needs
- **Must** keep ownership explicit so callers use the responsible manager rather than a storage backend directly
- **Must** centralize application data paths in `src/main/constants.ts` and related path helpers
- **Should** keep user-recoverable data inspectable where practical
- **Should** avoid forcing unrelated schemas and migrations into one database

## Considered Options

### Option A — One universal persistence service and backend

- **Pros**: One apparent entry point and one durability policy.
- **Cons**: Does not match the code or the domains; settings, task files, vector search, usage queries, and caches have different requirements; creates a god-object and coupled migrations.

### Option B — Domain-owned managers with purpose-specific backends

- **Pros**: `Store` uses `conf` for global settings; `Task` and `ContextManager` own task JSON; `DataManager` uses `node:sqlite` for usage and extension state; `MemoryManager` owns LanceDB; specialist managers own their configuration and caches. Each domain can evolve independently.
- **Cons**: There is no single persistence transaction or migration mechanism; path, error-handling, and write-safety conventions must be applied consistently across managers.

## Decision

Use **domain-owned persistence with purpose-specific backends**:

- `Store` (`src/main/store/store.ts`) owns global settings, open projects, providers, window state, user ID, and their `conf`-backed migration chain.
- `Task` and `ContextManager` own task metadata and versioned `context.json` files under the task directory.
- `DataManager` owns the SQLite `messages` and `extension_state` tables for usage reporting and extension-scoped state.
- `MemoryManager` owns its LanceDB database and local embedding lifecycle.
- Agent profile, MCP configuration, model cache, and similar managers own their respective files.

Shared constants determine storage locations, while callers use the owning manager's API instead of accessing another domain's files or tables directly.

## Rationale

The current architecture intentionally combines inspectable files, a small relational database, and an embedded vector store. Making that split explicit is safer than describing a central manager that does not exist. Domain ownership keeps persistence behavior close to the invariants it protects while shared path constants preserve relocatability.

## Consequences

### Positive

- Storage technology matches domain behavior rather than organizational convenience
- Task and configuration data remain inspectable and portable
- Usage queries, extension state, and vector search use suitable backends
- Persistence changes have a clear owning subsystem

### Negative

- Durability guarantees differ by backend; there is no cross-domain transaction
- Several managers perform direct filesystem writes and need their own concurrency/error handling
- The generic `DataManager` name can still cause confusion unless its limited role is preserved in documentation

### Risks & Mitigations

- Risk: a feature writes into another domain's storage directly — Mitigation: expose operations on the owning manager and review storage ownership explicitly
- Risk: hardcoded paths break portable/server deployments — Mitigation: use constants and established path helpers
- Risk: a new backend is introduced casually — Mitigation: require an ADR or an update to this record for a new durable data category

## Guardrails for Agents

### Do

- Identify the owning domain before adding or changing persisted data
- Use `Store` for global settings, task classes for task files, `DataManager` for usage/extension state, and `MemoryManager` for memory data
- Use established constants for application storage paths
- Add migrations and tests in the owning subsystem when a versioned schema changes
- Preserve existing serialization formats unless a migration is part of the change

### Don't

- Don't treat `DataManager` as a universal JSON persistence service
- Don't route unrelated application state into the SQLite `messages` or `extension_state` tables
- Don't bypass an owning manager to mutate its files, database, or vector index
- Don't assume all persistence is atomic or centrally locked; inspect the selected backend's guarantees
- Don't hardcode absolute or home-relative application data paths

## Related Decisions

- [ADR-0011: Local Vector Memory System](../agent-system/0011-agent-memory-system.md)
- [ADR-0016: Task Lifecycle and Persistence](../task-and-project/0016-task-lifecycle-and-persistence.md)
- [ADR-0027: Versioned Migration Chains](0027-versioned-migration-chains.md)
- [ADR-0028: Renderer-Side Local Persistence](0028-renderer-local-persistence.md)
- [ADR-0029: Lifecycle-Hook Extension System](../extensions/0029-lifecycle-hook-extension-system.md)

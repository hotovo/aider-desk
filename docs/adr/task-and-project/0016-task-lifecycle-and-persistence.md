# ADR-0016: Task Lifecycle and Persistence

## Status

Accepted (2026-08-28)

## Context

All user work is organized into **tasks**: a conversation with an agent or Aider, a set of context files, state (todo items, change requests, question flows), and associated settings. Tasks outlive app restarts, must be resumable, exportable (image/markdown), duplicable, and archivable. Task metadata and context are persisted as separate JSON files and are updated during active work, so write failures and interrupted writes must be handled explicitly as the formats evolve.

## Decision Drivers

- **Must** persist tasks on disk per project in a human-inspectable format
- **Must** capture full context: `ContextMessage`s, context files, `TaskStateData` (state emoji/status, todo list), settings overrides
- **Must** support lifecycle operations: create, archive/unarchive, delete, duplicate, clear, export
- **Should** keep schema evolvable via migrations ([ADR-0027](../data-and-state/0027-versioned-migration-chains.md))

## Considered Options

### Option A — Database (SQLite) for task storage

- **Pros**: Transactions, querying.
- **Cons**: Binary blobs hinder inspection/backup/sync; heavier dependency; harder per-task file management for agents.

### Option B — One directory per task under the project's `.aider-desk/tasks/`, JSON files managed by task/context managers

- **Pros**: Human-readable, per-task isolation (copy/move/delete = fs ops), and git-friendly; `context-manager.ts` handles the message/file context, `task.ts` the metadata and lifecycle, and `aider-manager.ts` binds the Aider engine; versioned context migrations evolve conversation data.
- **Cons**: No cross-task queries (acceptable — task lists are read into memory); many small files.

## Decision

Persist each task as a **directory of JSON files** under `<project>/.aider-desk/tasks/<taskId>/`, managed by `Task`, `ContextManager`, and `AiderManager` (`src/main/task/`). Task identity uses UUIDs (`uuidv4`). `task.json` stores task metadata; versioned `context.json` stores the conversation (`ContextMessage[]`, including tool messages) and context files; additional task-owned files hold data such as todos. `ContextManager` applies the task-context migration chain described by [ADR-0027](../data-and-state/0027-versioned-migration-chains.md). Lifecycle events (created, cleared, updated) broadcast over the event bus ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)); worktree-mode tasks resolve their working directory through the worktree integration ([ADR-0017](0017-git-worktree-integration.md)).

## Rationale

File-per-task aligns with how tasks are consumed (one at a time, in full), enables direct export/duplicate/archive operations, and keeps data inspectable and agent-accessible. Versioning the conversation context supports AI SDK message-format evolution without coupling tasks to the SQLite usage database.

## Consequences

### Positive

- Tasks are portable, inspectable, and safely deletable
- Task metadata and conversation context persist across app restarts
- Export (image/markdown) and duplication are straightforward file operations

### Negative

- No cross-task querying; task lists load from disk scanning (fine at realistic scales)
- Concurrent writers to one task must be avoided (single writer: the task's owning flow)

### Risks & Mitigations

- Risk: an interrupted direct JSON write leaves a partial file — Mitigation: keep writes within the owning task classes, surface load/write failures, and introduce atomic write/backup behavior before claiming crash safety

## Guardrails for Agents

### Do

- Store new task-scoped data through the owning `Task`/`ContextManager` structures and shared types; bump the context version and add a migration when changing persisted context shape incompatibly
- Write task files only through `Task`/`ContextManager` — never write into `.aider-desk/tasks/` directly
- Emit lifecycle events after mutations so all clients refresh

### Don't

- Never invent a second storage location/format for task data
- Never assume a task directory is mutable by outsiders while its task is running
- Never drop unknown fields when (de)serializing task JSON — forward compatibility matters

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0015: Aider vs Agent Mode](../aider-integration/0015-aider-vs-agent-mode-coexistence.md)
- [ADR-0017: Git Worktree Integration](0017-git-worktree-integration.md)
- [ADR-0027: Versioned Migration Chains](../data-and-state/0027-versioned-migration-chains.md)

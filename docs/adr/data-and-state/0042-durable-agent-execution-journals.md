# ADR-0042: Application-Local Durable Agent Execution Journals

## Status

Accepted (2026-10-14)

Partially supersedes the task-storage boundary in [ADR-0016](../task-and-project/0016-task-lifecycle-and-persistence.md) and the SQLite ownership boundary in [ADR-0026](0026-central-data-manager.md). Their other decisions remain in force.

## Context

Conversation persistence records completed agent steps, but an unfinished step can contain completed external operations. Restarting from conversation history alone loses those outcomes and can repeat operations. Main agents and subagents share a task while maintaining separate execution identities.

The requested implementation uses the existing application SQLite database. This introduces authoritative, task-scoped execution state outside the portable task directory and must be distinguished from usage analytics and from the finalized conversation.

## Decision Drivers

- Persist tool intent before executing and finalized outcomes independently for parallel tools.
- Recover subagents by their existing parent/child identities, not by spawning duplicates.
- Prevent execution replay when a tool owner, effective arguments, or permission changes incompatibly.
- Never publish raw results that have not passed result-finalization hooks.
- Encapsulate journal policy in DurabilityManager, with DataManager providing SQLite operations.

## Considered Options

### Task-owned execution storage

A task-local SQLite database or journal would preserve task-directory portability, but would add a separate storage lifecycle and backend instead of the requested existing DB.

### Application-local SQLite execution storage

Reuses the synchronous transactional backend and central database lifecycle, but unfinished execution state does not travel with task directories.

## Decision

Use the dedicated agent_execution_journal table in the application-local SQLite database. Each record is keyed by project path, task ID, and prompt-context ID. DurabilityManager owns execution state, recovery policies, parent/child ownership, context replacement, finalization, and cleanup. Other modules must not interpret journal JSON directly.

The SQLite journal is authoritative for unfinished execution and for a completed child awaiting its parent's handoff. Task/ContextManager remain authoritative for finalized conversations in context.json. The handoff uses stable message identities, an awaited context save, and journal deletion only after successful persistence; SQLite and context.json do not form one transaction.

Tool invocation identities include parent-scoped ordinals for nested calls without SDK identities. Checkpoints bind the exposed tool name to a canonical owner. Replayed effective arguments must remain identical; a conflicting hook rewrite is refused.

Tool execution completion and result finalization are separate states. Raw output is not persisted between execution and onToolFinished/toModelOutput. If finalization is interrupted, recovery reports that execution completed but publishable output is unavailable; it does not repeat the external operation to retrieve output. Legacy Completed records without proof of finalization are conservatively replaced with that notice, including cached pending-step messages.

Context compaction replaces the execution's current conversation snapshot rather than appending to its precompaction transcript. Internal summary runs use an independent identity and do not recover or mutate the main execution. Explicit cancellation finalizes known progress and clears the owned journal tree; ordinary shutdown leaves execution recoverable.

## Consequences

### Positive

- Completed parallel results survive interruption and process restart.
- Safe interrupted operations and their subagents can resume automatically.
- Existing application database operations remain centralized, while recovery logic has a domain owner.

### Negative and portability limitation

- An unfinished execution journal is **application-local and not portable with its task directory**.
- Moving a project changes its journal lookup identity. Copying, exporting, duplicating, or restoring only task files does not transfer pending execution or results checkpointed only in SQLite.
- Such a task retains its finalized conversation but cannot claim to resume the original pending execution. Resume without its journal is conversation-based continuation, not restoration of that execution.
- A complete same-identity recovery backup needs both the task files and application database. Renaming/rebinding projects or transferring active journals needs an explicit future migration/export protocol; do not automatically rebind an old journal to a copied task.
- Finalization interruption intentionally sacrifices unavailable output rather than duplicate external operations or expose unsanitized results.

## Guardrails for Agents

- Use DurabilityManager for journal operations and DataManager only as its persistence adapter.
- Do not put execution state into usage messages or extension_state.
- Do not claim that copying a task directory transfers active execution state.
- Do not replay against a replacement owner, execute a changed operation under an old identity, or publish an execution-only result as finalized output.
- Preserve finalized nested outcomes in an interruption envelope even when an unfinished parent uses Forget.
- Checkpoint conversation replacement before its filesystem handoff; do not clear the active journal during compaction.
- Keep model-facing recovery instructions separate from localized renderer presentation.

## Related Decisions

- [ADR-0010: Context Compaction](../agent-system/0010-context-compaction-and-optimization.md)
- [ADR-0016: Task Lifecycle and Persistence](../task-and-project/0016-task-lifecycle-and-persistence.md)
- [ADR-0026: Central DataManager](0026-central-data-manager.md)
- [ADR-0029: Extension Lifecycle Hooks](../extensions/0029-lifecycle-hook-extension-system.md)

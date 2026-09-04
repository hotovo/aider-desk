# ADR-0017: Git Worktree Integration

## Status

Accepted (2026-08-28)

## Context

Parallelizing AI-assisted work on one repository is dangerous on a single checkout: two agents editing simultaneously create conflicts and clobber each other's uncommitted changes. Git worktrees provide isolated checkouts of the same repo, but raw worktrees are awkward (manual paths, merges, rebases, conflict resolution). The application must make worktree-based task execution safe and mostly invisible to users and agents.

## Decision Drivers

- **Must** let tasks run in an isolated worktree so parallel tasks don't interfere
- **Must** provide safe merge/rebase back into the base branch, with conflict prediction and AI-assisted resolution
- **Must** handle uncommitted files and ahead commits explicitly (`WorktreeUncommittedFiles`, `WorktreeAheadCommits`, `UpdatedFile`)
- **Should** guarantee no concurrent mutations of shared git state (locking)

## Considered Options

### Option A — Branch switching in a single checkout

- **Pros**: No extra directories.
- **Cons**: Serializes work; uncommitted changes block switching; agents stomp on each other.

### Option B — Managed worktrees with explicit merge/rebase state machines

- **Pros**: True isolation per task/working mode (`WorkingMode.Local | Worktree`); state machines (`MergeState`, `RebaseState`) make multi-step git operations resumable and predictable; conflict resolution gets first-class file context (`ConflictResolutionFileContext`) for AI assistance; `withLock` serializes git mutations.
- **Cons**: Significant git-orchestration code; worktree paths must be managed and cleaned up.

## Decision

Implement managed worktrees in `src/main/worktrees/worktree-manager.ts`. Worktrees are created under the project's `.aider-desk` tasks area (`AIDER_DESK_TASKS_DIR`) and tracked with full state: ahead commits, uncommitted files (with binary detection via `istextorbinary`), updated files grouped by `UpdatedFilesGroupMode`. Merges and rebases run as explicit state machines with conflict prediction, AI-assisted conflict resolution, and custom commit messages; all mutation paths take locks (`withLock`, `execWithShellPath`). When the project directory is on a different branch than the merge target, merge/squash update the target branch ref directly (fast-forward check + `git update-ref`, squash via `git commit-tree`) instead of checking the target branch out, leaving the project working tree untouched; uncommitted worktree changes are only ever applied to a working tree whose checked-out branch they belong to (`applyUncommittedChanges` targets the currently checked-out branch and never switches branches). Status (`WorktreeIntegrationStatus`) streams to clients over the event bus ([ADR-0003](../core-architecture/0003-socket-io-event-bus.md)), and task-level integration (task working mode, task worktree lifecycle) is exposed through the UI and REST.

## Rationale

Worktrees are the only git-native mechanism giving true filesystem isolation for parallel tasks; wrapping them in explicit state machines converts git's "hope nothing conflicts" workflow into a predictable, resumable, AI-assistable process. Locking closes the remaining race conditions around shared refs.

## Consequences

### Positive

- Parallel agents/tasks on one repo are safe by construction
- Conflicts surface early (prediction) and can be resolved with AI assistance in-context
- Multi-step git operations survive interruption with visible state

### Negative

- Disk usage grows with worktrees; cleanup must be managed
- Merge/rebase state machines are complex and need thorough tests (`worktrees/__tests__`)

### Risks & Mitigations

- Risk: user edits a worktree manually mid-operation — Mitigation: status events + uncommitted-file detection make drift visible before destructive operations

## Guardrails for Agents

### Do

- Perform all worktree git operations through `worktree-manager.ts` with its locking — never shell out to `git worktree` ad hoc
- Respect `WorkingMode` when resolving paths: a worktree-mode task's files live in the worktree, not the base checkout ([ADR-0016](0016-task-lifecycle-and-persistence.md))
- Surface merge/rebase state changes as events; never poll silently

### Don't

- Never force-push, hard-reset, or delete worktrees/branches without checking `MergeState`/`RebaseState` and uncommitted files
- Never run concurrent mutating git operations on the same repo outside the manager's locks
- Never assume the task's working directory equals the project root — resolve via working mode

## Related Decisions

- [ADR-0003: Socket.IO Event Bus](../core-architecture/0003-socket-io-event-bus.md)
- [ADR-0016: Task Lifecycle and Persistence](0016-task-lifecycle-and-persistence.md)

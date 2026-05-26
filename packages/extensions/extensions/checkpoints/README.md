# Checkpoints Extension

Git-based checkpoints for AiderDesk — automatically creates snapshots of your working tree before every file edit, letting you revert the codebase to the state before any edit.

## How It Works

1. **Automatic snapshots** — Before each `file_edit` or `file_write` power tool execution, a git checkpoint is created capturing the entire worktree state (HEAD, index, untracked files).
2. **Reset to checkpoint** — A "↩ Reset to checkpoint" button appears above each successful edit tool message. Clicking it restores the entire codebase to the state before that edit.
3. **Confirm to proceed** — The first click changes the button to a confirmation step (red "Confirm" + cancel ✕). A second click executes the revert.
4. **Safe cleanup** — After reverting, all checkpoints created after the reverted point are removed (those edits no longer exist in the codebase).

## Features

- **No configuration required** — works automatically in any git repository
- **Full codebase restore** — resets all files (tracked + untracked) to the checkpoint state
- **Survives restarts** — checkpoints are stored as git refs under `refs/aiderdesk-checkpoints/`
- **Smart filtering** — excludes `node_modules`, `.venv`, `dist`, `build`, large files (>10 MiB), and large directories (>200 files) from snapshots
- **Persistent index** — checkpoint metadata stored in `.aider-desk/checkpoints/<taskId>.json` (survives git restores, persists across sessions)
- **Worktree support** — correctly handles git worktree working mode (git ops target the worktree, storage stays in the project root)
- **Auto-prune** — deletes checkpoint refs from previous tasks on first use per session

## Storage

| Location | Purpose |
|----------|---------|
| `refs/aiderdesk-checkpoints/*` | Git refs containing the checkpoint commits (survives restarts) |
| `.aider-desk/checkpoints/<taskId>.json` | Per-task checkpoint index mapping message IDs to ref names |

## Limitations

- Only works in git repositories
- Checkpointing is per-tool (before each `file_edit` / `file_write`), not per-bash-command
- Restoring reverts the **entire codebase** to the checkpoint state — not just the displayed file
- Uncommitted changes present at checkpoint time are captured in the snapshot and restored correctly

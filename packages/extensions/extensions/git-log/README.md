# Git Log

Browse the git history of open projects with an IntelliJ IDEA-style log viewer.

## Features

- **Header button** — a git-branch icon in the header (`header-right` placement) opens the viewer.
- **Commit list** — virtualized list (only visible rows are rendered) with infinite scrolling.
- **Project & branch selectors** — pick any open project and filter by branch (or view all branches).
- **Search** — filter commits by message, author, or hash.
- **Commit details** — author, date, full hash, message body, changed files with status and `+/-` counts.
- **Diffs** — view the full commit diff or a per-file diff.

## How it works

The extension runs `git` commands from the main process (via `node:child_process`)
and exposes them to the UI through `executeUIExtensionAction`:

- `get-log(projectDir, branch, skip, limit)` — paginated commit history.
- `get-branches(projectDir)` — local and remote branches.
- `get-commit-detail(projectDir, hash)` — changed files and full diff.
- `get-file-diff(projectDir, hash, path)` — diff for a single file.

# Git Log

Browse the git history of open projects with an IntelliJ IDEA-style log viewer.

## Features

- **Header button** — a git-branch icon in the header (`header-right` placement) opens the viewer.
- **Commit list** — virtualized list (only visible rows are rendered) with infinite scrolling.
- **Project & branch selectors** — pick any open project and filter by branch (or view all branches).
- **Search** — filter commits by message, author, or hash.
- **Commit details** — author, date, full hash, message body, changed files with status and `+/-` counts.
- **Diffs** — view the full commit diff or a per-file diff.
- **Commit context menu** — right-click a commit for IntelliJ IDEA-style actions:
  - `Copy Revision Number`
  - `Create Patch…` — `git format-patch` for the commit
  - `Cherry-Pick` — apply the commit onto the current branch
  - `Checkout Revision` / `Show Repository at Revision` / `Compare with Local`
  - `Reset Current Branch to Here…` — soft / mixed / hard
  - `Revert Commit`
  - `Undo Commit…` — soft / mixed (enabled when the commit is the checked-out HEAD)
  - `Edit Commit Message…` — amend the HEAD commit message (F2-style, enabled on HEAD only)
  - `Push All up to Here…` — push commits up to the selected commit (with force option)
  - `New Branch…` / `New Tag…` — created at the selected commit
  - `Go to Parent Commit` / `Go to Child Commit`
  - `View in browser` — opens the commit on GitHub / GitLab / Bitbucket (when inferrable from origin)
- `Reset`, `Revert`, and `Undo` guard against a dirty working tree and show git errors in a banner.
- `Undo Commit` / `Edit Commit Message` are only enabled when the selected commit equals the
  checked-out branch HEAD and has not been pushed to its upstream yet (matching IntelliJ IDEA).

## How it works

The extension runs `git` commands from the main process (via `node:child_process`)
and exposes them to the UI through `executeUIExtensionAction`:

- `get-log(projectDir, branch, skip, limit)` — paginated commit history.
- `get-branches(projectDir)` — local and remote branches.
- `get-commit-detail(projectDir, hash)` — changed files and full diff.
- `get-file-diff(projectDir, hash, path)` — diff for a single file.
- `git-context(projectDir)` — HEAD hash, current branch, dirty state, origin URL.
- `create-patch(projectDir, hash)` — `git format-patch` to the project directory.
- `cherry-pick(projectDir, hash)`, `checkout-revision(projectDir, hash)`,
  `reset-branch(projectDir, hash, mode)`, `revert-commit(projectDir, hash)`,
  `undo-commit(projectDir, mode)`, `amend-message(projectDir, subject, body)`,
  `push-up-to(projectDir, hash, force)`, `create-branch(projectDir, name, hash)`,
  `create-tag(projectDir, name, hash)` — history mutations.
- `compare-local(projectDir, hash)` — diff of the commit against the working tree.
- `get-neighbors(projectDir, hash)` — parent and child commit hashes.
- `open-commit-url(projectDir, hash)` — opens the commit web page (GitHub/GitLab/Bitbucket).

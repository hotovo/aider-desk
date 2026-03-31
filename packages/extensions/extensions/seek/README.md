# Seek Extension

Fast ranked code search using [seek](https://github.com/dualeai/seek) (powered by zoekt) — replaces the internal `power---grep` tool with faster, relevance-ranked searches.

## How It Works

This extension wraps the `seek` CLI binary and overrides the built-in `power---grep` tool. When the agent uses grep, the search is routed through seek instead, providing:

- **BM25 relevance ranking** — best matches first, not file-path order
- **Trigram indexing** — O(matches) per query instead of O(corpus)
- **Context included** — 3 lines of surrounding code with every match
- **Uncommitted file awareness** — modified files indexed and tagged `[uncommitted]`
- **Parallel-safe** — flock-based locking for concurrent agents

## Prerequisites

1. **seek** — auto-installed on first use, or install manually:
   ```bash
   curl -sSfL https://raw.githubusercontent.com/dualeai/seek/main/install.sh | sh
   ```
   Alternative (requires Go):
   ```bash
   go install github.com/dualeai/seek/cmd/seek@latest
   ```

2. **universal-ctags** — required for symbol indexing (`sym:` search):
   ```bash
   # macOS
   brew install universal-ctags
   
   # Linux
   sudo apt-get install universal-ctags
   ```

3. **Git 2.31+** — required for native git worktree support (older versions work for normal repos)

## Installation

```bash
npx @aiderdesk/extensions install seek
```

Or manually copy this directory to `~/.aider-desk/extensions/seek/`.

## Usage

Once installed, the extension automatically replaces the built-in `power---grep` tool. No configuration needed — use grep as you normally would.

### Auto-Install

If `seek` is not found on the system when the tool first executes, the extension will attempt to install it automatically via the install script. If auto-install fails (e.g., no `curl` available), the error message will include manual install instructions.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `seek: command not found` | Install seek manually (see Prerequisites above) |
| `seek` exits with error code 2 | Check stderr for details — usually a query syntax issue or indexing failure |
| Slow first search | seek builds an index on first use; subsequent searches are ~150ms |
| Symbol search not working | Install universal-ctags (see Prerequisites above) |
| `.seek-cache/` in project root | This is seek's index cache; add it to `.gitignore` |

## Technical Details

- The `power---grep` input schema is mapped to seek's zoekt query syntax:
  - `searchTerm` → `content:/<regex>/`
  - `filePattern` (glob) → `file:/<regex>/` (glob converted to regex)
  - `caseSensitive` → `case:yes` / `case:no`
  - `maxResults` → output truncated to N file blocks
- The index is stored in `.seek-cache/` at the project root
- seek handles incremental re-indexing automatically (dirty file tracking)

## License

MIT

# FFF Extension

Fast file content search using [FFF (Freakin Fast File Finder)](https://github.com/dmtrKovalenko/fff.nvim) — replaces the internal `power---grep` tool with FFI-based Rust-powered searches.

## How It Works

This extension uses the `@ff-labs/fff-node` Node.js SDK to call the FFF Rust library directly via FFI (no subprocess per query). It overrides the built-in `power---grep` tool, providing:

- **FFI-based Rust engine** — direct native library calls, no subprocess overhead
- **Regex search** — full regex support matching built-in grep behavior
- **Context lines** — configurable before/after context for each match
- **Smart case** — intelligent case sensitivity matching
- **Auto-indexing** — project indexed on open with `waitForScan()` for readiness

## Prerequisites

The `@ff-labs/fff-node` package is installed as a dependency and includes the native Rust library. No separate installation is needed.

If the native library is not available on your platform, the extension will log an error and fall back to the built-in grep tool.

## Installation

```bash
npx @aiderdesk/extensions install fff
```

Or manually copy this directory to `~/.aider-desk/extensions/fff/`.

## Usage

Once installed, the extension automatically replaces the built-in `power---grep` tool. No configuration needed — use grep as you normally would.

### How filePattern is handled

The `filePattern` glob is converted to FFF's inline constraint syntax:
- `src/**/*.tsx` → `"src/**/*.tsx <searchTerm>"`
- `*.py` → `"*.py <searchTerm>"`
- `**/*` or `*` → no constraint, just the search term

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `native library not available` | The FFF native library is not supported on your platform; the extension will be disabled |
| `failed to index project` | Check the AiderDesk logs for details; ensure the project directory is accessible |
| Results look incomplete | The `maxResults` parameter limits output; increase it if needed |

## Technical Details

- Uses `FileFinder.create({ basePath, aiMode: true })` for project indexing
- Calls `waitForScan()` during `onProjectStarted` to ensure the index is ready before searches
- Maps `filePattern` glob to FFF constraint prefix syntax
- Maps `contextLines` to both `beforeContext` and `afterContext`
- Maps `caseSensitive` to `smartCase: !caseSensitive`
- Maps `maxResults` to `maxMatchesPerFile`
- Uses `mode: "regex"` to support the regex patterns expected by `power---grep`

## License

MIT

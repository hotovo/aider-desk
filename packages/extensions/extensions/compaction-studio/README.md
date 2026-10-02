# Compaction Studio

Manually compact the current task context with full control over what gets compacted, the safe window, and the compaction level.

![Compaction Studio screenshot](https://raw.githubusercontent.com/hotovo/aider-desk/main/packages/extensions/extensions/compaction-studio/screenshot.png)

## Features

- **Selective compaction**: Choose exactly what to compact — errored/no-op tool calls, file edits, stale file reads, file reads, glob/grep searches, semantic searches, bash outputs, fetch outputs, other tool results, verbose tool calls, and reasoning blocks
- **Per-category stats**: See the count, estimated tokens, and estimated token savings for each category before committing
- **Safe window**: Protect the most recent messages from any compaction (configurable count with quick presets)
- **Compaction levels**: Three truncation levels — Mild, Moderate, and Aggressive — controlling how aggressively tool outputs are truncated or redacted
- **Token estimates**: Before/after estimated token counts, with an info message logged to the chat after each compaction
- **Persistent settings**: Per-task panel visibility and last-used settings are remembered

## Usage

1. Run **`/compaction-studio`** in the prompt field to toggle the panel for the current task.
2. Review the context stats (total messages, ~estimated tokens) and per-category counts.
3. Check the categories you want to compact, set the safe window and compaction level.
4. Click **Compact Now**. The context is compacted and an info message with the estimated tokens after compaction is logged to the chat.

### Slash Command

```
/compaction-studio             # Toggle the Compaction Studio panel
```

### What Each Option Does

| Option | Effect |
|--------|--------|
| **Errored / no-op tool calls** | Removes failed, denied, or no-op tool calls along with their results |
| **File edits & writes** | Collapses repeated edit/write calls per file into a single `<file-edited>` marker |
| **Stale file reads** | Removes file reads superseded by later edits of the same file or re-read in the protected window |
| **File reads** | Truncates file read outputs to the level's line limit (50 / 20 lines, fully redacted at level 3) |
| **Glob / grep searches** | Removes searches made obsolete by later file edits (all searches at level 3) |
| **Semantic searches** | Removes older searches, keeping and truncating the latest (all removed at level 3) |
| **Bash outputs** | Deduplicates repeated commands and redacts stdout/stderr (fully redacted at level 3) |
| **Fetch outputs** | Redacts fetch results to a short notice |
| **Other tool results** | Truncates MCP/extension tool results to the level's token cap (~2k / ~1k tokens, redacted at level 3) |
| **Verbose tool calls** | Removes tool calls with inputs over 150 characters along with their results |
| **Reasoning blocks** | Strips reasoning parts from assistant messages |

### Compaction Levels

| Level | Behavior |
|-------|----------|
| **1 · Mild** | Light truncation: 50 lines of file reads, 20 lines / 2 KB / ~2k tokens for other tool results |
| **2 · Moderate** | Tighter truncation: 20 lines of file reads, 10 lines / 1 KB / ~1k tokens for other tool results, bash outputs redacted |
| **3 · Aggressive** | Redacts compactable outputs entirely; drops obsolete searches, duplicate reads and old semantic searches |

The safe window always applies: messages inside the window are never modified, and none of the checked categories will touch them.

## How It Works

1. Panel visibility and settings are stored per-project in `.aider-desk/compaction-studio.json`
2. When compaction runs, the extension calls the task context's `smartCompact` API with your selected options
3. A context backup is created automatically (undo is available via the chat's **Undo** action)
4. Estimated token counts before and after are computed and logged to the chat
5. Automatic (threshold-triggered) smart compaction is unaffected — this extension only compacts when you click **Compact Now**

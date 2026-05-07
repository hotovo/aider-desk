# Smart Compaction Design

## Overview

A new deterministic compaction type (`Smart`) that reduces conversation context size by applying rule-based transformations to tool messages. Unlike the existing `Compact` type (which uses an LLM to summarize), `Smart` compaction is synchronous, deterministic, and involves no LLM calls.

## Architecture

### New File

`src/main/agent/smart-compaction.ts`

### Main Entry Point

```typescript
smartCompactMessages(messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[]
```

Returns a new array of `ContextMessage[]` that replaces the original. Each pass receives the full message array (including protected window) for decision-making but only modifies messages outside the protected window.

### Processing Passes (in order)

Each pass is a separate function with signature:

```typescript
passName(messages: ContextMessage[], protectedMessageCount = 10): ContextMessage[]
```

#### Pass 1: `removeErroredTools`

Remove tool messages with error/no-op results outside the protected window. Cascade cleanup of corresponding assistant messages.

Error detection patterns:
- Contains "denied by user"
- Contains "Error:" prefix
- Contains "No files found" / "No matches found"
- Contains "Operation was cancelled"
- Contains "Warning:" (file_edit searchTerm not found)
- Contains "Already updated - no changes were needed"

#### Pass 2: `collapseFileEdits`

Collapse `file_edit`/`file_write` chains per file into a single synthetic assistant message.

- Group `file_edit` and `file_write` tool calls by file path
- Remove all tool result messages and their assistant tool-call parts
- Insert a single synthetic `assistant` message at the position of the first occurrence:
  ```
  <file-edited path="src/foo.ts">File was edited. Read the content again if you need to work on it.</file-edited>
  ```
- Same message regardless of edit count
- Only assistant tool-call parts are removed; other content (text, other tool-calls) in the same assistant message is preserved

#### Pass 3: `removeStaleFileReads`

Remove `file_read` messages outside the protected window when:

1. The file was later edited/written (anywhere in full history)
2. The same file was also read within the protected window
3. Not the last read of that file among non-protected messages (dedup keeps last per file)

#### Pass 4: `removeObsoleteSearches`

Remove `glob`/`grep` messages outside the protected window when followed by `file_edit`/`file_write` anywhere in the full history (indicates implementation phase, searches no longer useful). Keep if no file modifications follow (still in planning phase).

#### Pass 5: `compactSemanticSearches`

- Keep only the last `semantic_search` outside the protected window
- Remove all others (cascade cleanup)
- Truncate the kept result to first 50 lines, append `<truncated due to compaction, run again if full output is needed>`
- Output is always `type: 'text'`

#### Pass 6: `deduplicateBash`

- Group `bash` tool messages outside protected window by normalized command
- Keep only the last occurrence per command, remove duplicates
- For kept messages: parse JSON output (`{ stdout, stderr, exitCode }`), redact `stdout`/`stderr` to `<output redacted due to compaction, run again if output is needed>` when character length >30, preserve `exitCode`

#### Pass 7: `redactFetchOutputs`

- Replace output content of `fetch` tool messages outside the protected window with `<content redacted due to compaction, fetch again if content is needed>`
- No removal, only content replacement

### Helper Utilities (private, same file)

- `extractFilePath(args)` — get file path from tool input
- `isErrorResult(toolOutput)` — detect error results
- `getAssistantToolCalls(message)` — extract tool-call parts from assistant message
- `findCorrespondingAssistantMessage(messages, toolCallId)` — find the assistant message containing a given tool call
- Cascade cleanup: remove tool-call part from assistant message, remove assistant message entirely if it becomes empty (no remaining tool-calls or text)

## Integration Points

### Enum Extension

`ContextCompactionType` in `packages/common/src/types/common.ts`:
```typescript
export enum ContextCompactionType {
  Compact = 'compact',
  Handoff = 'handoff',
  Smart = 'smart',
}
```

### Agent Threshold Check (`src/main/agent/agent.ts`)

Handle `Smart` type synchronously — no LLM call, no loading spinner:

```typescript
if (contextCompactionType === ContextCompactionType.Smart) {
  const compactedMessages = smartCompactMessages([...contextMessages, ...resultMessages]);
  task.contextManager.setContextMessages(compactedMessages);
  // Reload and re-add user request, same as Compact flow
}
```

### New Command: `/smart-compact`

Available as a user-invoked command, similar to `/compact`. Triggers `smartCompactMessages` on the current context.

## Key Design Decisions

1. **No LLM involvement** — purely deterministic, synchronous
2. **Protected window** — last 10 messages are never modified; each pass enforces this internally
3. **Read-only access to protected messages** — protected messages are used for decision logic (e.g., "was this file edited?") but never modified
4. **Multi-pass architecture** — each pass is isolated and composable, building on the previous pass's output
5. **Cascade cleanup** — removing a tool message always cleans up the corresponding assistant tool-call; removing the last tool-call from an assistant message removes the assistant message entirely
6. **Focus on power tools only** — memory, subagent, aider, skills, and tasks tools are not modified

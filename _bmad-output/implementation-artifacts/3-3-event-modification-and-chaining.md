# Story 3.3: Event Modification and Chaining

Status: done

## Story

As a **system developer**,
I want **to implement event modification support so extensions and hooks can transform event data**,
So that **multiple extensions can chain modifications and hooks can have final say**.

## Acceptance Criteria

1. **Given** event handlers are called in sequence (extensions first, then hooks)
2. **When** an event handler returns a partial object with modifications
3. **Then** modifications are merged with current event data
4. **And** merged data is passed to next event handler in sequence
5. **And** all events support modification via partial return values
6. **And** empty return `{}` or `undefined` means no changes (pass through)
7. **And** arrays in return values are replaced (not merged) - handler includes all elements
8. **And** objects in return values are shallow-merged
9. **And** last modifier wins for overlapping fields (hooks get final say)
10. **And** blocking is achieved by setting `blocked: true` in return value (for tools, prompts, approvals, subagents)
11. **And** first handler to set `blocked: true` prevents the operation

## Tasks / Subtasks

- [x] Task 1: Define Event Modification Types with readonly Non-Modifiable Properties (AC: All)
  - [x] 1.1 Mark non-modifiable event properties with `readonly` modifier
  - [x] 1.2 Keep modifiable properties without `readonly` (blocked, prompt, files, etc.)
  - [x] 1.3 All event handlers return `Promise<void | Partial<Event>>`

- [x] Task 2: Implement Event Modification in dispatchEvent (AC: #3, #4, #5, #6)
  - [x] 2.1 Merge partial return values with current event using spread
  - [x] 2.2 Pass merged event to next handler in chain
  - [x] 2.3 Handle `undefined` return as no-op
  - [x] 2.4 Handle empty object `{}` return as no-op

- [x] Task 3: Implement Blocking Logic (AC: #10, #11)
  - [x] 3.1 Check `blocked: true` in handler result
  - [x] 3.2 Stop dispatch chain immediately when blocked
  - [x] 3.3 Events that support blocking have `blocked?: boolean` property

## Dev Notes

### Implementation Summary

Event modification is implemented through TypeScript's type system with `readonly` properties:

**Non-Modifiable Properties (readonly):**
- `readonly task: TaskData` - Task reference cannot be changed
- `readonly toolName: string` - Tool name is fixed
- `readonly input: Record<string, unknown>` - Original input preserved
- `readonly aborted: boolean` - Abort status is read-only
- `readonly contextMessages: ContextMessage[]` - Context is protected

**Modifiable Properties (no readonly):**
- `blocked?: boolean` - Can block the operation
- `prompt: string` - Can modify prompt text
- `files: ContextFile[]` - Can modify file list
- `output: unknown` - Can modify tool output
- `responseMessages: ContextMessage[]` - Can modify messages
- `allowed?: boolean` - Can modify approval decision

### Event Type Examples

```typescript
// Task events - task is readonly, nothing to modify
interface TaskInitializedEvent {
  readonly task: TaskData;
}

// Prompt events - prompt can be modified
interface PromptStartedEvent {
  prompt: string;           // Modifiable
  mode: Mode;               // Modifiable
  promptContext: PromptContext; // Modifiable
  blocked?: boolean;        // Can block
}

// File events - files array can be modified/replaced
interface FilesAddedEvent {
  files: ContextFile[];     // Modifiable - return empty array to prevent addition
}

// Tool events - output can be modified
interface ToolFinishedEvent {
  readonly toolName: string;      // Read-only
  readonly input: Record<string, unknown> | undefined; // Read-only
  output: unknown;                // Modifiable
}
```

### Modification Pattern

Extensions return partial event objects to modify events:

```typescript
// Block a prompt
async onPromptStarted(event: PromptStartedEvent, context: ExtensionContext) {
  if (event.prompt.includes('dangerous')) {
    return { blocked: true };
  }
}

// Filter files
async onFilesAdded(event: FilesAddedEvent, context: ExtensionContext) {
  const filtered = event.files.filter(f => !f.path.includes('node_modules'));
  return { files: filtered };
}

// Modify tool output
async onToolFinished(event: ToolFinishedEvent, context: ExtensionContext) {
  if (event.toolName === 'read-file') {
    return { output: sanitizeOutput(event.output) };
  }
}
```

### Events Supporting Blocking

| Event | Blocking Property | Effect |
|-------|-------------------|--------|
| `PromptStartedEvent` | `blocked?: boolean` | Prevents prompt processing |
| `AgentStartedEvent` | `blocked?: boolean` | Prevents agent start |
| `ToolApprovalEvent` | `blocked?: boolean` | Prevents tool approval |
| `ToolCalledEvent` | `blocked?: boolean` | Prevents tool execution |
| `HandleApprovalEvent` | `blocked?: boolean` | Prevents approval handling |
| `SubagentStartedEvent` | `blocked?: boolean` | Prevents subagent spawning |
| `FilesDroppedEvent` | Return `{ files: [] }` | Prevents file addition |
| `FilesAddedEvent` | Return `{ files: [] }` | Prevents file addition |
| `CommandExecutedEvent` | `blocked?: boolean` | Prevents command execution |
| `CustomCommandExecutedEvent` | `blocked?: boolean` | Prevents custom command |

### Project Structure

| File | Purpose |
|------|---------|
| `src/common/extensions/types.ts` | Event interfaces with readonly modifiable properties |
| `src/main/extensions/extension-manager.ts` | dispatchEvent with modification support |

### References

- [Source: src/common/extensions/types.ts - Event type definitions with readonly properties]
- [Source: src/main/extensions/extension-manager.ts - dispatchEvent implementation]

## Change Log

- Date: 2026-02-23
  - Verified implementation is complete
  - Event types use `readonly` for non-modifiable properties
  - Modifiable properties lack `readonly` and can be changed via partial returns
  - All event handlers return `Promise<void | Partial<Event>>`
  - dispatchEvent merges partial returns and supports blocking
  - Marked story as done

## Dev Agent Record

### Agent Model Used

Claude 3.7 Sonnet (Anthropic)

### Debug Log References

N/A - Implementation already in place

### Completion Notes List

✅ Event modification is fully implemented through TypeScript's readonly type system.

✅ Non-modifiable properties are marked with `readonly` modifier (e.g., `readonly task: TaskData`).

✅ Modifiable properties are not readonly (e.g., `blocked?: boolean`, `files: ContextFile[]`, `prompt: string`).

✅ All event handlers support returning `Partial<Event>` for modifications.

✅ Blocking is supported via `blocked?: boolean` property on relevant events.

✅ dispatchEvent in ExtensionManager handles modification merging and blocking.

### File List

- src/common/extensions/types.ts (event type definitions with readonly pattern)
- src/main/extensions/extension-manager.ts (dispatchEvent with modification support)

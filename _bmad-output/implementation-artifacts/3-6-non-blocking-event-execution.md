# Story 3.6: Non-Blocking Event Execution

Status: ready-for-dev

## Story

As a **system developer**,
I want **to ensure event handlers execute asynchronously without blocking the main thread**,
So that **multiple extensions can run concurrently without degrading responsiveness**.

## Acceptance Criteria

1. **Given** multiple extensions are loaded with event handlers
2. **When** a system event fires and dispatches to extensions
3. **Then** all extension event handlers are called asynchronously via Promise.all()
4. **And** each event handler runs in parallel with other handlers
5. **And** slow event handlers do not block other handlers from starting
6. **And** event dispatch waits for all handlers to complete before merging results
7. **And** event handler errors are caught and logged without blocking dispatch (NFR6)
8. **And** failed event handlers do not prevent other handlers from executing
9. **And** event dispatch does not block main application thread (NFR3)
10. **And** multiple extensions run concurrently without degrading AiderDesk responsiveness (NFR4)
11. **And** event execution timeout is enforced (handlers exceeding timeout are logged and skipped)

## Tasks / Subtasks

- [ ] Task 1: Refactor dispatchEvent to Parallel Execution (AC: #1-#6)
  - [ ] 1.1 Collect all handler promises into an array instead of awaiting sequentially
  - [ ] 1.2 Use Promise.allSettled() to execute all handlers in parallel
  - [ ] 1.3 Handle settled results to extract successful modifications
  - [ ] 1.4 Merge all successful modifications into the event
  - [ ] 1.5 Preserve extension order for result merging (global first, then project)
  - [ ] 1.6 Handle blocking: first handler to block wins, others still complete

- [ ] Task 2: Implement Event Handler Timeout (AC: #11)
  - [ ] 2.1 Add DEFAULT_EVENT_TIMEOUT_MS constant (e.g., 5000ms)
  - [ ] 2.2 Wrap each handler call in Promise.race with timeout
  - [ ] 2.3 Log timeout errors with extension name and event name
  [ ] 2.4 Skip timed-out handlers from result merging
  - [ ] 2.5 Make timeout configurable via ExtensionManager options

- [ ] Task 3: Update ExtensionInitOptions Interface (AC: #11)
  - [ ] 3.1 Add `eventTimeoutMs?: number` to ExtensionInitOptions
  - [ ] 3.2 Store timeout value in ExtensionManager instance
  - [ ] 3.3 Use default timeout if not specified

- [ ] Task 4: Add Unit Tests for Non-Blocking Dispatch (AC: All)
  - [ ] 4.1 Test parallel execution with multiple extensions
  - [ ] 4.2 Test slow handler doesn't block other handlers
  - [ ] 4.3 Test error in one handler doesn't affect others
  - [ ] 4.4 Test timeout causes handler to be skipped
  - [ ] 4.5 Test blocking is detected and logged
  - [ ] 4.6 Test result merging order is correct

- [ ] Task 5: Add Integration Tests (AC: #9, #10)
  - [ ] 5.1 Verify event dispatch doesn't block main thread
  - [ ] 5.2 Verify multiple extensions run concurrently
  - [ ] 5.3 Verify performance improvement over sequential dispatch

## Dev Notes

### Architecture Context

This story transforms the extension event dispatch from **sequential** to **parallel** execution. The current implementation processes extensions one by one, which can cause delays when slow extensions are present.

**Current (Sequential) Flow:**
```
dispatchEvent() {
  for (extension of extensions) {
    await handler.call(extension, event);  // Blocks here
  }
}
```

**Target (Parallel) Flow:**
```
dispatchEvent() {
  const promises = extensions.map(ext => handler.call(ext, event));
  const results = await Promise.allSettled(promises);
  // Merge results
}
```

### Current Implementation Analysis

**File:** `src/main/extensions/extension-manager.ts`
**Method:** `dispatchEvent()` (lines ~680-740)

**Current Behavior:**
```typescript
async dispatchEvent<K extends keyof ExtensionEventMap>(
  eventName: K,
  event: ExtensionEventMap[K],
  project: Project,
  task?: Task,
): Promise<ExtensionEventMap[K]> {
  const allExtensions = this.registry.getExtensions();
  if (allExtensions.length === 0) {
    return event;
  }

  const sortedExtensions = this.sortExtensionsForDispatch(allExtensions, project.baseDir);
  let currentEvent = { ...event };

  for (const loaded of sortedExtensions) {  // <-- SEQUENTIAL
    if (!loaded.initialized) continue;

    const handler = (instance as Extension)[eventName];
    if (typeof handler !== 'function') continue;

    try {
      const context = new ExtensionContextImpl(...);
      const result = await handler.call(instance, currentEvent, context);  // <-- BLOCKS

      if (result && typeof result === 'object') {
        const partialEvent = result as Partial<ExtensionEventMap[K]>;
        currentEvent = { ...currentEvent, ...partialEvent };

        if ('blocked' in currentEvent && currentEvent.blocked === true) {
          logger.info(`[Extensions] Event blocked by '${metadata.name}'`);
          break;  // <-- Early exit on block
        }
      }
    } catch (error) {
      logger.error(`[Extensions] Error in handler:`, error);
      // Continue to next extension
    }
  }

  return currentEvent;
}
```

### Proposed Implementation

```typescript
// Constants
const DEFAULT_EVENT_TIMEOUT_MS = 5000;  // 5 second timeout

interface ExtensionInitOptions {
  hotReload?: boolean;
  eventTimeoutMs?: number;  // NEW: Configurable timeout
}

async dispatchEvent<K extends keyof ExtensionEventMap>(
  eventName: K,
  event: ExtensionEventMap[K],
  project: Project,
  task?: Task,
): Promise<ExtensionEventMap[K]> {
  const allExtensions = this.registry.getExtensions();
  if (allExtensions.length === 0) {
    return event;
  }

  const sortedExtensions = this.sortExtensionsForDispatch(allExtensions, project.baseDir);
  const timeoutMs = this.eventTimeoutMs ?? DEFAULT_EVENT_TIMEOUT_MS;

  // Create handler promises with timeout
  const handlerPromises = sortedExtensions
    .filter(loaded => loaded.initialized)
    .map(async (loaded) => {
      const { instance, metadata } = loaded;
      const handler = (instance as Extension)[eventName];

      if (typeof handler !== 'function') {
        return { extension: metadata.name, result: null, blocked: false, error: null };
      }

      try {
        const context = new ExtensionContextImpl(
          metadata.name,
          this.store,
          this.agentProfileManager,
          this.modelManager,
          project,
          task?.task
        );

        // Race handler against timeout
        const result = await Promise.race([
          handler.call(instance, event, context),
          this.createTimeoutPromise(timeoutMs, metadata.name, eventName)
        ]);

        const blocked = result && typeof result === 'object' && 'blocked' in result && result.blocked === true;

        return { extension: metadata.name, result, blocked, error: null };
      } catch (error) {
        logger.error(`[Extensions] Error in '${String(eventName)}' handler for extension '${metadata.name}':`, error);
        return { extension: metadata.name, result: null, blocked: false, error };
      }
    });

  // Execute all handlers in parallel
  const settledResults = await Promise.allSettled(handlerPromises);

  // Process results and merge
  let currentEvent = { ...event };
  let blocked = false;

  for (const settled of settledResults) {
    if (settled.status === 'rejected') {
      logger.error(`[Extensions] Handler promise rejected:`, settled.reason);
      continue;
    }

    const { extension, result, blocked: handlerBlocked, error } = settled.value;

    if (error) {
      continue;  // Already logged above
    }

    if (handlerBlocked && !blocked) {
      blocked = true;
      logger.info(`[Extensions] Event '${String(eventName)}' blocked by extension '${extension}'`);
    }

    if (result && typeof result === 'object') {
      const partialEvent = result as Partial<ExtensionEventMap[K]>;
      currentEvent = { ...currentEvent, ...partialEvent };
    }
  }

  return currentEvent;
}

private createTimeoutPromise<T>(timeoutMs: number, extensionName: string, eventName: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Handler timeout after ${timeoutMs}ms`);
      error.name = 'ExtensionTimeoutError';
      logger.warn(`[Extensions] Extension '${extensionName}' handler for '${String(eventName)}' timed out after ${timeoutMs}ms`);
      reject(error);
    }, timeoutMs);
  });
}
```

### Key Design Decisions

**1. Use Promise.allSettled() instead of Promise.all()**
- `Promise.all()` would reject if ANY handler rejects
- `Promise.allSettled()` waits for ALL handlers and gives individual status
- This ensures one slow/failing extension doesn't affect others

**2. Timeout per handler, not per dispatch**
- Each handler gets its own timeout
- This prevents one slow handler from causing all handlers to timeout
- Default: 5000ms (5 seconds)

**3. Blocking semantics with parallel execution**
- All handlers run in parallel
- After all complete, check if any returned `blocked: true`
- First blocker wins (in order of sorted extensions)
- Even if blocked, all handlers complete execution

**4. Result merging order**
- Results are merged in extension order (global first, then project)
- Last modification wins for overlapping fields
- Same semantics as before, just parallel execution

### Event Execution Flow Diagram

```
                    dispatchEvent()
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    Extension A     Extension B     Extension C
    (handler)       (handler)       (handler)
         │               │               │
    Promise.race    Promise.race    Promise.race
    [handler|5s]    [handler|5s]    [handler|5s]
         │               │               │
    ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
    │ result  │     │ result  │     │ timeout │
    │  100ms  │     │  500ms  │     │  5s     │
    └─────────┘     └─────────┘     └─────────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
               Promise.allSettled()
                         │
              ┌──────────┴──────────┐
              │   Merge Results     │
              │   Check Blocked     │
              │   Return Event      │
              └─────────────────────┘
```

### Project Structure

| File | Purpose |
|------|---------|
| `src/main/extensions/extension-manager.ts` | Main implementation (dispatchEvent method) |
| `src/main/extensions/__tests__/extension-manager.test.ts` | Unit tests for dispatch |
| `src/main/extensions/__tests__/non-blocking-dispatch.test.ts` | New test file for parallel dispatch tests |

### Performance Considerations

**Before (Sequential):**
- Total time = sum of all handler times
- Example: 3 handlers @ 100ms, 500ms, 200ms = 800ms total

**After (Parallel):**
- Total time = max of all handler times (capped at timeout)
- Example: 3 handlers @ 100ms, 500ms, 200ms = 500ms total
- Worst case: timeout value (default 5000ms)

**Expected Improvement:**
- For 5 extensions with average 200ms handlers: 1000ms → 200ms
- 5x improvement in dispatch latency

### Security Considerations

- Timeout prevents runaway extensions from blocking indefinitely
- Each extension's error is isolated (doesn't affect others)
- Blocking is detected and logged for debugging
- Memory: Each handler creates its own ExtensionContext (no shared state)

### References

- [Source: src/main/extensions/extension-manager.ts#L680-740 - Current dispatchEvent implementation]
- [Source: src/main/extensions/extension-manager.ts#L80-120 - ExtensionInitOptions interface]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.6 - Requirements]
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR3 - Non-blocking main thread]
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR4 - Concurrent extensions]
- [Source: _bmad-output/planning-artifacts/architecture.md#NFR6 - Error isolation]

### Previous Story Intelligence

From **Story 3.5: Agent Lifecycle Event Implementation**:
- ExtensionManager.dispatchEvent is called from many places in agent.ts
- Current dispatch is sequential (for loop with await)
- Pattern used: sort extensions (global first), call handler, merge result
- Blocking: `blocked: true` in return value stops further processing

From **Story 3.3: Event Modification and Chaining**:
- Modifications are partial return values
- Objects are shallow-merged
- Arrays are replaced (not merged)
- Last modifier wins for overlapping fields

From **Story 3.2: HookManager Integration**:
- HookManager.trigger() also processes events sequentially
- Extensions execute before hooks (extensions first, then hooks)
- This story only affects extension dispatch, not hook dispatch

From **Story 1.6: Extension Hot Reload**:
- ExtensionWatcher monitors extension directories
- Hot reload should not be affected by this change
- Ensure timeout doesn't interfere with reload operations

### Common LLM Mistakes to Prevent

1. **Don't use Promise.all()** - Use Promise.allSettled() to handle individual failures
2. **Don't forget timeout cleanup** - Use AbortController or clear timeouts properly
3. **Don't skip blocking detection** - Check all results for `blocked: true` after parallel execution
4. **Don't change result merging order** - Maintain extension order for deterministic results
5. **Don't block main thread** - Ensure Promise.allSettled doesn't run synchronously
6. **Don't forget error isolation** - Each extension's error must be caught individually
7. **Don't change existing API** - dispatchEvent signature must remain the same
8. **Don't ignore Promise.race semantics** - Handler may complete after timeout (handle gracefully)

### Testing Strategy

**Unit Tests:**
```typescript
describe('ExtensionManager - Non-Blocking Dispatch', () => {
  it('should execute handlers in parallel', async () => {
    // Create mock extensions with timing
    // Verify all start at approximately same time
  });

  it('should not block on slow handlers', async () => {
    // One handler takes 2s, others take 100ms
    // Verify total time is ~2s, not sum of all
  });

  it('should handle errors without affecting others', async () => {
    // One handler throws, others succeed
    // Verify other handlers complete
  });

  it('should timeout slow handlers', async () => {
    // Handler takes longer than timeout
    // Verify timeout error is logged
    // Verify result is skipped
  });

  it('should detect blocking from any handler', async () => {
    // One handler returns blocked: true
    // Verify blocking is detected and logged
  });

  it('should merge results in correct order', async () => {
    // Multiple handlers modify same field
    // Verify last modification wins
  });
});
```

**Integration Tests:**
```typescript
describe('Extension System - Performance', () => {
  it('should not block main thread during dispatch', async () => {
    // Start dispatch
    // Verify other operations can proceed
  });

  it('should improve dispatch latency', async () => {
    // Compare sequential vs parallel timing
    // Verify parallel is faster
  });
});
```

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

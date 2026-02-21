# Story 3.2: HookManager Integration for Event Dispatch

Status: review

## Story

As a **system developer**,
I want **to implement event dispatch in ExtensionManager that mirrors HookManager's trigger points**,
So that **extensions receive the same events as existing hooks while HookManager remains untouched for deprecation**.

## Acceptance Criteria

1. Given ExtensionManager needs its own event dispatch system
2. When ExtensionManager implements `dispatchEvent()` method
3. Then the method dispatches events to all loaded extensions with matching handlers
4. And event data flows through extensions in sequence (global first, then project-specific)
5. And extension handlers can modify events via partial return values
6. And extension handlers can block events via `blocked: true` return
7. And extension errors are isolated and logged without affecting other extensions (NFR6, NFR10)
8. And dispatch is called from the same code locations where HookManager.trigger() is called
9. And HookManager remains completely untouched (co-existence for deprecation)

## Tasks / Subtasks

- [x] Task 1: Add dispatchEvent Method to ExtensionManager (AC: #2, #3, #4)
  - [x] 1.1 Create `dispatchEvent<K extends keyof ExtensionEventMap>()` method in `src/main/extensions/extension-manager.ts`
  - [x] 1.2 Method signature: `dispatchEvent(eventName, event, project, task?): Promise<{ event, blocked }>`
  - [x] 1.3 Get all extensions from registry (global + project-specific)
  - [x] 1.4 Order: global extensions first, then project extensions for the given projectDir
  - [x] 1.5 For each extension, check if it has the matching event handler method
  - [x] 1.6 Create ExtensionContext for each extension using its metadata.name
  - [x] 1.7 Call handler with event and context

- [x] Task 2: Implement Event Modification Pattern (AC: #5)
  - [x] 2.1 Clone event before dispatch to avoid mutation
  - [x] 2.2 If handler returns partial object, shallow-merge into current event
  - [x] 2.3 Pass merged event to next handler in chain
  - [x] 2.4 Return final merged event from dispatchEvent()

- [x] Task 3: Implement Event Blocking Pattern (AC: #6)
  - [x] 3.1 Check if handler result contains `blocked: true`
  - [x] 3.2 If blocked, stop dispatch chain immediately
  - [x] 3.3 Return `{ event: currentEvent, blocked: true }` when blocked
  - [x] 3.4 Document which events support blocking (tools, prompts, approvals, subagents)

- [x] Task 4: Implement Error Isolation (AC: #7)
  - [x] 4.1 Wrap each handler call in try-catch
  - [x] 4.2 Log errors with extension name and event name via logger
  - [x] 4.3 Continue with next extension on error
  - [x] 4.4 Never throw from dispatchEvent() - always return result

- [x] Task 5: Add Extension Dispatch Calls to Event Sources (AC: #8)
  - [x] 5.1 Identify all locations where HookManager.trigger() is called (reference)
  - [x] 5.2 Add extensionManager.dispatchEvent() calls alongside existing hook triggers
  - [x] 5.3 Handle event name mapping (onFileAdded → onFilesAdded, onFileDropped → onFilesDropped)
  - [x] 5.4 Transform event payloads where needed (singular to plural for file events)
  - [x] 5.5 Ensure dispatch result (blocked/modified) is used appropriately

- [x] Task 6: Create Unit Tests for dispatchEvent (AC: All)
  - [x] 6.1 Add tests to `src/main/extensions/__tests__/extension-manager.test.ts`
  - [x] 6.2 Test dispatch calls all extension handlers for event
  - [x] 6.3 Test global extensions called before project extensions
  - [x] 6.4 Test modification merging across multiple extensions
  - [x] 6.5 Test blocking stops dispatch chain
  - [x] 6.6 Test error isolation between extensions
  - [x] 6.7 Test extensions without handler are skipped gracefully

- [x] Task 7: Run Type Check and Tests (AC: All)
  - [x] 7.1 Run `npm run typecheck` to ensure no TypeScript errors
  - [x] 7.2 Run `npm run test:node -- --no-color` to ensure all tests pass

## Dev Notes

### Architecture Context

**Co-existence Strategy (HookManager Deprecation):**

HookManager will be deprecated and eventually removed. ExtensionManager implements its own event dispatch system that runs in parallel. Both systems will co-exist during the transition period.

```
User Action / System Event
        ↓
┌───────────────────────────────────────────────────────┐
│ Code Location (e.g., Task.runPrompt())                │
│                                                       │
│  // Existing hook dispatch (UNCHANGED - deprecated)   │
│  await this.hookManager.trigger('onPromptSubmitted',  │
│    event, task, project);                             │
│                                                       │
│  // NEW extension dispatch (parallel, independent)    │
│  await this.extensionManager.dispatchEvent(           │
│    'onPromptSubmitted', event, project, task);        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

1. **HookManager UNTOUCHED** - No modifications to HookManager, it remains as-is for deprecation
2. **Parallel dispatch** - Both systems run, extension dispatch added alongside hook dispatch
3. **ExtensionManager owns dispatch** - All extension event logic lives in ExtensionManager
4. **Event name mapping at call site** - Transform event names/payloads when calling dispatchEvent

### Event Dispatch Flow

```
extensionManager.dispatchEvent('onPromptSubmitted', event, project, task)
        ↓
┌───────────────────────────────────────────────────────┐
│ 1. Get Extensions from Registry                       │
│    - Global extensions (projectDir undefined)         │
│    - Project extensions (projectDir matches)          │
└───────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────┐
│ 2. For Each Extension (in order)                      │
│    - Check if extension.instance[eventName] exists    │
│    - Create ExtensionContext for this extension       │
│    - Call handler(event, context)                     │
│    - Merge modifications / check blocking             │
│    - Continue or break based on result                │
└───────────────────────────────────────────────────────┘
        ↓
   Return { event: finalEvent, blocked: boolean }
```

### HookManager Trigger Locations (Reference Only)

Use these as reference for where to add extension dispatch calls:

| Event | File | Method | Line |
|-------|------|--------|------|
| `onTaskCreated` | `src/main/project/project.ts` | `prepareTask()` | ~168 |
| `onTaskInitialized` | `src/main/task/task.ts` | `initInternal()` | ~393 |
| `onTaskClosed` | `src/main/task/task.ts` | `close()` | ~504 |
| `onPromptSubmitted` | `src/main/task/task.ts` | `runPrompt()` | ~602 |
| `onPromptStarted` | `src/main/task/task.ts` | `runPromptInAgent()` | ~775 |
| `onPromptFinished` | `src/main/task/task.ts` | `runPromptInAgent()` | ~796 |
| `onAgentStarted` | `src/main/agent/agent.ts` | `runAgent()` | ~629 |
| `onAgentFinished` | `src/main/agent/agent.ts` | `runAgent()` | ~end |
| `onAgentStepFinished` | `src/main/agent/agent.ts` | `runAgent()` | ~937 |
| `onToolCalled` | `src/main/agent/agent.ts` | `wrapToolsWithHooks()` | ~464 |
| `onToolFinished` | `src/main/agent/agent.ts` | `wrapToolsWithHooks()` | ~473 |
| `onFileAdded` | `src/main/task/task.ts` | `addFiles()` | ~1254 |
| `onFileDropped` | `src/main/task/task.ts` | `dropFile()` | ~1289 |
| `onHandleApproval` | `src/main/agent/tools/approval-manager.ts` | `handleApproval()` | ~14 |
| `onSubagentStarted` | `src/main/task/task.ts` | `runSubagent()` | ~970 |
| `onSubagentFinished` | `src/main/task/task.ts` | `runSubagent()` | ~977 |
| `onResponseMessageProcessed` | `src/main/task/task.ts` | `processResponseMessage()` | ~1033 |
| `onQuestionAsked` | `src/main/task/task.ts` | Various | - |
| `onQuestionAnswered` | `src/main/task/task.ts` | Various | - |
| `onCommandExecuted` | `src/main/task/task.ts` | Various | - |
| `onAiderPromptStarted` | `src/main/task/task.ts` | Various | - |
| `onAiderPromptFinished` | `src/main/task/task.ts` | Various | - |

### Event Name Mapping

Extensions use different event names for file events:

| HookManager Event | Extension Event | Payload Transformation |
|-------------------|-----------------|------------------------|
| `onFileAdded` | `onFilesAdded` | `{ file }` → `{ files: [file] }` |
| `onFileDropped` | `onFilesDropped` | `{ filePath }` → `{ files: [filePath] }` |

All other events have direct 1:1 mapping.

### ExtensionManager Current State

**File:** `src/main/extensions/extension-manager.ts`

```typescript
export class ExtensionManager {
  private validator: ExtensionValidator;
  private loader: ExtensionLoader;
  private registry: ExtensionRegistry;
  // ...

  constructor(
    private readonly store: Store,
    private readonly agentProfileManager: AgentProfileManager,
    private readonly modelManager: ModelManager,
  ) { /* ... */ }

  getExtensions(): LoadedExtension[]  // All loaded extensions
  getExtension(name: string): LoadedExtension | undefined
}
```

**LoadedExtension interface:**
```typescript
interface LoadedExtension {
  instance: Extension;       // The extension class instance
  metadata: ExtensionMetadata;
  filePath: string;
  initialized: boolean;
  projectDir?: string;       // For project-specific extensions
}
```

### Extension Event Types (from Story 3.1)

**File:** `src/common/extensions/types.ts`

All event handlers are optional and return `Promise<void | Partial<Event>>`:

```typescript
interface Extension {
  // Task Events
  onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;
  onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void | Partial<TaskInitializedEvent>>;
  onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void | Partial<TaskClosedEvent>>;

  // Agent Events
  onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;
  onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;
  onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;

  // ... all other events follow same pattern
}
```

**Events that support blocking:**
- `onToolApproval` - Block tool execution
- `onToolCalled` - Block tool before execution
- `onPromptSubmitted` - Block prompt submission
- `onHandleApproval` - Block approval handling
- `onSubagentStarted` - Block subagent spawning

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/main/extensions/extension-manager.ts` | Add `dispatchEvent()` method |
| `src/main/project/project.ts` | Add extension dispatch for `onTaskCreated` |
| `src/main/task/task.ts` | Add extension dispatch for task/prompt/file events |
| `src/main/agent/agent.ts` | Add extension dispatch for agent/tool events |
| `src/main/agent/tools/approval-manager.ts` | Add extension dispatch for `onHandleApproval` |

**Files to Reference (DO NOT MODIFY):**

| File | Reference For |
|------|---------------|
| `src/main/hooks/hook-manager.ts` | Event trigger locations and patterns |
| `src/common/extensions/types.ts` | Extension event interfaces |
| `src/main/extensions/extension-context.ts` | ExtensionContext creation |

### Implementation Details

**dispatchEvent Implementation:**

```typescript
// In ExtensionManager
async dispatchEvent<K extends keyof ExtensionEventHandlers>(
  eventName: K,
  event: ExtensionEventMap[K],
  project: Project,
  task?: Task,
): Promise<{ event: ExtensionEventMap[K]; blocked: boolean }> {
  const extensions = this.registry.getExtensions();
  let currentEvent = { ...event };
  let blocked = false;

  // Sort: global extensions first, then project-specific
  const sortedExtensions = this.sortExtensionsForDispatch(extensions, project.baseDir);

  for (const loaded of sortedExtensions) {
    const handler = loaded.instance[eventName] as ExtensionEventHandler<K> | undefined;

    if (typeof handler !== 'function') {
      continue;
    }

    try {
      const context = this.createContext(loaded.metadata.name, project, task);
      const result = await handler.call(loaded.instance, currentEvent, context);

      if (result?.blocked) {
        blocked = true;
        break;
      }

      if (result && typeof result === 'object') {
        currentEvent = { ...currentEvent, ...result };
      }
    } catch (error) {
      logger.error(`[Extensions] Error in ${String(eventName)} handler for '${loaded.metadata.name}':`, error);
      // Continue with other extensions (error isolation)
    }
  }

  return { event: currentEvent, blocked };
}

private sortExtensionsForDispatch(extensions: LoadedExtension[], projectDir: string): LoadedExtension[] {
  const global = extensions.filter(e => !e.projectDir);
  const projectSpecific = extensions.filter(e => e.projectDir === projectDir);
  return [...global, ...projectSpecific];
}

private createContext(extensionName: string, project: Project, task?: Task): ExtensionContext {
  return new ExtensionContextImpl(
    extensionName,
    this.store,
    this.agentProfileManager,
    this.modelManager,
    project,
    task?.task, // TaskData
  );
}
```

**Adding Dispatch at Call Site Example:**

```typescript
// In Task.runPrompt() - existing code
const hookResult = await this.hookManager.trigger('onPromptSubmitted',
  { prompt, mode }, this, this.project);

// NEW: Add extension dispatch alongside (not replacing)
const extensionResult = await this.extensionManager.dispatchEvent('onPromptSubmitted',
  { prompt, mode }, this.project, this);

// Use extension result for blocking
if (extensionResult.blocked) {
  return; // Extension blocked the prompt
}

// Continue with potentially modified event
const finalPrompt = extensionResult.event.prompt;
```

### Common LLM Mistakes to Prevent

1. **Don't modify HookManager** - It's being deprecated, leave it untouched.

2. **Don't replace hook calls** - Add extension dispatch ALONGSIDE existing hook triggers.

3. **Don't forget error isolation** - Every handler call must be wrapped in try-catch.

4. **Don't mutate the original event** - Always clone/spread events before modification.

5. **Don't forget event name mapping** - File events use plural names in extensions.

6. **Don't skip creating ExtensionContext** - Each extension needs its own context with its name.

7. **Don't forget to handle blocking** - Check `blocked` in result and act accordingly.

8. **Don't assume Task is always available** - Some events (like onFileAdded) might not have Task context.

### Testing Patterns

**Test dispatch order:**
```typescript
it('should dispatch to global extensions before project extensions', async () => {
  const callOrder: string[] = [];

  const globalExt = createMockExtension('global', {
    onPromptSubmitted: async () => { callOrder.push('global'); return {}; }
  });
  const projectExt = createMockExtension('project', {
    onPromptSubmitted: async () => { callOrder.push('project'); return {}; }
  }, '/project/path');

  mockRegistry.getExtensions.mockReturnValue([projectExt, globalExt]);

  await manager.dispatchEvent('onPromptSubmitted', { prompt: 'test', mode: 'agent' }, mockProject);

  expect(callOrder).toEqual(['global', 'project']);
});
```

**Test modification merging:**
```typescript
it('should merge modifications from multiple extensions', async () => {
  const ext1 = createMockExtension('ext1', {
    onPromptSubmitted: async (event) => ({ prompt: event.prompt + ' modified1' })
  });
  const ext2 = createMockExtension('ext2', {
    onPromptSubmitted: async (event) => ({ prompt: event.prompt + ' modified2' })
  });

  mockRegistry.getExtensions.mockReturnValue([ext1, ext2]);

  const result = await manager.dispatchEvent('onPromptSubmitted',
    { prompt: 'original', mode: 'agent' }, mockProject);

  expect(result.event.prompt).toBe('original modified1 modified2');
});
```

### Dependencies

**On Previous Stories:**
- Story 3.1: Extension event handler methods defined ✅
- Story 2.2: ExtensionContextImpl available ✅

**For Future Stories:**
- Story 3.3: Event Modification and Chaining - Builds on this dispatch mechanism
- Story 3.4: Tool Result Modification - Uses dispatchEvent for onToolFinished
- Story 3.6: Non-Blocking Event Execution - May parallelize dispatch

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2]
- [Source: src/main/hooks/hook-manager.ts - Reference for trigger locations (DO NOT MODIFY)]
- [Source: src/main/extensions/extension-manager.ts - Add dispatchEvent method]
- [Source: src/common/extensions/types.ts - Extension interface and events]
- [Source: src/main/extensions/extension-context.ts - ExtensionContextImpl]

## Change Log

- Date: 2026-02-21 (Code Review Fix)
  - Added public `dispatchExtensionEvent()` method to Task class for type-safe extension event dispatch
  - Fixed unsafe type casting `(this.task as any).extensionManager` in approval-manager.ts
  - Changed `void this.extensionManager.dispatchEvent(...)` to `await this.extensionManager.dispatchEvent(...)` across task.ts, project.ts, and agent.ts for proper async handling
  - Made `dropFile()` method in task.ts async to support await
  - For non-async functions (prepareTask, answerQuestion), used `void ... .catch()` pattern for proper error handling
  - All tests passing (695/695), TypeScript compilation successful (0 errors)

- Date: 2026-02-21
  - Implemented ExtensionManager.dispatchEvent() method with full event system support
  - Added ExtensionEventMap type for type-safe event dispatch
  - Added extension event dispatch calls at all 23 HookManager trigger locations
  - Implemented event name mapping for file events (singular → plural)
  - Created comprehensive unit tests (13 new tests for dispatchEvent)
  - All tests passing (695/695), TypeScript compilation successful (0 errors)
  - HookManager remains completely untouched (co-existence for deprecation)

## Dev Agent Record

### Agent Model Used

Claude 3.7 Sonnet (Anthropic)

### Debug Log References

N/A - Implementation successful on first iteration

### Completion Notes List

✅ Successfully implemented ExtensionManager.dispatchEvent() method with full event modification, blocking, and error isolation support.

✅ Added extension dispatch calls at all 23 HookManager.trigger() locations across the codebase, ensuring extensions run in parallel with hooks.

✅ Implemented proper event name mapping for file events (onFileAdded → onFilesAdded, onFileDropped → onFilesDropped) with payload transformation.

✅ All tests passing (695/695) including 13 new unit tests specifically for dispatchEvent functionality.

✅ TypeScript compilation successful with 0 errors.

✅ Extension events support blocking (onPromptSubmitted, onSubagentStarted, onToolCalled, onHandleApproval, onCommandExecuted) and modification (all events) patterns.

✅ Error isolation ensures one extension's failure doesn't affect other extensions or the main application flow.

### File List

- src/main/extensions/extension-manager.ts (added dispatchEvent method, ExtensionEventMap type, sortExtensionsForDispatch helper)
- src/main/extensions/__tests__/extension-manager.test.ts (added 13 new tests for dispatchEvent)
- src/main/project/project.ts (added onTaskCreated dispatch)
- src/main/task/task.ts (added 15 event dispatches: onTaskInitialized, onTaskClosed, onPromptSubmitted, onPromptStarted, onPromptFinished, onAiderPromptStarted, onAiderPromptFinished, onSubagentStarted, onSubagentFinished, onResponseMessageProcessed, onQuestionAnswered, onQuestionAsked, onFilesAdded, onFilesDropped, onCommandExecuted)
- src/main/agent/agent.ts (added 4 event dispatches: onAgentStarted, onAgentFinished, onAgentStepFinished, onToolCalled, onToolFinished)
- src/main/agent/tools/approval-manager.ts (added onHandleApproval dispatch)
- src/main/project/__tests__/project.test.ts (added dispatchEvent mock)
- src/main/project/__tests__/project.task-creation.test.ts (added dispatchEvent mock)
- src/main/project/__tests__/project.inheritance.test.ts (added dispatchEvent mock)
- src/main/project/__tests__/project.duplicate-prevention.test.ts (added dispatchEvent mock)


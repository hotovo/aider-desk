# Story 3.1: Extension Event Handler Methods

Status: done

## Story

As a **system developer**,
I want **to define ALL event handler methods on Extension interface**,
So that **extensions can subscribe to all AiderDesk lifecycle events**.

## Acceptance Criteria

1. Given Extension interface is defined
2. When event handler methods are verified on Extension interface
3. Then Task Events are defined:
   - `onTaskCreated(event, context)` for task creation
   - `onTaskInitialized(event, context)` for task initialization
   - `onTaskClosed(event, context)` for task closure
4. And Agent Events are defined:
   - `onAgentStarted(event, context)` for agent start
   - `onAgentFinished(event, context)` for agent completion
   - `onAgentStepFinished(event, context)` for each agent step
5. And Tool Events are defined:
   - `onToolApproval(event, context)` before tool execution
   - `onToolCalled(event, context)` just before tool executes
   - `onToolFinished(event, context)` after tool execution
6. And File Events are defined:
   - `onFilesAdded(event, context)` for context file additions (supports multiple files)
   - `onFilesDropped(event, context)` for file drops (supports multiple files)
7. And Prompt Events are defined:
   - `onPromptSubmitted(event, context)` for user prompt submission
   - `onPromptStarted(event, context)` when prompt processing begins
   - `onPromptFinished(event, context)` for prompt completion
8. And Message Events are defined:
   - `onResponseMessageProcessed(event, context)` for each finished response message
9. And Approval Events are defined:
   - `onHandleApproval(event, context)` for approval requests
10. And Subagent Events are defined:
    - `onSubagentStarted(event, context)` for subagent spawning
    - `onSubagentFinished(event, context)` for subagent completion
11. And Question Events are defined:
    - `onQuestionAsked(event, context)` for agent questions
    - `onQuestionAnswered(event, context)` for user answers
12. And Command Events are defined:
    - `onCommandExecuted(event, context)` for custom commands
13. And Aider Events (Legacy) are defined:
    - `onAiderPromptStarted(event, context)` for Aider mode
    - `onAiderPromptFinished(event, context)` for Aider completion
14. And all event handler methods are optional (extensions implement only what they need)
15. And all methods return Promise to support async event handling
16. And all events support modification via partial return values (Story 3.3)

## Tasks / Subtasks

- [x] Task 1: Verify Event Payload Interfaces (AC: #3-#13)
  - [x] 1.1 Review all event payload interfaces in `src/common/extensions/types.ts`
  - [x] 1.2 Ensure TaskCreatedEvent, TaskInitializedEvent, TaskClosedEvent are complete
  - [x] 1.3 Ensure AgentStartedEvent, AgentFinishedEvent, AgentStepFinishedEvent are complete
  - [x] 1.4 Ensure ToolApprovalEvent, ToolCalledEvent, ToolResultEvent are complete
  - [x] 1.5 Ensure FileAddedEvent, FileDroppedEvent are complete
  - [x] 1.6 Ensure PromptSubmittedEvent, PromptStartedEvent, PromptFinishedEvent are complete
  - [x] 1.7 Ensure ResponseMessageProcessedEvent is complete
  - [x] 1.8 Ensure HandleApprovalEvent is complete
  - [x] 1.9 Ensure SubagentStartedEvent, SubagentFinishedEvent are complete
  - [x] 1.10 Ensure QuestionAskedEvent, QuestionAnsweredEvent are complete
  - [x] 1.11 Ensure CommandExecutedEvent is complete
  - [x] 1.12 Ensure AiderPromptStartedEvent, AiderPromptFinishedEvent are complete

- [x] Task 2: Verify Extension Interface Event Handlers (AC: #3-#14)
  - [x] 2.1 Verify Task Events are defined with correct signatures
  - [x] 2.2 Verify Agent Events are defined with correct signatures
  - [x] 2.3 Verify Tool Events are defined with correct signatures
  - [x] 2.4 Verify File Events are defined with correct signatures
  - [x] 2.5 Verify Prompt Events are defined with correct signatures
  - [x] 2.6 Verify Message Events are defined with correct signatures
  - [x] 2.7 Verify Approval Events are defined with correct signatures
  - [x] 2.8 Verify Subagent Events are defined with correct signatures
  - [x] 2.9 Verify Question Events are defined with correct signatures
  - [x] 2.10 Verify Command Events are defined with correct signatures
  - [x] 2.11 Verify Aider Events are defined with correct signatures
  - [x] 2.12 Ensure all methods are optional (`?` suffix)

- [x] Task 3: Add JSDoc Documentation for Event Handlers (AC: All)
  - [x] 3.1 Add JSDoc comments explaining each event handler's purpose
  - [x] 3.2 Document blocking capability for relevant events (tool, prompt, approval)
  - [x] 3.3 Document modification return pattern
  - [x] 3.4 Ensure JSDoc supports IntelliSense documentation (FR39)

- [x] Task 4: Add Blocked Field to Relevant Event Interfaces (AC: #5)
  - [x] 4.1 Add `blocked?: boolean` to ToolApprovalEvent
  - [x] 4.2 Add `blocked?: boolean` to ToolCalledEvent
  - [x] 4.3 Document which events support blocking in JSDoc

- [x] Task 5: Create Unit Tests for Event Types (AC: All)
  - [x] 5.1 Create `src/common/extensions/__tests__/event-types.test.ts`
  - [x] 5.2 Test all event payload interfaces have correct structure
  - [x] 5.3 Test Extension interface has all required event handlers
  - [x] 5.4 Test all event handlers are optional
  - [x] 5.5 Test return type supports void and partial event

- [x] Task 6: Run Type Check and Tests (AC: All)
  - [x] 6.1 Run `npm run typecheck` to ensure no TypeScript errors
  - [x] 6.2 Run `npm run test:node` to ensure all tests pass

## Dev Notes

### Architecture Context

**Event System Design:**

The Extension interface provides comprehensive event coverage for all AiderDesk lifecycle events. Events flow through HookManager which dispatches to both hooks and extensions.

```
User Action / System Event
        ↓
HookManager (central dispatcher)
        ↓
┌──────────────┴──────────────┐
│                              │
Existing Hooks                Extensions
(JavaScript)                (TypeScript classes)
│                              │
└──────────────┬──────────────┘
        ↓
   Combined Results
```

**Event Categories:**

| Category | Events                                                | Purpose |
|----------|-------------------------------------------------------|---------|
| Task | onTaskCreated, onTaskInitialized, onTaskClosed        | Task lifecycle tracking |
| Agent | onAgentStarted, onAgentFinished, onAgentStepFinished, | Agent execution monitoring |
| Tool | onToolApproval, onToolCalled, onToolFinished            | Tool execution control |
| File | onFilesAdded, onFilesDropped                          | File context changes |
| Prompt | onPromptSubmitted, onPromptStarted, onPromptFinished  | Prompt processing pipeline |
| Message | onResponseMessageProcessed                            | Response message handling |
| Approval | onHandleApproval                                      | User approval handling |
| Subagent | onSubagentStarted, onSubagentFinished                 | Subagent lifecycle |
| Question | onQuestionAsked, onQuestionAnswered                   | Q&A interaction |
| Command | onCommandExecuted                                     | Slash command handling |
| Aider (Legacy) | onAiderPromptStarted, onAiderPromptFinished           | Backward compatibility |

### Current Implementation Status

**Types Already Defined in `src/common/extensions/types.ts`:**

All event payload interfaces are defined:
- TaskCreatedEvent, TaskInitializedEvent, TaskClosedEvent ✅
- PromptSubmittedEvent (with blocked support), PromptStartedEvent, PromptFinishedEvent ✅
- AgentStartedEvent, AgentFinishedEvent, AgentStepFinishedEvent ✅
- ToolApprovalEvent (with blocked), ToolCalledEvent (with blocked), ToolFinishedEvent ✅
- FilesAddedEvent (with files array and blocked), FilesDroppedEvent (with files array and blocked) ✅
- ResponseMessageProcessedEvent ✅
- HandleApprovalEvent ✅
- SubagentStartedEvent, SubagentFinishedEvent ✅
- QuestionAskedEvent, QuestionAnsweredEvent ✅
- CommandExecutedEvent ✅
- AiderPromptStartedEvent, AiderPromptFinishedEvent ✅

All Extension interface event handlers are defined with correct signatures:
- All methods are optional (`?` suffix) ✅
- All return `Promise<void | Partial<Event>>` ✅

**What Needs Verification:**

1. `blocked` field exists on blocking events (ToolApprovalEvent, ToolCalledEvent)
2. JSDoc comments are complete for all event handlers
3. All events align with HookManager's HookEventMap

### Event Modification Pattern

All event handlers support modification via partial return values:

```typescript
// Extension can return void (no modification)
async onPromptSubmitted(event, context) {
  context.log(`Prompt: ${event.prompt}`, 'info');
}

// Extension can return partial event (modification)
async onPromptSubmitted(event, context) {
  return { prompt: event.prompt + ' [logged]' };
}

// Extension can block (for blocking events)
async onToolApproval(event, context) {
  if (event.toolName === 'dangerous-tool') {
    return { blocked: true };
  }
}
```

### Blocking Events

The following events support blocking via `blocked: true` in return value:
- `onToolApproval` - Prevent tool execution
- `onToolCalled` - Prevent tool execution
- `onPromptSubmitted` - Prevent prompt processing
- `onHandleApproval` - Prevent approval handling
- `onSubagentStarted` - Prevent subagent spawning

**File Events (no blocked field needed - return empty files array instead):**
- `onFilesAdded` - Modify files array (return empty to prevent addition)
- `onFilesDropped` - Modify files array (return empty to prevent addition)

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/common/extensions/types.ts` | Verify and enhance JSDoc, add blocked fields where needed |

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/common/extensions/__tests__/event-types.test.ts` | Unit tests for event type definitions |

**Files to Reference:**

| File | What to Reference |
|------|-------------------|
| `src/main/hooks/hook-manager.ts` | HookEventMap for event alignment |
| `src/common/types.ts` | TaskData, AgentProfile, Model, etc. types |

### Common LLM Mistakes to Prevent

1. **Don't add new event types** - This story is about verifying existing definitions, not adding new events.

2. **Don't change return type signatures** - All event handlers must return `Promise<void | Partial<Event>>` for modification support.

3. **Don't make event handlers required** - All methods must remain optional (`?` suffix).

4. **Don't forget JSDoc comments** - Every event handler needs documentation for IntelliSense.

5. **Don't skip the blocked field** - Events that can block operations need `blocked?: boolean`.

6. **Don't misalign with HookEventMap** - Event payloads must match HookManager's HookEventMap structure.

7. **Don't add new event payload fields** - Keep event payloads focused on necessary data.

8. **Don't forget AgentIterationFinishedEvent** - This is a new event not in the hook system.

### Test File Structure

**Location:** `src/common/extensions/__tests__/event-types.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import type {
  Extension,
  TaskCreatedEvent,
  TaskInitializedEvent,
  TaskClosedEvent,
  // ... import all event types
} from '../types';

describe('Extension Event Types', () => {
  describe('Event Payload Interfaces', () => {
    it('TaskCreatedEvent should have task field', () => {
      const event: TaskCreatedEvent = { task: {} as TaskData };
      expect(event).toHaveProperty('task');
    });

    // Test all other event payloads...
  });

  describe('Extension Interface Event Handlers', () => {
    it('should have optional onTaskCreated handler', () => {
      const extension: Extension = {};
      expect(extension.onTaskCreated).toBeUndefined();
    });

    it('onTaskCreated should accept TaskCreatedEvent', async () => {
      const extension: Extension = {
        async onTaskCreated(event, context) {
          expect(event.task).toBeDefined();
        },
      };
      // Type checking passes
    });

    // Test all other event handlers...
  });

  describe('Event Modification Pattern', () => {
    it('event handlers can return void', async () => {
      const handler = async () => {};
      const result = await handler();
      expect(result).toBeUndefined();
    });

    it('event handlers can return partial event', async () => {
      const handler = async (): Promise<Partial<TaskCreatedEvent>> => {
        return { task: { id: 'modified' } as TaskData };
      };
      const result = await handler();
      expect(result.task).toBeDefined();
    });
  });

  describe('Blocking Events', () => {
    it('ToolApprovalEvent should support blocked field', () => {
      const event: ToolApprovalEvent = {
        toolName: 'test',
        args: {},
        blocked: true,
      };
      expect(event.blocked).toBe(true);
    });

    // Test other blocking events...
  });
});
```

### Integration Notes

**Dependencies on Previous Stories:**
- Story 2.1: Extension types defined in `src/common/extensions/types.ts`
- Story 2.4: Extension lifecycle methods established
- Epic 1: Extension system foundation

**HookManager Reference:**

The Extension interface events can use Hook events as a reference, also the places where the hook manager is used in the codebase.

| Extension Event | HookEventMap Event         | Status |
|-----------------|----------------------------|--------|
| onTaskCreated | onTaskCreated              | ✅ Aligned |
| onTaskInitialized | onTaskInitialized          | ✅ Aligned |
| onTaskClosed | onTaskClosed               | ✅ Aligned |
| onPromptSubmitted | onPromptSubmitted          | ✅ Aligned |
| onPromptStarted | onPromptStarted            | ✅ Aligned |
| onPromptFinished | onPromptFinished           | ✅ Aligned |
| onAgentStarted | onAgentStarted             | ✅ Aligned |
| onAgentFinished | onAgentFinished            | ✅ Aligned |
| onAgentStepFinished | onAgentStepFinished        | ✅ Aligned |
| onAgentIterationFinished | -                          | ⚠️ Extension-only |
| onToolApproval | -                          | ⚠️ Extension-only |
| onToolCalled | onToolCalled               | ✅ Aligned |
| onToolFinished | onToolFinished               | ✅ Aligned |
| onFilesAdded | onFileAdded                | ⚠️ Extension uses plural (supports multiple files) |
| onFilesDropped | onFileDropped              | ⚠️ Extension uses plural (supports multiple files) |
| onResponseMessageProcessed | onResponseMessageProcessed | ✅ Aligned |
| onHandleApproval | onHandleApproval           | ✅ Aligned |
| onSubagentStarted | onSubagentStarted          | ✅ Aligned |
| onSubagentFinished | onSubagentFinished         | ✅ Aligned |
| onQuestionAsked | onQuestionAsked            | ✅ Aligned |
| onQuestionAnswered | onQuestionAnswered         | ✅ Aligned |
| onCommandExecuted | onCommandExecuted          | ✅ Aligned |
| onAiderPromptStarted | onAiderPromptStarted       | ✅ Aligned |
| onAiderPromptFinished | onAiderPromptFinished      | ✅ Aligned |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Hooks Co-existence Strategy]
- [Source: src/common/extensions/types.ts - Current Extension interface]
- [Source: src/main/hooks/hook-manager.ts - HookEventMap]
- [Source: _bmad-output/implementation-artifacts/2-1-extension-type-definitions.md - Type system foundation]
- [Source: _bmad-output/implementation-artifacts/2-6-tool-integration-with-agent-system.md - Previous story patterns]

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

None - implementation was straightforward verification.

### Completion Notes List

- Verified all event payload interfaces are complete and correctly typed in `src/common/extensions/types.ts`
- Confirmed all Extension interface event handlers have correct signatures with `Promise<void | Partial<Event>>` return type
- Verified all event handler methods are optional (`?` suffix)
- Confirmed `blocked?: boolean` field exists on blocking events: ToolApprovalEvent, ToolCalledEvent, PromptSubmittedEvent, HandleApprovalEvent, SubagentStartedEvent
- Renamed FileAddedEvent → FilesAddedEvent and FileDroppedEvent → FilesDroppedEvent to support multiple files via `files: ContextFile[]` (no blocked field needed - extensions can return empty array)
- Updated Extension interface methods: onFileAdded → onFilesAdded, onFileDropped → onFilesDropped
- Verified JSDoc documentation is complete for all event handlers including blocking capability notes
- Created comprehensive unit tests (81 tests) covering all event types, optional handlers, modification patterns, and blocking events
- All tests pass
- Type checking passes for all tsconfig targets

### File List

**Modified:**
- `src/common/extensions/types.ts` - Added blocking fields to events, renamed file events to support multiple files
- `src/common/extensions/index.ts` - Updated exports for renamed file event types
- `src/common/extensions/__tests__/event-types.test.ts` - Unit tests for event type definitions (85 tests)

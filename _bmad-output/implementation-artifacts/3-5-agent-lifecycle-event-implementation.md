# Story 3.5: Agent Lifecycle Event Implementation

Status: done

## Story

As a **system developer**,
I want **to implement new agent lifecycle events for granular extension hooks**,
So that **extensions can react to agent steps and iterations**.

## Acceptance Criteria

1. **Given** Agent system executes agent runs with multiple steps and iterations
2. **When** an agent step completes (one LLM response + tool calls)
3. **Then** `onAgentStepFinished(event, context)` is called with step result
4. **And** step result includes messages and toolResults arrays
5. **And** extensions can modify step result via partial return
6. **And** extensions can inject additional messages or tool calls via partial return
7. **When** an agent iteration completes (in reasoning/thinking mode)
8. **Then** `onAgentIterationFinished(event, context)` is called with iteration result
9. **And** iteration result includes index, messages, and reasoning
10. **And** extensions can modify iteration result via partial return
11. **And** extensions can add metadata to iteration via partial return
12. **And** new agent lifecycle events support all modification capabilities (Story 3.3)
13. **And** events fire in sequence: iterations → steps → agentFinished

## Tasks / Subtasks

- [ ] Task 1: Verify onAgentStepFinished Implementation (AC: #1-#6)
  - [ ] 1.1 Verify `onAgentStepFinished` is dispatched from agent.ts line ~1052
  - [ ] 1.2 Verify step result includes `stepResult` with messages and toolResults
  - [ ] 1.3 Verify `finishReason` and `responseMessages` are modifiable
  - [ ] 1.4 Verify extensions can modify responseMessages via partial return
  - [ ] 1.5 Verify extensions can inject additional messages via modification
  - [ ] 1.6 Verify existing modification pattern from Story 3.3 works

- [ ] Task 2: Define AgentIterationFinishedEvent Interface (AC: #8, #9)
  - [ ] 2.1 Add `AgentIterationFinishedEvent` interface to `src/common/extensions/types.ts`
  - [ ] 2.2 Include `readonly iterationIndex: number` (0-based iteration count)
  - [ ] 2.3 Include `readonly agentProfile: AgentProfile`
  - [ ] 2.4 Include `messages: ContextMessage[]` (modifiable)
  - [ ] 2.5 Include `finishReason: FinishReason | null` (modifiable)
  - [ ] 2.6 Include `hasReasoning: boolean`
  - [ ] 2.7 Export type from `src/common/extensions/index.ts`

- [ ] Task 3: Add onAgentIterationFinished to Extension Interface (AC: #8)
  - [ ] 3.1 Add `onAgentIterationFinished?` method to Extension interface in types.ts
  - [ ] 3.2 Define signature: `(event: AgentIterationFinishedEvent, context: ExtensionContext) => Promise<void | Partial<AgentIterationFinishedEvent>>`
  - [ ] 3.3 Add JSDoc comment explaining when event fires
  - [ ] 3.4 Add to ExtensionEventMap in extension-manager.ts

- [ ] Task 4: Implement Iteration Finished Dispatch (AC: #7-#13)
  - [ ] 4.1 Locate end of iteration loop in agent.ts (around line 1252 before break)
  - [ ] 4.2 Add dispatch of `onAgentIterationFinished` before break/continue
  - [ ] 4.3 Include iteration index, accumulated messages, finish reason
  - [ ] 4.4 Handle partial return modifications (merge pattern from Story 3.3)
  - [ ] 4.5 Fire at these locations:
    - After line 1191 (iteration error - break)
    - After line 1214 (abort - break)
    - After line 1250 (finish - break) - BEFORE onAgentFinished
  - [ ] 4.6 Verify sequence: iteration → (if last) agentFinished

- [ ] Task 5: Add Unit Tests for Agent Lifecycle Events (AC: All)
  - [ ] 5.1 Test `onAgentStepFinished` receives correct event payload
  - [ ] 5.2 Test `onAgentIterationFinished` receives correct event payload
  - [ ] 5.3 Test iteration event modification via partial return
  - [ ] 5.4 Test event sequence (iteration → agentFinished)
  - [ ] 5.5 Test step modification does not affect iteration context

- [ ] Task 6: Verify Performance Requirements (AC: #12)
  - [ ] 6.1 Verify event dispatch does not block main thread
  - [ ] 6.2 Verify modification adds no noticeable latency

## Dev Notes

### Architecture Context

This story implements granular agent lifecycle events for extensions. The key insight is understanding the difference between **steps** and **iterations**:

**Step:** A single LLM response (may include tool calls)
- Fired after each `onStepFinish` callback in the agent loop
- Already implemented and dispatched at agent.ts:1052

**Iteration:** A full loop through the agent's while(true) loop
- One iteration may contain multiple steps (reasoning/thinking mode)
- Fired at the end of each iteration before continue/break
- This is the NEW event to implement

### Current Implementation Status

**onAgentStepFinished** - Already implemented:
```typescript
// src/main/agent/agent.ts:1051-1058
const extensionResult = await this.extensionManager.dispatchEvent(
  'onAgentStepFinished',
  { agentProfile: profile, currentResponseId, stepResult, finishReason, responseMessages },
  task.project,
  task,
);
responseMessages = extensionResult.responseMessages;
finishReason = extensionResult.finishReason;
```

**onAgentIterationFinished** - Not yet implemented:
- Interface not defined in types.ts
- Dispatch not added to agent loop
- Needs to be added at iteration completion points

### Agent Loop Structure (Reference)

```
runAgent() {
  // ... setup ...
  
  while (true) {
    iterationCount++;
    
    // === ITERATION START ===
    
    // Process steps (may be multiple in reasoning mode)
    onStepFinish = async (stepResult) => {
      // STEP COMPLETES HERE → onAgentStepFinished
    }
    
    // ... LLM call ...
    
    // Error handling
    if (iterationError) {
      // ITERATION ENDS (error) → NEEDS onAgentIterationFinished
      break;
    }
    
    // Abort handling
    if (effectiveAbortSignal?.aborted) {
      // ITERATION ENDS (abort) → NEEDS onAgentIterationFinished
      break;
    }
    
    // Normal completion
    if (finishReason !== 'tool-calls') {
      // ITERATION ENDS (success) → NEEDS onAgentIterationFinished
      break;
    }
    
    // Continue to next iteration (tool-calls)
    // ITERATION ENDS (will continue) → NEEDS onAgentIterationFinished
  }
  
  // === AGENT FINISHES HERE → onAgentFinished ===
}
```

### Proposed AgentIterationFinishedEvent Interface

```typescript
/** Event payload for agent iteration finished events */
export interface AgentIterationFinishedEvent {
  /** 0-based index of the iteration */
  readonly iterationIndex: number;
  
  /** Agent profile being used */
  readonly agentProfile: AgentProfile;
  
  /** Messages accumulated in this iteration (modifiable) */
  messages: ContextMessage[];
  
  /** Finish reason for this iteration */
  finishReason: FinishReason | null;
  
  /** Whether reasoning occurred in this iteration */
  readonly hasReasoning: boolean;
  
  /** Whether this was the last iteration before agent finished */
  readonly isLastIteration: boolean;
}
```

### Implementation Locations

| Location | File | Line | Action |
|----------|------|------|--------|
| Iteration end (error) | src/main/agent/agent.ts | ~1191 | Add dispatch before break |
| Iteration end (abort) | src/main/agent/agent.ts | ~1214 | Add dispatch before break |
| Iteration end (success) | src/main/agent/agent.ts | ~1250 | Add dispatch before break |
| Event type definition | src/common/extensions/types.ts | ~200 | Add interface |
| Extension interface | src/common/extensions/types.ts | ~524 | Add method |
| Event map | src/main/extensions/extension-manager.ts | ~83 | Add to map |

### Modification Pattern (from Story 3.3)

Extensions can modify event fields via partial return:

```typescript
// Extension implementation
async onAgentIterationFinished(event, context) {
  // Add metadata to messages
  if (event.isLastIteration) {
    return {
      messages: [
        ...event.messages,
        { role: 'system', content: 'Iteration completed with analysis' }
      ]
    };
  }
  
  // Modify finish reason
  if (event.finishReason === 'length') {
    context.log('Max tokens reached, suggesting continuation', 'warning');
    return { finishReason: 'stop' };
  }
}
```

### Event Sequence

The correct firing order is:
1. **Per Step:** `onAgentStepFinished` (multiple times per iteration)
2. **Per Iteration:** `onAgentIterationFinished` (once per iteration)
3. **Per Agent Run:** `onAgentFinished` (once at the end)

```
Iteration 1:
  → onAgentStepFinished (step 1)
  → onAgentStepFinished (step 2) [if reasoning mode]
  → onAgentIterationFinished
  
Iteration 2:
  → onAgentStepFinished (step 1)
  → onAgentIterationFinished
  
→ onAgentFinished (agent complete)
```

### Project Structure

| File | Purpose |
|------|---------|
| `src/common/extensions/types.ts` | Event interfaces and Extension interface |
| `src/main/extensions/extension-manager.ts` | ExtensionEventMap type |
| `src/main/agent/agent.ts` | Event dispatch in agent loop |
| `src/common/extensions/__tests__/event-types.test.ts` | Event type tests |
| `src/main/extensions/__tests__/extension-manager.test.ts` | Dispatch tests |

### References

- [Source: src/main/agent/agent.ts#L1009-1252 - Agent iteration loop]
- [Source: src/main/agent/agent.ts#L1051-1058 - onAgentStepFinished dispatch]
- [Source: src/common/extensions/types.ts#L189-204 - AgentStepFinishedEvent]
- [Source: Story 3.3 - Event modification pattern]
- [Source: Story 3.4 - Tool result modification (similar pattern)]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.5 - Requirements]

### Previous Story Intelligence

From **Story 3.4: Tool Result Modification**:
- Modification pattern uses partial return values
- Modifiable fields lack `readonly` modifier
- dispatchEvent merges partial returns with spread operator
- Extensions execute before hooks (hooks get final say)
- Empty return means no changes (pass through)

From **Story 3.3: Event Modification and Chaining**:
- All event handlers return `Promise<void | Partial<Event>>`
- Objects in return values are shallow-merged
- Arrays in return values are replaced (not merged)
- Last modifier wins for overlapping fields

From **Story 3.1: Extension Event Handler Methods**:
- `onAgentIterationFinished` is extension-only (not in hooks)
- All lifecycle events support modification
- Event payload interfaces must be complete before interface methods

### Security Considerations

- Extensions cannot modify readonly fields (iterationIndex, agentProfile, hasReasoning, isLastIteration)
- Extensions can only modify `messages` and `finishReason`
- Message injection is allowed but logged for debugging
- Malicious modifications are isolated to extension context
- Failed event handlers are caught without crashing agent

### Testing Strategy

1. **Unit Tests** in `src/common/extensions/__tests__/event-types.test.ts`:
   - Verify AgentIterationFinishedEvent interface structure
   - Verify readonly vs modifiable fields

2. **Integration Tests** in `src/main/extensions/__tests__/extension-manager.test.ts`:
   - Test onAgentIterationFinished dispatch
   - Test modification merging
   - Test event sequence (iteration → agentFinished)

3. **Manual Testing**:
   - Add test extension with onAgentIterationFinished handler
   - Verify event fires at correct times
   - Verify modifications affect agent behavior

### Common LLM Mistakes to Prevent

1. **Don't confuse steps and iterations** - Steps are single LLM responses, iterations are full loop cycles
2. **Don't fire iteration event before checking break condition** - Fire right before break/continue
3. **Don't forget error and abort paths** - Iteration also ends on error/abort
4. **Don't modify iterationIndex** - It's readonly for a reason
5. **Don't fire onAgentIterationFinished after onAgentFinished** - Sequence matters
6. **Don't create new dispatch pattern** - Use existing dispatchEvent pattern
7. **Don't skip the continue case** - Iteration "completes" even when continuing

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

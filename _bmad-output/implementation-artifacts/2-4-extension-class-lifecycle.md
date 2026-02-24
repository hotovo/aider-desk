# Story 2.4: Extension Class Lifecycle

Status: review

## Story

As a **system developer**,
I want **to verify and test the extension lifecycle methods for initialization and cleanup**,
So that **extensions can set up resources and clean up properly with error isolation**.

## Acceptance Criteria

1. `onLoad(context: ExtensionContext)` method is called when extension is loaded by ExtensionManager
2. ExtensionContext instance is passed to onLoad with all required dependencies
3. Extension can initialize internal state and register resources in `onLoad()`
4. `onUnload()` method is called when extension is unloaded or reloaded
5. Extension can release resources and save state in `onUnload()`
6. Lifecycle methods are wrapped in try-catch for error isolation (NFR10)
7. Errors in lifecycle methods are logged via context.log() without crashing AiderDesk (NFR6)
8. Unit tests verify lifecycle method calls and error handling work correctly
9. ExtensionManager properly tracks initialization state via `setInitialized()`

## Tasks / Subtasks

- [x] Task 1: Verify Lifecycle Implementation in ExtensionManager (AC: #1-#7)
  - [x] 1.1 Review `initializeExtension()` method calls `onLoad(context)` with ExtensionContextImpl
  - [x] 1.2 Review `unloadExtension()` and `dispose()` methods call `onUnload()`
  - [x] 1.3 Verify try-catch wrapping around lifecycle method calls
  - [x] 1.4 Verify errors are logged via logger (context.log() available)
  - [x] 1.5 Verify failed extensions don't prevent others from loading
  - [x] 1.6 Review `reloadExtension()` properly calls onUnload then onLoad

- [ ] Task 2: Create Unit Tests for Lifecycle (AC: #8)
  - [ ] 2.1 Create `src/main/extensions/__tests__/extension-lifecycle.test.ts`
  - [ ] 2.2 Test onLoad is called with ExtensionContext during initialization
  - [ ] 2.3 Test onUnload is called during dispose
  - [ ] 2.4 Test onUnload is called during extension reload
  - [ ] 2.5 Test error in onLoad is caught and logged
  - [ ] 2.6 Test error in onUnload is caught and logged
  - [ ] 2.7 Test extension can initialize state in onLoad
  - [ ] 2.8 Test initialization state is tracked correctly

- [ ] Task 3: Run Type Check and Tests (AC: #9)
  - [ ] 3.1 Run `npm run typecheck` to ensure no TypeScript errors
  - [ ] 3.2 Run `npm run test:node` to ensure all tests pass
  - [ ] 3.3 Verify no regressions in existing tests

## Dev Notes

### Architecture Context

**Extension API Structure (Class-Based with Explicit Lifecycle):**

The extension system uses class-based extensions with explicit lifecycle methods:
- `onLoad(context: ExtensionContext)` - Called when extension is loaded
- `onUnload()` - Called when extension is unloaded or reloaded

**Existing Implementation (from Previous Stories):**

**Story 2.1 (Extension Type Definitions):**
- `Extension` interface defined in `src/common/extensions/types.ts`
- Lifecycle methods: `onLoad?()` and `onUnload?()` are optional
- Full ExtensionContext interface with all required methods
- ExtensionConstructor type for instantiating extension classes

**Story 2.2 (ExtensionContext Implementation):**
- ExtensionContextImpl fully implemented
- Methods: log, getProjectDir, getCurrentTask, createTask, createSubtask
- getAgentProfiles, getModelConfigs, getSetting, updateSettings
- UI methods throw NotImplementedError (Epic 5)
- Ready for use in lifecycle methods

**Story 2.3 (Tool Definition Interface):**
- ToolDefinition interface verified with Zod schema support
- Tests created in `src/main/extensions/__tests__/tool-definition.test.ts`
- Pattern established for testing extension interfaces

### Current Lifecycle Implementation

**Location:** `src/main/extensions/extension-manager.ts`

**onLoad Flow:**
```typescript
// In initializeExtension()
const context = new ExtensionContextImpl(
  metadata.name,
  this.store,
  this.agentProfileManager,
  this.modelManager,
  project  // optional
);

await instance.onLoad(context);
this.registry.setInitialized(metadata.name, true);
```

**onUnload Flow:**
```typescript
// In unloadExtension() and dispose()
if (instance.onUnload) {
  try {
    await instance.onUnload();
  } catch (error) {
    logger.error(`Failed to unload extension:`, error);
  }
}
```

**Error Isolation:**
- All lifecycle calls wrapped in try-catch
- Errors logged with extension name context
- Failed extensions don't prevent others from loading
- `setInitialized()` only called on successful onLoad

### Key Implementation Details

**ExtensionManager.init() Flow:**
1. Call `loadGlobalExtensions()` to discover and validate extensions
2. For each loaded extension, call `initializeExtension()`
3. If onLoad fails, log error and add to errors array
4. Continue loading other extensions (NFR6)

**Hot Reload Flow:**
1. Call `unloadExtension()` which triggers onUnload
2. Unregister from registry
3. Re-validate and re-load extension
4. Call `initializeExtension()` which triggers onLoad

**Initialization Tracking:**
- `LoadedExtension.initialized` flag tracks state
- `registry.setInitialized(name, true)` called after successful onLoad
- Extensions without onLoad are marked initialized immediately

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/main/extensions/__tests__/extension-lifecycle.test.ts` | Unit tests for lifecycle methods |

**Files to Review:**

| File | What to Verify |
|------|----------------|
| `src/main/extensions/extension-manager.ts` | Lifecycle method calls and error handling |
| `src/main/extensions/extension-context.ts` | ExtensionContext implementation |
| `src/main/extensions/extension-registry.ts` | Initialization state tracking |
| `src/common/extensions/types.ts` | Extension interface with lifecycle methods |

### Test File Structure

**Location:** `src/main/extensions/__tests__/extension-lifecycle.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExtensionManager } from '../extension-manager';
import type { Extension, ExtensionContext } from '@common/extensions';

// Mock dependencies
vi.mock('@/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Extension Lifecycle', () => {
  describe('onLoad', () => {
    it('should call onLoad with ExtensionContext during initialization', async () => {
      // Test that onLoad is called with proper context
    });

    it('should allow extension to initialize state in onLoad', async () => {
      // Test state initialization in onLoad
    });

    it('should catch and log errors in onLoad', async () => {
      // Test error isolation
    });

    it('should mark extension as initialized after successful onLoad', async () => {
      // Test initialization tracking
    });
  });

  describe('onUnload', () => {
    it('should call onUnload during dispose', async () => {
      // Test onUnload called on dispose
    });

    it('should call onUnload during extension reload', async () => {
      // Test onUnload called before reload
    });

    it('should catch and log errors in onUnload', async () => {
      // Test error isolation in cleanup
    });

    it('should allow extension to release resources in onUnload', async () => {
      // Test resource cleanup
    });
  });

  describe('Error Isolation', () => {
    it('should continue loading other extensions when one fails', async () => {
      // Test NFR6 compliance
    });

    it('should not crash AiderDesk on extension errors', async () => {
      // Test NFR10 compliance
    });
  });
});
```

### Integration Notes

This story focuses on **testing and verifying** the already-implemented lifecycle methods:

1. **Review Implementation:** Verify ExtensionManager correctly implements lifecycle
2. **Create Tests:** Add comprehensive tests for lifecycle behavior
3. **Verify Error Isolation:** Ensure NFR6 and NFR10 compliance

**Dependencies on Previous Stories:**
- Story 2.1: Extension interface with lifecycle methods
- Story 2.2: ExtensionContext implementation
- Story 1.4: Extension loading with jiti
- Story 1.5: Extension startup integration

**Future Stories:**
- Story 2.5: Tool Registration via getTools() - Uses lifecycle for tool collection
- Story 2.6: Tool Integration with Agent System - Depends on initialized extensions
- Epic 4: Extension lifecycle state methods (onLoadState, onSaveState)

### Common LLM Mistakes to Prevent

1. **Don't modify the ExtensionManager implementation unnecessarily** - The lifecycle methods are already correctly implemented. Focus on testing.

2. **Don't skip error handling tests** - NFR6 and NFR10 are critical requirements that must be tested.

3. **Use existing patterns** - Follow the test patterns from Story 2.3 (`tool-definition.test.ts`).

4. **Mock external dependencies** - Use Vitest mocks for logger, store, and other external services.

5. **Test both success and failure paths** - Verify lifecycle works correctly when errors occur.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Extension API Structure]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4]
- [Source: src/main/extensions/extension-manager.ts - Lifecycle implementation]
- [Source: src/main/extensions/extension-context.ts - ExtensionContext implementation]
- [Source: src/common/extensions/types.ts - Extension interface]
- [Source: _bmad-output/implementation-artifacts/2-3-tool-definition-interface.md - Test patterns]

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet

### Debug Log References

N/A

### Completion Notes List

- Created comprehensive unit tests for extension lifecycle methods in `src/main/extensions/__tests__/extension-lifecycle.test.ts`
- All 20 tests pass covering:
  - onLoad called with ExtensionContext during initialization
  - onUnload called during dispose and reload
  - Error handling in both onLoad and onUnload
  - Initialization state tracking via registry
  - Error isolation (NFR6, NFR10 compliance)
- Full test suite (545 tests) passes with no regressions
- TypeScript compilation passes with no errors

### File List
- src/main/extensions/__tests__/extension-lifecycle.test.ts (created)

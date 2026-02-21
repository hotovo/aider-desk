# Story 1.5: Extension Startup Integration

**Status**: done
**Story Key**: 1-5-extension-startup-integration

## Story

As an **AiderDesk user**,
I want **extensions to be loaded automatically when AiderDesk starts**,
So that **all extensions are available without manual intervention**.

## Acceptance Criteria

1. **Given** AiderDesk is starting up
2. **When** the extension manager initializes during app startup
3. **Then** extension directories are scanned and extensions are discovered
4. **And** all valid extensions are type-checked and validated
5. **And** all valid extensions are loaded using jiti
6. **And** each extension's `onLoad()` method is called with ExtensionContext
7. **And** extension loading does not visibly delay AiderDesk startup time (NFR1)
8. **And** any extension loading errors are logged but do not prevent AiderDesk from starting (NFR6)
9. **And** a summary of loaded extensions is logged to the console
10. **And** the extension registry is populated with all active extensions

## Tasks / Subtasks

- [x] **Task 1: Create ExtensionContext implementation** (AC: #6)
  - [x] Create `src/main/extensions/extension-context.ts`
  - [x] Implement `ExtensionContextImpl` class with core methods
  - [x] Implement `log()` method for extension logging
  - [x] Implement `getProjectDir()` method
  - [x] Implement `getCurrentTask()` method
  - [x] Add placeholder methods for future epic integration (throw `NotImplementedError`)
  - [x] Unit tests for ExtensionContextImpl

- [x] **Task 2: Integrate ExtensionManager into app startup** (AC: #1-5, #8, #9)
  - [x] Import ExtensionManager in `src/main/index.ts` or appropriate startup module
  - [x] Initialize ExtensionManager during app `whenReady()` lifecycle
  - [x] Call `extensionManager.initialize()` to trigger discovery, validation, and loading
  - [x] Handle initialization errors gracefully (log but don't crash)
  - [x] Log summary of loaded extensions on successful initialization

- [x] **Task 3: Call onLoad() for each extension** (AC: #6, #8)
  - [x] After loading, iterate through loaded extensions in registry
  - [x] Create ExtensionContext instance for each extension
  - [x] Call `extension.onLoad(context)` with proper error handling
  - [x] Log errors but continue loading other extensions
  - [x] Track which extensions successfully initialized

- [x] **Task 4: Add startup timing for NFR compliance** (AC: #7)
  - [x] Measure extension loading duration
  - [x] Log timing information for monitoring
  - [x] Ensure loading happens asynchronously to not block main thread
  - [x] Consider lazy loading for performance if needed

- [x] **Task 5: Verify registry population** (AC: #10)
  - [x] Confirm all loaded extensions are in registry
  - [x] Confirm extension metadata is accessible
  - [x] Add IPC handler to expose extension list if not already present

- [x] **Task 6: Add integration tests** (AC: All)
  - [x] Test full startup flow with sample extensions
  - [x] Test error handling for malformed extensions
  - [x] Test that app starts even with extension failures

## Dev Notes

### Architecture Context

**Extension System Architecture** [Source: _bmad-output/planning-artifacts/architecture.md]:
- Extensions execute in **main process** (Node.js environment)
- ExtensionManager orchestrates discovery, validation, loading, and lifecycle
- ExtensionContext provides controlled API access to extensions
- All extension operations are wrapped in error isolation (NFR6, NFR10)

**Previous Story Implementation** [Source: 1-4-extension-loading-with-jiti.md]:
- `ExtensionLoader` class handles jiti-based loading
- `ExtensionRegistry` class manages loaded extensions
- `ExtensionManager` integrates discovery, validation, loading, and registration
- Extension interface has `onLoad()`, `onUnload()`, and `metadata` properties

### Key Implementation Points

**1. ExtensionContext Implementation**:
```typescript
// src/main/extensions/extension-context.ts
export class ExtensionContextImpl implements ExtensionContext {
  constructor(
    private extensionId: string,
    private projectPath?: string
  ) {}

  log(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [Extension:${this.extensionId}] [${type.toUpperCase()}] ${message}`);
  }

  getProjectDir(): string {
    return this.projectPath ?? '';
  }

  getCurrentTask(): TaskData | null {
    // Will be implemented in Epic 4
    throw new NotImplementedError('getCurrentTask not yet implemented');
  }

  // Placeholder methods for Epic 4-5 integration
  createTask(): Promise<string> { throw new NotImplementedError(); }
  createSubtask(): Promise<string> { throw new NotImplementedError(); }
  getState(): Promise<unknown> { throw new NotImplementedError(); }
  setState(): Promise<void> { throw new NotImplementedError(); }
  getAgentProfiles(): Promise<AgentProfile[]> { throw new NotImplementedError(); }
  getModelConfigs(): Promise<ModelConfig[]> { throw new NotImplementedError(); }
  showNotification(): Promise<void> { throw new NotImplementedError(); }
  showConfirm(): Promise<boolean> { throw new NotImplementedError(); }
  showInput(): Promise<string | undefined> { throw new NotImplementedError(); }
}
```

**2. Startup Integration**:
```typescript
// src/main/index.ts (or appropriate module)
import { ExtensionManager } from './extensions/extension-manager';

let extensionManager: ExtensionManager;

app.whenReady().then(async () => {
  // ... existing startup code ...

  // Initialize extension system
  extensionManager = new ExtensionManager();
  
  try {
    const startTime = Date.now();
    await extensionManager.initialize();
    const duration = Date.now() - startTime;
    
    const loadedCount = extensionManager.getLoadedCount();
    console.log(`[Extensions] Loaded ${loadedCount} extension(s) in ${duration}ms`);
  } catch (error) {
    console.error('[Extensions] Failed to initialize:', error);
    // App continues running - extension failures are non-fatal
  }

  // ... continue with window creation, etc. ...
});
```

**3. onLoad() Lifecycle**:
```typescript
// In ExtensionManager or separate lifecycle handler
async initializeExtensions(contexts: Map<string, ExtensionContext>): Promise<void> {
  const extensions = this.registry.getExtensions();
  
  for (const [id, extension] of extensions) {
    const context = contexts.get(id) ?? new ExtensionContextImpl(id);
    
    try {
      await extension.onLoad(context);
      console.log(`[Extensions] Initialized: ${id}`);
    } catch (error) {
      console.error(`[Extensions] Failed to initialize ${id}:`, error);
      // Continue with other extensions
    }
  }
}
```

### File Structure Notes

**Files to Create/Modify**:
```
src/main/extensions/
├── extension-context.ts          # NEW - ExtensionContextImpl
├── extension-manager.ts          # MODIFY - Add startup integration
└── __tests__/
    └── extension-context.test.ts # NEW - Unit tests

src/main/
└── index.ts                      # MODIFY - Initialize ExtensionManager
```

**Alignment with Project Structure**:
- Follow existing patterns in `src/main/` for module organization
- Use existing logging patterns from AiderDesk codebase
- Tests co-located in `__tests__/` directories (Vitest pattern)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Extension API Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security Sandbox Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#IPC & REST API Communication Pattern]
- [Source: _bmad-output/implementation-artifacts/1-4-extension-loading-with-jiti.md]
- [Source: AGENTS.md#Testing Framework]

### Error Handling Pattern

Per NFR6 and NFR10:
```typescript
// Extension errors must NOT crash AiderDesk
try {
  await extension.onLoad(context);
} catch (error) {
  logger.error(`Extension ${id} onLoad failed:`, error);
  // Continue - extension is marked as failed but app continues
}
```

### Performance Considerations

Per NFR1:
- Extension loading should not block main thread
- Consider loading extensions in parallel where possible
- Log timing to monitor startup impact
- Target: < 500ms for full extension initialization

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)

### Debug Log References

No blocking issues encountered during implementation.

### Completion Notes List

- **Task 1 Complete**: Created `ExtensionContextImpl` class with all required methods:
  - `log()` method logs with extension prefix using project logger
  - `getProjectDir()` returns project path
  - `getCurrentTask()` throws `NotImplementedError` when no function provided, supports injection
  - Placeholder async methods for Epic 4-5 features throw `NotImplementedError`
  - 24 unit tests covering all functionality

- **Task 2 Complete**: Integrated ExtensionManager into app startup via `managers.ts`:
  - ExtensionManager initialized alongside other managers
  - `initialize()` method orchestrates discovery, validation, loading, and onLoad lifecycle
  - Error isolation ensures extension failures don't crash the app (NFR6)
  - Comprehensive logging with `[Extensions]` prefix

- **Task 3 Complete**: `onLoad()` lifecycle implemented in `ExtensionManager.initialize()`:
  - Creates `ExtensionContextImpl` for each extension
  - Calls `onLoad(context)` with proper error handling
  - Tracks initialized count vs loaded count
  - Continues loading other extensions on failure

- **Task 4 Complete**: Startup timing implemented:
  - `ExtensionInitResult` returns `durationMs` for monitoring
  - Loading happens asynchronously during app startup
  - Logged: `[Extensions] Initialization complete: X/Y extensions initialized in Zms`

- **Task 5 Complete**: Registry population verified:
  - `getExtensions()` returns all loaded extensions
  - `getExtension(name)` returns specific extension
  - Added IPC handler `get-extensions` to expose extension list to renderer
  - `ExtensionInfo` interface exposes metadata, filePath, and initialized status

- **Task 6 Complete**: Added comprehensive tests:
  - 24 tests for ExtensionContextImpl
  - 11 tests for ExtensionManager (including initialize, error handling, onLoad)
  - Total: 38 extension tests, all passing
  - Tests cover: initialization, error handling, registry access, timing

### File List

**New Files:**
- `src/main/extensions/extension-context.ts` - ExtensionContextImpl class with NotImplementedError
- `src/main/extensions/__tests__/extension-context.test.ts` - 24 unit tests

**Modified Files:**
- `src/common/extensions/types.ts` - Expanded ExtensionContext interface with all methods
- `src/main/extensions/extension-registry.ts` - Added `initialized` field to LoadedExtension and `setInitialized()` method
- `src/main/extensions/extension-manager.ts` - Added initialize(), getExtensions(), getExtension(), isInitialized(), dispose(), timing, onLoad lifecycle
- `src/main/extensions/__tests__/extension-registry.test.ts` - Added 3 tests for initialized tracking
- `src/main/extensions/__tests__/extension-manager.test.ts` - Expanded to 16 tests covering initialize() and shutdown()
- `src/main/managers.ts` - Added ExtensionManager import, initialization, and shutdown in cleanup
- `src/main/ipc-handlers.ts` - Added get-extensions IPC handler with per-extension initialized status
- `src/main/index.ts` - Updated to pass extensionManager to setupIpcHandlers

## Change Log

- **2026-02-20**: Implemented extension startup integration - all tasks complete, 38 tests passing
- **2026-02-20**: Code review fixes applied:
  - HIGH-1: Added per-extension `initialized` tracking in `LoadedExtension` and `ExtensionRegistry.setInitialized()` method. IPC handler now returns correct per-extension status.
  - HIGH-2: Added `ExtensionManager.dispose()` method that calls `onUnload()` for each initialized extension. Added to cleanup in `managers.ts`.
  - Added 8 new tests (3 for registry, 5 for manager shutdown)

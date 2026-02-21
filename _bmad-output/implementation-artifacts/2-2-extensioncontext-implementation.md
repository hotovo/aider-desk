# Story 2.2: ExtensionContext Implementation

Status: review

## Story

As a **system developer**,
I want **to implement the ExtensionContext class that extensions use to interact with AiderDesk**,
So that **extensions have controlled access to AiderDesk capabilities**.

## Acceptance Criteria

1. `log(message, type)` method writes to extension logger with timestamp ✅ (already implemented)
2. `getProjectDir()` returns current project directory path ✅ (already implemented)
3. `getCurrentTask()` returns active task data or null ✅ (already implemented)
4. Methods for task management (createTask, createSubtask) are implemented with Project integration
5. Methods for state management (getState, setState) are implemented with database storage
6. Methods for settings access (getSetting, updateSettings) are implemented with Store integration
7. Methods for model/profile access (getAgentProfiles, getModelConfigs) are implemented with appropriate managers
8. Methods for UI interaction (showNotification, showConfirm, showInput) throw NotImplementedError (to be implemented in Epic 5)
9. ExtensionContext is instantiated with dependencies for future epic integration
10. ExtensionContext maintains isolation from direct system access (FR54, FR55)
11. All methods properly handle errors and log appropriately without crashing AiderDesk (NFR6, NFR10)

## Tasks / Subtasks

- [x] Task 1: Database Schema for Extension State (AC: #5)
  - [x] 1.1 Add `extension_state` table to DataManager.init() method with schema: extension_id, key, value (JSON), updated_at
  - [x] 1.2 Add `getExtensionState(extensionId, key)` method to DataManager returning parsed JSON value or undefined
  - [x] 1.3 Add `setExtensionState(extensionId, key, value)` method to DataManager with upsert logic
  - [x] 1.4 Add unit tests for database state operations

- [x] Task 2: State Management Implementation (AC: #5, #11)
  - [x] 2.1 Update ExtensionContextImpl constructor to accept DataManager dependency
  - [x] 2.2 Implement `getState(key)` to query extension_state table via DataManager
  - [x] 2.3 Implement `setState(key, value)` to upsert extension_state table via DataManager
  - [x] 2.4 Add error handling with logging for state operations
  - [x] 2.5 Add unit tests for getState/setState methods

- [x] Task 3: Settings Access Implementation (AC: #6, #11)
  - [x] 3.1 Update ExtensionContextImpl constructor to accept Store dependency
  - [x] 3.2 Implement `getSetting(key)` with dot notation support (e.g., 'general.theme')
  - [x] 3.3 Implement `updateSettings(updates)` with partial settings update
  - [x] 3.4 Add error handling with logging for settings operations
  - [x] 3.5 Add unit tests for getSetting/updateSettings methods

- [x] Task 4: Task Management Implementation (AC: #4, #11)
  - [x] 4.1 Update ExtensionContextImpl constructor to accept Project dependency
  - [x] 4.2 Implement `createTask(name, parentId?)` using Project.createNewTask()
  - [x] 4.3 Implement `createSubtask(name, parentTaskId)` using Project.createNewTask() with parentId
  - [x] 4.4 Add error handling with clear error messages when context is missing
  - [x] 4.5 Add unit tests for createTask/createSubtask methods

- [x] Task 5: Model & Profile Access Implementation (AC: #7, #11)
  - [x] 5.1 Update ExtensionContextImpl constructor to accept AgentProfileManager dependency
  - [x] 5.2 Update ExtensionContextImpl constructor to accept Store for model configs (used ModelManager instead)
  - [x] 5.3 Implement `getAgentProfiles()` returning array of agent profiles from Store
  - [x] 5.4 Implement `getModelConfigs()` returning array of model configurations from ModelManager
  - [x] 5.5 Add error handling with graceful fallback (return empty array)
  - [x] 5.6 Add unit tests for getAgentProfiles/getModelConfigs methods

- [x] Task 6: ExtensionManager Integration (AC: #9)
  - [x] 6.1 Update ExtensionManager to obtain references to required dependencies (Store, DataManager, Project, AgentProfileManager, ModelManager)
  - [x] 6.2 Update `initializeExtension()` to pass all dependencies to ExtensionContextImpl constructor
  - [x] 6.3 Update `reloadExtension()` to pass all dependencies to ExtensionContextImpl constructor
  - [x] 6.4 Add integration tests verifying extensions receive fully functional context

- [x] Task 7: Verification and Documentation (AC: all)
  - [x] 7.1 Verify UI interaction methods still throw NotImplementedError correctly (Epic 5 scope)
  - [x] 7.2 Run full test suite and fix any regressions
  - [x] 7.3 Update inline documentation/JSDoc where methods are implemented

## Dev Notes

### Architecture Context

**Previous Story (2-1: Extension Type Definitions) Completed:**
- Complete TypeScript interfaces defined in `src/common/extensions/types.ts`
- `Extension` interface with all event handlers, `getTools()`, `getUIElements()`
- `ExtensionContext` interface with all API methods
- `ExtensionContextImpl` created with stub implementations throwing `NotImplementedError`
- 22 event payload interfaces defined
- Types exported from `src/common/extensions/index.ts`

**Current State of ExtensionContextImpl:**
The file `src/main/extensions/extension-context.ts` contains:
- ✅ `log(message, type)` - Working, writes to logger with `[Extension:extensionId]` prefix
- ✅ `getProjectDir()` - Working, returns project path from constructor
- ✅ `getCurrentTask()` - Working (uses function passed in constructor)
- ⏳ `createTask(name, parentId?)` - Throws NotImplementedError
- ⏳ `createSubtask(name, parentTaskId)` - Throws NotImplementedError
- ⏳ `getAgentProfiles()` - Throws NotImplementedError
- ⏳ `getModelConfigs()` - Throws NotImplementedError
- ⏳ `getState(key)` - Throws NotImplementedError
- ⏳ `setState(key, value)` - Throws NotImplementedError
- ⏳ `getSetting(key)` - Throws NotImplementedError
- ⏳ `updateSettings(updates)` - Throws NotImplementedError
- 🔒 `showNotification()` - Keep as NotImplementedError (Epic 5)
- 🔒 `showConfirm()` - Keep as NotImplementedError (Epic 5)
- 🔒 `showInput()` - Keep as NotImplementedError (Epic 5)

### Database Schema for Extension State

**Table: extension_state**
```sql
CREATE TABLE IF NOT EXISTS extension_state (
  extension_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,  -- JSON encoded
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (extension_id, key)
);
```

**DataManager Methods to Add:**
```typescript
// In src/main/data-manager/data-manager.ts

public getExtensionState(extensionId: string, key: string): unknown {
  const sql = `SELECT value FROM extension_state WHERE extension_id = ? AND key = ?`;
  const row = this.db.prepare(sql).get(extensionId, key) as { value: string } | undefined;
  return row ? JSON.parse(row.value) : undefined;
}

public setExtensionState(extensionId: string, key: string, value: unknown): void {
  const sql = `
    INSERT INTO extension_state (extension_id, key, value, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(extension_id, key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `;
  this.db.prepare(sql).run(extensionId, key, JSON.stringify(value));
}
```

### Implementation Patterns

**Constructor Dependency Injection:**
```typescript
// src/main/extensions/extension-context.ts
export class ExtensionContextImpl implements ExtensionContext {
  constructor(
    private readonly extensionId: string,
    private readonly projectPath?: string,
    private readonly getCurrentTaskFn?: () => TaskData | null,
    // NEW dependencies:
    private readonly project?: Project,
    private readonly store?: Store,
    private readonly dataManager?: DataManager,
  ) {}
}
```

**State Management Pattern:**
```typescript
async getState(key: string): Promise<unknown> {
  if (!this.dataManager) {
    this.log('DataManager not available for state operations', 'warn');
    return undefined;
  }
  try {
    return this.dataManager.getExtensionState(this.extensionId, key);
  } catch (error) {
    this.log(`Failed to get state for key '${key}': ${error}`, 'error');
    return undefined;
  }
}

async setState(key: string, value: unknown): Promise<void> {
  if (!this.dataManager) {
    throw new Error('DataManager not available for state operations');
  }
  try {
    this.dataManager.setExtensionState(this.extensionId, key, value);
  } catch (error) {
    this.log(`Failed to set state for key '${key}': ${error}`, 'error');
    throw error;
  }
}
```

**Settings Access Pattern (with dot notation):**
```typescript
async getSetting(key: string): Promise<unknown> {
  if (!this.store) {
    throw new Error('Store not available for settings access');
  }
  const settings = this.store.getSettings();
  // Support dot notation: 'general.theme' -> settings.general.theme
  return key.split('.').reduce((obj: Record<string, unknown>, k: string) => 
    (obj && typeof obj === 'object') ? (obj as Record<string, unknown>)[k] : undefined, 
    settings as Record<string, unknown>
  );
}

async updateSettings(updates: Record<string, unknown>): Promise<void> {
  if (!this.store) {
    throw new Error('Store not available for settings access');
  }
  const currentSettings = this.store.getSettings();
  const newSettings = { ...currentSettings, ...updates };
  this.store.saveSettings(newSettings);
}
```

**Task Creation Pattern:**
```typescript
async createTask(name: string, parentId?: string): Promise<string> {
  if (!this.project) {
    throw new Error('No project context available for task creation');
  }
  try {
    const task = await this.project.createNewTask({ name, parentId });
    this.log(`Created task: ${task.id}`, 'info');
    return task.id;
  } catch (error) {
    this.log(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  }
}
```

**Agent Profiles & Model Configs Pattern:**
```typescript
async getAgentProfiles(): Promise<AgentProfile[]> {
  if (!this.store) {
    this.log('Store not available, returning empty agent profiles', 'warn');
    return [];
  }
  try {
    const settings = this.store.getSettings();
    return settings.agentProfiles || [];
  } catch (error) {
    this.log(`Failed to get agent profiles: ${error}`, 'error');
    return [];
  }
}

async getModelConfigs(): Promise<Model[]> {
  if (!this.store) {
    this.log('Store not available, returning empty model configs', 'warn');
    return [];
  }
  try {
    const settings = this.store.getSettings();
    // Extract models from provider configurations
    return settings.providers?.flatMap(p => p.models || []) || [];
  } catch (error) {
    this.log(`Failed to get model configs: ${error}`, 'error');
    return [];
  }
}
```

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/main/data-manager/data-manager.ts` | Add extension_state table and methods |
| `src/main/extensions/extension-context.ts` | Implement all stub methods |
| `src/main/extensions/extension-manager.ts` | Pass dependencies to ExtensionContextImpl |

**Test Files:**

| File | Purpose |
|------|---------|
| `src/main/data-manager/__tests__/data-manager.test.ts` | Test extension_state table operations |
| `src/main/extensions/__tests__/extension-context.test.ts` | Test all new method implementations |
| `src/main/extensions/__tests__/extension-manager.test.ts` | Test dependency injection |

### Dependencies Analysis

**Required Dependencies for ExtensionContextImpl:**
1. **DataManager** (`src/main/data-manager/data-manager.ts`) - For state persistence
2. **Store** (`src/main/store.ts`) - For settings access and agent profiles/model configs
3. **Project** (`src/main/project.ts`) - For task creation

**How ExtensionManager Gets Dependencies:**
- ExtensionManager is instantiated by the main application
- It needs to receive or obtain references to:
  - `DataManager` (singleton, accessed via import or injection)
  - `Store` (accessed via import or injection)
  - `Project` (passed per-project when initializing extensions)

### Critical Implementation Notes

1. **Error Isolation:** All methods must catch errors and log them without crashing AiderDesk (NFR10)
2. **Graceful Degradation:** Methods that query data should return empty results ([], undefined) when dependencies are unavailable
3. **Consistent Logging:** Use `this.log()` for all error/warning messages with `[Extension:${extensionId}]` prefix
4. **State Serialization:** State values must be JSON-serializable; add error handling for non-serializable values
5. **Settings Validation:** Consider validating settings updates don't break AiderDesk configuration

### What Remains for Future Epics

**Epic 5 (UI Elements):**
- `showNotification(message, type?)` - Needs IPC to renderer
- `showConfirm(message, confirmText?, cancelText?)` - Needs dialog component
- `showInput(prompt, placeholder?, defaultValue?)` - Needs input dialog component

These methods should continue to throw `NotImplementedError` after this story.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Extension API Structure]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2]
- [Source: src/common/extensions/types.ts - ExtensionContext interface]
- [Source: src/main/extensions/extension-context.ts - Current stub implementation]
- [Source: src/main/data-manager/data-manager.ts - Database operations pattern]
- [Source: src/main/store.ts - Settings storage pattern]
- [Source: _bmad-output/implementation-artifacts/2-1-extension-type-definitions.md - Previous story learnings]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List


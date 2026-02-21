# Story 1.2: Extension File Discovery

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **system developer**,
I want **to scan extension directories and discover TypeScript files**,
So that **all available extensions can be identified for loading**.

## Acceptance Criteria

1. **Given** extension directories are defined in constants
2. **When** the extension discovery scans `AIDER_DESK_EXTENSIONS_DIR` and `AIDER_DESK_GLOBAL_EXTENSIONS_DIR`
3. **Then** all `.ts` files in global directory are discovered
4. **And** all `.ts` files in project directory are discovered
5. **And** project extension files override global extensions with the same filename
6. **And** extensions are discovered in alphabetical order by filename
7. **And** a list of discovered extension file paths is returned
8. **And** missing directories are handled gracefully without errors

## Tasks / Subtasks

- [x] Create ExtensionManager class with discovery method (AC: 1, 2, 8)
  - [x] Define file location: src/main/extensions/extension-manager.ts
  - [x] Create ExtensionManager class
  - [x] Add discoverExtensions() method
- [x] Implement directory existence checking (AC: 8)
  - [x] Check global extension directory exists
  - [x] Check project extension directory exists
  - [x] Handle missing directories gracefully (return empty array)
- [x] Implement TypeScript file discovery (AC: 3, 4)
  - [x] Scan global directory for .ts files
  - [x] Scan project directory for .ts files
  - [x] Use fs.readdir for directory listing
  - [x] Filter files by .ts extension
- [x] Implement filename-based override logic (AC: 5)
  - [x] Collect all extension files from both directories
  - [x] Deduplicate by filename (project overrides global)
  - [x] Maintain project extensions in result
- [x] Implement alphabetical ordering (AC: 6)
  - [x] Sort discovered extensions by filename
  - [x] Return sorted array of file paths
- [x] Add error handling and logging (AC: 8)
  - [x] Wrap operations in try-catch
  - [x] Log discovered extensions
  - [x] Log errors without throwing
- [x] Write comprehensive unit tests (AC: 1-8)
  - [x] Test discovery with existing directories
  - [x] Test discovery with missing directories
  - [x] Test override logic (project vs global)
  - [x] Test alphabetical ordering
  - [x] Test .ts file filtering
- [x] Export ExtensionManager (AC: 1, 2)
  - [x] Create src/main/extensions/index.ts
  - [x] Export ExtensionManager for use in other modules

## Dev Notes

This story implements the extension discovery mechanism that scans both global and project extension directories for TypeScript files. The discovery process handles missing directories gracefully and implements filename-based overrides where project extensions take precedence over global extensions with the same filename.

### Dev Agent Record

#### Implementation Plan

1. Created ExtensionManager class in src/main/extensions/extension-manager.ts
2. Implemented discoverExtensions() method that scans both global and project directories
3. Added scanDirectory() private method for directory scanning
4. Implemented override logic using Map (project overrides global)
5. Implemented alphabetical sorting by filename
6. Added comprehensive error handling and logging
7. Created index.ts for clean exports
8. Wrote 15 comprehensive unit tests covering all acceptance criteria

#### Technical Decisions

- Used fs.promises for async file operations (following project patterns)
- Used Map for efficient override implementation (project wins over global)
- Used localeCompare for alphabetical sorting (consistent with other parts of codebase)
- Added logging for discovered extensions and errors (following HookManager pattern)
- Graceful error handling - never throws exceptions

#### Completion Notes

✅ ExtensionManager class created in src/main/extensions/extension-manager.ts
✅ discoverExtensions() method scans both global and project directories
✅ Directory existence checking with graceful handling of missing directories
✅ TypeScript file discovery with .ts extension filtering
✅ Filename-based override logic (project extensions override global)
✅ Alphabetical ordering by filename using localeCompare
✅ Error handling with try-catch blocks and logging
✅ Comprehensive unit tests (15 tests, all passing)
✅ Index.ts created for clean exports

All acceptance criteria met and validated through tests.

### File List

**New Files:**
- src/main/extensions/extension-manager.ts
- src/main/extensions/index.ts
- src/main/extensions/__tests__/extension-manager.test.ts

**Modified Files:**
- None

**Deleted Files:**
- None

### Change Log

2026-02-19: Implemented extension file discovery mechanism (Story 1.2)
- Created ExtensionManager class with discoverExtensions() method
- Implemented directory scanning for .ts files
- Added filename-based override logic (project overrides global)
- Implemented alphabetical sorting by filename
- Added error handling and logging
- Created comprehensive unit tests (15 tests, all passing)
- All acceptance criteria satisfied

### Project Structure Notes

This story implements the extension discovery mechanism that scans both global and project extension directories for TypeScript files. The discovery process handles missing directories gracefully and implements filename-based overrides where project extensions take precedence over global extensions with the same filename.

### Dev Agent Record

#### Implementation Plan

1. Created ExtensionManager class in src/main/extensions/extension-manager.ts
2. Implemented discoverExtensions() method that scans both global and project directories
3. Added scanDirectory() private method for directory scanning
4. Implemented override logic using Map (project overrides global)
5. Implemented alphabetical sorting by filename
6. Added comprehensive error handling and logging
7. Created index.ts for clean exports
8. Wrote 15 comprehensive unit tests covering all acceptance criteria

#### Technical Decisions

- Used fs.promises for async file operations (following project patterns)
- Used Map for efficient override implementation (project wins over global)
- Used localeCompare for alphabetical sorting (consistent with other parts of codebase)
- Added logging for discovered extensions and errors (following HookManager pattern)
- Graceful error handling - never throws exceptions

#### Completion Notes

✅ ExtensionManager class created in src/main/extensions/extension-manager.ts
✅ discoverExtensions() method scans both global and project directories
✅ Directory existence checking with graceful handling of missing directories
✅ TypeScript file discovery with .ts extension filtering
✅ Filename-based override logic (project extensions override global)
✅ Alphabetical ordering by filename using localeCompare
✅ Error handling with try-catch blocks and logging
✅ Comprehensive unit tests (15 tests, all passing)
✅ Index.ts created for clean exports

All acceptance criteria met and validated through tests.

### Project Structure Notes

This story implements the extension discovery mechanism that scans both global and project extension directories for TypeScript files. The discovery process handles missing directories gracefully and implements filename-based overrides where project extensions take precedence over global extensions with the same filename.

### Project Structure Notes

**File Location:** `src/main/extensions/extension-manager.ts`

**New Directory Structure:**
```
src/main/extensions/
├── index.ts (new - exports ExtensionManager)
└── extension-manager.ts (new - main implementation)
```

**Alignment with Project Structure:**
- Follows existing pattern for manager classes (HookManager, TaskManager, etc.)
- Located in main process as required for file system access
- Exports through index.ts for clean imports
- Co-located tests in `src/main/extensions/__tests__/`

**Existing Patterns to Follow:**
- HookManager's `loadHooksFromDir()` method for directory scanning
- Use `fs.access()` for directory existence checks
- Use `fs.readdir()` for file listing
- Logger pattern: `import logger from '@/logger'`
- Error handling: catch and log without throwing

### Technical Requirements

**Constants Usage (from Story 1.1):**
```typescript
import {
  AIDER_DESK_EXTENSIONS_DIR,
  AIDER_DESK_GLOBAL_EXTENSIONS_DIR
} from '@/constants';
```

**ExtensionManager API Design:**
```typescript
export class ExtensionManager {
  async discoverExtensions(): Promise<string[]> {
    // Returns array of extension file paths
    // Project extensions override global extensions
    // Results sorted alphabetically by filename
  }
}
```

**Discovery Algorithm:**
1. Check if global directory exists, skip if not
2. Check if project directory exists, skip if not
3. Read .ts files from global directory
4. Read .ts files from project directory
5. Merge with override logic (project wins)
6. Sort by filename
7. Return array of absolute file paths

**Error Handling Requirements:**
- Missing directories: return empty array (log as debug)
- Permission errors: log error, return partial results
- Invalid paths: log error, continue with other directory
- Never throw exceptions - graceful degradation

**Logging Requirements:**
- Log discovered extensions count and filenames
- Log when directories are missing (debug level)
- Log errors when they occur (error level)
- Use logger from '@/logger'

### Architecture Compliance

**Code Style (from CONVENTIONS.md):**
- Use existing imports (fs, path, logger)
- Follow existing manager class patterns
- Use arrow functions for async methods
- Use clsx for conditional classes (if UI components)
- Do not add React.FC for components
- Do not add `import React from 'react'`
- Do not add comments unless complex
- Use TypeScript enums instead of string unions (if needed)

**Type Safety:**
- All methods properly typed with return types
- Use TypeScript's fs.promises for async file operations
- No `any` types (enforced by ESLint)

**Integration Points:**
- Import constants from '@/constants' (Story 1.1)
- Use fs.promises for async operations
- Use logger from '@/logger'
- Will be used by ExtensionManager initialization (Story 1.5)
- Will be integrated with HookManager for co-existence (Epic 3)

**File System Operations:**
- Use `fs.promises.access()` for directory existence checks
- Use `fs.promises.readdir()` for file listing
- Use `path.join()` for path construction
- Use `path.resolve()` for absolute paths

### Developer Context

**Why This Approach:**
- Mirrors hook system discovery pattern (HookManager.loadHooksFromDir)
- Provides consistent experience for users
- Allows project-specific overrides (same pattern as hooks)
- Graceful handling prevents crashes from missing directories
- Alphabetical ordering provides predictable load order

**Comparison with Hook System:**
- Hooks scan for `.js` files, extensions scan for `.ts` files
- Both use fs.readdir with extension filtering
- Both handle missing directories gracefully
- Both log discovery results

**Key Differences from Hooks:**
- Extensions need filename-based override logic (project vs global)
- Extensions require alphabetical ordering for deterministic load order
- Extensions are TypeScript files (type-checked in Story 1.3)
- Hooks are JavaScript files (no type checking)

**Future Impact:**
- Story 1.3 (Type-Checking) will use discovered file paths
- Story 1.4 (Loading with jiti) will load discovered extensions
- Story 1.5 (Startup Integration) will call discovery during initialization
- Story 1.6 (Hot Reload) will call discovery on file changes

### Previous Story Intelligence

**From Story 1.1 (Extension Directories and Constants):**
- Constants `AIDER_DESK_EXTENSIONS_DIR` and `AIDER_DESK_GLOBAL_EXTENSIONS_DIR` are defined in `src/main/constants.ts`
- Both constants follow `AIDER_DESK_*_DIR` naming pattern
- Global directory uses `homedir()` from 'os' module
- Project directory is relative to project root
- Base directory is `AIDER_DESK_DIR = '.aider-desk'`

**Dev Notes from Story 1.1:**
- Extension discovery will scan both directories
- Constants follow existing hooks pattern
- Similar structure to hooks: global + project directories

**Code Pattern to Follow:**
```typescript
// From constants.ts (Story 1.1)
export const AIDER_DESK_EXTENSIONS_DIR = path.join(AIDER_DESK_DIR, 'extensions');
export const AIDER_DESK_GLOBAL_EXTENSIONS_DIR = path.join(homedir(), AIDER_DESK_DIR, 'extensions');
```

**Testing Pattern from Story 1.1:**
- Tests co-located in `__tests__/` directory
- Test file: `src/main/extensions/__tests__/extension-manager.test.ts`
- Use Vitest for testing
- Test both success and failure cases
- Test edge cases (missing directories, empty directories)

### Git Intelligence

**Recent Work (Story 1.1):**
- Added extension directory constants to `src/main/constants.ts`
- Followed existing pattern from hook system
- Tests co-located with implementation
- All tests passing (5/5)

**Code Patterns Established:**
- Directory constants use `homedir()` for global paths
- Constants grouped logically in constants.ts
- Tests in `__tests__/` directories alongside implementation
- Logging pattern: `logger.info()` / `logger.error()` / `logger.debug()`

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.2]
- Architecture context: [Source: _bmad-output/planning-artifacts/architecture.md#Extension-Installation-Discovery]
- Previous story context: [Source: _bmad-output/implementation-artifacts/1-1-extension-directories-and-constants.md]
- Extension directory constants: [Source: src/main/constants.ts]
- Hook discovery pattern: [Source: src/main/hooks/hook-manager.ts#loadHooksFromDir]
- File system utilities: [Source: src/main/utils/file-system.ts]
- Code conventions: [Source: CONVENTIONS.md]

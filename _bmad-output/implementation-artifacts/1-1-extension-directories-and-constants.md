# Story 1.1: Extension Directories and Constants

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **system developer**,
I want **to define global and project extension directories as constants**,
So that **the extension system knows where to look for extensions and can be configured consistently**.

## Acceptance Criteria

**Given** the extension system is being initialized
**When** the constants are defined in `src/main/constants.ts`
**Then** the constants include `AIDER_DESK_EXTENSIONS_DIR` pointing to `.aider-desk/extensions/` relative to project directory
**And** the constants include `AIDER_DESK_GLOBAL_EXTENSIONS_DIR` pointing to `~/.aider-desk/extensions/`
**And** the global directory path is resolved using the user's home directory
**And** constants are exported and accessible to the extension system

## Tasks / Subtasks

- [x] Add AIDER_DESK_EXTENSIONS_DIR constant (AC: #)
  - [x] Define as `.aider-desk/extensions/` path relative to project root
  - [x] Export constant for use in extension system
- [x] Add AIDER_DESK_GLOBAL_EXTENSIONS_DIR constant (AC: #)
  - [x] Define as `~/.aider-desk/extensions/` using homedir() from 'os'
  - [x] Export constant for use in extension system
- [x] Follow existing constants.ts conventions (AC: #)
  - [x] Use same naming pattern as existing directory constants
  - [x] Position constants appropriately in file
  - [x] Maintain alphabetical or logical ordering

## Dev Notes

This story establishes the foundational directory constants for the extension system. The extension system will scan both global and project-specific directories for extension files.

### Project Structure Notes

**File Location:** `src/main/constants.ts`

**Existing Patterns to Follow:**
- Global directories use `homedir()` from 'os' module (e.g., `AIDER_DESK_GLOBAL_HOOKS_DIR`)
- Project directories use relative paths (e.g., `AIDER_DESK_HOOKS_DIR`)
- Base project directory is `AIDER_DESK_DIR = '.aider-desk'`

**Placement:**
Constants should be grouped with other project directory constants (around lines 34-38 in current file).

### Technical Requirements

**Required Constants:**

```typescript
// Project-specific extension directory (relative to project root)
export const AIDER_DESK_EXTENSIONS_DIR = path.join(AIDER_DESK_DIR, 'extensions');

// Global extension directory (user home directory)
export const AIDER_DESK_GLOBAL_EXTENSIONS_DIR = path.join(homedir(), AIDER_DESK_DIR, 'extensions');
```

**Import Requirements:**
- `homedir` from 'os' (already imported in constants.ts)
- `path` module (already imported in constants.ts)

**Naming Convention:**
- Follow `AIDER_DESK_*_DIR` pattern for directory constants
- Use `GLOBAL` suffix for user home directory paths

### Architecture Compliance

**Code Style (from CONVENTIONS.md):**
- Use existing imports (do not add new imports unless necessary)
- Follow existing code structure in constants.ts
- Do not add comments (per project conventions)
- Maintain alphabetical or logical grouping of related constants

**Type Safety:**
- Constants are typed as `string` (implicit from TypeScript)
- No additional type definitions needed

**Integration Points:**
- ExtensionManager will import and use these constants
- Extension discovery will scan both directories
- Hot reload will monitor both directories

### File Structure Requirements

**Constants File:**
- Location: `src/main/constants.ts`
- Add constants near other `AIDER_DESK_*_DIR` definitions
- Maintain existing file structure and ordering

**Expected Usage Pattern (future stories):**
```typescript
import {
  AIDER_DESK_EXTENSIONS_DIR,
  AIDER_DESK_GLOBAL_EXTENSIONS_DIR
} from './constants';

// Scan project extensions
const projectExtensions = await fs.readdir(AIDER_DESK_EXTENSIONS_DIR);

// Scan global extensions
const globalExtensions = await fs.readdir(AIDER_DESK_GLOBAL_EXTENSIONS_DIR);
```

### Developer Context

**Related Constants Already Defined:**
- `AIDER_DESK_DIR = '.aider-desk'` - Base project directory
- `AIDER_DESK_HOOKS_DIR = path.join(AIDER_DESK_DIR, 'hooks')` - Similar pattern for hooks
- `AIDER_DESK_GLOBAL_HOOKS_DIR = path.join(homedir(), AIDER_DESK_DIR, 'hooks')` - Global hooks pattern

**Why This Approach:**
- Mirrors existing hook system structure (global + project directories)
- Provides consistent experience for users
- Allows project-specific overrides of global extensions
- Follows AiderDesk's established directory organization patterns

**Future Impact:**
- Story 1.2 (Extension File Discovery) will use these constants
- Story 1.5 (Extension Startup Integration) will initialize directories
- Extension hot reload will monitor these paths

### References

- Story requirements: [Source: _bmad-output/planning-artifacts/epics.md#Epic-1-Story-1.1]
- Architecture context: [Source: _bmad-output/planning-artifacts/architecture.md#Extension-Installation-Discovery]
- Existing constants pattern: [Source: src/main/constants.ts]
- Hook system pattern: [Source: src/main/constants.ts#AIDER_DESK_HOOKS_DIR]
- Code conventions: [Source: CONVENTIONS.md]

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)

### Debug Log References

### Completion Notes List

✅ Added AIDER_DESK_EXTENSIONS_DIR constant: path.join(AIDER_DESK_DIR, 'extensions')
✅ Added AIDER_DESK_GLOBAL_EXTENSIONS_DIR constant: path.join(homedir(), AIDER_DESK_DIR, 'extensions')
✅ Constants follow existing pattern from hooks system
✅ Placed extensions constants after hooks-related constants in src/main/constants.ts
✅ All tests pass (5/5)

### File List
- src/main/constants.ts (modified)
- src/main/__tests__/constants.test.ts (new)

### Change Log
- 2025-02-19: Added AIDER_DESK_EXTENSIONS_DIR and AIDER_DESK_GLOBAL_EXTENSIONS_DIR constants to src/main/constants.ts
- 2025-02-19: Created comprehensive unit tests for extension directory constants

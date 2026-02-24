# Story 2.5: Tool Registration via getTools()

Status: review

## Story

As a **system developer**,
I want **extensions to define available tools using getTools() getter method**,
So that **tools can be registered dynamically and conditionally**.

## Acceptance Criteria

1. When ExtensionManager calls `extension.getTools()`, method returns array of `ToolDefinition` objects
2. Tool names are validated to be kebab-case strings (e.g., `run-linter`, `my-custom-tool`)
3. Tool descriptions are validated to be non-empty strings
4. Tool parameters are validated to be Zod schemas
5. Tool execute functions are validated to be async functions
6. Getter allows dynamic tool registration based on runtime conditions
7. Empty array is returned if extension has no tools (extension without getTools or returns empty)
8. Tool definitions are collected and available for registration with agent system (FR1)
9. Invalid tool definitions are rejected with clear error messages (NFR9)
10. Tool validation errors are logged but do not crash AiderDesk (NFR6)

## Tasks / Subtasks

- [x] Task 1: Implement Tool Validation in ExtensionManager (AC: #2-#5, #9, #10)
  - [x] 1.1 Create `validateToolDefinition(tool: ToolDefinition)` method
  - [x] 1.2 Validate tool name is kebab-case using regex: `^[a-z][a-z0-9-]*# Story 2.5: Tool Registration via getTools()

Status: review

## Story

As a **system developer**,
I want **extensions to define available tools using getTools() getter method**,
So that **tools can be registered dynamically and conditionally**.

## Acceptance Criteria

1. When ExtensionManager calls `extension.getTools()`, method returns array of `ToolDefinition` objects
2. Tool names are validated to be kebab-case strings (e.g., `run-linter`, `my-custom-tool`)
3. Tool descriptions are validated to be non-empty strings
4. Tool parameters are validated to be Zod schemas
5. Tool execute functions are validated to be async functions
6. Getter allows dynamic tool registration based on runtime conditions
7. Empty array is returned if extension has no tools (extension without getTools or returns empty)
8. Tool definitions are collected and available for registration with agent system (FR1)
9. Invalid tool definitions are rejected with clear error messages (NFR9)
10. Tool validation errors are logged but do not crash AiderDesk (NFR6)


  - [x] 1.3 Validate description is non-empty string
  - [x] 1.4 Validate parameters is a Zod schema (instance of z.ZodType)
  - [x] 1.5 Validate execute is a function
  - [x] 1.6 Return validation result with clear error messages
  - [x] 1.7 Wrap validation in try-catch for error isolation

- [x] Task 2: Implement Tool Collection in ExtensionManager (AC: #1, #6, #7, #8)
  - [x] 2.1 Create `collectTools()` method in ExtensionManager
  - [x] 2.2 Iterate through all loaded extensions
  - [x] 2.3 Call `extension.getTools()` if method exists
  - [x] 2.4 Handle extensions without getTools() (return empty array)
  - [x] 2.5 Validate each tool definition
  - [x] 2.6 Collect valid tools, log errors for invalid tools
  - [x] 2.7 Return array of `{ extensionName, tool }` pairs for registration
  - [x] 2.8 Store collected tools in registry for later access

- [x] Task 3: Add Tool Registry Methods (AC: #8)
  - [x] 3.1 Add `registerTool(extensionName, tool)` to ExtensionRegistry
  - [x] 3.2 Add `getTools()` to ExtensionRegistry to retrieve all registered tools
  - [x] 3.3 Add `getToolsByExtension(extensionName)` to filter by extension
  - [x] 3.4 Add `clearTools()` to clear tool registry (used during reload)

- [x] Task 4: Create Unit Tests (AC: #1-#10)
  - [x] 4.1 Create `src/main/extensions/__tests__/tool-registration.test.ts`
  - [x] 4.2 Test tool name validation (kebab-case)
  - [x] 4.3 Test description validation (non-empty)
  - [x] 4.4 Test parameters validation (Zod schema)
  - [x] 4.5 Test execute function validation
  - [x] 4.6 Test extension without getTools() returns empty
  - [x] 4.7 Test extension returning empty array
  - [x] 4.8 Test invalid tools are logged but don't crash
  - [x] 4.9 Test valid tools are collected correctly
  - [x] 4.10 Test tools are stored in registry

- [x] Task 5: Integration and Type Check (AC: #8)
  - [x] 5.1 Run `npm run typecheck` to ensure no TypeScript errors
  - [x] 5.2 Run `npm run test:node` to ensure all tests pass
  - [x] 5.3 Verify no regressions in existing tests

## Dev Notes

### Architecture Context

**Extension API Structure (Class-Based with Getter Methods):**

The extension system uses class-based extensions with getter methods for dynamic tool registration:
- `getTools()` - Returns array of ToolDefinition objects
- Extensions can return different tools based on runtime conditions

**ToolDefinition Interface (from src/common/extensions/types.ts):**

```typescript
export interface ToolDefinition<T extends z.ZodType<any> = z.ZodType<any, any, any>> {
  name: string;              // Tool identifier in kebab-case
  label?: string;            // Human-readable label for UI
  description: string;       // Description for LLM understanding
  parameters: T;             // Zod schema for parameter validation
  execute: (args: z.infer<T>, signal: AbortSignal, context: ExtensionContext) => Promise<ToolResult>;
  renderCall?: (args: z.infer<T>) => string;          // Optional custom render
  renderResult?: (result: ToolResult, expanded: boolean) => string;  // Optional custom render
}
```

**Extension Interface getTools():**

```typescript
export interface Extension {
  /**
   * Return array of tools this extension provides
   * Called when extension is loaded and when tools need to be refreshed
   */
  getTools?(): ToolDefinition[];
  // ... other methods
}
```

### Current Implementation

**Location:** `src/main/extensions/extension-manager.ts`

The ExtensionManager already has:
- `initializeExtension()` - Calls onLoad with context
- `loadGlobalExtensions()` - Discovers and loads extensions
- `reloadExtension()` - Hot reload support
- Extension lifecycle management

**What's Missing:**
- Tool collection from extensions via `getTools()`
- Tool validation logic
- Tool storage in registry

### Key Implementation Details

**Tool Name Validation (kebab-case):**

```typescript
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

function isValidToolName(name: string): boolean {
  return KEBAB_CASE_REGEX.test(name);
}

// Valid: 'run-linter', 'my-custom-tool', 'generate-report'
// Invalid: 'RunLinter', 'run_linter', 'runLinter', '1-tool', ''
```

**Zod Schema Validation:**

```typescript
import { z } from 'zod';

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}
```

**Tool Collection Flow:**

```
ExtensionManager.init()
        ↓
loadGlobalExtensions() → Initialize all extensions
        ↓
collectTools() → For each initialized extension
        ↓
extension.getTools() → Returns ToolDefinition[]
        ↓
validateToolDefinition() → Validate each tool
        ↓
registry.registerTool() → Store valid tools
        ↓
Tools available for agent registration
```

**Error Handling Pattern:**

```typescript
// Invalid tools don't crash AiderDesk (NFR6)
for (const tool of tools) {
  try {
    const validation = validateToolDefinition(tool);
    if (!validation.isValid) {
      logger.error(`[Extensions] Invalid tool '${tool.name}': ${validation.errors.join(', ')}`);
      continue;
    }
    this.registry.registerTool(extensionName, tool);
  } catch (error) {
    logger.error(`[Extensions] Failed to process tool:`, error);
  }
}
```

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/main/extensions/extension-manager.ts` | Add `collectTools()`, `validateToolDefinition()`, `getTools()` |
| `src/main/extensions/extension-registry.ts` | Add tool storage methods |

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/main/extensions/__tests__/tool-registration.test.ts` | Unit tests for tool validation and collection |

**Files to Reference:**

| File | What to Reference |
|------|-------------------|
| `src/common/extensions/types.ts` | ToolDefinition interface, Extension interface |
| `src/main/extensions/__tests__/tool-definition.test.ts` | Existing test patterns for tools |
| `src/main/extensions/__tests__/extension-lifecycle.test.ts` | Test patterns for ExtensionManager |

### Test File Structure

**Location:** `src/main/extensions/__tests__/tool-registration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionManager } from '../extension-manager';
import type { ToolDefinition, Extension } from '@common/extensions';
import { z } from 'zod';

describe('Tool Registration', () => {
  describe('validateToolDefinition', () => {
    it('should validate kebab-case tool name', () => {
      // Test valid names: 'run-linter', 'my-tool'
      // Test invalid names: 'RunLinter', 'run_linter'
    });

    it('should validate non-empty description', () => {
      // Test valid: 'Runs the linter'
      // Test invalid: '', '   '
    });

    it('should validate Zod schema parameters', () => {
      // Test valid: z.object({ input: z.string() })
      // Test invalid: {}, null
    });

    it('should validate execute function', () => {
      // Test valid: async () => {}
      // Test invalid: 'not-a-function'
    });
  });

  describe('collectTools', () => {
    it('should return empty array for extension without getTools', () => {
      // Extension without getTools method
    });

    it('should return empty array for extension returning empty', () => {
      // Extension with getTools returning []
    });

    it('should collect valid tools from extension', () => {
      // Extension with valid tools
    });

    it('should log errors for invalid tools but continue', () => {
      // Extension with mix of valid/invalid tools
    });
  });

  describe('ExtensionRegistry tool methods', () => {
    it('should register and retrieve tools', () => {});
    it('should filter tools by extension name', () => {});
    it('should clear all tools', () => {});
  });
});
```

### Integration Notes

**Dependencies on Previous Stories:**
- Story 2.1: Extension interface with `getTools()` method
- Story 2.2: ExtensionContext implementation (passed to execute)
- Story 2.3: ToolDefinition interface with Zod schemas
- Story 2.4: Extension lifecycle (onLoad/onUnload)
- Story 1.4: Extension loading with jiti
- Story 1.5: Extension startup integration

**Future Stories:**
- Story 2.6: Tool Integration with Agent System - Will use `getTools()` to register tools with Agent's ToolSet

**Key Point:** This story focuses on **validation and collection** of tools. The actual registration with the Agent system happens in Story 2.6.

### Common LLM Mistakes to Prevent

1. **Don't implement Agent ToolSet integration** - That's Story 2.6. This story only validates and collects tools.

2. **Don't call tools from this story** - Tool execution happens during agent conversations, not during collection.

3. **Don't modify ToolDefinition interface** - The interface is already defined in types.ts from Story 2.3.

4. **Validate ALL tool properties** - Name, description, parameters, and execute function must all be validated.

5. **Use existing patterns** - Follow the test patterns from `tool-definition.test.ts` and `extension-lifecycle.test.ts`.

6. **Don't crash on invalid tools** - Log errors and continue (NFR6, NFR10).

7. **Don't forget to handle extensions without getTools** - Return empty array, not an error.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Tool Registration API Design]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: src/common/extensions/types.ts - ToolDefinition interface]
- [Source: src/common/extensions/types.ts - Extension interface getTools()]
- [Source: src/main/extensions/extension-manager.ts - Extension management]
- [Source: src/main/extensions/extension-registry.ts - Extension registry]
- [Source: _bmad-output/implementation-artifacts/2-4-extension-class-lifecycle.md - Lifecycle patterns]

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claude-3-5-sonnet)

### Debug Log References

N/A - No blocking issues encountered during implementation

### Completion Notes List

- ✅ Implemented `validateToolDefinition()` method in ExtensionManager with comprehensive validation for:
  - Tool name (kebab-case format: `^[a-z][a-z0-9]*(-[a-z0-9]+)*# Story 2.5: Tool Registration via getTools()

Status: review

## Story

As a **system developer**,
I want **extensions to define available tools using getTools() getter method**,
So that **tools can be registered dynamically and conditionally**.

## Acceptance Criteria

1. When ExtensionManager calls `extension.getTools()`, method returns array of `ToolDefinition` objects
2. Tool names are validated to be kebab-case strings (e.g., `run-linter`, `my-custom-tool`)
3. Tool descriptions are validated to be non-empty strings
4. Tool parameters are validated to be Zod schemas
5. Tool execute functions are validated to be async functions
6. Getter allows dynamic tool registration based on runtime conditions
7. Empty array is returned if extension has no tools (extension without getTools or returns empty)
8. Tool definitions are collected and available for registration with agent system (FR1)
9. Invalid tool definitions are rejected with clear error messages (NFR9)
10. Tool validation errors are logged but do not crash AiderDesk (NFR6)

## Tasks / Subtasks

- [x] Task 1: Implement Tool Validation in ExtensionManager (AC: #2-#5, #9, #10)
  - [x] 1.1 Create `validateToolDefinition(tool: ToolDefinition)` method
  - [x] 1.2 Validate tool name is kebab-case using regex: `^[a-z][a-z0-9-]*# Story 2.5: Tool Registration via getTools()

Status: review

## Story

As a **system developer**,
I want **extensions to define available tools using getTools() getter method**,
So that **tools can be registered dynamically and conditionally**.

## Acceptance Criteria

1. When ExtensionManager calls `extension.getTools()`, method returns array of `ToolDefinition` objects
2. Tool names are validated to be kebab-case strings (e.g., `run-linter`, `my-custom-tool`)
3. Tool descriptions are validated to be non-empty strings
4. Tool parameters are validated to be Zod schemas
5. Tool execute functions are validated to be async functions
6. Getter allows dynamic tool registration based on runtime conditions
7. Empty array is returned if extension has no tools (extension without getTools or returns empty)
8. Tool definitions are collected and available for registration with agent system (FR1)
9. Invalid tool definitions are rejected with clear error messages (NFR9)
10. Tool validation errors are logged but do not crash AiderDesk (NFR6)


  - [x] 1.3 Validate description is non-empty string
  - [x] 1.4 Validate parameters is a Zod schema (instance of z.ZodType)
  - [x] 1.5 Validate execute is a function
  - [x] 1.6 Return validation result with clear error messages
  - [x] 1.7 Wrap validation in try-catch for error isolation

- [x] Task 2: Implement Tool Collection in ExtensionManager (AC: #1, #6, #7, #8)
  - [x] 2.1 Create `collectTools()` method in ExtensionManager
  - [x] 2.2 Iterate through all loaded extensions
  - [x] 2.3 Call `extension.getTools()` if method exists
  - [x] 2.4 Handle extensions without getTools() (return empty array)
  - [x] 2.5 Validate each tool definition
  - [x] 2.6 Collect valid tools, log errors for invalid tools
  - [x] 2.7 Return array of `{ extensionName, tool }` pairs for registration
  - [x] 2.8 Store collected tools in registry for later access

- [x] Task 3: Add Tool Registry Methods (AC: #8)
  - [x] 3.1 Add `registerTool(extensionName, tool)` to ExtensionRegistry
  - [x] 3.2 Add `getTools()` to ExtensionRegistry to retrieve all registered tools
  - [x] 3.3 Add `getToolsByExtension(extensionName)` to filter by extension
  - [x] 3.4 Add `clearTools()` to clear tool registry (used during reload)

- [x] Task 4: Create Unit Tests (AC: #1-#10)
  - [x] 4.1 Create `src/main/extensions/__tests__/tool-registration.test.ts`
  - [x] 4.2 Test tool name validation (kebab-case)
  - [x] 4.3 Test description validation (non-empty)
  - [x] 4.4 Test parameters validation (Zod schema)
  - [x] 4.5 Test execute function validation
  - [x] 4.6 Test extension without getTools() returns empty
  - [x] 4.7 Test extension returning empty array
  - [x] 4.8 Test invalid tools are logged but don't crash
  - [x] 4.9 Test valid tools are collected correctly
  - [x] 4.10 Test tools are stored in registry

- [x] Task 5: Integration and Type Check (AC: #8)
  - [x] 5.1 Run `npm run typecheck` to ensure no TypeScript errors
  - [x] 5.2 Run `npm run test:node` to ensure all tests pass
  - [x] 5.3 Verify no regressions in existing tests

## Dev Notes

### Architecture Context

**Extension API Structure (Class-Based with Getter Methods):**

The extension system uses class-based extensions with getter methods for dynamic tool registration:
- `getTools()` - Returns array of ToolDefinition objects
- Extensions can return different tools based on runtime conditions

**ToolDefinition Interface (from src/common/extensions/types.ts):**

```typescript
export interface ToolDefinition<T extends z.ZodType<any> = z.ZodType<any, any, any>> {
  name: string;              // Tool identifier in kebab-case
  label?: string;            // Human-readable label for UI
  description: string;       // Description for LLM understanding
  parameters: T;             // Zod schema for parameter validation
  execute: (args: z.infer<T>, signal: AbortSignal, context: ExtensionContext) => Promise<ToolResult>;
  renderCall?: (args: z.infer<T>) => string;          // Optional custom render
  renderResult?: (result: ToolResult, expanded: boolean) => string;  // Optional custom render
}
```

**Extension Interface getTools():**

```typescript
export interface Extension {
  /**
   * Return array of tools this extension provides
   * Called when extension is loaded and when tools need to be refreshed
   */
  getTools?(): ToolDefinition[];
  // ... other methods
}
```

### Current Implementation

**Location:** `src/main/extensions/extension-manager.ts`

The ExtensionManager already has:
- `initializeExtension()` - Calls onLoad with context
- `loadGlobalExtensions()` - Discovers and loads extensions
- `reloadExtension()` - Hot reload support
- Extension lifecycle management

**What's Missing:**
- Tool collection from extensions via `getTools()`
- Tool validation logic
- Tool storage in registry

### Key Implementation Details

**Tool Name Validation (kebab-case):**

```typescript
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

function isValidToolName(name: string): boolean {
  return KEBAB_CASE_REGEX.test(name);
}

// Valid: 'run-linter', 'my-custom-tool', 'generate-report'
// Invalid: 'RunLinter', 'run_linter', 'runLinter', '1-tool', ''
```

**Zod Schema Validation:**

```typescript
import { z } from 'zod';

function isZodSchema(value: unknown): value is z.ZodType {
  return value instanceof z.ZodType;
}
```

**Tool Collection Flow:**

```
ExtensionManager.init()
        ↓
loadGlobalExtensions() → Initialize all extensions
        ↓
collectTools() → For each initialized extension
        ↓
extension.getTools() → Returns ToolDefinition[]
        ↓
validateToolDefinition() → Validate each tool
        ↓
registry.registerTool() → Store valid tools
        ↓
Tools available for agent registration
```

**Error Handling Pattern:**

```typescript
// Invalid tools don't crash AiderDesk (NFR6)
for (const tool of tools) {
  try {
    const validation = validateToolDefinition(tool);
    if (!validation.isValid) {
      logger.error(`[Extensions] Invalid tool '${tool.name}': ${validation.errors.join(', ')}`);
      continue;
    }
    this.registry.registerTool(extensionName, tool);
  } catch (error) {
    logger.error(`[Extensions] Failed to process tool:`, error);
  }
}
```

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `src/main/extensions/extension-manager.ts` | Add `collectTools()`, `validateToolDefinition()`, `getTools()` |
| `src/main/extensions/extension-registry.ts` | Add tool storage methods |

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/main/extensions/__tests__/tool-registration.test.ts` | Unit tests for tool validation and collection |

**Files to Reference:**

| File | What to Reference |
|------|-------------------|
| `src/common/extensions/types.ts` | ToolDefinition interface, Extension interface |
| `src/main/extensions/__tests__/tool-definition.test.ts` | Existing test patterns for tools |
| `src/main/extensions/__tests__/extension-lifecycle.test.ts` | Test patterns for ExtensionManager |

### Test File Structure

**Location:** `src/main/extensions/__tests__/tool-registration.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionManager } from '../extension-manager';
import type { ToolDefinition, Extension } from '@common/extensions';
import { z } from 'zod';

describe('Tool Registration', () => {
  describe('validateToolDefinition', () => {
    it('should validate kebab-case tool name', () => {
      // Test valid names: 'run-linter', 'my-tool'
      // Test invalid names: 'RunLinter', 'run_linter'
    });

    it('should validate non-empty description', () => {
      // Test valid: 'Runs the linter'
      // Test invalid: '', '   '
    });

    it('should validate Zod schema parameters', () => {
      // Test valid: z.object({ input: z.string() })
      // Test invalid: {}, null
    });

    it('should validate execute function', () => {
      // Test valid: async () => {}
      // Test invalid: 'not-a-function'
    });
  });

  describe('collectTools', () => {
    it('should return empty array for extension without getTools', () => {
      // Extension without getTools method
    });

    it('should return empty array for extension returning empty', () => {
      // Extension with getTools returning []
    });

    it('should collect valid tools from extension', () => {
      // Extension with valid tools
    });

    it('should log errors for invalid tools but continue', () => {
      // Extension with mix of valid/invalid tools
    });
  });

  describe('ExtensionRegistry tool methods', () => {
    it('should register and retrieve tools', () => {});
    it('should filter tools by extension name', () => {});
    it('should clear all tools', () => {});
  });
});
```

### Integration Notes

**Dependencies on Previous Stories:**
- Story 2.1: Extension interface with `getTools()` method
- Story 2.2: ExtensionContext implementation (passed to execute)
- Story 2.3: ToolDefinition interface with Zod schemas
- Story 2.4: Extension lifecycle (onLoad/onUnload)
- Story 1.4: Extension loading with jiti
- Story 1.5: Extension startup integration

**Future Stories:**
- Story 2.6: Tool Integration with Agent System - Will use `getTools()` to register tools with Agent's ToolSet

**Key Point:** This story focuses on **validation and collection** of tools. The actual registration with the Agent system happens in Story 2.6.

### Common LLM Mistakes to Prevent

1. **Don't implement Agent ToolSet integration** - That's Story 2.6. This story only validates and collects tools.

2. **Don't call tools from this story** - Tool execution happens during agent conversations, not during collection.

3. **Don't modify ToolDefinition interface** - The interface is already defined in types.ts from Story 2.3.

4. **Validate ALL tool properties** - Name, description, parameters, and execute function must all be validated.

5. **Use existing patterns** - Follow the test patterns from `tool-definition.test.ts` and `extension-lifecycle.test.ts`.

6. **Don't crash on invalid tools** - Log errors and continue (NFR6, NFR10).

7. **Don't forget to handle extensions without getTools** - Return empty array, not an error.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Tool Registration API Design]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5]
- [Source: src/common/extensions/types.ts - ToolDefinition interface]
- [Source: src/common/extensions/types.ts - Extension interface getTools()]
- [Source: src/main/extensions/extension-manager.ts - Extension management]
- [Source: src/main/extensions/extension-registry.ts - Extension registry]
- [Source: _bmad-output/implementation-artifacts/2-4-extension-class-lifecycle.md - Lifecycle patterns]

)
  - Description (non-empty string)
  - Parameters (Zod schema instance)
  - Execute (function type)
- ✅ Implemented `collectTools()` method in ExtensionManager:
  - Iterates through all loaded extensions
  - Calls `getTools()` if method exists
  - Validates each tool definition
  - Logs errors for invalid tools without crashing
  - Stores valid tools in registry
- ✅ Added tool registry methods to ExtensionRegistry:
  - `registerTool(extensionName, tool)` - Register a tool
  - `getTools()` - Get all registered tools
  - `getToolsByExtension(extensionName)` - Filter by extension
  - `clearTools()` - Clear all tools (used during reload)
- ✅ Updated `init()`, `reloadExtension()`, and `reloadProjectExtensions()` to collect tools after initialization
- ✅ Created 28 comprehensive unit tests covering all validation and collection scenarios
- ✅ All 573 node tests pass with no regressions
- ✅ TypeScript compilation passes with no errors

### File List

**Modified:**
- `src/main/extensions/extension-manager.ts` - Added tool validation and collection methods
- `src/main/extensions/extension-registry.ts` - Added tool registry methods
- `src/main/extensions/__tests__/extension-manager.test.ts` - Added mock methods for new registry methods

**Created:**
- `src/main/extensions/__tests__/tool-registration.test.ts` - 28 unit tests for tool validation and collection

### Change Log

| Date | Change Description |
|------|---------------------|
| 2026-02-21 | Implemented tool registration via getTools() - validation, collection, and registry methods |

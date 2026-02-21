# Story 2.3: Tool Definition Interface

Status: review

## Story

As a **system developer**,
I want **to verify and test the ToolDefinition interface with Zod schema support**,
So that **extensions can register type-safe tools with validated parameters**.

## Acceptance Criteria

1. `ToolDefinition` interface is defined in `src/common/extensions/types.ts` ✅ (completed in Story 2.1)
2. Interface includes `name: string` for tool identifier (kebab-case) ✅
3. Interface includes `label?: string` for human-readable display name ✅
4. Interface includes `description: string` for LLM understanding ✅
5. Interface includes `parameters: z.ZodType<any>` for Zod schema validation ✅
6. Interface includes `execute: (args, signal, context) => Promise<ToolResult>` for tool execution ✅
7. `ToolResult` interface is defined with `content: Array<{type, text/source} | {type, source}>` field ✅
8. `ToolResult` includes optional `details?: Record<string, unknown>` for metadata ✅
9. `ToolResult` includes optional `isError?: boolean` for error marking ✅
10. Zod schema types are inferred from parameters field for full type safety (FR31) ✅
11. Basic unit tests verify ToolDefinition and ToolResult interfaces work correctly
12. Tool types are properly exported from `src/common/extensions/index.ts`

## Tasks / Subtasks

- [x] Task 1: Define ToolDefinition Interface (AC: #1-#10) - **Completed in Story 2.1**
  - [x] 1.1 Create `ToolDefinition<T>` generic interface with Zod schema support
  - [x] 1.2 Add `name: string` field with kebab-case requirement
  - [x] 1.3 Add `label?: string` field for human-readable display
  - [x] 1.4 Add `description: string` field for LLM understanding
  - [x] 1.5 Add `parameters: T` field with Zod schema type
  - [x] 1.6 Add `execute` function with type-safe args from Zod inference
  - [x] 1.7 Add optional `renderCall` and `renderResult` methods
  - [x] 1.8 Define `ToolResult` interface with content array
  - [x] 1.9 Add `details` and `isError` optional fields to ToolResult
  - [x] 1.10 Ensure Zod type inference works correctly

- [x] Task 2: Write Basic Tests (AC: #11)
  - [x] 2.1 Create `src/main/extensions/__tests__/tool-definition.test.ts`
  - [x] 2.2 Test ToolDefinition type inference with Zod schema
  - [x] 2.3 Test ToolResult interface with text content
  - [x] 2.4 Test ToolResult interface with image content
  - [x] 2.5 Test ToolResult with details and isError fields

- [x] Task 3: Verify Exports (AC: #12)
  - [x] 3.1 Verify `ToolDefinition` is exported from `src/common/extensions/index.ts`
  - [x] 3.2 Verify `ToolResult` is exported from `src/common/extensions/index.ts`
  - [x] 3.3 Run typecheck to ensure no TypeScript errors

## Dev Notes

### Architecture Context

**Previous Stories Completed:**

**Story 2.1 (Extension Type Definitions):**
- Complete TypeScript interfaces defined in `src/common/extensions/types.ts`
- `Extension` interface includes `getTools?(): ToolDefinition[]`
- `ToolDefinition<T>` generic interface with Zod schema support
- `ToolResult` interface with content array, details, isError
- Full type inference from Zod schemas to execute function args
- Types exported from `src/common/extensions/index.ts`

**Story 2.2 (ExtensionContext Implementation):**
- ExtensionContextImpl fully implemented with all dependencies
- State management via DataManager
- Settings access via Store
- Task creation via Project
- Agent profiles and model configs accessible
- Ready for tool execution context

### Current ToolDefinition Implementation

**Location:** `src/common/extensions/types.ts`

```typescript
export interface ToolDefinition<T extends z.ZodType<any> = z.ZodType<any, any, any>> {
  /** Tool identifier in kebab-case (e.g., 'run-linter') */
  name: string;
  /** Human-readable label for UI display */
  label?: string;
  /** Description for LLM to understand tool purpose */
  description: string;
  /** Zod schema for parameter validation */
  parameters: T;
  /** Execute function with type-safe args */
  execute: (args: z.infer<T>, signal: AbortSignal, context: ExtensionContext) => Promise<ToolResult>;
  /** Optional: Custom render for tool call in UI */
  renderCall?: (args: z.infer<T>) => string;
  /** Optional: Custom render for tool result in UI */
  renderResult?: (result: ToolResult, expanded: boolean) => string;
}

export interface ToolResult {
  /** Content array with text or image data */
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: unknown }>;
  /** Additional metadata for extensions */
  details?: Record<string, unknown>;
  /** Mark result as error */
  isError?: boolean;
}
```

**Key Features:**
- Generic type parameter `T` extends `z.ZodType<any>` for Zod schema
- Type inference via `z.infer<T>` provides type-safe args to execute function
- AbortSignal for cancellation support
- ExtensionContext access in execute function
- Optional custom rendering for tool calls and results
- Support for text and image content in results
- Optional metadata via `details` field
- Error marking via `isError` field

### Test File Structure

**Location:** `src/main/extensions/__tests__/tool-definition.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { ToolDefinition, ToolResult } from '@common/extensions/types';

describe('ToolDefinition', () => {
  it('should infer types from Zod schema', () => {
    // This is primarily a type check - if it compiles, the types work
    const tool: ToolDefinition = {
      name: 'test-tool',
      description: 'A test tool',
      parameters: z.object({
        input: z.string(),
        count: z.number().optional(),
      }),
      async execute(args, signal, context) {
        // args.input should be string
        // args.count should be number | undefined
        return { content: [{ type: 'text', text: args.input }] };
      },
    };

    expect(tool.name).toBe('test-tool');
    expect(tool.description).toBe('A test tool');
  });

  it('should support optional label and render functions', () => {
    const tool: ToolDefinition = {
      name: 'search',
      label: 'Search Files',
      description: 'Search for files',
      parameters: z.object({ pattern: z.string() }),
      async execute(args) {
        return { content: [{ type: 'text', text: args.pattern }] };
      },
      renderCall(args) {
        return `Search: ${args.pattern}`;
      },
      renderResult(result) {
        return result.isError ? 'Error' : 'Success';
      },
    };

    expect(tool.label).toBe('Search Files');
    expect(tool.renderCall).toBeDefined();
    expect(tool.renderResult).toBeDefined();
  });
});

describe('ToolResult', () => {
  it('should support text content', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Hello world' }],
    };

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
  });

  it('should support image content', () => {
    const result: ToolResult = {
      content: [{ type: 'image', source: { url: 'https://example.com/image.png' } }],
    };

    expect(result.content[0].type).toBe('image');
  });

  it('should support details and isError fields', () => {
    const result: ToolResult = {
      content: [{ type: 'text', text: 'Error occurred' }],
      details: { code: 'ERR_001', reason: 'Invalid input' },
      isError: true,
    };

    expect(result.isError).toBe(true);
    expect(result.details).toEqual({ code: 'ERR_001', reason: 'Invalid input' });
  });
});
```

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/main/extensions/__tests__/tool-definition.test.ts` | Basic unit tests for ToolDefinition and ToolResult |

**Files to Verify:**

| File | What to Check |
|------|---------------|
| `src/common/extensions/types.ts` | ToolDefinition and ToolResult interfaces exist |
| `src/common/extensions/index.ts` | Both types are exported |

### Integration Notes

This story is primarily about **verifying and testing** the already-implemented ToolDefinition interface:

1. **Type Safety:** The interface already exists from Story 2.1, we just need to verify it works
2. **Basic Tests:** Add a few tests to ensure type inference and structure work correctly
3. **Export Verification:** Ensure types are properly exported for extension developers

**Future Stories:**
- Story 2.4 (Extension Class Lifecycle) - Extensions use `getTools()` to return tools
- Story 2.5 (Tool Registration via getTools) - ExtensionManager collects tools from extensions
- Story 2.6 (Tool Integration with Agent System) - Tools are registered with Agent's ToolSet

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Tool Registration API Design]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3]
- [Source: src/common/extensions/types.ts - ToolDefinition interface]
- [Source: _bmad-output/implementation-artifacts/2-1-extension-type-definitions.md - Type definitions]

## Dev Agent Record

### Agent Model Used

Claude 3.5 Sonnet (claude-3-5-sonnet)

### Debug Log References

N/A

### Completion Notes List

- **Task 2 Complete**: Created `src/main/extensions/__tests__/tool-definition.test.ts` with 11 comprehensive tests covering:
  - ToolDefinition type inference with Zod schemas
  - Optional label and render functions
  - Type-safe args from Zod inference
  - Complex nested Zod schemas
  - ToolResult with text content
  - ToolResult with image content
  - ToolResult with mixed content types
  - ToolResult details field for metadata
  - ToolResult isError field for error marking
  - Combined details and isError fields
  - Empty content array support

- **Task 3 Complete**: Verified exports from `src/common/extensions/index.ts`:
  - `ToolDefinition` is exported via `export type { ToolDefinition, ToolResult } from './types';`
  - `ToolResult` is exported via the same export statement
  - TypeScript compilation passes with no errors

- All 703 tests pass (525 node + 178 web) - no regressions introduced

### File List

| File | Action | Description |
|------|--------|-------------|
| `src/main/extensions/__tests__/tool-definition.test.ts` | Created | Unit tests for ToolDefinition and ToolResult interfaces |

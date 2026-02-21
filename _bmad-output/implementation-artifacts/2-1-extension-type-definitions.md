# Story 2.1: Extension Type Definitions

Status: done

## Story

As a **system developer**,
I want **to define complete TypeScript interfaces for the Extension API**,
So that **extension creators have full type safety and IntelliSense support**.

## Acceptance Criteria

1. Extension interface is exported with `onLoad()`, `onUnload()`, `getTools()`, `getUIElements()`, and event handler methods
2. ExtensionContext interface is exported with all API methods (log, createTask, getState, setState, etc.)
3. ExtensionMetadata interface is exported with name, version, description, author, capabilities fields
4. All types are exported from `src/common/extensions/index.ts` for easy importing
5. Types are available to both main and renderer processes via TypeScript project references
6. JSDoc comments are included for IntelliSense documentation (FR39)

## Tasks / Subtasks

- [x] Task 1: Enhance Extension Interface (AC: #1)
  - [x] 1.1 Add `getTools()` getter method to Extension interface
  - [x] 1.2 Add `getUIElements()` getter method to Extension interface
  - [x] 1.3 Add all event handler methods (onToolApproval, onToolCalled, onToolFinished, onAgentStarted, onAgentFinished, onAgentStepFinished, onAgentIterationFinished, onTaskCreated, onTaskInitialized, onTaskClosed, onFileAdded, onFileDropped, onPromptSubmitted, onPromptStarted, onPromptFinished, onResponseMessageProcessed, onHandleApproval, onSubagentStarted, onSubagentFinished, onQuestionAsked, onQuestionAnswered, onCommandExecuted, onAiderPromptStarted, onAiderPromptFinished)
  - [x] 1.4 Add JSDoc comments to all interface methods
  - [x] 1.5 Ensure all methods are optional with correct Promise return types

- [x] Task 2: Enhance ExtensionContext Interface (AC: #2)
  - [x] 2.1 Add state management methods: `getState(key)` and `setState(key, value)`
  - [x] 2.2 Add settings access methods: `getSetting(key)`, `updateSettings(updates)`
  - [x] 2.3 Add remaining task management methods (verify createTask and createSubtask have correct signatures)
  - [x] 2.4 Add JSDoc comments to all interface methods
  - [x] 2.5 Ensure all methods return Promises where appropriate

- [x] Task 3: Create Supporting Type Definitions (AC: #3)
  - [x] 3.1 Define `ToolDefinition` interface with name, label, description, parameters (Zod), execute function, renderCall, renderResult
  - [x] 3.2 Define `ToolResult` interface with content array, details, isError fields
  - [x] 3.3 Define `UIElementDefinition` interface with id, type, label, icon, tooltip, placement, onClick, etc.
  - [x] 3.4 Define `UIPlacement` enum with placement options (taskSidebar, chatToolbar, messageActions, globalToolbar)
  - [x] 3.5 Define event payload interfaces for each event type
  - [x] 3.6 Add JSDoc comments to all types

- [x] Task 4: Export Types from Index (AC: #4)
  - [x] 4.1 Create or update `src/common/extensions/index.ts`
  - [x] 4.2 Export all interfaces from types.ts
  - [x] 4.3 Ensure clean import path: `import type { Extension, ExtensionContext } from '@aider-desk/extensions'`

- [x] Task 5: Verify TypeScript Project References (AC: #5)
  - [x] 5.1 Verify `src/common` is referenced by both tsconfig.node.json and tsconfig.web.json
  - [x] 5.2 Create test file in src/main to import and use types
  - [x] 5.3 Create test file in src/renderer to import and use types
  - [x] 5.4 Run type checking on both processes: `npm run typecheck`

- [x] Task 6: Add JSDoc Documentation (AC: #6)
  - [x] 6.1 Add comprehensive JSDoc to Extension interface with examples
  - [x] 6.2 Add JSDoc to ExtensionContext interface with examples
  - [x] 6.3 Add JSDoc to ToolDefinition and UIElementDefinition
  - [x] 6.4 Add JSDoc to all event handler methods with event payload descriptions
  - [x] 6.5 Verify IntelliSense works in test extension file

## Dev Notes

### Architecture Context

**Previous Epic Completion:**
Epic 1 (Extension Installation & Discovery) has been fully implemented with:
- Extension directories and constants defined
- File discovery mechanism implemented
- Type-checking and validation using TypeScript compiler API
- Extension loading with jiti
- Startup integration with ExtensionManager
- Hot reload capability via file watcher

**Current State of Types:**
The file `src/common/extensions/types.ts` contains basic interfaces:
- `ExtensionMetadata` - name, version, description, author, capabilities
- `ExtensionContext` - log, getProjectDir, getCurrentTask, createTask, createSubtask, getAgentProfiles, getModelConfigs, showNotification, showConfirm, showInput
- `Extension` - onLoad, onUnload, onSaveState, onLoadState
- `ExtensionConstructor` - new() and metadata

**What's Missing:**
This story expands the Extension API to include:
1. **Tool Registration:** `getTools()` method returning array of ToolDefinition
2. **UI Elements:** `getUIElements()` method returning array of UIElementDefinition
3. **Event Handlers:** All 25+ event handler methods for hooks integration
4. **State Management:** `getState()` and `setState()` methods on ExtensionContext
5. **Settings Updates:** `updateSettings()` method on ExtensionContext
6. **Complete Type Definitions:** ToolDefinition, UIElementDefinition, event payloads, etc.

### Key Design Decisions from Architecture

**Extension API Structure (Class-Based with Getter Methods):**
- Getter functions (`getTools()`, `getUIElements()`) provide dynamic control
- Extensions can decide what to expose based on runtime conditions
- Better TypeScript type inference for event handlers
- Extensions maintain internal state as class properties

**Event System Design:**
- All existing hook events must be available as extension event handlers
- New events: `onAgentIterationFinished` (reasoning/thinking mode)
- Event handlers receive ExtensionContext instead of HookContext
- Events support modification via partial return values

**Type Safety Requirements:**
- Zod schemas for tool parameter validation
- Full TypeScript type definitions for entire Extension API
- Type checking of extensions on load (already implemented in Epic 1)
- IPC-aware API design maintaining type safety across Electron processes

### Critical Files to Update

**Primary File:**
- `src/common/extensions/types.ts` - Enhance with complete type definitions

**New Files:**
- `src/common/extensions/index.ts` - Create export barrel file (if not exists)

**Test Files:**
- `src/main/extensions/__tests__/types-integration.test.ts` - Verify types work in main process
- `src/renderer/src/__tests__/types-integration.test.ts` - Verify types work in renderer process

### Extension Interface Enhancement Pattern

**Current Extension Interface:**
```typescript
export interface Extension {
  onLoad?(context: ExtensionContext): void | Promise<void>;
  onUnload?(): void | Promise<void>;
  onSaveState?(context: ExtensionContext): void | Promise<void>;
  onLoadState?(context: ExtensionContext): void | Promise<void>;
}
```

**Enhanced Extension Interface:**
```typescript
export interface Extension {
  // Lifecycle methods (existing)
  onLoad?(context: ExtensionContext): void | Promise<void>;
  onUnload?(): void | Promise<void>;
  onSaveState?(context: ExtensionContext): void | Promise<void>;
  onLoadState?(context: ExtensionContext): void | Promise<void>;

  // Tool registration (NEW)
  getTools?(): ToolDefinition[];

  // UI element registration (NEW)
  getUIElements?(): UIElementDefinition[];

  // Task Events (NEW)
  onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;
  onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void | Partial<TaskInitializedEvent>>;
  onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void | Partial<TaskClosedEvent>>;

  // Agent Events (NEW)
  onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;
  onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;
  onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;
  onAgentIterationFinished?(event: AgentIterationFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentIterationFinishedEvent>>;

  // Tool Events (NEW)
  onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;
  onToolCalled?(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>>;
  onToolFinished?(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>>;

  // File Events (NEW)
  onFileAdded?(event: FileAddedEvent, context: ExtensionContext): Promise<void | Partial<FileAddedEvent>>;
  onFileDropped?(event: FileDroppedEvent, context: ExtensionContext): Promise<void | Partial<FileDroppedEvent>>;

  // Prompt Events (NEW)
  onPromptSubmitted?(event: PromptSubmittedEvent, context: ExtensionContext): Promise<void | Partial<PromptSubmittedEvent>>;
  onPromptStarted?(event: PromptStartedEvent, context: ExtensionContext): Promise<void | Partial<PromptStartedEvent>>;
  onPromptFinished?(event: PromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<PromptFinishedEvent>>;

  // Message Events (NEW)
  onResponseMessageProcessed?(event: ResponseMessageProcessedEvent, context: ExtensionContext): Promise<void | Partial<ResponseMessageProcessedEvent>>;

  // Approval Events (NEW)
  onHandleApproval?(event: HandleApprovalEvent, context: ExtensionContext): Promise<void | Partial<HandleApprovalEvent>>;

  // Subagent Events (NEW)
  onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;
  onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void | Partial<SubagentFinishedEvent>>;

  // Question Events (NEW)
  onQuestionAsked?(event: QuestionAskedEvent, context: ExtensionContext): Promise<void | Partial<QuestionAskedEvent>>;
  onQuestionAnswered?(event: QuestionAnsweredEvent, context: ExtensionContext): Promise<void | Partial<QuestionAnsweredEvent>>;

  // Command Events (NEW)
  onCommandExecuted?(event: CommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CommandExecutedEvent>>;

  // Aider Events - Legacy (NEW)
  onAiderPromptStarted?(event: AiderPromptStartedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptStartedEvent>>;
  onAiderPromptFinished?(event: AiderPromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptFinishedEvent>>;
}
```

### Tool Definition Pattern

**ToolDefinition Interface:**
```typescript
import { z } from 'zod';

export interface ToolDefinition<T extends z.ZodType<any> = z.ZodType<any>> {
  /** Tool identifier in kebab-case (e.g., 'run-linter') */
  name: string;

  /** Human-readable label for UI display */
  label?: string;

  /** Description for LLM to understand tool purpose */
  description: string;

  /** Zod schema for parameter validation */
  parameters: T;

  /** Execute function with type-safe args */
  execute: (
    args: z.infer<T>,
    signal: AbortSignal,
    context: ExtensionContext
  ) => Promise<ToolResult>;

  /** Optional: Custom render for tool call in UI */
  renderCall?: (args: z.infer<T>) => string;

  /** Optional: Custom render for tool result in UI */
  renderResult?: (result: ToolResult, expanded: boolean) => string;
}

export interface ToolResult {
  /** Content array with text or image data */
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: any }>;

  /** Additional metadata for extensions */
  details?: Record<string, unknown>;

  /** Mark result as error */
  isError?: boolean;
}
```

### UI Element Definition Pattern

**UIElementDefinition Interface:**
```typescript
export type UIElementType = 'action-button' | 'status-indicator' | 'badge';

export enum UIPlacement {
  TaskSidebar = 'task-sidebar',
  ChatToolbar = 'chat-toolbar',
  MessageActions = 'message-actions',
  GlobalToolbar = 'global-toolbar',
}

export interface UIElementDefinition {
  /** Unique element identifier in kebab-case */
  id: string;

  /** Element type (button, status indicator, etc.) */
  type: UIElementType;

  /** Display text for button or label */
  label: string;

  /** Optional icon name from react-icons library */
  icon?: string;

  /** Optional tooltip or help text */
  description?: string;

  /** Where in UI to render this element */
  placement: UIPlacement;

  /** Context type (task, project, global) */
  context?: 'task' | 'project' | 'global';

  /** Handler ID to call in extension when clicked */
  onClick: string;

  /** Optional: Conditional visibility check */
  enabled?: (context: any) => boolean;
}
```

### Event Payload Interfaces

Each event handler needs a corresponding event payload interface. Examples:

```typescript
export interface TaskCreatedEvent {
  task: TaskData;
  project: Project;
}

export interface AgentStartedEvent {
  task: TaskData;
  project: Project;
  prompt: string;
}

export interface AgentFinishedEvent {
  task: TaskData;
  project: Project;
  messages: Message[];
  toolResults: ToolResult[];
}

export interface AgentStepFinishedEvent {
  task: TaskData;
  project: Project;
  messages: Message[];
  toolResults: ToolResult[];
}

export interface AgentIterationFinishedEvent {
  task: TaskData;
  project: Project;
  iterationIndex: number;
  messages: Message[];
  reasoning?: string;
}

export interface ToolApprovalEvent {
  task: TaskData;
  project: Project;
  toolName: string;
  args: unknown;
  blocked?: boolean;
}

export interface ToolCalledEvent {
  task: TaskData;
  project: Project;
  toolName: string;
  args: unknown;
  blocked?: boolean;
}

export interface ToolFinishedEvent {
  task: TaskData;
  project: Project;
  toolName: string;
  args: unknown;
  result: ToolResult;
  modifiedResult?: ToolResult;
}

// ... (similar patterns for all other events)
```

### ExtensionContext Enhancement

**Add to ExtensionContext:**
```typescript
export interface ExtensionContext {
  // Logging (existing)
  log(message: string, type?: 'info' | 'error' | 'warn' | 'debug'): void;

  // Project context (existing)
  getProjectDir(): string;
  getCurrentTask(): TaskData | null;

  // Task management (existing - verify signatures)
  createTask(name: string, parentId?: string): Promise<string>;
  createSubtask(name: string, parentTaskId: string): Promise<string>;

  // Settings access (existing - verify signatures)
  getAgentProfiles(): Promise<AgentProfile[]>;
  getModelConfigs(): Promise<Model[]>;

  // State management (NEW)
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;

  // Settings update (NEW)
  updateSettings(updates: Partial<SettingsData>): Promise<void>;
  getSetting(key: string): Promise<unknown>;

  // UI interaction (existing - verify signatures)
  showNotification(message: string, type?: 'info' | 'warning' | 'error'): Promise<void>;
  showConfirm(message: string, confirmText?: string, cancelText?: string): Promise<boolean>;
  showInput(prompt: string, placeholder?: string, defaultValue?: string): Promise<string | undefined>;
}
```

### Project Structure Notes

**TypeScript Project References:**
The `src/common` directory must be accessible from both main and renderer processes:
- `tsconfig.node.json` references `src/common` for main process
- `tsconfig.web.json` references `src/common` for renderer process

This allows importing types like:
```typescript
// In main process (src/main/extensions/extension-manager.ts)
import type { Extension, ExtensionContext, ToolDefinition } from '../../common/extensions';

// In renderer process (src/renderer/src/extensions/ExtensionUI.tsx)
import type { UIElementDefinition, ExtensionMetadata } from '../../../common/extensions';
```

**Export Barrel Pattern:**
Create `src/common/extensions/index.ts`:
```typescript
// Type exports
export type {
  Extension,
  ExtensionContext,
  ExtensionMetadata,
  ExtensionConstructor,
  ToolDefinition,
  ToolResult,
  UIElementDefinition,
  UIElementType,
  UIPlacement,
  // ... all event payload types
} from './types';
```

### Testing Requirements

**Type Safety Tests:**
Create test files to verify types work correctly:

```typescript
// src/main/extensions/__tests__/types-integration.test.ts
import type { Extension, ExtensionContext, ToolDefinition } from '../../common/extensions';
import { z } from 'zod';

// Test that types are correctly inferred
const testTool: ToolDefinition = {
  name: 'test-tool',
  description: 'Test tool',
  parameters: z.object({
    input: z.string(),
  }),
  async execute(args, signal, context) {
    // args.input should be typed as string
    // context should have all ExtensionContext methods
    return {
      content: [{ type: 'text', text: args.input }],
    };
  },
};

// Test Extension interface
const testExtension: Extension = {
  async onLoad(context) {
    // context should have all methods
    const task = context.getCurrentTask();
    const state = await context.getState('key');
  },
  getTools() {
    return [testTool];
  },
};
```

### Dependencies and Imports

**Required Dependencies (already installed):**
- `zod` - For tool parameter schema validation
- TypeScript 5.9.3 - For type definitions

**Import Patterns:**
```typescript
// Extension file importing types
import type { Extension, ExtensionContext, ToolDefinition } from '../../common/extensions';
import { z } from 'zod';

// Main process importing types
import type { Extension, ExtensionContext } from '../common/extensions';

// Renderer process importing types
import type { UIElementDefinition } from '../../common/extensions';
```

### Common Mistakes to Avoid

1. **Don't make event handlers required:** All event handlers must be optional (`onToolApproval?`)
2. **Don't forget Promise return types:** Event handlers return `Promise<void | Partial<Event>>`
3. **Don't skip JSDoc comments:** Essential for IntelliSense support
4. **Don't create duplicate type definitions:** Use single types.ts file
5. **Don't forget to export from index.ts:** All public types must be exported
6. **Don't use `any` for event payloads:** Create specific interfaces for each event
7. **Don't forget AbortSignal in tool execute:** Tools must support cancellation

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Extension API Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Tool Registration API Design]
- [Source: _bmad-output/planning-artifacts/architecture.md#UI Element Registration API Design]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security Sandbox Boundaries]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1]
- [Source: src/common/extensions/types.ts - Current implementation]
- [Source: src/main/extensions/extension-context.ts - Context implementation]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4 (claude-sonnet-4-20250514)

### Debug Log References

No significant debugging required. Implementation was straightforward following the Dev Notes.

### Completion Notes List

- **Task 1 Complete:** Enhanced Extension interface with `getTools()`, `getUIElements()`, and all 25 event handler methods. All methods are optional with correct Promise return types. Comprehensive JSDoc comments added.

- **Task 2 Complete:** Enhanced ExtensionContext interface with:
  - `getState(key)` and `setState(key, value)` for state management
  - `getSetting(key)` and `updateSettings(updates)` for settings access
  - All existing methods verified with correct signatures
  - JSDoc comments added to all methods

- **Task 3 Complete:** Created comprehensive supporting types:
  - `ToolDefinition<T>` - Generic interface with Zod schema support
  - `ToolResult` - Content array with text/image support, error flag
  - `UIElementDefinition` - Complete interface for UI elements
  - `UIPlacement` enum - TaskSidebar, ChatToolbar, MessageActions, GlobalToolbar
  - 22 event payload interfaces (TaskCreatedEvent, AgentStartedEvent, etc.)
  - All types have JSDoc documentation

- **Task 4 Complete:** Created `src/common/extensions/index.ts` barrel file exporting all types with module-level JSDoc documentation and usage examples.

- **Task 5 Complete:** Verified TypeScript project references:
  - `tsconfig.node.json` includes `src/common/**/*`
  - `tsconfig.web.json` includes `src/common/**/*`
  - Created integration tests in both main and renderer processes
  - All type checks pass: `npm run typecheck`

- **Task 6 Complete:** Added comprehensive JSDoc documentation:
  - Extension interface with full example
  - ExtensionContext interface with examples
  - ToolDefinition with usage example
  - UIElementDefinition with usage example
  - All 25 event handler methods documented with descriptions
  - All event payload interfaces documented

- **ExtensionContextImpl Updated:** Added stub implementations for new methods (getState, setState, getSetting, updateSettings) that throw NotImplementedError - to be implemented in Epic 4.

### File List

**Modified:**
- `src/common/extensions/types.ts` - Complete rewrite with all type definitions
- `src/main/extensions/extension-context.ts` - Added stub methods for new interface members

**Created:**
- `src/common/extensions/index.ts` - Export barrel file
- `src/main/extensions/__tests__/types-integration.test.ts` - Type integration tests for main process
- `src/renderer/src/__tests__/types-integration.test.ts` - Type integration tests for renderer process

## Change Log

- **2026-02-21:** Code review fixes applied:
  - Removed console.log statements from test files, replaced with proper void expressions
- **2026-02-21:** Story 2.1 implemented - Complete TypeScript type definitions for Extension API
  - Added all 25 event handler methods to Extension interface
  - Added state management and settings methods to ExtensionContext
  - Created ToolDefinition, ToolResult, UIElementDefinition, UIPlacement types
  - Created 22 event payload interfaces
  - Created export barrel file for clean imports
  - Added comprehensive JSDoc documentation
  - Verified types work in both main and renderer processes

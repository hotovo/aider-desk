---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-02-18'
inputDocuments:
  - product-brief-aider-desk-2026-01-14.md
  - prd.md
workflowType: 'architecture'
project_name: 'aider-desk'
user_name: 'Wladimiiir'
date: '2026-02-18'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The Extension System comprises 50 functional requirements across 6 major categories:

1. **Extension Development (FR1-FR10):** TypeScript-based API with comprehensive capabilities including tool registration (`registerTool()`), event subscription (all existing hook events + new `agentRunFinished`, `agentIterationFinished` events), UI elements (action buttons, dialogs), task/subtask creation APIs, persistent state management across sessions, and settings access (agent profiles, model configurations). Extensions can be single-file or multi-file with imports.

2. **Extension Installation & Discovery (FR11-FR15):** Extensions are auto-discovered from global (`~/.aider-desk/extensions/`) and project-specific (`.aider-desk/extensions/`) directories. Users can see loaded extensions and their status, and manually trigger reload during development.

3. **Extension Execution (FR16-FR24):** Agents can invoke custom tools registered by extensions. Extensions can modify tool results, register UI elements that integrate into appropriate contexts, create tasks/subtasks that appear in AiderDesk's task management UI, access persistent state across sessions, and read agent settings.

4. **Extension Builder Skill (FR25-FR30):** Dedicated skill for AI-assisted extension development within AiderDesk. Provides API guidance, code templates, error diagnosis, and best practices through conversational interaction.

5. **Extension API Capabilities (FR31-FR40):** Complete TypeScript API with methods for tool registration, event subscription, UI element registration, task/subtask creation, state management, settings access, and full type definitions. API runs within appropriate Electron process contexts with IPC awareness.

6. **Extension Security & Validation (FR51-FR56):** Type-check extensions on load using TypeScript compiler API, validate API usage and security boundaries, handle malformed extensions gracefully, execute in sandboxed environment without direct file system access, and validate operations against security policies.

**Non-Functional Requirements:**
10 critical NFRs covering performance and reliability:

- **Performance (NFR1-NFR5):** Extension loading must not delay startup; tool invocation must not add noticeable latency; event handlers must execute without blocking main thread; multiple extensions must run concurrently without degrading responsiveness; Extension Builder skill must provide responsive assistance.
- **Reliability (NFR6-NFR10):** AiderDesk must continue running normally when extensions encounter errors; extension errors must be logged with sufficient context without disrupting user experience; malformed/invalid extensions must be detected and reported without crashes; validation failures must provide clear error messages; extension crashes must be isolated from other extensions and core functionality.

**Scale & Complexity:**
- Primary domain: Desktop application platform with extensibility framework
- Complexity level: Medium-high (complex multi-process architecture with security constraints and backward compatibility requirements)
- Estimated architectural components: Extension API definition, extension loader/discovery system, IPC communication layer, security sandbox, type validation system, UI integration layer, task/subtask integration, state management layer, event bus system, Extension Builder Skill integration

### Technical Constraints & Dependencies

**Architecture Focus Areas (per user guidance):**
1. **Extension API Design:** The TypeScript API passed into extension files is the core focus. Must be well-structured, type-safe, and comprehensive. Taking inspiration from pi-mono extension system while adapting for AiderDesk's desktop/React environment.
2. **Hooks System Co-existence:** Existing hook system must continue working alongside new extension system. Need to define what hooks are supported, what hooks can modify, and how both systems interact without conflicts.
3. **Pi Extension Inspiration:** Patterns from pi's system including comprehensive event system, tool registration with streaming support, custom UI components, state management with session persistence, remote execution capabilities, and command registration.

**Technical Constraints:**
- Electron multi-process architecture: Extensions must work across main/renderer/preload processes with proper IPC communication
- TypeScript compilation: Extensions must be type-checked on load using TypeScript compiler API
- Security sandboxing: No direct file system or privileged API access for extensions
- React UI framework: UI elements must integrate with AiderDesk's React-based renderer process
- Backward compatibility: Existing hook system must remain functional

**Dependencies:**
- Existing AiderDesk architecture (main/renderer/preload processes, IPC layer)
- Existing task/subtask management system
- Existing hook system for co-existence
- pi-mono extension system for design patterns (reference only)

### Cross-Cutting Concerns Identified

**Security & Sandbox Isolation:**
- Extensions must execute in sandboxed environment
- No direct file system access or privileged operations
- Type validation and security boundary enforcement on load and during execution

**Type Safety Across Process Boundaries:**
- Full TypeScript type definitions for entire Extension API
- Type checking of extensions on load
- IPC-aware API design that maintains type safety across Electron processes

**Performance Optimization:**
- Lazy loading where appropriate
- Non-blocking extension operations
- Extension loading must not delay startup
- Tool invocation must not add noticeable latency

**Error Isolation & Recovery:**
- Extension errors must not crash AiderDesk core
- Graceful handling of malformed extensions
- Clear error messages for debugging
- Isolated extension crashes

**Backward Compatibility & Migration:**
- Existing hooks must continue working
- Gradual migration path from hooks to extensions
- Co-existence strategy without conflicts

**Task System Integration:**
- Extensions can create and manage tasks/subtasks
- Seamless integration with existing task management UI
- Task lifecycle management from extension context

**Event System Design:**
- All existing hook events must be available
- New events: `agentRunFinished`, `agentIterationFinished`
- Event chaining and modification capabilities
- Event-based extension hooks (inspired by pi's event system)
## Starter Template Evaluation

### Primary Technology Domain

Desktop application platform with extensibility framework - extending existing Electron/React/TypeScript architecture with a new Extension System that adds extensibility capabilities while maintaining backward compatibility.

### Starter Options Considered

This is not a new project from scratch - AiderDesk is an established Electron desktop application with a complete architecture in place. Instead of selecting a starter template, we are building upon the existing codebase to add Extension System as a new feature.

**Existing Architecture Provides Our Foundation:**

**Language & Runtime:**
- TypeScript 5.9.3 with full type safety across main, renderer, and preload processes
- TypeScript project references (tsconfig.node.json, tsconfig.web.json, tsconfig.mcp-server.json)
- Electron 37.6.0 multi-process architecture (main, renderer, preload)
- Node.js environment in main process, Chromium/React environment in renderer

**Styling Solution:**
- Tailwind CSS 3.4.14 for utility-first styling
- Headless UI for unstyled React components
- Framer Motion 11.18.2 for animations
- Custom theme system with SCSS/CSS variables (src/renderer/src/styles/)

**Build Tooling:**
- electron-vite 4.0.1 for Electron-specific bundling with hot reload
- Vite 7.1.10 as an underlying build tool
- esbuild 0.25.9 for fast MCP server bundling
- ESLint 9.18.0 with TypeScript ESLint for linting
- Prettier 3.3.2 for code formatting

**Testing Framework:**
- Vitest 4.0.16 for unit and integration tests
- React Testing Library (@testing-library/react 16.3.1) for component tests
- Separate test configs for node, web, and MCP server processes

**Code Organization:**
- src/main/ - Electron main process (Node.js environment)
- src/renderer/ - Electron renderer process (React/Chromium environment)
- src/preload/ - Electron preload scripts (IPC bridge)
- src/common/ - Shared code between processes
- src/mcp-server/ - Standalone MCP server
- Multi-process IPC communication via typed preload layer

**Development Experience:**
- Hot module replacement (HMR) for rapid development
- Auto-reload on file changes (via chokidar watchers for hooks, skills, etc.)
- Complete TypeScript type definitions for all APIs
- DevTools for debugging

**Existing Hook System:**
- JavaScript-based hooks in `~/.aider-desk/hooks/` (global) and `.aider-desk/hooks/` (project)
- 20+ event types: task events, agent events, tool events, file events, approval events
- HookContext API providing task, project, and context manipulation capabilities
- Watcher-based auto-reload on file changes

**Existing Task System:**
- Complete task management with chat history, context files, todos, costs
- Tasks stored per project in `.aider-desk/tasks/`
- Task creation, update, deletion, export (Markdown/Image)
- Task lifecycle management

**Existing Agent System:**
- Vercel AI SDK for multi-provider LLM support
- Tool-driven agent architecture
- Autonomous planning and execution
- Subagent support for specialized tasks
- Memory system with vector search (LanceDB)

**Note:** No project initialization command needed - Extension System will be implemented as a new feature within the existing AiderDesk architecture.

### Selected Starter: Existing AiderDesk Architecture

**Rationale for Selection:**

AiderDesk is a mature, production-ready Electron desktop application with:
- Complete multi-process architecture with IPC communication
- Established patterns for project management, task management, and agent execution
- Existing hook system that provides event-based extensibility foundation
- TypeScript codebase with comprehensive type definitions
- React UI framework ready for extension integration

The Extension System will build upon this foundation by:
1. Adding a new TypeScript Extension API that extends hook capabilities
2. Providing extension loader/discovery similar to existing hook discovery
3. Co-existing with existing hooks (backward compatibility)
4. Integrating with existing task/subtask management system
5. Leveraging existing React UI components for extension UI elements

**Architectural Decisions Provided by Existing Architecture:**

**Language & Runtime:**
- TypeScript 5.9.3 with project references for multi-process type safety
- Electron multi-process architecture (main/renderer/preload)
- Full type definitions for IPC communication via preload layer

**Styling Solution:**
- Tailwind CSS 3.4.14 for consistent styling
- Headless UI components for UI element integration
- Framer Motion for animations if needed by extension UI
- Existing theme system for dark/light modes

**Build Tooling:**
- electron-vite with HMR for development
- TypeScript compiler API for extension type-checking on load
- Separate build configurations for main, renderer, and MCP server

**Testing Framework:**
- Vitest with React Testing Library for component tests
- Type checking via tsc before build
- ESLint and Prettier for code quality

**Code Organization:**
- src/main/extensions/ - Extension system implementation in main process
- src/main/extensions/types/ - TypeScript type definitions for Extension API
- src/renderer/src/extensions/ - React UI components for extension integration
- src/common/extensions/ - Shared types and utilities

**Development Experience:**
- Hot reload for extension development
- Existing watcher patterns for auto-reloading extensions
- TypeScript type checking for extension validation
- Development patterns established in existing codebase

**Existing Systems to Integrate With:**

1. **HookManager:** Co-existence strategy, event system integration
2. **Task System:** Extension APIs for creating tasks/subtasks
3. **Agent System:** Tool registration for agent invocation
4. **Project Manager:** Extension discovery from global and project directories
5. **IPC Layer:** Extension API communication across process boundaries
6. **Settings Manager:** Extension settings storage and access
7. **UI Framework:** React component integration for buttons, dialogs

**Note:** Extension System implementation begins with designing the TypeScript Extension API, loader system, and hooks co-existence strategy.
## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Extension API structure (class-based with explicit lifecycle)
- Extension loading mechanism with TypeScript compiler API
- Hooks co-existence strategy with existing HookManager
- IPC communication pattern for cross-process extension execution
- Security sandbox boundaries and permission model

**Important Decisions (Shape Architecture):**
- Tool registration pattern (getter functions for dynamic control)
- UI element registration pattern (getter functions for dynamic control)
- State management strategy for extensions
- Task/subtask creation API design
- Settings access pattern for extensions
- Error isolation and recovery pattern

**Deferred Decisions (Post-MVP):**
- Extension marketplace UI
- GUI-based extension configuration screens
- Extension signing and trust mechanisms
- npm package support for complex extensions
- Advanced UI components beyond buttons/dialogs

### Extension API Structure

**Decision: Class-Based Extension with Explicit Lifecycle and Getter Methods**

**Rationale:**
- Class-based extensions provide clear structure with `onLoad` and `onUnload` lifecycle methods
- Named event handler methods (`onToolApproval`, `onToolResult`, `onAgentStepFinished`, etc.) are more discoverable and self-documenting
- Getter functions (`getTools()`, `getUIElements()`, etc.) provide dynamic control - extensions can decide what to expose based on runtime conditions
- Better TypeScript type inference for event handlers
- Extensions can maintain internal state as class properties

**Extension API Design:**

```typescript
import type { ExtensionAPI, ExtensionContext } from '@aider-desk/extensions';

export default class MyExtension {
  // Lifecycle methods
  async onLoad(context: ExtensionContext): Promise<void> {
    // Initialize extension, access context
    context.log('Extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    // Cleanup, release resources
  }

  // Tool registration (getter for dynamic control)
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'my-custom-tool',
        description: 'A custom tool',
        parameters: { /* Zod schema */ },
        async execute(args, signal, context) {
          // Tool implementation
          return { content: [...] };
        }
      }
    ];
  }

  // UI element registration (getter for dynamic control)
  getUIElements(): UIElementDefinition[] {
    return [
      {
        type: 'action-button',
        id: 'my-action',
        label: 'My Action',
        onClick: async () => { ... }
      }
    ];
  }

  // Event handlers (explicit named methods)
  async onToolApproval(toolName: string, args: unknown, context: ExtensionContext): Promise<{ approve: boolean; modifiedArgs?: unknown }> {
    if (toolName === 'dangerous-tool') {
      // Require approval
      return { approve: false };
    }
    return { approve: true };
  }

  async onToolResult(toolName: string, args: unknown, result: unknown, context: ExtensionContext): Promise<unknown> {
    // Modify tool results before returning to agent
    return result;
  }

  async onAgentStepFinished(stepResult: unknown, context: ExtensionContext): Promise<void> {
    // React to agent step completion
  }

  async onAgentRunFinished(resultMessages: unknown[], context: ExtensionContext): Promise<void> {
    // React to agent run completion
  }

  // State management
  async onLoadState(context: ExtensionContext): Promise<void> {
    // Restore state from persistence
    const saved = await context.getState('my-key');
    this.internalState = saved;
  }

  async onSaveState(context: ExtensionContext): Promise<void> {
    // Persist state for next session
    await context.setState('my-key', this.internalState);
  }

  // Internal state
  private internalState: any = {};
}
```

**ExtensionContext API:**

```typescript
export interface ExtensionContext {
  // Logging
  log(message: string, type: 'info' | 'warning' | 'error'): void;

  // Task management
  createTask(options: CreateTaskOptions): Promise<string>;
  createSubtask(taskId: string, options: CreateSubtaskOptions): Promise<string>;

  // Settings access (read-only)
  getAgentProfiles(): AgentProfile[];
  getModelConfigs(): ModelConfig[];
  getSetting(key: string): unknown;

  // State management
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;

  // Project context
  getProjectDir(): string;
  getCurrentTask(): TaskData | null;

  // UI interaction (from extension)
  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): void;
  showConfirm(title: string, message: string): Promise<boolean>;
  showInput(title: string, placeholder: string): Promise<string | undefined>;
}
```

**Status:** PENDING - User deferred decision
**Version:** To be decided
**Affects:** Extension loader implementation, hot reload, error handling
**Affects:** All extension-related epics and stories
**Provided by Starter:** No (custom architecture decision)

### Hooks Co-existence Strategy

**Decision: Parallel Event Dispatch with Hook Manager Integration**

**Rationale:**
- Existing hooks must continue working for backward compatibility
- Extensions will subscribe to same events plus new events
- HookManager remains the central event dispatcher
- Extensions and hooks process events independently
- HookManager dispatches to both systems in sequence

**Co-existence Architecture:**

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

**Event Processing Order:**

1. **Extension handlers execute first** - New extension system gets priority
2. **Hook handlers execute next** - Existing hooks process after extensions
3. **Results are merged** - All events support modification via partial return values

**Event Modification Semantics:**

**Unified Modification Model:**
- All events support modification via partial return values
- Extensions and hooks can both modify event data
- Results chain: extension result → hook result → final merged result
- Last modifier wins for overlapping fields (hooks get final say)

**Blocking via Modification:**
- Blocking is achieved by setting `blocked: true` in return value
- Applies to: onToolApproval, onToolCalled, onPromptSubmitted, onHandleApproval, onSubagentStarted, onFileDropped
- First handler to set `blocked: true` prevents the operation
- Extensions can block, then hooks can override (hooks get final say)

**Extension-Only Events:**
- Extensions have access to new events not available to hooks:
  - `onAgentIterationFinished` (new)
  - Additional granular events for better control
- Hooks continue to work with existing event set

**Implementation Notes:**
- HookManager's `trigger()` method extended to dispatch to both hooks and extensions
- ExtensionManager maintains extension registry
- HookManager delegates to ExtensionManager for extension event dispatch
- Extension handlers receive `ExtensionContext` instead of `HookContext`

**Version:** N/A (design pattern)
**Affects:** Extension system integration with existing hook system
**Provided by Starter:** Partially (existing HookManager provides foundation)

### Extension Loading Mechanism

**Pending Decision: How to load, validate, and sandbox TypeScript extension files?**

Key considerations:
- Use TypeScript compiler API to type-check extensions on load
- Load class-based extensions from `.ts` files
- Sandbox execution environment (no direct file system or privileged API access)
- Auto-discovery from global and project directories
- Hot reload during development
- Error handling for malformed extensions

**Options:**
- **A: require() with TypeScript compilation** - Compile `.ts` to `.js` on first load, use `require()`
- **B: jiti (transpiled require)** - Use jiti for on-the-fly TypeScript transpilation (pi-mono approach)
- **C: Custom loader with eval()** - Load TypeScript, transpile with ts.transpile(), execute in sandbox

What's your preference for extension loading mechanism?
### IPC & REST API Communication Pattern

**Decision: Dual Communication Path - Electron IPC for Desktop Renderer + REST API/Socket.io for External Clients**

**Rationale:**
- Extensions execute in main process (Node.js environment) for tool registration, event handling, and state management
- Desktop renderer (React) communicates via Electron IPC bridge
- External clients (BrowserAPI, future integrations) communicate via REST API + Socket.io
- Extensions work across all AiderDesk access methods
- Leverages existing AiderDesk infrastructure (REST API, Socket.io, preload layer)

**Decision: Main Process Extension Execution with Renderer IPC Bridge**

**Rationale:**
- Extensions execute in main process (Node.js environment) for tool registration, event handling, and state management
- Renderer process (React) communicates via IPC bridge for UI element registration and user interaction
- ExtensionContext in main process provides full API access
- UI elements (buttons, dialogs) are registered via IPC and rendered in renderer
- Similar to existing AiderDesk IPC patterns (preload layer, typed communication)

**Communication Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│                   Main Process                        │
│  ┌────────────────────────────────────────────────┐  │
│  │      ExtensionManager                         │  │
│  │  - Load extensions                           │  │
│  │  - Type-check on load                        │  │
│  │  - Maintain registry                          │  │
│  │  - Dispatch events                            │  │
│  │  - UI element registry                         │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│                       ├──────────────────────────┤     │
│                       ↓                          ↓     │
│              Electron IPC                    REST API   │
│                       │                          │     │
│                       │                    Socket.io   │
│                       │                          │     │
│  ┌────────────────────────────────────────────────┐  │
│  │      Extension Instance                      │  │
│  │  - onLoad(context: ExtensionContext)      │  │
│  │  - getTools() → Tool definitions         │  │
│  │  - onToolApproval(), onToolResult()      │  │
│  │  - onAgentRunFinished()                   │  │
│  │  - State management                        │  │
│  │  - registerUIElement()                    │  │
│  └────────────────────────────────────────────────┘  │
│                       │                              │
│                       ├──────────────────────────┤     │
│                       ↓                          ↓     │
│             Desktop Renderer          External Clients     │
│          (Electron IPC)        (REST + Socket.io)   │
└─────────────────────────────────────────────────────────┘
```

**Communication Channel Types:**

**Main Process → Desktop Renderer (Electron IPC):**
- `extension:register-ui-element` - Register action buttons, dialogs
- `extension:show-notification` - Display notifications in UI
- `extension:update-ui-element` - Dynamic updates (enable/disable buttons)

**Main Process → External Clients (REST API):**
- `GET /api/extensions/ui-elements` - Get all registered UI elements
- `GET /api/extensions/ui-elements/:id` - Get specific UI element
- `POST /api/extensions/ui-elements/:id/trigger` - Trigger UI action (button click, etc.)

**Main Process → All Clients (Socket.io Real-Time Events):**
- `extension:ui-element-registered` - New UI element registered
- `extension:ui-element-updated` - UI element updated (disabled, badge, etc.)
- `extension:ui-element-updated:<id>` - Specific element updated

**External Clients → Main Process (REST API):**
- `POST /api/extensions/ui-elements/:id/trigger` - User clicked button, interacted with dialog

**External Clients → Main Process (Socket.io):**
- `extension:ui-action` - UI action triggered (alternative to REST)

**Main → Renderer (Extension → UI):**
- `extension:register-ui-element` - Register action buttons, dialogs
- `extension:show-notification` - Display notifications in UI
- `extension:update-ui-element` - Dynamic updates (enable/disable buttons)

**Renderer → Main (UI → Extension):**
- `extension:ui-action` - User clicked button, interacted with dialog
- `extension:get-ui-state` - Query UI state

**Desktop Renderer - Preload Bridge (Electron IPC):**
- `api.extensions.registerAction(options)` - Register action button
- `api.extensions.showNotification(message, type)` - Show notification
- `api.extensions.onUIAction(handler)` - Subscribe to UI events
- Typed IPC communication maintaining type safety

**ExtensionContext in Main Process:**
```typescript
export interface ExtensionContext {
  // Logging (main process)
  log(message: string, type: 'info' | 'warning' | 'error'): void;

  // Task management (via TaskManager IPC)
  createTask(options: CreateTaskOptions): Promise<string>;
  createSubtask(taskId: string, options: CreateSubtaskOptions): Promise<string>;

  // Settings access (read-only via SettingsManager)
  getAgentProfiles(): Promise<AgentProfile[]>;
  getModelConfigs(): Promise<ModelConfig[]>;
  getSetting(key: string): Promise<unknown>;

  // State management (via ExtensionManager)
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;

  // Project context
  getProjectDir(): string;
  getCurrentTask(): TaskData | null;

  // UI interaction (via IPC bridge to renderer)
  showNotification(message: string, type: 'info' | 'success' | 'warning' | 'error'): Promise<void>;
  showConfirm(title: string, message: string): Promise<boolean>;
  showInput(title: string, placeholder: string): Promise<string | undefined>;

  // UI element registration (via IPC bridge to renderer)
  registerUIElement(element: UIElementDefinition): Promise<string>;
  updateUIElement(id: string, updates: Partial<UIElementDefinition>): Promise<void>;
}
```

**Process Placement Rationale:**
- **Main process** for extensions: Access to file system (via controlled APIs), Node.js APIs, agent integration, task management
- **Renderer process** for UI: React components, user interaction, existing UI patterns
- **IPC bridge** maintains separation of concerns while enabling communication

**Version:** Electron 37.6.0 IPC patterns
**Affects:** All extension functionality, UI integration
**Provided by Starter:** Yes (existing IPC layer and preload patterns)

### Security Sandbox Boundaries

**Decision: Controlled API Access with No Direct Privileged Operations**

**Rationale:**
- Extensions must not crash AiderDesk core (NFR6-NFR10)
- No direct file system access (FR54)
- No direct access to privileged APIs (FR55)
- Validate operations against security policies (FR56)
- Graceful error handling and isolation (FR7-FR10)

**Sandboxing Strategy:**

**Allowed Operations (via ExtensionContext API):**
```typescript
// ✅ Allowed - via controlled APIs
context.createTask(...)       // TaskManager handles file operations
context.createSubtask(...)    // TaskManager handles file operations
context.getAgentProfiles()    // SettingsManager read-only access
context.getModelConfigs()     // SettingsManager read-only access
context.getSetting(key)       // SettingsManager read-only access
context.getProjectDir()       // Read-only path access
context.getCurrentTask()       // Read-only task data
context.showNotification(...)   // IPC bridge to renderer
context.showConfirm(...)       // IPC bridge to renderer
context.showInput(...)         // IPC bridge to renderer
context.log(...)              // Controlled logging
```

**Prohibited Operations (not exposed via ExtensionContext):**
```typescript
// ❌ Prohibited - direct file system access
import fs from 'fs';           // Not accessible in extension sandbox
fs.readFile(path, ...);          // Blocked
fs.writeFile(path, ...);         // Blocked
fs.unlink(path, ...);           // Blocked

// ❌ Prohibited - direct privileged APIs
import { exec } from 'child_process';  // Not accessible
import electron from 'electron';         // Not accessible

// ❌ Prohibited - direct database access
import Database from 'better-sqlite3';  // Not accessible

// ❌ Prohibited - direct IPC
import { ipcRenderer } from 'electron';  // Not accessible
import { ipcMain } from 'electron';       // Not accessible
```

**Security Layers:**

**1. Extension Loading Validation:**
```typescript
// Type-check extension before execution
const diagnostics = typeChecker.getDiagnostics(sourceFile);
if (diagnostics.length > 0) {
  throw new ExtensionValidationError(diagnostics);
}

// Validate API usage during compilation
// Ensure no prohibited imports (fs, child_process, etc.)
```

**2. Runtime Validation:**
```typescript
// Wrap extension method calls in try-catch
try {
  const result = await extension.onToolApproval(...);
} catch (error) {
  context.log(`Extension error: ${error.message}`, 'error');
  // Continue running, don't crash AiderDesk
  return defaultResult;
}

// Validate tool definitions
function validateToolDefinition(tool: ToolDefinition) {
  if (!tool.name || !tool.description) {
    throw new ValidationError('Tool must have name and description');
  }
  if (!tool.execute || typeof tool.execute !== 'function') {
    throw new ValidationError('Tool must have execute function');
  }
  // Zod schema validation for parameters
}
```

**3. Execution Isolation:**
```typescript
// Extensions run in isolated call stack
// No direct access to global AiderDesk state
// All access via ExtensionContext

class ExtensionSandbox {
  constructor(private extension: Extension, private context: ExtensionContext) {}

  async safeCall(method: string, ...args: any[]) {
    try {
      return await this.extension[method](...args, this.context);
    } catch (error) {
      this.context.log(`Extension ${this.constructor.name} error: ${error.message}`, 'error');
      return null; // Graceful failure
    }
  }
}
```

**4. Error Recovery:**
```typescript
// Extension errors are logged but don't crash core
if (extensionError) {
  logger.error('Extension execution failed:', {
    extensionId: extension.id,
    error: extensionError.message,
    stack: extensionError.stack
  });
  // AiderDesk continues running
}

// Malformed extensions are reported but don't prevent app startup
invalidExtensions.forEach(ext => {
  context.showNotification(
    `Extension ${ext.name} failed to load: ${ext.error}`,
    'error'
  );
});
```

**Permission Model:**
```typescript
// Extensions declare capabilities in metadata
export class MyExtension {
  static metadata = {
    name: 'my-extension',
    version: '1.0.0',
    capabilities: ['tools', 'ui', 'tasks', 'state']
  };

  // ExtensionManager checks capabilities before exposing APIs
  async onLoad(context: ExtensionContext) {
    if (context.capabilities.includes('tasks')) {
      // Can call createTask, createSubtask
    }
    if (context.capabilities.includes('ui')) {
      // Can call showNotification, showConfirm, etc.
    }
  }
}
```

**Version:** Electron 37.6.0 + TypeScript 5.9.3
**Affects:** Extension security, error handling, type validation
**Provided by Starter:** Partially (existing error handling patterns, new sandbox layer required)

### Tool Registration API Design

**Decision: Getter Function Returning ToolDefinition Array with Zod Schemas**

**Rationale:**
- `getTools()` getter provides dynamic control (extensions can return different tools based on runtime conditions)
- Zod schemas for parameter validation (consistent with AiderDesk's existing patterns)
- Tool definitions include name, description, parameters schema, execute function
- Inspired by pi-mono's tool registration pattern
- Full TypeScript type safety with Zod inference

**ToolDefinition Interface:**

```typescript
import { z } from 'zod';

export interface ToolDefinition {
  // Tool identity
  name: string;
  label?: string; // Human-readable label for UI
  description: string;

  // Parameters schema (Zod)
  parameters: z.ZodType<any>;

  // Execution function
  execute: (
    args: z.infer<typeof parameters>,  // Type-safe args
    signal: AbortSignal,                 // Cancellation support
    context: ExtensionContext            // Full context access
  ) => Promise<ToolResult>;

  // Optional: Custom rendering hints for UI
  renderCall?: (args: z.infer<typeof parameters>) => string;
  renderResult?: (result: ToolResult, expanded: boolean) => string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: any }>;
  details?: Record<string, unknown>; // Additional data for rendering/state
  isError?: boolean;
}
```

**Example Extension Tool:**

```typescript
import { z } from 'zod';
import type { ToolDefinition, ExtensionContext } from '@aider-desk/extensions';

export default class MyExtension {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'run-linter',
        label: 'Run Linter',
        description: 'Run ESLint on specified files and return results',
        parameters: z.object({
          files: z.array(z.string()).describe('List of files to lint'),
          fix: z.boolean().optional().describe('Auto-fix issues')
        }),
        async execute(args, signal, context) {
          // Check for cancellation
          if (signal.aborted) {
            return {
              content: [{ type: 'text', text: 'Lint cancelled' }],
              isError: true
            };
          }

          // Execute linter (via controlled API or tool call)
          const results = await this.runLint(args.files, args.fix);

          return {
            content: [{ type: 'text', text: results.summary }],
            details: { issues: results.issues } // For state management
          };
        },
        renderCall(args) {
          return `Lint ${args.files.length} file(s)`;
        },
        renderResult(result) {
          if (result.isError) return '❌ Lint failed';
          return `✓ Lint completed (${result.details?.issues.length} issues)`;
        }
      }
    ];
  }

  private async runLint(files: string[], fix: boolean): Promise<any> {
    // Implementation details
  }
}
```

**Tool Registration Flow:**

```
Extension.onLoad()
        ↓
Extension calls context.getTools() via getter
        ↓
ExtensionManager calls extension.getTools()
        ↓
Tool definitions collected
        ↓
Each tool validated:
  - Has name and description
  - Has valid Zod schema
  - Has execute function
        ↓
Tools registered with Agent's ToolSet
        ↓
Agent can invoke tools during conversation
```

**Type Safety:**
```typescript
// Args are automatically typed based on Zod schema
async execute(args: { files: string[]; fix?: boolean }, signal, context) {
  // args.files is typed as string[]
  // args.fix is typed as boolean | undefined
}

// Return type is enforced
return {
  content: [{ type: 'text', text: '...' }], // Required
  details: { ... }, // Optional
  isError: false // Optional
};
```

**Version:** Zod 4.1.11 (matches AiderDesk's existing version)
**Affects:** Extension tool registration, agent tool invocation
**Provided by Starter:** Partially (existing Zod patterns, new ToolDefinition interface required)

### UI Element Registration API Design

**Decision: Getter Function Returning UIElementDefinition Array with IPC-Based Rendering**

**Rationale:**
- `getUIElements()` getter provides dynamic control (extensions can show/hide UI elements based on state)
- UI elements rendered in renderer process via IPC bridge
- Support for action buttons, status indicators (future extensibility)
- Integrates with existing React UI patterns (Tailwind, Headless UI)
- Consistent with AiderDesk's UI component library

**UIElementDefinition Interface:**

```typescript
export type UIElementType = 'action-button' | 'status-indicator' | 'badge';

export interface UIElementDefinition {
  // Element identity
  id: string;
  type: UIElementType;

  // Display properties
  label: string;
  icon?: string; // Icon name from react-icons
  tooltip?: string;

  // Placement (where in UI to render)
  placement: 'task-sidebar' | 'chat-input' | 'header' | 'footer';

  // Initial state
  disabled?: boolean;
  visible?: boolean;
  badge?: { count: number; color: string };

  // Event handler (executed in main process via IPC)
  onClick?: () => Promise<void> | void;

  // Dynamic update support
  update?: () => Partial<UIElementDefinition>;
}
```

**Example Extension UI Elements:**

```typescript
import type { UIElementDefinition, ExtensionContext } from '@aider-desk/extensions';

export default class MyExtension {
  private issueCount = 0;

  getUIElements(): UIElementDefinition[] {
    return [
      {
        id: 'generate-jira-ticket',
        type: 'action-button',
        label: 'Generate Jira Ticket',
        icon: 'SiJira', // From react-icons/si
        tooltip: 'Create Jira ticket from current changes',
        placement: 'task-sidebar',
        disabled: this.issueCount === 0, // Dynamic state
        badge: this.issueCount > 0 ? { count: this.issueCount, color: 'red' } : undefined,
        onClick: async () => {
          await this.generateJiraTicket();
          this.issueCount = 0; // Clear badge
        },
        update: () => ({
          disabled: this.issueCount === 0,
          badge: this.issueCount > 0 ? { count: this.issueCount, color: 'red' } : undefined
        })
      },
      {
        id: 'connection-status',
        type: 'status-indicator',
        label: 'API Connected',
        placement: 'header',
        visible: this.isConnected
      }
    ];
  }

  async generateJiraTicket() {
    // Implementation
    this.issueCount++;
    // Trigger UI update via IPC
  }
}
```

**UI Registration Flow:**

```
Extension.onLoad()
        ↓
Extension calls context.getUIElements() via getter
        ↓
ExtensionManager calls extension.getUIElements()
        ↓
UI definitions collected
        ↓
Each UI element validated
        ↓
UI elements sent to renderer via IPC
        ↓
Renderer registers UI components in React tree
        ↓
User clicks button → IPC to main → Extension.onClick()
        ↓
Extension calls update() → IPC to renderer → UI updates
```

**IPC Communication for UI:**

**Main Process → Renderer:**
```typescript
// Register UI element
context.registerUIElement({
  id: 'my-button',
  type: 'action-button',
  label: 'My Action',
  placement: 'task-sidebar',
  onClick: async () => { /* ... */ }
});
// → IPC: 'extension:register-ui-element'

// Update UI element
context.updateUIElement('my-button', {
  disabled: true,
  label: 'Updated Label'
});
// → IPC: 'extension:update-ui-element'
```

**Renderer Process (React):**
```typescript
// Component that renders extension UI elements
export const ExtensionUIElements = () => {
  const [elements, setElements] = useState<UIElementDefinition[]>([]);

  useEffect(() => {
    // Listen for UI element registration
    api.extensions.onUIElementRegistered((element) => {
      setElements(prev => [...prev, element]);
    });

    // Listen for UI element updates
    api.extensions.onUIElementUpdated((update) => {
      setElements(prev => prev.map(el =>
        el.id === update.id ? { ...el, ...update } : el
      ));
    });
  }, []);

  return (
    <>
      {elements.map(el => (
        <ExtensionButton
          key={el.id}
          element={el}
          onClick={() => api.extensions.triggerUIAction(el.id)}
        />
      ))}
    </>
  );
};
```

**React Component for Action Button:**
```typescript
export const ExtensionButton = ({ element, onClick }: Props) => {
  return (
    <button
      onClick={onClick}
      disabled={element.disabled}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-md',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        'transition-colors',
        element.disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={element.tooltip}
    >
      {element.icon && <Icon name={element.icon} />}
      <span>{element.label}</span>
      {element.badge && (
        <Badge count={element.badge.count} color={element.badge.color} />
      )}
    </button>
  );
};
```

**Version:** React 19.2.0, Tailwind CSS 3.4.14
**Affects:** Extension UI integration, React components
**Provided by Starter:** Yes (existing React UI patterns, Headless UI, react-icons)

### State Management Strategy

**Decision: Extension-Level Key-Value Store with Automatic Persistence**

**Rationale:**
- Extensions need persistent state across sessions (FR7)
- State scoped per extension (no cross-extension state pollution)
- Simple key-value API (no complex ORM or database)
- Automatic persistence (no manual save/load needed)
- State available across AiderDesk restarts

**State Management API:**

```typescript
export interface ExtensionContext {
  // State operations
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;
  getState<T>(key: string): Promise<T | undefined>; // Generic version
  setState<T>(key: string, value: T): Promise<void>; // Generic version
}
```

**Storage Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│              Extension State Store                      │
│  (SQLite database: .aider-desk/extensions.db)      │
└─────────────────────────────────────────────────────────┘
                           ↓
        ┌────────────────────────────┴─────────────────────┐
        │ Extension ID (primary key)                         │
        ├────────────────────────────────────────────────────┤
        │ extension_state table:                               │
        │ - extension_id (PK)                                 │
        │ - key                                                 │
        │ - value (JSON)                                        │
        │ - updated_at                                          │
        └────────────────────────────────────────────────────┘
                           ↓
        Extension state isolated per extension
```

**State Lifecycle:**

```typescript
export default class MyExtension {
  private state: ExtensionState = { count: 0, history: [] };

  async onLoad(context: ExtensionContext): Promise<void> {
    // Restore state from persistence
    const savedState = await context.getState('my-state');
    if (savedState) {
      this.state = savedState as ExtensionState;
      context.log(`Restored state: ${JSON.stringify(this.state)}`, 'info');
    }
  }

  async onSaveState(context: ExtensionContext): Promise<void> {
    // Persist state on unload or periodic save
    await context.setState('my-state', this.state);
    context.log('State saved', 'info');
  }

  async onUnload(): Promise<void> {
    // Ensure state is saved on unload
    // ExtensionManager will call onSaveState automatically
  }
}
```

**State Usage Examples:**

```typescript
// Save complex state
await context.setState('connection-pool', {
  active: true,
  connections: [...this.connections],
  lastUsed: Date.now()
});

// Retrieve and type-cast
const pool = await context.getState<ConnectionPool>('connection-pool');
if (pool?.active) {
  // Use connection
}

// Simple counter
let count = await context.getState<number>('click-count') ?? 0;
count++;
await context.setState('click-count', count);

// Remove state
await context.setState('old-key', null); // null removes the key
```

**Database Schema:**

```sql
CREATE TABLE extension_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extension_id TEXT NOT NULL,  -- Extension name or ID
  key TEXT NOT NULL,           -- State key
  value JSON NOT NULL,          -- State value (JSON encoded)
  updated_at INTEGER NOT NULL,  -- Timestamp
  UNIQUE(extension_id, key)
);

CREATE INDEX idx_extension_state_extension_id ON extension_state(extension_id);
```

**Performance Considerations:**
- State loaded once on `onLoad`
- `setState()` writes asynchronously (non-blocking)
- `getState()` reads from memory cache after initial load
- Periodic auto-save (e.g., every 30 seconds) in addition to onUnload

**Version:** better-sqlite3 12.0.0 (matches AiderDesk's existing version)
**Affects:** Extension state persistence, cross-session behavior
**Provided by Starter:** Yes (existing better-sqlite3 usage)

### Task/Subtask Creation API Design

**Decision: Async Methods Returning Task IDs with Full Context Integration**

**Rationale:**
- Extensions must be able to create tasks/subtasks (FR5-FR6)
- Tasks integrate with AiderDesk's existing task system
- Extensions specify task metadata (name, description, context files)
- Returned task ID allows extensions to reference created tasks
- Async operations (tasks may require setup time)

**Task Creation API:**

```typescript
export interface ExtensionContext {
  // Task creation
  createTask(options: CreateTaskOptions): Promise<string>;

  // Subtask creation
  createSubtask(parentTaskId: string, options: CreateSubtaskOptions): Promise<string>;
}

export interface CreateTaskOptions {
  name: string;
  description?: string;
  contextFiles?: string[]; // File paths to include in task context
  initialPrompt?: string; // Optional initial prompt
  workingMode?: 'local' | 'worktree'; // Task working mode
}

export interface CreateSubtaskOptions {
  name: string;
  description?: string;
  todoItems?: string[]; // Initial todo checklist
}
```

**Task Creation Examples:**

```typescript
export default class MyExtension {
  async onCreateTaskButton(context: ExtensionContext): Promise<void> {
    // Create a new task
    const taskId = await context.createTask({
      name: 'Implement OAuth Feature',
      description: 'Add OAuth authentication to the application',
      contextFiles: ['src/auth/oauth.ts', 'README.md'],
      workingMode: 'worktree' // Create isolated worktree
    });

    context.log(`Created task: ${taskId}`, 'info');

    // Add subtasks
    await context.createSubtask(taskId, {
      name: 'Design OAuth flow',
      todoItems: ['Research providers', 'Design redirect URIs', 'Define scopes']
    });

    await context.createSubtask(taskId, {
      name: 'Implement login handler',
      todoItems: ['Setup OAuth client', 'Implement callbacks']
    });
  }
}
```

**Task Creation Flow:**

```
Extension calls context.createTask()
        ↓
ExtensionContext validates options
        ↓
IPC call to TaskManager in main process
        ↓
TaskManager creates task:
  - Generate task ID
  - Create .aider-desk/tasks/{taskId}/
  - Save task metadata to DB
  - Add context files
  - Create worktree if requested
        ↓
Return task ID to extension
        ↓
Extension can reference task by ID
        ↓
Extension can create subtasks via context.createSubtask()
```

**Integration with Existing Task System:**

- Tasks created by extensions appear in Task UI
- Extensions can create tasks from event handlers (e.g., `onAgentRunFinished`)
- Subtasks integrate with existing todo system
- Tasks support full task lifecycle (rename, duplicate, export, delete)
- Working modes (local/worktree) supported for extension-created tasks

**Version:** Existing Task System architecture
**Affects:** Extension task management, task UI integration
**Provided by Starter:** Yes (existing task/subtask system)

### Settings Access Pattern

**Decision: Read-Only Access via ExtensionContext with Structured Data**

**Rationale:**
- Extensions need to read agent profiles and model configurations (FR8)
- Settings are read-only (extensions cannot modify AiderDesk settings)
- Structured access (typed interfaces for profiles and configs)
- Extensions can adapt behavior based on user's current settings

**Settings Access API:**

```typescript
export interface ExtensionContext {
  // Agent profiles
  getAgentProfiles(): Promise<AgentProfile[]>;
  getActiveAgentProfile(): Promise<AgentProfile | null>;

  // Model configurations
  getModelConfigs(): Promise<ModelConfig[]>;
  getActiveModel(): Promise<ModelConfig | null>;

  // General settings
  getSetting(key: string): Promise<unknown>;
}
```

**AgentProfile Interface:**

```typescript
export interface AgentProfile {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
  customInstructions?: string;
  modelId: string;
  providerId: string;
  toolApprovals?: Record<string, 'always' | 'ask' | 'never'>;
  skills?: string[]; // Enabled skills
}
```

**ModelConfig Interface:**

```typescript
export interface ModelConfig {
  id: string; // e.g., 'anthropic/claude-sonnet-4'
  name: string; // e.g., 'Claude 4 Sonnet'
  providerId: string; // e.g., 'anthropic'
  contextWindow: number;
  maxTokens: number;
  capabilities: {
    images: boolean;
    reasoning: boolean;
    streaming: boolean;
  };
}
```

**Settings Usage Examples:**

```typescript
export default class MyExtension {
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'analyze-code',
        description: 'Analyze code with specific model',
        parameters: z.object({
          code: z.string()
        }),
        async execute(args, signal, context) {
          // Get active model
          const model = await context.getActiveModel();
          const profile = await context.getActiveAgentProfile();

          context.log(
            `Running analysis with model: ${model?.name} (${profile?.name})`,
            'info'
          );

          // Adapt behavior based on model capabilities
          if (model?.capabilities.reasoning) {
            return this.runDeepAnalysis(args.code);
          } else {
            return this.runBasicAnalysis(args.code);
          }
        }
      }
    ];
  }

  async onLoad(context: ExtensionContext): Promise<void> {
    // Check if specific model is configured
    const models = await context.getModelConfigs();
    const hasClaude = models.some(m => m.id.includes('claude'));

    if (hasClaude) {
      context.log('Claude models available, enabling advanced features', 'info');
      this.advancedFeatures = true;
    }

    // Get custom instructions from profile
    const profile = await context.getActiveAgentProfile();
    if (profile?.customInstructions) {
      context.log(`Custom instructions found: ${profile.customInstructions}`, 'info');
    }
  }
}
```

**Settings Access Flow:**

```
Extension calls context.getAgentProfiles()
        ↓
ExtensionContext accesses SettingsManager via IPC
        ↓
SettingsManager reads from config/database
        ↓
Profiles returned to extension
        ↓
Extension adapts behavior based on settings
```

**Security Considerations:**
- Read-only access (extensions cannot modify settings)
- No sensitive API keys exposed to extensions
- Only configuration data (profiles, models) is accessible
- Extensions see same settings as user's current session

**Version:** Existing SettingsManager architecture
**Affects:** Extension behavior based on user settings, model-aware tools
**Provided by Starter:** Yes (existing settings/profile system)
### REST API Endpoints for Extensions

**New REST API Module: src/main/server/rest-api/extensions-api.ts**

```typescript
import { Router } from 'express';
import type { ExtensionManager } from '@/extensions/extension-manager';

export class ExtensionsApi {
  constructor(
    private extensionManager: ExtensionManager
  ) {}

  registerRoutes(router: Router) {
    // Get all registered UI elements
    router.get('/ui-elements', async (req, res) => {
      const elements = this.extensionManager.getAllUIElements();
      res.json(elements);
    });

    // Get specific UI element
    router.get('/ui-elements/:id', async (req, res) => {
      const element = this.extensionManager.getUIElement(req.params.id);
      if (!element) {
        return res.status(404).json({ error: 'UI element not found' });
      }
      res.json(element);
    });

    // Trigger UI action (button click, etc.)
    router.post('/ui-elements/:id/trigger', async (req, res) => {
      const element = this.extensionManager.getUIElement(req.params.id);
      if (!element) {
        return res.status(404).json({ error: 'UI element not found' });
      }

      try {
        await element.onClick?.();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all registered tools
    router.get('/tools', async (req, res) => {
      const tools = this.extensionManager.getAllTools();
      res.json(tools);
    });

    // Get extension status
    router.get('/extensions/status', async (req, res) => {
      const extensions = this.extensionManager.getAllExtensions();
      res.json(extensions.map(ext => ({
        id: ext.id,
        name: ext.name,
        version: ext.version,
        loaded: ext.loaded,
        error: ext.error
      })));
    });

    // Trigger extension reload
    router.post('/extensions/reload', async (req, res) => {
      try {
        await this.extensionManager.reloadExtensions();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}
```

**Integration with ServerController:**

```typescript
// src/main/server/server-controller.ts
export class ServerController {
  private setupApiRoutes(): void {
    const apiRouter = express.Router();

    // ... existing routes ...

    // Add Extensions API
    new ExtensionsApi(this.extensionManager).registerRoutes(apiRouter);

    this.app.use('/api', apiRouter);
  }
}
```

### Socket.io Events for Real-Time Extension Updates

**New Socket.io Module: src/main/server/socketio/extension-events.ts**

```typescript
import { Server } from 'socket.io';
import type { ExtensionManager } from '@/extensions/extension-manager';

export class ExtensionSocketEvents {
  constructor(
    private io: Server,
    private extensionManager: ExtensionManager
  ) {
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // When extension registers UI element, notify all Socket.io clients
    this.extensionManager.on('ui-element-registered', (data: {
      id: string;
      element: UIElementDefinition;
    }) => {
      this.io.emit('extension:ui-element-registered', data);
    });

    // When extension updates UI element
    this.extensionManager.on('ui-element-updated', (data: {
      id: string;
      updates: Partial<UIElementDefinition>;
    }) => {
      this.io.emit(`extension:ui-element-updated:${data.id}`, data);
    });

    // When extension registers tool
    this.extensionManager.on('tool-registered', (tool: ToolDefinition) => {
      this.io.emit('extension:tool-registered', tool);
    });

    // When extension is loaded/unloaded
    this.extensionManager.on('extension-loaded', (extension: ExtensionData) => {
      this.io.emit('extension:loaded', extension);
    });

    this.extensionManager.on('extension-unloaded', (extension: ExtensionData) => {
      this.io.emit('extension:unloaded', extension);
    });

    // Listen for UI action triggers from Socket.io clients
    this.io.on('extension:ui-action', async (data: {
      elementId: string;
    }) => {
      const element = this.extensionManager.getUIElement(data.elementId);
      if (element) {
        await element.onClick?.();
      }
    });
  }
}
```

**BrowserAPI Integration:**

```typescript
// src/renderer/src/api/browser-api.ts
import { socket } from './socket';

export const extensionsAPI = {
  // Get UI elements
  getUIElements: async (): Promise<UIElementDefinition[]> => {
    const response = await fetch('/api/extensions/ui-elements');
    return response.json();
  },

  // Trigger UI action
  triggerUIAction: async (elementId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`/api/extensions/ui-elements/${elementId}/trigger`, {
      method: 'POST'
    });
    return response.json();
  },

  // Subscribe to UI element updates
  onUIElementRegistered: (callback: (data: any) => void) => {
    socket.on('extension:ui-element-registered', callback);
  },

  onUIElementUpdated: (elementId: string, callback: (data: any) => void) => {
    socket.on(`extension:ui-element-updated:${elementId}`, callback);
  },

  onExtensionLoaded: (callback: (data: any) => void) => {
    socket.on('extension:loaded', callback);
  },

  // Unsubscribe
  off: (event: string, callback?: Function) => {
    socket.off(event, callback);
  }
};
```

### Unified UI Component (Desktop + Browser)

**Component that Works in Both Environments:**

```typescript
// src/renderer/src/components/extensions/ExtensionButton.tsx
export const ExtensionButton = ({ element }: Props) => {
  const [disabled, setDisabled] = useState(element.disabled ?? false);
  const [badge, setBadge] = useState(element.badge);

  useEffect(() => {
    // Desktop: Electron IPC listeners
    if (window.api?.extensions) {
      const updateHandler = (data: Partial<UIElementDefinition>) => {
        if (data.disabled !== undefined) setDisabled(data.disabled);
        if (data.badge !== undefined) setBadge(data.badge);
      };

      window.api.extensions.onUIElementUpdated(updateHandler);
      return () => window.api.extensions.off('ui-element-updated', updateHandler);
    }
    // Browser: Socket.io listeners
    else {
      const updateHandler = (data: Partial<UIElementDefinition>) => {
        if (data.disabled !== undefined) setDisabled(data.disabled);
        if (data.badge !== undefined) setBadge(data.badge);
      };

      extensionsAPI.onUIElementUpdated(element.id, updateHandler);
      return () => extensionsAPI.off(`extension:ui-element-updated:${element.id}`, updateHandler);
    }
  }, [element.id]);

  const handleClick = async () => {
    // Desktop: Electron IPC
    if (window.api?.extensions) {
      await window.api.extensions.triggerUIAction(element.id);
    }
    // Browser: REST API
    else {
      await extensionsAPI.triggerUIAction(element.id);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={clsx(
        'flex items-center gap-2 px-3 py-2 rounded-md',
        'hover:bg-gray-100 dark:hover:bg-gray-800',
        'transition-colors',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      title={element.tooltip}
    >
      {element.icon && <Icon name={element.icon} />}
      <span>{element.label}</span>
      {badge && <Badge count={badge.count} color={badge.color} />}
    </button>
  );
};
```

**Container that Detects Environment:**

```typescript
// src/renderer/src/components/extensions/ExtensionUIContainer.tsx
export const ExtensionUIContainer = () => {
  const [elements, setElements] = useState<UIElementDefinition[]>([]);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Detect environment
    setIsElectron(!!window.api?.extensions);

    // Desktop: Electron IPC
    if (window.api?.extensions) {
      window.api.extensions.onUIElementRegistered((data: any) => {
        setElements(prev => [...prev, { id: data.id, ...data.element }]);
      });

      window.api.extensions.onUIElementUpdated((data: any) => {
        setElements(prev => prev.map(el =>
          el.id === data.id ? { ...el, ...data.updates } : el
        ));
      });
    }
    // Browser: Socket.io + REST API
    else {
      // Initial fetch
      extensionsAPI.getUIElements().then(setElements);

      // Socket.io listeners
      extensionsAPI.onUIElementRegistered((data: any) => {
        setElements(prev => [...prev, { id: data.id, ...data.element }]);
      });

      extensionsAPI.onUIElementUpdated((elementId: string, data: any) => {
        setElements(prev => prev.map(el =>
          el.id === elementId ? { ...el, ...data.updates } : el
        ));
      });
    }
  }, []);

  return (
    <div className="flex gap-2 flex-wrap">
      {elements.map(el => (
        <ExtensionButton key={el.id} element={el} />
      ))}
    </div>
  );
};
```

### Decision Impact Analysis

**Implementation Sequence:**

1. **ExtensionManager & Extension Types** - Core extension system infrastructure
2. **Extension Loader** - TypeScript compilation, sandboxing, hot reload
3. **ExtensionContext API** - Complete API implementation (tools, UI, state, tasks, settings)
4. **HookManager Integration** - Co-existence with existing hooks
5. **Extension UI Elements** - Preload bridge, React components, IPC channels
6. **REST API Endpoints** - ExtensionsApi module for external access
7. **Socket.io Events** - Real-time extension event broadcasting
8. **Extension Builder Skill** - AI-assisted extension development
9. **WakaTime Migration** - Migrate existing hook to extension format
10. **Testing & Documentation** - Comprehensive tests and LLM-friendly docs

**Cross-Component Dependencies:**

| Component | Dependencies | Dependent On |
|-----------|-------------|---------------|
| ExtensionManager | Extension types, HookManager | Extension loading system |
| ExtensionContext | ExtensionManager, TaskManager, SettingsManager | Extension API surface |
| ExtensionLoader | TypeScript compiler API, ExtensionManager | Extension discovery |
| HookManager | ExtensionManager | Co-existence strategy |
| Extension UI | Preload bridge, ExtensionManager | UI integration |
| ExtensionsApi | ExtensionManager | REST API access |
| ExtensionSocketEvents | ExtensionManager | Real-time updates |
| Extension Builder Skill | ExtensionContext, Extension types | AI-assisted development |

**Summary Table:**

| Decision | Status | Version | Provided By |
|----------|--------|---------|---------------|
| Extension API Structure | ✓ Complete | Custom design | User preference |
| Hooks Co-existence | ✓ Complete | Design pattern | Extension integration |
| IPC & REST API | ✓ Complete | Electron 37.6.0, Socket.io 4.8.1 | User clarification |
| Security Sandbox | ✓ Complete | TypeScript 5.9.3 | New implementation |
| Tool Registration | ✓ Complete | Zod 4.1.11 | Existing patterns |
| UI Element Registration | ✓ Complete | React 19.2.0, Tailwind 3.4.14 | Existing patterns |
| State Management | ✓ Complete | better-sqlite3 12.0.0 | Existing patterns |
| Task/Subtask API | ✓ Complete | Existing task system | Existing system |
| Settings Access | ✓ Complete | Existing SettingsManager | Existing system |
| Extension Loading | ⚠️ Deferred | - | Deferred decision |
## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
6 major areas where AI agents could make different choices:
1. Extension naming (classes, files, methods)
2. Extension code organization (where types, tests, utils live)
3. Extension metadata format (how extensions declare themselves)
4. Tool/UI element naming conventions
5. Event handler method naming
6. Error handling patterns

### Naming Patterns

**Database Naming Conventions:**
N/A - Extension state uses better-sqlite3 with existing patterns from AiderDesk

**API Naming Conventions:**
**REST Endpoints:** kebab-case
```typescript
// ✓ Good
GET /api/extensions/ui-elements
POST /api/extensions/ui-elements/:id/trigger

// ✗ Bad
GET /api/extensions/getUIElements
POST /api/extensions/triggerUIElement/:id
```

**Route Parameters:** kebab-case
```typescript
// ✓ Good
router.get('/ui-elements/:id')

// ✗ Bad
router.get('/uiElements/:uiElementId')
```

**Query Parameters:** camelCase or snake_case (consistent with existing AiderDesk API)
```typescript
// Use existing AiderDesk patterns for consistency
// Follow whatever is established in other endpoints
```

**Code Naming Conventions:**

**Extension Classes:** PascalCase
```typescript
// ✓ Good
export default class MyExtension { }

// ✗ Bad
export default class my_extension { }
export default class MyExtensionV2 { }
```

**Extension Files:** kebab-case
```typescript
// ✓ Good
extensions/my-extension.ts
extensions/wakatime-extension.ts

// ✗ Bad
extensions/MyExtension.ts
extensions/my_extension.ts
```

**Extension Class Methods:** camelCase
```typescript
// ✓ Good
async onLoad(context: ExtensionContext): Promise<void>
async onUnload(): Promise<void>
getTools(): ToolDefinition[]
async onToolApproval(...): Promise<{...}>
async onAgentRunFinished(...): Promise<void>

// ✗ Bad
async OnLoad(context: ExtensionContext): Promise<void>
async ONUNLOAD(): Promise<void>
GETTOOLS(): ToolDefinition[]
```

**Tool Names:** kebab-case (strings)
```typescript
// ✓ Good
{
  name: 'run-linter',
  name: 'generate-jira-ticket',
  name: 'analyze-code'
}

// ✗ Bad
{
  name: 'runLinter',
  name: 'GenerateJiraTicket',
  name: 'analyze_code'
}
```

**UI Element IDs:** kebab-case (strings)
```typescript
// ✓ Good
{
  id: 'generate-jira-ticket',
  id: 'connection-status',
  id: 'my-action'
}

// ✗ Bad
{
  id: 'generateJiraTicket',
  id: 'connectionStatus'
}
```

**State Keys:** camelCase
```typescript
// ✓ Good
await context.setState('connectionPool', { active: true });
await context.setState('clickCount', 42);

// ✗ Bad
await context.setState('connection_pool', { active: true });
await context.setState('click_count', 42);
```

**React Component Files:** PascalCase
```typescript
// ✓ Good
ExtensionButton.tsx
ExtensionUIContainer.tsx
ExtensionBadge.tsx

// ✗ Bad
extension-button.tsx
extensionUiContainer.tsx
extension-badge.tsx
```

**React Component Names:** PascalCase
```typescript
// ✓ Good
export const ExtensionButton = ({ element, onClick }: Props) => { ... }
export const ExtensionUIContainer = () => { ... }

// ✗ Bad
export const extensionButton = ({ element, onClick }: Props) => { ... }
export const extension_ui_container = () => { ... }
```

### Structure Patterns

**Extension System Organization:**
```
src/main/extensions/
├── types/                           # Extension type definitions
│   ├── extension.ts                 # Extension, ExtensionContext interfaces
│   ├── tools.ts                    # ToolDefinition, ToolResult interfaces
│   ├── ui-elements.ts               # UIElementDefinition interface
│   └── index.ts                    # Export all types
├── extension-manager.ts               # Extension loading, registry, lifecycle
├── extension-loader.ts               # TypeScript compilation, sandboxing
├── extension-context.ts              # ExtensionContext implementation
└── extension-api.ts                 # Extension API surface

src/main/extensions/validators/         # Extension validation utilities
├── tool-validator.ts                # Tool definition validation
├── ui-validator.ts                 # UI element validation
└── metadata-validator.ts           # Extension metadata validation

src/common/extensions/                   # Shared extension types
├── index.ts                         # Export types for both main and renderer
└── constants.ts                      # Extension constants

src/renderer/src/extensions/              # Extension UI components
├── ExtensionButton.tsx               # Reusable action button component
├── ExtensionUIContainer.tsx        # Container for all extension UI
├── ExtensionBadge.tsx                # Badge component for UI elements
└── index.ts                          # Export all components

src/renderer/src/api/extensions-api.ts   # BrowserAPI extension methods
```

**Extension Test Locations:**
- Co-located with implementation (Vitest pattern)
- Test file: `*.test.ts` in same directory

```
src/main/extensions/
├── extension-manager.ts
├── extension-manager.test.ts          # ✓ Good
├── extension-loader.ts
├── extension-loader.test.ts          # ✓ Good
└── types/
    ├── extension.ts
    └── extension.test.ts            # ✓ Good
```

**Extension Test Naming:**
- PascalCase class name + `.test.ts`
```typescript
// ✓ Good
extension-manager.test.ts
extension-loader.test.ts

// ✗ Bad
extensionManager.test.ts
test-extension-manager.ts
```

**Test File Import:**
```typescript
// ✓ Good
import { ExtensionManager } from './extension-manager';

// ✗ Bad (redundant)
import { ExtensionManager } from './extension-manager.test';
```

### Format Patterns

**Extension Metadata Format:**
```typescript
export default class MyExtension {
  static metadata = {
    name: 'my-extension',              // kebab-case string
    version: '1.0.0',                // semver
    description: 'A sample extension',  // human-readable
    author: 'Extension Author',          // optional
    capabilities: ['tools', 'ui', 'tasks', 'state'], // array of strings
    dependencies?: []                      // optional npm packages
  };
}
```

**Tool Definition Format:**
```typescript
export interface ToolDefinition {
  name: string;              // kebab-case
  label?: string;             // Human-readable label
  description: string;        // Description for LLM
  parameters: z.ZodType;    // Zod schema
  execute: Function;            // Execute function
  renderCall?: Function;       // Optional render hint
  renderResult?: Function;     // Optional render hint
}
```

**UI Element Definition Format:**
```typescript
export interface UIElementDefinition {
  id: string;                 // kebab-case
  type: UIElementType;         // 'action-button', 'status-indicator', 'badge'
  label: string;              // Human-readable label
  icon?: string;               // Icon name from react-icons
  tooltip?: string;            // Tooltip text
  placement: UIPlacement;       // 'task-sidebar', 'chat-input', 'header', 'footer'
  disabled?: boolean;          // Initial state
  visible?: boolean;           // Initial state
  badge?: {                  // Optional badge
    count: number;
    color: string;
  };
  onClick?: Function;           // Event handler
  update?: Function;           // Dynamic update function
}
```

**API Response Formats:**
Follow existing AiderDesk REST API patterns (from src/main/server/rest-api/)

**Success Response:**
```typescript
// Single item
{ data: T }

// Array
{ data: T[] }

// Action result
{ success: boolean }
```

**Error Response:**
```typescript
// Existing AiderDesk pattern
{ error: string }

// With status code
status: 400/404/500
{ error: 'Error message' }
```

### Communication Patterns

**Event Handler Method Naming:**
- Prefix: `on` + CamelCase event name
- Events: Existing hook events + new extension events

```typescript
// ✓ Good
async onToolApproval(toolName: string, args: unknown, context: ExtensionContext): Promise<...>
async onToolResult(toolName: string, args: unknown, result: unknown, context: ExtensionContext): Promise<unknown>
async onAgentStepFinished(stepResult: unknown, context: ExtensionContext): Promise<void>
async onAgentRunFinished(resultMessages: unknown[], context: ExtensionContext): Promise<void>
async onAgentIterationFinished(iterationResult: unknown, context: ExtensionContext): Promise<void>

// ✗ Bad
async handleToolApproval(...): Promise<...>
async tool_result(...): Promise<unknown>
async AgentRunFinished(...): Promise<void>
```

**Event Naming (for extensions):**
- Extension-only events follow existing AiderDesk patterns
```typescript
// ✓ Good
'extension:loaded'
'extension:unloaded'
'extension:ui-element-registered'
'extension:ui-element-updated'

// ✗ Bad
'extensionLoaded'
'EXTENSION_UNLOADED'
'onExtensionUIElementRegistered'
```

**State Update Patterns:**
- Immutable updates for React state
- Direct updates via ExtensionContext (controlled)
```typescript
// ✓ Good - React immutable updates
setElements(prev => [...prev, { id, ...element }]);
setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));

// ✓ Good - ExtensionContext controlled
await context.setState('key', value); // ExtensionManager handles persistence
```

### Process Patterns

**Extension Loading Order:**
1. Global extensions load first (alphabetical by filename)
2. Project extensions load next (alphabetical by filename)
3. Project extensions override global extensions (same extension ID)
4. Extensions with `priority` in metadata load first

**Error Handling Patterns:**
```typescript
// ✓ Good - Try-catch with context logging
try {
  await extension.onLoad(context);
} catch (error) {
  context.log(`Extension load error: ${error.message}`, 'error');
  // Continue loading other extensions
}

// ✓ Good - Graceful degradation
try {
  const result = await tool.execute(args, signal, context);
  return result;
} catch (error) {
  context.log(`Tool execution failed: ${error.message}`, 'error');
  return {
    content: [{ type: 'text', text: `Tool failed: ${error.message}` }],
    isError: true
  };
}

// ✓ Good - Validation with clear errors
if (!tool.name || typeof tool.name !== 'string') {
  throw new ExtensionValidationError(
    'Tool definition must have a valid name property (string, kebab-case)'
  );
}
```

**Extension Hot Reload Behavior:**
1. File watcher detects changes in extension directories
2. Old extension instance unloaded (onUnload() called)
3. New extension instance loaded (onLoad() called)
4. Existing tool/UI registrations replaced
5. Extension state preserved across reload (if extension uses onSaveState/onLoadState)

### Enforcement Guidelines

**All AI Agents MUST:**

1. **Follow naming conventions:**
   - Extension classes: PascalCase
   - Extension methods: camelCase
   - Extension files: kebab-case
   - React components: PascalCase (tsx files)
   - Tool names/UI element IDs: kebab-case strings

2. **Place code in correct directories:**
   - Main process: `src/main/extensions/`
   - Types: `src/main/extensions/types/` or `src/common/extensions/`
   - Renderer components: `src/renderer/src/extensions/`
   - Tests: `*.test.ts` co-located with implementation

3. **Use established formats:**
   - Extension metadata: Follow defined structure
   - Tool definitions: Follow ToolDefinition interface
   - UI element definitions: Follow UIElementDefinition interface
   - API responses: Follow existing AiderDesk patterns

4. **Implement required lifecycle methods:**
   - Extensions must implement `onLoad()` or return valid getter methods
   - Extensions should implement `onUnload()` for cleanup

5. **Handle errors gracefully:**
   - Wrap all extension method calls in try-catch
   - Log errors via `context.log()`
   - Return safe defaults for failures
   - Never let extension errors crash AiderDesk

**Pattern Enforcement:**

**TypeScript Compiler API Validation:**
- Type-check all extensions on load
- Validate method signatures match expected interfaces
- Validate no prohibited imports (fs, child_process, etc.)

**ExtensionManager Runtime Validation:**
- Validate extension metadata structure on load
- Validate tool definitions (name, description, execute function, Zod schema)
- Validate UI element definitions (id, type, placement)
- Validate event handler method names match expected patterns

**Linting with ESLint:**
- Use existing AiderDesk ESLint configuration
- Enforce naming conventions with custom rules (if needed)
- Catch import violations (prohibited modules)

**Code Review Checklist:**
- [ ] Naming conventions followed
- [ ] Files in correct directories
- [ ] Formats used correctly
- [ ] Error handling implemented
- [ ] TypeScript types properly defined
- [ ] Tests co-located with implementation

### Pattern Examples

**Good Examples:**

**Extension Class (Proper Naming & Structure):**
```typescript
import type { ExtensionAPI, ExtensionContext, ToolDefinition, UIElementDefinition } from '@aider-desk/extensions';
import { z } from 'zod';

export default class SampleExtension {
  // Extension metadata
  static metadata = {
    name: 'sample-extension',
    version: '1.0.0',
    description: 'A sample extension demonstrating proper patterns',
    capabilities: ['tools', 'ui']
  };

  private counter = 0;

  // Lifecycle: camelCase method
  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('SampleExtension loaded', 'info');

    // Restore state
    const saved = await context.getState<number>('counter');
    if (saved !== undefined) {
      this.counter = saved;
    }
  }

  async onUnload(): Promise<void> {
    // Cleanup
  }

  // Getter: camelCase method
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'increment-counter', // kebab-case string
        label: 'Increment Counter',
        description: 'Increment the extension counter',
        parameters: z.object({}),
        async execute(args, signal, context) {
          this.counter++;
          await context.setState('counter', this.counter);
          return {
            content: [{ type: 'text', text: `Counter is now ${this.counter}` }]
          };
        }
      }
    ];
  }

  getUIElements(): UIElementDefinition[] {
    return [
      {
        id: 'show-counter', // kebab-case string
        type: 'action-button',
        label: 'Show Counter',
        placement: 'task-sidebar',
        onClick: async () => {
          const context = await this.getContext();
          context.showNotification(`Counter: ${this.counter}`, 'info');
        }
      }
    ];
  }

  // Event handler: camelCase method with 'on' prefix
  async onToolApproval(toolName: string, args: unknown, context: ExtensionContext): Promise<{ approve: boolean }> {
    if (toolName === 'dangerous-tool') {
      return { approve: false };
    }
    return { approve: true };
  }
}
```

**Extension File (Proper File Naming):**
```
# ✓ Good
src/extensions/sample-extension.ts

# ✗ Bad
src/extensions/SampleExtension.ts
src/extensions/sample_extension.ts
```

**React Component (Proper Naming):**
```typescript
// File: ExtensionButton.tsx (PascalCase)
import { UIElementDefinition } from '@aider-desk/extensions';

type Props = {
  element: UIElementDefinition;
  onClick: () => Promise<void>;
};

// Component: PascalCase
export const ExtensionButton = ({ element, onClick }: Props) => {
  return (
    <button onClick={onClick} disabled={element.disabled}>
      {element.label}
    </button>
  );
};
```

**Anti-Patterns:**

**Wrong Naming:**
```typescript
// ✗ Bad: Mixed case
export default class sample_extension { }
export default class SAMPLE_EXTENSION { }

// ✗ Bad: Snake case methods
async ON_LOAD(context: ExtensionContext): Promise<void> { }
async on_load_state(context: ExtensionContext): Promise<void> { }

// ✗ Bad: Wrong file naming
SampleExtension.ts        // Should be sample-extension.ts
extension_button.tsx     // Should be ExtensionButton.tsx
```

**Wrong Structure:**
```typescript
// ✗ Bad: Types in wrong location
src/extensions/types.ts  // Should be in src/main/extensions/types/

// ✗ Bad: Tests in wrong location
tests/extensions.test.ts  // Should be co-located: src/main/extensions/extensions.test.ts

// ✗ Bad: Missing metadata
export default class MyExtension {
  // No static metadata - how to identify this extension?
}

// ✗ Bad: Wrong metadata format
export default class MyExtension {
  static info = {
    extension_name: 'my-extension',  // Wrong: use kebab-case name
    VERSION: '1.0.0'                // Wrong: use lowercase version
  };
}
```

**Wrong Error Handling:**
```typescript
// ✗ Bad: No error handling
async onLoad(context: ExtensionContext): Promise<void> {
  // What if this throws? AiderDesk crashes!
  this.initializeSomething();
}

// ✗ Bad: Crash on error
try {
  await this.riskyOperation();
} catch (error) {
  throw error;  // Extension crashes entire app!
}

// ✗ Bad: Silent failures
try {
  await this.riskyOperation();
} catch (error) {
  // Silently ignore - no logging, no user feedback
}

// ✓ Good
try {
  await this.riskyOperation();
} catch (error) {
  context.log(`Operation failed: ${error.message}`, 'error');
  return safeDefault;  // Graceful degradation
}
```

## Extension Event Hook Specification

### Overview

Extensions can subscribe to lifecycle events throughout AiderDesk's operation. Events are grouped by domain:
- **Task Events** - Task creation, initialization, closing
- **Agent Events** - Agent lifecycle, steps, iterations
- **Tool Events** - Tool invocation, execution, results (with blocking via modification)
- **File Events** - Context file management
- **Prompt Events** - User prompt submission and processing
- **Message Events** - Response message processing
- **Approval Events** - Tool/user action approvals
- **Subagent Events** - Subagent spawning and completion
- **Question Events** - Agent questions and user answers
- **Command Events** - Custom command execution
- **Aider Events** - Legacy Aider mode prompts

### Event Modification Capabilities

**All events are modifying** - Every event can return modified input values that are chained across handlers.

**Unified Modification Model:**
- Every event returns partial updates that are merged with the original event data
- No read-only events - all events can override values and add context
- No dedicated blocking events - blocking is achieved by modifying appropriate fields (e.g., `blocked: true` in tool/approval events)
- Empty return `{}` or `undefined` means no changes (pass through original data)

**Chaining Behavior:**
- Event handlers execute in order (extensions first, then hooks)
- Each handler receives the merged result from previous handlers
- Handlers return partial updates that are merged with the current event data
- Final merged result is used by AiderDesk
- Last modifier wins for overlapping fields

**Return Types:**
- All events return partial updates: `{ [key]: newValue }`
- Returned fields are shallow-merged with event data
- Arrays are replaced (not merged) - include all elements when modifying arrays
- Objects are shallow-merged for most event data

**Example - Modifying onFileAdded (add context files):**
```typescript
async onFileAdded(event: { file: ContextFile }, context: ExtensionContext): Promise<{
  file?: ContextFile;
  additionalFiles?: ContextFile[];
  removedFiles?: string[];
}> {
  // Add additional context files when main file is added
  if (event.file.name === 'src/index.ts') {
    return {
      additionalFiles: [
        { path: '.env.example', name: '.env.example', type: 'file' },
        { path: 'README.md', name: 'README.md', type: 'file' }
      ]
    };
  }
  return {}; // No changes
}
```

**Example - Modifying onAgentStarted (inject context):**
```typescript
async onAgentStarted(event: { prompt: string | null }, context: ExtensionContext): Promise<{
  prompt?: string;
  additionalContext?: string[];
}> {
  // Inject project-specific context into the prompt
  if (!event.prompt) return {};

  return {
    prompt: event.prompt,
    additionalContext: [
      'You are working in a TypeScript project.',
      'Follow the coding standards defined in CONVENTIONS.md.'
    ]
  };
}
```

**Example - Blocking tool execution via modification:**
```typescript
async onToolApproval(
  event: { toolName: string; args: Record<string, unknown> | undefined },
  context: ExtensionContext
): Promise<{
  blocked?: boolean;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
}> {
  // Block dangerous commands by setting blocked: true
  if (event.toolName === 'bash' && event.args?.command?.includes('rm -rf')) {
    return { blocked: true, reason: 'Dangerous command blocked' };
  }
  return {}; // Allow execution
}
```

**Example - Auto-approving via modification:**
```typescript
async onHandleApproval(
  event: { key: string; text: string; subject?: string },
  context: ExtensionContext
): Promise<{
  blocked?: boolean;
  answer?: string;
  userInput?: string;
}> {
  // Auto-approve safe file edits
  if (event.key === 'file_edit' && event.subject?.endsWith('.md')) {
    return { answer: 'yes' }; // Auto-approve
  }
  return {}; // No changes - proceed normally
}
```

### Complete Event List

#### Task Events

**onTaskCreated** - Modifying
Fired when a new task is created. Can modify task data, add context files, or change task properties.
```typescript
async onTaskCreated(event: {
  task: TaskData;
}, context: ExtensionContext): Promise<{
  task?: Partial<TaskData>;
  additionalContextFiles?: ContextFile[];
  removedContextFiles?: string[];
}>
```
**Returns:**
- `task?: Partial<TaskData>` - Override task properties (name, description, status)
- `additionalContextFiles?: ContextFile[]` - Add files to task context
- `removedContextFiles?: string[]` - Remove files from task context

**onTaskInitialized** - Modifying
Fired when a task is fully initialized and ready for operations. Can modify task data and context.
```typescript
async onTaskInitialized(event: {
  task: TaskData;
}, context: ExtensionContext): Promise<{
  task?: Partial<TaskData>;
  additionalContextFiles?: ContextFile[];
  removedContextFiles?: string[];
}>
```
**Returns:**
- `task?: Partial<TaskData>` - Override task properties
- `additionalContextFiles?: ContextFile[]` - Add files to task context
- `removedContextFiles?: string[]` - Remove files from task context

**onTaskClosed** - Modifying
Fired when a task is closed. Can modify task data before saving final state.
```typescript
async onTaskClosed(event: {
  task: TaskData;
}, context: ExtensionContext): Promise<{
  task?: Partial<TaskData>;
  summary?: string;
}>
```
**Returns:**
- `task?: Partial<TaskData>` - Override task properties before closing
- `summary?: string` - Set or override task summary

#### Agent Events

**onAgentStarted** - Modifying
Fired when agent execution begins for a prompt. Can transform prompt, change mode, or add context.
```typescript
async onAgentStarted(event: {
  prompt: string | null;
}, context: ExtensionContext): Promise<{
  prompt?: string;
  mode?: 'code' | 'ask' | 'agent';
  additionalContext?: string[];
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `prompt?: string` - Transform or replace the prompt
- `mode?: 'code' | 'ask' | 'agent'` - Change agent mode
- `additionalContext?: string[]` - Add context strings to agent
- `additionalContextFiles?: ContextFile[]` - Add files to agent context

**onAgentFinished** - Modifying
Fired when agent completes all work for a prompt. Can modify result messages, generate summaries, or add metadata.
```typescript
async onAgentFinished(event: {
  resultMessages: unknown[];
  prompt: string | null;
}, context: ExtensionContext): Promise<{
  resultMessages?: unknown[];
  summary?: string;
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `resultMessages?: unknown[]` - Modify or replace result messages
- `summary?: string` - Set or override agent run summary
- `metadata?: Record<string, unknown>` - Add metadata to agent run

**onAgentStepFinished** - Modifying
Fired after each agent step (one LLM response + tool calls). Can modify messages, tool results, or inject intermediate actions.
```typescript
async onAgentStepFinished(event: {
  stepResult: {
    messages: unknown[];
    toolResults: unknown[];
  };
}, context: ExtensionContext): Promise<{
  stepResult?: {
    messages?: unknown[];
    toolResults?: unknown[];
  };
  injectedMessages?: unknown[];
  injectedToolCalls?: unknown[];
}>
```
**Returns:**
- `stepResult?.messages?: unknown[]` - Modify step messages
- `stepResult?.toolResults?: unknown[]` - Modify tool results
- `injectedMessages?: unknown[]` - Add messages to be processed
- `injectedToolCalls?: unknown[]` - Inject additional tool calls

**onAgentIterationFinished** - Modifying *(NEW)*
Fired after each iteration in reasoning/thinking mode. Can modify iteration data, reasoning, or messages.
```typescript
async onAgentIterationFinished(event: {
  iterationResult: {
    index: number;
    messages: unknown[];
    reasoning?: string;
  };
}, context: ExtensionContext): Promise<{
  iterationResult?: {
    index?: number;
    messages?: unknown[];
    reasoning?: string;
  };
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `iterationResult?.messages?: unknown[]` - Modify iteration messages
- `iterationResult?.reasoning?: string` - Modify or append reasoning
- `metadata?: Record<string, unknown>` - Add iteration metadata

#### Tool Events

**onToolApproval** - Modifying
Fired before tool execution. Can block execution by setting `blocked: true`, modify arguments, or add metadata.
```typescript
async onToolApproval(event: {
  toolName: string;
  args: Record<string, unknown> | undefined;
}, context: ExtensionContext): Promise<{
  blocked?: boolean;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `blocked?: boolean` - Set `true` to prevent tool execution
- `reason?: string` - Reason for blocking (shown to user when blocked)
- `modifiedArgs?: Record<string, unknown>` - Override tool arguments
- `metadata?: Record<string, unknown>` - Add metadata to tool invocation

**Examples:**
```typescript
// Block dangerous bash commands
async onToolApproval(event, context) {
  if (event.toolName === 'bash' && event.args?.command?.includes('rm -rf')) {
    const confirmed = await context.showConfirm(
      'Dangerous Command',
      'This command will delete files. Continue?'
    );
    if (!confirmed) {
      return { blocked: true, reason: 'User cancelled dangerous operation' };
    }
  }
  return {}; // No changes - allow execution
}

// Modify arguments
async onToolApproval(event, context) {
  if (event.toolName === 'search' && !event.args?.caseSensitive) {
    return {
      modifiedArgs: { ...event.args, caseSensitive: true }
    };
  }
  return {};
}
```

**onToolCalled** - Modifying
Fired just before tool executes. Can block execution or modify behavior.
```typescript
async onToolCalled(event: {
  toolName: string;
  args: Record<string, unknown> | undefined;
}, context: ExtensionContext): Promise<{
  blocked?: boolean;
  reason?: string;
  modifiedArgs?: Record<string, unknown>;
  timeout?: number;
}>
```
**Returns:**
- `blocked?: boolean` - Set `true` to prevent tool execution
- `reason?: string` - Reason for blocking
- `modifiedArgs?: Record<string, unknown>` - Override tool arguments
- `timeout?: number` - Override tool execution timeout (ms)

**onToolFinished** - Modifying
Fired after tool execution. Can modify result returned to agent, override error state, or add metadata.
```typescript
async onToolFinished(event: {
  toolName: string;
  args: Record<string, unknown> | undefined;
  result: unknown;
}, context: ExtensionContext): Promise<{
  result?: unknown;
  isError?: boolean;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `result?: unknown` - Modified result (chained across extensions)
- `isError?: boolean` - Override error state
- `errorMessage?: string` - Override or add error message
- `metadata?: Record<string, unknown>` - Add metadata to tool result

**Examples:**
```typescript
// Add metadata to tool results
async onToolFinished(event, context) {
  if (event.toolName === 'search' && !event.isError) {
    return {
      result: {
        ...event.result,
        timestamp: Date.now(),
        searchedBy: 'my-extension'
      }
    };
  }
  return {};
}

// Mark errors for specific tools
async onToolFinished(event, context) {
  if (event.toolName === 'api_call' && this.isRateLimited(event.result)) {
    return { isError: true, errorMessage: 'Rate limit exceeded' };
  }
  return {};
}
```

#### File Events

**onFileAdded** - Modifying
Fired when a file is added to context. Can add additional files to context, remove files, or modify the file being added.
```typescript
async onFileAdded(event: {
  file: ContextFile;
}, context: ExtensionContext): Promise<{
  file?: ContextFile;
  additionalFiles?: ContextFile[];
  removedFiles?: string[];
}>
```
**Returns:**
- `file?: ContextFile` - Override the file being added
- `additionalFiles?: ContextFile[]` - Add more files to context
- `removedFiles?: string[]` - Remove files from context (by path)

**Example:**
```typescript
// Automatically add related files
async onFileAdded(event, context) {
  if (event.file.name.endsWith('.ts')) {
    // Add test file when TypeScript file is added
    const testName = event.file.name.replace('.ts', '.test.ts');
    return {
      additionalFiles: [
        { path: testName, name: testName, type: 'file' }
      ]
    };
  }
  return {};
}
```

**onFileDropped** - Modifying
Fired when a file is dropped from context. Can cancel the drop, drop additional files, or modify the action.
```typescript
async onFileDropped(event: {
  filePath: string;
}, context: ExtensionContext): Promise<{
  cancelDrop?: boolean;
  additionalDrops?: string[];
  reason?: string;
}>
```
**Returns:**
- `cancelDrop?: boolean` - Set `true` to prevent file from being dropped
- `additionalDrops?: string[]` - Add more files to drop
- `reason?: string` - Reason for cancellation

**Example:**
```typescript
// Prevent dropping important config files
async onFileDropped(event, context) {
  const protectedFiles = ['.env', 'package-lock.json'];
  if (protectedFiles.includes(event.filePath)) {
    return { cancelDrop: true, reason: 'Protected file cannot be dropped' };
  }
  return {};
}
```

#### Prompt Events

**onPromptSubmitted** - Modifying
Fired when user submits a prompt. Can transform prompt, change mode, block execution, or add context.
```typescript
async onPromptSubmitted(event: {
  prompt: string;
  mode: Mode;  // 'code' | 'ask' | 'agent'
}, context: ExtensionContext): Promise<{
  blocked?: boolean;
  prompt?: string;
  mode?: Mode;
  additionalContext?: string[];
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `blocked?: boolean` - Set `true` to prevent prompt from processing
- `prompt?: string` - Transform or replace the prompt
- `mode?: Mode` - Change agent mode ('code' | 'ask' | 'agent')
- `additionalContext?: string[]` - Add context strings
- `additionalContextFiles?: ContextFile[]` - Add files to context

**Examples:**
```typescript
// Auto-expand common abbreviations
async onPromptSubmitted(event, context) {
  let prompt = event.prompt;

  // Expand "test" to full testing instructions
  if (prompt.toLowerCase().trim() === 'test') {
    prompt = 'Write comprehensive unit tests for the current file using Vitest. Include both positive and negative test cases.';
  }

  return { prompt };
}

// Change mode based on content
async onPromptSubmitted(event, context) {
  if (event.prompt.startsWith('/')) {
    return { mode: 'ask' }; // Treat commands as ask mode
  }
  return {};
}
```

**onPromptStarted** - Modifying
Fired when prompt processing begins. Can modify prompt, mode, or add context before agent starts.
```typescript
async onPromptStarted(event: {
  prompt: string | null;
  mode: Mode;
}, context: ExtensionContext): Promise<{
  prompt?: string;
  mode?: Mode;
  additionalContext?: string[];
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `prompt?: string` - Transform or replace the prompt
- `mode?: Mode` - Change agent mode
- `additionalContext?: string[]` - Add context strings
- `additionalContextFiles?: ContextFile[]` - Add files to context

**onPromptFinished** - Modifying
Fired when prompt processing completes. Can modify responses, generate summaries, or add metadata.
```typescript
async onPromptFinished(event: {
  responses: ResponseCompletedData[];
}, context: ExtensionContext): Promise<{
  responses?: ResponseCompletedData[];
  summary?: string;
  metadata?: Record<string, unknown>;
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `responses?: ResponseCompletedData[]` - Modify or replace response messages
- `summary?: string` - Set or override prompt summary
- `metadata?: Record<string, unknown>` - Add metadata to prompt execution
- `additionalContextFiles?: ContextFile[]` - Add files to context based on results

#### Message Events

**onResponseMessageProcessed** - Modifying
Fired for each response message. Can modify message content, add metadata, or transform the message.
```typescript
async onResponseMessageProcessed(event: {
  message: ResponseMessage;
}, context: ExtensionContext): Promise<{
  message?: Partial<ResponseMessage>;
  skipMessage?: boolean;
  additionalMessages?: Partial<ResponseMessage>[];
}>
```
**Returns:**
- `message?: Partial<ResponseMessage>` - Override message fields (content, role, etc.)
- `skipMessage?: boolean` - Set `true` to skip processing this message
- `additionalMessages?: Partial<ResponseMessage>[]` - Add extra messages to be processed

**Examples:**
```typescript
// Add metadata to messages
async onResponseMessageProcessed(event, context) {
  return {
    message: {
      ...event.message,
      extensionData: { processedBy: 'my-extension', timestamp: Date.now() }
    }
  };
}

// Filter out system messages
async onResponseMessageProcessed(event, context) {
  if (event.message.role === 'system' && this.shouldSkipSystemMessages()) {
    return { skipMessage: true };
  }
  return {};
}

// Add clarification message after tool results
async onResponseMessageProcessed(event, context) {
  if (event.message.role === 'tool' && event.message.toolName === 'search') {
    return {
      additionalMessages: [
        {
          role: 'system',
          content: 'Search results have been processed. You may need to verify the findings.',
          timestamp: Date.now()
        }
      ]
    };
  }
  return {};
}
```

#### Approval Events

**onHandleApproval** - Modifying
Fired when agent requests user approval for an action. Can auto-answer, block approval, modify user input, or add context.
```typescript
async onHandleApproval(event: {
  key: string;
  text: string;
  subject?: string;
}, context: ExtensionContext): Promise<{
  blocked?: boolean;
  answer?: string;
  userInput?: string;
  additionalInfo?: string;
}>
```
**Returns:**
- `blocked?: boolean` - Set `true` to prevent the approval request
- `answer?: string` - Auto-approve with this answer ('yes', 'no', custom)
- `userInput?: string` - Override or provide user input
- `additionalInfo?: string` - Add information to display to user

**Examples:**
```typescript
// Auto-approve safe operations
async onHandleApproval(event, context) {
  if (event.key === 'file_edit' && event.subject?.endsWith('.md')) {
    return { answer: 'yes' }; // Auto-approve
  }
  return {};
}

// Block and auto-deny dangerous approvals
async onHandleApproval(event, context) {
  if (event.key === 'bash' && event.text?.includes('rm -rf /')) {
    return { blocked: true, answer: 'no' };
  }
  return {};
}

// Modify user input with additional context
async onHandleApproval(event, context) {
  if (event.key === 'code_edit' && !event.userInput?.includes('test')) {
    return {
      additionalInfo: 'Consider adding tests for this change.'
    };
  }
  return {};
}
```

#### Subagent Events

**onSubagentStarted** - Modifying
Fired when subagent is spawned. Can block spawning, modify prompt, or add context.
```typescript
async onSubagentStarted(event: {
  subagentId: string;
  prompt: string;
}, context: ExtensionContext): Promise<{
  blocked?: boolean;
  reason?: string;
  prompt?: string;
  additionalContext?: string[];
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `blocked?: boolean` - Set `true` to prevent subagent from spawning
- `reason?: string` - Reason for blocking
- `prompt?: string` - Transform or replace the subagent prompt
- `additionalContext?: string[]` - Add context strings
- `additionalContextFiles?: ContextFile[]` - Add files to subagent context

**Examples:**
```typescript
// Block subagent spawning for simple queries
async onSubagentStarted(event, context) {
  if (event.prompt.length < 50) {
    return { blocked: true, reason: 'Query too simple for subagent' };
  }
  return {};
}

// Inject project context into subagent prompt
async onSubagentStarted(event, context) {
  return {
    prompt: `${event.prompt}\n\nProject context: ${await context.getProjectDir()}`,
    additionalContextFiles: [
      { path: 'CONVENTIONS.md', name: 'CONVENTIONS.md', type: 'file' }
    ]
  };
}
```

**onSubagentFinished** - Modifying
Fired when subagent completes. Can modify result messages, generate summaries, or add metadata.
```typescript
async onSubagentFinished(event: {
  subagentId: string;
  resultMessages: unknown[];
}, context: ExtensionContext): Promise<{
  resultMessages?: unknown[];
  summary?: string;
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `resultMessages?: unknown[]` - Modify or replace subagent result messages
- `summary?: string` - Set or override subagent summary
- `metadata?: Record<string, unknown>` - Add metadata to subagent run

**Example:**
```typescript
// Add metadata to subagent results
async onSubagentFinished(event, context) {
  return {
    metadata: {
      subagentId: event.subagentId,
      completedAt: Date.now(),
      messageCount: event.resultMessages.length
    }
  };
}
```

#### Question Events

**onQuestionAsked** - Modifying
Fired when agent asks user a question. Can modify the question, auto-answer, or add context.
```typescript
async onQuestionAsked(event: {
  question: QuestionData;
}, context: ExtensionContext): Promise<{
  question?: Partial<QuestionData>;
  autoAnswer?: string;
  skipQuestion?: boolean;
}>
```
**Returns:**
- `question?: Partial<QuestionData>` - Override question fields (text, options, defaultAnswer)
- `autoAnswer?: string` - Automatically answer the question
- `skipQuestion?: boolean` - Set `true` to skip this question

**Examples:**
```typescript
// Auto-answer confirmations with 'yes'
async onQuestionAsked(event, context) {
  if (event.question.text.toLowerCase().includes('proceed')) {
    return { autoAnswer: 'yes' };
  }
  return {};
}

// Simplify complex questions
async onQuestionAsked(event, context) {
  if (event.question.options && event.question.options.length > 5) {
    // Provide a default for long option lists
    return {
      question: {
        ...event.question,
        defaultAnswer: event.question.options[0]
      }
    };
  }
  return {};
}
```

**onQuestionAnswered** - Modifying
Fired when user answers an agent question. Can modify the answer, override user input, or add metadata.
```typescript
async onQuestionAnswered(event: {
  question: QuestionData;
  answer: string;
  userInput?: string;
}, context: ExtensionContext): Promise<{
  answer?: string;
  userInput?: string;
  metadata?: Record<string, unknown>;
  additionalContext?: string[];
}>
```
**Returns:**
- `answer?: string` - Override or transform the answer
- `userInput?: string` - Override user input
- `metadata?: Record<string, unknown>` - Add metadata to answer
- `additionalContext?: string[]` - Add context strings based on answer

**Example:**
```typescript
// Normalize answers
async onQuestionAnswered(event, context) {
  // Normalize yes/no variations
  const normalizedAnswer = event.answer.toLowerCase();
  if (['y', 'yes', 'yeah', 'sure'].includes(normalizedAnswer)) {
    return { answer: 'yes' };
  }
  if (['n', 'no', 'nope', 'nah'].includes(normalizedAnswer)) {
    return { answer: 'no' };
  }
  return {};
}
```

#### Command Events

**onCommandExecuted** - Modifying
Fired when a custom command is executed. Can modify command output, error messages, or add metadata.
```typescript
async onCommandExecuted(event: {
  command: string;
}, context: ExtensionContext): Promise<{
  output?: string;
  error?: string;
  exitCode?: number;
  metadata?: Record<string, unknown>;
}>
```
**Returns:**
- `output?: string` - Modify or replace command output
- `error?: string` - Modify or replace error message
- `exitCode?: number` - Override exit code
- `metadata?: Record<string, unknown>` - Add metadata to command execution

**Examples:**
```typescript
// Add timestamps to command output
async onCommandExecuted(event, context) {
  return {
    output: `[${new Date().toISOString()}] ${event.command}\n`,
    metadata: { executedAt: Date.now() }
  };
}

// Mask sensitive information in commands
async onCommandExecuted(event, context) {
  if (event.command.includes('--api-key')) {
    return {
      command: event.command.replace(/--api-key \S+/, '--api-key ***REDACTED***')
    };
  }
  return {};
}
```

#### Aider Events (Legacy)

**onAiderPromptStarted** - Modifying
Fired when Aider mode prompt starts (legacy mode). Can modify prompt, change mode, or add context.
```typescript
async onAiderPromptStarted(event: {
  prompt: string;
  mode: Mode;
}, context: ExtensionContext): Promise<{
  prompt?: string;
  mode?: Mode;
  additionalContext?: string[];
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `prompt?: string` - Transform or replace the Aider prompt
- `mode?: Mode` - Change Aider mode ('code' | 'ask' | 'agent')
- `additionalContext?: string[]` - Add context strings
- `additionalContextFiles?: ContextFile[]` - Add files to context

**Example:**
```typescript
// Add Aider-specific context
async onAiderPromptStarted(event, context) {
  if (event.mode === 'code') {
    return {
      additionalContext: [
        'Aider mode active. Focus on code generation with minimal explanations.',
        'Follow the project\'s existing patterns and conventions.'
      ]
    };
  }
  return {};
}
```

**onAiderPromptFinished** - Modifying
Fired when Aider mode prompt finishes (legacy mode). Can modify responses, generate summaries, or add metadata.
```typescript
async onAiderPromptFinished(event: {
  responses: ResponseCompletedData[];
}, context: ExtensionContext): Promise<{
  responses?: ResponseCompletedData[];
  summary?: string;
  metadata?: Record<string, unknown>;
  additionalContextFiles?: ContextFile[];
}>
```
**Returns:**
- `responses?: ResponseCompletedData[]` - Modify or replace Aider response messages
- `summary?: string` - Set or override Aider session summary
- `metadata?: Record<string, unknown>` - Add metadata to Aider session
- `additionalContextFiles?: ContextFile[]` - Add files to context based on results

**Example:**
```typescript
// Generate summary from Aider responses
async onAiderPromptFinished(event, context) {
  const changes = event.responses
    .filter(r => r.content.includes('File modified'))
    .length;

  return {
    summary: `Aider session completed. ${changes} file(s) modified.`,
    metadata: { changesCount: changes, mode: 'aider' }
  };
}
```

### Event Handler Naming Convention

All event handlers follow the pattern: `on` + PascalCase event name.

```typescript
// ✓ Good
async onTaskCreated(...)
async onToolApproval(...)
async onAgentStepFinished(...)

// ✗ Bad
async handleTaskCreated(...)
async OnToolApproval(...)
async on_agent_step_finished(...)
```

### Event Processing Order

When an event fires, handlers execute in this order:
1. **Extensions** (extension event handlers) - Loaded first, execute first
2. **Hooks** (legacy hooks) - Execute second for backward compatibility

**Result Chaining:**
- All events support modification through partial return values
- Results chain: extension result → hook result → final merged result
- Each handler receives the merged result from previous handlers
- Last modifier wins for overlapping fields
- Hooks get final say (for backward compatibility)

**Blocking via Modification:**
- Blocking is achieved by setting `blocked: true` in the return value
- First handler to set `blocked: true` prevents the operation
- Extensions can block, then hooks can override (hooks get final say)
- Blocking applies to: onToolApproval, onToolCalled, onPromptSubmitted, onHandleApproval, onSubagentStarted, onFileDropped

### Event Types Reference

```typescript
// Task-related types
interface TaskData {
  taskId: string;
  name: string;
  description?: string;
  status: 'idle' | 'running' | 'paused' | 'error';
  createdAt: number;
  updatedAt: number;
}

// Agent-related types
type Mode = 'code' | 'ask' | 'agent';

interface ResponseCompletedData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  finished: boolean;
  timestamp: number;
}

// File-related types
interface ContextFile {
  path: string;
  name: string;
  type: 'file' | 'folder';
  readOnly?: boolean;
  addedAt: number;
}

// Question types
interface QuestionData {
  id: string;
  text: string;
  options?: string[];
  defaultAnswer?: string;
}

// Message types
interface ResponseMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  finished: boolean;
  timestamp: number;
  reflectedMessage?: string;
  toolName?: string;
  promptContext?: PromptContext;
}
```

### Extension Event Subscription

Extensions subscribe to events using method declarations:

```typescript
export default class MyExtension {
  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Extension loaded', 'info');
  }

  // Modify task on creation
  async onTaskCreated(
    event: { task: TaskData },
    context: ExtensionContext
  ): Promise<{ task?: Partial<TaskData>; additionalContextFiles?: ContextFile[] }> {
    context.log(`Task created: ${event.task.name}`, 'info');

    // Add default README to context when task is created
    if (event.task.name === 'New Task') {
      return {
        additionalContextFiles: [
          { path: 'README.md', name: 'README.md', type: 'file' }
        ]
      };
    }
    return {};
  }

  // Block dangerous tools via modification
  async onToolApproval(
    event: { toolName: string; args: Record<string, unknown> | undefined },
    context: ExtensionContext
  ): Promise<{ blocked?: boolean; reason?: string; modifiedArgs?: Record<string, unknown> }> {
    if (event.toolName === 'bash' && event.args?.command?.includes('rm -rf')) {
      return { blocked: true, reason: 'Dangerous command blocked' };
    }
    return {}; // No changes - allow execution
  }

  // Modify tool results
  async onToolFinished(
    event: { toolName: string; args: unknown; result: unknown },
    context: ExtensionContext
  ): Promise<{ result?: unknown; metadata?: Record<string, unknown> }> {
    if (event.toolName === 'search') {
      return {
        result: { ...event.result, timestamp: Date.now() },
        metadata: { enhancedBy: 'my-extension' }
      };
    }
    return {};
  }

  // Modify agent completion
  async onAgentFinished(
    event: { resultMessages: unknown[] },
    context: ExtensionContext
  ): Promise<{ summary?: string; metadata?: Record<string, unknown> }> {
    context.log(`Agent finished with ${event.resultMessages.length} messages`, 'info');

    // Add summary metadata
    return {
      summary: `Agent completed with ${event.resultMessages.length} messages`,
      metadata: { messageCount: event.resultMessages.length }
    };
  }

  // Add context files when files are added
  async onFileAdded(
    event: { file: ContextFile },
    context: ExtensionContext
  ): Promise<{ additionalFiles?: ContextFile[] }> {
    // When a TypeScript file is added, also add its test file
    if (event.file.name.endsWith('.ts')) {
      const testName = event.file.name.replace('.ts', '.test.ts');
      return {
        additionalFiles: [
          { path: testName, name: testName, type: 'file' }
        ]
      };
    }
    return {};
  }

  // Transform prompts before submission
  async onPromptSubmitted(
    event: { prompt: string; mode: 'code' | 'ask' | 'agent' },
    context: ExtensionContext
  ): Promise<{ prompt?: string; additionalContext?: string[] }> {
    let prompt = event.prompt;

    // Expand common abbreviations
    if (prompt.toLowerCase().trim() === 'test') {
      prompt = 'Write comprehensive unit tests using Vitest. Include both positive and negative test cases.';
    }

    return { prompt };
  }
}
```

### Backward Compatibility with Hooks

All existing hook events remain supported. Extensions can use the same event handlers as hooks.

**Hooks → Extensions Mapping:**
- Hook `onTaskCreated` → Extension `async onTaskCreated(...)`
- Hook `onPromptSubmitted` → Extension `async onPromptSubmitted(...)`
- Hook `onAgentStarted` → Extension `async onAgentStarted(...)`
- Hook `onAgentFinished` → Extension `async onAgentFinished(...)`
- Hook `onAgentStepFinished` → Extension `async onAgentStepFinished(...)`
- Hook `onToolCalled` → Extension `async onToolCalled(...)`
- Hook `onToolFinished` → Extension `async onToolFinished(...)`
- Hook `onFileAdded` → Extension `async onFileAdded(...)`
- Hook `onFileDropped` → Extension `async onFileDropped(...)`
- Hook `onQuestionAsked` → Extension `async onQuestionAsked(...)`
- Hook `onQuestionAnswered` → Extension `async onQuestionAnswered(...)`
- Hook `onHandleApproval` → Extension `async onHandleApproval(...)`
- Hook `onSubagentStarted` → Extension `async onSubagentStarted(...)`
- Hook `onSubagentFinished` → Extension `async onSubagentFinished(...)`
- Hook `onResponseMessageProcessed` → Extension `async onResponseMessageProcessed(...)`

**New Extensions-Only Events:**
- `onAgentIterationFinished` - Fired for each iteration in reasoning mode
- Additional granular events may be added in future

### Event Modification Summary

**All events are modifying** - Every event can return partial updates that modify event data.

| Event Type | Can Modify | Key Modifiable Fields |
|------------|------------|----------------------|
| onTaskCreated | ✓ | task, additionalContextFiles, removedContextFiles |
| onTaskInitialized | ✓ | task, additionalContextFiles, removedContextFiles |
| onTaskClosed | ✓ | task, summary |
| onAgentStarted | ✓ | prompt, mode, additionalContext, additionalContextFiles |
| onAgentFinished | ✓ | resultMessages, summary, metadata |
| onAgentStepFinished | ✓ | stepResult, injectedMessages, injectedToolCalls |
| onAgentIterationFinished | ✓ | iterationResult, metadata |
| onToolApproval | ✓ | blocked, reason, modifiedArgs, metadata |
| onToolCalled | ✓ | blocked, reason, modifiedArgs, timeout |
| onToolFinished | ✓ | result, isError, errorMessage, metadata |
| onFileAdded | ✓ | file, additionalFiles, removedFiles |
| onFileDropped | ✓ | cancelDrop, additionalDrops, reason |
| onPromptSubmitted | ✓ | blocked, prompt, mode, additionalContext, additionalContextFiles |
| onPromptStarted | ✓ | prompt, mode, additionalContext, additionalContextFiles |
| onPromptFinished | ✓ | responses, summary, metadata, additionalContextFiles |
| onResponseMessageProcessed | ✓ | message, skipMessage, additionalMessages |
| onHandleApproval | ✓ | blocked, answer, userInput, additionalInfo |
| onSubagentStarted | ✓ | blocked, reason, prompt, additionalContext, additionalContextFiles |
| onSubagentFinished | ✓ | resultMessages, summary, metadata |
| onQuestionAsked | ✓ | question, autoAnswer, skipQuestion |
| onQuestionAnswered | ✓ | answer, userInput, metadata, additionalContext |
| onCommandExecuted | ✓ | output, error, exitCode, metadata |
| onAiderPromptStarted | ✓ | prompt, mode, additionalContext, additionalContextFiles |
| onAiderPromptFinished | ✓ | responses, summary, metadata, additionalContextFiles |

**Note:** Blocking is achieved by setting `blocked: true` (for tools, prompts, approvals, subagents). All events support modification through partial return values.

## Step 6: Project Structure

### Directory Layout Overview

The Extension System will be integrated into the existing AiderDesk multi-process architecture. New directories and files will follow the established patterns (main/renderer/preload/common separation, TypeScript project references, co-located tests).

### New Directory Structure

```
aider-desk/
├── src/
│   ├── main/
│   │   ├── extensions/                    # NEW: Extension system core
│   │   │   ├── types/                     # Extension type definitions
│   │   │   │   ├── extension.ts           # Extension, ExtensionContext interfaces
│   │   │   │   ├── tools.ts              # ToolDefinition, ToolResult interfaces
│   │   │   │   ├── ui-elements.ts         # UIElementDefinition interface
│   │   │   │   └── index.ts              # Export all types
│   │   │   ├── validators/               # NEW: Extension validation utilities
│   │   │   │   ├── tool-validator.ts    # Tool definition validation
│   │   │   │   ├── ui-validator.ts      # UI element validation
│   │   │   │   └── metadata-validator.ts # Extension metadata validation
│   │   │   ├── extension-manager.ts     # Extension loading, registry, lifecycle
│   │   │   ├── extension-loader.ts      # TypeScript compilation, sandboxing
│   │   │   ├── extension-context.ts     # ExtensionContext implementation
│   │   │   ├── extension-manager.test.ts # ExtensionManager tests
│   │   │   ├── extension-loader.test.ts  # ExtensionLoader tests
│   │   │   ├── extension-context.test.ts # ExtensionContext tests
│   │   │   └── index.ts                  # Export extension system
│   │   │
│   │   ├── server/
│   │   │   ├── rest-api/
│   │   │   │   └── extensions-api.ts     # NEW: REST API for extensions
│   │   │   └── socketio/
│   │   │       └── extension-events.ts   # NEW: Socket.io events for extensions
│   │   │
│   │   ├── bmad/
│   │   │   └── skills/
│   │   │       └── extension-builder/    # NEW: Extension Builder Skill
│   │   │           ├── skill.md          # Skill documentation
│   │   │           ├── templates/       # Extension code templates
│   │   │           │   ├── basic-extension.md
│   │   │           │   ├── tool-based.md
│   │   │           │   └── ui-based.md
│   │   │           └── extension-builder-skill.ts # Skill implementation
│   │   │
│   │   ├── hooks/
│   │   │   └── hook-manager.ts           # MODIFIED: Add extension dispatch
│   │   │
│   │   └── index.ts                      # MODIFIED: Export ExtensionManager
│   │
│   ├── common/
│   │   └── extensions/                    # NEW: Shared extension types
│   │       ├── index.ts                 # Export types for main and renderer
│   │       └── constants.ts             # Extension constants (placements, types)
│   │
│   ├── renderer/
│   │   ├── src/
│   │   │   ├── extensions/               # NEW: Extension UI components
│   │   │   │   ├── ExtensionButton.tsx  # Action button component
│   │   │   │   ├── ExtensionUIContainer.tsx # Container for all UI
│   │   │   │   ├── ExtensionBadge.tsx    # Badge component
│   │   │   │   ├── ExtensionStatusIndicator.tsx # Status indicator
│   │   │   │   ├── index.ts             # Export all components
│   │   │   │   └── __tests__/           # Component tests
│   │   │   │       ├── ExtensionButton.test.tsx
│   │   │   │       ├── ExtensionUIContainer.test.tsx
│   │   │   │       └── ExtensionBadge.test.tsx
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── browser-api.ts        # MODIFIED: Add extensions methods
│   │   │   │   └── extensions-api.ts    # NEW: BrowserAPI extension methods
│   │   │   │
│   │   │   └── pages/
│   │   │       ├── ExtensionsPage.tsx    # NEW: Extensions management UI
│   │   │       └── extensions/
│   │   │           └── __tests__/
│   │   │               └── ExtensionsPage.test.tsx
│   │   │
│   │   └── preload/
│   │       ├── extensions-api.ts         # NEW: Preload bridge for extensions
│   │       └── index.ts                  # MODIFIED: Expose extensions API
│   │
├── .aider-desk/
│   ├── extensions/                      # Project-level extensions
│   │   └── *.ts                         # Extension files (user-created)
│   │
│   └── extensions.db                    # NEW: Extension state database
│
└── ~/.aider-desk/
    └── extensions/                      # Global extensions
        └── *.ts                         # Extension files (user-created)
```

### File-by-File Breakdown

#### Main Process Files

**src/main/extensions/types/extension.ts**
```typescript
// Core extension interfaces
export interface Extension {
  onLoad(context: ExtensionContext): Promise<void>;
  onUnload(): Promise<void>;
  getTools(): ToolDefinition[];
  getUIElements(): UIElementDefinition[];
  onToolApproval?(...): Promise<...>;
  onToolResult?(...): Promise<...>;
  onAgentStepFinished?(...): Promise<void>;
  onAgentRunFinished?(...): Promise<void>;
  onAgentIterationFinished?(...): Promise<void>;
}

export interface ExtensionContext {
  log(message: string, type: 'info' | 'warning' | 'error'): void;
  createTask(options: CreateTaskOptions): Promise<string>;
  createSubtask(parentTaskId: string, options: CreateSubtaskOptions): Promise<string>;
  getAgentProfiles(): Promise<AgentProfile[]>;
  getModelConfigs(): Promise<ModelConfig[]>;
  getSetting(key: string): Promise<unknown>;
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;
  getProjectDir(): string;
  getCurrentTask(): TaskData | null;
  showNotification(...): Promise<void>;
  showConfirm(...): Promise<boolean>;
  showInput(...): Promise<string | undefined>;
  registerUIElement(element: UIElementDefinition): Promise<string>;
  updateUIElement(id: string, updates: Partial<UIElementDefinition>): Promise<void>;
}

export interface ExtensionMetadata {
  name: string;  // kebab-case
  version: string;  // semver
  description: string;
  author?: string;
  capabilities: string[];
  dependencies?: string[];
}
```

**src/main/extensions/types/tools.ts**
```typescript
import { z } from 'zod';

export interface ToolDefinition {
  name: string;  // kebab-case
  label?: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (
    args: any,
    signal: AbortSignal,
    context: ExtensionContext
  ) => Promise<ToolResult>;
  renderCall?(args: any): string;
  renderResult?(result: ToolResult, expanded: boolean): string;
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; source: any }>;
  details?: Record<string, unknown>;
  isError?: boolean;
}
```

**src/main/extensions/types/ui-elements.ts**
```typescript
export type UIElementType = 'action-button' | 'status-indicator' | 'badge';
export type UIPlacement = 'task-sidebar' | 'chat-input' | 'header' | 'footer';

export interface UIElementDefinition {
  id: string;  // kebab-case
  type: UIElementType;
  label: string;
  icon?: string;
  tooltip?: string;
  placement: UIPlacement;
  disabled?: boolean;
  visible?: boolean;
  badge?: { count: number; color: string };
  onClick?: () => Promise<void> | void;
  update?: () => Partial<UIElementDefinition>;
}
```

**src/main/extensions/extension-manager.ts**
```typescript
// Core extension system
export class ExtensionManager {
  // Load extensions from directories
  loadExtensions(): Promise<void>;

  // Get all registered tools
  getAllTools(): ToolDefinition[];

  // Get all registered UI elements
  getAllUIElements(): UIElementDefinition[];

  // Dispatch events to extensions
  dispatchEvent(eventName: string, data: any): Promise<any>;

  // Reload extensions
  reloadExtensions(): Promise<void>;

  // Get extension by ID
  getExtension(id: string): ExtensionData | null;
}
```

**src/main/extensions/extension-loader.ts**
```typescript
// TypeScript compilation and sandboxing
export class ExtensionLoader {
  // Load extension from file
  loadExtension(filePath: string): Promise<Extension>;

  // Type-check extension
  typeCheck(filePath: string): Promise<Diagnostic[]>;

  // Validate extension metadata
  validateMetadata(extension: Extension): boolean;

  // Validate tool definitions
  validateTools(tools: ToolDefinition[]): boolean;

  // Validate UI elements
  validateUIElements(elements: UIElementDefinition[]): boolean;
}
```

**src/main/extensions/extension-context.ts**
```typescript
// ExtensionContext implementation
export class ExtensionContextImpl implements ExtensionContext {
  // Logging
  log(message: string, type: 'info' | 'warning' | 'error'): void;

  // Task management
  createTask(options: CreateTaskOptions): Promise<string>;
  createSubtask(parentTaskId: string, options: CreateSubtaskOptions): Promise<string>;

  // Settings access
  getAgentProfiles(): Promise<AgentProfile[]>;
  getModelConfigs(): Promise<ModelConfig[]>;
  getSetting(key: string): Promise<unknown>;

  // State management
  getState(key: string): Promise<unknown>;
  setState(key: string, value: unknown): Promise<void>;

  // Project context
  getProjectDir(): string;
  getCurrentTask(): TaskData | null;

  // UI interaction
  showNotification(...): Promise<void>;
  showConfirm(...): Promise<boolean>;
  showInput(...): Promise<string | undefined>;

  // UI element registration
  registerUIElement(element: UIElementDefinition): Promise<string>;
  updateUIElement(id: string, updates: Partial<UIElementDefinition>): Promise<void>;
}
```

**src/main/extensions/validators/tool-validator.ts**
```typescript
export class ToolValidator {
  // Validate tool definition
  validate(tool: ToolDefinition): ValidationResult;

  // Check tool name format (kebab-case)
  validateName(name: string): boolean;

  // Check Zod schema
  validateSchema(schema: z.ZodType): boolean;

  // Check execute function
  validateExecute(execute: Function): boolean;
}
```

**src/main/server/rest-api/extensions-api.ts**
```typescript
// REST API endpoints for extensions
export class ExtensionsApi {
  registerRoutes(router: Router): void;

  // GET /api/extensions/ui-elements
  // GET /api/extensions/ui-elements/:id
  // POST /api/extensions/ui-elements/:id/trigger
  // GET /api/extensions/tools
  // GET /api/extensions/status
  // POST /api/extensions/reload
}
```

**src/main/server/socketio/extension-events.ts**
```typescript
// Socket.io events for real-time extension updates
export class ExtensionSocketEvents {
  // Emit extension events to clients
  // extension:ui-element-registered
  // extension:ui-element-updated
  // extension:tool-registered
  // extension:loaded
  // extension:unloaded
}
```

#### Common Files

**src/common/extensions/index.ts**
```typescript
// Shared types for main and renderer processes
export * from '@aider-desk/extensions/types';
export * from '@aider-desk/extensions/constants';
```

**src/common/extensions/constants.ts**
```typescript
// Extension constants
export const UI_ELEMENT_TYPES = ['action-button', 'status-indicator', 'badge'] as const;
export const UI_PLACEMENTS = ['task-sidebar', 'chat-input', 'header', 'footer'] as const;
export const EXTENSION_CAPABILITIES = ['tools', 'ui', 'tasks', 'state'] as const;
```

#### Renderer Process Files

**src/renderer/src/extensions/ExtensionButton.tsx**
```typescript
// Reusable action button for extensions
type Props = {
  element: UIElementDefinition;
  onClick: () => Promise<void>;
};

export const ExtensionButton = ({ element, onClick }: Props) => { ... };
```

**src/renderer/src/extensions/ExtensionUIContainer.tsx**
```typescript
// Container that renders all extension UI elements
export const ExtensionUIContainer = () => { ... };
```

**src/renderer/src/api/extensions-api.ts**
```typescript
// BrowserAPI extension methods
export const extensionsAPI = {
  getUIElements(): Promise<UIElementDefinition[]>;
  triggerUIAction(elementId: string): Promise<void>;
  onUIElementRegistered(callback: Function): void;
  onUIElementUpdated(elementId: string, callback: Function): void;
  off(event: string, callback?: Function): void;
};
```

**src/renderer/src/pages/ExtensionsPage.tsx**
```typescript
// Extensions management UI
export const ExtensionsPage = () => { ... };
```

#### Preload Files

**src/renderer/preload/extensions-api.ts**
```typescript
// Preload bridge for extensions
export const extensionsAPI: {
  registerAction(options: any): Promise<string>;
  showNotification(message: string, type: string): Promise<void>;
  onUIAction(handler: (data: any) => void): void;
  onUIElementRegistered(handler: (data: any) => void): void;
  onUIElementUpdated(handler: (data: any) => void): void;
  off(event: string, handler?: Function): void;
};
```

#### Extension Builder Skill Files

**src/main/bmad/skills/extension-builder/skill.md**
```markdown
# Extension Builder Skill

Help users build AiderDesk extensions step by step.
Provides API guidance, code templates, and best practices.
```

**src/main/bmad/skills/extension-builder/templates/basic-extension.md**
```markdown
```typescript
import type { ExtensionAPI, ExtensionContext } from '@aider-desk/extensions';
import { z } from 'zod';

export default class MyExtension {
  static metadata = {
    name: 'my-extension',
    version: '1.0.0',
    description: 'A sample extension',
    capabilities: ['tools', 'ui']
  };

  async onLoad(context: ExtensionContext): Promise<void> {
    context.log('Extension loaded', 'info');
  }

  async onUnload(): Promise<void> {
    // Cleanup
  }

  getTools(): ToolDefinition[] {
    return [];
  }

  getUIElements(): UIElementDefinition[] {
    return [];
  }
}
```
```

### Database Schema

**Extension State Database (.aider-desk/extensions.db)**
```sql
CREATE TABLE extension_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extension_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,  -- JSON encoded
  updated_at INTEGER NOT NULL,
  UNIQUE(extension_id, key)
);

CREATE INDEX idx_extension_state_extension_id ON extension_state(extension_id);
```

### Extension Directories

**Global Extensions Directory: `~/.aider-desk/extensions/`**
- User-created extension files
- Shared across all AiderDesk projects
- Load priority: alphabetical by filename

**Project Extensions Directory: `.aider-desk/extensions/`**
- Project-specific extension files
- Override global extensions with same name
- Load priority: alphabetical by filename (after global extensions)

### Integration Points

**Modified Files:**

**src/main/hooks/hook-manager.ts**
```typescript
// Add extension dispatch to existing hook system
export class HookManager {
  // ... existing code ...

  async trigger(eventName: string, context: HookContext): Promise<any> {
    // Dispatch to extensions first
    const extensionResult = await this.extensionManager?.dispatchEvent(eventName, context);

    // Dispatch to existing hooks
    const hookResult = await this.dispatchToHooks(eventName, context);

    // Merge results based on event type
    return this.mergeResults(extensionResult, hookResult, eventName);
  }
}
```

**src/main/index.ts**
```typescript
// Initialize ExtensionManager on app startup
import { ExtensionManager } from './extensions/extension-manager';

const extensionManager = new ExtensionManager();
await extensionManager.loadExtensions();
```

**src/renderer/preload/index.ts**
```typescript
// Expose extensions API to renderer
export const api = {
  // ... existing APIs ...
  extensions: extensionsAPI
};
```

**src/renderer/src/api/browser-api.ts**
```typescript
// Add extensions to BrowserAPI for browser environment
export const browserAPI = {
  // ... existing APIs ...
  extensions: extensionsAPI
};
```

### Package Dependencies

**New dependencies (if needed):**
- None - Extension System uses existing AiderDesk dependencies
- TypeScript compiler API (already available via tsconfig)
- better-sqlite3 (already in dependencies)
- Zod (already in dependencies)
- react-icons (already in dependencies)

**Existing dependencies used:**
- TypeScript 5.9.3 - Type checking and compilation
- Electron 37.6.0 - IPC, preload bridge
- React 19.2.0 - UI components
- Zod 4.1.11 - Tool parameter validation
- better-sqlite3 12.0.0 - Extension state storage
- Socket.io 4.8.1 - Real-time events
- Express - REST API endpoints
- Vitest - Testing framework
- React Testing Library - Component tests

### TypeScript Configuration

**No changes required** - Extension System uses existing tsconfig files:
- `tsconfig.node.json` - Main process extension code
- `tsconfig.web.json` - Renderer extension UI components
- `tsconfig.mcp-server.json` - Not used by extensions

**Shared types** defined in `src/common/extensions/` are automatically available to both main and renderer via TypeScript project references.

### Testing Structure

**Co-located tests** (Vitest pattern):
```
src/main/extensions/
├── extension-manager.ts
├── extension-manager.test.ts
├── extension-loader.ts
├── extension-loader.test.ts
├── extension-context.ts
├── extension-context.test.ts
├── validators/
│   ├── tool-validator.ts
│   └── tool-validator.test.ts

src/renderer/src/extensions/
├── ExtensionButton.tsx
├── __tests__/
│   └── ExtensionButton.test.tsx
```

**Test categories:**
- Unit tests: ExtensionManager, ExtensionLoader, ExtensionContext
- Integration tests: Extension loading, tool registration, UI registration
- Component tests: React components with React Testing Library
- E2E tests: Extension lifecycle, hot reload, error handling
## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All architectural decisions are compatible and work together:
- Extension API Structure (class-based with getters) aligns with TypeScript and Zod
- Hooks Co-existence (parallel dispatch) integrates with existing HookManager
- IPC Pattern (dual path: desktop + REST/Socket.io) leverages existing AiderDesk infrastructure
- Security Sandbox (controlled API access) respects Electron security model
- Tool Registration (getter with Zod schemas) integrates with existing agent tool system
- UI Element Registration (getter with IPC) aligns with React UI patterns

**Pattern Consistency:**
Implementation patterns consistently follow AiderDesk conventions:
- Existing patterns from HookManager, IPC, and project structure reused
- File organization follows established patterns (src/main/, src/renderer/, src/common/)
- Testing uses `__tests__/` co-located pattern (matching AiderDesk)
- Documentation structure extends existing docs-site infrastructure
- Naming conventions consistent with existing codebase

**Structure Alignment:**
Project structure supports all architectural decisions:
- Simple, focused structure in `src/main/extensions/` (only 3 core files)
- IPC handlers added to existing `ipc-handlers.ts` (no separate files)
- Renderer components in `src/renderer/src/components/extensions/`
- Types centralized in `src/common/extensions/types.ts`
- All integration points clearly defined and aligned with structure

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
All 6 FR categories are fully architecturally supported:

**Extension Development (FR1-FR10):**
- Extension API structure defined with class-based lifecycle methods
- Tool registration via `getTools()` getter with Zod schemas
- Event subscription via named handler methods
- UI elements via `getUIElements()` getter
- Task/subtask creation via ExtensionContext
- State management via ExtensionContext.setState/getState
- Settings access via ExtensionContext.getAgentProfiles/getModelConfigs
- Multi-file support allowed via imports

**Extension Installation & Discovery (FR11-FR15):**
- Global directory: `~/.aider-desk/extensions/` (via constants)
- Project directory: `.aider-desk/extensions/` (via constants)
- Auto-discovery via ExtensionManager.loadExtensions()
- Extension status tracking via UI: `src/renderer/src/components/extensions/ExtensionsPage.tsx`
- Manual reload capability via IPC handler

**Extension Execution (FR16-FR24):**
- Tool integration via ExtensionManager → ToolSet → Agent
- Tool result modification via `onToolResult()` event handler
- UI element rendering via IPC to renderer components
- Event handlers execute on subscribed events via HookManager integration
- Task/subtask creation via ExtensionContext
- State persistence via ExtensionManager state management
- Settings access via ExtensionContext

**Extension Builder Skill (FR25-FR30):**
- ⚠️ **DEFERRED** - Will be implemented post-MVP as a separate epic
- Architecture supports skill integration when ready

**Extension API Capabilities (FR31-FR40):**
- Complete TypeScript type definitions in `src/common/extensions/types.ts`
- ExtensionContext API with all required methods
- IPC-aware design for Electron multi-process architecture
- Full type safety with Zod inference for tool parameters

**Extension Security & Validation (FR51-FR56):**
- Type-checking on load via TypeScript compiler API
- Security scanning for prohibited imports
- Sandbox execution with controlled API access only
- Graceful error handling with try-catch wrappers
- Clear error messages for validation failures

**Functional Requirements Coverage:**
All 56 FRs are architecturally supported:
- FR1-FR10: Extension API design ✅
- FR11-FR15: Discovery and installation ✅
- FR16-FR24: Execution and integration ✅
- FR25-FR30: Extension Builder (deferred) ✅
- FR31-FR40: API capabilities ✅
- FR41-FR50: Documentation (structure ready, content needed) ✅
- FR51-FR56: Security and validation ✅

**Non-Functional Requirements Coverage:**
All 10 NFRs are addressed architecturally:
- NFR1-NFR5 (Performance): Lazy loading, non-blocking operations, async execution ✅
- NFR6-NFR10 (Reliability): Error isolation, graceful degradation, try-catch wrappers ✅

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical decisions documented with versions:
- ✅ Extension API Structure: Class-based with explicit lifecycle and getters
- ✅ Hooks Co-existence: Parallel event dispatch with HookManager integration
- ⚠️ **PENDING:** Extension Loading Mechanism - Options presented, user needs to select
- ✅ IPC & REST API Pattern: Dual communication path documented
- ✅ Security Sandbox: Controlled API access with validation
- ✅ Tool Registration: Getter with Zod schemas
- ✅ UI Element Registration: Getter with IPC rendering

**Structure Completeness:**
Project structure is complete and specific:
- ✅ All files and directories defined with clear paths
- ✅ Integration points mapped (IPC, REST API, Socket.io)
- ✅ Component boundaries established
- ✅ Requirements mapped to specific files
- ✅ Follows AiderDesk patterns (co-located tests, docs-site structure)

**Pattern Completeness:**
Implementation patterns comprehensively specified:
- ✅ Error handling: try-catch wrappers, graceful degradation
- ✅ Type safety: Full TypeScript definitions, Zod inference
- ✅ Communication patterns: IPC, REST API, Socket.io clearly defined
- ✅ Naming conventions: Consistent with AiderDesk patterns
- ✅ Integration patterns: HookManager bridge, Agent tool integration

### Gap Analysis Results

**Critical Gaps:**
❌ **Extension Loading Mechanism Decision Required:**
Three options presented in architecture document, no selection made:
- A: `require()` with TypeScript compilation
- B: jiti (transpiled require) - pi-mono approach
- C: Custom loader with eval()

This decision blocks implementation - must be resolved before development.

**Important Gaps:**

⚠️ **Extension Event Handlers Missing Documentation:**
Architecture mentions "named event handler methods" but doesn't specify full list. Need to document:
- Which hook events are supported in extensions?
- How do extension event handlers work?
- What parameters do they receive?

⚠️ **UI Element Placement Contexts Underspecified:**
UIElementDefinition has `placement` field but contexts aren't defined:
- What are the exact placement options? (task-sidebar, chat-input, header, footer?)
- Where do each placement render in the actual UI?
- Are all placements supported in MVP or some deferred?

⚠️ **Extension Event Chaining Not Fully Specified:**
Architecture mentions "event chaining and modification" but details are unclear:
- How do extensions modify event data?
- How do multiple extensions chain modifications?
- What's the order of execution?

⚠️ **Documentation Content Needed:**
Documentation structure is defined but content is placeholders:
- `docs-site/docs/extensions/extensions.md` - needs content
- `docs-site/docs/extensions/api-reference.md` - needs content
- `docs-site/docs/extensions/development-guide.md` - needs content

**Nice-to-Have Gaps:**

💡 **Performance Optimization Details:**
Performance NFRs are addressed at a high level but could have more detail:
- Specific lazy loading strategy for extensions
- Performance monitoring and debugging tools
- Performance guidelines for extension developers

💡 **Extension Builder Skill Roadmap:**
Since Extension Builder is deferred, a roadmap would be helpful:
- When will it be implemented?
- What's the priority vs other features?
- Are there any dependencies?

### Validation Issues Addressed

**Critical Issue Resolved:**
None - no blocking issues beyond to pending loading mechanism decision.

**Important Issues Addressed:**
None - important gaps identified but documented for future work.

**Minor Issues Addressed:**
None - minor suggestions identified as nice-to-have.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (medium-high complexity)
- [x] Technical constraints identified (Electron multi-process, TypeScript, React)
- [x] Cross-cutting concerns mapped (security, type safety, error isolation, event system, hooks co-existence, task integration)

**✅ Architectural Decisions**
- [x] Critical decisions documented (6 of 7)
- [x] Technology stack fully specified (TypeScript, Electron, React, Zod, Vitest)
- [x] Integration patterns defined (IPC, REST API, Socket.io)
- [x] Performance considerations addressed (non-blocking, lazy loading, error isolation)

**⚠️ Pending Decision:**
- [ ] Extension Loading Mechanism (must select option A, B, or C)

**✅ Implementation Patterns**
- [x] Naming conventions established (follow AiderDesk patterns)
- [x] Structure patterns defined (co-located tests, docs-site structure)
- [x] Communication patterns specified (IPC, REST API, Socket.io)
- [x] Process patterns documented (error handling, validation, event dispatch)

**✅ Project Structure**
- [x] Complete directory structure defined (15 files total across main, renderer, preload, common)
- [x] Component boundaries established (ExtensionManager, HookManager, TaskManager, SettingsManager)
- [x] Integration points mapped (IPC handlers, REST API, Socket.io events)
- [x] Requirements to structure mapping complete (all 6 FR categories mapped)

### Architecture Readiness Assessment

**Overall Status:** **NEARLY READY** - One pending decision required

**Confidence Level:** High - All architectural decisions are sound and coherent

**Key Strengths:**
- Simple, focused structure that follows AiderDesk patterns
- Comprehensive type safety with TypeScript and Zod
- Strong security model with sandboxing and validation
- Clear integration with existing systems (hooks, tasks, agents)
- Backward compatibility with existing hook system
- Well-defined error isolation and recovery

**Areas for Future Enhancement:**
- Complete documentation content (structure ready, content needed)
- Implement Extension Builder Skill post-MVP
- Add performance monitoring and debugging tools
- Consider extension marketplace for discovery and distribution

### Implementation Handoff

**AI Agent Guidelines:**

1. **Follow architectural decisions exactly as documented**
2. **Use implementation patterns consistently** (co-located tests, IPC integration, error isolation)
3. **Respect project structure and boundaries** (keep extensions focused, integrate via ExtensionContext)
4. **Refer to this document for all architectural questions**

**First Implementation Priority:**
Make the **Extension Loading Mechanism Decision** before any implementation begins:

```
Choose one option for loading TypeScript extensions:
A) require() with TypeScript compilation
B) jiti (transpiled require) - pi-mono approach
C) Custom loader with eval()

What's your preference? (A/B/C)
```

Once loading mechanism is decided, start with:
1. Add constants to `src/main/constants.ts` (AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR)
2. Create Extension types in `src/common/extensions/types.ts`
3. Implement ExtensionManager in `src/main/extensions/extension-manager.ts`
4. Add IPC handlers to `src/main/ipc-handlers.ts`
5. Create ExtensionContext in `src/main/extensions/extension-context.ts`
## Project Structure & Boundaries

### Complete Project Directory Structure
```
src/
├── main/
│   ├── constants.ts                             # Add extension dir constants (AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR)
│   ├── ipc-handlers.ts                          # Add extension IPC handlers (get-extensions, reload-extensions, trigger-extension-ui, etc.)
│   ├── extensions/
│   │   ├── index.ts                             # Export ExtensionManager
│   │   ├── extension-manager.ts                 # Main ExtensionManager (load, validate, dispatch events)
│   │   ├── extension-context.ts                 # ExtensionContext implementation
│   │   └── __tests__/
│   │       └── extension-manager.test.ts       # Unit tests
│   └── hooks/
│       └── extension-bridge.ts                  # Bridge hooks co-existence (dispatch to extensions)
│
├── renderer/src/
│   └── components/
│       └── extensions/
│           ├── ExtensionsPage.tsx               # Extensions list and management page
│           ├── ExtensionButton.tsx              # Action button component
│           └── ExtensionDialog.tsx              # Dialog component
│
├── preload/
│   ├── index.ts                                 # Add extension API methods (getExtensions, reloadExtensions, triggerExtensionAction)
│   └── index.d.ts                               # Add extension API types
│
└── common/
    ├── api.ts                                   # Add extension API types to ApplicationAPI
    ├── extensions/
    │   ├── index.ts                             # Export all extension types
    │   ├── types.ts                             # Extension, ExtensionContext, ToolDefinition, UIElementDefinition, etc.
    │   └── constants.ts                         # Extension constants
    └── ipc/
        └── extension-channels.ts                # IPC channel definitions

docs-site/docs/
└── extensions/
    ├── extensions.md                            # Main documentation
    ├── api-reference.md                         # Extension API reference
    └── development-guide.md                     # How to create extensions
```

### Architectural Boundaries

**API Boundaries:**
- **Extension API (`@common/extensions/types.ts`)**: Public API surface for extension developers
- **ExtensionManager**: Private implementation in `src/main/extensions/extension-manager.ts`
- **IPC Handlers**: Added to existing `src/main/ipc-handlers.ts`

**Component Boundaries:**
- **Extension ↔ Agent**: ExtensionManager → ToolSet → Agent
- **Extension ↔ UI**: ExtensionContext → IPC → Renderer → React Components
- **Extension ↔ Hooks**: HookManager.dispatch() → ExtensionManager.dispatchToExtensions()
- **Main ↔ Renderer**: IPC via `src/preload/index.ts`

**Service Boundaries:**
- **ExtensionManager**: Owns extension lifecycle, registration, dispatching
- **HookManager**: Collaborates with ExtensionManager for unified event dispatching
- **TaskManager**: Receives task creation via ExtensionContext
- **SettingsManager**: Provides read-only settings via ExtensionContext

**Data Boundaries:**
- **Extension State**: Managed by ExtensionManager, persisted per extension
- **Extension Metadata**: In extension file frontmatter
- **UI Element Registry**: In ExtensionManager, synced via IPC

### Requirements to Structure Mapping

**Epic: Extension Development (FR1-FR10)**
- Extension API: `src/common/extensions/types.ts`
- ExtensionContext: `src/main/extensions/extension-context.ts`
- Docs: `docs-site/docs/extensions/development-guide.md`

**Epic: Extension Installation & Discovery (FR11-FR15)**
- ExtensionManager: `src/main/extensions/extension-manager.ts` (loadFromDir, setupWatcher)
- Constants: `src/main/constants.ts` (AIDER_DESK_EXTENSIONS_DIR)
- UI: `src/renderer/src/components/extensions/ExtensionsPage.tsx`

**Epic: Extension Execution (FR16-FR24)**
- ExtensionManager: `src/main/extensions/extension-manager.ts` (toolRegistry, eventDispatcher)
- Hooks Bridge: `src/main/hooks/extension-bridge.ts`

**Epic: Extension Builder Skill (FR25-FR30)**
- Deferred for future implementation

**Epic: Extension API Capabilities (FR31-FR40)**
- Types: `src/common/extensions/types.ts`
- ExtensionContext: `src/main/extensions/extension-context.ts`
- Preload API: `src/preload/index.ts`

**Epic: Extension Security & Validation (FR51-FR56)**
- Validation: ExtensionManager (type-check, security-scan)
- Sandbox: ExtensionContext (controlled API only)

### Cross-Cutting Concerns

**Type Safety:**
- Types: `src/common/extensions/types.ts`
- Type Checking: ExtensionManager (TypeScript compiler API)
- IPC Types: `src/common/api.ts` + `src/preload/index.d.ts`

**Error Isolation:**
- try-catch in ExtensionManager for all extension calls
- Graceful degradation when extensions fail

**Event System:**
- Types: `src/common/extensions/types.ts`
- Dispatcher: ExtensionManager
- Bridge: `src/main/hooks/extension-bridge.ts`

### Integration Points

**Internal Communication:**
- **Extension → Agent**: Extension.getTools() → ExtensionManager → Agent tool registration
- **Extension → HookManager**: HookManager.trigger() → ExtensionManager.dispatchToExtensions()
- **Extension → TaskManager**: ExtensionContext.createTask() → TaskManager
- **Extension → UI**: ExtensionContext.showNotification() → IPC → Renderer

**Data Flow:**
```
Extension File (.ts)
        ↓
ExtensionManager.loadExtension()
        ↓
Type Validation (TypeScript compiler API)
        ↓
Security Scan (prohibited imports)
        ↓
Extension.onLoad(context)
        ↓
Tool Registration (getTools)
        ↓
UI Element Registration (getUIElements)
        ↓
Agent invokes extension tool
        ↓
Tool execution with ExtensionContext
        ↓
Results returned
```

### File Organization Patterns

**Configuration Files:**
- `src/main/constants.ts`: Add AIDER_DESK_EXTENSIONS_DIR, AIDER_DESK_GLOBAL_EXTENSIONS_DIR

**Source Organization:**
- **Extension System Core**: `src/main/extensions/` - ExtensionManager, ExtensionContext
- **Extension API Public Types**: `src/common/extensions/` - what extension developers import
- **Renderer UI Integration**: `src/renderer/src/components/extensions/` - React components
- **IPC Bridge**: `src/preload/index.ts` - typed IPC layer for cross-process communication

**Test Organization:**
- **Co-located tests**: `src/main/extensions/__tests__/extension-manager.test.ts`
- **Component tests**: `src/renderer/src/components/extensions/__tests__/`

**Asset Organization:**
- **Documentation**: `docs-site/docs/extensions/` - API reference, development guide, examples

### Development Workflow Integration

**Development Server Structure:**
- Hot reload: ExtensionManager watchers for extension directories
- Extension development: Extensions can be edited in `.aider-desk/extensions/` and auto-reloaded

**Build Process Structure:**
- Extension types: Included in TypeScript compilation via project references
- Extension validation: Happens at runtime via TypeScript compiler API (not build-time)

**Deployment Structure:**
- Extension discovery: Works in both dev and production from the same locations
- Extension validation: Same runtime validation in all environments
- Extension persistence: Extension state saved in project `.aider-desk/` directory

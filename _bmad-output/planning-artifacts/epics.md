---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
inputDocuments:
  - prd.md
  - architecture.md
---

# aider-desk - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for aider-desk, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Epic List
<!-- Epic definitions are documented above in Requirements Inventory section -->

## Epic 1: Extension Installation & Discovery

Users can install, discover, and manage extensions in AiderDesk. A developer can download an extension, copy it to their extensions folder, restart AiderDesk, and see the extension loaded and ready to use.

### Story 1.1: Extension Directories and Constants

As a **system developer**,
I want **to define global and project extension directories as constants**,
So that **the extension system knows where to look for extensions and can be configured consistently**.

**Acceptance Criteria:**

**Given** the extension system is being initialized
**When** the constants are defined in `src/main/constants.ts`
**Then** the constants include `AIDER_DESK_EXTENSIONS_DIR` pointing to `.aider-desk/extensions/` relative to project directory
**And** the constants include `AIDER_DESK_GLOBAL_EXTENSIONS_DIR` pointing to `~/.aider-desk/extensions/`
**And** the global directory path is resolved using the user's home directory
**And** constants are exported and accessible to the extension system

### Story 1.2: Extension File Discovery

As a **system developer**,
I want **to scan extension directories and discover TypeScript files**,
So that **all available extensions can be identified for loading**.

**Acceptance Criteria:**

**Given** extension directories are defined in constants
**When** the extension discovery scans `AIDER_DESK_EXTENSIONS_DIR` and `AIDER_DESK_GLOBAL_EXTENSIONS_DIR`
**Then** all `.ts` files in global directory are discovered
**And** all `.ts` files in project directory are discovered
**And** project extension files override global extensions with the same filename
**And** extensions are discovered in alphabetical order by filename
**And** a list of discovered extension file paths is returned
**And** missing directories are handled gracefully without errors

### Story 1.3: Extension Type-Checking and Validation

As a **system developer**,
I want **to validate extension code using TypeScript compiler API**,
So that **malformed or invalid extensions are detected before loading**.

**Acceptance Criteria:**

**Given** an extension file has been discovered
**When** the extension is type-checked using TypeScript compiler API
**Then** the TypeScript code is compiled and diagnostics are collected
**And** any TypeScript errors are reported with clear error messages (FR53, NFR9)
**And** imports are validated for prohibited modules (fs, child_process, electron) (FR54, FR55)
**And** extensions with TypeScript errors are rejected before loading (NFR8)
**And** extensions with prohibited imports are rejected with clear error messages
**And** validation failures return diagnostic details for debugging (NFR7)

### Story 1.4: Extension Loading with jiti

As a **system developer**,
I want **to load valid TypeScript extension files using jiti**,
So that **extensions can be loaded without pre-compilation**.

**Acceptance Criteria:**

**Given** an extension file has passed type-checking and validation
**When** jiti transpiles and requires the extension file
**Then** the extension module is loaded as a JavaScript class
**And** the extension class is instantiated
**And** the extension's static metadata is extracted from the class
**And** extensions are loaded in the order: global extensions first, then project extensions (FR13)
**And** project extensions override global extensions with the same name
**And** loading errors are caught and logged with extension name and error details (NFR7, NFR10)
**And** failed extensions do not prevent other extensions from loading (NFR6, NFR10)
**And** the extension is added to the extension registry with its metadata

### Story 1.5: Extension Startup Integration

As a **AiderDesk user**,
I want **extensions to be loaded automatically when AiderDesk starts**,
So that **all extensions are available without manual intervention**.

**Acceptance Criteria:**

**Given** AiderDesk is starting up
**When** the extension manager initializes during app startup
**Then** extension directories are scanned and extensions are discovered
**And** all valid extensions are type-checked and validated
**And** all valid extensions are loaded using jiti
**And** each extension's `onLoad()` method is called with ExtensionContext
**And** extension loading does not visibly delay AiderDesk startup time (NFR1)
**And** any extension loading errors are logged but do not prevent AiderDesk from starting (NFR6)
**And** a summary of loaded extensions is logged to the console
**And** the extension registry is populated with all active extensions

### Story 1.6: Extension Hot Reload

As an **extension developer**,
I want **extensions to reload automatically when I save changes**,
So that **I can iterate quickly during development without restarting AiderDesk**.

**Acceptance Criteria:**

**Given** AiderDesk is running with extensions loaded
**When** an extension file is modified in the extensions directory
**When** a file watcher detects the change
**Then** the extension's `onUnload()` method is called
**And** the extension is removed from the registry
**And** the extension file is re-discovered and re-validated
**And** the extension is re-loaded using jiti
**And** the extension's `onLoad()` method is called
**And** extension state is preserved across reload if the extension uses onSaveState/onLoadState
**And** hot reload failures are logged but do not affect other extensions (NFR10)
**And** hot reload does not block the main application thread (NFR3)

---

## Epic 2: Extension Development & Basic Tool Registration

Extension creators can write TypeScript code and register custom tools that agents can invoke. An extension creator writes a simple extension that registers a tool, saves it, and sees it available in agent's tool list.

### Story 2.1: Extension Type Definitions

As a **system developer**,
I want **to define complete TypeScript interfaces for the Extension API**,
So that **extension creators have full type safety and IntelliSense support**.

**Acceptance Criteria:**

**Given** the extension system is being designed
**When** core types are defined in `src/common/extensions/types.ts`
**Then** `Extension` interface is exported with `onLoad()`, `onUnload()`, `getTools()`, `getUIElements()`, and event handler methods
**And** `ExtensionContext` interface is exported with all API methods (log, createTask, getState, setState, etc.)
**And** `ExtensionMetadata` interface is exported with name, version, description, author, capabilities fields
**And** all types are exported from `src/common/extensions/index.ts` for easy importing
**And** types are available to both main and renderer processes via TypeScript project references
**And** JSDoc comments are included for IntelliSense documentation (FR39)

### Story 2.2: ExtensionContext Implementation

As a **system developer**,
I want **to implement the ExtensionContext class that extensions use to interact with AiderDesk**,
So that **extensions have controlled access to AiderDesk capabilities**.

**Acceptance Criteria:**

**Given** ExtensionContext interface is defined
**When** ExtensionContextImpl class is implemented in `src/main/extensions/extension-context.ts`
**Then** `log(message, type)` method writes to extension logger with timestamp
**And** `getProjectDir()` returns current project directory path
**And** `getCurrentTask()` returns active task data or null
**And** methods for task management, state, and settings throw NotImplementedError (to be implemented in Epic 4)
**And** methods for UI interaction throw NotImplementedError (to be implemented in Epic 5)
**And** ExtensionContext is instantiated with dependencies for future epic integration
**And** ExtensionContext maintains isolation from direct system access (FR54, FR55)

### Story 2.3: Tool Definition Interface

As a **system developer**,
I want **to define ToolDefinition interface with Zod schema support**,
So that **extensions can register type-safe tools with validated parameters**.

**Acceptance Criteria:**

**Given** tools need to be registered by extensions
**When** `ToolDefinition` interface is defined in `src/common/extensions/types.ts`
**Then** interface includes `name: string` for tool identifier (kebab-case)
**And** interface includes `label?: string` for human-readable display name
**And** interface includes `description: string` for LLM understanding
**And** interface includes `parameters: z.ZodType<any>` for Zod schema validation
**And** interface includes `execute: (args, signal, context) => Promise<ToolResult>` for tool execution
**And** `ToolResult` interface is defined with `content: Array<{type, text/source} | {type, source}>` field
**And** `ToolResult` includes optional `details?: Record<string, unknown>` for metadata
**And** `ToolResult` includes optional `isError?: boolean` for error marking
**And** Zod schema types are inferred from parameters field for full type safety (FR31)

### Story 2.4: Extension Class Lifecycle

As a **system developer**,
I want **to implement extension lifecycle methods for initialization and cleanup**,
So that **extensions can set up resources and clean up properly**.

**Acceptance Criteria:**

**Given** Extension interface is defined
**When** an extension is loaded by ExtensionManager
**Then** extension class is instantiated
**And** `onLoad(context: ExtensionContext)` method is called with ExtensionContext instance
**And** extension can initialize internal state and register resources in `onLoad()`
**And** `onUnload()` method is called when extension is unloaded or reloaded
**And** extension can release resources and save state in `onUnload()`
**And** lifecycle methods are wrapped in try-catch for error isolation (NFR10)
**And** errors in lifecycle methods are logged via context.log() without crashing AiderDesk (NFR6)

### Story 2.5: Tool Registration via getTools()

As a **system developer**,
I want **extensions to define available tools using getTools() getter method**,
So that **tools can be registered dynamically and conditionally**.

**Acceptance Criteria:**

**Given** an extension is loaded and initialized
**When** ExtensionManager calls `extension.getTools()`
**Then** method returns array of `ToolDefinition` objects
**And** tool names are validated to be kebab-case strings
**And** tool descriptions are validated to be non-empty
**And** tool parameters are validated to be Zod schemas
**And** tool execute functions are validated to be async functions
**And** getter allows dynamic tool registration based on runtime conditions
**And** empty array is returned if extension has no tools
**And** tool definitions are collected for registration with agent system (FR1)

### Story 2.6: Tool Integration with Agent System

As a **system developer**,
I want **to register extension tools with Agent's ToolSet so agents can invoke them**,
So that **extensions can provide custom tools to agents during conversations**.

**Acceptance Criteria:**

**Given** an extension has been loaded with tool definitions
**When** tools are collected from `getTools()`
**Then** ExtensionManager registers each tool with Agent's ToolSet
**And** tool name is used as tool identifier in ToolSet
**And** tool execute function is wrapped to pass ExtensionContext
**And** tool parameters are validated using Zod schema before execution
**And** AbortSignal is passed to execute function for cancellation support
**And** tool execution is wrapped in try-catch for error isolation
**And** tool results are formatted as expected by Agent (FR16)
**And** extension tool errors are logged but do not crash agent (NFR10)
**And** tool execution does not add noticeable latency to agent responses (NFR2)

---

## Epic 3: Extension Event System Integration

Extensions can subscribe to system events and react to AiderDesk lifecycle events. An extension creator writes an extension that listens for agent completions, logs data, or modifies tool results in real-time.

### Story 3.1: Extension Event Handler Methods

As a **system developer**,
I want **to define ALL event handler methods on Extension interface**,
So that **extensions can subscribe to all AiderDesk lifecycle events**.

**Acceptance Criteria:**

**Given** Extension interface is defined
**When** event handler methods are added to Extension interface
**Then** Task Events are defined:
  - `onTaskCreated(event, context)` for task creation
  - `onTaskInitialized(event, context)` for task initialization
  - `onTaskClosed(event, context)` for task closure
**And** Agent Events are defined:
  - `onAgentStarted(event, context)` for agent start
  - `onAgentFinished(event, context)` for agent completion
  - `onAgentStepFinished(event, context)` for each agent step
  - `onAgentIterationFinished(event, context)` for each iteration (FR2)
**And** Tool Events are defined:
  - `onToolApproval(event, context)` before tool execution
  - `onToolCalled(event, context)` just before tool executes
  - `onToolFinished(event, context)` after tool execution
**And** File Events are defined:
  - `onFileAdded(event, context)` for context file additions
  - `onFileDropped(event, context)` for file drops
**And** Prompt Events are defined:
  - `onPromptSubmitted(event, context)` for user prompt submission
  - `onPromptStarted(event, context)` when prompt processing begins
  - `onPromptFinished(event, context)` for prompt completion
**And** Message Events are defined:
  - `onResponseMessageProcessed(event, context)` for each response message
**And** Approval Events are defined:
  - `onHandleApproval(event, context)` for approval requests
**And** Subagent Events are defined:
  - `onSubagentStarted(event, context)` for subagent spawning
  - `onSubagentFinished(event, context)` for subagent completion
**And** Question Events are defined:
  - `onQuestionAsked(event, context)` for agent questions
  - `onQuestionAnswered(event, context)` for user answers
**And** Command Events are defined:
  - `onCommandExecuted(event, context)` for custom commands
**And** Aider Events (Legacy) are defined:
  - `onAiderPromptStarted(event, context)` for Aider mode
  - `onAiderPromptFinished(event, context)` for Aider completion
**And** all event handler methods are optional (extensions implement only what they need)
**And** all methods return Promise to support async event handling
**And** all events support modification via partial return values (Story 3.3)

### Story 3.2: HookManager Integration for Event Dispatch

As a **system developer**,
I want **to integrate ExtensionManager with HookManager for unified event dispatch**,
So that **extensions receive the same events as existing hooks**.

**Acceptance Criteria:**

**Given** HookManager is the central event dispatcher for existing hooks
**When** HookManager is modified to support extension dispatch
**Then** HookManager imports and instantiates ExtensionManager
**And** HookManager's `trigger(eventName, context)` method is modified
**And** `trigger()` first calls ExtensionManager's dispatch method for extensions
**And** `trigger()` then calls existing hook dispatch for legacy hooks
**And** both extension and hook event handlers execute for each event
**And** event data flows from extensions to hooks in sequence (FR2, FR20)
**And** extension handlers execute before hook handlers (backward compatibility)

### Story 3.3: Event Modification and Chaining

As a **system developer**,
I want **to implement event modification support so extensions and hooks can transform event data**,
So that **multiple extensions can chain modifications and hooks can have final say**.

**Acceptance Criteria:**

**Given** event handlers are called in sequence (extensions first, then hooks)
**When** an event handler returns a partial object with modifications
**Then** modifications are merged with current event data
**And** merged data is passed to next event handler in sequence
**And** all events support modification via partial return values
**And** empty return `{}` or `undefined` means no changes (pass through)
**And** arrays in return values are replaced (not merged) - handler includes all elements
**And** objects in return values are shallow-merged
**And** last modifier wins for overlapping fields (hooks get final say)
**And** blocking is achieved by setting `blocked: true` in return value (for tools, prompts, approvals, subagents)
**And** first handler to set `blocked: true` prevents the operation

### Story 3.4: Tool Result Modification

As a **system developer**,
I want **to allow extensions to modify tool results before they are returned to the agent**,
So that **extensions can enhance, transform, or add metadata to tool outputs**.

**Acceptance Criteria:**

**Given** an extension implements `onToolFinished(event, context)` method
**When** a tool executes and returns a result
**Then** extension receives tool name, arguments, and result in event
**Then** extension can return modified result via modification pattern
**And** extension can add metadata to result details field
**And** extension can override isError field to mark tool as failed
**And** extension can add errorMessage field to provide error context
**And** modified results are merged with original result
**And** chained extensions see modifications from previous handlers
**And** hooks see final modified result (hooks get final say) (FR17)
**And** modifications do not add noticeable latency to agent responses (NFR2)

### Story 3.5: Agent Lifecycle Event Implementation

As a **system developer**,
I want **to implement new agent lifecycle events for granular extension hooks**,
So that **extensions can react to agent steps and iterations**.

**Acceptance Criteria:**

**Given** Agent system executes agent runs with multiple steps and iterations
**When** an agent step completes (one LLM response + tool calls)
**Then** `onAgentStepFinished(event, context)` is called with step result
**And** step result includes messages and toolResults arrays
**And** extensions can modify step result via partial return
**And** extensions can inject additional messages or tool calls via partial return
**When** an agent iteration completes (in reasoning/thinking mode)
**Then** `onAgentIterationFinished(event, context)` is called with iteration result
**And** iteration result includes index, messages, and reasoning
**And** extensions can modify iteration result via partial return
**And** extensions can add metadata to iteration via partial return
**And** new agent lifecycle events support all modification capabilities (Story 3.3)
**And** events fire in sequence: iterations → steps → agentFinished

### Story 3.6: Non-Blocking Event Execution

As a **system developer**,
I want **to ensure event handlers execute asynchronously without blocking the main thread**,
So that **multiple extensions can run concurrently without degrading responsiveness**.

**Acceptance Criteria:**

**Given** multiple extensions are loaded with event handlers
**When** a system event fires and dispatches to extensions
**Then** all extension event handlers are called asynchronously via Promise.all()
**And** each event handler runs in parallel with other handlers
**And** slow event handlers do not block other handlers from starting
**And** event dispatch waits for all handlers to complete before merging results
**And** event handler errors are caught and logged without blocking dispatch (NFR6)
**And** failed event handlers do not prevent other handlers from executing
**And** event dispatch does not block main application thread (NFR3)
**And** multiple extensions run concurrently without degrading AiderDesk responsiveness (NFR4)
**And** event execution timeout is enforced (handlers exceeding timeout are logged and skipped)

---

## Epic 4: Task, Project & Settings Integration

Extensions can access Task and Project classes in event handlers, and read/update AiderDesk settings. An extension creates tasks for specific workflows, accesses project context, and modifies settings based on user behavior.

### Story 4.1: Task & Project Class Access in Event Handlers

As a **system developer**,
I want **to pass Task and Project objects to extension event handlers**,
So that **extensions can directly access task and project data in event hooks**.

**Acceptance Criteria:**

**Given** an extension implements event handler methods
**When** an event fires that has associated task or project context
**Then** event handler receives `event.task` parameter with Task object (if applicable)
**And** event handler receives `event.project` parameter with Project object (if applicable)
**And** Task object includes task properties (id, name, description, status, contextFiles)
**And** Task object provides methods for task operations (save, delete, export)
**And** Project object includes project properties (name, path, workingMode)
**And** Project object provides methods for project operations (getContext, addContextFile)
**When** events without task/project context fire (e.g., global events)
**Then** event.task is undefined or null
**And** event.project is undefined or null
**And** extension can safely check for presence before accessing properties
**And** Task and Project access is available in:
  - onTaskCreated, onTaskInitialized, onTaskClosed (task context)
  - onAgentStarted, onAgentFinished, onAgentStepFinished (task context)
  - onToolApproval, onToolCalled, onToolFinished (task context)
  - onPromptSubmitted, onPromptFinished (task context)
  - onFileAdded, onFileDropped (project context)

### Story 4.2: Settings Read/Write Access via ExtensionContext

As a **system developer**,
I want **to provide read and write access to SettingsData via ExtensionContext**,
So that **extensions can read and modify AiderDesk settings**.

**Acceptance Criteria:**

**Given** SettingsManager is available for settings operations
**When** `getSettingsData()` method is implemented in ExtensionContext
**Then** method calls SettingsManager to retrieve complete SettingsData object
**And** returns Promise<SettingsData> with all current settings
**And** SettingsData includes:
  - Agent profiles and active profile selection
  - Model configurations and active model
  - Theme settings (dark/light mode)
  - UI preferences
  - Other application settings
**When** `updateSettings(updates)` method is implemented in ExtensionContext
**Then** method accepts `updates: Partial<SettingsData>` parameter
**And** SettingsManager merges updates with existing settings
**And** SettingsManager validates updates against settings schema
**And** SettingsManager persists updated settings to storage
**Then** changes are immediately reflected in AiderDesk (theme updates, etc.)
**And** settings change events are emitted to notify other components
**And** method returns Promise that resolves when settings are saved
**And** extension errors during settings update are caught and logged (FR8, FR38)
**And** settings are accessible in extension event handlers and tool execute functions

### FR Coverage Map

**Extension Development (FR1-FR10):**
FR1: Epic 2 - Register custom tools that agents can invoke
FR2: Epic 3 - Subscribe to system events
FR3: Epic 5 - Register action buttons in AiderDesk UI
FR4: Epic 5 - Create custom dialogs and modals
FR5: Epic 4 - Create and manage tasks
FR6: Epic 4 - Create and manage subtasks
FR7: Epic 4 - Maintain persistent state
FR8: Epic 4 - Read agent profiles and model configurations
FR9: Epic 2 - Write TypeScript with full type safety
FR10: Epic 4 - Create multi-file extensions with imports

**Acceptance Criteria:**

**Given** ExtensionContext is implemented and database is available
**When** `setState(key, value)` is called on ExtensionContext
**Then** value is JSON encoded for storage
**Then** upsert operation is performed on extension_state table
**And** operation uses extension_id from extension metadata
**And** updated_at timestamp is set to current time
**And** operation returns Promise that resolves on completion
**When** `getState(key)` is called on ExtensionContext
**Then** query selects row from extension_state table by extension_id and key
**And** if row exists, value is JSON decoded and returned
**And** if row does not exist, undefined is returned
**And** operation is async and returns Promise
**And** errors are caught and logged via context.log() without crashing

### Story 4.3: Task Creation API Integration

As a **system developer**,
I want **to integrate TaskManager with ExtensionContext for task creation**,
So that **extensions can create tasks that appear in AiderDesk task management UI**.

**Acceptance Criteria:**

**Given** TaskManager is available for task operations
**When** `createTask(options)` method is implemented in ExtensionContext
**Then** method accepts CreateTaskOptions parameter:
  - `name: string` (required)
  - `description?: string` (optional)
  - `contextFiles?: string[]` (optional - file paths)
  - `initialPrompt?: string` (optional)
  - `workingMode?: 'local' | 'worktree'` (optional)
**And** ExtensionContext calls TaskManager to create task
**And** TaskManager validates task name is non-empty
**And** TaskManager creates task directory in `.aider-desk/tasks/`
**And** TaskManager saves task metadata to database
**And** context files are added to task if provided
**And** worktree is created if workingMode is 'worktree'
**And** task ID is returned as string from createTask()
**And** extension errors during task creation are logged and caught (FR21, FR35)
**And** created task appears in AiderDesk task management UI

### Story 4.4: Subtask Creation API Integration

As a **system developer**,
I want **to integrate TaskManager with ExtensionContext for subtask creation**,
So that **extensions can create subtasks within existing tasks**.

**Acceptance Criteria:**

**Given** TaskManager is available for task operations
**When** `createSubtask(parentTaskId, options)` method is implemented in ExtensionContext
**Then** method accepts parentTaskId as string and CreateSubtaskOptions:
  - `name: string` (required)
  - `description?: string` (optional)
  - `todoItems?: string[]` (optional - initial checklist)
**And** ExtensionContext calls TaskManager to create subtask
**And** TaskManager validates parent task exists
**And** TaskManager validates subtask name is non-empty
**And** TaskManager creates subtask under parent task
**And** todo items are added to subtask if provided
**And** subtask ID is returned as string from createSubtask()
**And** extension errors during subtask creation are logged and caught (FR22, FR36)
**And** created subtask appears in AiderDesk task management UI under parent task

### Story 4.5: Settings Access (Agent Profiles & Model Configs)

As a **system developer**,
I want **to integrate SettingsManager with ExtensionContext for read-only settings access**,
So that **extensions can read agent profiles and model configurations to adapt behavior**.

**Acceptance Criteria:**

**Given** SettingsManager is available for reading configuration
**When** `getAgentProfiles()` method is implemented in ExtensionContext
**Then** method calls SettingsManager to retrieve all agent profiles
**Then** returns Promise<AgentProfile[]> with array of profiles
**And** each AgentProfile includes:
  - `id: string`
  - `name: string`
  - `description?: string`
  - `systemPrompt?: string`
  - `customInstructions?: string`
  - `modelId: string`
  - `providerId: string`
  - `toolApprovals?: Record<string, 'always' | 'ask' | 'never'>`
  - `skills?: string[]`
**And** method is read-only (no write access to profiles)
**When** `getActiveAgentProfile()` method is implemented
**Then** method calls SettingsManager to retrieve currently active profile
**And** returns Promise<AgentProfile | null> for active profile
**And** `getModelConfigs()` method returns Promise<ModelConfig[]>
**And** each ModelConfig includes id, name, providerId, contextWindow, maxTokens, capabilities
**And** `getActiveModel()` method returns Promise<ModelConfig | null>
**And** `getSetting(key)` method retrieves arbitrary setting value
**And** all settings access is read-only (extensions cannot modify settings) (FR8, FR38)
**And** settings errors are caught and logged without crashing

### Story 4.6: Multi-file Extension Support

As a **system developer**,
I want **to allow extensions to import from other files**,
So that **complex extensions can organize code across multiple files**.

**Acceptance Criteria:**

**Given** an extension file imports from other TypeScript files
**When** jiti loads the extension
**Then** jiti resolves import statements to relative paths
**And** imported modules are transpiled and loaded
**And** extension class can use imported utilities and types
**And** extension can export default class from index file
**Then** extension loader discovers the main extension file (index.ts or specified in metadata)
**And** imported files are located relative to main extension file
**And** circular imports are handled by jiti or rejected with error
**And** multi-file extensions work identically to single-file extensions
**And** extension type-checking validates all imported files (FR10)

### Story 4.7: Extension Lifecycle State Methods

As a **system developer**,
I want **to add onSaveState and onLoadState methods to extension lifecycle**,
So that **extensions can automatically save and restore state**.

**Acceptance Criteria:**

**Given** Extension interface is defined with lifecycle methods
**When** `onSaveState(context)` method is added to Extension interface
**Then** method is called automatically when extension is unloaded or reloaded
**And** extension can call `context.setState()` to save state in onSaveState()
**When** `onLoadState(context)` method is added to Extension interface
**Then** method is called automatically after extension is loaded
**And** extension can call `context.getState()` to restore state in onLoadState()
**And** both methods are optional (extensions implement if they use state)
**And** both methods receive ExtensionContext parameter
**And** methods are called in sequence: onLoad() → onLoadState() (if defined)
**And** methods are called in sequence: onSaveState() (if defined) → onUnload()
**And** extension state is preserved across reloads using lifecycle methods
**And** errors in state methods are caught and logged without crashing (NFR10)

---

## Epic 5: Extension UI Elements & User Interaction

Extensions can add buttons, dialogs, and notifications to AiderDesk UI. An extension adds a "Generate Jira Ticket" button to task sidebar that users can click to create tickets from their work.

### Story 5.1: UI Element Definition Interface

As a **system developer**,
I want **to define UIElementDefinition interface with types and placements**,
So that **extensions can declaratively define UI elements for registration**.

**Acceptance Criteria:**

**Given** UI element types need to be defined
**When** `UIElementDefinition` interface is defined in `src/common/extensions/types.ts`
**Then** interface includes `id: string` for unique element identifier (kebab-case)
**And** interface includes `type: 'button' | 'notification'` for element type
**And** interface includes `label: string` for display text
**And** interface includes `icon?: string` for optional icon name (react-icons)
**And** interface includes `description?: string` for tooltip or help text
**And** interface includes `placement: UIPlacement` enum for UI location
**And** `UIPlacement` enum includes:
  - `taskSidebar` for task sidebar buttons
  - `chatToolbar` for chat interface toolbar
  - `messageActions` for action buttons on messages
  - `globalToolbar` for application-wide toolbar
**And** interface includes `onClick: string` for handler ID to call in extension
**And** interface includes `context?: 'task' | 'project' | 'global'` for context type
**And** interface includes `enabled?: (context) => boolean` for conditional visibility
**And** UIElementDefinition is exported from `src/common/extensions/index.ts`
**And** types are available to both main and renderer processes
**And** JSDoc comments are included for IntelliSense documentation (FR39)

### Story 5.2: ExtensionContext UI Methods

As a **system developer**,
I want **to implement UI interaction methods in ExtensionContext**,
So that **extensions can show notifications, confirm dialogs, and input prompts**.

**Acceptance Criteria:**

**Given** ExtensionContext interface is defined
**When** `showNotification(message, options)` method is implemented
**Then** method accepts `message: string` parameter for notification text
**And** method accepts `options?: {type?: 'info' | 'success' | 'warning' | 'error', duration?: number}`
**And** method triggers IPC event to renderer to show notification
**And** method returns Promise<void> that resolves when notification is shown
**When** `showConfirm(message, options)` method is implemented
**Then** method accepts `message: string` parameter for confirmation text
**And** method accepts `options?: {title?: string, confirmText?: string, cancelText?: string}`
**And** method triggers IPC event to renderer to show confirm dialog
**And** method returns Promise<boolean> with user's choice (true/false)
**When** `showInput(message, options)` method is implemented
**Then** method accepts `message: string` parameter for prompt text
**And** method accepts `options?: {title?: string, placeholder?: string, defaultValue?: string, type?: 'text' | 'password'}`
**And** method triggers IPC event to renderer to show input dialog
**And** method returns Promise<string | null> with user input or null if cancelled
**And** all UI methods use IPC to communicate with renderer process (FR40)
**And** methods are async to await user interaction
**And** methods include timeout handling for unresponsive UI
**And** extension errors during UI operations are caught and logged (FR3, FR4)

### Story 5.3: UI Element Registration via getUIElements()

As a **system developer**,
I want **extensions to define UI elements using getUIElements() getter method**,
So that **UI elements can be registered dynamically and conditionally**.

**Acceptance Criteria:**

**Given** Extension interface is defined
**When** `getUIElements()` getter method is added to Extension interface
**Then** method returns array of `UIElementDefinition` objects
**And** element IDs are validated to be kebab-case strings
**And** element IDs are validated to be unique across all extensions
**And** element labels are validated to be non-empty
**And** element placements are validated against UIPlacement enum
**And** onClick handler IDs are validated to be non-empty
**And** getter allows dynamic UI registration based on runtime conditions
**And** empty array is returned if extension has no UI elements
**And** UI elements are collected and registered with ExtensionManager
**And** ExtensionManager validates element definitions before registration
**And** invalid UI elements are rejected with clear error messages (NFR9)

### Story 5.4: IPC Communication for Extension UI

As a **system developer**,
I want **to implement IPC handlers for extension UI interactions**,
So that **main process extensions can communicate with renderer process UI**.

**Acceptance Criteria:**

**Given** ExtensionManager is loaded and UI elements are registered
**When** `extension:getUIElements` IPC channel is invoked from renderer
**Then** main process handler returns array of registered UIElementDefinition
**And** response includes element metadata (id, label, icon, placement, etc.)
**And** response is serialized for IPC transfer
**When** `extension:uiElementClicked` IPC event is emitted from renderer
**Then** main process handler receives elementId and optional context data
**And** handler looks up extension that registered the element
**And** handler calls extension's event handler method matching onClick ID
**And** handler passes event object with context (task, project, data)
**And** handler returns result to renderer for response handling
**When** `extension:uiInteraction` IPC channel is invoked for UI methods
**Then** handler receives methodName (showNotification, showConfirm, showInput)
**And** handler receives parameters for the UI method
**Then** handler calls the corresponding ExtensionContext method
**Then** handler returns response to renderer
**And** all IPC operations use existing IPC layer patterns (FR40)
**And** IPC errors are caught and logged without crashing (NFR6)
**And** IPC communication uses electron-vite preload for type safety

### Story 5.5: Renderer Components for Extension UI

As a **system developer**,
I want **to implement React components for rendering extension UI elements**,
So that **extension buttons and dialogs appear in the AiderDesk UI**.

**Acceptance Criteria:**

**Given** UI element definitions are received from main process
**When** `ExtensionButton` component is created in `src/renderer/src/extensions/ExtensionButton.tsx`
**Then** component accepts UIElementDefinition as props
**And** component renders button with label and optional icon
**And** component shows tooltip with description on hover
**And** component calls `extension:uiElementClicked` IPC on click
**And** component respects enabled property for conditional visibility
**And** component handles loading states during handler execution
**When** `ExtensionDialog` component is created for confirm/input dialogs
**Then** component accepts message, title, and options as props
**Then** component renders modal dialog with appropriate controls
**Then** component resolves promise when user confirms/cancels
**When** `ExtensionNotification` component is created for toasts
**Then** component accepts message and type as props
**Then** component renders notification with appropriate styling
**Then** component auto-dismisses after duration
**When** `ExtensionUIManager` is created in `src/renderer/src/extensions/ExtensionUIManager.tsx`
**Then** manager loads UI elements from main process on mount
**Then** manager renders buttons in appropriate placement contexts (taskSidebar, chatToolbar, etc.)
**Then** manager handles UI element clicks and IPC events
**Then** manager displays notifications, confirms, and inputs as requested
**And** all components follow AiderDesk UI conventions and styling
**And** all components support i18n for internationalization
**And** all components use existing React patterns and hooks

### Story 5.6: Extension Status UI

As a **system developer**,
I want **to create a UI component for viewing loaded extensions**,
So that **users can see which extensions are active and their status**.

**Acceptance Criteria:**

**Given** AiderDesk has an extensions section in settings
**When** `ExtensionList` component is created in `src/renderer/src/extensions/ExtensionList.tsx`
**Then** component fetches list of loaded extensions via IPC
**And** each extension card displays:
  - Extension name and version
  - Description from metadata
  - Author information
  - Status (loaded, error, disabled)
  - Number of registered tools
  - Number of registered UI elements
**And** extension cards show error message if loading failed
**And** component supports filtering by status
**And** component supports searching by name or description
**When** `ExtensionDetails` component is created for detailed view
**Then** component displays full extension metadata
**And** component lists all registered tools with descriptions
**And** component lists all registered UI elements with placements
**And** component shows extension logs (if available)
**When** component is integrated into AiderDesk Settings page
**Then** Extensions section is added to Settings navigation
**And** ExtensionList is displayed when Extensions section is active
**And** ExtensionDetails is shown when extension card is clicked
**And** data refreshes when page mounts and on manual reload
**And** loading and empty states are handled appropriately (FR14)

### Story 5.7: Manual Reload Capability

As a **system developer**,
I want **to implement manual extension reload triggerable from UI**,
So that **extension developers can reload extensions during development**.

**Acceptance Criteria:**

**Given** Extensions UI is displaying loaded extensions
**When** "Reload Extensions" button is added to ExtensionList component
**Then** button triggers `extension:reload` IPC event to main process
**And** ExtensionManager receives reload request
**And** ExtensionManager calls unload() on all loaded extensions
**And** ExtensionManager clears extension registry
**And** ExtensionManager rediscovered extension files from directories
**And** ExtensionManager validates and loads all extensions
**And** ExtensionManager calls onLoad() on each loaded extension
**And** ExtensionManager sends updated UI elements to renderer
**And** UI refreshes to show reloaded extensions
**When** reload completes successfully
**Then** success notification is displayed to user
**And** extension list is updated with new status
**When** reload encounters errors
**Then** error notification is displayed to user
**And** failed extensions show error status with message
**And** successful extensions remain loaded (partial reload)
**When** "Reload Single Extension" button is added to each extension card
**Then** button triggers reload for specific extension only
**And** only specified extension is unloaded and reloaded
**And** other extensions remain active during reload
**And** UI updates single extension card status
**And** manual reload does not block the main application thread (NFR3)
**And** manual reload is available in developer mode or always (FR15)

---

## Epic 6: Extension Documentation, Testing & Examples

Complete documentation, working examples, and WakaTime migration enable extension creators to build successfully. An extension creator references API documentation, studies working examples, and follows best practices to build a production-ready extension.

### Story 6.1: Complete TypeScript Type Definitions

As an **extension creator**,
I want **to access complete TypeScript type definitions for all extension APIs**,
So that **I can write extensions with full type safety and IntelliSense support**.

**Acceptance Criteria:**

**Given** extension types are defined in `src/common/extensions/types.ts`
**When** an extension creator imports types from the extension module
**Then** all extension API interfaces are exported and accessible
**And** `ExtensionContext` interface includes all method signatures with parameter types
**And** `ToolDefinition` interface includes complete type definitions
**And** `ToolParameterDefinition` interface includes parameter schema types
**And** `UIElementDefinition` interface includes all placement and type options
**And** all event handler method signatures are typed
**And** enum types (e.g., `UIPlacement`, `UIElementType`) are exported
**And** all types include JSDoc comments for documentation generation
**And** TypeScript compiler validates extension code against these types (FR39)

### Story 6.2: Extensions Run in Appropriate Electron Contexts

As a **system developer**,
I want **extensions to execute in the correct Electron process context**,
So that **security boundaries are maintained and appropriate APIs are available**.

**Acceptance Criteria:**

**Given** extension code is being loaded by the ExtensionManager
**When** an extension is loaded in the main process
**Then** extension runs in Node.js context with access to main process APIs
**And** extension has access to file system operations via ExtensionContext
**And** extension can register tools for agent invocation
**And** extension can subscribe to system events
**When** an extension needs to render UI elements
**Then** UI components run in renderer process via IPC communication
**And** renderer process has no direct access to main process APIs
**And** UI elements are sandboxed from privileged operations
**And** context isolation is enforced between main and renderer extensions
**When** an extension attempts to access privileged APIs
**Then** access is denied if not explicitly allowed via ExtensionContext
**And** security policy validation prevents unauthorized operations (FR40)
**And** violations are logged with extension name and attempted operation

### Story 6.3: Extend Existing Docs-Site Infrastructure

As a **documentation maintainer**,
I want **to extend the existing documentation site to include extension documentation**,
So that **extension docs are integrated with the main AiderDesk documentation**.

**Acceptance Criteria:**

**Given** AiderDesk has an existing documentation site infrastructure
**When** extension documentation is added to the docs site
**Then** a new "Extensions" section is added to the documentation navigation
**And** the section follows existing documentation site structure
**And** documentation is written in Markdown format compatible with the site
**And** sidebar navigation includes extension documentation categories
**When** documentation is built
**Then** all extension documentation pages are generated
**And** pages include proper navigation links
**And** pages maintain consistent styling with existing docs
**And** code blocks include syntax highlighting for TypeScript
**And** pages are properly linked from the main documentation index (FR50)

### Story 6.4: Complete API Reference with Type Signatures

As an **extension creator**,
I want **to access a complete API reference with TypeScript type signatures**,
So that **I can understand all available methods and their parameters**.

**Acceptance Criteria:**

**Given** extension documentation is set up
**When** API reference documentation is created
**Then** documentation includes complete reference for `ExtensionContext` interface
**And** each method includes TypeScript signature (e.g., `readState(key: string): Promise<any>`)
**And** each method includes parameter descriptions
**And** each method includes return type documentation
**And** each method includes usage examples
**Then** documentation includes `ToolDefinition` interface reference
**And** all interface properties are documented with types
**And** optional vs required parameters are clearly indicated
**Then** documentation includes event system reference
**And** all available events are listed with signatures
**And** event payload types are documented
**Then** documentation includes UI element registration reference
**And** all UI element types are documented
**And** placement options are explained with examples
**And** all type signatures are copyable for easy reference (FR41)

### Story 6.5: Working Examples - Tool Registration

As an **extension creator**,
I want **to study working examples of tool registration**,
So that **I can understand how to implement custom tools in my extensions**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** tool registration examples are documented
**Then** a complete "Hello World" tool example is provided
**And** example shows basic tool structure with ToolDefinition
**And** example demonstrates tool parameter definition
**And** example shows async/await pattern for tool execution
**Then** a more complex tool example is provided
**And** example shows tool with multiple parameters
**And** example shows parameter validation
**And** example shows error handling in tool execution
**Then** examples include the complete extension class code
**And** examples show how to export the extension
**And** examples include comments explaining key concepts
**And** examples are tested to ensure they compile and run correctly (FR42)

### Story 6.6: Working Examples - Event Subscription

As an **extension creator**,
I want **to study working examples of event subscription**,
So that **I can implement event handlers that react to system events**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** event subscription examples are documented
**Then** a basic event subscription example is provided
**And** example shows subscribing to agent completion event
**And** example shows event handler method signature
**And** example demonstrates event data access
**Then** multiple event subscription example is provided
**And** example shows subscribing to multiple events
**And** example shows conditional event handling
**And** example shows event data modification
**Then** examples demonstrate agent lifecycle events
**And** example shows onAgentStart handler
**And** example shows onAgentEnd handler
**And** example shows onAgentError handler
**Then** examples include best practices for event handling
**And** examples show how to avoid blocking operations
**And** examples demonstrate error handling in event handlers (FR43)

### Story 6.7: Working Examples - UI Element Registration

As an **extension creator**,
I want **to study working examples of UI element registration**,
So that **I can add buttons and dialogs to the AiderDesk UI**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** UI element examples are documented
**Then** a button registration example is provided
**And** example shows UIElementDefinition structure
**And** example shows button placement in task sidebar
**And** example shows button icon selection
**Then** a dialog registration example is provided
**And** example shows modal definition
**And** example shows dialog content structure
**And** example shows dialog trigger from button
**Then** a notification example is provided
**And** example shows notification types (success, error, warning, info)
**And** example shows notification duration configuration
**Then** examples show integration between UI elements
**And** example shows button that opens a dialog
**And** example shows dialog that displays a notification
**And** examples include accessibility best practices (FR44)

### Story 6.8: Working Examples - Task and Subtask Creation

As an **extension creator**,
I want **to study working examples of task and subtask creation**,
So that **I can create tasks programmatically from my extensions**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** task creation examples are documented
**Then** a basic task creation example is provided
**And** example shows using createTask() method
**And** example shows task properties (title, description, status)
**And** example shows associating task with project
**Then** subtask creation example is provided
**And** example shows using createSubtask() method
**And** example shows linking subtasks to parent tasks
**And** example shows subtask dependencies
**Then** a real-world workflow example is provided
**And** example shows creating tasks from tool execution results
**And** example shows tracking task progress
**And** example shows updating task status based on events
**Then** examples include error handling for task operations
**And** examples show how to handle task creation failures
**And** examples show how to verify task creation success (FR45)

### Story 6.9: Working Examples - State Management

As an **extension creator**,
I want **to study working examples of state management**,
So that **I can persist data across AiderDesk sessions**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** state management examples are documented
**Then** a basic state read/write example is provided
**And** example shows using readState() method
**And** example shows using writeState() method
**And** example shows handling missing state values
**Then** a state lifecycle example is provided
**And** example shows onLoadState() method
**And** example shows onSaveState() method
**And** example shows state initialization on first load
**Then** a complex state example is provided
**And** example shows storing objects and arrays
**And** example shows state versioning/migration
**And** example shows clearing invalid state
**Then** examples show best practices for state size
**And** examples warn against storing large data
**And** examples show error handling for state operations
**And** examples demonstrate state persistence across reloads (FR46)

### Story 6.10: Working Examples - Settings Access

As an **extension creator**,
I want **to study working examples of settings access**,
So that **I can read agent profiles and model configurations**.

**Acceptance Criteria:**

**Given** documentation examples are being created
**When** settings access examples are documented
**Then** an agent profile reading example is provided
**And** example shows using getAgentProfiles() method
**And** example shows accessing individual profile properties
**And** example shows iterating through available profiles
**Then** a model configuration example is provided
**And** example shows using getModelConfigs() method
**And** example shows accessing model provider settings
**And** example shows reading model parameters (temperature, maxTokens)
**Then** a settings adaptation example is provided
**And** example shows changing behavior based on model config
**And** example shows selecting appropriate agent profile
**And** example shows handling missing settings
**Then** examples include security considerations
**And** examples warn about not modifying settings without permission
**And** examples show read-only access patterns (FR47)

### Story 6.11: Extension Builder Skill Usage Guide

As an **extension creator**,
I want **to learn how to use the Extension Builder skill**,
So that **I can get AI assistance while developing extensions**.

**Acceptance Criteria:**

**Given** Extension Builder skill exists (deferred Epic 7)
**When** Extension Builder skill usage guide is created
**Then** guide explains how to activate the Extension Builder skill
**And** guide describes the skill's capabilities and limitations
**And** guide provides example conversations with the skill
**Then** guide shows how to request API guidance
**And** example conversation shows asking about tool registration
**And** example shows skill providing accurate API information
**Then** guide shows how to request code templates
**And** example shows skill generating extension boilerplate
**And** example shows skill generating specific tool code
**Then** guide shows how to get error diagnosis help
**And** example shows pasting error code and getting solutions
**And** example shows skill suggesting best practices
**Then** guide includes tips for effective skill usage
**And** guide describes how to provide context to the skill
**And** guide shows how to iterate on extensions through conversation (FR48)

### Story 6.12: LLM-Friendly Documentation Structure

As an **AI assistant or extension creator using AI**,
I want **documentation to be structured in an LLM-friendly format**,
So that **AI tools can understand and help with extension development**.

**Acceptance Criteria:**

**Given** extension documentation is being created
**When** documentation is structured for AI readability
**Then** documentation uses clear section headings with semantic meaning
**And** code examples are self-contained and complete
**And** examples include explanatory comments in the code
**Then** documentation includes structured metadata
**And** each API method has a summary paragraph for AI consumption
**And** parameters are documented with types and constraints in a machine-readable format
**Then** documentation includes concept summaries
**And** high-level overviews explain extension concepts before details
**And** relationship diagrams are described in text for AI understanding
**Then** documentation includes FAQ sections
**And** common questions are answered with complete examples
**And** troubleshooting guides follow step-by-step format
**And** documentation follows a consistent structure that AI can parse (FR49)

<!-- NOTE: Stories 4.3-4.7 and the FR Coverage Map section between 4.2 and 4.3 appear to be leftover content from Epic 4 cleanup. Based on the rewritten Epic 4 scope (state persistence removed, task/subtask API stories removed), these stories may need to be reviewed for removal or reorganization. -->

---

## Epic List

### Epic 1: Extension Installation & Discovery
**Goal:** Users can install, discover, and manage extensions in AiderDesk
**User Outcome:** A developer can download an extension, copy it to their extensions folder, restart AiderDesk, and see the extension loaded and ready to use
**FRs covered:** FR11, FR12, FR13, FR14, FR15

### Epic 2: Extension Development & Basic Tool Registration
**Goal:** Extension creators can write TypeScript code and register custom tools that agents can invoke
**User Outcome:** An extension creator writes a simple extension that registers a tool, saves it, and sees it available in agent's tool list
**FRs covered:** FR1, FR9, FR31, FR39, FR40

### Epic 3: Extension Event System Integration
**Goal:** Extensions can subscribe to system events and react to AiderDesk lifecycle events
**User Outcome:** An extension creator writes an extension that listens for agent completions, logs data, or modifies tool results in real-time
**FRs covered:** FR2, FR16, FR17, FR20, FR32

### Epic 4: Extension State, Task Integration & Settings
**Goal:** Extensions can persist state, create tasks, and access AiderDesk settings
**User Outcome:** An extension maintains a counter across sessions, creates tasks for specific workflows, and adapts behavior based on user's model configuration
**FRs covered:** FR5, FR6, FR7, FR8, FR10, FR21, FR22, FR23, FR24, FR35, FR36, FR37, FR38

### Epic 5: Extension UI Elements & User Interaction
**Goal:** Extensions can add buttons, dialogs, and notifications to AiderDesk UI
**User Outcome:** An extension adds a "Generate Jira Ticket" button to task sidebar that users can click to create tickets from their work
**FRs covered:** FR3, FR4, FR18, FR19, FR33, FR34

### Epic 6: Extension Documentation, Testing & Examples
**Goal:** Complete documentation, working examples, and WakaTime migration enable extension creators to build successfully
**User Outcome:** An extension creator references API documentation, studies working examples, and follows best practices to build a production-ready extension
**FRs covered:** FR41, FR42, FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50

---

## Requirements Inventory

### Functional Requirements

**Extension Development (FR1-FR10):**
FR1: Extension creators can register custom tools that agents and subagents can invoke during conversations
FR2: Extension creators can subscribe to system events including all hook events and new agent lifecycle events
FR3: Extension creators can register action buttons in the AiderDesk UI
FR4: Extension creators can create custom dialogs and modals for user interaction
FR5: Extension creators can create and manage tasks within AiderDesk's task system
FR6: Extension creators can create and manage subtasks within AiderDesk's task system
FR7: Extension creators can maintain persistent state that persists across AiderDesk sessions
FR8: Extension creators can read agent profiles and model configurations
FR9: Extension creators can write TypeScript code using the complete Extension API with full type safety
FR10: Extension creators can create multi-file extensions that import from other files

**Extension Installation & Discovery (FR11-FR15):**
FR11: Users can install extensions by copying TypeScript files to a global extensions directory
FR12: Users can install extensions by copying TypeScript files to a project-specific extensions directory
FR13: AiderDesk automatically discovers and loads extensions from both global and project directories on startup
FR14: Users can see which extensions are currently loaded and their status
FR15: Users can manually trigger extension reload during development

**Extension Execution (FR16-FR24):**
FR16: Agents can invoke tools registered by extensions during conversations
FR17: Extensions can modify tool results before they are returned to the agent
FR18: Extension action buttons appear in the appropriate UI contexts
FR19: Extension dialogs display when triggered by user actions or extension logic
FR20: Extension event handlers execute when subscribed system events occur
FR21: Extensions can create tasks that appear in AiderDesk's task management UI
FR22: Extensions can create subtasks within existing tasks
FR23: Extensions access their persistent state across AiderDesk sessions
FR24: Extensions read agent profiles and model configurations when needed

**Extension Builder Skill (FR25-FR30):**
FR25: Users can activate a dedicated Extension Builder skill within AiderDesk
FR26: Extension Builder skill provides API guidance and suggestions for extension development
FR27: Extension Builder skill generates TypeScript code templates for extension development
FR28: Extension Builder skill diagnoses errors in extension code
FR29: Extension Builder skill suggests improvements and best practices for extensions
FR30: Extension Builder skill helps users iterate on extensions through conversational interaction

**Extension API Capabilities (FR31-FR40):**
FR31: Extension API provides method for registering custom tools with defined parameters and return types
FR32: Extension API provides method for subscribing to system events
FR33: Extension API provides method for registering UI action buttons
FR34: Extension API provides method for creating custom dialogs and modals
FR35: Extension API provides method for creating tasks
FR36: Extension API provides method for creating subtasks
FR37: Extension API provides method for reading and writing persistent state
FR38: Extension API provides method for reading agent profiles and model configurations
FR39: Extension API provides complete TypeScript type definitions for all capabilities
FR40: Extension API runs extensions within appropriate Electron process contexts with IPC awareness

**Extension Documentation (FR41-FR50):**
FR41: Users can access complete API reference documentation with TypeScript type signatures
FR42: Documentation includes multiple working examples for tool registration
FR43: Documentation includes multiple working examples for event subscription
FR44: Documentation includes multiple working examples for UI element registration
FR45: Documentation includes multiple working examples for task and subtask creation
FR46: Documentation includes multiple working examples for state management
FR47: Documentation includes multiple working examples for settings access
FR48: Documentation includes usage guide for the Extension Builder skill
FR49: Documentation is formatted in LLM-friendly structure for AI-assisted development
FR50: Documentation extends the existing AiderDesk docs-site infrastructure

**Extension Security & Validation (FR51-FR56):**
FR51: AiderDesk type-checks extensions on load using TypeScript compiler API
FR52: AiderDesk validates extension API usage and security boundaries on load
FR53: AiderDesk handles malformed extensions with graceful error messages
FR54: Extensions execute in a sandboxed environment without direct file system access
FR55: Extensions cannot access privileged APIs without explicit permissions
FR56: AiderDesk validates extension operations against security policies during execution

### NonFunctional Requirements

**Performance (NFR1-NFR5):**
NFR1: Extension loading and initialization does not visibly delay AiderDesk startup time
NFR2: Extension tool invocation does not add noticeable latency to agent responses
NFR3: Extension event handlers execute without blocking main application thread
NFR4: Multiple extensions can run concurrently without degrading AiderDesk responsiveness
NFR5: Extension Builder skill provides responsive assistance without significant delays

**Reliability (NFR6-NFR10):**
NFR6: AiderDesk continues running normally when an extension encounters an error
NFR7: Extension errors are logged with sufficient context for debugging without disrupting user experience
NFR8: Malformed or invalid extensions are detected and reported without causing AiderDesk to crash
NFR9: Extension validation failures provide clear error messages to users
NFR10: Extension crashes are isolated and do not affect other extensions or AiderDesk core functionality

### Additional Requirements

**From Architecture - Extension Loading Mechanism (Critical Decision Required):**
- Extension loading mechanism must be selected from one of three options:
  - Option A: require() with TypeScript compilation
  - Option B: jiti (transpiled require) - pi-mono approach
  - Option C: Custom loader with eval()
- This decision blocks implementation and must be resolved before development

**From Architecture - Starter Template:**
- No starter template needed - Extension System builds upon existing AiderDesk architecture
- Existing systems provide foundation: HookManager, TaskManager, Agent System, Project Manager, IPC Layer, Settings Manager, UI Framework

**From Architecture - Integration Requirements:**
- Extension system must integrate with existing HookManager for co-existence strategy
- Extension system must integrate with existing TaskManager for task/subtask creation
- Extension system must integrate with existing Agent System for tool registration and invocation
- Extension system must use existing IPC layer for cross-process communication
- Extension system must integrate with existing SettingsManager for read-only settings access
- Extension system must integrate with existing React UI framework for UI element rendering

**From Architecture - Security Requirements:**
- Extensions must execute in sandboxed environment with no direct file system access
- Extensions must not access privileged APIs without explicit permissions
- Extensions must be type-checked on load using TypeScript compiler API
- Extensions must be validated against security policies during execution
- Extension errors must be isolated to prevent crashing AiderDesk core

**From Architecture - Communication Requirements:**
- Main process extensions communicate with renderer process via Electron IPC
- External clients communicate with extensions via REST API and Socket.io
- UI elements registered via IPC must be rendered in renderer process
- Real-time updates must be broadcast via Socket.io events

**From Architecture - Database Requirements:**
- Extension state must be persisted in SQLite database (.aider-desk/extensions.db)
- Database schema: extension_state table with extension_id, key, value, updated_at

**From Architecture - Documentation Requirements:**
- Documentation must extend existing docs-site infrastructure
- Documentation must include complete API reference with TypeScript type signatures
- Documentation must include multiple working examples for all major capabilities
- Documentation must be formatted in LLM-friendly structure for AI-assisted development

**From Architecture - Testing Requirements:**
- Tests must be co-located with implementation files
- Tests must use Vitest with React Testing Library for component tests
- Tests must be organized in __tests__/ directories

### FR Coverage Map

**Extension Development (FR1-FR10):**
FR1: Epic 2 - Register custom tools that agents can invoke
FR2: Epic 3 - Subscribe to system events
FR3: Epic 5 - Register action buttons in AiderDesk UI
FR4: Epic 5 - Create custom dialogs and modals
FR5: Epic 4 - Create and manage tasks
FR6: Epic 4 - Create and manage subtasks
FR7: Epic 4 - Maintain persistent state
FR8: Epic 4 - Read agent profiles and model configurations
FR9: Epic 2 - Write TypeScript with full type safety
FR10: Epic 4 - Create multi-file extensions with imports

**Extension Installation & Discovery (FR11-FR15):**
FR11: Epic 1 - Install to global extensions directory
FR12: Epic 1 - Install to project-specific extensions directory
FR13: Epic 1 - Auto-discovery and loading on startup
FR14: Epic 1 - View loaded extensions and their status
FR15: Epic 1 - Manually trigger extension reload

**Extension Execution (FR16-FR24):**
FR16: Epic 3 - Agents invoke extension tools
FR17: Epic 3 - Extensions modify tool results
FR18: Epic 5 - Action buttons appear in UI contexts
FR19: Epic 5 - Dialogs display when triggered
FR20: Epic 3 - Event handlers execute on subscribed events
FR21: Epic 4 - Extensions create tasks in task management UI
FR22: Epic 4 - Extensions create subtasks
FR23: Epic 4 - Extensions access persistent state
FR24: Epic 4 - Extensions read agent profiles and model configs

**Extension Builder Skill (FR25-FR30):**
FR25-FR30: Epic 7 (Deferred) - Extension Builder skill for AI-assisted development

**Extension API Capabilities (FR31-FR40):**
FR31: Epic 2 - Register custom tools with parameters
FR32: Epic 3 - Subscribe to system events
FR33: Epic 5 - Register UI action buttons
FR34: Epic 5 - Create custom dialogs and modals
FR35: Epic 4 - Create tasks via API
FR36: Epic 4 - Create subtasks via API
FR37: Epic 4 - Read and write persistent state
FR38: Epic 4 - Read agent profiles and model configs
FR39: Epic 6 - Complete TypeScript type definitions
FR40: Epic 6 - Extensions run in appropriate Electron contexts

**Extension Documentation (FR41-FR50):**
FR41: Epic 6 - Complete API reference with type signatures
FR42: Epic 6 - Examples for tool registration
FR43: Epic 6 - Examples for event subscription
FR44: Epic 6 - Examples for UI element registration
FR45: Epic 6 - Examples for task and subtask creation
FR46: Epic 6 - Examples for state management
FR47: Epic 6 - Examples for settings access
FR48: Epic 6 - Extension Builder skill usage guide
FR49: Epic 6 - LLM-friendly documentation structure
FR50: Epic 6 - Extend existing docs-site infrastructure

**Extension Security & Validation (FR51-FR56):**
FR51: Epic 1 - Type-check extensions on load
FR52: Epic 1 - Validate API usage and security boundaries
FR53: Epic 1 - Handle malformed extensions gracefully
FR54: Epic 1 - Sandboxed execution without file system access
FR55: Epic 1 - No privileged API access without permissions
FR56: Epic 1 - Validate operations against security policies

**Non-Functional Requirements:**
NFR1: Epic 1 - Extension loading doesn't delay startup
NFR2: Epic 3 - Tool invocation doesn't add latency
NFR3: Epic 3 - Event handlers don't block main thread
NFR4: Epic 3 - Multiple extensions run concurrently
NFR5: Epic 7 (Deferred) - Extension Builder provides responsive assistance
NFR6: Epic 1 - AiderDesk continues on extension errors
NFR7: Epic 1 - Extension errors logged with context
NFR8: Epic 1 - Malformed extensions detected without crashes
NFR9: Epic 1 - Validation failures show clear messages
NFR10: Epic 1 - Extension crashes are isolated

## Epic List
<!-- Epic definitions are documented above in the Requirements Inventory section -->

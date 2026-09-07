// Ambient type declarations for @aiderdesk/extensions (internal AiderDesk module)
// These types are minimal - just enough for the extension to type-check.
// At runtime, the actual module is provided by AiderDesk.
//
// IMPORTANT: This file mirrors the AiderDesk extension API. Source of truth:
//   <aider-desk repo>/packages/common/src/extensions.ts (0.80.0, verified identical through 0.81.0)
// Keep in sync on every AiderDesk major update - stale types give tsc false
// confidence and hide API drift (see Plan-aiderdesk-077-kompatibilitaet.md Task 2).
//
// Deliberately omitted (unused by this extension, available upstream since
// 0.78/0.79/0.80): tool/command/provider/skill registration, provider-strategy
// types, config-component hooks, openUrl/getMemoryContext/truncateToolResult,
// ElectronApp access and the ~30 additional event payloads.

declare module '@aiderdesk/extensions' {
  // NOTE: AiderDesk reads `metadata` from the extension CLASS itself (static
  // side), not from instances — see caveman/lsp/bmad extensions for the
  // canonical pattern (still valid in 0.80.0). Instance-side metadata is
  // ignored at runtime (extension then falls back to package.json name/version).
  export interface Extension {
    onLoad?(context: ExtensionContext): Promise<void> | void;
    /** Called when the extension is unloaded/disabled/uninstalled (0.80+: reliably invoked on toggle). */
    onUnload?(): void | Promise<void>;
    getModes?(context: ExtensionContext): ModeDefinition[];
    getAgents?(context: ExtensionContext): AgentProfile[];
    getUIComponents?(context: ExtensionContext): UIComponentDefinition[];
    onTaskUpdated?(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void | Partial<TaskUpdatedEvent>>;
    onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;
    onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;
    /** Called when a subagent starts. Set event.blocked = true to prevent subagent spawning. */
    onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;
    /** Called when a subagent finishes. Returned event can modify result messages. */
    onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void | Partial<SubagentFinishedEvent>>;
    executeUIExtensionAction?(componentId: string, action: string, args: unknown[], context: ExtensionContext): Promise<unknown>;
    getUIExtensionData?(componentId: string, context: ExtensionContext): Promise<unknown>;
  }

  export interface ExtensionMetadata {
    name: string;
    version: string;
    /** Optional since 0.80.0 (upstream), still recommended. */
    description?: string;
    /** Optional since 0.80.0 (upstream), still recommended. */
    author?: string;
    iconUrl?: string;
    capabilities?: string[];
  }

  /** Static side of an extension module — AiderDesk reads `metadata` from the class itself. */
  export interface ExtensionConstructor {
    new (): Extension;
    metadata: ExtensionMetadata;
  }

  export interface ExtensionContext {
    log(message: string, type?: 'debug' | 'info' | 'warn' | 'error'): void;
    /** Empty string when no project is open (0.77.0+; was `string | undefined` pre-0.76). */
    getProjectDir(): string;
    /** null when no task context is available (0.77.0+; was `undefined`). */
    getTaskContext(): TaskContext | null;
    /** Throws when no project context is available (0.77.0+; was `undefined`). */
    getProjectContext(): ProjectContext;
    /**
     * Register a setup function whose returned cleanup function runs when the
     * extension is unloaded (LIFO, async cleanups awaited). New in 0.80.0.
     */
    addDisposable(setup: () => (() => void | Promise<void>) | void): void;
    triggerUIDataRefresh(componentId?: string, taskId?: string): void;
    triggerUIComponentsReload(): void;
    openPath(path: string): Promise<boolean>;
  }

  export interface TaskContext {
    data: {
      id: string;
      parentId?: string;
      name?: string;
      currentMode?: string;
      metadata?: Record<string, unknown>;
    };
    getContextMessages(): Promise<ContextMessage[]>;
    loadContextMessages(messages: ContextMessage[]): Promise<void>;
    runPrompt(prompt: string, mode?: string): Promise<void>;
    // 0.77.0 signature, unchanged in 0.80.0: systemPrompt/waitForCurrentAgentToFinish/
    // sendNotification replaced the old positional provider/model/stream/isSubtask tail.
    // Provider/model overrides belong in the AgentProfile, not here.
    runPromptInAgent(
      profile: AgentProfile,
      mode: string,
      prompt: string | null,
      promptContext?: PromptContext,
      contextMessages?: ContextMessage[],
      contextFiles?: ContextFile[],
      systemPrompt?: string,
      waitForCurrentAgentToFinish?: boolean,
      sendNotification?: boolean,
    ): Promise<unknown[]>;
    addLoadingMessage(message?: string, finished?: boolean): void;
    updateTask(updates: Partial<TaskData>): Promise<TaskData>;
    getTaskAgentProfile(): Promise<AgentProfile | null>;
    /**
     * Spawn a subagent with the given profile and prompt within the current
     * task context. The profile is automatically marked as a subagent.
     * Dispatches the `onSubagentStarted` extension event (can be blocked).
     * Uses the task's context messages and files unless overridden.
     * Dispatches `onSubagentFinished` when complete.
     * 0.80.0: resolves with void (the result messages stay in the subtask).
     */
    runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;
  }

  export interface TaskData {
    id: string;
    parentId?: string;
    name?: string;
    currentMode?: string;
    /** Task state: 'TODO' | 'IN_PROGRESS' | 'INTERRUPTED' | 'DELEGATED' | 'MORE_INFO_NEEDED' | 'READY_FOR_REVIEW' | 'READY_FOR_IMPLEMENTATION' | 'DONE' */
    state?: string;
    metadata?: Record<string, unknown>;
  }

  export interface CreateTaskParams {
    parentId?: string | null;
    name?: string;
    autonomyMode?: string;
    activate?: boolean;
    handoff?: boolean;
    sendEvent?: boolean;
    provider?: string;
    model?: string;
    agentProfileId?: string;
    mode?: string;
    workingMode?: string;
    addInitialContextFiles?: boolean;
  }

  export interface ProjectContext {
    createTask(params: CreateTaskParams): Promise<TaskData>;
    /** null when the task is not loaded (0.80.0); earlier snapshots declared `undefined`. */
    getTask(taskId: string): TaskContext | null;
  }

  export interface ContextMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string | ContextMessagePart[];
    promptContext?: PromptContext;
  }

  export type ContextUserMessage = ContextMessage & { role: 'user' };

  export interface ContextMessagePart {
    type: 'text';
    text: string;
  }

  export interface PromptContext {
    id: string;
    group?: { id: string };
  }

  export interface ContextFile {
    path: string;
    readOnly: boolean;
  }

  export interface AgentProfile {
    id: string;
    projectDir?: string; // If specified, it's a project-level profile, otherwise global
    name: string;
    provider: string;
    model: string;
    maxIterations: number;
    maxTokens?: number; // overrides model maxOutputTokens when set
    minTimeBetweenToolCalls: number; // in milliseconds
    temperature?: number; // overrides model temperature when set
    enabledServers: string[];
    toolApprovals: Record<string, 'always' | 'ask' | 'never'>;
    toolSettings: Record<string, { allowedPattern: string; deniedPattern: string }>;
    includeContextFiles: boolean;
    includeRepoMap: boolean;
    usePowerTools: boolean;
    useAiderTools: boolean;
    useTodoTools: boolean;
    useSubagents: boolean;
    useTaskTools: boolean;
    useMemoryTools: boolean;
    useSkillsTools: boolean;
    useExtensionTools: boolean;
    disabledExtensionTools: string[]; // Array of extension IDs whose tools are disabled
    customInstructions: string;
    systemPrompt?: string; // overrides the default built-in system prompt as main agent; fallback for subagent runs
    enabledSubagentIds?: string[]; // profile IDs allowed as subagents; undefined = all subagents allowed
    subagent: {
      enabled: boolean;
      systemPrompt?: string;
      invocationMode: 'automatic' | 'on-demand';
      contextMemory: 'off' | 'last-message' | 'full-context';
      color: string;
      description: string;
    };
    isSubagent?: boolean; // runtime flag - never set it
    ruleFiles?: string[]; // absolute paths to rule files for this agent profile
    autoCompactThresholdPercentage?: number;
    autoCompactThresholdTokens?: number;
  }

  export interface ModeDefinition {
    name: string;
    label: string;
    description: string;
    icon: string;
  }

  export interface UIComponentDefinition {
    id: string;
    placement: string;
    /** Display name for the component (used as floating panel title, tooltip, etc.) */
    name?: string;
    jsx: string;
    loadData: boolean;
    noDataCache?: boolean;
  }

  export interface TaskUpdatedEvent {
    task: TaskData;
  }

  /** Runtime payload carries additional fields (prompt, agentProfile, model, ...) — we only consume these. */
  export interface AgentStartedEvent {
    mode: string;
    contextMessages: ContextMessage[];
  }

  export interface ToolApprovalEvent {
    readonly toolName: string;
    readonly input: Record<string, unknown> | undefined;
    /** Set to true (or a reason string) to prevent execution. */
    blocked?: boolean | string;
    allowed?: boolean;
  }

  /** Event payload for subagent started events (0.77.x+). */
  export interface SubagentStartedEvent {
    subagentProfile: AgentProfile;
    prompt: string;
    promptContext?: PromptContext;
    contextMessages: ContextMessage[];
    contextFiles: ContextFile[];
    systemPrompt?: string;
    blocked?: boolean;
  }

  /** Event payload for subagent finished events (0.77.x+). */
  export interface SubagentFinishedEvent {
    readonly subagentProfile: AgentProfile;
    resultMessages: ContextMessage[];
  }

  export interface BmadAction {
    actionLetter: string;
    actionName: string;
  }
}

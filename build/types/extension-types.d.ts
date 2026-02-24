import { z } from 'zod';

export type JSONValue = null | string | number | boolean | JSONObject | JSONArray;
export type JSONObject = {
	[key: string]: JSONValue;
};
export type JSONArray = JSONValue[];
export type DataContent = string | Uint8Array | ArrayBuffer | Buffer;
export type ToolResultOutput = {
	type: "text";
	value: string;
} | {
	type: "json";
	value: JSONValue;
} | {
	type: "error-text";
	value: string;
} | {
	type: "error-json";
	value: JSONValue;
} | {
	type: "content";
	value: Array<{
		type: "text";
		text: string;
	} | {
		type: "media";
		data: string;
		mediaType: string;
	}>;
};
export interface TextPart {
	type: "text";
	text: string;
}
export interface ImagePart {
	type: "image";
	image: DataContent | URL;
	mediaType?: string;
}
export interface FilePart {
	type: "file";
	data: DataContent | URL;
	filename?: string;
	mediaType: string;
}
export interface ReasoningPart {
	type: "reasoning";
	text: string;
}
export interface ToolCallPart {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	input: unknown;
}
export interface ToolResultPart {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	output: ToolResultOutput;
}
export type UserContent = string | Array<TextPart | ImagePart | FilePart>;
export type AssistantContent = string | Array<TextPart | FilePart | ReasoningPart | ToolCallPart | ToolResultPart>;
export type ToolContent = Array<ToolResultPart>;
export interface LocalizedString {
	key: string;
	params?: Record<string, unknown>;
}
export interface Group {
	id: string;
	name?: string | LocalizedString;
	color?: string;
	finished?: boolean;
	interruptId?: string;
}
export interface UsageReportData {
	model: string;
	sentTokens: number;
	receivedTokens: number;
	messageCost: number;
	cacheWriteTokens?: number;
	cacheReadTokens?: number;
	aiderTotalCost?: number;
	agentTotalCost?: number;
}
export interface PromptContext {
	id: string;
	group?: Group;
}
declare enum MessageRole {
	User = "user",
	Assistant = "assistant"
}
export interface BaseContextMessage {
	id: string;
	usageReport?: UsageReportData;
	promptContext?: PromptContext;
}
export interface ContextUserMessage extends BaseContextMessage {
	role: "user";
	content: UserContent;
}
export interface ContextAssistantMessage extends BaseContextMessage {
	role: "assistant";
	content: AssistantContent;
	reflectedMessage?: string;
	editedFiles?: string[];
	commitHash?: string;
	commitMessage?: string;
	diff?: string;
}
export interface ContextToolMessage extends BaseContextMessage {
	role: "tool";
	content: ToolContent;
}
export type ContextMessage = ContextUserMessage | ContextAssistantMessage | ContextToolMessage;
export interface ConnectorMessage {
	role: MessageRole;
	content: string;
}
export interface ContextFile {
	path: string;
	readOnly?: boolean;
	source?: "global-rule" | "project-rule" | "agent-rule";
}
declare enum ContextMemoryMode {
	Off = "off",
	FullContext = "full-context",
	LastMessage = "last-message"
}
export type Mode = "code" | "ask" | "architect" | "context" | "agent" | "bmad";
export interface ResponseChunkData {
	messageId: string;
	baseDir: string;
	taskId: string;
	chunk: string;
	reflectedMessage?: string;
	promptContext?: PromptContext;
}
export interface ResponseCompletedData {
	type: "response-completed";
	messageId: string;
	baseDir: string;
	taskId: string;
	content: string;
	reflectedMessage?: string;
	editedFiles?: string[];
	commitHash?: string;
	commitMessage?: string;
	diff?: string;
	usageReport?: UsageReportData;
	sequenceNumber?: number;
	promptContext?: PromptContext;
}
export interface Answer {
	text: string;
	shortkey: string;
}
export interface QuestionData {
	baseDir: string;
	taskId: string;
	text: string;
	subject?: string;
	isGroupQuestion?: boolean;
	answers?: Answer[];
	defaultAnswer: string;
	internal?: boolean;
	key?: string;
}
declare enum ToolApprovalState {
	Always = "always",
	Never = "never",
	Ask = "ask"
}
declare enum InvocationMode {
	OnDemand = "on-demand",
	Automatic = "automatic"
}
export interface SubagentConfig {
	enabled: boolean;
	contextMemory: ContextMemoryMode;
	systemPrompt: string;
	invocationMode: InvocationMode;
	color: string;
	description: string;
}
export interface BashToolSettings {
	allowedPattern: string;
	deniedPattern: string;
}
export type ToolSettings = BashToolSettings;
export interface AgentProfile {
	id: string;
	projectDir?: string;
	name: string;
	provider: string;
	model: string;
	maxIterations: number;
	maxTokens?: number;
	minTimeBetweenToolCalls: number;
	temperature?: number;
	enabledServers: string[];
	toolApprovals: Record<string, ToolApprovalState>;
	toolSettings: Record<string, ToolSettings>;
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
	customInstructions: string;
	subagent: SubagentConfig;
	isSubagent?: boolean;
	ruleFiles?: string[];
}
declare const TaskDataSchema: z.ZodObject<{
	id: z.ZodString;
	baseDir: z.ZodString;
	parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
	name: z.ZodString;
	state: z.ZodOptional<z.ZodString>;
	archived: z.ZodOptional<z.ZodBoolean>;
	pinned: z.ZodOptional<z.ZodBoolean>;
	createdAt: z.ZodOptional<z.ZodString>;
	updatedAt: z.ZodOptional<z.ZodString>;
	startedAt: z.ZodOptional<z.ZodString>;
	interruptedAt: z.ZodOptional<z.ZodString>;
	completedAt: z.ZodOptional<z.ZodString>;
	worktree: z.ZodOptional<z.ZodObject<{
		path: z.ZodString;
		baseBranch: z.ZodOptional<z.ZodString>;
		baseCommit: z.ZodOptional<z.ZodString>;
		prunable: z.ZodOptional<z.ZodBoolean>;
	}, z.core.$strip>>;
	workingMode: z.ZodOptional<z.ZodEnum<{
		local: "local";
		worktree: "worktree";
	}>>;
	lastMergeState: z.ZodOptional<z.ZodObject<{
		beforeMergeCommitHash: z.ZodString;
		worktreeBranchCommitHash: z.ZodString;
		mainOriginalStashId: z.ZodOptional<z.ZodString>;
		targetBranch: z.ZodOptional<z.ZodString>;
		timestamp: z.ZodNumber;
	}, z.core.$strip>>;
	aiderTotalCost: z.ZodNumber;
	agentTotalCost: z.ZodNumber;
	autoApprove: z.ZodOptional<z.ZodBoolean>;
	agentProfileId: z.ZodOptional<z.ZodString>;
	provider: z.ZodOptional<z.ZodString>;
	model: z.ZodOptional<z.ZodString>;
	mainModel: z.ZodString;
	weakModel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
	architectModel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
	reasoningEffort: z.ZodOptional<z.ZodString>;
	thinkingTokens: z.ZodOptional<z.ZodString>;
	currentMode: z.ZodOptional<z.ZodEnum<{
		code: "code";
		ask: "ask";
		architect: "architect";
		context: "context";
		agent: "agent";
		bmad: "bmad";
	}>>;
	contextCompactingThreshold: z.ZodOptional<z.ZodNumber>;
	weakModelLocked: z.ZodOptional<z.ZodBoolean>;
	handoff: z.ZodOptional<z.ZodBoolean>;
	lastAgentProviderMetadata: z.ZodOptional<z.ZodUnknown>;
	metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type TaskData = z.infer<typeof TaskDataSchema>;
export interface CreateTaskParams {
	parentId?: string | null;
	name?: string;
	autoApprove?: boolean;
	activate?: boolean;
	handoff?: boolean;
	sendEvent?: boolean;
	provider?: string;
	model?: string;
}
export interface Model {
	id: string;
	providerId: string;
	maxInputTokens?: number;
	maxOutputTokens?: number;
	maxOutputTokensLimit?: number;
	temperature?: number;
	inputCostPerToken?: number;
	outputCostPerToken?: number;
	cacheWriteInputTokenCost?: number;
	cacheReadInputTokenCost?: number;
	supportsTools?: boolean;
	isCustom?: boolean;
	isHidden?: boolean;
	hasModelOverrides?: boolean;
	providerOverrides?: Record<string, unknown>;
}
export interface CustomCommandArgument {
	description: string;
	required?: boolean;
}
export interface CustomCommand {
	name: string;
	description: string;
	arguments: CustomCommandArgument[];
	template: string;
	includeContext?: boolean;
	autoApprove?: boolean;
}
export type AgentStepResult = unknown;
/**
 * Metadata describing an extension
 */
export interface ExtensionMetadata {
	/** Extension name (displayed in UI) */
	name: string;
	/** Semantic version (e.g., "1.0.0") */
	version: string;
	/** Brief description of extension functionality */
	description: string;
	/** Author name or organization */
	author: string;
	/** Optional list of extension capabilities (e.g., ["tools", "ui-elements"]) */
	capabilities?: string[];
}
/**
 * Result returned by tool execution
 */
export interface ToolResult {
	/** Content array with text or image data */
	content: Array<{
		type: "text";
		text: string;
	} | {
		type: "image";
		source: unknown;
	}>;
	/** Additional metadata for extensions */
	details?: Record<string, unknown>;
	/** Mark result as error */
	isError?: boolean;
}
/**
 * Definition of a tool that can be registered by an extension
 *
 * @example
 * ```typescript
 * const myTool: ToolDefinition = {
 *   name: 'run-linter',
 *   description: 'Run the project linter',
 *   parameters: z.object({
 *     fix: z.boolean().optional().describe('Auto-fix issues'),
 *   }),
 *   async execute(input, signal, context) {
 *     const output = await runLinter(input.fix);
 *     return output;
 *   },
 * };
 * ```
 */
export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType<Record<string, unknown>>> {
	/** Tool identifier in kebab-case (e.g., 'run-linter') */
	name: string;
	/** Description for LLM to understand tool purpose */
	description: string;
	/** Zod schema for parameter validation */
	inputSchema: TSchema;
	/** Execute function with type-safe args */
	execute: (input: z.infer<TSchema>, signal: AbortSignal | undefined, context: ExtensionContext) => Promise<unknown>;
}
/** UI element types */
export type UIElementType = "action-button" | "status-indicator" | "badge";
/** Placement locations for UI elements */
export declare enum UIPlacement {
	/** Task sidebar area */
	TaskSidebar = "task-sidebar",
	/** Chat toolbar area */
	ChatToolbar = "chat-toolbar",
	/** Message action buttons */
	MessageActions = "message-actions",
	/** Global toolbar */
	GlobalToolbar = "global-toolbar"
}
/**
 * Definition of a UI element that can be registered by an extension
 *
 * @example
 * ```typescript
 * const myButton: UIElementDefinition = {
 *   id: 'generate-jira-ticket',
 *   type: 'action-button',
 *   label: 'Create JIRA Ticket',
 *   icon: 'FiExternalLink',
 *   description: 'Create a JIRA ticket from this task',
 *   placement: UIPlacement.TaskSidebar,
 *   context: 'task',
 *   onClick: 'handleJiraClick',
 * };
 * ```
 */
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
	context?: "task" | "project" | "global";
	/** Handler ID to call in extension when clicked */
	onClick: string;
	/** Optional: Conditional visibility check */
	enabled?: (context: unknown) => boolean;
}
/** Event payload for task creation events */
export interface TaskCreatedEvent {
	task: TaskData;
}
/** Event payload for task prepared events */
export interface TaskPreparedEvent {
	task: TaskData;
}
/** Event payload for task initialization events */
export interface TaskInitializedEvent {
	readonly task: TaskData;
}
/** Event payload for task closed events */
export interface TaskClosedEvent {
	readonly task: TaskData;
}
/** Event payload for prompt started events */
export interface PromptStartedEvent {
	prompt: string;
	mode: Mode;
	promptContext: PromptContext;
	blocked?: boolean;
}
/** Event payload for prompt finished events */
export interface PromptFinishedEvent {
	responses: ResponseCompletedData[];
}
/** Event payload for agent started events */
export interface AgentStartedEvent {
	agentProfile: AgentProfile;
	prompt: string | null;
	promptContext?: PromptContext;
	systemPrompt: string | undefined;
	contextMessages: ContextMessage[];
	contextFiles: ContextFile[];
	blocked?: boolean;
}
/** Event payload for agent finished events */
export interface AgentFinishedEvent {
	readonly aborted: boolean;
	readonly contextMessages: ContextMessage[];
	resultMessages: ContextMessage[];
}
/** Event payload for agent step finished events */
export interface AgentStepFinishedEvent {
	readonly agentProfile: AgentProfile;
	readonly currentResponseId: string;
	readonly stepResult: AgentStepResult;
	finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other" | "unknown";
	responseMessages: ContextMessage[];
}
/** Event payload for tool approval events */
export interface ToolApprovalEvent {
	readonly toolName: string;
	readonly input: Record<string, unknown> | undefined;
	blocked?: boolean;
	allowed?: boolean;
}
/** Event payload for tool called events */
export interface ToolCalledEvent {
	readonly toolName: string;
	input: Record<string, unknown> | undefined;
	output?: unknown;
}
/** Event payload for tool finished events */
export interface ToolFinishedEvent {
	readonly toolName: string;
	readonly input: Record<string, unknown> | undefined;
	output: unknown;
}
/** Event payload for files added events */
export interface FilesAddedEvent {
	files: ContextFile[];
}
/** Event payload for files dropped events */
export interface FilesDroppedEvent {
	files: ContextFile[];
}
/** Event payload for response message processed events */
export interface ResponseChunkEvent {
	chunk: ResponseChunkData;
}
export interface ResponseCompletedEvent {
	response: ResponseCompletedData;
}
export interface HandleApprovalEvent {
	key: string;
	text: string;
	subject?: string;
	blocked?: boolean;
	allowed?: boolean;
}
/** Event payload for subagent started events */
export interface SubagentStartedEvent {
	subagentProfile: AgentProfile;
	prompt: string;
	promptContext?: PromptContext;
	contextMessages: ContextMessage[];
	contextFiles: ContextFile[];
	systemPrompt?: string;
	blocked?: boolean;
}
/** Event payload for subagent finished events */
export interface SubagentFinishedEvent {
	readonly subagentProfile: AgentProfile;
	resultMessages: ContextMessage[];
}
/** Event payload for question asked events */
export interface QuestionAskedEvent {
	question: QuestionData;
	answer?: string;
}
/** Event payload for question answered events */
export interface QuestionAnsweredEvent {
	readonly question: QuestionData;
	answer: string;
	userInput?: string;
}
/** Event payload for command executed events */
export interface CommandExecutedEvent {
	command: string;
	blocked?: boolean;
}
/** Event payload for custom command executed events */
export interface CustomCommandExecutedEvent {
	command: CustomCommand;
	mode: Mode;
	blocked?: boolean;
	prompt?: string;
}
/** Event payload for aider prompt started events */
export interface AiderPromptStartedEvent {
	prompt: string;
	mode: Mode;
	promptContext: PromptContext;
	messages: ConnectorMessage[];
	files: ContextFile[];
	blocked?: boolean;
	autoApprove?: boolean;
	denyCommands?: boolean;
}
/** Event payload for aider prompt finished events */
export interface AiderPromptFinishedEvent {
	responses: ResponseCompletedData[];
}
/**
 * Context object passed to extension methods providing access to AiderDesk APIs
 *
 * @example
 * ```typescript
 * async onLoad(context: ExtensionContext) {
 *   const task = context.getCurrentTask();
 *   const state = await context.getState('my-key');
 *   context.log('Extension loaded', 'info');
 * }
 * ```
 */
export interface ExtensionContext {
	/**
	 * Log a message to the AiderDesk console
	 * @param message - Message to log
	 * @param type - Log level (info, error, warn, debug)
	 */
	log(message: string, type?: "info" | "error" | "warn" | "debug"): void;
	/**
	 * Get the current project directory path
	 * @returns Absolute path to the project directory
	 */
	getProjectDir(): string;
	/**
	 * Get the currently active task
	 * @returns Current task data or null if no task is active
	 */
	getCurrentTask(): TaskData | null;
	/**
	 * Create a new task
	 * @param name - Task name/title
	 * @param params - Optional task parameters (parentId, autoApprove, etc.)
	 * @returns Promise resolving to the new task ID
	 */
	createTask(name: string, params?: CreateTaskParams): Promise<string>;
	/**
	 * Get all available agent profiles
	 * @returns Promise resolving to array of agent profiles
	 */
	getAgentProfiles(): Promise<AgentProfile[]>;
	/**
	 * Get all available model configurations
	 * @returns Promise resolving to array of models
	 */
	getModelConfigs(): Promise<Model[]>;
	/**
	 * Get a specific setting value
	 * @param key - Setting key (dot-notation supported, e.g., 'general.theme')
	 * @returns Promise resolving to the setting value
	 */
	getSetting(key: string): Promise<unknown>;
	/**
	 * Update multiple settings at once
	 * @param updates - Partial settings object with updates
	 * @returns Promise that resolves when settings are saved
	 */
	updateSettings(updates: Record<string, unknown>): Promise<void>;
	/**
	 * Show a notification to the user
	 * @param message - Notification message
	 * @param type - Notification type (info, warning, error)
	 * @returns Promise that resolves when notification is shown
	 */
	showNotification(message: string, type?: "info" | "warning" | "error"): Promise<void>;
	/**
	 * Show a confirmation dialog to the user
	 * @param message - Confirmation message
	 * @param confirmText - Custom confirm button text
	 * @param cancelText - Custom cancel button text
	 * @returns Promise resolving to true if confirmed, false otherwise
	 */
	showConfirm(message: string, confirmText?: string, cancelText?: string): Promise<boolean>;
	/**
	 * Show an input dialog to the user
	 * @param prompt - Input prompt/message
	 * @param placeholder - Input placeholder text
	 * @param defaultValue - Default input value
	 * @returns Promise resolving to the user input or undefined if cancelled
	 */
	showInput(prompt: string, placeholder?: string, defaultValue?: string): Promise<string | undefined>;
}
/**
 * Main extension interface that all extensions must implement
 *
 * All methods are optional - implement only what you need.
 * Event handlers can return void or a partial event to modify the event data.
 *
 * @example
 * ```typescript
 * class MyExtension implements Extension {
 *   async onLoad(context: ExtensionContext) {
 *     this.context = context;
 *     context.log('My extension loaded!', 'info');
 *   }
 *
 *   getTools(): ToolDefinition[] {
 *     return [{
 *       name: 'my-tool',
 *       description: 'My custom tool',
 *       parameters: z.object({ input: z.string() }),
 *       async execute(args, signal, context) {
 *         return { content: [{ type: 'text', text: args.input }] };
 *       },
 *     }];
 *   }
 *
 *   async onPromptSubmitted(event: PromptSubmittedEvent, context: ExtensionContext) {
 *     context.log(`Prompt: ${event.prompt}`, 'debug');
 *   }
 * }
 * ```
 */
export interface Extension {
	/**
	 * Called when extension is loaded
	 * Use this to initialize your extension, set up state, etc.
	 */
	onLoad?(context: ExtensionContext): void | Promise<void>;
	/**
	 * Called when extension is unloaded
	 * Clean up resources, save state, etc.
	 */
	onUnload?(): void | Promise<void>;
	/**
	 * Return array of tools this extension provides
	 * Called when extension is loaded and when tools need to be refreshed
	 */
	getTools?(): ToolDefinition[];
	/**
	 * Return array of UI elements this extension provides
	 * Called when extension is loaded and when UI needs to be refreshed
	 */
	getUIElements?(): UIElementDefinition[];
	/**
	 * Called when a new task is created
	 * @returns void or partial event to modify task data
	 */
	onTaskCreated?(event: TaskCreatedEvent, context: ExtensionContext): Promise<void | Partial<TaskCreatedEvent>>;
	/**
	 * Called when a task is prepared (both new and loaded tasks)
	 * @returns void or partial event to modify task data
	 */
	onTaskPrepared?(event: TaskPreparedEvent, context: ExtensionContext): Promise<void | Partial<TaskPreparedEvent>>;
	/**
	 * Called when a task is initialized and ready for use
	 * @returns void or partial event to modify task data
	 */
	onTaskInitialized?(event: TaskInitializedEvent, context: ExtensionContext): Promise<void | Partial<TaskInitializedEvent>>;
	/**
	 * Called when a task is closed
	 * @returns void or partial event to modify task data
	 */
	onTaskClosed?(event: TaskClosedEvent, context: ExtensionContext): Promise<void | Partial<TaskClosedEvent>>;
	/**
	 * Called when prompt processing starts
	 * @returns void or partial event to modify
	 */
	onPromptStarted?(event: PromptStartedEvent, context: ExtensionContext): Promise<void | Partial<PromptStartedEvent>>;
	/**
	 * Called when prompt processing finishes
	 * @returns void or partial event to modify
	 */
	onPromptFinished?(event: PromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<PromptFinishedEvent>>;
	/**
	 * Called when agent mode starts
	 * @returns void or partial event to modify prompt
	 */
	onAgentStarted?(event: AgentStartedEvent, context: ExtensionContext): Promise<void | Partial<AgentStartedEvent>>;
	/**
	 * Called when agent mode finishes
	 * @returns void or partial event to modify result messages
	 */
	onAgentFinished?(event: AgentFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentFinishedEvent>>;
	/**
	 * Called after each agent step completes
	 * @returns void or partial event
	 */
	onAgentStepFinished?(event: AgentStepFinishedEvent, context: ExtensionContext): Promise<void | Partial<AgentStepFinishedEvent>>;
	/**
	 * Called when a tool requires approval
	 * Set event.blocked = true to prevent execution
	 * @returns void or partial event to modify approval behavior
	 */
	onToolApproval?(event: ToolApprovalEvent, context: ExtensionContext): Promise<void | Partial<ToolApprovalEvent>>;
	/**
	 * Called when a tool is about to be executed
	 * Set event.blocked = true to prevent execution
	 * @returns void or partial event to modify tool call
	 */
	onToolCalled?(event: ToolCalledEvent, context: ExtensionContext): Promise<void | Partial<ToolCalledEvent>>;
	/**
	 * Called after tool execution completes
	 * Use modifiedResult to change the result
	 * @returns void or partial event to modify result
	 */
	onToolFinished?(event: ToolFinishedEvent, context: ExtensionContext): Promise<void | Partial<ToolFinishedEvent>>;
	/**
	 * Called when files are added to context
	 * Modify event.files to filter, add, or clear files (return empty array to prevent addition)
	 * @returns void or partial event to modify files
	 */
	onFilesAdded?(event: FilesAddedEvent, context: ExtensionContext): Promise<void | Partial<FilesAddedEvent>>;
	/**
	 * Called when files are dropped into the chat
	 * Modify event.files to filter, add, or clear files (return empty array to prevent addition)
	 * @returns void or partial event to modify files
	 */
	onFilesDropped?(event: FilesDroppedEvent, context: ExtensionContext): Promise<void | Partial<FilesDroppedEvent>>;
	/**
	 * Called on each response chunk
	 * @returns void or partial event to modify message
	 */
	onResponseChunk?(event: ResponseChunkEvent, context: ExtensionContext): Promise<void | Partial<ResponseChunkEvent>>;
	/**
	 * Called on response completion
	 * @returns void or partial event to modify message
	 */
	onResponseCompleted?(event: ResponseCompletedEvent, context: ExtensionContext): Promise<void | Partial<ResponseCompletedEvent>>;
	/**
	 * Called when handling user approval requests
	 * Set event.blocked = true to prevent approval handling
	 * @returns void or partial event to modify approval
	 */
	onHandleApproval?(event: HandleApprovalEvent, context: ExtensionContext): Promise<void | Partial<HandleApprovalEvent>>;
	/**
	 * Called when a subagent starts
	 * Set event.blocked = true to prevent subagent spawning
	 * @returns void or partial event to modify prompt
	 */
	onSubagentStarted?(event: SubagentStartedEvent, context: ExtensionContext): Promise<void | Partial<SubagentStartedEvent>>;
	/**
	 * Called when a subagent finishes
	 * @returns void or partial event to modify result
	 */
	onSubagentFinished?(event: SubagentFinishedEvent, context: ExtensionContext): Promise<void | Partial<SubagentFinishedEvent>>;
	/**
	 * Called when a question is asked to the user
	 * @returns void or partial event to modify question
	 */
	onQuestionAsked?(event: QuestionAskedEvent, context: ExtensionContext): Promise<void | Partial<QuestionAskedEvent>>;
	/**
	 * Called when user answers a question
	 * @returns void or partial event to modify answer
	 */
	onQuestionAnswered?(event: QuestionAnsweredEvent, context: ExtensionContext): Promise<void | Partial<QuestionAnsweredEvent>>;
	/**
	 * Called when a slash command is executed
	 * @returns void or partial event to modify command
	 */
	onCommandExecuted?(event: CommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CommandExecutedEvent>>;
	/**
	 * Called when a custom command is executed
	 * Set event.blocked = true to prevent execution
	 * Set event.prompt to override the processed template
	 * @returns void or partial event to modify command execution
	 */
	onCustomCommandExecuted?(event: CustomCommandExecutedEvent, context: ExtensionContext): Promise<void | Partial<CustomCommandExecutedEvent>>;
	/**
	 * Called when Aider prompt starts (legacy event)
	 * @returns void or partial event to modify prompt
	 */
	onAiderPromptStarted?(event: AiderPromptStartedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptStartedEvent>>;
	/**
	 * Called when Aider prompt finishes (legacy event)
	 * @returns void or partial event to modify responses
	 */
	onAiderPromptFinished?(event: AiderPromptFinishedEvent, context: ExtensionContext): Promise<void | Partial<AiderPromptFinishedEvent>>;
}
/**
 * Constructor type for extension classes
 */
export interface ExtensionConstructor {
	new (): Extension;
	metadata?: ExtensionMetadata;
}

export {};

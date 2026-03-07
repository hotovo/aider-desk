import { z } from 'zod';

export type LlmProviderName = "anthropic" | "anthropic-compatible" | "azure" | "bedrock" | "cerebras" | "claude-agent-sdk" | "deepseek" | "gemini" | "gemini-cli" | "gpustack" | "groq" | "alibaba-plan" | "kimi-plan" | "litellm" | "lmstudio" | "minimax" | "ollama" | "openai" | "openai-compatible" | "opencode" | "openrouter" | "requesty" | "synthetic" | "vertex-ai" | "zai-plan";
export interface LlmProviderBase {
	name: LlmProviderName;
	disableStreaming?: boolean;
	voiceEnabled?: boolean;
}
export interface VoiceControlSettings {
	idleTimeoutMs: number;
	systemInstructions: string;
}
export interface OllamaProvider extends LlmProviderBase {
	name: "ollama";
	baseUrl: string;
}
declare enum OpenAiVoiceModel {
	Gpt4oMiniTranscribe = "gpt-4o-mini-transcribe",
	Gpt4oTranscribe = "gpt-4o-transcribe"
}
export interface OpenAiVoiceControlSettings extends VoiceControlSettings {
	model: OpenAiVoiceModel;
	language: string;
}
export interface OpenAiProvider extends LlmProviderBase {
	name: "openai";
	apiKey: string;
	reasoningEffort?: ReasoningEffort;
	useWebSearch: boolean;
	voice?: Partial<OpenAiVoiceControlSettings>;
}
export interface AzureProvider extends LlmProviderBase {
	name: "azure";
	apiKey: string;
	resourceName: string;
	apiVersion?: string;
	reasoningEffort?: ReasoningEffort;
}
export interface AnthropicProvider extends LlmProviderBase {
	name: "anthropic";
	apiKey: string;
}
export interface AnthropicCompatibleProvider extends LlmProviderBase {
	name: "anthropic-compatible";
	apiKey: string;
	baseUrl?: string;
}
export interface KimiPlanProvider extends LlmProviderBase {
	name: "kimi-plan";
	apiKey: string;
}
export interface AlibabaPlanProvider extends LlmProviderBase {
	name: "alibaba-plan";
	apiKey: string;
}
declare enum GeminiVoiceModel {
	GeminiLive25FlashNativeAudio = "gemini-2.5-flash-native-audio-preview-12-2025"
}
export interface GeminiVoiceControlSettings extends VoiceControlSettings {
	model: GeminiVoiceModel;
	temperature: number;
}
export interface GeminiProvider extends LlmProviderBase {
	name: "gemini";
	apiKey: string;
	customBaseUrl?: string;
	includeThoughts: boolean;
	thinkingBudget: number;
	useSearchGrounding: boolean;
	voice?: Partial<GeminiVoiceControlSettings>;
}
export interface VertexAiProvider extends LlmProviderBase {
	name: "vertex-ai";
	project: string;
	location: string;
	googleCloudCredentialsJson?: string;
	includeThoughts: boolean;
	thinkingBudget: number;
}
export interface LmStudioProvider extends LlmProviderBase {
	name: "lmstudio";
	baseUrl: string;
}
export interface DeepseekProvider extends LlmProviderBase {
	name: "deepseek";
	apiKey: string;
}
export interface GroqProvider extends LlmProviderBase {
	name: "groq";
	apiKey: string;
}
export interface CerebrasProvider extends LlmProviderBase {
	name: "cerebras";
	apiKey: string;
}
export interface ClaudeAgentSdkProvider extends LlmProviderBase {
	name: "claude-agent-sdk";
	systemPrompt?: string;
	mcpServers?: Record<string, unknown>;
}
export interface GeminiCliProvider extends LlmProviderBase {
	name: "gemini-cli";
	projectId?: string;
}
export interface BedrockProvider extends LlmProviderBase {
	name: "bedrock";
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
	sessionToken?: string;
}
export interface OpenAiCompatibleProvider extends LlmProviderBase {
	name: "openai-compatible";
	apiKey: string;
	baseUrl?: string;
	reasoningEffort?: ReasoningEffort;
}
export interface LitellmProvider extends LlmProviderBase {
	name: "litellm";
	apiKey: string;
	baseUrl: string;
}
export interface GpustackProvider extends LlmProviderBase {
	name: "gpustack";
	apiKey?: string;
	baseUrl?: string;
}
export interface OpenRouterProvider extends LlmProviderBase {
	name: "openrouter";
	apiKey: string;
	requireParameters: boolean;
	order: string[];
	only: string[];
	ignore: string[];
	allowFallbacks: boolean;
	dataCollection: "allow" | "deny";
	quantizations: string[];
	sort: "price" | "throughput" | null;
}
export interface RequestyProvider extends LlmProviderBase {
	name: "requesty";
	apiKey: string;
	useAutoCache: boolean;
	reasoningEffort: ReasoningEffort;
}
export interface OpenCodeProvider extends LlmProviderBase {
	name: "opencode";
	apiKey: string;
}
export interface ZaiPlanProvider extends LlmProviderBase {
	name: "zai-plan";
	apiKey: string;
	thinkingEnabled?: boolean;
}
export interface MinimaxProvider extends LlmProviderBase {
	name: "minimax";
	apiKey: string;
}
export interface SyntheticProvider extends LlmProviderBase {
	name: "synthetic";
	apiKey: string;
}
export type LlmProvider = OpenAiProvider | AnthropicProvider | AnthropicCompatibleProvider | AzureProvider | GeminiProvider | GeminiCliProvider | VertexAiProvider | LmStudioProvider | BedrockProvider | ClaudeAgentSdkProvider | DeepseekProvider | GroqProvider | GpustackProvider | CerebrasProvider | AlibabaPlanProvider | KimiPlanProvider | OpenAiCompatibleProvider | LitellmProvider | OllamaProvider | OpenCodeProvider | OpenRouterProvider | RequestyProvider | SyntheticProvider | ZaiPlanProvider | MinimaxProvider;
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
export declare enum ContextMemoryMode {
	Off = "off",
	FullContext = "full-context",
	LastMessage = "last-message"
}
export interface ModeDefinition {
	name: Mode;
	label: string;
	description?: string;
	/** Icon name from react-icons (e.g., 'GoCodeReview', 'FiLayers') */
	icon?: string;
}
export type Mode = string;
declare enum DiffViewMode {
	SideBySide = "side-by-side",
	Unified = "unified",
	Compact = "compact"
}
declare enum MessageViewMode {
	Full = "full",
	Compact = "compact"
}
declare enum ReasoningEffort {
	XHigh = "xhigh",
	High = "high",
	Medium = "medium",
	Low = "low",
	Minimal = "minimal",
	None = "none"
}
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
export interface UpdatedFile {
	path: string;
	additions: number;
	deletions: number;
	diff?: string;
}
export interface CommandsData {
	baseDir: string;
	customCommands: Command[];
	extensionCommands: Command[];
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
export interface QueuedPromptData {
	id: string;
	text: string;
	mode: Mode;
	timestamp: number;
}
declare const ProjectSettingsSchema: z.ZodObject<{
	mainModel: z.ZodString;
	weakModel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
	architectModel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
	agentProfileId: z.ZodString;
	modelEditFormats: z.ZodRecord<z.ZodString, z.ZodEnum<{
		diff: "diff";
		"diff-fenced": "diff-fenced";
		whole: "whole";
		udiff: "udiff";
		"udiff-simple": "udiff-simple";
		patch: "patch";
	}>>;
	reasoningEffort: z.ZodOptional<z.ZodString>;
	thinkingTokens: z.ZodOptional<z.ZodString>;
	currentMode: z.ZodString;
	contextCompactingThreshold: z.ZodOptional<z.ZodNumber>;
	weakModelLocked: z.ZodOptional<z.ZodBoolean>;
	autoApproveLocked: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export declare enum ToolApprovalState {
	Always = "always",
	Never = "never",
	Ask = "ask"
}
declare enum ProjectStartMode {
	Empty = "empty",
	Last = "last",
	Remote = "remote"
}
declare enum SuggestionMode {
	Automatically = "automatically",
	OnTab = "onTab",
	MentionAtSign = "mentionAtSign"
}
export interface PromptBehavior {
	suggestionMode: SuggestionMode;
	suggestionDelay: number;
	requireCommandConfirmation: {
		add: boolean;
		readOnly: boolean;
		model: boolean;
		modeSwitching: boolean;
	};
	useVimBindings: boolean;
}
export declare enum InvocationMode {
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
declare const THEMES: readonly [
	"dark",
	"light",
	"charcoal",
	"neon",
	"neopunk",
	"aurora",
	"ocean",
	"forest",
	"lavender",
	"bw",
	"midnight",
	"serenity",
	"cappuccino",
	"fresh",
	"botanical-garden",
	"botanical-garden-dark"
];
export type Theme = (typeof THEMES)[number];
declare const FONTS: readonly [
	"Sono",
	"Poppins",
	"Nunito",
	"Quicksand",
	"PlayfairDisplay",
	"Lora",
	"SpaceGrotesk",
	"Orbitron",
	"Enriqueta",
	"FunnelDisplay",
	"GoogleSansCode",
	"Inter",
	"JetBrainsMono",
	"RobotoMono",
	"Sansation",
	"Silkscreen",
	"SourceCodePro",
	"SpaceMono",
	"UbuntuMono"
];
export type Font = (typeof FONTS)[number];
export interface HotkeyConfig {
	projectHotkeys: {
		closeProject: string;
		newProject: string;
		usageDashboard: string;
		modelLibrary: string;
		settings: string;
		cycleNextProject: string;
		cyclePrevProject: string;
		switchProject1: string;
		switchProject2: string;
		switchProject3: string;
		switchProject4: string;
		switchProject5: string;
		switchProject6: string;
		switchProject7: string;
		switchProject8: string;
		switchProject9: string;
	};
	taskHotkeys: {
		switchTask1: string;
		switchTask2: string;
		switchTask3: string;
		switchTask4: string;
		switchTask5: string;
		switchTask6: string;
		switchTask7: string;
		switchTask8: string;
		switchTask9: string;
		focusPrompt: string;
		newTask: string;
		closeTask: string;
	};
	dialogHotkeys: {
		browseFolder: string;
	};
}
declare enum MemoryEmbeddingProvider {
	SentenceTransformers = "sentence-transformers"
}
declare enum ContextCompactionType {
	Compact = "compact",
	Handoff = "handoff"
}
export interface TaskSettings {
	smartTaskState: boolean;
	autoGenerateTaskName: boolean;
	showTaskStateActions: boolean;
	worktreeSymlinkFolders: string[];
	contextCompactingThreshold: number;
	contextCompactionType: ContextCompactionType;
}
export interface MemoryConfig {
	enabled: boolean;
	provider: MemoryEmbeddingProvider;
	model: string;
	maxDistance: number;
}
export interface SettingsData {
	onboardingFinished?: boolean;
	language: string;
	startupMode?: ProjectStartMode;
	zoomLevel?: number;
	notificationsEnabled?: boolean;
	theme?: Theme;
	font?: Font;
	fontSize?: number;
	renderMarkdown: boolean;
	virtualizedRendering: boolean;
	aiderDeskAutoUpdate: boolean;
	diffViewMode?: DiffViewMode;
	messageViewMode?: MessageViewMode;
	aider: {
		options: string;
		environmentVariables: string;
		addRuleFiles: boolean;
		autoCommits: boolean;
		cachingEnabled: boolean;
		watchFiles: boolean;
		confirmBeforeEdit: boolean;
	};
	preferredModels: string[];
	mcpServers: Record<string, McpServerConfig>;
	llmProviders: {
		openai?: OpenAiProvider;
		anthropic?: AnthropicProvider;
		gemini?: GeminiProvider;
		groq?: GroqProvider;
		bedrock?: BedrockProvider;
		deepseek?: DeepseekProvider;
		ollama?: OllamaProvider;
		lmstudio?: LmStudioProvider;
		minimax?: MinimaxProvider;
		"openai-compatible"?: OpenAiCompatibleProvider;
		opencode?: OpenCodeProvider;
		openrouter?: OpenRouterProvider;
		requesty?: RequestyProvider;
		synthetic?: SyntheticProvider;
		"vertex-ai"?: VertexAiProvider;
	};
	telemetryEnabled: boolean;
	telemetryInformed?: boolean;
	promptBehavior: PromptBehavior;
	server: {
		enabled: boolean;
		basicAuth: {
			enabled: boolean;
			username: string;
			password: string;
		};
	};
	memory: MemoryConfig;
	taskSettings: TaskSettings;
	hotkeyConfig?: HotkeyConfig;
}
export interface ProviderProfile {
	id: string;
	name?: string;
	provider: LlmProvider;
	headers?: Record<string, string>;
	disabled?: boolean;
}
export interface McpServerConfig {
	command?: string;
	args?: string[];
	env?: Readonly<Record<string, string>>;
	url?: string;
	headers?: Readonly<Record<string, string>>;
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
	currentMode: z.ZodOptional<z.ZodString>;
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
export interface TodoItem {
	name: string;
	completed: boolean;
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
export interface Command {
	name: string;
	description: string;
	arguments: CommandArgument[];
}
export interface CommandArgument {
	description: string;
	required?: boolean;
	options?: string[];
}
export interface CustomCommand extends Command {
	template: string;
	includeContext?: boolean;
	autoApprove?: boolean;
}
export type AgentStepResult = unknown;
export interface ResponseMessage {
	id: string;
	content: string;
	reflectedMessage?: string;
	finished: boolean;
	usageReport?: UsageReportData;
	promptContext?: PromptContext;
}
/**
 * Metadata describing an extension
 */
export interface ExtensionMetadata {
	/** Extension name (displayed in UI) */
	name: string;
	/** Semantic version (e.g., "1.0.0") */
	version: string;
	/** Brief description of extension functionality */
	description?: string;
	/** Author name or organization */
	author?: string;
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
/**
 * Definition of a command that can be registered by an extension
 *
 * Extension commands are fully responsible for their own execution logic.
 * The execute function should handle everything including:
 * - Processing arguments
 * - Performing any operations (file I/O, API calls, etc.)
 * - Sending prompts to agent/aider if needed via context methods
 * - Displaying results to the user
 *
 * @example
 * ```typescript
 * const myCommand: CommandDefinition = {
 *   name: 'generate-tests',
 *   description: 'Generate unit tests for the current file',
 *   arguments: [
 *     { description: 'File path to generate tests for', required: true },
 *     { description: 'Test framework (jest, vitest, mocha)', required: false }
 *   ],
 *   async execute(args, context) {
 *     const filePath = args[0];
 *     const framework = args[1] || 'vitest';
 *
 *     // Read file, process it, send prompt to agent, etc.
 *     const fileContent = await readFile(filePath);
 *     const prompt = `Generate tests for ${filePath} using ${framework}...`;
 *
 *     // Extension handles sending the prompt
 *     // (context would provide methods to do this)
 *   },
 * };
 * ```
 */
export interface CommandDefinition {
	/** Command name in kebab-case (e.g., 'generate-tests') */
	name: string;
	/** Description shown in autocomplete */
	description: string;
	/** Command arguments */
	arguments?: CommandArgument[];
	/** Execute function that handles the complete command logic */
	execute: (args: string[], context: ExtensionContext) => Promise<void>;
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
/** Event payload for task updated events */
export interface TaskUpdatedEvent {
	task: TaskData;
}
/** Event payload for project opened events */
export interface ProjectStartedEvent {
	readonly baseDir: string;
}
/** Event payload for project closed events */
export interface ProjectStoppedEvent {
	readonly baseDir: string;
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
	readonly mode: Mode;
	prompt: string | null;
	agentProfile: AgentProfile;
	providerProfile: ProviderProfile;
	model: string;
	promptContext?: PromptContext;
	systemPrompt: string | undefined;
	contextMessages: ContextMessage[];
	contextFiles: ContextFile[];
	blocked?: boolean;
}
/** Event payload for agent finished events */
export interface AgentFinishedEvent {
	readonly mode: Mode;
	readonly aborted: boolean;
	readonly contextMessages: ContextMessage[];
	resultMessages: ContextMessage[];
}
/** Event payload for agent step finished events */
export interface AgentStepFinishedEvent {
	readonly mode: Mode;
	readonly agentProfile: AgentProfile;
	readonly currentResponseId: string;
	readonly stepResult: AgentStepResult;
	finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other" | "unknown";
	responseMessages: ContextMessage[];
}
/** Event payload for message optimization events */
export interface OptimizeMessagesEvent {
	readonly originalMessages: ContextMessage[];
	optimizedMessages: ContextMessage[];
}
/** Event payload for important reminders events */
export interface ImportantRemindersEvent {
	readonly profile: AgentProfile;
	remindersContent: string;
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
	readonly abortSignal?: AbortSignal;
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
/** Event payload for rule files retrieved events */
export interface RuleFilesRetrievedEvent {
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
/** Options for asking questions to the user */
export interface QuestionOptions {
	subject?: string;
	answers?: Array<{
		text: string;
		shortkey: string;
	}>;
	defaultAnswer?: string;
}
/**
 * Safe subset of Task capabilities exposed to extensions.
 * Provides read-only access to task data and safe operations.
 */
export interface TaskContext {
	readonly data: TaskData;
	getContextFiles(): Promise<ContextFile[]>;
	addFile(path: string, readOnly?: boolean): Promise<void>;
	addFiles(...files: ContextFile[]): Promise<void>;
	dropFile(path: string): Promise<void>;
	getContextMessages(): Promise<ContextMessage[]>;
	addContextMessage(message: ContextMessage, updateContextInfo?: boolean): Promise<void>;
	removeMessage(messageId: string): Promise<void>;
	removeLastMessage(): Promise<void>;
	removeMessagesUpTo(messageId: string): Promise<void>;
	loadContextMessages(messages: ContextMessage[]): Promise<void>;
	redoLastUserPrompt(mode?: string, updatedPrompt?: string): Promise<void>;
	addUserMessage(id: string, content: string, promptContext?: PromptContext): void;
	addToolMessage(id: string, serverName: string, toolName: string, input?: unknown, response?: string, usageReport?: UsageReportData, promptContext?: PromptContext, saveToDb?: boolean, finished?: boolean): void;
	addResponseMessage(message: ResponseMessage, saveToDb?: boolean): Promise<void>;
	getTaskDir(): string;
	getAddableFiles(searchRegex?: string): Promise<string[]>;
	getAllFiles(useGit?: boolean): Promise<string[]>;
	getUpdatedFiles(): Promise<UpdatedFile[]>;
	getRepoMap(): string;
	addToGit(path: string): Promise<void>;
	getTodos(): Promise<TodoItem[]>;
	addTodo(name: string): Promise<TodoItem[]>;
	updateTodo(name: string, updates: Partial<TodoItem>): Promise<TodoItem[]>;
	deleteTodo(name: string): Promise<TodoItem[]>;
	clearAllTodos(): Promise<TodoItem[]>;
	setTodos(items: TodoItem[], initialUserPrompt?: string): Promise<void>;
	runPrompt(prompt: string, mode?: string): Promise<void>;
	runCustomCommand(name: string, args?: string[], mode?: string): Promise<void>;
	runSubagent(agentProfile: AgentProfile, prompt: string): Promise<void>;
	runCommand(command: string): Promise<void>;
	interruptResponse(): Promise<void>;
	generateText(agentProfile: AgentProfile, systemPrompt: string, prompt: string): Promise<string | undefined>;
	askQuestion(text: string, options?: QuestionOptions): Promise<string>;
	addLogMessage(level: "info" | "error" | "warning", message?: string): void;
	addLoadingMessage(message?: string, finished?: boolean): void;
	updateTask(updates: Partial<TaskData>): Promise<TaskData>;
	handoffConversation(focus?: string, execute?: boolean): Promise<void>;
	clearContext(): Promise<void>;
	resetContext(): Promise<void>;
	compactConversation(instructions?: string): Promise<void>;
	generateContextMarkdown(): Promise<string | null>;
	isInitialized(): boolean;
	getQueuedPrompts(): QueuedPromptData[];
	sendQueuedPromptNow(promptId: string): Promise<void>;
	removeQueuedPrompt(promptId: string): void;
	getTaskAgentProfile(): Promise<AgentProfile | null>;
	answerQuestion(answer: string, userInput?: string): Promise<boolean>;
}
/**
 * Safe subset of Project capabilities exposed to extensions.
 * Provides read-only access to project data and safe operations.
 */
export interface ProjectContext {
	readonly baseDir: string;
	createTask(params: CreateTaskParams): Promise<TaskData>;
	getTask(taskId: string): TaskContext | null;
	getTasks(): Promise<TaskData[]>;
	getMostRecentTask(): TaskContext | null;
	forkTask(taskId: string, messageId: string): Promise<TaskData>;
	duplicateTask(taskId: string): Promise<TaskData>;
	deleteTask(taskId: string): Promise<void>;
	getAgentProfiles(): AgentProfile[];
	getCommands(): CommandsData;
	getProjectSettings(): ProjectSettings;
	getInputHistory(): Promise<string[]>;
}
/**
 * Context object passed to extension methods providing access to AiderDesk APIs
 *
 * @example
 * ```typescript
 * async onLoad(context: ExtensionContext) {
 *   const taskContext = context.getTaskContext();
 *   if (taskContext) {
 *     context.log(`Task: ${taskContext.data.name}`, 'info');
 *   }
 * }
 * ```
 */
export interface ExtensionContext {
	/**
	 * Log a message to the AiderDesk console and log files
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
	 * Get the current task context for safe task operations
	 * @returns TaskContext or null if no task is active
	 */
	getTaskContext(): TaskContext | null;
	/**
	 * Get the project context for safe project operations
	 * @returns ProjectContext
	 */
	getProjectContext(): ProjectContext;
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
	updateSettings(updates: Partial<SettingsData>): Promise<void>;
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
 *   getTools(context: ExtensionContext): ToolDefinition[] {
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
	 * @param context - Extension context
	 * @param mode - Current mode
	 * @param agentProfile - Current agent profile
	 */
	getTools?(context: ExtensionContext, mode: string, agentProfile: AgentProfile): ToolDefinition[];
	/**
	 * Return array of commands this extension provides
	 * Called when extension is loaded and when commands need to be refreshed
	 */
	getCommands?(context: ExtensionContext): CommandDefinition[];
	/**
	 * Return array of modes this extension provides
	 * Called when extension is loaded and when modes need to be refreshed
	 */
	getModes?(context: ExtensionContext): ModeDefinition[];
	/**
	 * Return array of agent profiles this extension provides
	 * Called when extension is loaded and when agents need to be refreshed
	 * Extension-provided agents will be included in the list of all agents
	 */
	getAgents?(context: ExtensionContext): AgentProfile[];
	/**
	 * Called when a user updates an extension-provided agent profile
	 * Extension should persist the updated profile and return it from future getAgents() calls
	 * @param context - Extension context (no project available for global operations)
	 * @param agentId - The ID of the agent being updated
	 * @param updatedProfile - The complete updated profile
	 * @returns The updated agent profile
	 */
	onAgentProfileUpdated?(context: ExtensionContext, agentId: string, updatedProfile: AgentProfile): Promise<AgentProfile>;
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
	 * Called before a task is updated and saved
	 * Modify event.task to change the task data before it's persisted
	 * @returns void or partial event to modify task data
	 */
	onTaskUpdated?(event: TaskUpdatedEvent, context: ExtensionContext): Promise<void | Partial<TaskUpdatedEvent>>;
	/**
	 * Called when a project is started
	 * @returns void or partial event to modify project data
	 */
	onProjectStarted?(event: ProjectStartedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStartedEvent>>;
	/**
	 * Called when a project is closed
	 * @returns void or partial event to modify project data
	 */
	onProjectStopped?(event: ProjectStoppedEvent, context: ExtensionContext): Promise<void | Partial<ProjectStoppedEvent>>;
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
	 * Called when messages are optimized before being sent to the LLM
	 * Modify event.optimizedMessages to change the messages that will be sent
	 * @returns void or partial event to modify optimized messages
	 */
	onOptimizeMessages?(event: OptimizeMessagesEvent, context: ExtensionContext): Promise<void | Partial<OptimizeMessagesEvent>>;
	/**
	 * Called when important reminders are being added to the user message
	 * Modify event.remindersContent to change the reminders content
	 * @returns void or partial event to modify reminders content
	 */
	onImportantReminders?(event: ImportantRemindersEvent, context: ExtensionContext): Promise<void | Partial<ImportantRemindersEvent>>;
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
	 * Called when rule files are retrieved
	 * Modify event.files to filter, add, or clear rule files
	 * @returns void or partial event to modify files
	 */
	onRuleFilesRetrieved?(event: RuleFilesRetrievedEvent, context: ExtensionContext): Promise<void | Partial<RuleFilesRetrievedEvent>>;
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

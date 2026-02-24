import {
  AnthropicProvider,
  BedrockProvider,
  DeepseekProvider,
  GeminiProvider,
  GroqProvider,
  LlmProvider,
  LmStudioProvider,
  MinimaxProvider,
  OllamaProvider,
  OpenAiCompatibleProvider,
  OpenAiProvider,
  OpenCodeProvider,
  OpenRouterProvider,
  RequestyProvider,
  VertexAiProvider,
  SyntheticProvider,
} from '@common/agent';
import { z } from 'zod';

import { ContextFile, ContextMemoryMode, ContextMessage, PromptContext, UsageReportData } from './context';

import type { JSONSchema7Definition } from '@ai-sdk/provider';

// Worktree schema definition
export const WorktreeSchema = z.object({
  path: z.string(),
  baseBranch: z.string().optional(),
  baseCommit: z.string().optional(),
  prunable: z.boolean().optional(),
});

export type Worktree = z.infer<typeof WorktreeSchema>;

// Merge state for tracking merge operations and enabling revert
export const MergeStateSchema = z.object({
  beforeMergeCommitHash: z.string(),
  worktreeBranchCommitHash: z.string(),
  mainOriginalStashId: z.string().optional(),
  targetBranch: z.string().optional(),
  timestamp: z.number(),
});

export type MergeState = z.infer<typeof MergeStateSchema>;

export interface WorktreeAheadCommits {
  count: number;
  commits: string[];
}

export interface WorktreeUncommittedFiles {
  count: number;
  files: string[];
}

export interface RebaseState {
  inProgress: boolean;
  hasUnmergedPaths: boolean;
  unmergedFiles?: string[];
}

export interface ConflictResolutionFileContext {
  filePath: string;
  base?: string | null;
  ours?: string | null;
  theirs?: string | null;
  current?: string;
}

export interface WorktreeIntegrationStatus {
  targetBranch: string;
  aheadCommits: WorktreeAheadCommits;
  uncommittedFiles: WorktreeUncommittedFiles;
  predictedConflicts: {
    hasConflicts: boolean;
    conflictingFiles?: string[];
    conflictingCommits?: {
      ours: string[];
      theirs: string[];
    };
    canAutoMerge?: boolean;
  };
  rebaseState: RebaseState;
}

export interface WorktreeIntegrationStatusUpdatedData {
  baseDir: string;
  taskId: string;
  status: WorktreeIntegrationStatus | null;
}

export type Mode = 'code' | 'ask' | 'architect' | 'context' | 'agent' | 'bmad';

export const AGENT_MODES: Mode[] = ['agent', 'bmad'];

export const AIDER_MODES: Mode[] = ['code', 'ask', 'architect', 'context'];

export const AIDER_COMMANDS: string[] = ['commit', 'map', 'map-refresh', 'tokens', 'test'];

export interface AiderRunOptions {
  autoApprove?: boolean;
  denyCommands?: boolean;
}

export type EditFormat = 'diff' | 'diff-fenced' | 'whole' | 'udiff' | 'udiff-simple' | 'patch';

export enum DiffViewMode {
  SideBySide = 'side-by-side',
  Unified = 'unified',
  Compact = 'compact',
}

export enum MessageViewMode {
  Full = 'full',
  Compact = 'compact',
}

export enum ReasoningEffort {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Minimal = 'minimal',
  None = 'none',
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
  type: 'response-completed';
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

export interface CommandOutputData {
  baseDir: string;
  taskId: string;
  command: string;
  output: string;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'loading';

export interface LogData {
  baseDir: string;
  taskId: string;
  level: LogLevel;
  message?: string;
  finished?: boolean;
  promptContext?: PromptContext;
  actionIds?: string[];
}

export interface ToolData {
  type: 'tool';
  baseDir: string;
  taskId: string;
  id: string;
  serverName: string;
  toolName: string;
  args?: unknown;
  response?: string;
  usageReport?: UsageReportData;
  promptContext?: PromptContext;
  finished?: boolean;
}

export interface ContextFilesUpdatedData {
  baseDir: string;
  taskId: string;
  files: ContextFile[];
}

export interface UpdatedFile {
  path: string;
  additions: number;
  deletions: number;
  diff?: string;
}

export interface UpdatedFilesUpdatedData {
  baseDir: string;
  taskId: string;
  files: UpdatedFile[];
}

export interface CommandsData {
  baseDir: string;
  customCommands: Command[];
  extensionCommands: Command[];
}

export interface AutocompletionData {
  baseDir: string;
  taskId: string;
  words?: string[];
  allFiles?: string[];
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

export interface QuestionAnsweredData {
  baseDir: string;
  taskId: string;
  question: QuestionData;
  answer: string;
  userInput?: string;
}

export interface QueuedPromptData {
  id: string;
  text: string;
  mode: Mode;
  timestamp: number;
}

export interface QueuedPromptsUpdatedData {
  baseDir: string;
  taskId: string;
  queuedPrompts: QueuedPromptData[];
}

export type ContextFileSourceType = 'companion' | 'aider' | 'app' | string;

export enum OS {
  Windows = 'windows',
  Linux = 'linux',
  MacOS = 'macos',
}

export interface CloudflareTunnelStatus {
  isRunning: boolean;
  url?: string;
}

export interface WindowState {
  width: number;
  height: number;
  x: number | undefined;
  y: number | undefined;
  isMaximized: boolean;
}

export const ProjectSettingsSchema = z.object({
  // @deprecated: These properties are deprecated in favor of task-level settings
  // They are kept for backward compatibility and as defaults for new tasks
  mainModel: z.string(),
  weakModel: z.string().nullable().optional(),
  architectModel: z.string().nullable().optional(),
  agentProfileId: z.string(),
  modelEditFormats: z.record(z.string(), z.enum(['diff', 'diff-fenced', 'whole', 'udiff', 'udiff-simple', 'patch'])),
  reasoningEffort: z.string().optional(),
  thinkingTokens: z.string().optional(),
  currentMode: z.enum(['code', 'ask', 'architect', 'context', 'agent', 'bmad']),
  contextCompactingThreshold: z.number().optional(),
  weakModelLocked: z.boolean().optional(),
  autoApproveLocked: z.boolean().optional(),
});

export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export interface ProjectData {
  active: boolean;
  baseDir: string;
  settings: ProjectSettings;
}

export interface RawModelInfo {
  max_input_tokens: number;
  max_output_tokens: number;
  input_cost_per_token: number;
  output_cost_per_token: number;
  supports_function_calling: boolean;
  supports_tool_choice: boolean;
  litellm_provider: string;
}

export interface ModelsData {
  baseDir: string;
  taskId: string;
  mainModel: string;
  weakModel?: string | null;
  architectModel?: string | null;
  reasoningEffort?: string;
  thinkingTokens?: string;
  editFormat?: EditFormat;
  info?: RawModelInfo;
  error?: string;
}

export enum ToolApprovalState {
  Always = 'always',
  Never = 'never',
  Ask = 'ask',
}

export enum ProjectStartMode {
  Empty = 'empty',
  Last = 'last',
  Remote = 'remote',
}

export enum SuggestionMode {
  Automatically = 'automatically',
  OnTab = 'onTab',
  MentionAtSign = 'mentionAtSign',
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

export enum InvocationMode {
  OnDemand = 'on-demand',
  Automatic = 'automatic',
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
  projectDir?: string; // If specified, it's a project-level profile, otherwise global
  name: string;
  provider: string;
  model: string;
  maxIterations: number;
  maxTokens?: number; // Optional: overrides model maxOutputTokens when set
  minTimeBetweenToolCalls: number; // in milliseconds
  temperature?: number; // Optional: overrides model temperature when set
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
  isSubagent?: boolean; // flag to indicate if this profile is being used as a subagent
  ruleFiles?: string[]; // Array of absolute paths to rule files for this agent profile
}

export interface EnvironmentVariable {
  value: string;
  source: string;
}

export const THEMES = [
  'dark',
  'light',
  'charcoal',
  'neon',
  'neopunk',
  'aurora',
  'ocean',
  'forest',
  'lavender',
  'bw',
  'midnight',
  'serenity',
  'cappuccino',
  'fresh',
  'botanical-garden',
  'botanical-garden-dark',
] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = [
  'Sono',
  'Poppins',
  'Nunito',
  'Quicksand',
  'PlayfairDisplay',
  'Lora',
  'SpaceGrotesk',
  'Orbitron',
  'Enriqueta',
  'FunnelDisplay',
  'GoogleSansCode',
  'Inter',
  'JetBrainsMono',
  'RobotoMono',
  'Sansation',
  'Silkscreen',
  'SourceCodePro',
  'SpaceMono',
  'UbuntuMono',
] as const;
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

export enum MemoryEmbeddingProvider {
  SentenceTransformers = 'sentence-transformers',
}

export enum ContextCompactionType {
  Compact = 'compact',
  Handoff = 'handoff',
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

export enum MemoryEmbeddingProgressPhase {
  Idle = 'idle',
  LoadingModel = 'loading-model',
  ReEmbedding = 're-embedding',
  Done = 'done',
  Error = 'error',
}

export interface MemoryEmbeddingProgress {
  phase: MemoryEmbeddingProgressPhase;
  status: string | null;
  done: number;
  total: number;
  finished: boolean;
  error?: string;
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
    'openai-compatible'?: OpenAiCompatibleProvider;
    opencode?: OpenCodeProvider;
    openrouter?: OpenRouterProvider;
    requesty?: RequestyProvider;
    synthetic?: SyntheticProvider;
    'vertex-ai'?: VertexAiProvider;
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

export interface ProvidersUpdatedData {
  providers: ProviderProfile[];
}

export interface AgentProfilesUpdatedData {
  profiles: AgentProfile[];
}

export interface VoiceSession {
  ephemeralToken: string;
  model: string;
  idleTimeoutMs: number;
}

export interface ProjectStartedData {
  baseDir: string;
}

export interface ClearTaskData {
  baseDir: string;
  taskId: string;
  clearMessages: boolean;
  clearSession: boolean;
}

export interface TokensCost {
  tokens: number;
  tokensEstimated?: boolean;
  cost: number;
}

export interface TokensInfoData {
  baseDir: string;
  taskId: string;
  chatHistory: TokensCost;
  files: Record<string, TokensCost>;
  repoMap: TokensCost;
  systemMessages: TokensCost;
  agent?: TokensCost;
}

export interface InputHistoryData {
  baseDir: string;
  taskId: string;
  inputHistory: string[];
}

export interface UserMessageData {
  type: 'user';
  id: string;
  baseDir: string;
  taskId: string;
  content: string;
  promptContext?: PromptContext;
}

export interface MessageRemovedData {
  baseDir: string;
  taskId: string;
  messageIds: string[];
}

export interface FileEdit {
  path: string;
  original: string;
  updated: string;
}

export interface GenericTool {
  groupName: string;
  name: string;
  description: string;
}

export interface McpToolInputSchema {
  type: 'object';
  properties: Record<string, JSONSchema7Definition>;
}

export interface McpTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: McpToolInputSchema;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Readonly<Record<string, string>>;
  url?: string;
  headers?: Readonly<Record<string, string>>;
}

export interface VersionsInfo {
  aiderDeskCurrentVersion?: string | null;
  aiderCurrentVersion?: string | null;
  aiderDeskAvailableVersion?: string | null;
  aiderAvailableVersion?: string | null;
  aiderDeskDownloadProgress?: number;
  aiderDeskNewVersionReady?: boolean;
  releaseNotes?: string | null;
}

export enum FileWriteMode {
  Overwrite = 'overwrite',
  Append = 'append',
  CreateOnly = 'create_only',
}

export interface ModelInfo {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  cacheWriteInputTokenCost?: number;
  cacheReadInputTokenCost?: number;
  useTemperature?: boolean;
  temperature?: number;
}

export interface TaskContext {
  version?: number;
  contextMessages: ContextMessage[];
  contextFiles: ContextFile[];
}

export interface TaskStateData {
  messages: (ResponseCompletedData | UserMessageData | ToolData)[];
  files: ContextFile[];
  todoItems: TodoItem[];
  question: QuestionData | null;
  queuedPrompts: QueuedPromptData[];
  workingMode: WorkingMode;
}

export const WorkingModeSchema = z.enum(['local', 'worktree']);

export type WorkingMode = z.infer<typeof WorkingModeSchema>;

export const TaskDataSchema = z.object({
  id: z.string(),
  baseDir: z.string(),
  parentId: z.string().nullable().optional(),
  name: z.string(),
  state: z.string().optional(),
  archived: z.boolean().optional(),
  pinned: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  startedAt: z.string().optional(),
  interruptedAt: z.string().optional(),
  completedAt: z.string().optional(),
  worktree: WorktreeSchema.optional(),
  workingMode: WorkingModeSchema.optional(),
  lastMergeState: MergeStateSchema.optional(),
  aiderTotalCost: z.number(),
  agentTotalCost: z.number(),
  autoApprove: z.boolean().optional(),
  agentProfileId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  mainModel: z.string(),
  weakModel: z.string().nullable().optional(),
  architectModel: z.string().nullable().optional(),
  reasoningEffort: z.string().optional(),
  thinkingTokens: z.string().optional(),
  currentMode: z.enum(['code', 'ask', 'architect', 'context', 'agent', 'bmad']).optional(),
  contextCompactingThreshold: z.number().optional(),
  weakModelLocked: z.boolean().optional(),
  handoff: z.boolean().optional(),
  lastAgentProviderMetadata: z.unknown().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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

export interface TaskCreatedData {
  baseDir: string;
  task: TaskData;
  activate?: boolean;
  editLast?: boolean;
}

export enum DefaultTaskState {
  Todo = 'TODO',
  InProgress = 'IN_PROGRESS',
  Interrupted = 'INTERRUPTED',
  MoreInfoNeeded = 'MORE_INFO_NEEDED',
  ReadyForReview = 'READY_FOR_REVIEW',
  ReadyForImplementation = 'READY_FOR_IMPLEMENTATION',
  Done = 'DONE',
}

export const TaskStateEmoji: Record<DefaultTaskState, string> = {
  [DefaultTaskState.Todo]: '📋',
  [DefaultTaskState.ReadyForImplementation]: '🚀',
  [DefaultTaskState.InProgress]: '⚙️',
  [DefaultTaskState.Interrupted]: '⏸️',
  [DefaultTaskState.MoreInfoNeeded]: '💬',
  [DefaultTaskState.ReadyForReview]: '👀',
  [DefaultTaskState.Done]: '✅',
};

export interface TodoItem {
  name: string;
  completed: boolean;
}

export interface UsageDataRow {
  timestamp: string;
  project: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost: number;
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

export interface ProviderModelsData {
  models?: Model[];
  loading?: boolean;
  errors?: Record<string, string>;
}

export interface ModelOverrides {
  version: number;
  models: Model[];
}

export interface Command {
  name: string;
  description: string;
  arguments: CommandArgument[];
}

export interface CommandArgument {
  description: string;
  required?: boolean;
}

export interface CustomCommand extends Command {
  template: string;
  includeContext?: boolean;
  autoApprove?: boolean;
}

export interface TerminalData {
  terminalId: string;
  baseDir: string;
  taskId: string;
  data: string;
}

export interface TerminalExitData {
  terminalId: string;
  baseDir: string;
  taskId: string;
  exitCode: number;
  signal?: number;
}

export enum MemoryEntryType {
  Task = 'task',
  UserPreference = 'user-preference',
  CodePattern = 'code-pattern',
}

export interface MemoryEntry {
  id: string;
  content: string;
  type: MemoryEntryType;
  taskId?: string;
  projectId?: string;
  timestamp: number;
}

export interface BranchInfo {
  name: string;
  isCurrent: boolean;
  hasWorktree: boolean;
}
export interface NotificationData {
  baseDir: string;
  title: string;
  body: string;
}

import { LlmProvider, LlmProviderName } from '@common/agent';

import type { CoreMessage } from 'ai';
import type { JsonSchema } from '@n8n/json-schema-to-zod';

export type Mode = 'code' | 'ask' | 'architect' | 'context' | 'agent';

export type EditFormat = 'diff' | 'diff-fenced' | 'whole' | 'udiff' | 'udiff-simple' | 'patch';

export enum ReasoningEffort {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  None = 'none',
}

export interface ResponseChunkData {
  messageId: string;
  baseDir: string;
  chunk: string;
  reflectedMessage?: string;
}

export interface ResponseCompletedData {
  messageId: string;
  baseDir: string;
  content: string;
  reflectedMessage?: string;
  editedFiles?: string[];
  commitHash?: string;
  commitMessage?: string;
  diff?: string;
  usageReport?: UsageReportData;
}

export interface CommandOutputData {
  baseDir: string;
  command: string;
  output: string;
}

export type LogLevel = 'info' | 'warning' | 'error' | 'loading';

export interface LogData {
  baseDir: string;
  level: LogLevel;
  message?: string;
  finished?: boolean;
}

export interface ToolData {
  baseDir: string;
  id: string;
  serverName: string;
  toolName: string;
  args?: Record<string, unknown>;
  response?: string;
  usageReport?: UsageReportData;
}

export interface ContextFilesUpdatedData {
  baseDir: string;
  files: ContextFile[];
}

export interface AutocompletionData {
  baseDir: string;
  words: string[];
  allFiles: string[];
  models: string[];
}

export interface SessionData {
  name: string;
  messages?: number;
  files?: number;
}

export interface Answer {
  text: string;
  shortkey: string;
}

export interface QuestionData {
  baseDir: string;
  text: string;
  subject?: string;
  isGroupQuestion?: boolean;
  answers?: Answer[];
  defaultAnswer: string;
  internal?: boolean;
  key?: string;
}

export type ContextFileSourceType = 'companion' | 'aider' | 'app' | string;

export enum OS {
  Windows = 'windows',
  Linux = 'linux',
  MacOS = 'macos',
}

export enum MessageRole {
  User = 'user',
  Assistant = 'assistant',
}

export type ContextMessage = CoreMessage;

export interface ContextFile {
  path: string;
  readOnly?: boolean;
}

export interface WindowState {
  width: number;
  height: number;
  x: number | undefined;
  y: number | undefined;
  isMaximized: boolean;
}

export interface ProjectSettings {
  mainModel: string;
  weakModel?: string | null;
  architectModel?: string | null;
  agentProfileId: string;
  editFormat?: EditFormat | null;
  reasoningEffort?: string;
  thinkingTokens?: string;
  currentMode: Mode;
  renderMarkdown: boolean;
}

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

export enum StartupMode {
  Empty = 'empty',
  Last = 'last',
}

export interface AgentProfile {
  id: string;
  name: string;
  provider: LlmProviderName;
  model: string;
  maxIterations: number;
  maxTokens: number;
  minTimeBetweenToolCalls: number; // in milliseconds
  enabledServers: string[];
  toolApprovals: Record<string, ToolApprovalState>;
  includeContextFiles: boolean;
  includeRepoMap: boolean;
  usePowerTools: boolean;
  useAiderTools: boolean;
  customInstructions: string;
  autoApprove: boolean;
}

export interface SettingsData {
  onboardingFinished?: boolean;
  language: string;
  startupMode?: StartupMode;
  zoomLevel?: number;
  notificationsEnabled?: boolean;
  theme?: 'dark' | 'light';
  fontFamily?: string;
  monospaceFontFamily?: string;
  aiderDeskAutoUpdate: boolean;
  aider: {
    options: string;
    environmentVariables: string;
    addRuleFiles: boolean;
  };
  models: {
    aiderPreferred: string[];
    agentPreferred: string[];
  };
  agentProfiles: AgentProfile[];
  mcpServers: Record<string, McpServerConfig>;
  llmProviders: Record<LlmProviderName, LlmProvider>;
  telemetryEnabled: boolean;
  telemetryInformed?: boolean;
}

export interface UsageReportData {
  sentTokens: number;
  receivedTokens: number;
  messageCost: number;
  aiderTotalCost?: number;
  agentTotalCost?: number;
}

export interface TokensCost {
  tokens: number;
  tokensEstimated?: boolean;
  cost: number;
}

export interface TokensInfoData {
  baseDir: string;
  chatHistory: TokensCost;
  files: Record<string, TokensCost>;
  repoMap: TokensCost;
  systemMessages: TokensCost;
  agent?: TokensCost;
}

export interface InputHistoryData {
  baseDir: string;
  messages: string[];
}

export interface UserMessageData {
  baseDir: string;
  content: string;
  mode?: Mode;
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

export interface McpTool {
  serverName: string;
  name: string;
  description?: string;
  inputSchema: JsonSchema;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Readonly<Record<string, string>>;
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
  maxInputTokens: number;
  maxOutputTokens: number;
  inputCostPerToken: number;
  outputCostPerToken: number;
  cacheWriteInputTokenCost?: number;
  cacheReadInputTokenCost?: number;
  supportsTools: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

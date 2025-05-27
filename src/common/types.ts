import { LlmProvider } from '@common/llm-providers';

import type { CoreMessage } from 'ai';
import type { JsonSchema } from '@n8n/json-schema-to-zod';

export type Mode = 'code' | 'ask' | 'architect' | 'context' | 'agent';

export type EditFormat = 'diff' | 'diff-fenced' | 'whole' | 'udiff' | 'udiff-simple' | 'patch';

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
  editFormat?: EditFormat | null;
  reasoningEffort?: string;
  thinkingTokens?: string;
  currentMode: Mode;
  renderMarkdown: boolean;
}

export interface ProjectData {
  active?: boolean;
  baseDir: string;
  settings?: ProjectSettings;
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

export interface SettingsData {
  onboardingFinished?: boolean;
  language: string;
  startupMode?: StartupMode;
  zoomLevel?: number;
  notificationsEnabled?: boolean;
  theme?: 'dark' | 'light';
  aiderDeskAutoUpdate: boolean;
  aider: {
    options: string;
    environmentVariables: string;
  };
  models: {
    preferred: string[];
  };
  agentConfig: AgentConfig;
}

export interface AgentConfig {
  providers: LlmProvider[];
  maxIterations: number;
  maxTokens: number;
  minTimeBetweenToolCalls: number; // in milliseconds
  mcpServers: Record<string, McpServerConfig>;
  disabledServers: string[];
  toolApprovals: Record<string, ToolApprovalState>;
  includeContextFiles: boolean;
  includeRepoMap: boolean;
  usePowerTools: boolean;
  useAiderTools: boolean;
  customInstructions: string;
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

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

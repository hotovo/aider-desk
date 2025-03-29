import { LlmProvider } from '@common/llm-providers';

import type { JsonSchema } from '@n8n/json-schema-to-zod';

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
}

export interface ToolData {
  baseDir: string;
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

export interface QuestionData {
  baseDir: string;
  text: string;
  subject?: string;
  defaultAnswer: string;
  answerFunction?: (answer: string) => void;
}

export type ContextFileSourceType = 'companion' | 'aider' | 'app' | string;

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
}

export interface ProjectData {
  active?: boolean;
  baseDir: string;
  settings?: ProjectSettings;
}

export interface ModelsData {
  baseDir: string;
  mainModel: string;
  weakModel?: string | null;
  architectModel?: string | null;
  maxChatHistoryTokens?: number;
  reasoningEffort?: number;
  thinkingTokens?: number;
  info?: Record<string, unknown>;
  error?: string;
}

export interface SettingsData {
  onboardingFinished?: boolean;
  language?: string;
  aider: {
    options: string;
    environmentVariables: string;
  };
  models: {
    preferred: string[];
  };
  mcpAgent: McpAgent;
}

export interface McpAgent {
  providers: LlmProvider[];
  maxIterations: number;
  maxTokens: number;
  minTimeBetweenToolCalls: number; // in milliseconds
  mcpServers: {
    [key: string]: McpServerConfig;
  };
  agentEnabled: boolean;
  disabledServers: string[];
  systemPrompt: string;
  includeContextFiles: boolean;
  useAiderTools: boolean;
}

export const getActiveProvider = (providers: LlmProvider[]): LlmProvider | null => {
  return providers.find((provider) => provider.active) || null;
};

export interface UsageReportData {
  sentTokens: number;
  receivedTokens: number;
  messageCost: number;
  totalCost: number;
  mcpToolsCost?: number;
}

export interface TokensCost {
  tokens: number;
  cost: number;
}

export interface TokensInfoData {
  baseDir: string;
  chatHistory: TokensCost;
  files: Record<string, TokensCost>;
  repoMap: TokensCost;
  systemMessages: TokensCost;
}

export interface InputHistoryData {
  baseDir: string;
  messages: string[];
}

export interface UserMessageData {
  baseDir: string;
  content: string;
  editFormat?: string;
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

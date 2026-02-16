import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData, VoiceSession } from '@common/types';
import { LlmProvider, LlmProviderName } from '@common/agent';

import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModelUsage, ModelMessage, ToolSet } from 'ai';

import { Task } from '@/task';

export interface CacheControl {
  providerOptions: SharedV2ProviderOptions;
  placement?: 'message' | 'message-part';
}

export interface AiderModelMapping {
  modelName: string;
  environmentVariables: Record<string, string>;
}

/**
 * Complete strategy interface for LLM providers
 * Encapsulates all provider-specific functionality including:
 * - LLM creation and usage tracking
 * - Model discovery and configuration
 * - Cost calculation and usage reporting
 * - Environment variable detection
 * - Aider integration
 */
export interface LoadModelsResponse {
  models: Model[];
  success: boolean;
  error?: string;
}

export interface LlmProviderStrategy {
  // === LLM Creation and Usage Functions ===
  /**
   * Creates a LanguageModel instance for the given provider and model
   * Each provider is responsible for loading its own credentials using getEffectiveEnvironmentVariable
   */
  createLlm: (
    profile: ProviderProfile,
    model: Model,
    settings: SettingsData,
    projectDir: string,
    toolSet?: ToolSet,
    systemPrompt?: string,
    providerMetadata?: unknown,
  ) => LanguageModelV2;

  /**
   * Generates usage reports with provider-specific metadata and calculates cost internally
   */
  getUsageReport: (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage, providerMetadata?: unknown) => UsageReportData;

  // === Model Discovery and Configuration Functions ===
  /**
   * Loads available models from the provider's API
   */
  loadModels: (profile: ProviderProfile, settings: SettingsData) => Promise<LoadModelsResponse>;

  /**
   * Checks if required environment variables are available
   */
  hasEnvVars: (settings: SettingsData) => boolean;

  /**
   * Generates Aider-compatible model mapping with environment variables
   */
  getAiderMapping: (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string) => AiderModelMapping;

  // === Optional Configuration Helper Functions ===
  /**
   * Returns provider-specific cache control configuration
   */
  getCacheControl?: (profile: AgentProfile, provider: LlmProvider) => CacheControl | undefined;

  /**
   * Returns provider-specific options for model instantiation
   */
  getProviderOptions?: (provider: LlmProvider, model: Model) => SharedV2ProviderOptions | undefined;

  /**
   * Returns provider-specific tools that should be available to the agent
   */
  getProviderTools?: (provider: LlmProvider, model: Model) => ToolSet | Promise<ToolSet>;

  /**
   * Returns provider-specific parameters for the given model
   */
  getProviderParameters?: (provider: LlmProvider, model: Model) => Record<string, unknown>;

  /**
   * Returns model info for a specific model ID
   */
  getModelInfo?: (provider: ProviderProfile, modelId: string, allModelInfos: Record<string, ModelInfo>) => ModelInfo | undefined;

  /**
   * Creates a voice session configuration if supported
   */
  createVoiceSession?: (profile: ProviderProfile, settings: SettingsData) => Promise<VoiceSession>;

  /**
   * Normalizes messages for provider-specific requirements
   */
  normalizeMessages?: (provider: LlmProvider, model: Model, messages: ModelMessage[]) => ModelMessage[];
}

export type LlmProviderRegistry = Record<LlmProviderName, LlmProviderStrategy>;

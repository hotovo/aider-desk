import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { LlmProvider, LlmProviderName } from '@common/agent';

import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider';
import type { LanguageModelUsage, ToolSet } from 'ai';

import { Task } from '@/task';

export type CacheControl = SharedV2ProviderOptions | undefined;

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
  createLlm: (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string) => LanguageModelV2;

  /**
   * Generates usage reports with provider-specific metadata and calculates cost internally
   */
  getUsageReport: (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage, providerMetadata?: unknown) => UsageReportData;

  // === Model Discovery and Configuration Functions ===
  /**
   * Loads available models from the provider's API
   */
  loadModels: (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>, settings: SettingsData) => Promise<LoadModelsResponse>;

  /**
   * Checks if required environment variables are available
   */
  hasEnvVars: (settings: SettingsData) => boolean;

  /**
   * Generates Aider-compatible model mapping with environment variables
   */
  getAiderMapping: (provider: ProviderProfile, modelId: string) => AiderModelMapping;

  // === Optional Configuration Helper Functions ===
  /**
   * Returns provider-specific cache control configuration
   */
  getCacheControl?: (profile: AgentProfile, provider: LlmProvider) => CacheControl;

  /**
   * Returns provider-specific options for model instantiation
   */
  getProviderOptions?: (provider: LlmProvider, model: Model) => SharedV2ProviderOptions | undefined;

  /**
   * Returns provider-specific tools that should be available to the agent
   */
  getProviderTools?: (provider: LlmProvider, model: Model) => ToolSet | Promise<ToolSet>;
}

export type LlmProviderRegistry = Record<LlmProviderName, LlmProviderStrategy>;

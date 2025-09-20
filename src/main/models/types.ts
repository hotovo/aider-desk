import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { LlmProvider, LlmProviderName } from '@common/agent';

import type { JSONValue, LanguageModel, LanguageModelUsage } from 'ai';

import { Project } from '@/project';

export type CacheControl = Record<string, Record<string, JSONValue>> | undefined;

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
   */
  createLlm: (profile: ProviderProfile, model: string, env: Record<string, string | undefined>) => LanguageModel;

  /**
   * Calculates the cost for token usage with provider-specific caching adjustments
   */
  calculateCost: (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown) => number;

  /**
   * Generates usage reports with provider-specific metadata
   */
  getUsageReport: (
    project: Project,
    provider: ProviderProfile,
    modelId: string,
    messageCost: number,
    usage: LanguageModelUsage,
    providerMetadata?: unknown,
  ) => UsageReportData;

  // === Model Discovery and Configuration Functions ===
  /**
   * Loads available models from the provider's API
   */
  loadModels: (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>) => Promise<LoadModelsResponse>;

  /**
   * Checks if required environment variables are available
   */
  hasEnvVars: (projectDir?: string, settings?: SettingsData) => boolean;

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
  getProviderOptions?: (provider: LlmProvider) => Record<string, Record<string, JSONValue>> | undefined;
}

export type LlmProviderRegistry = Record<LlmProviderName, LlmProviderStrategy>;

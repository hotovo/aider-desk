import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isGeminiCliProvider } from '@common/agent';
import { type LanguageModelUsage, type ToolSet } from 'ai';

import { getDefaultUsageReport } from './default';

import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import { Task } from '@/task/task';
import logger from '@/logger';
import { findExecutableInPath } from '@/utils';

// Gemini CLI models with token limits
const GEMINI_CLI_MODELS = [
  {
    id: 'gemini-3-pro-preview',
    maxInputTokens: 1000000,
    maxOutputTokens: 64000,
  },
  {
    id: 'gemini-3-flash-preview',
    maxInputTokens: 1000000,
    maxOutputTokens: 64000,
  },
  { id: 'gemini-2.5-pro', maxInputTokens: 200000, maxOutputTokens: 64000 },
  { id: 'gemini-2.5-flash', maxInputTokens: 200000, maxOutputTokens: 64000 },
];

export const loadGeminiCliModels = async (profile: ProviderProfile, _settings: SettingsData): Promise<LoadModelsResponse> => {
  if (!isGeminiCliProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const models: Model[] = GEMINI_CLI_MODELS.map((m) => ({
    id: m.id,
    providerId: profile.id,
    maxInputTokens: m.maxInputTokens,
    maxOutputTokensLimit: m.maxOutputTokens,
  }));

  return { models, success: true };
};

export const hasGeminiCliEnvVars = (): boolean => {
  // Check for gemini CLI in PATH
  return findExecutableInPath('gemini') !== null;
};

const getGeminiCliAiderMapping = (provider: ProviderProfile, modelId: string, _settings: SettingsData, _projectDir: string): AiderModelMapping => {
  const environmentVariables: Record<string, string> = {};

  // Pass projectId as GOOGLE_CLOUD_PROJECT if configured (for organization/enterprise accounts)
  if (isGeminiCliProvider(provider.provider) && provider.provider.projectId) {
    environmentVariables.GOOGLE_CLOUD_PROJECT = provider.provider.projectId;
  }

  return {
    modelName: `gemini-cli/${modelId}`,
    environmentVariables,
  };
};

export const createGeminiCliLlm = async (
  profile: ProviderProfile,
  model: Model,
  _settings: SettingsData,
  _projectDir: string,
  _toolSet?: ToolSet,
  _systemPrompt?: string,
  _providerMetadata?: unknown,
): Promise<LanguageModelV2> => {
  const projectId = isGeminiCliProvider(profile.provider) ? profile.provider.projectId : undefined;

  logger.debug('Creating Gemini CLI LLM', {
    model: model.id,
    projectId,
  });

  // Dynamic import required: ai-sdk-provider-gemini-cli is an ESM module
  // and cannot be loaded synchronously in Electron's CommonJS environment
  const { createGeminiProvider } = await import('ai-sdk-provider-gemini-cli');

  // Set GOOGLE_CLOUD_PROJECT env var if projectId is configured (for organization/enterprise accounts)
  // Note: The underlying @google/gemini-cli-core library only reads projectId from process.env,
  // so we must set it here. This is a limitation of the library, not our implementation.
  if (projectId) {
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
  }

  const gemini = createGeminiProvider({ authType: 'oauth-personal' });

  return gemini(model.id);
};

const getGeminiCliUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  _providerMetadata?: unknown,
): UsageReportData => {
  // Use default usage report for now
  // Gemini CLI may provide custom metadata like Claude does
  return getDefaultUsageReport(task, provider, model, usage);
};

const getGeminiCliProviderParameters = (): Record<string, unknown> => {
  return {};
};

const isGeminiCliRetryable = (error: unknown): boolean => {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // Gemini CLI: Project ID required for workspace accounts - non-retryable
  if (errorMessage.includes('GOOGLE_CLOUD_PROJECT') || errorMessage.includes('GOOGLE_CLOUD_PROJECT_ID')) {
    return false;
  }

  // All other errors are retryable by default
  return true;
};

export const geminiCliProviderStrategy: LlmProviderStrategy = {
  createLlm: createGeminiCliLlm,
  getUsageReport: getGeminiCliUsageReport,
  loadModels: loadGeminiCliModels,
  hasEnvVars: hasGeminiCliEnvVars,
  getAiderMapping: getGeminiCliAiderMapping,
  getProviderParameters: getGeminiCliProviderParameters,
  isRetryable: isGeminiCliRetryable,
};

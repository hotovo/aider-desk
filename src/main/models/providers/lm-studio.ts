import { ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isLmStudioProvider, LmStudioProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

export const loadLmStudioModels = async (profile: ProviderProfile, modelsInfo: Record<string, ModelInfo>): Promise<LoadModelsResponse> => {
  if (!isLmStudioProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as LmStudioProvider;
  const baseUrl = provider.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('LM_STUDIO_API_BASE', undefined);
  const effectiveBaseUrl = baseUrl || environmentVariable?.value || '';

  if (!effectiveBaseUrl) {
    return { models: [], success: false };
  }

  try {
    const normalized = effectiveBaseUrl.replace(/\/+$/g, ''); // Remove all trailing slashes
    const response = await fetch(`${normalized}/models`);
    if (!response.ok) {
      const errorMsg = `LM Studio models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.warn(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data?.data?.map((model: { id: string; max_context_length: number }) => {
        const modelParts = model.id.split('/');
        const info = modelsInfo[modelParts[modelParts.length - 1]];
        return {
          id: model.id,
          providerId: profile.id,
          ...info, // Merge with existing model info if available
          maxInputTokens: model.max_context_length,
        };
      }) || [];
    logger.info(`Loaded ${models.length} LM Studio models from ${effectiveBaseUrl} for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading LM Studio models';
    logger.error('Error loading LM Studio models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasLmStudioEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  const base = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', projectDir, settings)?.value;
  return !!base;
};

export const getLmStudioAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const lmstudioProvider = provider.provider as LmStudioProvider;
  const envVars: Record<string, string> = {};

  if (lmstudioProvider.baseUrl) {
    envVars.LM_STUDIO_API_BASE = lmstudioProvider.baseUrl;
    envVars.LM_STUDIO_API_KEY = 'dummy-api-key';
  }

  return {
    modelName: `lm_studio/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createLmStudioLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as LmStudioProvider;
  const baseUrl = provider.baseUrl || env['LMSTUDIO_API_BASE'];

  if (!baseUrl) {
    throw new Error('Base URL is required for LMStudio provider. Set it in Providers settings or via the LMSTUDIO_API_BASE environment variable.');
  }

  const lmStudioProvider = createOpenAICompatible({
    name: 'lmstudio',
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return lmStudioProvider(model);
};

// === Cost and Usage Functions ===
export const calculateLmStudioCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, _providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  // Standard cost calculation without caching adjustments
  const inputCost = sentTokens * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;

  return inputCost + outputCost;
};

export const getLmStudioUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  _providerMetadata?: unknown,
): UsageReportData => {
  return {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const lmStudioProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createLmStudioLlm,
  calculateCost: calculateLmStudioCost,
  getUsageReport: getLmStudioUsageReport,

  // Model discovery functions
  loadModels: loadLmStudioModels,
  hasEnvVars: hasLmStudioEnvVars,
  getAiderMapping: getLmStudioAiderMapping,
};

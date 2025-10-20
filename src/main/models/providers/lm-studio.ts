import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isLmStudioProvider, LmStudioProvider } from '@common/agent';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

export const loadLmStudioModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isLmStudioProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider as LmStudioProvider;
  const baseUrl = provider.baseUrl || '';
  const environmentVariable = getEffectiveEnvironmentVariable('LM_STUDIO_API_BASE', settings);
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

export const hasLmStudioEnvVars = (settings: SettingsData): boolean => {
  const base = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', settings, undefined)?.value;
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
export const createLmStudioLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as LmStudioProvider;
  let baseUrl = provider.baseUrl;

  if (!baseUrl) {
    const effectiveVar = getEffectiveEnvironmentVariable('LMSTUDIO_API_BASE', settings, projectDir);
    if (effectiveVar) {
      baseUrl = effectiveVar.value;
      logger.debug(`Loaded LMSTUDIO_API_BASE from ${effectiveVar.source}`);
    }
  }

  if (!baseUrl) {
    throw new Error('Base URL is required for LMStudio provider. Set it in Providers settings or via the LMSTUDIO_API_BASE environment variable.');
  }

  const lmStudioProvider = createOpenAICompatible({
    name: 'lmstudio',
    baseURL: baseUrl,
    headers: profile.headers,
  });
  return lmStudioProvider(model.id);
};

// === Cost and Usage Functions ===
export const calculateLmStudioCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getLmStudioUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally (no caching for LM Studio)
  const messageCost = calculateLmStudioCost(model, sentTokens, receivedTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

// === Complete Strategy Implementation ===
export const lmStudioProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createLmStudioLlm,
  getUsageReport: getLmStudioUsageReport,

  // Model discovery functions
  loadModels: loadLmStudioModels,
  hasEnvVars: hasLmStudioEnvVars,
  getAiderMapping: getLmStudioAiderMapping,
};

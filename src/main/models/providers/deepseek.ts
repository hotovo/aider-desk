import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { DeepseekProvider, isDeepseekProvider } from '@common/agent';
import { createDeepSeek } from '@ai-sdk/deepseek';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

export const loadDeepseekModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isDeepseekProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as DeepseekProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey || apiKeyEnv?.value || ''}` },
    });
    if (!response.ok) {
      const errorMsg = `DeepSeek models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, response.status, response.statusText);
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return {
          id: m.id,
          providerId: profile.id,
          ...info,
        };
      }) || [];

    logger.info(`Loaded ${models.length} DeepSeek models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading DeepSeek models';
    logger.error('Error loading DeepSeek models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasDeepseekEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings, undefined)?.value;
};

export const getDeepseekAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const deepseekProvider = provider.provider as DeepseekProvider;
  const envVars: Record<string, string> = {};

  if (deepseekProvider.apiKey) {
    envVars.DEEPSEEK_API_KEY = deepseekProvider.apiKey;
  }

  return {
    modelName: `deepseek/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createDeepseekLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as DeepseekProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('DEEPSEEK_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded DEEPSEEK_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Deepseek API key is required in Providers settings or Aider environment variables (DEEPSEEK_API_KEY)');
  }

  const deepseekProvider = createDeepSeek({
    apiKey,
    headers: profile.headers,
  });
  return deepseekProvider(model.id);
};

// === Cost and Usage Functions ===
export const calculateDeepseekCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getDeepseekUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally (no caching for DeepSeek)
  const messageCost = calculateDeepseekCost(model, sentTokens, receivedTokens, cacheReadTokens);

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
export const deepseekProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createDeepseekLlm,
  getUsageReport: getDeepseekUsageReport,

  // Model discovery functions
  loadModels: loadDeepseekModels,
  hasEnvVars: hasDeepseekEnvVars,
  getAiderMapping: getDeepseekAiderMapping,
};

import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { CerebrasProvider, isCerebrasProvider } from '@common/agent';
import { createCerebras } from '@ai-sdk/cerebras';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, LlmProviderStrategy } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils/environment';
import { LoadModelsResponse } from '@/models/types';
import { Task } from '@/task/task';

interface CerebrasModel {
  id: string;
  max_context_length?: number;
  description?: string;
}

export const loadCerebrasModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isCerebrasProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    logger.debug('Cerebras API key is required. Please set it in Providers settings or via CEREBRAS_API_KEY environment variable.');
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { Authorization: `Bearer ${effectiveApiKey}` },
    });

    if (!response.ok) {
      const errorMsg = `Cerebras models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg, {
        status: response.status,
        statusText: response.statusText,
      });
      return { models: [], success: false, error: errorMsg };
    }

    const data = await response.json();
    const models =
      data.data
        ?.filter((model: CerebrasModel) => {
          // Filter out models that don't have pricing information
          return modelsInfo[model.id];
        })
        .map((model: CerebrasModel) => {
          const info = modelsInfo[model.id];
          return {
            id: model.id,
            providerId: profile.id,
            ...info,
            maxInputTokens: model.max_context_length || info?.maxInputTokens,
          };
        }) || [];

    logger.info(`Loaded ${models.length} Cerebras models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Cerebras models';
    logger.error('Error loading Cerebras models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasCerebrasEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings, undefined)?.value;
};

export const getCerebrasAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const cerebrasProvider = provider.provider as CerebrasProvider;
  const envVars: Record<string, string> = {};

  if (cerebrasProvider.apiKey) {
    envVars.CEREBRAS_API_KEY = cerebrasProvider.apiKey;
  }

  return {
    modelName: `cerebras/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createCerebrasLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as CerebrasProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('CEREBRAS_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded CEREBRAS_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Cerebras API key is required in Providers settings or Aider environment variables (CEREBRAS_API_KEY)');
  }

  const cerebrasProvider = createCerebras({
    apiKey,
    headers: profile.headers,
  });
  return cerebrasProvider(model.id);
};

// === Cost and Usage Functions ===
export const calculateCerebrasCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getCerebrasUsageReport = (task: Task, provider: ProviderProfile, model: Model, usage: LanguageModelUsage): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cachedInputTokens || 0;
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally (no caching for Cerebras)
  const messageCost = calculateCerebrasCost(model, sentTokens, receivedTokens, cacheReadTokens);

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
export const cerebrasProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createCerebrasLlm,
  getUsageReport: getCerebrasUsageReport,

  // Model discovery functions
  loadModels: loadCerebrasModels,
  hasEnvVars: hasCerebrasEnvVars,
  getAiderMapping: getCerebrasAiderMapping,
};

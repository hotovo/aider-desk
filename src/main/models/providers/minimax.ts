import { createAnthropic } from '@ai-sdk/anthropic';
import { isMinimaxProvider, MinimaxProvider } from '@common/agent';
import { Model, ProviderProfile, SettingsData, UsageReportData } from '@common/types';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import logger from '@/logger';
import { AiderModelMapping, CacheControl, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { Task } from '@/task/task';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadMinimaxModels = async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
  if (!isMinimaxProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }
  // Hardcoded MiniMax models - no API call needed
  const hardcodedModels: Model[] = [
    {
      id: 'MiniMax-M2',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.00000004, // 0.04 per 1M tokens
      temperature: 0.5,
    },
    {
      id: 'MiniMax-M2-Stable',
      providerId: profile.id,
      maxInputTokens: 204800,
      maxOutputTokensLimit: 131072,
      inputCostPerToken: 0.0000003, // 0.3 per 1M tokens
      outputCostPerToken: 0.0000012, // 1.2 per 1M tokens
      cacheReadInputTokenCost: 0.00000003, // 0.03 per 1M tokens
      cacheWriteInputTokenCost: 0.00000004, // 0.04 per 1M tokens
      temperature: 0.5,
    },
  ];

  return { models: hardcodedModels, success: true };
};

export const hasMinimaxEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, undefined)?.value;
};

export const getMinimaxAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const minimaxProvider = provider.provider as MinimaxProvider;
  const envVars: Record<string, string> = {};

  envVars.OPENAI_API_BASE = 'https://api.minimax.io/v1';
  if (minimaxProvider.apiKey) {
    envVars.OPENAI_API_KEY = minimaxProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
  }

  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createMinimaxLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as MinimaxProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('MINIMAX_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded MINIMAX_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Minimax API key is required in Providers settings or Aider environment variables (MINIMAX_API_KEY)');
  }

  const anthropicProvider = createAnthropic({
    apiKey,
    baseURL: 'https://api.minimax.io/anthropic/v1',
    headers: profile.headers,
  });
  return anthropicProvider(model.id);
};

type MinimaxMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateMinimaxCost = (
  model: Model,
  sentTokens: number,
  receivedTokens: number,
  cacheWriteTokens: number = 0,
  cacheReadTokens: number = 0,
): number => {
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheWriteInputTokenCost = model.cacheWriteInputTokenCost ?? inputCostPerToken;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? 0;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCreationCost = cacheWriteTokens * cacheWriteInputTokenCost;
  const cacheReadCost = cacheReadTokens * cacheReadInputTokenCost;
  const cacheCost = cacheCreationCost + cacheReadCost;

  return inputCost + outputCost + cacheCost;
};

export const getMinimaxUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache tokens from provider metadata
  const { anthropic } = (providerMetadata as MinimaxMetadata) || {};
  const cacheWriteTokens = anthropic?.cacheCreationInputTokens ?? 0;
  const cacheReadTokens = anthropic?.cacheReadInputTokens ?? usage?.cachedInputTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateMinimaxCost(model, sentTokens, receivedTokens, cacheWriteTokens, cacheReadTokens);

  return {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheWriteTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };
};

// === Configuration Helper Functions ===
export const getMinimaxCacheControl = (): CacheControl | undefined => {
  return {
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
    placement: 'message',
  };
};

// === Complete Strategy Implementation ===
export const minimaxProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createMinimaxLlm,
  getUsageReport: getMinimaxUsageReport,

  // Model discovery functions
  loadModels: loadMinimaxModels,
  hasEnvVars: hasMinimaxEnvVars,
  getAiderMapping: getMinimaxAiderMapping,

  // Configuration helpers
  getCacheControl: getMinimaxCacheControl,
};

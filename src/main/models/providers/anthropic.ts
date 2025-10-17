import { createAnthropic } from '@ai-sdk/anthropic';
import { AnthropicProvider, isAnthropicProvider } from '@common/agent';
import { Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AiderModelMapping, CacheControl, LlmProviderStrategy } from '@/models';
import { LoadModelsResponse } from '@/models/types';
import { Task } from '@/task/task';
import { getEffectiveEnvironmentVariable } from '@/utils';

export const loadAnthropicModels = async (
  profile: ProviderProfile,
  modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isAnthropicProvider(profile.provider)) {
    return {
      models: [],
      success: false,
    };
  }

  const provider = profile.provider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings);

  if (!apiKey && !apiKeyEnv?.value) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey || apiKeyEnv?.value || '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!response.ok) {
      return {
        models: [],
        success: false,
        error: `Anthropic models API response failed: ${response.status} ${response.statusText} ${await response.text()}`,
      };
    }

    const data = await response.json();
    const models =
      data.data?.map((m: { id: string }) => {
        const info = modelsInfo[m.id];
        return {
          id: m.id,
          providerId: profile.id,
          ...info,
        } satisfies Model;
      }) || [];

    return { models, success: true };
  } catch (error) {
    return {
      models: [],
      success: false,
      error: typeof error === 'string' ? error : error instanceof Error ? error.message : JSON.stringify(error),
    };
  }
};

export const hasAnthropicEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('ANTHROPIC_API_KEY', settings, undefined)?.value;
};

export const getAnthropicAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const anthropicProvider = provider.provider as AnthropicProvider;
  const envVars: Record<string, string> = {};

  if (anthropicProvider.apiKey) {
    envVars.ANTHROPIC_API_KEY = anthropicProvider.apiKey;
  }

  return {
    modelName: `anthropic/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createAnthropicLlm = (profile: ProviderProfile, model: Model, env: Record<string, string | undefined> = {}): LanguageModelV2 => {
  const provider = profile.provider as AnthropicProvider;
  const apiKey = provider.apiKey || env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    throw new Error('Anthropic API key is required in Providers settings or Aider environment variables (ANTHROPIC_API_KEY)');
  }

  const anthropicProvider = createAnthropic({
    apiKey,
    headers: profile.headers,
  });
  return anthropicProvider(model.id);
};

type AnthropicMetadata = {
  anthropic: {
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
};

// === Cost and Usage Functions ===
export const calculateAnthropicCost = (
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

export const getAnthropicUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache tokens from provider metadata
  const { anthropic } = (providerMetadata as AnthropicMetadata) || {};
  const cacheWriteTokens = anthropic?.cacheCreationInputTokens ?? 0;
  const cacheReadTokens = anthropic?.cacheReadInputTokens ?? usage?.cachedInputTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateAnthropicCost(model, sentTokens, receivedTokens, cacheWriteTokens, cacheReadTokens);

  const usageReportData: UsageReportData = {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheWriteTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };

  return usageReportData;
};

// === Configuration Helper Functions ===
export const getAnthropicCacheControl = (): CacheControl => {
  return {
    anthropic: {
      cacheControl: { type: 'ephemeral' },
    },
  };
};

// === Complete Strategy Implementation ===
export const anthropicProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createAnthropicLlm,
  getUsageReport: getAnthropicUsageReport,

  // Model discovery functions
  loadModels: loadAnthropicModels,
  hasEnvVars: hasAnthropicEnvVars,
  getAiderMapping: getAnthropicAiderMapping,

  // Configuration helpers
  getCacheControl: getAnthropicCacheControl,
};

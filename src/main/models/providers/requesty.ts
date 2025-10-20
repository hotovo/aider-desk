import { AgentProfile, Model, ModelInfo, ProviderProfile, ReasoningEffort, SettingsData, UsageReportData } from '@common/types';
import { isRequestyProvider, LlmProvider, RequestyProvider } from '@common/agent';
import { createRequesty, type RequestyProviderMetadata } from '@requesty/ai-sdk';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, CacheControl, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

interface RequestyModel {
  id: string;
  created: number;
  owned_by: string;
  input_price: number;
  caching_price?: number;
  cached_price?: number;
  output_price: number;
  max_output_tokens: number;
  context_window: number;
  supports_caching: boolean;
  supports_vision: boolean;
  supports_computer_use: boolean;
  supports_reasoning: boolean;
  description: string;
}

interface RequestyModelsResponse {
  data: RequestyModel[];
}

export const loadRequestyModels = async (
  profile: ProviderProfile,
  _modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isRequestyProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as RequestyProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://router.requesty.ai/v1/models', {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      const errorMsg = `Requesty models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as RequestyModelsResponse;
    const models =
      data.data?.map((model: RequestyModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: model.context_window,
          maxOutputTokens: model.max_output_tokens,
          inputCostPerToken: model.input_price,
          outputCostPerToken: model.output_price,
          cacheWriteInputTokenCost: model.caching_price ? model.caching_price : undefined,
          cacheReadInputTokenCost: model.cached_price ? model.cached_price : undefined,
        } satisfies Model;
      }) || [];
    logger.info(`Loaded ${models.length} Requesty models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading Requesty models';
    logger.warn('Failed to fetch Requesty models via API:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasRequestyEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('REQUESTY_API_KEY', settings, undefined)?.value;
};

export const getRequestyAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const requestyProvider = provider.provider as RequestyProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: 'https://router.requesty.ai/v1',
  };

  if (requestyProvider.apiKey) {
    envVars.OPENAI_API_KEY = requestyProvider.apiKey;
  }

  // Requesty doesn't have direct Aider support, so we use OpenAI-compatible endpoint
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createRequestyLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as RequestyProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded REQUESTY_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('Requesty API key is required in Providers settings or Aider environment variables (REQUESTY_API_KEY)');
  }

  const providerOverrides = model.providerOverrides as Partial<RequestyProvider> | undefined;
  const useAutoCache = providerOverrides?.useAutoCache ?? provider.useAutoCache;
  const reasoningEffort = providerOverrides?.reasoningEffort ?? provider.reasoningEffort;

  const requestyProvider = createRequesty({
    apiKey,
    compatibility: 'strict',
    headers: {
      ...profile.headers,
      'HTTP-Referer': AIDER_DESK_WEBSITE,
      'X-Title': AIDER_DESK_TITLE,
    },
    extraBody: {
      ...(useAutoCache && { requesty: { auto_cache: true } }),
    },
  });
  return requestyProvider(model.id, {
    includeReasoning: reasoningEffort !== undefined,
    reasoningEffort: reasoningEffort === ReasoningEffort.None ? undefined : reasoningEffort,
  });
};

// === Cost and Usage Functions ===
export const calculateRequestyCost = (
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

  const cacheCreationCost = cacheWriteTokens * cacheWriteInputTokenCost;
  const cacheReadCost = cacheReadTokens * cacheReadInputTokenCost;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheCreationCost + cacheReadCost;

  return inputCost + outputCost + cacheCost;
};

export const getRequestyUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache tokens from provider metadata
  const { requesty } = providerMetadata as RequestyProviderMetadata;
  const cacheWriteTokens = requesty?.usage?.cachingTokens ?? 0;
  const cacheReadTokens = requesty?.usage?.cachedTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateRequestyCost(model, sentTokens, receivedTokens, cacheWriteTokens, cacheReadTokens);

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
export const getRequestyCacheControl = (profile: AgentProfile, llmProvider: LlmProvider): CacheControl => {
  if (isRequestyProvider(llmProvider) && !llmProvider.useAutoCache) {
    if (profile.model?.startsWith('anthropic/')) {
      return {
        requesty: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const requestyProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createRequestyLlm,
  getUsageReport: getRequestyUsageReport,

  // Model discovery functions
  loadModels: loadRequestyModels,
  hasEnvVars: hasRequestyEnvVars,
  getAiderMapping: getRequestyAiderMapping,

  // Configuration helpers
  getCacheControl: getRequestyCacheControl,
};

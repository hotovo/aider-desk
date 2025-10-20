import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isOpenRouterProvider, LlmProvider, OpenRouterProvider } from '@common/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import type { LanguageModelUsage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, CacheControl, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Task } from '@/task/task';

interface OpenRouterTopProvider {
  is_moderated: boolean;
  context_length: number;
  max_completion_tokens: number;
}

interface OpenRouterPricing {
  prompt: string;
  completion: string;
  input_cache_read?: string;
  input_cache_write?: string;
}

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  top_provider: OpenRouterTopProvider;
  pricing: OpenRouterPricing;
  context_length: number;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export const loadOpenrouterModels = async (
  profile: ProviderProfile,
  _modelsInfo: Record<string, ModelInfo>,
  settings: SettingsData,
): Promise<LoadModelsResponse> => {
  if (!isOpenRouterProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenRouterProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', settings);
  const effectiveApiKey = apiKey || apiKeyEnv?.value || '';

  if (!effectiveApiKey) {
    return { models: [], success: false };
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    if (!response.ok) {
      const errorMsg = `OpenRouter models API response failed: ${response.status} ${response.statusText} ${await response.text()}`;
      logger.error(errorMsg);
      return { models: [], success: false, error: errorMsg };
    }

    const data = (await response.json()) as OpenRouterModelsResponse;
    const models =
      data.data?.map((model: OpenRouterModel) => {
        return {
          id: model.id,
          providerId: profile.id,
          maxInputTokens: model.context_length,
          maxOutputTokens: model.top_provider.max_completion_tokens,
          inputCostPerToken: Number(model.pricing.prompt),
          outputCostPerToken: Number(model.pricing.completion),
          cacheWriteInputTokenCost: model.pricing.input_cache_write ? Number(model.pricing.input_cache_write) : undefined,
          cacheReadInputTokenCost: model.pricing.input_cache_read ? Number(model.pricing.input_cache_read) : undefined,
        } satisfies Model;
      }) || [];

    logger.info(`Loaded ${models.length} OpenRouter models for profile ${profile.id}`);
    return { models, success: true };
  } catch (error) {
    const errorMsg = typeof error === 'string' ? error : error instanceof Error ? error.message : 'Unknown error loading OpenRouter models';
    logger.error('Error loading OpenRouter models:', error);
    return { models: [], success: false, error: errorMsg };
  }
};

export const hasOpenRouterEnvVars = (settings: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', settings, undefined)?.value;
};

export const getOpenRouterAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const openrouterProvider = provider.provider as OpenRouterProvider;
  const envVars: Record<string, string> = {};

  if (openrouterProvider.apiKey) {
    envVars.OPENROUTER_API_KEY = openrouterProvider.apiKey;
  }

  return {
    modelName: `openrouter/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createOpenRouterLlm = (profile: ProviderProfile, model: Model, settings: SettingsData, projectDir: string): LanguageModelV2 => {
  const provider = profile.provider as OpenRouterProvider;
  let apiKey = provider.apiKey;

  if (!apiKey) {
    const effectiveVar = getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', settings, projectDir);
    if (effectiveVar) {
      apiKey = effectiveVar.value;
      logger.debug(`Loaded OPENROUTER_API_KEY from ${effectiveVar.source}`);
    }
  }

  if (!apiKey) {
    throw new Error('OpenRouter API key is required in Providers settings or Aider environment variables (OPENROUTER_API_KEY)');
  }

  const providerOverrides = model.providerOverrides as Partial<OpenRouterProvider> | undefined;
  const requireParameters = providerOverrides?.requireParameters ?? provider.requireParameters;
  const order = providerOverrides?.order ?? provider.order;
  const only = providerOverrides?.only ?? provider.only;
  const ignore = providerOverrides?.ignore ?? provider.ignore;
  const allowFallbacks = providerOverrides?.allowFallbacks ?? provider.allowFallbacks;
  const dataCollection = providerOverrides?.dataCollection ?? provider.dataCollection;
  const quantizations = providerOverrides?.quantizations ?? provider.quantizations;
  const sort = providerOverrides?.sort ?? provider.sort;

  const openRouter = createOpenRouter({
    apiKey,
    compatibility: 'strict',
    headers: {
      ...profile.headers,
      'HTTP-Referer': AIDER_DESK_WEBSITE,
      'X-Title': AIDER_DESK_TITLE,
    },
    extraBody: {
      provider: {
        require_parameters: requireParameters,
        order: order?.length ? order : undefined,
        only: only?.length ? only : undefined,
        ignore: ignore?.length ? ignore : undefined,
        allow_fallbacks: allowFallbacks,
        data_collection: dataCollection,
        quantizations: quantizations?.length ? quantizations : undefined,
        sort: sort || undefined,
      },
    },
  });
  return openRouter.chat(model.id, {
    usage: {
      include: true,
    },
  });
};

type OpenRouterMetadata = {
  openrouter: {
    usage: {
      completionTokens: number;
      completionTokensDetails: {
        reasoningTokens: number;
      };
      cost: number;
      promptTokens: number;
      promptTokensDetails?: {
        cachedTokens: number;
      };
      totalTokens: number;
    };
  };
};

// === Cost and Usage Functions ===
export const calculateOpenRouterCost = (model: Model, sentTokens: number, receivedTokens: number, cacheReadTokens: number = 0): number => {
  // OpenRouter provides cost directly from provider metadata, but we'll calculate it as fallback
  const inputCostPerToken = model.inputCostPerToken ?? 0;
  const outputCostPerToken = model.outputCostPerToken ?? 0;
  const cacheReadInputTokenCost = model.cacheReadInputTokenCost ?? inputCostPerToken;

  const inputCost = sentTokens * inputCostPerToken;
  const outputCost = receivedTokens * outputCostPerToken;
  const cacheCost = cacheReadTokens * cacheReadInputTokenCost;

  return inputCost + outputCost + cacheCost;
};

export const getOpenRouterUsageReport = (
  task: Task,
  provider: ProviderProfile,
  model: Model,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const totalSentTokens = usage.inputTokens || 0;
  const receivedTokens = usage.outputTokens || 0;

  // Extract cache read tokens from provider metadata
  const { openrouter } = providerMetadata as OpenRouterMetadata;
  const cacheReadTokens = openrouter.usage.promptTokensDetails?.cachedTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Use cost from provider metadata if available, otherwise calculate
  const messageCost = openrouter.usage.cost ?? calculateOpenRouterCost(model, sentTokens, receivedTokens, cacheReadTokens);

  const usageReportData: UsageReportData = {
    model: `${provider.id}/${model.id}`,
    sentTokens,
    receivedTokens,
    cacheReadTokens,
    messageCost,
    agentTotalCost: task.task.agentTotalCost + messageCost,
  };

  return usageReportData;
};

// === Configuration Helper Functions ===
export const getOpenRouterCacheControl = (profile: AgentProfile, llmProvider: LlmProvider): CacheControl => {
  if (isOpenRouterProvider(llmProvider)) {
    if (profile.model?.startsWith('anthropic/')) {
      return {
        openrouter: {
          cacheControl: { type: 'ephemeral' },
        },
      };
    }
  }

  return undefined;
};

// === Complete Strategy Implementation ===
export const openrouterProviderStrategy: LlmProviderStrategy = {
  // Core LLM functions
  createLlm: createOpenRouterLlm,
  getUsageReport: getOpenRouterUsageReport,

  // Model discovery functions
  loadModels: loadOpenrouterModels,
  hasEnvVars: hasOpenRouterEnvVars,
  getAiderMapping: getOpenRouterAiderMapping,

  // Configuration helpers
  getCacheControl: getOpenRouterCacheControl,
};

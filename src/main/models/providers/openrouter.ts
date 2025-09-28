import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isOpenRouterProvider, LlmProvider, OpenRouterProvider } from '@common/agent';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, CacheControl, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

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

export const loadOpenrouterModels = async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
  if (!isOpenRouterProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as OpenRouterProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', undefined);
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

export const hasOpenRouterEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('OPENROUTER_API_KEY', projectDir, settings)?.value;
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
export const createOpenRouterLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as OpenRouterProvider;
  const apiKey = provider.apiKey || env['OPENROUTER_API_KEY'];

  if (!apiKey) {
    throw new Error('OpenRouter API key is required in Providers settings or Aider environment variables (OPENROUTER_API_KEY)');
  }

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
        require_parameters: provider.requireParameters,
        order: provider.order?.length ? provider.order : undefined,
        only: provider.only?.length ? provider.only : undefined,
        ignore: provider.ignore?.length ? provider.ignore : undefined,
        allow_fallbacks: provider.allowFallbacks,
        data_collection: provider.dataCollection,
        quantizations: provider.quantizations?.length ? provider.quantizations : undefined,
        sort: provider.sort || undefined,
      },
    },
  });
  return openRouter.chat(model, {
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
export const calculateOpenRouterCost = (
  _modelInfo: ModelInfo | undefined,
  _sentTokens: number,
  _receivedTokens: number,
  providerMetadata?: unknown,
): number => {
  const { openrouter } = providerMetadata as OpenRouterMetadata;
  return openrouter.usage.cost;
};

export const getOpenRouterUsageReport = (
  project: Project,
  provider: ProviderProfile,
  modelId: string,
  messageCost: number,
  usage: LanguageModelUsage,
  providerMetadata?: unknown,
): UsageReportData => {
  const usageReportData: UsageReportData = {
    model: `${provider.id}/${modelId}`,
    sentTokens: usage.promptTokens,
    receivedTokens: usage.completionTokens,
    messageCost,
    agentTotalCost: project.agentTotalCost + messageCost,
  };

  const { openrouter } = providerMetadata as OpenRouterMetadata;
  usageReportData.cacheReadTokens = openrouter.usage.promptTokensDetails?.cachedTokens;
  usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;

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
  calculateCost: calculateOpenRouterCost,
  getUsageReport: getOpenRouterUsageReport,

  // Model discovery functions
  loadModels: loadOpenrouterModels,
  hasEnvVars: hasOpenRouterEnvVars,
  getAiderMapping: getOpenRouterAiderMapping,

  // Configuration helpers
  getCacheControl: getOpenRouterCacheControl,
};

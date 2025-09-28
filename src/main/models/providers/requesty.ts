import { AgentProfile, Model, ModelInfo, ProviderProfile, SettingsData, UsageReportData } from '@common/types';
import { isRequestyProvider, LlmProvider, RequestyProvider } from '@common/agent';
import { createRequesty, type RequestyProviderMetadata } from '@requesty/ai-sdk';

import type { LanguageModel, LanguageModelUsage } from 'ai';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, LlmProviderStrategy, CacheControl, LoadModelsResponse } from '@/models';
import logger from '@/logger';
import { getEffectiveEnvironmentVariable } from '@/utils';
import { Project } from '@/project/project';

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

export const loadRequestyModels = async (profile: ProviderProfile): Promise<LoadModelsResponse> => {
  if (!isRequestyProvider(profile.provider)) {
    return { models: [], success: false };
  }

  const provider = profile.provider as RequestyProvider;
  const apiKey = provider.apiKey || '';
  const apiKeyEnv = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', undefined);
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

export const hasRequestyEnvVars = (projectDir?: string, settings?: SettingsData): boolean => {
  return !!getEffectiveEnvironmentVariable('REQUESTY_API_KEY', projectDir, settings)?.value;
};

export const getRequestyAiderMapping = (provider: ProviderProfile, modelId: string): AiderModelMapping => {
  const requestyProvider = provider.provider as RequestyProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: 'https://router.requesty.ai/v1',
  };
  const apiKeyEnv = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', undefined);

  if (requestyProvider.apiKey) {
    envVars.OPENAI_API_KEY = requestyProvider.apiKey;
  }
  if (apiKeyEnv?.value) {
    envVars.OPENAI_API_KEY = apiKeyEnv.value;
  }

  // Requesty doesn't have direct Aider support, so we use OpenAI-compatible endpoint
  return {
    modelName: `openai/${modelId}`,
    environmentVariables: envVars,
  };
};

// === LLM Creation Functions ===
export const createRequestyLlm = (profile: ProviderProfile, model: string, env: Record<string, string | undefined> = {}): LanguageModel => {
  const provider = profile.provider as RequestyProvider;
  const apiKey = provider.apiKey || env['REQUESTY_API_KEY'];

  if (!apiKey) {
    throw new Error('Requesty API key is required in Providers settings or Aider environment variables (REQUESTY_API_KEY)');
  }

  const requestyProvider = createRequesty({
    apiKey,
    compatibility: 'strict',
    headers: {
      ...profile.headers,
      'HTTP-Referer': AIDER_DESK_WEBSITE,
      'X-Title': AIDER_DESK_TITLE,
    },
    extraBody: {
      ...(provider.useAutoCache && { requesty: { auto_cache: true } }),
    },
  });
  return requestyProvider(model, {
    includeReasoning: provider.reasoningEffort !== undefined,
    reasoningEffort: provider.reasoningEffort === undefined ? undefined : provider.reasoningEffort,
  });
};

// === Cost and Usage Functions ===
export const calculateRequestyCost = (modelInfo: ModelInfo | undefined, sentTokens: number, receivedTokens: number, providerMetadata?: unknown): number => {
  if (!modelInfo) {
    return 0;
  }

  const { requesty } = providerMetadata as RequestyProviderMetadata;
  const cachingTokens = requesty.usage?.cachingTokens ?? 0;
  const cachedTokens = requesty.usage?.cachedTokens ?? 0;

  const cacheCreationCost = cachingTokens * (modelInfo.cacheWriteInputTokenCost ?? modelInfo.inputCostPerToken);
  const cacheReadCost = cachedTokens * (modelInfo.cacheReadInputTokenCost ?? 0);

  const inputCost = (sentTokens - cachedTokens) * modelInfo.inputCostPerToken;
  const outputCost = receivedTokens * modelInfo.outputCostPerToken;
  const cacheCost = cacheCreationCost + cacheReadCost;

  return inputCost + outputCost + cacheCost;
};

export const getRequestyUsageReport = (
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

  const { requesty } = providerMetadata as RequestyProviderMetadata;
  usageReportData.cacheWriteTokens = requesty.usage?.cachingTokens;
  usageReportData.cacheReadTokens = requesty.usage?.cachedTokens;
  usageReportData.sentTokens -= usageReportData.cacheReadTokens ?? 0;

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
  calculateCost: calculateRequestyCost,
  getUsageReport: getRequestyUsageReport,

  // Model discovery functions
  loadModels: loadRequestyModels,
  hasEnvVars: hasRequestyEnvVars,
  getAiderMapping: getRequestyAiderMapping,

  // Configuration helpers
  getCacheControl: getRequestyCacheControl,
};

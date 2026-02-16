import { AgentProfile, ContextUserMessage, Model, ProviderProfile, ReasoningEffort, SettingsData, UsageReportData } from '@common/types';
import { DEFAULT_MODEL_TEMPERATURE, isRequestyProvider, LlmProvider, RequestyProvider } from '@common/agent';
import { createRequesty, type RequestyProviderMetadata } from '@requesty/ai-sdk';
import { v4 as uuidv4 } from 'uuid';

import type { LanguageModelUsage, ModelMessage } from 'ai';
import type { LanguageModelV2 } from '@ai-sdk/provider';

import { AIDER_DESK_TITLE, AIDER_DESK_WEBSITE } from '@/constants';
import { AiderModelMapping, CacheControl, LlmProviderStrategy, LoadModelsResponse } from '@/models';
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

const getDefaultModelTemperature = (modelId: string) => {
  if (modelId.includes('claude')) {
    return undefined;
  }
  if (modelId.includes('gemini')) {
    return 0.7;
  }
  if (modelId.includes('gpt-5')) {
    return undefined;
  }
  if (modelId.includes('qwen')) {
    return 0.55;
  }
  return DEFAULT_MODEL_TEMPERATURE;
};

const loadRequestyModels = async (profile: ProviderProfile, settings: SettingsData): Promise<LoadModelsResponse> => {
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
          maxOutputTokensLimit: model.max_output_tokens === 0 ? undefined : model.max_output_tokens,
          inputCostPerToken: model.input_price,
          outputCostPerToken: model.output_price,
          cacheWriteInputTokenCost: model.caching_price ? model.caching_price : undefined,
          cacheReadInputTokenCost: model.cached_price ? model.cached_price : undefined,
          temperature: getDefaultModelTemperature(model.id),
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

export const getRequestyAiderMapping = (provider: ProviderProfile, modelId: string, settings: SettingsData, projectDir: string): AiderModelMapping => {
  const requestyProvider = provider.provider as RequestyProvider;
  const envVars: Record<string, string> = {
    OPENAI_API_BASE: 'https://router.requesty.ai/v1',
  };

  if (requestyProvider.apiKey) {
    envVars.OPENAI_API_KEY = requestyProvider.apiKey;
  } else {
    const effectiveVar = getEffectiveEnvironmentVariable('REQUESTY_API_KEY', settings, projectDir);
    if (effectiveVar) {
      envVars.OPENAI_API_KEY = effectiveVar.value;
    }
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
  const { requesty } = providerMetadata ? (providerMetadata as RequestyProviderMetadata) : {};
  logger.info('Requesty usage report', {
    requesty,
    usage,
  });
  const cacheWriteTokens = requesty?.usage?.cachingTokens ?? 0;
  const cacheReadTokens = requesty?.usage?.cachedTokens ?? 0;

  // Calculate sentTokens after deducting cached tokens
  const sentTokens = totalSentTokens - cacheReadTokens;

  // Calculate cost internally with already deducted sentTokens
  const messageCost = calculateRequestyCost(model, sentTokens, receivedTokens, cacheWriteTokens, cacheReadTokens);

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

// === Message Normalization Functions ===
export const normalizeRequestyMessages = (_provider: LlmProvider, model: Model, messages: ModelMessage[]): ModelMessage[] => {
  // Apply Gemini normalization for Google/Gemini models
  if (model.id.includes('gemini')) {
    if (messages.length === 0) {
      return messages;
    }

    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== 'user') {
      const continueMessage: ContextUserMessage = {
        id: uuidv4(),
        role: 'user',
        content: 'Continue',
      };

      logger.debug('Added "Continue" user message for Requesty provider with Gemini model (last message was not a user message)');
      return [...messages, continueMessage];
    }
  }

  return messages;
};

// === Configuration Helper Functions ===
export const getRequestyCacheControl = (profile: AgentProfile, llmProvider: LlmProvider): CacheControl | undefined => {
  if (isRequestyProvider(llmProvider) && !llmProvider.useAutoCache) {
    if (profile.model?.startsWith('anthropic/')) {
      return {
        providerOptions: {
          requesty: {
            cacheControl: { type: 'ephemeral' },
          },
        },
        placement: 'message',
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

  // Message normalization
  normalizeMessages: normalizeRequestyMessages,
};
